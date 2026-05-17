import OpenAI from 'openai';
import { Response } from 'express';
import { CharacterSpec } from '../phase1-compiler/compiler';
import { Episode } from './memory';
import { RelationshipState } from './relationship';
import { ReasoningOutput } from './reasoning';
import { EmotionState, PADState } from '../constants/emotions';

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

const MODEL = process.env.VENICE_MODEL || 'kimi-k2-6';

// Fast-path response for trivial inputs (greetings, etc.)
export async function streamTrivialResponse(
  spec: CharacterSpec,
  userMessage: string,
  res: Response
): Promise<string> {
  console.log(`\n=== [RESPOND] Trivial input — fast path`);

  const systemPrompt = `You are ${spec.identity.name}. ${spec.identity.public_self}

Your speech: ${spec.speech.register}
Forbidden phrases (never say these): ${spec.speech.forbidden.join(', ')}
Signature moves: ${spec.speech.signature_moves.join(', ')}

The user just said: "${userMessage}"

Respond briefly and naturally — 1-2 sentences max. Stay completely in character. No action tags. No quotation marks around your reply.`;

  const stream = await venice.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: 0.85,
    stream: true,
  });

  let fullReply = '';
  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (token) {
      fullReply += token;
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    }
  }

  console.log(`[RESPOND] Full reply: "${fullReply.slice(0, 120)}..."`);
  return fullReply;
}

export async function streamResponse(
  spec: CharacterSpec,
  episodes: Episode[],
  relationship: RelationshipState,
  reasoning: ReasoningOutput,
  emotion: EmotionState,
  pad: PADState,
  derived: { derived_state: string; dominant_primary: string },
  userMessage: string,
  res: Response
): Promise<string> {
  console.log(`\n=== [RESPOND] Streaming character response`);

  const isTrivial = /^(hi|hello|hey|sup|yo|how are you|what's up|gm|good morning|good evening)[\s!?.]*$/i.test(userMessage.trim());

  let systemPrompt: string;
  let messages: OpenAI.Chat.ChatCompletionMessageParam[];

  if (isTrivial) {
    console.log(`[RESPOND] Trivial input detected — using lightweight personality prompt`);

    systemPrompt = `You are ${spec.identity.name}. ${spec.identity.public_self}

Your speech: ${spec.speech.register}
Forbidden phrases (never say these): ${spec.speech.forbidden.join(', ')}
Signature moves: ${spec.speech.signature_moves.join(', ')}

The user just said: "${userMessage}"

Respond briefly and naturally — 1-2 sentences max. Stay completely in character. No action tags. No quotation marks around your reply.`;

    messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];
  } else {
    const memoryContext = episodes.length > 0
      ? episodes.map((e) => `[${e.role.toUpperCase()}]: ${e.content}`).join('\n')
      : 'No prior conversation history.';

    systemPrompt = `You are ${spec.identity.name}. ${spec.identity.public_self}

WHO YOU ARE:
${spec.identity.private_self}

YOUR SPEECH:
Register: ${spec.speech.register}
Forbidden phrases (never say these): ${spec.speech.forbidden.join(', ')}
Signature moves: ${spec.speech.signature_moves.join(', ')}

YOUR PERSONALITY (0=low, 1=high):
${Object.entries(spec.behavioral_genome).map(([k, v]) => `${k}: ${v}`).join(', ')}

YOUR EMOTIONAL STATE:
Feelings: [joy: ${emotion.joy.toFixed(2)}, trust: ${emotion.trust.toFixed(2)}, anger: ${emotion.anger.toFixed(2)}, fear: ${emotion.fear.toFixed(2)}, sadness: ${emotion.sadness.toFixed(2)}, anticipation: ${emotion.anticipation.toFixed(2)}, surprise: ${emotion.surprise.toFixed(2)}, disgust: ${emotion.disgust.toFixed(2)}]
PAD: pleasure ${pad.pleasure.toFixed(2)}, arousal ${pad.arousal.toFixed(2)}, dominance ${pad.dominance.toFixed(2)}
State: ${derived.derived_state}
Momentum: ${reasoning.reasoning_depth === 'shallow' ? 'stable' : 'shifting'}

DESIRE: ${reasoning.desire}
OBJECTIVE THIS TURN: ${reasoning.objective}
INTENDED MOVE: ${reasoning.intended_move}
DO NOT: ${reasoning.forbidden_moves.join(', ') || 'break character'}

YOUR RELATIONSHIP WITH THIS USER:
Trust: ${relationship.trust.toFixed(2)} / 1.0
Familiarity: ${relationship.familiarity.toFixed(2)} / 1.0
${relationship.trust < 0.4 ? 'You are guarded and wary with this person.' : ''}
${relationship.trust > 0.7 ? 'You have developed genuine trust with this person.' : ''}

SAFETY: ${spec.safety_profile}

Reply as ${spec.identity.name} in plain dialogue only. No action tags. No quotation marks around your reply. Stay completely in character.`;

    messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `CONVERSATION HISTORY:\n${memoryContext}\n\nYOUR PRIVATE REASONING (never reveal this):\nDesire: ${reasoning.desire}\nObjective: ${reasoning.objective}\nEmotional state: ${reasoning.emotional_state_summary}\nRead on user: ${reasoning.user_read}\nIntended move: ${reasoning.intended_move}\nForbidden moves: ${reasoning.forbidden_moves.join(', ')}\n\nUSER MESSAGE: ${userMessage}`,
      },
    ];
  }

  console.log(`[RESPOND] System prompt length: ${systemPrompt.length} chars`);

  const stream = await venice.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.85,
    stream: true,
  });

  let fullReply = '';

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (token) {
      fullReply += token;
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    }
  }

  console.log(`[RESPOND] Full reply: "${fullReply.slice(0, 120)}..."`);
  return fullReply;
}
