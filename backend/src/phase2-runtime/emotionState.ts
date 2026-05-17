import { db } from '../db/client';
import {
  EmotionState,
  PADState,
  computePAD,
  deriveEmotionalState,
  checkRegenerationTrigger,
  EMOTION_DECAY_RATES,
  PrimaryEmotion,
} from '../constants/emotions';

export { EmotionState, PADState };

interface BaselineRow {
  joy: number;
  trust: number;
  fear: number;
  surprise: number;
  sadness: number;
  disgust: number;
  anger: number;
  anticipation: number;
  desire_intensity: number;
  desire_nature: string;
  volatility: number;
  recovery_rate: number;
  joy_decay_override: number | null;
  trust_decay_override: number | null;
  fear_decay_override: number | null;
  surprise_decay_override: number | null;
  sadness_decay_override: number | null;
  disgust_decay_override: number | null;
  anger_decay_override: number | null;
  anticipation_decay_override: number | null;
  desire_decay_override: number | null;
}

interface StoredEmotionRow {
  joy: number;
  trust: number;
  fear: number;
  surprise: number;
  sadness: number;
  disgust: number;
  anger: number;
  anticipation: number;
  desire_intensity: number;
  desire_target: string;
  desire_nature: string;
  derived_state: string;
  dominant_primary: string;
  momentum: string;
  current_desire: string | null;
  current_objective: string | null;
  last_updated: Date;
}

async function loadBaselines(characterId: string): Promise<BaselineRow | null> {
  const result = await db.query<BaselineRow>(
    `SELECT joy, trust, fear, surprise, sadness, disgust, anger, anticipation,
            desire_intensity, desire_nature, volatility, recovery_rate,
            joy_decay_override, trust_decay_override, fear_decay_override, surprise_decay_override,
            sadness_decay_override, disgust_decay_override, anger_decay_override, anticipation_decay_override,
            desire_decay_override
     FROM character_baselines
     WHERE character_id = $1`,
    [characterId]
  );
  return result.rows[0] ?? null;
}

async function loadStoredEmotion(
  characterId: string,
  userId: string,
): Promise<StoredEmotionRow | null> {
  const result = await db.query<StoredEmotionRow>(
    `SELECT joy, trust, fear, surprise, sadness, disgust, anger, anticipation,
            desire_intensity, desire_target, desire_nature,
            derived_state, dominant_primary, momentum,
            current_desire, current_objective, last_updated
     FROM emotional_state
     WHERE character_id = $1 AND user_id = $2`,
    [characterId, userId]
  );
  return result.rows[0] ?? null;
}

function toEmotionState(row: StoredEmotionRow | BaselineRow): EmotionState {
  return {
    joy: row.joy,
    trust: row.trust,
    fear: row.fear,
    surprise: row.surprise,
    sadness: row.sadness,
    disgust: row.disgust,
    anger: row.anger,
    anticipation: row.anticipation,
    desire_intensity: row.desire_intensity,
    desire_target: (row as StoredEmotionRow).desire_target ?? 'none',
    desire_nature: row.desire_nature,
  };
}

// Apply session decay — emotions drift back toward baseline when time passes
function applySessionDecay(
  current: EmotionState,
  baseline: BaselineRow,
  hoursElapsed: number,
): EmotionState {
  const sessionDecay = Math.pow(0.85, hoursElapsed / 24);

  const decayEmotion = (curr: number, base: number): number => {
    return base + (curr - base) * sessionDecay;
  };

  // Desire fades faster
  const desireDecay = Math.pow(0.85, hoursElapsed / 24) * 0.7;

  return {
    joy: decayEmotion(current.joy, baseline.joy),
    trust: decayEmotion(current.trust, baseline.trust),
    fear: decayEmotion(current.fear, baseline.fear),
    surprise: decayEmotion(current.surprise, baseline.surprise),
    sadness: decayEmotion(current.sadness, baseline.sadness),
    disgust: decayEmotion(current.disgust, baseline.disgust),
    anger: decayEmotion(current.anger, baseline.anger),
    anticipation: decayEmotion(current.anticipation, baseline.anticipation),
    desire_intensity: baseline.desire_intensity + (current.desire_intensity - baseline.desire_intensity) * desireDecay,
    desire_target: current.desire_target,
    desire_nature: current.desire_nature,
  };
}

// Emotion math: apply appraisal delta + decay + recovery
export function applyEmotionMath(
  current: EmotionState,
  baseline: BaselineRow,
  delta: Record<string, number>,
): EmotionState {
  const apply = (emotion: PrimaryEmotion | 'desire_intensity'): number => {
    const curr = current[emotion];
    const base = baseline[emotion as keyof BaselineRow] as number;
    const d = delta[emotion] ?? 0;
    const decayOverride = baseline[`${emotion}_decay_override` as keyof BaselineRow] as number | null;
    const decayRate = decayOverride ?? EMOTION_DECAY_RATES[emotion];

    // Three forces:
    // 1. Appraisal delta scaled by volatility
    // 2. Natural decay
    // 3. Recovery toward baseline
    let newVal = curr
      + (baseline.volatility * d)
      - (decayRate * curr)
      - (baseline.recovery_rate * (curr - base));

    return Math.max(0, Math.min(1, newVal));
  };

  return {
    joy: apply('joy'),
    trust: apply('trust'),
    fear: apply('fear'),
    surprise: apply('surprise'),
    sadness: apply('sadness'),
    disgust: apply('disgust'),
    anger: apply('anger'),
    anticipation: apply('anticipation'),
    desire_intensity: apply('desire_intensity'),
    desire_target: current.desire_target,
    desire_nature: current.desire_nature,
  };
}

// Update desire_target based on new desire intensity
function updateDesireTarget(state: EmotionState): EmotionState {
  let target = state.desire_target;
  if (state.desire_intensity > 0.5 && target === 'none') {
    target = 'user';
  }
  if (state.desire_intensity < 0.15) {
    target = 'none';
  }
  return { ...state, desire_target: target };
}

// Compute momentum: rising, falling, or stable
function computeMomentum(before: EmotionState, after: EmotionState): string {
  const sumBefore = before.joy + before.trust + before.fear + before.surprise +
    before.sadness + before.disgust + before.anger + before.anticipation;
  const sumAfter = after.joy + after.trust + after.fear + after.surprise +
    after.sadness + after.disgust + after.anger + after.anticipation;

  if (sumAfter > sumBefore + 0.15) return 'rising';
  if (sumAfter < sumBefore - 0.15) return 'falling';
  return 'stable';
}

export async function loadEmotionState(
  characterId: string,
  userId: string,
): Promise<{ state: EmotionState; pad: PADState; derived: { derived_state: string; dominant_primary: string }; wasNewSession: boolean; hoursSince: number }> {
  console.log(`\n=== [EMOTION] Loading state for character=${characterId} user=${userId}`);

  const baselines = await loadBaselines(characterId);
  if (!baselines) {
    throw new Error(`No baselines found for character ${characterId}`);
  }

  const stored = await loadStoredEmotion(characterId, userId);

  if (!stored) {
    // First interaction — clone from baselines
    const fresh: EmotionState = {
      joy: baselines.joy,
      trust: baselines.trust,
      fear: baselines.fear,
      surprise: baselines.surprise,
      sadness: baselines.sadness,
      disgust: baselines.disgust,
      anger: baselines.anger,
      anticipation: baselines.anticipation,
      desire_intensity: baselines.desire_intensity,
      desire_target: 'none',
      desire_nature: baselines.desire_nature,
    };

    const pad = computePAD(fresh);
    const derived = deriveEmotionalState(fresh, pad);

    console.log(`[EMOTION] No prior state — cloned from baselines: ${derived.derived_state}`);

    // Insert initial row
    await saveEmotionState(characterId, userId, fresh, derived, 'stable', null, null);

    return { state: fresh, pad, derived, wasNewSession: false, hoursSince: 0 };
  }

  // Check session gap
  const lastUpdated = new Date(stored.last_updated);
  const hoursSince = (Date.now() - lastUpdated.getTime()) / (1000 * 60 * 60);
  const isNewSession = hoursSince > 0.5; // 30 minutes

  let state = toEmotionState(stored);

  if (isNewSession) {
    console.log(`[EMOTION] New session detected (${hoursSince.toFixed(2)}h gap) — applying decay`);
    state = applySessionDecay(state, baselines, hoursSince);
    console.log(`[EMOTION] After decay: joy=${state.joy.toFixed(2)} trust=${state.trust.toFixed(2)} anger=${state.anger.toFixed(2)} ...`);
  } else {
    console.log(`[EMOTION] Same session (${hoursSince.toFixed(2)}h) — no decay`);
  }

  const pad = computePAD(state);
  const derived = deriveEmotionalState(state, pad);

  return { state, pad, derived, wasNewSession: isNewSession, hoursSince };
}

export async function saveEmotionState(
  characterId: string,
  userId: string,
  state: EmotionState,
  derived: { derived_state: string; dominant_primary: string },
  momentum: string,
  currentDesire: string | null,
  currentObjective: string | null,
): Promise<void> {
  const pad = computePAD(state);

  await db.query(
    `INSERT INTO emotional_state (
      character_id, user_id,
      joy, trust, fear, surprise, sadness, disgust, anger, anticipation,
      desire_intensity, desire_target, desire_nature,
      derived_state, dominant_primary, momentum,
      computed_pad, current_desire, current_objective,
      last_updated
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, NOW())
    ON CONFLICT (character_id, user_id) DO UPDATE SET
      joy = EXCLUDED.joy,
      trust = EXCLUDED.trust,
      fear = EXCLUDED.fear,
      surprise = EXCLUDED.surprise,
      sadness = EXCLUDED.sadness,
      disgust = EXCLUDED.disgust,
      anger = EXCLUDED.anger,
      anticipation = EXCLUDED.anticipation,
      desire_intensity = EXCLUDED.desire_intensity,
      desire_target = EXCLUDED.desire_target,
      desire_nature = EXCLUDED.desire_nature,
      derived_state = EXCLUDED.derived_state,
      dominant_primary = EXCLUDED.dominant_primary,
      momentum = EXCLUDED.momentum,
      computed_pad = EXCLUDED.computed_pad,
      current_desire = EXCLUDED.current_desire,
      current_objective = EXCLUDED.current_objective,
      last_updated = NOW()`,
    [
      characterId, userId,
      state.joy, state.trust, state.fear, state.surprise,
      state.sadness, state.disgust, state.anger, state.anticipation,
      state.desire_intensity, state.desire_target, state.desire_nature,
      derived.derived_state, derived.dominant_primary, momentum,
      JSON.stringify(pad), currentDesire, currentObjective,
    ]
  );

  console.log(`[EMOTION] Saved: ${derived.derived_state} (momentum: ${momentum})`);
}
