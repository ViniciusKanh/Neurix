// Local development API server.
// Runs the SAME handlers that power the Vercel serverless functions, so local
// dev behaves identically to production. Started via `npm run dev:api`.
import { config } from 'dotenv';
config();

import express from 'express';
import {
  authHandler, entitiesHandler, usersHandler, filesHandler, settingsHandler, datarowsHandler,
} from './api/_lib/handlers.js';
import { makeCtx } from './api/_lib/adapter.js';

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.text({ limit: '25mb', type: ['text/*'] }));

const wrap = (h, base) => async (req, res) => {
  try {
    await h(req, res, makeCtx(req, base));
  } catch (e) {
    console.error(e);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
};

// The client hits fixed base paths with a `path` query param (Vercel-safe),
// but we also keep the /* variants for any direct calls.
const mount = (name, h) => { app.all(`/api/${name}`, wrap(h, name)); app.all(`/api/${name}/*`, wrap(h, name)); };
mount('auth', authHandler);
mount('entities', entitiesHandler);
mount('users', usersHandler);
mount('settings', settingsHandler);
mount('datarows', datarowsHandler);
mount('files', filesHandler);

const port = process.env.API_PORT || 3001;
app.listen(port, () => console.log(`\n  ⚡ Neurix API (dev) → http://localhost:${port}\n`));
