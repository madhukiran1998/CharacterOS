// Platform-level emotion constants
// These never go in the DB — they are code-level defaults

// Plutchik primary emotions
export const PRIMARY_EMOTIONS = [
  'joy', 'trust', 'fear', 'surprise',
  'sadness', 'disgust', 'anger', 'anticipation',
] as const;

export type PrimaryEmotion = (typeof PRIMARY_EMOTIONS)[number];

// Default decay rates per emotion per turn
// Applied every turn as: current -= (decay_rate * current)
export const EMOTION_DECAY_RATES: Record<PrimaryEmotion | 'desire_intensity', number> = {
  joy: 0.08,
  trust: 0.02,
  fear: 0.10,
  surprise: 0.25,
  sadness: 0.03,
  disgust: 0.06,
  anger: 0.12,
  anticipation: 0.08,
  desire_intensity: 0.05,
};

// Emotion state interface (what we store in DB)
export interface EmotionState {
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
}

// PAD (Pleasure-Arousal-Dominance) state
export interface PADState {
  pleasure: number;   // -1 to 1
  arousal: number;    // 0 to 1
  dominance: number;  // 0 to 1
}

// Baseline overrides from character_baselines table
export interface DecayOverrides {
  joy_decay_override?: number | null;
  trust_decay_override?: number | null;
  fear_decay_override?: number | null;
  surprise_decay_override?: number | null;
  sadness_decay_override?: number | null;
  disgust_decay_override?: number | null;
  anger_decay_override?: number | null;
  anticipation_decay_override?: number | null;
  desire_decay_override?: number | null;
}

// Character modifiers
export interface CharacterModifiers {
  volatility: number;
  recovery_rate: number;
}

// PAD mapping from Plutchik values
// Derived, never stored
export function computePAD(e: EmotionState): PADState {
  const pleasure = Math.max(
    -1,
    Math.min(
      1,
      e.joy * 0.4 +
        e.trust * 0.2 -
        e.sadness * 0.3 -
        e.disgust * 0.2 -
        e.anger * 0.1 -
        e.fear * 0.1 +
        e.desire_intensity * 0.2,
    ),
  );

  const arousal = Math.max(
    0,
    Math.min(
      1,
      e.surprise * 0.3 +
        e.anticipation * 0.2 +
        e.anger * 0.2 +
        e.fear * 0.15 +
        e.joy * 0.1 +
        e.desire_intensity * 0.15 -
        e.sadness * 0.1,
    ),
  );

  const raw_dominance =
    e.anger * 0.3 +
    e.trust * 0.2 +
    e.joy * 0.1 -
    e.fear * 0.3 -
    e.sadness * 0.2 +
    e.disgust * 0.1;

  const dominance = Math.max(0, Math.min(1, (raw_dominance + 1) / 2));

  return { pleasure, arousal, dominance };
}

// Derive named emotional state from float values
// Pure function, no LLM
export function deriveEmotionalState(
  e: EmotionState,
  pad: PADState,
): { derived_state: string; dominant_primary: PrimaryEmotion } {
  const dominant_primary = PRIMARY_EMOTIONS.reduce((a, b) =>
    e[a] > e[b] ? a : b,
  );

  // Check combinations from most specific to most general
  if (
    e.joy > 0.7 &&
    pad.arousal > 0.7 &&
    e.trust > 0.7 &&
    e.desire_intensity > 0.6
  )
    return { derived_state: 'euphoric', dominant_primary };

  if (
    e.desire_intensity > 0.7 &&
    pad.arousal > 0.7 &&
    e.anticipation > 0.6
  )
    return { derived_state: 'hungry', dominant_primary };

  if (
    e.joy > 0.6 &&
    e.trust > 0.6 &&
    e.desire_intensity > 0.5 &&
    pad.arousal > 0.5
  )
    return { derived_state: 'lovestruck', dominant_primary };

  if (
    e.desire_intensity > 0.7 &&
    pad.arousal > 0.6 &&
    e.trust > 0.5
  )
    return { derived_state: 'wanting', dominant_primary };

  if (
    e.desire_intensity > 0.6 &&
    e.trust < 0.4 &&
    pad.arousal > 0.5
  )
    return { derived_state: 'yearning', dominant_primary };

  if (
    e.anger > 0.6 &&
    e.anticipation > 0.6 &&
    e.desire_intensity > 0.5
  )
    return { derived_state: 'possessive', dominant_primary };

  if (
    e.anger > 0.7 &&
    pad.arousal > 0.6 &&
    pad.dominance < 0.4
  )
    return { derived_state: 'desperate', dominant_primary };

  if (
    e.anger > 0.6 &&
    pad.arousal < 0.4 &&
    pad.dominance > 0.6
  )
    return { derived_state: 'cold contempt', dominant_primary };

  if (
    e.anger > 0.7 &&
    pad.arousal > 0.7 &&
    pad.dominance > 0.6
  )
    return { derived_state: 'rageful', dominant_primary };

  if (
    e.fear > 0.6 &&
    pad.arousal > 0.6 &&
    pad.dominance < 0.4
  )
    return { derived_state: 'stressed', dominant_primary };

  if (
    e.joy > 0.7 &&
    pad.arousal > 0.6 &&
    e.anticipation > 0.6
  )
    return { derived_state: 'excited', dominant_primary };

  if (
    e.joy > 0.6 &&
    pad.dominance > 0.6 &&
    e.disgust > 0.4
  )
    return { derived_state: 'smug', dominant_primary };

  if (e.surprise > 0.6 && pad.arousal > 0.6)
    return { derived_state: 'flustered', dominant_primary };

  if (
    e.trust > 0.6 &&
    e.desire_intensity > 0.5 &&
    e.sadness > 0.4
  )
    return { derived_state: 'tender', dominant_primary };

  if (
    e.sadness > 0.6 &&
    e.trust > 0.5 &&
    e.desire_intensity > 0.4
  )
    return { derived_state: 'vulnerable', dominant_primary };

  if (e.disgust > 0.6 && pad.dominance > 0.6)
    return { derived_state: 'disdainful', dominant_primary };

  if (e.joy > 0.5 && pad.arousal < 0.3 && e.trust > 0.5)
    return { derived_state: 'content', dominant_primary };

  if (e.sadness > 0.6 && pad.arousal < 0.3)
    return { derived_state: 'melancholy', dominant_primary };

  if (e.fear > 0.5 && e.anticipation > 0.5)
    return { derived_state: 'anxious', dominant_primary };

  const allLow = Object.entries(e).every(([key, v]) =>
    typeof v === 'number' ? v < 0.2 : true,
  );
  if (allLow) return { derived_state: 'numb', dominant_primary };

  // Default: just name the dominant emotion
  return { derived_state: dominant_primary, dominant_primary };
}

// Regeneration threshold check
// If any of these change significantly, force deep reasoning
export function checkRegenerationTrigger(
  padBefore: PADState,
  padAfter: PADState,
  desireBefore: number,
  desireAfter: number,
): boolean {
  return (
    Math.abs(padAfter.arousal - padBefore.arousal) > 0.2 ||
    Math.abs(padAfter.dominance - padBefore.dominance) > 0.15 ||
    Math.abs(desireAfter - desireBefore) > 0.15
  );
}
