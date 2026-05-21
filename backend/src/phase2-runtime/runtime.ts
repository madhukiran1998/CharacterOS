import { Response } from 'express';
import { db } from '../db/client';
import { CharacterSpec } from '../phase1-compiler/compiler';
import { retrieveMemory } from './memory';
import { readAndUpdateRelationship, applySessionDecay as applyRelationshipSessionDecay, applyAppraisalToRelationship } from './relationship';
import { loadEmotionState, saveEmotionState, applyEmotionMath } from './emotionState';
import { loadOpenThreads } from './narrativeThreads';
import { buildShallowReasoning, buildDeepReasoning } from './reasoning';
import { streamResponse, streamTrivialResponse } from './respond';
import { writeEpisodes } from './writeBack';
import { runAppraisalAndDesire } from './appraisal';
import { computePAD, deriveEmotionalState, checkRegenerationTrigger } from '../constants/emotions';

function sendEvent(res: Response, event: object) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

const TRIVIAL_REGEX = /^(hi|hello|hey|sup|yo|how are you|what's up|gm|good morning|good evening)[\s!?.]*$/i;

export async function runRuntimeLoop(
  characterId: string,
  userId: string,
  userMessage: string,
  res: Response,
): Promise<void> {
  const charResult = await db.query(
    `SELECT spec FROM characters WHERE id = $1`,
    [characterId],
  );
  if (charResult.rows.length === 0) throw new Error(`Character ${characterId} not found`);
  const spec = charResult.rows[0].spec as CharacterSpec;

  console.log(`\n====== [RUNTIME] Turn start — character: ${spec.identity.name} | user: ${userId} ======`);

  // ── Fast path: trivial inputs (greetings) ──
  const isTrivial = TRIVIAL_REGEX.test(userMessage.trim());
  if (isTrivial) {
    console.log(`[RUNTIME] Trivial input — fast path`);
    sendEvent(res, { type: 'step', step: 1, label: 'Fast path (trivial input)...' });

    const { state: emotionBefore, pad: padBefore, derived: derivedBefore, wasNewSession, hoursSince } =
      await loadEmotionState(characterId, userId);

    if (wasNewSession) {
      await applyRelationshipSessionDecay(characterId, userId, hoursSince);
    }

    const reply = await streamTrivialResponse(spec, userMessage, res);
    await writeEpisodes(characterId, userId, userMessage, reply, emotionBefore, []);

    sendEvent(res, {
      type: 'done',
      appraisal: {
        relevance: 0.1, valence: 0, coping: 0.5, norm_violation: 0,
        emotional_delta: { joy: 0, trust: 0, fear: 0, surprise: 0, sadness: 0, disgust: 0, anger: 0, anticipation: 0, desire_intensity: 0 },
        appraisal_summary: 'Trivial input — fast path',
      },
      emotion_before: {
        plutchik: plutchikFields(emotionBefore),
        desire_intensity: emotionBefore.desire_intensity,
        derived_state: derivedBefore.derived_state,
        pad: padBefore,
      },
      emotion_after: {
        plutchik: plutchikFields(emotionBefore),
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
      reasoning: { user_read: 'casual interaction', emotional_state_summary: derivedBefore.derived_state, intended_move: 'respond naturally', forbidden_moves: [] },
      relationship_state: { trust: 0.5, familiarity: 0.1, resentment: 0, intimacy: 0, trust_source: 'default' },
      session: { was_new_session: wasNewSession, hours_since_last: hoursSince, session_decay_applied: wasNewSession ? Math.pow(0.85, hoursSince / 24) : 1.0 },
      open_threads: [],
    });

    console.log(`====== [RUNTIME] Turn complete (fast path) ======\n`);
    return;
  }

  // ── Step 1: Parallel DB/embedding work ──
  sendEvent(res, { type: 'step', step: 1, label: 'Loading context...' });

  const [episodes, relationship, emotionLoad, baselinesResult] = await Promise.all([
    retrieveMemory(characterId, userId, userMessage),
    readAndUpdateRelationship(characterId, userId, userMessage),
    loadEmotionState(characterId, userId),
    db.query(`SELECT * FROM character_baselines WHERE character_id = $1`, [characterId]),
  ]);

  const { state: emotionBefore, pad: padBefore, derived: derivedBefore, wasNewSession, hoursSince } = emotionLoad;

  if (wasNewSession) {
    await applyRelationshipSessionDecay(characterId, userId, hoursSince);
  }

  if (baselinesResult.rows.length === 0) throw new Error(`No baselines for character ${characterId}`);
  const baseline = baselinesResult.rows[0];

  // ── Step 2: Single pre-response LLM call (appraisal + desire merged) ──
  sendEvent(res, { type: 'step', step: 2, label: 'Appraising...' });

  const { appraisal, desire: desireResult } = await runAppraisalAndDesire(
    spec, emotionBefore, padBefore, derivedBefore.derived_state, relationship, episodes, userMessage,
  );

  // ── Step 3: Emotion math (pure code, instant) ──
  sendEvent(res, { type: 'step', step: 3, label: 'Computing emotions...' });

  const emotionAfterMath = applyEmotionMath(emotionBefore, baseline, appraisal.emotional_delta);
  const padAfter = computePAD(emotionAfterMath);
  const derivedAfter = deriveEmotionalState(emotionAfterMath, padAfter);

  const momentum = (() => {
    const prev = sumEmotions(emotionBefore);
    const next = sumEmotions(emotionAfterMath);
    if (next > prev + 0.15) return 'rising';
    if (next < prev - 0.15) return 'falling';
    return 'stable';
  })();

  const forceDeep = checkRegenerationTrigger(padBefore, padAfter, emotionBefore.desire_intensity, emotionAfterMath.desire_intensity);

  // Depth decision (pure logic, no LLM)
  const depth: 'shallow' | 'moderate' | 'deep' =
    forceDeep || appraisal.relevance > 0.6 ? 'deep' :
    appraisal.relevance > 0.3 ? 'moderate' : 'shallow';

  console.log(`[RUNTIME] Depth: ${depth} (relevance: ${appraisal.relevance.toFixed(2)}, forceDeep: ${forceDeep})`);

  const reasoning =
    depth === 'shallow'
      ? buildShallowReasoning(desireResult.desire, desireResult.desire_strength, derivedAfter.derived_state)
      : buildDeepReasoning(desireResult.desire, desireResult.desire_strength, derivedAfter.derived_state, depth);

  // Load open threads (fast DB query, do it here)
  const openThreads = await loadOpenThreads(characterId, userId);

  // Pipe appraisal trust/anger/disgust/joy into relationship state (fire-and-forget)
  applyAppraisalToRelationship(characterId, userId, {
    trust: appraisal.emotional_delta.trust,
    anger: appraisal.emotional_delta.anger,
    disgust: appraisal.emotional_delta.disgust,
    joy: appraisal.emotional_delta.joy,
  }).catch((err) => console.error('[RELATIONSHIP] Appraisal nudge failed (non-fatal):', err));

  // Save emotion state
  await saveEmotionState(
    characterId, userId, emotionAfterMath, derivedAfter, momentum,
    reasoning.desire, reasoning.objective,
  );

  // ── Step 4: Stream response (objective reasoning now inline) ──
  sendEvent(res, { type: 'step', step: 4, label: 'Responding...' });

  const reply = await streamResponse(
    spec, episodes, relationship, reasoning, emotionAfterMath, padAfter, derivedAfter, userMessage, res,
  );

  // ── Step 5: Write back + thread detection (async) ──
  sendEvent(res, { type: 'step', step: 5, label: 'Saving...' });

  const writeBackResult = await writeEpisodes(characterId, userId, userMessage, reply, emotionAfterMath, openThreads);

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
      plutchik: plutchikFields(emotionBefore),
      desire_intensity: emotionBefore.desire_intensity,
      derived_state: derivedBefore.derived_state,
      pad: padBefore,
    },
    emotion_after: {
      plutchik: plutchikFields(emotionAfterMath),
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
    open_threads: [
      ...openThreads.filter(t => !writeBackResult.threadResult.resolvedThreadIds.includes(t.id)),
      ...writeBackResult.threadResult.newThreads,
    ],
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

function plutchikFields(e: { joy: number; trust: number; fear: number; surprise: number; sadness: number; disgust: number; anger: number; anticipation: number }) {
  return { joy: e.joy, trust: e.trust, fear: e.fear, surprise: e.surprise, sadness: e.sadness, disgust: e.disgust, anger: e.anger, anticipation: e.anticipation };
}

function sumEmotions(e: { joy: number; trust: number; fear: number; surprise: number; sadness: number; disgust: number; anger: number; anticipation: number }): number {
  return e.joy + e.trust + e.fear + e.surprise + e.sadness + e.disgust + e.anger + e.anticipation;
}
