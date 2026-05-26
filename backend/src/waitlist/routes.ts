import { Router } from 'express';
import { db } from '../db/client';

const router = Router();

router.post('/waitlist', async (req, res) => {
  const { privyId, wallet, email } = req.body;
  if (!privyId || typeof privyId !== 'string') {
    res.status(400).json({ error: 'privyId required' });
    return;
  }

  try {
    await db.query(
      `INSERT INTO waitlist (privy_id, wallet, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (privy_id) DO NOTHING`,
      [privyId, wallet?.toLowerCase() ?? null, email?.toLowerCase() ?? null]
    );
    const { rows } = await db.query(`SELECT COUNT(*) AS count FROM waitlist`);
    res.json({ ok: true, position: Number(rows[0].count) });
  } catch (err) {
    console.error('[waitlist] error:', err);
    res.status(500).json({ error: 'internal error' });
  }
});

router.get('/waitlist/count', async (_req, res) => {
  const { rows } = await db.query(`SELECT COUNT(*) AS count FROM waitlist`);
  res.json({ count: Number(rows[0].count) });
});

export default router;
