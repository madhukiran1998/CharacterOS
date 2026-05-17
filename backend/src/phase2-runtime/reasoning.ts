import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { CharacterSpec } from '../phase1-compiler/compiler';
import { Episode } from './memory';
import { RelationshipState } from './relationship';
import { EmotionState, PADState } from '../constants/emotions';
import { NarrativeThread } from './narrativeThreads';
import { AppraisalResult } from './appraisal';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

const MODEL = process.env.VENICE_MODEL || 'kimi-k2-6';

export interface DesireOutput {
  desire: string;
  desire_strength: 'weak' | 'moderate' | 'strong' | 'overwhelming';
}

export interface ReasoningOutput {
  desire: string;
  desire_strength: 'weak' | 'moderate' | 'strong' | 'overwhelming';
  objective: string;
  user_read: string;
  emotional_state_summary: string;
  intended_move: string;
  forbidden_moves: string[];
  reasoning_depth: 'shallow' | 'moderate' | 'deep';
}

// 3E-1: Derive desire from emotional state
export async function deriveDesire(
  spec: CharacterSpec,
  emotion: EmotionState,
  pad: PADState,
  derivedState: string,
  relationship: RelationshipState,
): Promise<DesireOutput> {
  const start = Date.now();
  console.log(`\n=== [DESIRE] Deriving desire ===`);

  const prompt = `Given this character's values and their current emotional state, what do they desire right now in this interaction?

Character: ${spec.identity.name}
Values: ${spec.values.join(', ')}
Motivations: ${spec.motivations.join(', ')}

Current emotional state:
- Feeling: ${derivedState}
- Joy: ${emotion.joy.toFixed(2)}, Trust: ${emotion.trust.toFixed(2)}, Fear: ${emotion.fear.toFixed(2)}
- Anger: ${emotion.anger.toFixed(2)}, Sadness: ${emotion.sadness.toFixed(2)}, Anticipation: ${emotion.anticipation.toFixed(2)}
- Desire intensity: ${emotion.desire_intensity.toFixed(2)}
- PAD: pleasure ${pad.pleasure.toFixed(2)}, arousal ${pad.arousal.toFixed(2)}, dominance ${pad.dominance.toFixed(2)}

Relationship:
- Trust: ${relationship.trust.toFixed(2)}
- Familiarity: ${relationship.familiarity.toFixed(2)}

Desire is pre-rational — it comes from the gut, from feeling. Not what they think they should want. What they actually want.

Return ONLY valid JSON:
{
  "desire": "what they want right now",
  "desire_strength": "weak | moderate | strong | overwhelming"
}`;

  console.log(`[DESIRE] Prompt:\n${prompt}`);

  try {
    const response = await venice.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const ms = Date.now() - start;
    console.log(`[DESIRE] Response (${ms}ms):\n${raw}`);

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const text = fenced ? fenced[1] : raw;
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) throw new Error('No JSON found');

    const parsed = JSON.parse(text.slice(startIdx, endIdx + 1)) as Record<string, unknown>;

    return {
      desire: (parsed.desire ?? 'uncertain') as string,
      desire_strength: (parsed.desire_strength ?? 'weak') as DesireOutput['desire_strength'],
    };
  } catch (err) {
    console.error(`[DESIRE] Failed:`, err);
    return { desire: 'respond naturally', desire_strength: 'weak' };
  }
}

// 3E-3: Derive objective and moves (main reasoning call)
export async function deriveObjective(
  spec: CharacterSpec,
  emotion: EmotionState,
  pad: PADState,
  derivedState: string,
  desire: string,
  relationship: RelationshipState,
  openThreads: NarrativeThread[],
  episodes: Episode[],
  appraisal: AppraisalResult,
  userMessage: string,
): Promise<Omit<ReasoningOutput, 'desire' | 'desire_strength' | 'reasoning_depth'>> {
  const start = Date.now();
  console.log(`\n=== [OBJECTIVE] Deriving objective and moves ===`);

  const memoryContext = episodes.length > 0
    ? episodes.map((e) => `[${e.role.toUpperCase()}]: ${e.content}`).join('\n')
    : 'No prior conversation history.';

  const threadsContext = openThreads.length > 0
    ? openThreads.map((t) => `- [${t.type.toUpperCase()}] ${t.content} (weight: ${t.emotional_weight.toFixed(2)})`).join('\n')
    : 'None.';

  const prompt = `You are ${spec.identity.name}. ${spec.identity.private_self}

Your values: ${spec.values.join(', ')}
Your fears: ${spec.fears.join(', ')}
Your motivations: ${spec.motivations.join(', ')}

YOUR CURRENT EMOTIONAL STATE:
- Feeling: ${derivedState}
- Joy: ${emotion.joy.toFixed(2)}, Trust: ${emotion.trust.toFixed(2)}, Fear: ${emotion.fear.toFixed(2)}
- Anger: ${emotion.anger.toFixed(2)}, Sadness: ${emotion.sadness.toFixed(2)}, Anticipation: ${emotion.anticipation.toFixed(2)}
- Surprise: ${emotion.surprise.toFixed(2)}, Disgust: ${emotion.disgust.toFixed(2)}
- PAD: pleasure ${pad.pleasure.toFixed(2)}, arousal ${pad.arousal.toFixed(2)}, dominance ${pad.dominance.toFixed(2)}
- Desire: ${desire}

YOUR RELATIONSHIP WITH THIS USER:
- Trust: ${relationship.trust.toFixed(2)} / 1.0
- Familiarity: ${relationship.familiarity.toFixed(2)} / 1.0

UNRESOLVED THREADS:
${threadsContext}

APPRAISAL OF INCOMING MESSAGE:
- Relevance: ${appraisal.relevance.toFixed(2)}
- Valence: ${appraisal.valence.toFixed(2)}
- Coping: ${appraisal.coping.toFixed(2)}
- Summary: ${appraisal.appraisal_summary}

CONVERSATION HISTORY:
${memoryContext}

The user just said: "${userMessage}"

Think privately — this is NEVER shown to the user. Be honest and raw.

Return ONLY valid JSON:
{
  "objective": "what you want to achieve right now",
  "user_read": "your honest read of who this user is and what they want",
  "emotional_state_summary": "describe in your own words how you feel",
  "intended_move": "the specific tactical move you will make in your reply",
  "forbidden_moves": ["things you would never do here"]
}`;

  console.log(`[OBJECTIVE] Prompt:\n${prompt}`);

  try {
    const response = await venice.chat.completions.create({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const raw = response.choices[0].message.content ?? '{}';
    const ms = Date.now() - start;
    console.log(`[OBJECTIVE] Response (${ms}ms):\n${raw}`);

    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const text = fenced ? fenced[1] : raw;
    const startIdx = text.indexOf('{');
    const endIdx = text.lastIndexOf('}');
    if (startIdx === -1 || endIdx === -1) throw new Error('No JSON found');

    const parsed = JSON.parse(text.slice(startIdx, endIdx + 1)) as Record<string, unknown>;

    return {
      objective: (parsed.objective ?? 'respond authentically') as string,
      user_read: (parsed.user_read ?? 'unknown') as string,
      emotional_state_summary: (parsed.emotional_state_summary ?? derivedState) as string,
      intended_move: (parsed.intended_move ?? 'engage') as string,
      forbidden_moves: (parsed.forbidden_moves ?? []) as string[],
    };
  } catch (err) {
    console.error(`[OBJECTIVE] Failed:`, err);
    return {
      objective: 'respond authentically',
      user_read: 'unknown',
      emotional_state_summary: derivedState,
      intended_move: 'engage',
      forbidden_moves: [],
    };
  }
}

// Full 3E pipeline: desire → depth decision → objective
export async function runReasoningPipeline(
  spec: CharacterSpec,
  emotion: EmotionState,
  pad: PADState,
  derivedState: string,
  relationship: RelationshipState,
  openThreads: NarrativeThread[],
  episodes: Episode[],
  appraisal: AppraisalResult,
  forceDeep: boolean,
  userMessage: string,
): Promise<ReasoningOutput> {
  // 3E-1: Derive desire (always runs)
  const desireResult = await deriveDesire(spec, emotion, pad, derivedState, relationship);

  // 3E-2: Determine reasoning depth
  let depth: ReasoningOutput['reasoning_depth'];
  if (forceDeep || appraisal.relevance > 0.6) {
    depth = 'deep';
  } else if (appraisal.relevance > 0.3) {
    depth = 'moderate';
  } else {
    depth = 'shallow';
  }

  console.log(`\n=== [REASONING] Depth: ${depth} (relevance: ${appraisal.relevance.toFixed(2)}, forceDeep: ${forceDeep}) ===`);

  // 3E-3: Derive objective (only for moderate/deep)
  let objectiveResult: Omit<ReasoningOutput, 'desire' | 'desire_strength' | 'reasoning_depth'>;

  if (depth === 'shallow') {
    console.log(`[REASONING] Shallow path — skipping objective derivation`);
    objectiveResult = {
      objective: desireResult.desire,
      user_read: 'casual interaction',
      emotional_state_summary: derivedState,
      intended_move: 'respond naturally',
      forbidden_moves: [],
    };
  } else {
    objectiveResult = await deriveObjective(
      spec, emotion, pad, derivedState, desireResult.desire,
      relationship, openThreads, episodes, appraisal, userMessage
    );
  }

  return {
    ...desireResult,
    ...objectiveResult,
    reasoning_depth: depth,
  };
}
