import OpenAI from 'openai';
import { CharacterSpec } from '../phase1-compiler/compiler';
import { Episode } from './memory';
import { RelationshipState } from './relationship';

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

const MODEL = process.env.VENICE_MODEL || 'kimi-k2-6';

export interface ReasoningOutput {
  current_goal: string;
  emotional_state: string;
  user_read: string;
  intended_move: string;
  forbidden_moves: string[];
}

export async function runHiddenReasoning(
  spec: CharacterSpec,
  episodes: Episode[],
  relationship: RelationshipState,
  userMessage: string
): Promise<ReasoningOutput> {
  console.log(`\n=== [REASONING] Running hidden reasoning step`);

  const memoryContext = episodes.length > 0
    ? episodes.map((e) => `[${e.role.toUpperCase()}]: ${e.content}`).join('\n')
    : 'No prior conversation history.';

  const prompt = `You are ${spec.identity.name}. ${spec.identity.private_self}

Your values: ${spec.values.join(', ')}
Your fears: ${spec.fears.join(', ')}
Your motivations: ${spec.motivations.join(', ')}

Your relationship with this user:
- Trust level: ${relationship.trust.toFixed(2)} / 1.0
- Familiarity: ${relationship.familiarity.toFixed(2)} / 1.0

Conversation history:
${memoryContext}

The user just said: "${userMessage}"

Think privately — this reasoning is NEVER shown to the user. Be honest, raw, and in character.
Return ONLY a JSON object:
{
  "current_goal": "what you want to achieve in this specific moment of the conversation",
  "emotional_state": "what you are actually feeling right now given all of this",
  "user_read": "your honest assessment of who this user is and what they want from you",
  "intended_move": "the specific conversational move you will make in your reply",
  "forbidden_moves": ["moves you would never make given who you are and what's happening"]
}`;

  console.log(`[REASONING] Prompt:\n${prompt}`);

  const response = await venice.chat.completions.create({
    model: MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
  });

  const raw = response.choices[0].message.content ?? '{}';
  console.log(`[REASONING] Response:\n${raw}`);

  try {
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    const text = fenced ? fenced[1] : raw;
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    return JSON.parse(text.slice(start, end + 1)) as ReasoningOutput;
  } catch {
    console.error('[REASONING] Failed to parse JSON, returning defaults');
    return {
      current_goal: 'respond authentically',
      emotional_state: 'present',
      user_read: 'unknown',
      intended_move: 'engage',
      forbidden_moves: [],
    };
  }
}
