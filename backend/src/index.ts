import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

import { db } from './db/client';
import { extractBaselines } from './phase1-compiler/compiler';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import compilerRoutes from './phase1-compiler/routes';
import runtimeRoutes from './phase2-runtime/routes';
import waitlistRoutes from './waitlist/routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', compilerRoutes);
app.use('/api', runtimeRoutes);
app.use('/api', waitlistRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

async function backfillMissingBaselines() {
  try {
    const result = await db.query(
      `SELECT c.id, c.spec 
       FROM characters c
       LEFT JOIN character_baselines cb ON c.id = cb.character_id
       WHERE cb.id IS NULL`
    );

    if (result.rows.length === 0) {
      console.log('[BACKFILL] No characters need baselines. All good.');
      return;
    }

    console.log(`[BACKFILL] Found ${result.rows.length} characters missing baselines. Backfilling...`);

    for (const row of result.rows) {
      const spec = row.spec;
      console.log(`[BACKFILL] Processing character ${row.id.slice(0, 8)}... (${spec.identity.name})`);

      try {
        const baselines = await extractBaselines(spec);

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
            row.id,
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

        await db.query(
          `UPDATE characters SET volatility = $1, recovery_rate = $2 WHERE id = $3`,
          [baselines.volatility, baselines.recovery_rate, row.id]
        );

        console.log(`[BACKFILL] Done for ${spec.identity.name}`);
      } catch (err) {
        console.error(`[BACKFILL] Failed for character ${row.id}:`, err);
        // Continue with next character, don't crash
      }
    }

    console.log(`[BACKFILL] Complete. Backfilled ${result.rows.length} characters.`);
  } catch (err) {
    console.error('[BACKFILL] Error during backfill:', err);
  }
}

backfillMissingBaselines().then(() => {
  app.listen(PORT, () => {
    console.log(`CharacterOS backend running on http://localhost:${PORT}`);
  });
});
