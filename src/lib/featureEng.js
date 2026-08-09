/**
 * featureEng.js — feature engineering transforms over raw row arrays.
 * Pure JS, browser-side. Each transform returns { rows, added, report }.
 * No eval: derived columns use a small safe arithmetic expression evaluator.
 */

const isNumericType = (t) => ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((t || '').toLowerCase());
const isEmpty = (v) => v === undefined || v === null || v === '';
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);

// ---------- safe expression evaluator (shunting-yard) ----------
// Supports: + - * / % ^, parentheses, numbers, column names, unary minus,
// and functions: log, ln, sqrt, abs, exp, min, max.
const FUNCS = { log: Math.log10, ln: Math.log, sqrt: Math.sqrt, abs: Math.abs, exp: Math.exp, min: Math.min, max: Math.max };
const PREC = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2, '^': 3, 'u-': 4 };

function tokenizeExpr(s) {
  const tokens = []; let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9.]/.test(ch)) { let n = ''; while (i < s.length && /[0-9.]/.test(s[i])) n += s[i++]; tokens.push({ t: 'num', v: parseFloat(n) }); continue; }
    if (/[a-zA-Z_]/.test(ch)) { let id = ''; while (i < s.length && /[a-zA-Z0-9_ ]/.test(s[i]) && !'+-*/%^(),'.includes(s[i])) id += s[i++]; id = id.trim(); tokens.push({ t: FUNCS[id.toLowerCase()] ? 'func' : 'id', v: id }); continue; }
    if ('+-*/%^(),'.includes(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
    throw new Error(`Caractere inválido na fórmula: "${ch}"`);
  }
  return tokens;
}
function toRPN(tokens) {
  const out = [], stack = [];
  for (let k = 0; k < tokens.length; k++) {
    const tk = tokens[k];
    if (tk.t === 'num' || tk.t === 'id') out.push(tk);
    else if (tk.t === 'func') stack.push(tk);
    else if (tk.v === ',') { while (stack.length && stack[stack.length - 1].v !== '(') out.push(stack.pop()); }
    else if (tk.v === '(') stack.push(tk);
    else if (tk.v === ')') {
      while (stack.length && stack[stack.length - 1].v !== '(') out.push(stack.pop());
      stack.pop(); if (stack.length && stack[stack.length - 1].t === 'func') out.push(stack.pop());
    } else { // operator
      const prev = tokens[k - 1];
      const unary = tk.v === '-' && (!prev || (prev.t === 'op' && prev.v !== ')'));
      const op = unary ? 'u-' : tk.v;
      while (stack.length) { const top = stack[stack.length - 1]; if (top.t === 'op' && top.v !== '(' && PREC[top.v === '-' && false ? '' : (top.op || top.v)] >= PREC[op] && op !== '^') out.push(stack.pop()); else break; }
      stack.push({ t: 'op', v: tk.v, op });
    }
  }
  while (stack.length) out.push(stack.pop());
  return out;
}
function evalRPN(rpn, row) {
  const st = [];
  for (const tk of rpn) {
    if (tk.t === 'num') st.push(tk.v);
    else if (tk.t === 'id') { const v = parseFloat(row[tk.v]); st.push(isNaN(v) ? 0 : v); }
    else if (tk.t === 'func') { const f = FUNCS[tk.v.toLowerCase()]; const b = st.pop(); const a = f.length === 2 ? st.pop() : undefined; st.push(f.length === 2 ? f(a, b) : f(b)); }
    else {
      const op = tk.op || tk.v;
      if (op === 'u-') { st.push(-st.pop()); continue; }
      const b = st.pop(), a = st.pop();
      st.push(op === '+' ? a + b : op === '-' ? a - b : op === '*' ? a * b : op === '/' ? (b === 0 ? 0 : a / b) : op === '%' ? a % b : op === '^' ? a ** b : 0);
    }
  }
  return st.pop();
}
export function compileFormula(formula) {
  const rpn = toRPN(tokenizeExpr(formula));
  return (row) => { const v = evalRPN(rpn, row); return Number.isFinite(v) ? Number(v.toFixed(6)) : null; };
}

// ---------- transforms ----------
export function deriveColumn(rows, newName, formula) {
  const fn = compileFormula(formula);
  const out = rows.map((r) => ({ ...r, [newName]: fn(r) }));
  return { rows: out, added: [newName], report: `Coluna "${newName}" = ${formula}` };
}

export function binningColumn(rows, col, k = 4, method = 'width') {
  const vals = rows.map((r) => parseFloat(r[col])).filter((v) => !isNaN(v));
  if (!vals.length) return { rows, added: [], report: 'Coluna sem valores numéricos.' };
  const name = `${col}_faixa`;
  let edges = [];
  if (method === 'freq') {
    const sorted = [...vals].sort((a, b) => a - b);
    for (let i = 1; i < k; i++) edges.push(sorted[Math.floor((i / k) * sorted.length)]);
  } else {
    const mn = Math.min(...vals), mx = Math.max(...vals), step = (mx - mn) / k || 1;
    for (let i = 1; i < k; i++) edges.push(mn + i * step);
  }
  const label = (v) => { const x = parseFloat(v); if (isNaN(x)) return ''; let b = 0; while (b < edges.length && x > edges[b]) b++; return `faixa_${b + 1}`; };
  const out = rows.map((r) => ({ ...r, [name]: label(r[col]) }));
  return { rows: out, added: [name], report: `Discretização de "${col}" em ${k} faixas (${method === 'freq' ? 'frequência' : 'largura'} igual).` };
}

export function oneHotColumn(rows, col, topK = 10) {
  const counts = {}; rows.forEach((r) => { const v = String(r[col] ?? ''); if (v !== '') counts[v] = (counts[v] || 0) + 1; });
  const cats = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, topK).map(([k]) => k);
  const added = cats.map((c) => `${col}=${c}`);
  const out = rows.map((r) => { const nr = { ...r }; const v = String(r[col] ?? ''); cats.forEach((c) => { nr[`${col}=${c}`] = v === c ? 1 : 0; }); return nr; });
  return { rows: out, added, report: `One-Hot de "${col}" (${cats.length} categorias).` };
}

export function labelEncodeColumn(rows, col) {
  const cats = [...new Set(rows.map((r) => String(r[col] ?? '')).filter((v) => v !== ''))].sort();
  const map = Object.fromEntries(cats.map((c, i) => [c, i]));
  const name = `${col}_cod`;
  const out = rows.map((r) => ({ ...r, [name]: map[String(r[col] ?? '')] ?? null }));
  return { rows: out, added: [name], report: `Label encoding de "${col}" (${cats.length} categorias → 0…${cats.length - 1}).` };
}

export function scaleColumn(rows, col, method = 'zscore') {
  const vals = rows.map((r) => parseFloat(r[col])).filter((v) => !isNaN(v));
  if (!vals.length) return { rows, added: [], report: 'Coluna sem valores numéricos.' };
  const name = `${col}_norm`;
  let fn;
  if (method === 'minmax') { const mn = Math.min(...vals), mx = Math.max(...vals), rng = (mx - mn) || 1; fn = (x) => (x - mn) / rng; }
  else { const m = mean(vals); const sd = Math.sqrt(mean(vals.map((v) => (v - m) ** 2))) || 1; fn = (x) => (x - m) / sd; }
  const out = rows.map((r) => { const x = parseFloat(r[col]); return { ...r, [name]: isNaN(x) ? null : Number(fn(x).toFixed(6)) }; });
  return { rows: out, added: [name], report: `Normalização de "${col}" (${method === 'minmax' ? 'Min-Max [0,1]' : 'Z-score'}).` };
}

export function logColumn(rows, col) {
  const name = `${col}_log`;
  const out = rows.map((r) => { const x = parseFloat(r[col]); return { ...r, [name]: isNaN(x) || x < 0 ? null : Number(Math.log1p(x).toFixed(6)) }; });
  return { rows: out, added: [name], report: `Log(1+x) de "${col}".` };
}

// Column type list derived from a rows sample (for building the UI).
export function inferColumns(rows) {
  if (!rows?.length) return [];
  const keys = Object.keys(rows[0]);
  return keys.map((name) => {
    const sample = rows.slice(0, 200).map((r) => r[name]).filter((v) => !isEmpty(v));
    const numeric = sample.length > 0 && sample.every((v) => !isNaN(parseFloat(v)) && isFinite(v));
    return { name, type: numeric ? 'number' : 'string', numeric };
  });
}
