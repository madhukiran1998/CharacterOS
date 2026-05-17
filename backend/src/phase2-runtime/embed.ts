import OpenAI from 'openai';

const venice = new OpenAI({
  apiKey: process.env.VENICE_API_KEY,
  baseURL: 'https://api.venice.ai/api/v1',
});

export async function embed(text: string): Promise<number[]> {
  console.log(`\n=== [EMBED] Generating embedding for: "${text.slice(0, 80)}..."`);

  const response = await venice.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  const vector = response.data[0].embedding;
  console.log(`[EMBED] Got vector of length ${vector.length}`);
  return vector;
}
