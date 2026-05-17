import OpenAI from 'openai';
import { db } from '../db/client';

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

const MODEL = process.env.VENICE_MODEL || 'kimi-k2-6';

// ─────────────────────────────────────────────────────────────
// Narrative Thread Detection Module
// ─────────────────────────────────────────────────────────────
// Detects promises, conflicts, secrets, and unresolved questions
// in character-user exchanges. Threads persist across sessions
// and influence relationship dynamics.
// ─────────────────────────────────────────────────────────────

export interface NarrativeThread {
  id: string;
  type: 'promise' | 'conflict' | 'secret' | 'question';
  content: string;
  emotional_weight: number;
  status: 'open' | 'resolved';
  created_at: Date;
}

export interface ThreadDetectionResult {
  newThreads: NarrativeThread[];
  resolvedThreadIds: string[];
}

// ─────────────────────────────────────────────────────────────
// loadOpenThreads
// ─────────────────────────────────────────────────────────────
// Returns unresolved narrative threads for a character-user pair,
// ordered by emotional weight (most impactful first).
// ─────────────────────────────────────────────────────────────
export async function loadOpenThreads(
  characterId: string,
  userId: string
): Promise<NarrativeThread[]> {
  const result = await db.query<NarrativeThread>(
    `SELECT id, type, content, emotional_weight, status, created_at
     FROM narrative_threads
     WHERE character_id = $1 AND user_id = $2 AND status = 'open'
     ORDER BY emotional_weight DESC, created_at DESC
     LIMIT 10`,
    [characterId, userId]
  );
  console.log(`[THREADS] Loaded ${result.rows.length} open threads`);
  return result.rows;
}

// ─────────────────────────────────────────────────────────────
// detectAndSaveThreads
// ─────────────────────────────────────────────────────────────
// Analyzes a single exchange (user message + character reply)
// for new narrative threads and resolutions of existing ones.
// Returns both new threads and resolved IDs so the caller can
// apply relationship consequences.
// ─────────────────────────────────────────────────────────────
export async function detectAndSaveThreads(
  characterId: string,
  userId: string,
  userMessage: string,
  characterReply: string,
  openThreads: NarrativeThread[]
): Promise<ThreadDetectionResult> {
  const start = Date.now();
  console.log(`\n=== [THREADS] Detecting narrative threads ===`);

  const openThreadsSummary = openThreads.length > 0
    ? openThreads.map((t) => `- [${t.type}] ${t.content}`).join('\n')
    : 'None.';

  const prompt = `Detect narrative threads in this exchange between a user and a character.

A narrative thread worth tracking is:
- A PROMISE: one party commits to doing something ("I'll come back", "I won't tell anyone", "I promise I'll try")
- A CONFLICT: an argument, accusation, disagreement, or emotional wound opened
- A SECRET: something personal or hidden was confided or revealed
- A QUESTION: an important question was asked but not yet answered

Do NOT flag casual chat, greetings, or minor statements.

Already open threads (do not re-detect these):
${openThreadsSummary}

User said: "${userMessage}"
Character replied: "${characterReply}"

Return ONLY valid JSON:
{
  "new_threads": [
    {
      "type": "promise | conflict | secret | question",
      "content": "one sentence describing what happened",
      "emotional_weight": float 0.0 to 1.0
    }
  ],
  "resolved_thread_ids": ["uuid of any now-resolved open thread, if clearly resolved in this exchange"]
}

If nothing notable happened, return: { "new_threads": [], "resolved_thread_ids": [] }`;

  console.log(`[THREADS] Prompt:\n${prompt}`);

  try {
    const response = await venice.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });

    const raw = response.choices[0].message.content ?? '';
    const ms = Date.now() - start;
    console.log(`[THREADS] Response (${ms}ms):\n${raw}`);

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const text = fenced ? fenced[1] : raw;
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

    // ── Save new threads ──
    const newThreads: NarrativeThread[] = [];
    for (const thread of (parsed.new_threads ?? [])) {
      const insertResult = await db.query<{ id: string }>(
        `INSERT INTO narrative_threads (character_id, user_id, type, content, emotional_weight)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [characterId, userId, thread.type, thread.content, thread.emotional_weight ?? 0.5]
      );

      const savedThread: NarrativeThread = {
        id: insertResult.rows[0].id,
        type: thread.type,
        content: thread.content,
        emotional_weight: thread.emotional_weight ?? 0.5,
        status: 'open',
        created_at: new Date(),
      };

      newThreads.push(savedThread);
      console.log(`[THREADS] Saved new thread: [${thread.type}] ${thread.content}`);
    }

    // ── Mark resolved threads ──
    const resolvedThreadIds: string[] = [];
    for (const threadId of (parsed.resolved_thread_ids ?? [])) {
      await db.query(
        `UPDATE narrative_threads SET status = 'resolved', resolved_at = NOW()
         WHERE id = $1 AND character_id = $2 AND user_id = $3`,
        [threadId, characterId, userId]
      );
      resolvedThreadIds.push(threadId);
      console.log(`[THREADS] Resolved thread: ${threadId}`);
    }

    return { newThreads, resolvedThreadIds };

  } catch (err) {
    // Silently skip — never crash the runtime for thread detection
    console.error(`[THREADS] Detection failed (skipping):`, err);
    return { newThreads: [], resolvedThreadIds: [] };
  }
}

// ─────────────────────────────────────────────────────────────
// classifyPromiseResolution
// ─────────────────────────────────────────────────────────────
// When a promise thread is resolved, determines whether it was
// kept or broken. This drives trust/resentment consequences.
// ─────────────────────────────────────────────────────────────
export async function classifyPromiseResolution(
  userMessage: string,
  characterReply: string,
  promiseContent: string
): Promise<'kept' | 'broken' | 'unclear'> {
  const start = Date.now();
  console.log(`\n=== [THREADS] Classifying promise resolution ===`);

  const prompt = `A promise was made: "${promiseContent}"

Now this exchange happened:
User said: "${userMessage}"
Character replied: "${characterReply}"

Was the promise KEPT, BROKEN, or UNCLEAR from this exchange?

Return ONLY one word: "kept", "broken", or "unclear".`;

  console.log(`[THREADS] Classification prompt:\n${prompt}`);

  try {
    const response = await venice.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 10,
    });

    const raw = (response.choices[0].message.content ?? 'unclear').toLowerCase().trim();
    const ms = Date.now() - start;
    console.log(`[THREADS] Classification result (${ms}ms): ${raw}`);

    if (raw.includes('kept')) return 'kept';
    if (raw.includes('broken')) return 'broken';
    return 'unclear';
  } catch (err) {
    console.error('[THREADS] Classification failed, defaulting to unclear:', err);
    return 'unclear';
  }
}
