// Local development API server.
// Runs the SAME handlers that power the Vercel serverless functions, so local
// dev behaves identically to production. Started via `npm run dev:api`.
import { config } from 'dotenv';
config();

import express from 'express';
import {
  authHandler, entitiesHandler, usersHandler, filesHandler, settingsHandler,
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

app.all('/api/auth/*', wrap(authHandler, 'auth'));
app.all('/api/entities/*', wrap(entitiesHandler, 'entities'));
app.all('/api/users', wrap(usersHandler, 'users'));
app.all('/api/users/*', wrap(usersHandler, 'users'));
app.all('/api/settings', wrap(settingsHandler, 'settings'));
app.all('/api/settings/*', wrap(settingsHandler, 'settings'));
app.all('/api/files', wrap(filesHandler, 'files'));
app.all('/api/files/*', wrap(filesHandler, 'files'));

const port = process.env.API_PORT || 3001;
app.listen(port, () => console.log(`\n  ⚡ Neurix API (dev) → http://localhost:${port}\n`));
