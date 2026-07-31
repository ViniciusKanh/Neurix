import { queryAll, queryOne, run } from './db.js';
import {
  json, newId, nowISO, hashPassword, verifyPassword, signToken,
  newTotpSecret, totpUri, verifyTotp, totpQrDataUrl,
} from './util.js';
import { currentUserRow, serializeUser } from './auth.js';

const bad = (res, status, message) => json(res, status, { error: message });

// =====================================================================
// AUTH  ->  /api/auth/*
// =====================================================================
export async function authHandler(req, res, ctx) {
  const { segments, method, body } = ctx;
  const seg0 = segments[0];

  // GET /api/auth/health -> checks Turso connectivity (public)
  if (seg0 === 'health' && method === 'GET') {
    try {
      await queryOne('SELECT 1 AS ok');
      return json(res, 200, { ok: true, db: 'connected' });
    } catch (e) {
      return json(res, 200, { ok: false, db: 'error', error: e.message });
    }
  }

  // POST /api/auth/login  { email, password }
  if (seg0 === 'login' && method === 'POST') {
    const email = (body.email || '').trim().toLowerCase();
    const row = await queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!row || !row.is_active) return bad(res, 401, 'Credenciais inválidas');
    const ok = await verifyPassword(body.password || '', row.password_hash);
    if (!ok) return bad(res, 401, 'Credenciais inválidas');

    if (row.totp_enabled) {
      const challenge = signToken({ sub: row.id, purpose: '2fa' }, '10m');
      return json(res, 200, { requires_2fa: true, challenge });
    }
    const token = signToken({ sub: row.id });
    return json(res, 200, { token, user: serializeUser(row) });
  }

  // POST /api/auth/verify-2fa  { challenge, code }
  if (seg0 === 'verify-2fa' && method === 'POST') {
    const { verifyToken } = await import('./util.js');
    const payload = verifyToken(body.challenge);
    if (!payload || payload.purpose !== '2fa') return bad(res, 401, 'Desafio inválido ou expirado');
    const row = await queryOne('SELECT * FROM users WHERE id = ?', [payload.sub]);
    if (!row) return bad(res, 401, 'Usuário não encontrado');
    if (!verifyTotp(row.totp_secret, body.code)) return bad(res, 401, 'Código 2FA inválido');
    const token = signToken({ sub: row.id });
    return json(res, 200, { token, user: serializeUser(row) });
  }

  // Everything below requires a logged-in user
  const me = await currentUserRow(req);
  if (!me) return bad(res, 401, 'Não autenticado');

  // GET /api/auth/me
  if (seg0 === 'me' && method === 'GET') {
    return json(res, 200, serializeUser(me));
  }

  // POST /api/auth/profile  { full_name, avatar_url }
  if (seg0 === 'profile' && (method === 'POST' || method === 'PUT')) {
    const full_name = body.full_name ?? me.full_name;
    const avatar_url = body.avatar_url ?? me.avatar_url;
    await run('UPDATE users SET full_name = ?, avatar_url = ?, updated_date = ? WHERE id = ?',
      [full_name, avatar_url, nowISO(), me.id]);
    const row = await queryOne('SELECT * FROM users WHERE id = ?', [me.id]);
    return json(res, 200, serializeUser(row));
  }

  // POST /api/auth/change-password  { current, next }
  if (seg0 === 'change-password' && method === 'POST') {
    const ok = await verifyPassword(body.current || '', me.password_hash);
    if (!ok) return bad(res, 400, 'Senha atual incorreta');
    if (!body.next || body.next.length < 6) return bad(res, 400, 'Nova senha muito curta (mín. 6)');
    await run('UPDATE users SET password_hash = ?, updated_date = ? WHERE id = ?',
      [await hashPassword(body.next), nowISO(), me.id]);
    return json(res, 200, { ok: true });
  }

  // 2FA sub-routes  /api/auth/2fa/*
  if (seg0 === '2fa') {
    const action = segments[1];

    // POST /api/auth/2fa/setup  -> generates a (pending) secret + QR
    if (action === 'setup' && method === 'POST') {
      const secret = newTotpSecret();
      await run('UPDATE users SET totp_secret = ?, updated_date = ? WHERE id = ?',
        [secret, nowISO(), me.id]);
      const uri = totpUri(me.email, secret);
      const qr = await totpQrDataUrl(uri);
      return json(res, 200, { secret, otpauth_url: uri, qr });
    }

    // POST /api/auth/2fa/enable  { code }
    if (action === 'enable' && method === 'POST') {
      if (!verifyTotp(me.totp_secret, body.code)) return bad(res, 400, 'Código inválido');
      await run('UPDATE users SET totp_enabled = 1, updated_date = ? WHERE id = ?', [nowISO(), me.id]);
      return json(res, 200, { ok: true, totp_enabled: true });
    }

    // POST /api/auth/2fa/disable  { code }
    if (action === 'disable' && method === 'POST') {
      if (!verifyTotp(me.totp_secret, body.code)) return bad(res, 400, 'Código inválido');
      await run('UPDATE users SET totp_enabled = 0, totp_secret = NULL, updated_date = ? WHERE id = ?',
        [nowISO(), me.id]);
      return json(res, 200, { ok: true, totp_enabled: false });
    }
  }

  return bad(res, 404, 'Rota de auth não encontrada');
}

// =====================================================================
// ENTITIES  ->  /api/entities/:type[/:id | /filter]
// Generic JSON record store backed by the `records` table.
// =====================================================================
function rowToEntity(row) {
  let data = {};
  try { data = JSON.parse(row.data || '{}'); } catch { data = {}; }
  return {
    id: row.id,
    created_date: row.created_date,
    updated_date: row.updated_date,
    created_by_id: row.created_by_id,
    ...data,
  };
}

function applySortLimit(list, sort, limit) {
  if (sort) {
    const desc = sort.startsWith('-');
    const field = desc ? sort.slice(1) : sort;
    list = [...list].sort((a, b) => {
      const av = a[field], bv = b[field];
      if (av === bv) return 0;
      if (av === undefined || av === null) return 1;
      if (bv === undefined || bv === null) return -1;
      return (av > bv ? 1 : -1) * (desc ? -1 : 1);
    });
  }
  if (limit) list = list.slice(0, Number(limit));
  return list;
}

function matchesQuery(entity, query) {
  return Object.entries(query || {}).every(([k, v]) => entity[k] === v);
}

export async function entitiesHandler(req, res, ctx) {
  const me = await currentUserRow(req);
  if (!me) return bad(res, 401, 'Não autenticado');

  const { segments, method, body, query } = ctx;
  const type = segments[0];
  const second = segments[1];
  if (!type) return bad(res, 400, 'Tipo de entidade ausente');

  // POST /api/entities/:type/filter  { query, sort, limit }
  if (second === 'filter' && method === 'POST') {
    const rows = await queryAll('SELECT * FROM records WHERE entity_type = ?', [type]);
    let list = rows.map(rowToEntity).filter((e) => matchesQuery(e, body.query || {}));
    list = applySortLimit(list, body.sort, body.limit);
    return json(res, 200, list);
  }

  // Collection routes  /api/entities/:type
  if (!second) {
    if (method === 'GET') {
      const rows = await queryAll('SELECT * FROM records WHERE entity_type = ?', [type]);
      let list = rows.map(rowToEntity);
      list = applySortLimit(list, query.sort, query.limit);
      return json(res, 200, list);
    }
    if (method === 'POST') {
      // Supports single object or array (bulkCreate)
      const items = Array.isArray(body) ? body : [body];
      const created = [];
      for (const item of items) {
        const id = newId();
        const ts = nowISO();
        await run(
          'INSERT INTO records (id, entity_type, data, created_by_id, created_date, updated_date) VALUES (?,?,?,?,?,?)',
          [id, type, JSON.stringify(item || {}), me.id, ts, ts]
        );
        created.push({ id, created_date: ts, updated_date: ts, created_by_id: me.id, ...item });
      }
      return json(res, 201, Array.isArray(body) ? created : created[0]);
    }
  }

  // Item routes  /api/entities/:type/:id
  if (second) {
    const id = second;
    const existing = await queryOne('SELECT * FROM records WHERE id = ? AND entity_type = ?', [id, type]);
    if (method === 'GET') {
      if (!existing) return bad(res, 404, 'Registro não encontrado');
      return json(res, 200, rowToEntity(existing));
    }
    if (method === 'PUT' || method === 'PATCH') {
      if (!existing) return bad(res, 404, 'Registro não encontrado');
      const current = rowToEntity(existing);
      const { id: _i, created_date, updated_date, created_by_id, ...currentData } = current;
      const merged = { ...currentData, ...body };
      const ts = nowISO();
      await run('UPDATE records SET data = ?, updated_date = ? WHERE id = ?',
        [JSON.stringify(merged), ts, id]);
      return json(res, 200, { id, created_date, updated_date: ts, created_by_id, ...merged });
    }
    if (method === 'DELETE') {
      await run('DELETE FROM records WHERE id = ? AND entity_type = ?', [id, type]);
      return json(res, 200, { ok: true });
    }
  }

  return bad(res, 404, 'Rota de entidade não encontrada');
}

// =====================================================================
// USERS  ->  /api/users/*   (admin only)
// =====================================================================
export async function usersHandler(req, res, ctx) {
  const me = await currentUserRow(req);
  if (!me) return bad(res, 401, 'Não autenticado');
  if (me.role !== 'admin') return bad(res, 403, 'Apenas administradores');

  const { segments, method, body } = ctx;
  const id = segments[0];
  const sub = segments[1];

  if (!id) {
    if (method === 'GET') {
      const rows = await queryAll('SELECT * FROM users ORDER BY created_date ASC');
      return json(res, 200, rows.map(serializeUser));
    }
    if (method === 'POST') {
      const email = (body.email || '').trim().toLowerCase();
      if (!email) return bad(res, 400, 'E-mail obrigatório');
      const exists = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
      if (exists) return bad(res, 409, 'E-mail já cadastrado');
      const uid = newId();
      const ts = nowISO();
      await run(
        `INSERT INTO users (id, email, full_name, password_hash, role, permissions, is_active, created_date, updated_date)
         VALUES (?,?,?,?,?,?,1,?,?)`,
        [uid, email, body.full_name || '', await hashPassword(body.password || '123456'),
         body.role === 'admin' ? 'admin' : 'user', JSON.stringify(body.permissions || []), ts, ts]
      );
      const row = await queryOne('SELECT * FROM users WHERE id = ?', [uid]);
      return json(res, 201, serializeUser(row));
    }
  }

  if (id) {
    const target = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
    if (!target) return bad(res, 404, 'Usuário não encontrado');

    // POST /api/users/:id/reset-password  { password }
    if (sub === 'reset-password' && method === 'POST') {
      await run('UPDATE users SET password_hash = ?, updated_date = ? WHERE id = ?',
        [await hashPassword(body.password || '123456'), nowISO(), id]);
      return json(res, 200, { ok: true });
    }

    if (method === 'PUT' || method === 'PATCH') {
      const full_name = body.full_name ?? target.full_name;
      const role = body.role ? (body.role === 'admin' ? 'admin' : 'user') : target.role;
      const permissions = body.permissions ? JSON.stringify(body.permissions) : target.permissions;
      const is_active = body.is_active === undefined ? target.is_active : (body.is_active ? 1 : 0);
      await run('UPDATE users SET full_name = ?, role = ?, permissions = ?, is_active = ?, updated_date = ? WHERE id = ?',
        [full_name, role, permissions, is_active, nowISO(), id]);
      const row = await queryOne('SELECT * FROM users WHERE id = ?', [id]);
      return json(res, 200, serializeUser(row));
    }

    if (method === 'DELETE') {
      if (id === me.id) return bad(res, 400, 'Você não pode excluir a si mesmo');
      await run('DELETE FROM users WHERE id = ?', [id]);
      return json(res, 200, { ok: true });
    }
  }

  return bad(res, 404, 'Rota de usuários não encontrada');
}

// =====================================================================
// FILES  ->  /api/files/*
// =====================================================================
export async function filesHandler(req, res, ctx) {
  const { segments, method, body } = ctx;

  // GET /api/files/:id  -> serve raw content (public read; ids are UUIDs)
  if (segments[0] && method === 'GET') {
    const row = await queryOne('SELECT * FROM files WHERE id = ?', [segments[0]]);
    if (!row) return bad(res, 404, 'Arquivo não encontrado');
    res.statusCode = 200;
    res.setHeader('Content-Type', row.mime || 'application/octet-stream');
    if (row.encoding === 'base64') {
      res.end(Buffer.from(row.content, 'base64'));
    } else {
      res.end(row.content);
    }
    return;
  }

  // POST /api/files  { filename, mime, content, encoding }  (auth required)
  if (!segments[0] && method === 'POST') {
    const me = await currentUserRow(req);
    if (!me) return bad(res, 401, 'Não autenticado');
    const id = newId();
    const encoding = body.encoding === 'base64' ? 'base64' : 'utf8';
    const size = encoding === 'base64'
      ? Buffer.from(body.content || '', 'base64').length
      : Buffer.byteLength(body.content || '', 'utf8');
    await run(
      'INSERT INTO files (id, filename, mime, size, content, encoding, created_by_id, created_date) VALUES (?,?,?,?,?,?,?,?)',
      [id, body.filename || 'file', body.mime || 'application/octet-stream', size,
       body.content || '', encoding, me.id, nowISO()]
    );
    return json(res, 201, { id, file_url: `/api/files/${id}`, filename: body.filename, size });
  }

  return bad(res, 404, 'Rota de arquivos não encontrada');
}
