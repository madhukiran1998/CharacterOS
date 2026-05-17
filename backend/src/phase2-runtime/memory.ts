import { db } from '../db/client';
import { embed } from './embed';

// ─────────────────────────────────────────────────────────────
// Memory Retrieval Module
// ─────────────────────────────────────────────────────────────
// Retrieves relevant episodes for a character-user pair using a
// composite scoring model that balances similarity, importance,
// and recency. This prevents old meaningful memories from being
// buried by recent trivial ones.
// ─────────────────────────────────────────────────────────────

export interface Episode {
  id: string;
  role: 'user' | 'character';
  content: string;
  timestamp: Date;
}

// Composite scoring weights (must sum to 1.0)
const WEIGHT_SIMILARITY = 0.45;
const WEIGHT_IMPORTANCE = 0.30;
const WEIGHT_RECENCY = 0.25;

// Recency decay: 0.995^hours means a memory loses ~11% of its
// recency score per day, ~70% per week.
const RECENCY_DECAY_BASE = 0.995;

// Hard cutoff: ignore memories older than 30 days.
// Prevents surfacing ancient irrelevant episodes.
const MAX_MEMORY_AGE_DAYS = 30;

// How many semantic candidates to fetch before deduplication.
const SEMANTIC_CANDIDATE_LIMIT = 20;

// How many unique semantic hits to return after deduplication.
const SEMANTIC_FINAL_LIMIT = 8;

// Recent episodes always included (chronological buffer).
const RECENT_EPISODE_LIMIT = 20;

// ─────────────────────────────────────────────────────────────
// retrieveMemory
// ─────────────────────────────────────────────────────────────
// Returns recent episodes + top semantic hits scored by composite.
// Also bumps accessed_at and importance for retrieved memories
// (fire-and-forget — does not block the response).
// ─────────────────────────────────────────────────────────────
export async function retrieveMemory(
  characterId: string,
  userId: string,
  currentMessage: string
): Promise<Episode[]> {
  console.log(`\n=== [MEMORY] Retrieving for character=${characterId} user=${userId}`);

  // ── Step 1: Fetch recent episodes (always included) ──
  const recentResult = await db.query<Episode>(
    `SELECT id, role, content, timestamp
     FROM episodes
     WHERE character_id = $1 AND user_id = $2
     ORDER BY timestamp DESC
     LIMIT $3`,
    [characterId, userId, RECENT_EPISODE_LIMIT]
  );
  const recent = recentResult.rows.reverse();
  console.log(`[MEMORY] Fetched ${recent.length} recent episodes`);

  // ── Step 2: Fetch semantic candidates with composite scoring ──
  let semantic: Episode[] = [];

  const countResult = await db.query(
    `SELECT COUNT(*) FROM episodes
     WHERE character_id = $1 AND user_id = $2 AND embedding IS NOT NULL`,
    [characterId, userId]
  );
  const hasEmbeddings = parseInt(countResult.rows[0].count) > 0;

  if (hasEmbeddings) {
    const vector = await embed(currentMessage);

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_MEMORY_AGE_DAYS);

    const semanticResult = await db.query<Episode>(
      `SELECT
         id,
         role,
         content,
         timestamp,
         -- composite score: similarity + importance + recency
         (
           (1 - (embedding <=> $3::vector)) * ${WEIGHT_SIMILARITY}
           + COALESCE(importance, 0.5) * ${WEIGHT_IMPORTANCE}
           + POWER(${RECENCY_DECAY_BASE},
             EXTRACT(EPOCH FROM (NOW() - timestamp)) / 3600
           ) * ${WEIGHT_RECENCY}
         ) AS composite_score
       FROM episodes
       WHERE character_id = $1
         AND user_id = $2
         AND embedding IS NOT NULL
         AND timestamp > $4
       ORDER BY composite_score DESC
       LIMIT $5`,
      [characterId, userId, JSON.stringify(vector), cutoffDate, SEMANTIC_CANDIDATE_LIMIT]
    );

    semantic = semanticResult.rows;
    console.log(`[MEMORY] Fetched ${semantic.length} semantic candidates (composite scoring, ${MAX_MEMORY_AGE_DAYS}-day cutoff)`);
  }

  // ── Step 3: Deduplicate ──
  // Recent episodes take priority. Remove any semantic hits that
  // already appear in the recent set.
  const recentIds = new Set(recent.map((e) => e.id));
  const uniqueSemantic = semantic.filter((e) => !recentIds.has(e.id));

  // ── Step 4: Final context ──
  const combined = [...recent, ...uniqueSemantic];
  console.log(`[MEMORY] Combined: ${combined.length} episodes total (${recent.length} recent + ${uniqueSemantic.length} semantic)`);

  // ── Step 5: Bump accessed_at and importance (fire-and-forget) ──
  bumpMemoryAccess(characterId, userId, combined).catch((err) =>
    console.error('[MEMORY] Access bump failed (non-fatal):', err)
  );

  return combined;
}

// ─────────────────────────────────────────────────────────────
// bumpMemoryAccess
// ─────────────────────────────────────────────────────────────
// Increases importance slightly for retrieved memories and marks
// them as recently accessed. This creates a "used it, so it
// matters more" feedback loop.
// ─────────────────────────────────────────────────────────────
async function bumpMemoryAccess(
  characterId: string,
  userId: string,
  episodes: Episode[]
): Promise<void> {
  if (episodes.length === 0) return;

  const ids = episodes.map((e) => e.id);

  await db.query(
    `UPDATE episodes
     SET accessed_at = NOW(),
         importance = LEAST(importance + 0.05, 1.0)
     WHERE character_id = $1
       AND user_id = $2
       AND id = ANY($3)`,
    [characterId, userId, ids]
  );

  console.log(`[MEMORY] Bumped accessed_at + importance for ${ids.length} retrieved episodes`);
}
