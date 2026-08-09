/**
 * miniSQL — a small, dependency-free SQL engine over an array of row objects.
 * Runs entirely in the browser on the local dataset. No AI, no network.
 *
 * Supported (single-table, table name is always `data`):
 *   SELECT <*|col[,col]|agg(col) [AS alias], ...>
 *   FROM data
 *   [WHERE <cond> [AND|OR <cond> ...]]        (no parentheses)
 *   [GROUP BY col[,col]]
 *   [ORDER BY col|alias [ASC|DESC]]
 *   [LIMIT n]
 * Aggregates: COUNT(*), COUNT(col), SUM(col), AVG(col), MIN(col), MAX(col)
 * WHERE ops: = == != <> > >= < <= LIKE (with % wildcards), IS NULL, IS NOT NULL
 */

const AGG_RE = /^(count|sum|avg|min|max)\s*\(\s*(\*|[a-zA-Z0-9_ .]+)\s*\)$/i;

function tokenizeClauses(sql) {
  const s = ' ' + sql.replace(/\s+/g, ' ').trim() + ' ';
  const up = s.toUpperCase();
  const find = (kw) => up.indexOf(' ' + kw + ' ');
  const iSelect = find('SELECT');
  if (iSelect < 0) throw new Error('A consulta precisa começar com SELECT.');
  const iFrom = find('FROM');
  if (iFrom < 0) throw new Error('Faltou a cláusula FROM data.');
  const iWhere = find('WHERE');
  const iGroup = find('GROUP BY');
  const iOrder = find('ORDER BY');
  const iLimit = find('LIMIT');

  const marks = [['where', iWhere], ['group', iGroup], ['order', iOrder], ['limit', iLimit]].filter(([, i]) => i >= 0).sort((a, b) => a[1] - b[1]);
  const selectEnd = iFrom;
  const selectStr = s.slice(iSelect + 7, selectEnd).trim();

  // FROM ... up to next clause
  const afterFrom = marks.length ? marks[0][1] : s.length;
  const fromStr = s.slice(iFrom + 5, afterFrom).trim();

  const clause = (name) => {
    const idx = marks.findIndex(([n]) => n === name);
    if (idx < 0) return null;
    const start = marks[idx][1] + (name === 'group' || name === 'order' ? 9 : name === 'where' ? 6 : 6);
    const end = idx + 1 < marks.length ? marks[idx + 1][1] : s.length;
    return s.slice(start, end).trim();
  };
  return { selectStr, fromStr, where: clause('where'), group: clause('group'), order: clause('order'), limit: clause('limit') };
}

function parseSelect(selectStr) {
  // split on commas not inside parentheses
  const parts = []; let depth = 0, cur = '';
  for (const ch of selectStr) {
    if (ch === '(') depth++; if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => {
    let expr = p.trim(); let alias = null;
    const asM = /\s+AS\s+([a-zA-Z0-9_]+)$/i.exec(expr);
    if (asM) { alias = asM[1]; expr = expr.slice(0, asM.index).trim(); }
    const agg = AGG_RE.exec(expr);
    if (agg) return { type: 'agg', fn: agg[1].toLowerCase(), col: agg[2].trim(), alias: alias || expr };
    if (expr === '*') return { type: 'star' };
    return { type: 'col', col: expr, alias: alias || expr };
  });
}

function parseWhere(where) {
  if (!where) return null;
  // split by AND/OR keeping the connectors (left-to-right, no parens)
  const tokens = where.split(/\s+(AND|OR)\s+/i);
  const conds = [{ conj: null, ...parseCond(tokens[0]) }];
  for (let i = 1; i < tokens.length; i += 2) conds.push({ conj: tokens[i].toUpperCase(), ...parseCond(tokens[i + 1]) });
  return conds;
}

function parseCond(str) {
  const t = str.trim();
  let m = /\s+IS\s+NOT\s+NULL$/i.exec(t); if (m) return { col: t.slice(0, m.index).trim(), op: 'isnotnull' };
  m = /\s+IS\s+NULL$/i.exec(t); if (m) return { col: t.slice(0, m.index).trim(), op: 'isnull' };
  m = /\s+LIKE\s+/i.exec(t); if (m) return { col: t.slice(0, m.index).trim(), op: 'like', val: stripQuotes(t.slice(m.index + m[0].length).trim()) };
  m = /(<=|>=|<>|!=|==|=|<|>)/.exec(t); if (!m) throw new Error(`Condição WHERE inválida: "${t}"`);
  const op = m[0]; const col = t.slice(0, m.index).trim(); const val = stripQuotes(t.slice(m.index + op.length).trim());
  return { col, op, val };
}
const stripQuotes = (v) => (/^'.*'$/.test(v) || /^".*"$/.test(v)) ? v.slice(1, -1) : v;

function evalCond(row, c) {
  const raw = row[c.col];
  if (c.op === 'isnull') return raw === undefined || raw === null || raw === '';
  if (c.op === 'isnotnull') return !(raw === undefined || raw === null || raw === '');
  if (c.op === 'like') { const re = new RegExp('^' + c.val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i'); return re.test(String(raw ?? '')); }
  const numA = parseFloat(raw), numB = parseFloat(c.val);
  const bothNum = !isNaN(numA) && !isNaN(numB) && String(c.val).trim() !== '';
  const a = bothNum ? numA : String(raw ?? '');
  const b = bothNum ? numB : String(c.val);
  switch (c.op) {
    case '=': case '==': return a == b;
    case '!=': case '<>': return a != b;
    case '>': return a > b; case '>=': return a >= b;
    case '<': return a < b; case '<=': return a <= b;
    default: return false;
  }
}

function applyWhere(rows, conds) {
  if (!conds) return rows;
  return rows.filter((row) => {
    let acc = evalCond(row, conds[0]);
    for (let i = 1; i < conds.length; i++) {
      const v = evalCond(row, conds[i]);
      acc = conds[i].conj === 'OR' ? (acc || v) : (acc && v);
    }
    return acc;
  });
}

function aggregate(rows, fn, col) {
  if (fn === 'count') return col === '*' ? rows.length : rows.filter((r) => !(r[col] === undefined || r[col] === null || r[col] === '')).length;
  const nums = rows.map((r) => parseFloat(r[col])).filter((n) => !isNaN(n));
  if (!nums.length) return null;
  if (fn === 'sum') return round(nums.reduce((a, b) => a + b, 0));
  if (fn === 'avg') return round(nums.reduce((a, b) => a + b, 0) / nums.length);
  if (fn === 'min') return round(Math.min(...nums));
  if (fn === 'max') return round(Math.max(...nums));
  return null;
}
const round = (v) => Math.round(v * 10000) / 10000;

export function runSQL(rows, sql) {
  if (!Array.isArray(rows)) throw new Error('Sem dados carregados.');
  const q = tokenizeClauses(sql);
  if (!/^data$/i.test(q.fromStr)) throw new Error('A tabela deve ser `data` (FROM data).');
  const cols = parseSelect(q.selectStr);
  const where = parseWhere(q.where);
  let filtered = applyWhere(rows, where);

  const hasAgg = cols.some((c) => c.type === 'agg');
  const groupBy = q.group ? q.group.split(',').map((s) => s.trim()) : [];

  let out;
  if (groupBy.length) {
    const groups = new Map();
    filtered.forEach((r) => { const key = groupBy.map((g) => String(r[g] ?? '')).join('\u0001'); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(r); });
    out = [...groups.values()].map((grp) => {
      const o = {};
      groupBy.forEach((g) => { o[g] = grp[0][g]; });
      cols.forEach((c) => { if (c.type === 'agg') o[c.alias] = aggregate(grp, c.fn, c.col); else if (c.type === 'col' && !groupBy.includes(c.col)) o[c.alias] = grp[0][c.col]; });
      return o;
    });
  } else if (hasAgg) {
    const o = {}; cols.forEach((c) => { if (c.type === 'agg') o[c.alias] = aggregate(filtered, c.fn, c.col); else if (c.type === 'col') o[c.alias] = filtered[0]?.[c.col]; });
    out = [o];
  } else {
    out = filtered.map((r) => {
      if (cols.length === 1 && cols[0].type === 'star') return { ...r };
      const o = {}; cols.forEach((c) => { if (c.type === 'star') Object.assign(o, r); else o[c.alias] = r[c.col]; }); return o;
    });
  }

  if (q.order) {
    const [ocolRaw, dirRaw] = q.order.split(/\s+/);
    const ocol = ocolRaw.trim(); const desc = (dirRaw || '').toUpperCase() === 'DESC';
    out.sort((a, b) => { const x = a[ocol], y = b[ocol]; const nx = parseFloat(x), ny = parseFloat(y); const cmp = (!isNaN(nx) && !isNaN(ny)) ? nx - ny : String(x ?? '').localeCompare(String(y ?? '')); return desc ? -cmp : cmp; });
  }
  const columns = out.length ? Object.keys(out[0]) : (cols.some((c) => c.type === 'star') ? Object.keys(rows[0] || {}) : cols.map((c) => c.alias));
  const total = out.length;
  if (q.limit) { const n = parseInt(q.limit, 10); if (!isNaN(n)) out = out.slice(0, n); }
  return { columns, rows: out, total, returned: out.length };
}
