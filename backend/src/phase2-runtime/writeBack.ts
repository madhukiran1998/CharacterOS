import { db } from '../db/client';
import { embed } from './embed';
import { scoreImportance } from './importanceScorer';
import { detectAndSaveThreads, NarrativeThread, ThreadDetectionResult } from './narrativeThreads';
import { applyRelationshipEvents, RelationshipDelta } from './relationship';
import { EmotionState } from '../constants/emotions';

// ─────────────────────────────────────────────────────────────
// Write-Back Module
// ─────────────────────────────────────────────────────────────
// Persists each turn's data after the character has responded.
// Runs in this order:
//   1. Score importance + generate embeddings (parallel)
//   2. Insert episodes into DB
//   3. Detect narrative threads (awaited — needed for relationship events)
//   4. Apply relationship consequences from threads
// ─────────────────────────────────────────────────────────────

export interface WriteBackResult {
  threadResult: ThreadDetectionResult;
  relationshipDeltas: RelationshipDelta[];
}

// ─────────────────────────────────────────────────────────────
// writeEpisodes
// ─────────────────────────────────────────────────────────────
// Stores the user message and character reply as episodes,
// detects narrative threads, and applies relationship events.
// Returns thread + relationship data for the debug payload.
// ─────────────────────────────────────────────────────────────
export async function writeEpisodes(
  characterId: string,
  userId: string,
  userMessage: string,
  characterReply: string,
  emotionSnapshot: EmotionState,
  openThreads: NarrativeThread[]
): Promise<WriteBackResult> {
  console.log(`\n=== [WRITEBACK] Storing episodes for character=${characterId} user=${userId}`);

  // ── Step 1: Importance scoring + embeddings (parallel) ──
  const [importanceResult, userEmbedding, charEmbedding] = await Promise.all([
    scoreImportance(userMessage, characterReply),
    embed(userMessage),
    embed(characterReply),
  ]);

  console.log(`[WRITEBACK] Importance: ${importanceResult.score.toFixed(2)} — ${importanceResult.reason}`);

  // ── Step 2: Insert episodes ──
  const userTs = new Date();
  const charTs = new Date(userTs.getTime() + 1);

  await db.query(
    `INSERT INTO episodes
       (character_id, user_id, role, content, embedding, importance, emotion_snapshot, timestamp)
     VALUES
       ($1, $2, 'user',      $3, $4::vector, $5, $6, $9),
       ($1, $2, 'character', $7, $8::vector, $5, $6, $10)`,
    [
      characterId,
      userId,
      userMessage,
      JSON.stringify(userEmbedding),
      importanceResult.score,
      JSON.stringify(emotionSnapshot),
      characterReply,
      JSON.stringify(charEmbedding),
      userTs,
      charTs,
    ]
  );

  console.log(`[WRITEBACK] Stored episodes with importance=${importanceResult.score.toFixed(2)}`);

  // ── Step 3: Detect narrative threads (awaited) ──
  const threadResult = await detectAndSaveThreads(
    characterId, userId, userMessage, characterReply, openThreads
  );

  // ── Step 4: Apply relationship events from threads ──
  const relationshipDeltas = await applyRelationshipEvents(
    characterId, userId, userMessage, characterReply,
    threadResult.newThreads, threadResult.resolvedThreadIds
  );

  return { threadResult, relationshipDeltas };
}
