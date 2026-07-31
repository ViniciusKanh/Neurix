import { queryOne } from './db.js';
import { getBearer, verifyToken } from './util.js';

export function serializeUser(row) {
  if (!row) return null;
  let permissions = [];
  try { permissions = JSON.parse(row.permissions || '[]'); } catch { permissions = []; }
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    avatar_url: row.avatar_url,
    permissions,
    totp_enabled: !!row.totp_enabled,
    is_active: !!row.is_active,
    created_date: row.created_date,
    updated_date: row.updated_date,
  };
}

// Resolves the authenticated user from the Bearer token. Returns the raw DB row.
export async function currentUserRow(req) {
  const token = getBearer(req);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload || payload.purpose === '2fa') return null;
  const row = await queryOne('SELECT * FROM users WHERE id = ?', [payload.sub]);
  if (!row || !row.is_active) return null;
  return row;
}
