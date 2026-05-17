import { db } from '../db/client';
import { embed } from './embed';

export async function writeEpisodes(
  characterId: string,
  userId: string,
  userMessage: string,
  characterReply: string
): Promise<void> {
  console.log(`\n=== [WRITEBACK] Storing episodes for character=${characterId} user=${userId}`);

  const [userEmbedding, charEmbedding] = await Promise.all([
    embed(userMessage),
    embed(characterReply),
  ]);

  await db.query(
    `INSERT INTO episodes (character_id, user_id, role, content, embedding)
     VALUES ($1, $2, 'user', $3, $4::vector), ($1, $2, 'character', $5, $6::vector)`,
    [
      characterId,
      userId,
      userMessage,
      JSON.stringify(userEmbedding),
      characterReply,
      JSON.stringify(charEmbedding),
    ]
  );

  console.log(`[WRITEBACK] Stored user + character episodes with embeddings`);
}
