/**
 * blend.js — combine two datasets (row arrays): concatenate or key-join.
 * Pure JS, browser-side.
 */

// Union of column names, preserving order (A first, then new from B).
function unionColumns(a, b) {
  const cols = a.length ? Object.keys(a[0]) : [];
  const set = new Set(cols);
  (b.length ? Object.keys(b[0]) : []).forEach((c) => { if (!set.has(c)) { cols.push(c); set.add(c); } });
  return cols;
}

// Vertically stack rows from both datasets (missing columns become '').
export function concatDatasets(a, b) {
  const cols = unionColumns(a, b);
  const norm = (rows) => rows.map((r) => { const o = {}; cols.forEach((c) => { o[c] = r[c] ?? ''; }); return o; });
  const rows = [...norm(a), ...norm(b)];
  return { rows, columns: cols, report: `Concatenação: ${a.length} + ${b.length} = ${rows.length} linhas, ${cols.length} colunas.` };
}

// Join B into A on a key column. type: 'inner' | 'left'. Suffix collisions with _b.
export function joinDatasets(a, b, keyA, keyB, type = 'left') {
  if (!a.length || !b.length) return { error: true, message: 'Ambos os datasets precisam ter linhas.' };
  const index = new Map();
  b.forEach((r) => { const k = String(r[keyB] ?? ''); if (k !== '' && !index.has(k)) index.set(k, r); });
  const aCols = Object.keys(a[0]); const bCols = Object.keys(b[0]).filter((c) => c !== keyB);
  const rename = {}; bCols.forEach((c) => { rename[c] = aCols.includes(c) ? `${c}_b` : c; });
  const cols = [...aCols, ...bCols.map((c) => rename[c])];

  const rows = [];
  let matched = 0;
  a.forEach((ra) => {
    const k = String(ra[keyA] ?? '');
    const rb = index.get(k);
    if (rb) { matched++; const o = { ...ra }; bCols.forEach((c) => { o[rename[c]] = rb[c]; }); rows.push(o); }
    else if (type === 'left') { const o = { ...ra }; bCols.forEach((c) => { o[rename[c]] = ''; }); rows.push(o); }
  });
  return {
    rows, columns: cols,
    report: `Junção ${type === 'inner' ? 'interna' : 'à esquerda'} por ${keyA} = ${keyB}: ${matched} correspondência(s), ${rows.length} linha(s) no resultado.`,
    matched,
  };
}
