import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

async function migrateV3() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const sql = fs.readFileSync(path.join(__dirname, 'migrate-v3.sql'), 'utf8');
  try {
    await pool.query(sql);
    console.log('V3 migration complete — Plutchik emotion system, appraisal pipeline, relationship depth.');
  } finally {
    await pool.end();
  }
}

migrateV3().catch((err) => {
  console.error('V3 migration failed:', err);
  process.exit(1);
});
