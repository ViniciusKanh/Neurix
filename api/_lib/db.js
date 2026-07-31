import { createClient } from '@libsql/client';

let _client = null;

export function db() {
  if (_client) return _client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL não configurada no ambiente');
  _client = createClient({ url, authToken });
  return _client;
}

// Convenience helpers -------------------------------------------------------

export async function queryAll(sql, args = []) {
  const rs = await db().execute({ sql, args });
  return rs.rows;
}

export async function queryOne(sql, args = []) {
  const rows = await queryAll(sql, args);
  return rows[0] || null;
}

export async function run(sql, args = []) {
  return db().execute({ sql, args });
}
