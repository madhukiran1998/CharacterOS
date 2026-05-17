import { Router, Request, Response } from 'express';
import { runRuntimeLoop } from './runtime';

const router = Router();

router.post('/chat', async (req: Request, res: Response) => {
  const { character_id, user_id, message } = req.body as {
    character_id?: string;
    user_id?: string;
    message?: string;
  };

  if (!character_id || !user_id || !message?.trim()) {
    res.status(400).json({ error: 'character_id, user_id, and message are required' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  try {
    await runRuntimeLoop(character_id, user_id, message.trim(), res);
  } catch (err) {
    console.error('[CHAT] Runtime error:', err);
    res.write(
      `data: ${JSON.stringify({
        type: 'token',
        token: 'Something has distracted me. Speak again.',
      })}\n\n`
    );
    res.write(`data: ${JSON.stringify({ type: 'done', reasoning: null, relationship_state: null })}\n\n`);
  } finally {
    res.end();
  }
});

export default router;
