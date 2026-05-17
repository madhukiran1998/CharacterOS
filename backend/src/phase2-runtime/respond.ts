import OpenAI from 'openai';
import { Response } from 'express';
import { CharacterSpec } from '../phase1-compiler/compiler';
import { Episode } from './memory';
import { RelationshipState } from './relationship';
import { ReasoningOutput } from './reasoning';

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

const MODEL = process.env.VENICE_MODEL || 'kimi-k2-6';

export async function streamResponse(
  spec: CharacterSpec,
  episodes: Episode[],
  relationship: RelationshipState,
  reasoning: ReasoningOutput,
  userMessage: string,
  res: Response
): Promise<string> {
  console.log(`\n=== [RESPOND] Streaming character response`);

  const memoryContext = episodes.length > 0
    ? episodes.map((e) => `[${e.role.toUpperCase()}]: ${e.content}`).join('\n')
    : 'No prior conversation history.';

  const systemPrompt = `You are ${spec.identity.name}. ${spec.identity.public_self}

WHO YOU ARE:
${spec.identity.private_self}

YOUR SPEECH:
Register: ${spec.speech.register}
Forbidden phrases (never say these): ${spec.speech.forbidden.join(', ')}
Signature moves: ${spec.speech.signature_moves.join(', ')}

YOUR PERSONALITY (0=low, 1=high):
${Object.entries(spec.behavioral_genome).map(([k, v]) => `${k}: ${v}`).join(', ')}

YOUR RELATIONSHIP WITH THIS USER:
Trust: ${relationship.trust.toFixed(2)} / 1.0
Familiarity: ${relationship.familiarity.toFixed(2)} / 1.0
${relationship.trust < 0.4 ? 'You are guarded and wary with this person.' : ''}
${relationship.trust > 0.7 ? 'You have developed genuine trust with this person.' : ''}

SAFETY: ${spec.safety_profile}

Reply as ${spec.identity.name} in plain dialogue only. No action tags. No quotation marks around your reply. Stay completely in character.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `CONVERSATION HISTORY:\n${memoryContext}\n\nYOUR PRIVATE REASONING (never reveal this):\nGoal: ${reasoning.current_goal}\nEmotional state: ${reasoning.emotional_state}\nRead on user: ${reasoning.user_read}\nIntended move: ${reasoning.intended_move}\nForbidden moves: ${reasoning.forbidden_moves.join(', ')}\n\nUSER MESSAGE: ${userMessage}`,
    },
  ];

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
