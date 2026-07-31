import { entitiesHandler } from '../_lib/handlers.js';
import { makeCtx } from '../_lib/adapter.js';

export default async function handler(req, res) {
  try {
    await entitiesHandler(req, res, makeCtx(req, 'entities'));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: e.message }));
  }
}
