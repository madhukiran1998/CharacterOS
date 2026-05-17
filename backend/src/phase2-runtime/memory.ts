import { db } from '../db/client';
import { embed } from './embed';

export interface Episode {
  id: string;
  role: 'user' | 'character';
  content: string;
  timestamp: Date;
}

export async function retrieveMemory(
  characterId: string,
  userId: string,
  currentMessage: string
): Promise<Episode[]> {
  console.log(`\n=== [MEMORY] Retrieving for character=${characterId} user=${userId}`);

  // Recent 20 episodes
  const recentResult = await db.query<Episode>(
    `SELECT id, role, content, timestamp
     FROM episodes
     WHERE character_id = $1 AND user_id = $2
     ORDER BY timestamp DESC
     LIMIT 20`,
    [characterId, userId]
  );
  const recent = recentResult.rows.reverse();
  console.log(`[MEMORY] Got ${recent.length} recent episodes`);

  // Semantic top-5 (only if there are episodes with embeddings)
  const countResult = await db.query(
    `SELECT COUNT(*) FROM episodes WHERE character_id = $1 AND user_id = $2 AND embedding IS NOT NULL`,
    [characterId, userId]
  );
  const hasEmbeddings = parseInt(countResult.rows[0].count) > 0;

  let semantic: Episode[] = [];
  if (hasEmbeddings) {
    const vector = await embed(currentMessage);
    const semanticResult = await db.query<Episode>(
      `SELECT id, role, content, timestamp
       FROM episodes
       WHERE character_id = $1 AND user_id = $2 AND embedding IS NOT NULL
       ORDER BY embedding <=> $3::vector
       LIMIT 5`,
      [characterId, userId, JSON.stringify(vector)]
    );
    semantic = semanticResult.rows;
    console.log(`[MEMORY] Got ${semantic.length} semantic hits`);
  }

  // Deduplicate by id, recent takes priority
  const recentIds = new Set(recent.map((e) => e.id));
  const uniqueSemantic = semantic.filter((e) => !recentIds.has(e.id));

  const combined = [...recent, ...uniqueSemantic];
  console.log(`[MEMORY] Combined: ${combined.length} episodes total`);
  return combined;
}
