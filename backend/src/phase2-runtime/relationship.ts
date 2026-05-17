import { db } from '../db/client';

export interface RelationshipState {
  trust: number;
  familiarity: number;
  last_interaction: Date | null;
}

export async function readAndUpdateRelationship(
  characterId: string,
  userId: string,
  message: string
): Promise<RelationshipState> {
  console.log(`\n=== [RELATIONSHIP] Reading state for character=${characterId} user=${userId}`);

  // Upsert to ensure row exists
  await db.query(
    `INSERT INTO relationship_state (character_id, user_id, trust, familiarity)
     VALUES ($1, $2, 0.5, 0.0)
     ON CONFLICT (character_id, user_id) DO NOTHING`,
    [characterId, userId]
  );

  const current = await db.query<RelationshipState>(
    `SELECT trust, familiarity, last_interaction FROM relationship_state
     WHERE character_id = $1 AND user_id = $2`,
    [characterId, userId]
  );
  const state = current.rows[0];
  console.log(`[RELATIONSHIP] Current: trust=${state.trust.toFixed(3)} familiarity=${state.familiarity.toFixed(3)}`);

  // Compute deltas
  const lower = message.toLowerCase();
  const isPositive = /thank|appreciate|love|great|awesome|wonderful|good|nice|help/.test(lower);
  const isHostile = /hate|stupid|idiot|useless|shut up|fuck|damn you|worthless/.test(lower);

  let trustDelta = 0;
  if (isPositive) trustDelta = 0.01;
  if (isHostile) trustDelta = -0.02;

  const newTrust = Math.min(1.0, Math.max(0.0, state.trust + trustDelta));
  const newFamiliarity = Math.min(1.0, state.familiarity + 0.005);

  await db.query(
    `UPDATE relationship_state
     SET trust = $1, familiarity = $2, last_interaction = NOW()
     WHERE character_id = $3 AND user_id = $4`,
    [newTrust, newFamiliarity, characterId, userId]
  );

  const updated = { trust: newTrust, familiarity: newFamiliarity, last_interaction: new Date() };
  console.log(`[RELATIONSHIP] Updated: trust=${updated.trust.toFixed(3)} familiarity=${updated.familiarity.toFixed(3)}`);
  return updated;
}
