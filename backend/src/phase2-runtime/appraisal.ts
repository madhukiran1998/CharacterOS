import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { CharacterSpec } from '../phase1-compiler/compiler';
import { EmotionState } from '../constants/emotions';
import { Episode } from './memory';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

const MODEL = process.env.VENICE_MODEL || 'kimi-k2-6';

export interface AppraisalResult {
  relevance: number;        // 0-1
  valence: number;          // -1 to 1
  coping: number;           // 0-1
  norm_violation: number;   // 0-1
  emotional_delta: {
    joy: number;
    trust: number;
    fear: number;
    surprise: number;
    sadness: number;
    disgust: number;
    anger: number;
    anticipation: number;
    desire_intensity: number;
  };
  appraisal_summary: string;
}

export async function runAppraisal(
  spec: CharacterSpec,
  currentEmotion: EmotionState,
  episodes: Episode[],
  userMessage: string,
): Promise<AppraisalResult> {
  const start = Date.now();
  console.log(`\n=== [APPRAISAL] Running appraisal ===`);

  // Get last 3 messages for context
  const lastMessages = episodes.slice(-3).map((e) =>
    `[${e.role.toUpperCase()}]: ${e.content}`
  ).join('\n') || 'No prior messages.';

  const prompt = `You are an appraisal engine for an AI character. Given this character's values, fears, motivations, current emotional state, and an incoming message, evaluate what the message means for this character across four dimensions.

Be specific to THIS character. The same message means different things to different characters.

CRITICAL RULE: If relevance is below 0.2, ALL emotional_delta values MUST be between -0.05 and 0.05. A casual greeting to a proud villain should barely register. Do not manufacture emotional reactions to irrelevant messages.

Return ONLY valid JSON. No other text.

CHARACTER VALUES: ${spec.values.join(', ')}
CHARACTER FEARS: ${spec.fears.join(', ')}
CHARACTER MOTIVATIONS: ${spec.motivations.join(', ')}

CURRENT EMOTIONAL STATE:
- Joy: ${currentEmotion.joy.toFixed(2)}
- Trust: ${currentEmotion.trust.toFixed(2)}
- Fear: ${currentEmotion.fear.toFixed(2)}
- Surprise: ${currentEmotion.surprise.toFixed(2)}
- Sadness: ${currentEmotion.sadness.toFixed(2)}
- Disgust: ${currentEmotion.disgust.toFixed(2)}
- Anger: ${currentEmotion.anger.toFixed(2)}
- Anticipation: ${currentEmotion.anticipation.toFixed(2)}
- Desire: ${currentEmotion.desire_intensity.toFixed(2)}

RECENT MESSAGES:
${lastMessages}

INCOMING MESSAGE: "${userMessage}"

Return ONLY valid JSON:
{
  "relevance": float 0-1,
  "valence": float -1 to 1,
  "coping": float 0-1,
  "norm_violation": float 0-1,
  "emotional_delta": {
    "joy": float -0.3 to 0.3,
    "trust": float -0.3 to 0.3,
    "fear": float -0.3 to 0.3,
    "surprise": float -0.3 to 0.3,
    "sadness": float -0.3 to 0.3,
    "disgust": float -0.3 to 0.3,
    "anger": float -0.3 to 0.3,
    "anticipation": float -0.3 to 0.3,
    "desire_intensity": float -0.2 to 0.2
  },
  "appraisal_summary": "one sentence describing what this message means to this character"
}`;

  console.log(`[APPRAISAL] Prompt:\n${prompt}`);

  try {
    const response = await venice.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const ms = Date.now() - start;
    console.log(`[APPRAISAL] Response (${ms}ms):\n${raw}`);

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const text = fenced ? fenced[1] : raw;
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) throw new Error('No JSON found');

    const parsed = JSON.parse(text.slice(startIdx, endIdx + 1)) as Record<string, unknown>;

    const deltas = (parsed.emotional_delta ?? {}) as Record<string, number>;

    // Clamp deltas if relevance is low
    const relevance = Math.max(0, Math.min(1, (parsed.relevance ?? 0.1) as number));
    const clampDelta = (v: number) => {
      if (relevance < 0.2) return Math.max(-0.05, Math.min(0.05, v));
      return Math.max(-0.3, Math.min(0.3, v));
    };

    return {
      relevance,
      valence: Math.max(-1, Math.min(1, (parsed.valence ?? 0) as number)),
      coping: Math.max(0, Math.min(1, (parsed.coping ?? 0.5) as number)),
      norm_violation: Math.max(0, Math.min(1, (parsed.norm_violation ?? 0) as number)),
      emotional_delta: {
        joy: clampDelta(deltas.joy ?? 0),
        trust: clampDelta(deltas.trust ?? 0),
        fear: clampDelta(deltas.fear ?? 0),
        surprise: clampDelta(deltas.surprise ?? 0),
        sadness: clampDelta(deltas.sadness ?? 0),
        disgust: clampDelta(deltas.disgust ?? 0),
        anger: clampDelta(deltas.anger ?? 0),
        anticipation: clampDelta(deltas.anticipation ?? 0),
        desire_intensity: clampDelta(deltas.desire_intensity ?? 0),
      },
      appraisal_summary: (parsed.appraisal_summary ?? 'No summary') as string,
    };
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`[APPRAISAL] Failed after ${ms}ms:`, err);
    console.log(`[APPRAISAL] Using defaults — relevance 0.1, all deltas zero`);

    return {
      relevance: 0.1,
      valence: 0,
      coping: 0.5,
      norm_violation: 0,
      emotional_delta: {
        joy: 0,
        trust: 0,
        fear: 0,
        surprise: 0,
        sadness: 0,
        disgust: 0,
        anger: 0,
        anticipation: 0,
        desire_intensity: 0,
      },
      appraisal_summary: 'Appraisal failed — using neutral defaults',
    };
  }
}
