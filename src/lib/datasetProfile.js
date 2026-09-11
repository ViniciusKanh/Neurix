/**
 * datasetProfile.js — builds a compact, privacy-conscious profile of a dataset
 * to send to the AI advisor: column schema + summary stats + a small sample.
 * Never sends the full dataset. Pure JS.
 */

const NUMERIC = ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'];
const isNumericType = (t) => NUMERIC.includes((t || '').toLowerCase());
const isEmpty = (v) => v === undefined || v === null || v === '';
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const r2 = (v) => Number((v ?? 0).toFixed(2));

// Truncate long strings in the sample to keep the payload small.
function trimVal(v) {
  if (typeof v === 'string' && v.length > 60) return v.slice(0, 60) + '…';
  return v;
}

export function buildProfile(rows, columnInfo, { target = '', task = '', sampleN = 12, statCap = 5000 } = {}) {
  const cols = columnInfo && columnInfo.length ? columnInfo : inferCols(rows);
  const n = rows.length || 1;
  const scan = rows.length > statCap ? rows.filter((_, i) => i % Math.ceil(rows.length / statCap) === 0) : rows;

  const columns = cols.map((c) => {
    const numeric = isNumericType(c.type);
    let nulls = 0; const seen = new Map();
    for (const r of scan) { const v = r[c.name]; if (isEmpty(v)) nulls++; else { const k = String(v); seen.set(k, (seen.get(k) || 0) + 1); } }
    const base = {
      name: c.name, type: numeric ? 'numérica' : 'categórica', numeric,
      null_pct: r2((nulls / scan.length) * 100), unique: seen.size,
      role: c.name === target ? 'alvo' : undefined,
    };
    if (numeric) {
      const vals = scan.map((r) => parseFloat(r[c.name])).filter((v) => !isNaN(v));
      if (vals.length) { base.min = r2(Math.min(...vals)); base.max = r2(Math.max(...vals)); base.mean = r2(mean(vals)); }
    } else {
      base.top = [...seen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([value, count]) => ({ value: trimVal(value), count }));
    }
    return base;
  });

  const sample = rows.slice(0, sampleN).map((r) => { const o = {}; cols.forEach((c) => { o[c.name] = trimVal(r[c.name]); }); return o; });

  return { rows: rows.length, columns, sample, target: target || null, task: task || null };
}

function inferCols(rows) {
  if (!rows?.length) return [];
  return Object.keys(rows[0]).map((name) => {
    const s = rows.slice(0, 200).map((r) => r[name]).filter((v) => !isEmpty(v));
    const numeric = s.length > 0 && s.every((v) => !isNaN(parseFloat(v)) && isFinite(v));
    return { name, type: numeric ? 'number' : 'string' };
  });
}
