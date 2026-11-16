/**
 * Transformações funcionais compatíveis com o Neurix: cada uma retorna
 * `{ rows, added, report }` e AJUSTA E APLICA sobre o mesmo conjunto.
 *
 * Para fluxos de Machine Learning com treino/teste, use as classes
 * (`Scaler`, `Binner`, `OneHotEncoder`, `LabelEncoder`), que separam
 * `fit` de `transform` e evitam vazamento estatístico.
 */
import type { FeatureResult, NumericParseOptions, Row } from '../types/index.js';
import { assertRows, NeurixDataError, toNumberOrNull } from '../internal/values.js';
import { compileFormula, type CompileFormulaOptions } from './formula.js';
import { Binner, LabelEncoder, OneHotEncoder, Scaler } from './transformers.js';

/** Cria `newName` = resultado da fórmula em cada linha (null quando indefinido). */
export function deriveColumn(rows: Row[], newName: string, formula: string, options: CompileFormulaOptions = {}): FeatureResult {
  assertRows(rows, 'deriveColumn');
  if (typeof newName !== 'string' || !newName.trim()) throw new NeurixDataError('INVALID_COLUMN', 'deriveColumn: nome da nova coluna vazio.');
  const fn = compileFormula(formula, options);
  const out = rows.map((r) => ({ ...r, [newName]: fn(r) }));
  const nulls = out.filter((r) => r[newName] === null).length;
  return {
    rows: out,
    added: [newName],
    report: `Coluna "${newName}" = ${formula}` + (nulls ? ` (${nulls} linha(s) indefinida(s) → null)` : ''),
  };
}

/** Discretização de `col` em `k` faixas (`width` ou `freq`/`quantile`). */
export function binningColumn(rows: Row[], col: string, k = 4, method: 'width' | 'freq' | 'quantile' = 'width', options: NumericParseOptions = {}): FeatureResult {
  assertRows(rows, 'binningColumn');
  const b = new Binner({ ...options, column: col, bins: k, method });
  try {
    b.fit(rows);
  } catch (e) {
    if ((e as NeurixDataError).code === 'EMPTY_COLUMN') return { rows, added: [], report: 'Coluna sem valores numéricos.' };
    throw e;
  }
  const p = b.getParams();
  const label = p.method === 'width' ? 'largura' : 'frequência';
  const note = p.effective_bins !== k ? ` — ${p.effective_bins} faixa(s) efetiva(s)` : '';
  return { rows: b.transform(rows), added: [p.output], report: `Discretização de "${col}" em ${k} faixas (${label} igual)${note}.` };
}

/** One-hot das `topK` categorias mais frequentes de `col`. */
export function oneHotColumn(rows: Row[], col: string, topK = 10): FeatureResult {
  assertRows(rows, 'oneHotColumn');
  const e = new OneHotEncoder({ column: col, topK }).fit(rows);
  const p = e.getParams();
  return { rows: e.transform(rows), added: p.outputs, report: `One-Hot de "${col}" (${p.categories.length} categorias).` };
}

/** Label encoding (ordem lexicográfica) de `col` em `${col}_cod`. */
export function labelEncodeColumn(rows: Row[], col: string): FeatureResult {
  assertRows(rows, 'labelEncodeColumn');
  const e = new LabelEncoder({ column: col }).fit(rows);
  const p = e.getParams();
  const n = p.categories.length;
  return { rows: e.transform(rows), added: [p.output], report: `Label encoding de "${col}" (${n} categorias → 0…${Math.max(0, n - 1)}).` };
}

/** Normalização de `col` em `${col}_norm` (Z-score populacional ou Min-Max). */
export function scaleColumn(rows: Row[], col: string, method: 'zscore' | 'minmax' = 'zscore', options: NumericParseOptions = {}): FeatureResult {
  assertRows(rows, 'scaleColumn');
  const s = new Scaler({ ...options, column: col, method });
  try {
    s.fit(rows);
  } catch (e) {
    if ((e as NeurixDataError).code === 'EMPTY_COLUMN') return { rows, added: [], report: 'Coluna sem valores numéricos.' };
    throw e;
  }
  const p = s.getParams();
  const note = p.constant ? ' — coluna constante, saída 0' : '';
  return { rows: s.transform(rows), added: [p.output], report: `Normalização de "${col}" (${method === 'minmax' ? 'Min-Max [0,1]' : 'Z-score'})${note}.` };
}

/**
 * `${col}_log` = ln(1 + x). Definido para x ≥ 0; negativos, ausentes e
 * inválidos → null (sem parâmetros aprendidos — seguro para treino/teste).
 */
export function logColumn(rows: Row[], col: string, options: NumericParseOptions = {}): FeatureResult {
  assertRows(rows, 'logColumn');
  const name = `${col}_log`;
  const out = rows.map((r) => {
    const x = toNumberOrNull(r[col], options);
    return { ...r, [name]: x === null || x < 0 ? null : Math.log1p(x) };
  });
  return { rows: out, added: [name], report: `Log(1+x) de "${col}".` };
}
