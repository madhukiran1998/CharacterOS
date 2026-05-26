import { db } from './client';

async function run() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id           SERIAL PRIMARY KEY,
      privy_id     TEXT NOT NULL UNIQUE,
      wallet       TEXT,
      email        TEXT,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  console.log('[migrate-waitlist] done');
  await db.end();
}

run().catch(err => { console.error(err); process.exit(1); });
