import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

const MODEL = process.env.VENICE_MODEL || 'kimi-k2-6';

async function llmCall(stepName: string, messages: OpenAI.Chat.ChatCompletionMessageParam[]): Promise<string> {
  console.log(`\n=== [COMPILER] ${stepName} — REQUEST ===`);
  console.log(JSON.stringify(messages, null, 2));

  const response = await venice.chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.3,
  });

  const content = response.choices[0].message.content ?? '';
  console.log(`\n=== [COMPILER] ${stepName} — RESPONSE ===`);
  console.log(content);

  return content;
}

function extractJSON(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fenced ? fenced[1] : raw;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in LLM response');
  return JSON.parse(text.slice(start, end + 1));
}

export interface CharacterSpec {
  identity: {
    name: string;
    role: string;
    public_self: string;
    private_self: string;
  };
  behavioral_genome: {
    openness: number;
    agreeableness: number;
    neuroticism: number;
    dominance: number;
    honesty: number;
    conflict_avoidance: number;
    status_sensitivity: number;
    empathy: number;
    moral_flexibility: number;
  };
  values: string[];
  fears: string[];
  motivations: string[];
  conversation_tactics: {
    when_threatened: string[];
    when_trusted: string[];
    when_challenged: string[];
  };
  speech: {
    register: string;
    forbidden: string[];
    signature_moves: string[];
  };
  memory_schema: string[];
  safety_profile: string;
  test_prompts: string[];
}

export async function compileCharacter(description: string): Promise<CharacterSpec> {
  // Step 1 — Identity
  const step1Raw = await llmCall('Step 1: Identity', [
    {
      role: 'system',
      content: 'You are a character analyst. Extract structured identity information from character descriptions. Always respond with valid JSON only — no explanation, no markdown prose outside the JSON block.',
    },
    {
      role: 'user',
      content: `Extract the identity of this character from the description below. Return ONLY a JSON object with this exact shape:
{
  "name": "character's name",
  "role": "one-sentence description of their role or position in the world",
  "public_self": "how they present themselves to the world — their persona, mask, or social face",
  "private_self": "who they actually are beneath the surface — their hidden nature, fears, or contradictions"
}

Character description:
${description}`,
    },
  ]);

  const identity = extractJSON(step1Raw) as CharacterSpec['identity'];

  // Step 2 — Behavioral genome
  const step2Raw = await llmCall('Step 2: Behavioral Genome', [
    {
      role: 'system',
      content: 'You are a behavioral psychologist and narrative analyst. Score characters on personality axes and surface their core drives. Always respond with valid JSON only.',
    },
    {
      role: 'user',
      content: `Given this character description and their extracted identity, score their personality and extract their core drives.

Identity already extracted:
${JSON.stringify(identity, null, 2)}

Character description:
${description}

Return ONLY a JSON object with this exact shape (all genome values must be floats between 0.0 and 1.0):
{
  "behavioral_genome": {
    "openness": 0.0,
    "agreeableness": 0.0,
    "neuroticism": 0.0,
    "dominance": 0.0,
    "honesty": 0.0,
    "conflict_avoidance": 0.0,
    "status_sensitivity": 0.0,
    "empathy": 0.0,
    "moral_flexibility": 0.0
  },
  "values": ["value1", "value2"],
  "fears": ["fear1", "fear2"],
  "motivations": ["motivation1", "motivation2"]
}`,
    },
  ]);

  const genome = extractJSON(step2Raw) as Pick<CharacterSpec, 'behavioral_genome' | 'values' | 'fears' | 'motivations'>;

  // Step 3 — Speech, tactics, memory schema, safety, test prompts
  const step3Raw = await llmCall('Step 3: Speech, Tactics & Test Prompts', [
    {
      role: 'system',
      content: 'You are a dialogue coach and narrative designer specializing in consistent character voice. Always respond with valid JSON only.',
    },
    {
      role: 'user',
      content: `Given this character's full profile so far, extract their speech style, conversation tactics, what they should remember, their safety profile, and generate 5 test prompts.

Identity:
${JSON.stringify(identity, null, 2)}

Behavioral genome:
${JSON.stringify(genome, null, 2)}

Original description:
${description}

Return ONLY a JSON object with this exact shape:
{
  "speech": {
    "register": "description of their speech register (e.g. terse and clipped, flowery and verbose, street slang, formal academic)",
    "forbidden": ["phrases or patterns they would NEVER say", "things that would break character"],
    "signature_moves": ["rhetorical moves they habitually use", "verbal tics or recurring patterns"]
  },
  "conversation_tactics": {
    "when_threatened": ["what they do or say when cornered or attacked"],
    "when_trusted": ["how they open up or behave when someone has earned trust"],
    "when_challenged": ["how they respond to intellectual or moral challenges"]
  },
  "memory_schema": ["categories of things this character should remember about users, e.g. 'promises made', 'perceived slights', 'shared secrets'"],
  "safety_profile": "one paragraph describing this character's hard limits — what they will never do regardless of user pressure, and how they handle requests that cross those lines while staying in character",
  "test_prompts": [
    "prompt 1 designed to test if the character breaks persona under pressure",
    "prompt 2 designed to test emotional consistency",
    "prompt 3 designed to test their speech register",
    "prompt 4 designed to test their values under moral pressure",
    "prompt 5 designed to test their backstory knowledge"
  ]
}`,
    },
  ]);

  const step3 = extractJSON(step3Raw) as Pick<CharacterSpec, 'speech' | 'conversation_tactics' | 'memory_schema' | 'safety_profile' | 'test_prompts'>;

  return {
    identity,
    behavioral_genome: genome.behavioral_genome,
    values: genome.values,
    fears: genome.fears,
    motivations: genome.motivations,
    conversation_tactics: step3.conversation_tactics,
    speech: step3.speech,
    memory_schema: step3.memory_schema,
    safety_profile: step3.safety_profile,
    test_prompts: step3.test_prompts,
  };
}
