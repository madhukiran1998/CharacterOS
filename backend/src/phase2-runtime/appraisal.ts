import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { CharacterSpec } from '../phase1-compiler/compiler';
import { EmotionState, PADState } from '../constants/emotions';
import { RelationshipState } from './relationship';
import { Episode } from './memory';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

const MODEL = process.env.VENICE_FAST_MODEL || process.env.VENICE_MODEL || 'llama-3.3-70b';

export interface AppraisalResult {
  relevance: number;
  valence: number;
  coping: number;
  norm_violation: number;
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

export interface DesireResult {
  desire: string;
  desire_strength: 'weak' | 'moderate' | 'strong' | 'overwhelming';
}

export interface AppraisalAndDesire {
  appraisal: AppraisalResult;
  desire: DesireResult;
}

// Merged appraisal + desire in a single LLM call.
// Appraisal: what this message means to the character emotionally.
// Desire: what the character wants right now from the gut.
export async function runAppraisalAndDesire(
  spec: CharacterSpec,
  emotion: EmotionState,
  pad: PADState,
  derivedState: string,
  relationship: RelationshipState,
  episodes: Episode[],
  userMessage: string,
): Promise<AppraisalAndDesire> {
  const start = Date.now();
  console.log(`\n=== [APPRAISAL+DESIRE] Running merged call ===`);

  const recentMessages = episodes
    .slice(-3)
    .map((e) => `[${e.role.toUpperCase()}]: ${e.content}`)
    .join('\n') || 'No prior messages.';

  // Static character context → system message (cache-friendly)
  const system = `You are an appraisal and desire engine for the AI character ${spec.identity.name}.

VALUES: ${spec.values.join(', ')}
FEARS: ${spec.fears.join(', ')}
MOTIVATIONS: ${spec.motivations.join(', ')}

Your job has two parts:
1. APPRAISAL — evaluate what the incoming message means to this character emotionally. Be specific to this character's values and fears. The same message means different things to different characters.
2. DESIRE — what does this character want right now, gut-level? Not what they think they should want — what they actually feel pulled toward.

APPRAISAL RULE: If relevance < 0.2, every emotional_delta value must be between -0.05 and 0.05. Do not manufacture reactions to irrelevant messages.`;

  // Dynamic state → user message
  const user = `EMOTIONAL STATE:
joy: ${emotion.joy.toFixed(2)}, trust: ${emotion.trust.toFixed(2)}, fear: ${emotion.fear.toFixed(2)}, surprise: ${emotion.surprise.toFixed(2)}
sadness: ${emotion.sadness.toFixed(2)}, disgust: ${emotion.disgust.toFixed(2)}, anger: ${emotion.anger.toFixed(2)}, anticipation: ${emotion.anticipation.toFixed(2)}
desire_intensity: ${emotion.desire_intensity.toFixed(2)}
PAD: pleasure ${pad.pleasure.toFixed(2)}, arousal ${pad.arousal.toFixed(2)}, dominance ${pad.dominance.toFixed(2)}
Feeling: ${derivedState}

RELATIONSHIP: trust ${relationship.trust.toFixed(2)}, familiarity ${relationship.familiarity.toFixed(2)}

RECENT CONVERSATION:
${recentMessages}

INCOMING MESSAGE: "${userMessage}"

Respond with JSON matching this schema exactly:
{
  "appraisal": {
    "relevance": <float 0-1>,
    "valence": <float -1 to 1>,
    "coping": <float 0-1>,
    "norm_violation": <float 0-1>,
    "emotional_delta": {
      "joy": <float -0.3 to 0.3>,
      "trust": <float -0.3 to 0.3>,
      "fear": <float -0.3 to 0.3>,
      "surprise": <float -0.3 to 0.3>,
      "sadness": <float -0.3 to 0.3>,
      "disgust": <float -0.3 to 0.3>,
      "anger": <float -0.3 to 0.3>,
      "anticipation": <float -0.3 to 0.3>,
      "desire_intensity": <float -0.2 to 0.2>
    },
    "appraisal_summary": "<one sentence describing what this message means to this character>"
  },
  "desire": {
    "desire": "<what the character wants right now>",
    "desire_strength": "<weak|moderate|strong|overwhelming>"
  }
}`;

  try {
    const response = await venice.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const ms = Date.now() - start;
    console.log(`[APPRAISAL+DESIRE] Response (${ms}ms):\n${raw}`);

    const jsonStr = raw.includes('{') ? raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1) : raw;
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    const a = (parsed.appraisal ?? {}) as Record<string, unknown>;
    const d = (parsed.desire ?? {}) as Record<string, unknown>;
    const deltas = (a.emotional_delta ?? {}) as Record<string, number>;

    const relevance = clamp(num(a.relevance, 0.1), 0, 1);
    const clampDelta = (v: number, max = 0.3) =>
      relevance < 0.2 ? clamp(v, -0.05, 0.05) : clamp(v, -max, max);

    return {
      appraisal: {
        relevance,
        valence: clamp(num(a.valence, 0), -1, 1),
        coping: clamp(num(a.coping, 0.5), 0, 1),
        norm_violation: clamp(num(a.norm_violation, 0), 0, 1),
        emotional_delta: {
          joy: clampDelta(num(deltas.joy)),
          trust: clampDelta(num(deltas.trust)),
          fear: clampDelta(num(deltas.fear)),
          surprise: clampDelta(num(deltas.surprise)),
          sadness: clampDelta(num(deltas.sadness)),
          disgust: clampDelta(num(deltas.disgust)),
          anger: clampDelta(num(deltas.anger)),
          anticipation: clampDelta(num(deltas.anticipation)),
          desire_intensity: clampDelta(num(deltas.desire_intensity), 0.2),
        },
        appraisal_summary: str(a.appraisal_summary, 'No summary'),
      },
      desire: {
        desire: str(d.desire, 'respond naturally'),
        desire_strength: (d.desire_strength as DesireResult['desire_strength']) ?? 'weak',
      },
    };
  } catch (err) {
    const ms = Date.now() - start;
    console.error(`[APPRAISAL+DESIRE] Failed after ${ms}ms:`, err);
    return defaults(derivedState);
  }
}

function defaults(_derivedState: string): AppraisalAndDesire {
  return {
    appraisal: {
      relevance: 0.1,
      valence: 0,
      coping: 0.5,
      norm_violation: 0,
      emotional_delta: { joy: 0, trust: 0, fear: 0, surprise: 0, sadness: 0, disgust: 0, anger: 0, anticipation: 0, desire_intensity: 0 },
      appraisal_summary: 'Appraisal failed — using neutral defaults',
    },
    desire: { desire: 'respond naturally', desire_strength: 'weak' },
  };
}

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' ? v : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}
