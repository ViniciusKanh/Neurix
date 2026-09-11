/**
 * aiCache.js — local IndexedDB cache for AI (Gemini) results.
 * Kept in its own database so it never interferes with the dataset store.
 * Lets screens show the LAST generated analysis without spending tokens again.
 */
const DB_NAME = 'neurix_ai';
const STORE = 'cache';
const VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => { const db = req.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => { db.close(); resolve(out?.result ?? out); };
    t.onerror = () => { db.close(); reject(t.error); };
  });
}

// Save a result under a key, with an optional signature (e.g., row/col counts)
// used to detect when the underlying data changed.
export async function saveAI(key, data, signature = null) {
  try { await tx('readwrite', (s) => s.put({ key, data, signature, savedAt: new Date().toISOString() })); } catch { /* ignore */ }
}

// Returns { data, signature, savedAt } or null.
export async function getAI(key) {
  try {
    return await tx('readonly', (s) => {
      const r = s.get(key);
      return new Promise((res) => { r.onsuccess = () => res(r.result || null); r.onerror = () => res(null); });
    });
  } catch { return null; }
}

export async function deleteAI(key) {
  try { await tx('readwrite', (s) => s.delete(key)); } catch { /* ignore */ }
}
