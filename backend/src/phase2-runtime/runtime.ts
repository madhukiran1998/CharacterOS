import { Response } from 'express';
import { db } from '../db/client';
import { CharacterSpec } from '../phase1-compiler/compiler';
import { retrieveMemory } from './memory';
import { readAndUpdateRelationship, applySessionDecay as applyRelationshipSessionDecay } from './relationship';
import { loadEmotionState, saveEmotionState, applyEmotionMath } from './emotionState';
import { loadOpenThreads } from './narrativeThreads';
import { runReasoningPipeline, deriveDesire } from './reasoning';
import { streamResponse, streamTrivialResponse } from './respond';
import { writeEpisodes } from './writeBack';
import { runAppraisal } from './appraisal';
import { computePAD, deriveEmotionalState, checkRegenerationTrigger } from '../constants/emotions';

function sendEvent(res: Response, event: object) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const TRIVIAL_REGEX = /^(hi|hello|hey|sup|yo|how are you|what's up|gm|good morning|good evening)[\s!?.]*$/i;

export async function runRuntimeLoop(
  characterId: string,
  userId: string,
  userMessage: string,
  res: Response
): Promise<void> {
  const charResult = await db.query(
    `SELECT spec FROM characters WHERE id = $1`,
    [characterId]
  );
  if (charResult.rows.length === 0) throw new Error(`Character ${characterId} not found`);
  const spec = charResult.rows[0].spec as CharacterSpec;

  console.log(`\n====== [RUNTIME] Turn start — character: ${spec.identity.name} | user: ${userId} ======`);

  // === FAST PATH: Trivial input bypass ===
  const isTrivial = TRIVIAL_REGEX.test(userMessage.trim());
  if (isTrivial) {
    console.log(`[RUNTIME] Trivial input detected — fast path`);
    sendEvent(res, { type: 'step', step: 1, label: 'Fast path (trivial input)...' });

    // Still need emotion state for write-back and debug payload
    const { state: emotionBefore, pad: padBefore, derived: derivedBefore, wasNewSession, hoursSince } =
      await loadEmotionState(characterId, userId);

    if (wasNewSession) {
      await applyRelationshipSessionDecay(characterId, userId, hoursSince);
    }

    const reply = await streamTrivialResponse(spec, userMessage, res);

    // Write back with minimal debug data
    await writeEpisodes(characterId, userId, userMessage, reply, emotionBefore, []);

    sendEvent(res, {
      type: 'done',
      appraisal: {
        relevance: 0.1,
        valence: 0,
        coping: 0.5,
        norm_violation: 0,
        emotional_delta: { joy: 0, trust: 0, fear: 0, surprise: 0, sadness: 0, disgust: 0, anger: 0, anticipation: 0, desire_intensity: 0 },
        appraisal_summary: 'Trivial input — fast path',
      },
      emotion_before: {
        plutchik: { joy: emotionBefore.joy, trust: emotionBefore.trust, fear: emotionBefore.fear, surprise: emotionBefore.surprise, sadness: emotionBefore.sadness, disgust: emotionBefore.disgust, anger: emotionBefore.anger, anticipation: emotionBefore.anticipation },
        desire_intensity: emotionBefore.desire_intensity,
        derived_state: derivedBefore.derived_state,
        pad: padBefore,
      },
      emotion_after: {
        plutchik: { joy: emotionBefore.joy, trust: emotionBefore.trust, fear: emotionBefore.fear, surprise: emotionBefore.surprise, sadness: emotionBefore.sadness, disgust: emotionBefore.disgust, anger: emotionBefore.anger, anticipation: emotionBefore.anticipation },
        desire_intensity: emotionBefore.desire_intensity,
        desire_target: emotionBefore.desire_target,
        derived_state: derivedBefore.derived_state,
        dominant_primary: derivedBefore.dominant_primary,
        momentum: 'stable',
        pad: padBefore,
      },
      goal_state: {
        desire: 'acknowledge greeting',
        desire_strength: 'weak',
        objective: 'respond naturally',
        reasoning_depth: 'shallow',
        force_deep_triggered: false,
      },
      reasoning: {
        user_read: 'casual interaction',
        emotional_state_summary: derivedBefore.derived_state,
        intended_move: 'respond naturally',
        forbidden_moves: [],
      },
      relationship_state: { trust: 0.5, familiarity: 0.1, resentment: 0, intimacy: 0, trust_source: 'default' },
      session: { was_new_session: wasNewSession, hours_since_last: hoursSince, session_decay_applied: wasNewSession ? Math.pow(0.85, hoursSince / 24) : 1.0 },
      open_threads: [],
    });

    console.log(`====== [RUNTIME] Turn complete (fast path) ======\n`);
    return;
  }

  // Step 1 — Memory retrieval
  sendEvent(res, { type: 'step', step: 1, label: 'Retrieving memories...' });
  const episodes = await retrieveMemory(characterId, userId, userMessage);

  // Step 2 — Relationship state
  sendEvent(res, { type: 'step', step: 2, label: 'Reading relationship state...' });
  const relationship = await readAndUpdateRelationship(characterId, userId, userMessage);

  // Step 3 — Appraisal Pipeline
  sendEvent(res, { type: 'step', step: 3, label: 'Appraising...' });

  // 3A: Load emotional state
  sendEvent(res, { type: 'substep', substep: '3A', label: 'Loading emotional state...' });
  const { state: emotionBefore, pad: padBefore, derived: derivedBefore, wasNewSession, hoursSince } =
    await loadEmotionState(characterId, userId);

  if (wasNewSession) {
    await applyRelationshipSessionDecay(characterId, userId, hoursSince);
  }

  // 3B: Session decay
  sendEvent(res, { type: 'substep', substep: '3B', label: 'Session decay applied...' });

  // 3C + 3E-1: PARALLEL — Appraisal and Desire (they don't depend on each other)
  sendEvent(res, { type: 'substep', substep: '3C', label: 'Appraising message + deriving desire...' });
  const [appraisal, desireResult] = await Promise.all([
    runAppraisal(spec, emotionBefore, episodes, userMessage),
    deriveDesire(spec, emotionBefore, padBefore, derivedBefore.derived_state, relationship),
  ]);

  // 3D: Emotion math (pure code)
  sendEvent(res, { type: 'substep', substep: '3D', label: 'Computing emotions...' });
  const baselines = await db.query(
    `SELECT * FROM character_baselines WHERE character_id = $1`,
    [characterId]
  );
  if (baselines.rows.length === 0) throw new Error(`No baselines for character ${characterId}`);
  const baseline = baselines.rows[0];

  const emotionAfterMath = applyEmotionMath(emotionBefore, baseline, appraisal.emotional_delta);
  const padAfter = computePAD(emotionAfterMath);
  const derivedAfter = deriveEmotionalState(emotionAfterMath, padAfter);
  const momentum = (() => {
    const prevSum = emotionBefore.joy + emotionBefore.trust + emotionBefore.fear + emotionBefore.surprise +
      emotionBefore.sadness + emotionBefore.disgust + emotionBefore.anger + emotionBefore.anticipation;
    const newSum = emotionAfterMath.joy + emotionAfterMath.trust + emotionAfterMath.fear + emotionAfterMath.surprise +
      emotionAfterMath.sadness + emotionAfterMath.disgust + emotionAfterMath.anger + emotionAfterMath.anticipation;
    if (newSum > prevSum + 0.15) return 'rising';
    if (newSum < prevSum - 0.15) return 'falling';
    return 'stable';
  })();

  const forceDeep = checkRegenerationTrigger(padBefore, padAfter, emotionBefore.desire_intensity, emotionAfterMath.desire_intensity);

  // 3E: Depth decision + Objective (conditional)
  sendEvent(res, { type: 'substep', substep: '3E', label: 'Deriving objectives...' });
  const openThreads = await loadOpenThreads(characterId, userId);

  let depth: 'shallow' | 'moderate' | 'deep';
  if (forceDeep || appraisal.relevance > 0.6) {
    depth = 'deep';
  } else if (appraisal.relevance > 0.3) {
    depth = 'moderate';
  } else {
    depth = 'shallow';
  }

  let objectiveResult: { objective: string; user_read: string; emotional_state_summary: string; intended_move: string; forbidden_moves: string[] };

  if (depth === 'shallow') {
    console.log(`[REASONING] Shallow path — skipping objective derivation`);
    objectiveResult = {
      objective: desireResult.desire,
      user_read: 'casual interaction',
      emotional_state_summary: derivedAfter.derived_state,
      intended_move: 'respond naturally',
      forbidden_moves: [],
    };
  } else {
    const { deriveObjective } = await import('./reasoning');
    objectiveResult = await deriveObjective(
      spec, emotionAfterMath, padAfter, derivedAfter.derived_state, desireResult.desire,
      relationship, openThreads, episodes, appraisal, userMessage
    );
  }

  const reasoning = {
    ...desireResult,
    ...objectiveResult,
    reasoning_depth: depth,
  };

  // Save updated emotion state
  await saveEmotionState(
    characterId, userId, emotionAfterMath, derivedAfter, momentum,
    reasoning.desire, reasoning.objective
  );

  // Step 4 — Stream response
  sendEvent(res, { type: 'step', step: 4, label: 'Responding...' });
  const reply = await streamResponse(
    spec, episodes, relationship, reasoning, emotionAfterMath, padAfter, derivedAfter, userMessage, res
  );

  // Step 5 — Write back
  sendEvent(res, { type: 'step', step: 5, label: 'Saving...' });
  const writeBackResult = await writeEpisodes(characterId, userId, userMessage, reply, emotionAfterMath, openThreads);

  // Send full debug state to frontend
  sendEvent(res, {
    type: 'done',
    appraisal: {
      relevance: appraisal.relevance,
      valence: appraisal.valence,
      coping: appraisal.coping,
      norm_violation: appraisal.norm_violation,
      emotional_delta: appraisal.emotional_delta,
      appraisal_summary: appraisal.appraisal_summary,
    },
    emotion_before: {
      plutchik: {
        joy: emotionBefore.joy,
        trust: emotionBefore.trust,
        fear: emotionBefore.fear,
        surprise: emotionBefore.surprise,
        sadness: emotionBefore.sadness,
        disgust: emotionBefore.disgust,
        anger: emotionBefore.anger,
        anticipation: emotionBefore.anticipation,
      },
      desire_intensity: emotionBefore.desire_intensity,
      derived_state: derivedBefore.derived_state,
      pad: padBefore,
    },
    emotion_after: {
      plutchik: {
        joy: emotionAfterMath.joy,
        trust: emotionAfterMath.trust,
        fear: emotionAfterMath.fear,
        surprise: emotionAfterMath.surprise,
        sadness: emotionAfterMath.sadness,
        disgust: emotionAfterMath.disgust,
        anger: emotionAfterMath.anger,
        anticipation: emotionAfterMath.anticipation,
      },
      desire_intensity: emotionAfterMath.desire_intensity,
      desire_target: emotionAfterMath.desire_target,
      derived_state: derivedAfter.derived_state,
      dominant_primary: derivedAfter.dominant_primary,
      momentum,
      pad: padAfter,
    },
    goal_state: {
      desire: reasoning.desire,
      desire_strength: reasoning.desire_strength,
      objective: reasoning.objective,
      reasoning_depth: reasoning.reasoning_depth,
      force_deep_triggered: forceDeep,
    },
    reasoning: {
      user_read: reasoning.user_read,
      emotional_state_summary: reasoning.emotional_state_summary,
      intended_move: reasoning.intended_move,
      forbidden_moves: reasoning.forbidden_moves,
    },
    relationship_state: relationship,
    session: {
      was_new_session: wasNewSession,
      hours_since_last: hoursSince,
      session_decay_applied: wasNewSession ? Math.pow(0.85, hoursSince / 24) : 1.0,
    },
    open_threads: openThreads,
    narrative: {
      new_threads: writeBackResult.threadResult.newThreads.map((t) => ({
        type: t.type,
        content: t.content,
        emotional_weight: t.emotional_weight,
      })),
      resolved_threads: writeBackResult.threadResult.resolvedThreadIds,
      relationship_deltas: writeBackResult.relationshipDeltas.map((d) => ({
        trust: d.trust,
        resentment: d.resentment,
        intimacy: d.intimacy,
        reason: d.reason,
      })),
    },
  });

  console.log(`====== [RUNTIME] Turn complete ======\n`);
}
