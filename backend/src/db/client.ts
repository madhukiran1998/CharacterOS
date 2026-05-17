import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '../../.env' });

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
});
