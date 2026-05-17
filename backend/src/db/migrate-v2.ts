import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function migrateV2() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, 'migrate-v2.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('V2 migration complete — emotion_state and narrative_threads tables created.');
  } finally {
    await pool.end();
  }
}

migrateV2().catch((err) => {
  console.error('V2 migration failed:', err);
  process.exit(1);
});
