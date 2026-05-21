// Reasoning types used across the runtime.
// Appraisal + desire derivation now lives in appraisal.ts (merged call).
// Objective derivation is folded into the response prompt for deep turns.

export interface ReasoningOutput {
  desire: string;
  desire_strength: 'weak' | 'moderate' | 'strong' | 'overwhelming';
  objective: string;
  user_read: string;
  emotional_state_summary: string;
  intended_move: string;
  forbidden_moves: string[];
  reasoning_depth: 'shallow' | 'moderate' | 'deep';
}

export function buildShallowReasoning(
  desire: string,
  desireStrength: ReasoningOutput['desire_strength'],
  derivedState: string,
): ReasoningOutput {
  return {
    desire,
    desire_strength: desireStrength,
    objective: desire,
    user_read: 'casual interaction',
    emotional_state_summary: derivedState,
    intended_move: 'respond naturally',
    forbidden_moves: [],
    reasoning_depth: 'shallow',
  };
}

export function buildDeepReasoning(
  desire: string,
  desireStrength: ReasoningOutput['desire_strength'],
  derivedState: string,
  depth: 'moderate' | 'deep',
): ReasoningOutput {
  // Objective and moves are derived inline by the response LLM — no separate call.
  return {
    desire,
    desire_strength: desireStrength,
    objective: desire,
    user_read: 'derived inline',
    emotional_state_summary: derivedState,
    intended_move: 'derived inline',
    forbidden_moves: [],
    reasoning_depth: depth,
  };
}
