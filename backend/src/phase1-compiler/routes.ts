import { Router, Request, Response } from 'express';
import { db } from '../db/client';
import { compileCharacter } from './compiler';

const router = Router();

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
    console.log(`\n[COMPILE] Done — character_id: ${character_id}`);

    res.json({ character_id, spec });
  } catch (err) {
    console.error('[COMPILE] Error:', err);
    res.status(500).json({ error: 'Compilation failed', details: String(err) });
  }
});

export default router;
