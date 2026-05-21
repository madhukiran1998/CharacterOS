import { db } from '../db/client';
import { NarrativeThread, classifyPromiseResolution } from './narrativeThreads';

// ─────────────────────────────────────────────────────────────
// Relationship State Module
// ─────────────────────────────────────────────────────────────
// Manages per-character-per-user relationship dynamics.
// Includes sentiment-based micro-deltas, session decay, and
// event-driven updates from narrative threads (promises kept/
// broken, conflicts, secrets shared).
// ─────────────────────────────────────────────────────────────

export interface RelationshipState {
  trust: number;
  familiarity: number;
  resentment: number;
  intimacy: number;
  trust_source: string;
  session_count: number;
  last_interaction: Date | null;
}

// Appraisal emotional delta (subset used for relationship nudge)
export interface AppraisalDelta {
  trust: number;
  anger: number;
  disgust: number;
  joy: number;
}

// Event-driven relationship deltas
export interface RelationshipDelta {
  trust: number;
  familiarity: number;
  resentment: number;
  intimacy: number;
  reason: string;
}

// ─────────────────────────────────────────────────────────────
// readAndUpdateRelationship
// ─────────────────────────────────────────────────────────────
// Reads current relationship state, applies baseline familiarity
// growth, and weak sentiment signals from the current message.
// ─────────────────────────────────────────────────────────────
export async function readAndUpdateRelationship(
  characterId: string,
  userId: string,
  message: string
): Promise<RelationshipState> {
  console.log(`\n=== [RELATIONSHIP] Reading state for character=${characterId} user=${userId}`);

  // Upsert to ensure row exists with all columns
  await db.query(
    `INSERT INTO relationship_state
       (character_id, user_id, trust, familiarity, resentment, intimacy, trust_source, session_count)
     VALUES ($1, $2, 0.5, 0.0, 0.0, 0.0, 'casual', 0)
     ON CONFLICT (character_id, user_id) DO NOTHING`,
    [characterId, userId]
  );

  const current = await db.query<RelationshipState>(
    `SELECT trust, familiarity, resentment, intimacy, trust_source, session_count, last_interaction
     FROM relationship_state
     WHERE character_id = $1 AND user_id = $2`,
    [characterId, userId]
  );
  const state = current.rows[0];
  console.log(`[RELATIONSHIP] Before: trust=${state.trust.toFixed(3)} familiarity=${state.familiarity.toFixed(3)} resentment=${state.resentment.toFixed(3)} intimacy=${state.intimacy.toFixed(3)}`);

  // ── Weak sentiment signal (baseline) ──
  const lower = message.toLowerCase();
  const isPositive = /thank|appreciate|love|great|awesome|wonderful|good|nice|help/.test(lower);
  const isHostile = /hate|stupid|idiot|useless|shut up|fuck|damn you|worthless/.test(lower);

  let trustDelta = 0;
  if (isPositive) trustDelta = 0.005;
  if (isHostile) trustDelta = -0.01;

  // ── Familiarity always grows slightly per turn ──
  const familiarityDelta = 0.005;

  const newTrust = clamp(state.trust + trustDelta);
  const newFamiliarity = clamp(state.familiarity + familiarityDelta);

  await db.query(
    `UPDATE relationship_state
     SET trust = $1, familiarity = $2, last_interaction = NOW()
     WHERE character_id = $3 AND user_id = $4`,
    [newTrust, newFamiliarity, characterId, userId]
  );

  const updated: RelationshipState = {
    trust: newTrust,
    familiarity: newFamiliarity,
    resentment: state.resentment,
    intimacy: state.intimacy,
    trust_source: state.trust_source,
    session_count: state.session_count,
    last_interaction: new Date(),
  };

  console.log(`[RELATIONSHIP] After baseline: trust=${updated.trust.toFixed(3)} familiarity=${updated.familiarity.toFixed(3)}`);
  return updated;
}

// ─────────────────────────────────────────────────────────────
// applyRelationshipEvents
// ─────────────────────────────────────────────────────────────
// Applies relationship deltas based on narrative events.
// This is where characters hold grudges, grow closer, or earn
// trust through action.
// ─────────────────────────────────────────────────────────────
export async function applyRelationshipEvents(
  characterId: string,
  userId: string,
  userMessage: string,
  characterReply: string,
  newThreads: NarrativeThread[],
  resolvedThreadIds: string[]
): Promise<RelationshipDelta[]> {
  console.log(`\n=== [RELATIONSHIP] Applying narrative events ===`);

  const deltas: RelationshipDelta[] = [];

  // ── New thread events ──
  for (const thread of newThreads) {
    switch (thread.type) {
      case 'conflict':
        deltas.push({
          trust: 0,
          familiarity: 0,
          resentment: 0.03,
          intimacy: 0,
          reason: `Conflict started: ${thread.content}`,
        });
        break;

      case 'secret':
        deltas.push({
          trust: 0,
          familiarity: 0,
          resentment: 0,
          intimacy: 0.06,
          reason: `Secret shared: ${thread.content}`,
        });
        break;

      case 'promise':
      case 'question':
        // No immediate relationship change for new promises/questions
        break;
    }
  }

  // ── Resolved thread events ──
  if (resolvedThreadIds.length > 0) {
    // Fetch resolved thread details
    const resolvedResult = await db.query<NarrativeThread>(
      `SELECT id, type, content
       FROM narrative_threads
       WHERE id = ANY($1) AND character_id = $2 AND user_id = $3`,
      [resolvedThreadIds, characterId, userId]
    );

    for (const thread of resolvedResult.rows) {
      switch (thread.type) {
        case 'promise': {
          // Classify whether promise was kept or broken
          const resolution = await classifyPromiseResolution(
            userMessage, characterReply, thread.content
          );

          if (resolution === 'kept') {
            deltas.push({
              trust: 0.05,
              familiarity: 0,
              resentment: 0,
              intimacy: 0,
              reason: `Promise kept: ${thread.content}`,
            });
          } else if (resolution === 'broken') {
            deltas.push({
              trust: -0.04,
              familiarity: 0,
              resentment: 0.08,
              intimacy: 0,
              reason: `Promise broken: ${thread.content}`,
            });
          }
          break;
        }

        case 'conflict':
          deltas.push({
            trust: 0.02,
            familiarity: 0,
            resentment: -0.04,
            intimacy: 0,
            reason: `Conflict resolved: ${thread.content}`,
          });
          break;

        case 'secret':
        case 'question':
          // No relationship change for resolved secrets/questions
          break;
      }
    }
  }

  // ── Apply accumulated deltas ──
  if (deltas.length > 0) {
    const current = await db.query<RelationshipState>(
      `SELECT trust, familiarity, resentment, intimacy, trust_source
       FROM relationship_state
       WHERE character_id = $1 AND user_id = $2`,
      [characterId, userId]
    );
    const state = current.rows[0];

    const totalTrust = deltas.reduce((sum, d) => sum + d.trust, 0);
    const totalResentment = deltas.reduce((sum, d) => sum + d.resentment, 0);
    const totalIntimacy = deltas.reduce((sum, d) => sum + d.intimacy, 0);

    const newTrust = clamp(state.trust + totalTrust);
    const newResentment = clamp(state.resentment + totalResentment);
    const newIntimacy = clamp(state.intimacy + totalIntimacy);

    // Update trust_source if trust changed meaningfully
    let newTrustSource = state.trust_source;
    if (totalTrust >= 0.05) {
      newTrustSource = 'earned';
    } else if (totalTrust <= -0.03) {
      newTrustSource = 'damaged';
    }

    await db.query(
      `UPDATE relationship_state
       SET trust = $1, resentment = $2, intimacy = $3, trust_source = $4
       WHERE character_id = $5 AND user_id = $6`,
      [newTrust, newResentment, newIntimacy, newTrustSource, characterId, userId]
    );

    console.log(`[RELATIONSHIP] Applied ${deltas.length} event(s):`);
    for (const d of deltas) {
      console.log(`  → ${d.reason}: trust ${d.trust >= 0 ? '+' : ''}${d.trust.toFixed(3)}, resentment ${d.resentment >= 0 ? '+' : ''}${d.resentment.toFixed(3)}`);
    }
    console.log(`[RELATIONSHIP] After events: trust=${newTrust.toFixed(3)} resentment=${newResentment.toFixed(3)} intimacy=${newIntimacy.toFixed(3)} source=${newTrustSource}`);
  } else {
    console.log(`[RELATIONSHIP] No narrative events to apply`);
  }

  return deltas;
}

// ─────────────────────────────────────────────────────────────
// applySessionDecay
// ─────────────────────────────────────────────────────────────
// Applies passive decay to relationship metrics when a new
// session starts (gap > 30 minutes).
// ─────────────────────────────────────────────────────────────
export async function applySessionDecay(
  characterId: string,
  userId: string,
  hoursSince: number,
): Promise<void> {
  console.log(`\n=== [RELATIONSHIP] Applying session decay (${hoursSince.toFixed(2)}h gap) ===`);

  const weeksElapsed = hoursSince / 168;

  await db.query(
    `UPDATE relationship_state
     SET trust = LEAST(1.0, GREATEST(0.0, trust + (0.5 - trust) * 0.01 * $1)),
         familiarity = LEAST(1.0, GREATEST(0.0, familiarity + (0.3 - familiarity) * 0.02 * $1)),
         resentment = GREATEST(0.0, resentment * POWER(1 - 0.05, $1)),
         intimacy = LEAST(1.0, GREATEST(0.0, intimacy + (familiarity - intimacy) * 0.01 * $1)),
         session_count = session_count + 1
     WHERE character_id = $2 AND user_id = $3`,
    [weeksElapsed, characterId, userId]
  );

  console.log(`[RELATIONSHIP] Session decay applied`);
}

// ─────────────────────────────────────────────────────────────
// applyAppraisalToRelationship
// ─────────────────────────────────────────────────────────────
// Pipes a dampened fraction of the appraisal emotional delta
// into the relationship state each turn. This is the missing
// wire between "character feels more trusting" and "relationship
// trust actually changes."
//
// Dampening factor (0.2) keeps individual turns from swinging
// the relationship too hard — narrative events still dominate.
// ─────────────────────────────────────────────────────────────
export async function applyAppraisalToRelationship(
  characterId: string,
  userId: string,
  delta: AppraisalDelta,
): Promise<void> {
  const DAMP = 0.2;

  // trust delta → relationship trust (positive appraisal trust raises it, anger/disgust lowers it)
  const trustNudge = delta.trust * DAMP - (delta.anger * 0.05 + delta.disgust * 0.05);
  // positive trust → slight intimacy growth; joy also contributes
  const intimacyNudge = Math.max(0, delta.trust * 0.08 + delta.joy * 0.04);
  // anger/disgust → resentment
  const resentmentNudge = Math.max(0, delta.anger * 0.08 + delta.disgust * 0.05);

  if (Math.abs(trustNudge) < 0.001 && intimacyNudge < 0.001 && resentmentNudge < 0.001) return;

  await db.query(
    `UPDATE relationship_state
     SET trust      = LEAST(1.0, GREATEST(0.0, trust + $1)),
         intimacy   = LEAST(1.0, GREATEST(0.0, intimacy + $2)),
         resentment = LEAST(1.0, GREATEST(0.0, resentment + $3)),
         trust_source = CASE
           WHEN $1 >= 0.03 THEN 'earned'
           WHEN $1 <= -0.02 THEN 'damaged'
           ELSE trust_source
         END
     WHERE character_id = $4 AND user_id = $5`,
    [trustNudge, intimacyNudge, resentmentNudge, characterId, userId],
  );

  console.log(`[RELATIONSHIP] Appraisal nudge: trust ${trustNudge >= 0 ? '+' : ''}${trustNudge.toFixed(3)}, intimacy +${intimacyNudge.toFixed(3)}, resentment +${resentmentNudge.toFixed(3)}`);
}

// ─────────────────────────────────────────────────────────────
// clamp
// ─────────────────────────────────────────────────────────────
function clamp(value: number): number {
  return Math.min(1.0, Math.max(0.0, value));
}
