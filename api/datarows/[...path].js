import { datarowsHandler } from '../_lib/handlers.js';
import { makeCtx } from '../_lib/adapter.js';

export const config = { api: { bodyParser: { sizeLimit: '6mb' } } };

export default async function handler(req, res) {
  try {
    await datarowsHandler(req, res, makeCtx(req, 'datarows'));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message, code: 'DB_ERROR' }));
  }
}
