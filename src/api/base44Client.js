/**
 * Neurix API client (Turso-backed).
 *
 * This file replaces the old Base44 SDK but keeps the SAME shape
 * (`base44.entities.*`, `base44.auth.*`, `base44.integrations.Core.*`) so the
 * ~40 existing pages/components keep working without changes.
 *
 * All calls go to the local /api serverless functions (Vercel in production,
 * server.mjs in local dev), which talk to Turso.
 */

const TOKEN_KEY = 'neurix_token';

export const tokenStore = {
  get: () => (typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_KEY) : null),
  set: (t) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};

function authHeaders(extra = {}) {
  const h = { ...extra };
  const token = tokenStore.get();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: authHeaders(body != null ? { 'Content-Type': 'application/json' } : {}),
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function qs(params) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

// ---- Entities -------------------------------------------------------------
function makeEntity(name) {
  const base = `/entities/${name}`;
  return {
    list: (sort, limit) => api(`${base}${qs({ sort, limit })}`),
    filter: (query, sort, limit) => api(`${base}/filter`, { method: 'POST', body: { query, sort, limit } }),
    get: (id) => api(`${base}/${id}`),
    create: (data) => api(base, { method: 'POST', body: data }),
    update: (id, data) => api(`${base}/${id}`, { method: 'PUT', body: data }),
    delete: (id) => api(`${base}/${id}`, { method: 'DELETE' }),
    bulkCreate: (arr) => api(base, { method: 'POST', body: arr }),
  };
}

const entities = new Proxy({}, { get: (_t, name) => makeEntity(String(name)) });

// ---- Auth -----------------------------------------------------------------
const auth = {
  me: () => api('/auth/me'),
  login: (email, password) => api('/auth/login', { method: 'POST', body: { email, password } }),
  verify2FA: (challenge, code) => api('/auth/verify-2fa', { method: 'POST', body: { challenge, code } }),
  setup2FA: () => api('/auth/2fa/setup', { method: 'POST' }),
  enable2FA: (code) => api('/auth/2fa/enable', { method: 'POST', body: { code } }),
  disable2FA: (code) => api('/auth/2fa/disable', { method: 'POST', body: { code } }),
  changePassword: (current, next) => api('/auth/change-password', { method: 'POST', body: { current, next } }),
  updateProfile: (data) => api('/auth/profile', { method: 'POST', body: data }),
  logout: () => { tokenStore.clear(); },
  redirectToLogin: () => { tokenStore.clear(); if (typeof window !== 'undefined') window.location.assign('/'); },
};

// ---- User management (admin) ---------------------------------------------
export const usersApi = {
  list: () => api('/users'),
  create: (data) => api('/users', { method: 'POST', body: data }),
  update: (id, data) => api(`/users/${id}`, { method: 'PUT', body: data }),
  remove: (id) => api(`/users/${id}`, { method: 'DELETE' }),
  resetPassword: (id, password) => api(`/users/${id}/reset-password`, { method: 'POST', body: { password } }),
};

// ---- File helpers ---------------------------------------------------------
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      resolve(String(result).split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Fills an object matching the top-level properties of a JSON schema with
// neutral values — used so legacy InvokeLLM callers don't crash.
function neutralFromSchema(schema) {
  const notice = 'IA externa desativada — Neurix opera 100% local (ML sem LLM).';
  if (!schema || !schema.properties) return { disabled: true, message: notice };
  const out = {};
  for (const [key, def] of Object.entries(schema.properties)) {
    const t = def.type;
    if (t === 'array') out[key] = [];
    else if (t === 'number' || t === 'integer') out[key] = 0;
    else if (t === 'boolean') out[key] = false;
    else if (t === 'object') out[key] = {};
    else out[key] = notice;
  }
  out.disabled = true;
  return out;
}

// ---- Integrations.Core (compat) ------------------------------------------
const Core = {
  // Uploads a File to Turso; returns { file_url }.
  UploadFile: async ({ file }) => {
    const content = await fileToBase64(file);
    const r = await api('/files', {
      method: 'POST',
      body: {
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        content,
        encoding: 'base64',
      },
    });
    return { file_url: r.file_url };
  },

  // Best-effort local CSV/TSV extraction (no server AI). xlsx is not supported
  // here — NewProject already parses CSV client-side before calling this.
  ExtractDataFromUploadedFile: async ({ file_url }) => {
    try {
      const res = await fetch(file_url, { headers: authHeaders() });
      const blob = await res.blob();
      const name = file_url.split('/').pop() || 'dataset.csv';
      const file = new File([blob], name, { type: blob.type || 'text/csv' });
      const { parseAnyFile } = await import('@/lib/parseDataset');
      const parsed = await parseAnyFile(file);
      return { status: 'success', output: parsed };
    } catch (e) {
      return { status: 'error', error: e.message };
    }
  },

  // No external LLM. Returns a safe neutral payload so legacy callers survive.
  InvokeLLM: async (opts = {}) => neutralFromSchema(opts.response_json_schema),
};

export const base44 = {
  entities,
  auth,
  integrations: { Core },
};

export default base44;
