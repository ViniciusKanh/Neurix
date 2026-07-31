import { filesHandler } from './_lib/handlers.js';
import { makeCtx } from './_lib/adapter.js';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

export default async function handler(req, res) {
  try {
    await filesHandler(req, res, makeCtx(req, 'files'));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message }));
  }
}
