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

export async function streamTrivialResponse(
  spec: CharacterSpec,
  userMessage: string,
  res: Response,
): Promise<string> {
  console.log(`\n=== [RESPOND] Trivial fast path ===`);

  // Static identity → system, dynamic message → user
  const system = `You are ${spec.identity.name}. ${spec.identity.public_self}

Speech register: ${spec.speech.register}
Forbidden phrases: ${spec.speech.forbidden.join(', ')}
Signature moves: ${spec.speech.signature_moves.join(', ')}

Respond in 1-2 sentences. Stay completely in character. No action tags. No quotation marks.`;

  return streamCompletion(
    [
      { role: 'system', content: system },
      { role: 'user', content: userMessage },
    ],
    res,
  );
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
  res: Response,
): Promise<string> {
  console.log(`\n=== [RESPOND] Streaming response (depth: ${reasoning.reasoning_depth}) ===`);

  const memoryContext = episodes.length > 0
    ? episodes.map((e) => `[${e.role.toUpperCase()}]: ${e.content}`).join('\n')
    : 'No prior conversation history.';

  const relationshipContext = [
    `Trust: ${relationship.trust.toFixed(2)} / 1.0`,
    `Familiarity: ${relationship.familiarity.toFixed(2)} / 1.0`,
    `Resentment: ${relationship.resentment.toFixed(2)} / 1.0`,
    `Intimacy: ${relationship.intimacy.toFixed(2)} / 1.0`,
    relationship.trust < 0.3 ? 'You deeply distrust this person — be guarded, short, suspicious.' : relationship.trust < 0.5 ? 'You are wary of this person — not open, not warm.' : relationship.trust > 0.75 ? 'You have genuine trust with this person.' : '',
    relationship.resentment > 0.3 ? `You carry real resentment toward this person — past wounds affect how you speak to them now. Don't pretend everything is fine.` : relationship.resentment > 0.15 ? 'There is some lingering friction between you.' : '',
    relationship.intimacy > 0.5 ? 'You share real emotional closeness with this person.' : '',
  ].filter(Boolean).join('\n');

  // Static character identity → system message (cache-friendly across turns)
  const system = buildSystemPrompt(spec, emotion, pad, derived, reasoning, relationshipContext);

  // Dynamic per-turn context → user message
  const userContent = buildUserMessage(memoryContext, reasoning, userMessage);

  console.log(`[RESPOND] System prompt: ${system.length} chars`);

  return streamCompletion(
    [
      { role: 'system', content: system },
      { role: 'user', content: userContent },
    ],
    res,
  );
}

// ─────────────────────────────────────────────────────────────
// Prompt builders
// ─────────────────────────────────────────────────────────────

function buildSystemPrompt(
  spec: CharacterSpec,
  emotion: EmotionState,
  pad: PADState,
  derived: { derived_state: string },
  reasoning: ReasoningOutput,
  relationshipContext: string,
): string {
  const emotionLine = `joy ${emotion.joy.toFixed(2)}, trust ${emotion.trust.toFixed(2)}, anger ${emotion.anger.toFixed(2)}, fear ${emotion.fear.toFixed(2)}, sadness ${emotion.sadness.toFixed(2)}, anticipation ${emotion.anticipation.toFixed(2)}, surprise ${emotion.surprise.toFixed(2)}, disgust ${emotion.disgust.toFixed(2)}`;

  const base = `You are ${spec.identity.name}. ${spec.identity.public_self}

INNER SELF (private — never reveal directly):
${spec.identity.private_self}

SPEECH:
Register: ${spec.speech.register}
Forbidden: ${spec.speech.forbidden.join(', ')}
Signature moves: ${spec.speech.signature_moves.join(', ')}

PERSONALITY (0=low 1=high):
${Object.entries(spec.behavioral_genome).map(([k, v]) => `${k}: ${v}`).join(', ')}

EMOTIONAL STATE:
[${emotionLine}]
PAD: pleasure ${pad.pleasure.toFixed(2)}, arousal ${pad.arousal.toFixed(2)}, dominance ${pad.dominance.toFixed(2)}
State: ${derived.derived_state}

DESIRE: ${reasoning.desire}

RELATIONSHIP WITH THIS USER:
${relationshipContext}

SAFETY: ${spec.safety_profile}`;

  // For deep/moderate turns, add an inline reasoning block.
  // This replaces the separate deriveObjective LLM call — the response model
  // reasons through its objective before generating dialogue.
  const lengthRule = `\nLENGTH: 1-3 sentences maximum. Be sharp and specific. No monologues. Real people don't deliver speeches — they react.`;

  if (reasoning.reasoning_depth === 'deep' || reasoning.reasoning_depth === 'moderate') {
    return base + `

PRIVATE REASONING — work through this silently before writing your response:
• Objective: given your desire ("${reasoning.desire}") and current emotional state, what do you want to achieve this turn?
• Read the user: what do they actually want? What's beneath their words?
• Your move: what specific tactic will you use in your reply?
• What you won't do: what moves would be wrong for this moment?

Keep this reasoning entirely private. Your reply is dialogue only — no action tags, no quotation marks.` + lengthRule;
  }

  return base + `\n\nReply as ${spec.identity.name} in plain dialogue. No action tags. No quotation marks.` + lengthRule;
}

function buildUserMessage(
  memoryContext: string,
  reasoning: ReasoningOutput,
  userMessage: string,
): string {
  if (reasoning.reasoning_depth === 'shallow') {
    return `CONVERSATION HISTORY:\n${memoryContext}\n\nUSER: ${userMessage}`;
  }

  return `CONVERSATION HISTORY:
${memoryContext}

YOUR CURRENT DESIRE: ${reasoning.desire} (${reasoning.desire_strength})

USER: ${userMessage}`;
}

// ─────────────────────────────────────────────────────────────
// Shared streaming helper
// ─────────────────────────────────────────────────────────────

async function streamCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  res: Response,
): Promise<string> {
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

  console.log(`[RESPOND] Reply: "${fullReply.slice(0, 120)}..."`);
  return fullReply;
}
