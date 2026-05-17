import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { compileCharacter, extractBaselines } from './compiler';

const router = Router();

router.get('/characters', async (_req: Request, res: Response) => {
  try {
    const result = await db.query(
      `SELECT id, created_at, spec->'identity' AS identity
       FROM characters
       ORDER BY created_at DESC`
    );
    res.json({ characters: result.rows });
  } catch (err) {
    console.error('[CHARACTERS] Error:', err);
    res.status(500).json({ error: 'Failed to fetch characters' });
  }
});

router.post('/compile', async (req: Request, res: Response) => {
  const { description, created_by } = req.body as { description?: string; created_by?: string };

  if (!description || description.trim().length === 0) {
    res.status(400).json({ error: 'description is required' });
    return;
  }

  try {
    console.log(`\n[COMPILE] Starting pipeline for: "${description.slice(0, 80)}..."`);
    const spec = await compileCharacter(description.trim());

    const result = await db.query(
      `INSERT INTO characters (created_by, description, spec)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [created_by || 'anonymous', description.trim(), JSON.stringify(spec)]
    );

    const character_id = result.rows[0].id;
    console.log(`\n[COMPILE] Steps 1-3 done — character_id: ${character_id}`);

    // Step 4 — Extract emotional baselines
    console.log(`[COMPILE] Running Step 4: Emotional Baselines...`);
    const baselines = await extractBaselines(spec);
    console.log(`[COMPILE] Baselines extracted — volatility: ${baselines.volatility}, recovery_rate: ${baselines.recovery_rate}`);

    // Store baselines
        await db.query(
          `INSERT INTO character_baselines (
            character_id, joy, trust, fear, surprise, sadness, disgust, anger, anticipation,
            desire_intensity, desire_nature, volatility, recovery_rate,
            joy_decay_override, trust_decay_override, fear_decay_override, surprise_decay_override,
            sadness_decay_override, disgust_decay_override, anger_decay_override, anticipation_decay_override,
            desire_decay_override
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
          ON CONFLICT (character_id) DO UPDATE SET
            joy = EXCLUDED.joy,
            trust = EXCLUDED.trust,
            fear = EXCLUDED.fear,
            surprise = EXCLUDED.surprise,
            sadness = EXCLUDED.sadness,
            disgust = EXCLUDED.disgust,
            anger = EXCLUDED.anger,
            anticipation = EXCLUDED.anticipation,
            desire_intensity = EXCLUDED.desire_intensity,
            desire_nature = EXCLUDED.desire_nature,
            volatility = EXCLUDED.volatility,
            recovery_rate = EXCLUDED.recovery_rate,
            joy_decay_override = EXCLUDED.joy_decay_override,
            trust_decay_override = EXCLUDED.trust_decay_override,
            fear_decay_override = EXCLUDED.fear_decay_override,
            surprise_decay_override = EXCLUDED.surprise_decay_override,
            sadness_decay_override = EXCLUDED.sadness_decay_override,
            disgust_decay_override = EXCLUDED.disgust_decay_override,
            anger_decay_override = EXCLUDED.anger_decay_override,
            anticipation_decay_override = EXCLUDED.anticipation_decay_override,
            desire_decay_override = EXCLUDED.desire_decay_override`,
          [
            character_id,
            baselines.joy,
            baselines.trust,
            baselines.fear,
            baselines.surprise,
            baselines.sadness,
            baselines.disgust,
            baselines.anger,
            baselines.anticipation,
            baselines.desire_intensity,
            baselines.desire_nature,
            baselines.volatility,
            baselines.recovery_rate,
            baselines.joy_decay_override,
            baselines.trust_decay_override,
            baselines.fear_decay_override,
            baselines.surprise_decay_override,
            baselines.sadness_decay_override,
            baselines.disgust_decay_override,
            baselines.anger_decay_override,
            baselines.anticipation_decay_override,
            baselines.desire_decay_override,
          ]
        );

    // Update characters table with volatility and recovery_rate
    await db.query(
      `UPDATE characters SET volatility = $1, recovery_rate = $2 WHERE id = $3`,
      [baselines.volatility, baselines.recovery_rate, character_id]
    );

    console.log(`\n[COMPILE] Done — character_id: ${character_id}`);

    res.json({ character_id, spec, baselines });
  } catch (err) {
    console.error('[COMPILE] Error:', err);
    res.status(500).json({ error: 'Compilation failed', details: String(err) });
  }
});

export default router;
