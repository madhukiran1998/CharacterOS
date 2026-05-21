import OpenAI from 'openai';

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

const MODEL = process.env.VENICE_FAST_MODEL || process.env.VENICE_MODEL || 'llama-3.3-70b';

export interface ImportanceResult {
  score: number; // 0.0 to 1.0
  reason: string;
}

export async function scoreImportance(
  userMessage: string,
  characterReply: string,
): Promise<ImportanceResult> {
  const start = Date.now();
  console.log(`\n=== [IMPORTANCE] Scoring exchange ===`);

  const system = `Score how important a conversation exchange is for a character to remember long-term.

High (7-10): promises made or broken, secrets shared, declarations of feeling, confessions, turning points, emotional confrontations, lore reveals, firsts.
Mid (4-6): meaningful personal details, opinions expressed, light conflict, something learned about the user.
Low (1-3): greetings, small talk, casual filler, acknowledgements.`;

  const user = `User said: "${userMessage}"
Character replied: "${characterReply}"

Respond with JSON: { "score": <integer 1-10>, "reason": "<one short sentence>" }`;

  try {
    const response = await venice.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.1,
      max_tokens: 120,
    });

    const raw = (response.choices[0].message.content ?? '').trim();
    const ms = Date.now() - start;
    console.log(`[IMPORTANCE] Response (${ms}ms): ${raw}`);

    if (!raw) throw new Error('Empty response from model');

    // json_object mode guarantees valid JSON, but extract from fences just in case
    const jsonStr = raw.includes('{') ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) : raw;
    const parsed = JSON.parse(jsonStr);
    return {
      score: Math.max(0, Math.min(1, (parsed.score ?? 5) / 10)),
      reason: parsed.reason ?? 'no reason',
    };
  } catch (err) {
    console.error(`[IMPORTANCE] Failed, defaulting to 0.5:`, err);
    return { score: 0.5, reason: 'default' };
  }
}
