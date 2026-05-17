import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import compilerRoutes from './phase1-compiler/routes';
import runtimeRoutes from './phase2-runtime/routes';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', compilerRoutes);
app.use('/api', runtimeRoutes);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`CharacterOS backend running on http://localhost:${PORT}`);
});
