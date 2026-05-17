import { Response } from 'express';
import { db } from '../db/client';
import { CharacterSpec } from '../phase1-compiler/compiler';
import { retrieveMemory } from './memory';
import { readAndUpdateRelationship } from './relationship';
import { runHiddenReasoning } from './reasoning';
import { streamResponse } from './respond';
import { writeEpisodes } from './writeBack';

function sendEvent(res: Response, event: object) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export async function runRuntimeLoop(
  characterId: string,
  userId: string,
  userMessage: string,
  res: Response
): Promise<void> {
  // Load character spec
  const charResult = await db.query(
    `SELECT spec FROM characters WHERE id = $1`,
    [characterId]
  );
  if (charResult.rows.length === 0) throw new Error(`Character ${characterId} not found`);
  const spec = charResult.rows[0].spec as CharacterSpec;

  console.log(`\n====== [RUNTIME] Turn start — character: ${spec.identity.name} | user: ${userId} ======`);

  // Step 1 — Memory
  sendEvent(res, { type: 'step', step: 1, label: 'Retrieving memories...' });
  const episodes = await retrieveMemory(characterId, userId, userMessage);

  // Step 2 — Relationship
  sendEvent(res, { type: 'step', step: 2, label: 'Reading relationship state...' });
  const relationship = await readAndUpdateRelationship(characterId, userId, userMessage);

  // Step 3 — Hidden reasoning
  sendEvent(res, { type: 'step', step: 3, label: 'Thinking...' });
  const reasoning = await runHiddenReasoning(spec, episodes, relationship, userMessage);

  // Step 4 — Stream response
  sendEvent(res, { type: 'step', step: 4, label: 'Responding...' });
  const reply = await streamResponse(spec, episodes, relationship, reasoning, userMessage, res);

  // Step 5 — Write back
  sendEvent(res, { type: 'step', step: 5, label: 'Saving...' });
  await writeEpisodes(characterId, userId, userMessage, reply);

  // Done — send final state for debug panel
  sendEvent(res, {
    type: 'done',
    reasoning,
    relationship_state: relationship,
  });

  console.log(`====== [RUNTIME] Turn complete ======\n`);
}
