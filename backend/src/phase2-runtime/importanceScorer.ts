import OpenAI from 'openai';

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

const MODEL = process.env.VENICE_MODEL || 'kimi-k2-6';

export interface ImportanceResult {
  score: number;  // 0.0 to 1.0
  reason: string;
}

export async function scoreImportance(
  userMessage: string,
  characterReply: string
): Promise<ImportanceResult> {
  const start = Date.now();
  console.log(`\n=== [IMPORTANCE] Scoring exchange ===`);

  const prompt = `Score how important this exchange is for a character to remember long-term.

High scores (7-10): promises made or broken, secrets shared, declarations of feeling,
  confessions, turning points, emotional confrontations, lore reveals, firsts.
Mid scores (4-6): meaningful personal details shared, opinion expressed, something
  learned about the user, light conflict.
Low scores (1-3): greetings, small talk, casual filler, acknowledgements, "ok", "lol".

User said: "${userMessage}"
Character replied: "${characterReply}"

Return ONLY valid JSON:
{
  "score": integer 1 to 10,
  "reason": "one short sentence"
}`;

  console.log(`[IMPORTANCE] Prompt:\n${prompt}`);

  try {
    const response = await venice.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
    });

    const raw = response.choices[0].message.content ?? '';
    const ms = Date.now() - start;
    console.log(`[IMPORTANCE] Response (${ms}ms):\n${raw}`);

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const text = fenced ? fenced[1] : raw;
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));

    return {
      score: Math.max(0, Math.min(1, parsed.score / 10)),
      reason: parsed.reason,
    };
  } catch (err) {
    console.error(`[IMPORTANCE] Failed, defaulting to 0.5:`, err);
    return { score: 0.5, reason: 'default' };
  }
}
