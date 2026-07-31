/**
 * Local dataset store (IndexedDB) — WEKA-style.
 * The full dataset lives in the browser (per project), never in Turso.
 * Training and evaluation run on the complete in-memory data for pure, real results.
 */
const DB_NAME = 'neurix';
const STORE = 'datasets';
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'projectId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const out = fn(store);
    t.oncomplete = () => { db.close(); resolve(out?.result ?? out); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

// Saves the full dataset rows + column metadata for a project.
export async function saveDataset(projectId, rows, columns, meta = {}) {
  await tx('readwrite', (store) => store.put({
    projectId, rows, columns, meta, savedAt: new Date().toISOString(), count: rows.length,
  }));
  return rows.length;
}

// Returns { rows, columns, meta, count } or null if not stored on this device.
export async function getDataset(projectId) {
  try {
    return await tx('readonly', (store) => {
      const r = store.get(projectId);
      return new Promise((res) => { r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
    });
  } catch { return null; }
}

export async function hasDataset(projectId) {
  const d = await getDataset(projectId);
  return !!(d && d.rows && d.rows.length);
}

export async function deleteDataset(projectId) {
  try { await tx('readwrite', (store) => store.delete(projectId)); } catch { /* ignore */ }
}

export async function listStored() {
  try {
    return await tx('readonly', (store) => {
      const r = store.getAllKeys();
      return new Promise((res) => { r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
    });
  } catch { return []; }
}
