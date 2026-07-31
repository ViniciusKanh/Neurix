import { settingsHandler } from '../_lib/handlers.js';
import { makeCtx } from '../_lib/adapter.js';

export default async function handler(req, res) {
  try {
    await settingsHandler(req, res, makeCtx(req, 'settings'));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message }));
  }
}
