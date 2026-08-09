/**
 * Data quality & cleaning — pure functions over raw row arrays.
 * Used by the Data Explorer (assisted cleaning) and Data Profiling (correlation).
 * No AI. Everything runs locally in the browser.
 */

const isNumericType = (t) => ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((t || '').toLowerCase());
const isEmpty = (v) => v === undefined || v === null || v === '' || (typeof v === 'string' && v.trim() === '') || (typeof v === 'number' && isNaN(v));
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mode = (a) => { const c = {}; a.forEach((v) => { c[v] = (c[v] || 0) + 1; }); const e = Object.entries(c).sort((x, y) => y[1] - x[1]); return e.length ? e[0][0] : ''; };

// Per-column and per-table quality report.
export function analyzeQuality(rows, columnInfo) {
  const cols = columnInfo || [];
  const n = rows.length;
  const columns = cols.map((c) => {
    let nulls = 0;
    const seen = {};
    rows.forEach((r) => { const v = r[c.name]; if (isEmpty(v)) nulls++; else { const k = String(v); seen[k] = (seen[k] || 0) + 1; } });
    let typeMismatch = 0;
    if (isNumericType(c.type)) rows.forEach((r) => { const v = r[c.name]; if (!isEmpty(v) && isNaN(parseFloat(v))) typeMismatch++; });
    return {
      name: c.name, type: c.type, numeric: isNumericType(c.type),
      nulls, null_pct: n ? Number(((nulls / n) * 100).toFixed(1)) : 0,
      unique: Object.keys(seen).length, type_mismatch: typeMismatch,
    };
  });
  // duplicate rows (full-row match)
  const keys = new Set(); let duplicates = 0;
  rows.forEach((r) => { const k = cols.map((c) => String(r[c.name] ?? '')).join(''); if (keys.has(k)) duplicates++; else keys.add(k); });
  const totalNulls = columns.reduce((s, c) => s + c.nulls, 0);
  return {
    rows: n, columns, duplicates,
    total_nulls: totalNulls,
    issues: columns.filter((c) => c.nulls > 0 || c.type_mismatch > 0).length + (duplicates > 0 ? 1 : 0),
  };
}

// Fill missing values: numeric → mean|median, categorical → mode.
export function imputeNulls(rows, columnInfo, strategy = 'median') {
  const cols = columnInfo || [];
  const fills = {}; let filled = 0;
  cols.forEach((c) => {
    if (isNumericType(c.type)) {
      const vals = rows.map((r) => parseFloat(r[c.name])).filter((v) => !isNaN(v));
      fills[c.name] = strategy === 'mean' ? mean(vals) : median(vals);
    } else {
      const vals = rows.map((r) => r[c.name]).filter((v) => !isEmpty(v)).map(String);
      fills[c.name] = mode(vals);
    }
  });
  const out = rows.map((r) => {
    const nr = { ...r };
    cols.forEach((c) => { if (isEmpty(nr[c.name])) { nr[c.name] = isNumericType(c.type) ? Number(fills[c.name].toFixed?.(4) ?? fills[c.name]) : fills[c.name]; filled++; } });
    return nr;
  });
  return { rows: out, filled, strategy };
}

// Remove exact duplicate rows.
export function dropDuplicates(rows, columnInfo) {
  const cols = (columnInfo || []).map((c) => c.name);
  const keys = new Set(); const out = [];
  rows.forEach((r) => { const k = (cols.length ? cols : Object.keys(r)).map((c) => String(r[c] ?? '')).join(''); if (!keys.has(k)) { keys.add(k); out.push(r); } });
  return { rows: out, removed: rows.length - out.length };
}

// Coerce numeric-typed columns to real numbers (strips stray strings).
export function coerceTypes(rows, columnInfo) {
  const numCols = (columnInfo || []).filter((c) => isNumericType(c.type)).map((c) => c.name);
  let coerced = 0;
  const out = rows.map((r) => {
    const nr = { ...r };
    numCols.forEach((name) => { const v = nr[name]; if (!isEmpty(v) && typeof v !== 'number') { const num = parseFloat(String(v).replace(',', '.')); if (!isNaN(num)) { nr[name] = num; coerced++; } } });
    return nr;
  });
  return { rows: out, coerced };
}

// Target-leakage detection: features that "predict the target too perfectly"
// (a copy of the target, |r|~1, a category that maps 1:1 to a class, or a single
// numeric threshold that separates classes almost perfectly).
export function detectTargetLeakage(rows, targetColumn, columnInfo, task) {
  const cols = (columnInfo || []).filter((c) => c.name !== targetColumn);
  if (!rows?.length || !targetColumn) return { has_leak: false, leaks: [] };
  const sample = rows.length > 3000 ? rows.filter((_, i) => i % Math.ceil(rows.length / 3000) === 0) : rows;
  const targetVals = sample.map((r) => r[targetColumn]);
  // The task decides: classification → treat target as categorical even if it is 0/1 ints.
  const targetIsNum = task ? task === 'regression' : !!(columnInfo || []).find((c) => c.name === targetColumn && isNumericType(c.type));
  const leaks = [];

  for (const c of cols) {
    const vals = sample.map((r) => r[c.name]);
    // exact copy of the target
    let same = 0, valid = 0;
    for (let i = 0; i < sample.length; i++) { if (!isEmpty(vals[i]) && !isEmpty(targetVals[i])) { valid++; if (String(vals[i]) === String(targetVals[i])) same++; } }
    if (valid > 0 && same / valid >= 0.99) { leaks.push({ feature: c.name, reason: 'É praticamente uma cópia da coluna-alvo.', severity: 'alto' }); continue; }

    if (targetIsNum && isNumericType(c.type)) {
      // |Pearson r| ~ 1
      const xs = [], ys = [];
      for (let i = 0; i < sample.length; i++) { const x = parseFloat(vals[i]), y = parseFloat(targetVals[i]); if (!isNaN(x) && !isNaN(y)) { xs.push(x); ys.push(y); } }
      if (xs.length > 5) {
        const mx = mean(xs), my = mean(ys); let sxy = 0, sxx = 0, syy = 0;
        for (let i = 0; i < xs.length; i++) { const dx = xs[i] - mx, dy = ys[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
        const r = sxx && syy ? sxy / Math.sqrt(sxx * syy) : 0;
        if (Math.abs(r) >= 0.98) leaks.push({ feature: c.name, reason: `Correlação quase perfeita com o alvo (r = ${r.toFixed(3)}).`, severity: 'alto' });
      }
    } else if (!targetIsNum) {
      // classification target
      if (!isNumericType(c.type)) {
        // categorical feature → does each category map to a single class?
        const map = {}; let n = 0;
        for (let i = 0; i < sample.length; i++) { const k = String(vals[i] ?? ''); const t = String(targetVals[i] ?? ''); if (k === '' || t === '') continue; (map[k] = map[k] || {}); map[k][t] = (map[k][t] || 0) + 1; n++; }
        const cats = Object.keys(map);
        if (n > 0 && cats.length > 1) {
          let pure = 0, total = 0; cats.forEach((k) => { const counts = Object.values(map[k]); const s = counts.reduce((a, b) => a + b, 0); pure += Math.max(...counts); total += s; });
          const purity = pure / total;
          // avoid flagging when the feature has as many categories as rows (an ID) — that's ID-like, not leakage
          if (purity >= 0.99 && cats.length < 0.5 * n) leaks.push({ feature: c.name, reason: 'Cada categoria corresponde a uma única classe do alvo (mapeamento 1:1).', severity: 'alto' });
        }
      } else {
        // numeric feature → best single-threshold accuracy (binary target only)
        const classes = [...new Set(targetVals.map((v) => String(v ?? '')).filter((v) => v !== ''))];
        if (classes.length === 2) {
          const pts = [];
          for (let i = 0; i < sample.length; i++) { const x = parseFloat(vals[i]); if (!isNaN(x) && !isEmpty(targetVals[i])) pts.push([x, String(targetVals[i]) === classes[1] ? 1 : 0]); }
          if (pts.length > 10) {
            pts.sort((a, b) => a[0] - b[0]);
            const P = pts.filter((p) => p[1] === 1).length, N = pts.length - P;
            let leftPos = 0, leftNeg = 0, best = 0;
            for (let i = 0; i < pts.length - 1; i++) { if (pts[i][1] === 1) leftPos++; else leftNeg++; const acc = Math.max(leftNeg + (P - leftPos), leftPos + (N - leftNeg)) / pts.length; if (acc > best) best = acc; }
            if (best >= 0.99) leaks.push({ feature: c.name, reason: `Um único limiar separa as classes com ${(best * 100).toFixed(0)}% de acerto.`, severity: 'médio' });
          }
        }
      }
    }
  }
  return { has_leak: leaks.length > 0, leaks };
}

// Pearson correlation among numeric columns + high-correlation (multicollinearity) pairs.
export function correlationMatrix(rows, columnInfo, threshold = 0.8) {
  const numCols = (columnInfo || []).filter((c) => isNumericType(c.type)).map((c) => c.name);
  if (numCols.length < 2) return { error: true, message: 'São necessárias ≥ 2 colunas numéricas.' };
  const series = numCols.map((name) => rows.map((r) => parseFloat(r[name])));
  const n = numCols.length;
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  // Pearson correlation over rows where BOTH values are valid numbers.
  const pearson = (a, b) => {
    let mx = 0, my = 0, k = 0;
    for (let i = 0; i < a.length; i++) { if (!isNaN(a[i]) && !isNaN(b[i])) { mx += a[i]; my += b[i]; k++; } }
    if (!k) return 0; mx /= k; my /= k;
    let sxy = 0, sxx = 0, syy = 0;
    for (let i = 0; i < a.length; i++) { if (isNaN(a[i]) || isNaN(b[i])) continue; const dx = a[i] - mx, dy = b[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
    const den = Math.sqrt(sxx * syy); return den ? sxy / den : 0;
  };
  const highPairs = [];
  for (let i = 0; i < n; i++) for (let j = i; j < n; j++) {
    const r = i === j ? 1 : Number(pearson(series[i], series[j]).toFixed(3));
    matrix[i][j] = r; matrix[j][i] = r;
    if (i !== j && Math.abs(r) >= threshold) highPairs.push({ a: numCols[i], b: numCols[j], r });
  }
  highPairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  return { columns: numCols, matrix, high_pairs: highPairs, threshold };
}
