/**
 * Correlação de Pearson com tratamento explícito de casos indefinidos.
 *
 * - Ausentes: exclusão par a par (pairwise) — usa somente linhas em que
 *   ambos os valores são números válidos.
 * - Coluna constante (no subconjunto pareado): r é INDEFINIDO → `null`,
 *   nunca 0.
 * - Menos de `minObservations` pares válidos: `null`.
 */
import type {
  ColumnInfo,
  CorrelationError,
  CorrelationOptions,
  CorrelationResult,
  PearsonResult,
  Row,
  UndefinedCorrelation,
} from '../types/index.js';
import { assertRows, isNumericType, normalizeColumns, NeurixDataError, roundTo, toNumberOrNull } from '../internal/values.js';

/**
 * Pearson entre dois vetores numéricos de mesmo tamanho; posições com
 * `null`/não finitos em qualquer um deles são ignoradas.
 */
export function pearson(
  x: readonly (number | null)[],
  y: readonly (number | null)[],
  minObservations = 3,
): PearsonResult {
  if (x.length !== y.length) throw new NeurixDataError('LENGTH_MISMATCH', 'pearson: vetores com tamanhos diferentes.');
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < x.length; i++) {
    const a = x[i];
    const b = y[i];
    if (typeof a === 'number' && typeof b === 'number' && Number.isFinite(a) && Number.isFinite(b)) {
      xs.push(a);
      ys.push(b);
    }
  }
  const n = xs.length;
  if (n < Math.max(2, minObservations)) return { r: null, n, reason: 'insufficient_observations' };

  // Constância verificada por igualdade exata (evita resíduos de ponto flutuante).
  const constant = (arr: number[]) => arr.every((v) => v === arr[0]);
  if (constant(xs) || constant(ys)) return { r: null, n, reason: 'constant' };

  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i]!;
    my += ys[i]!;
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i]! - mx;
    const dy = ys[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  const den = Math.sqrt(sxx * syy);
  if (!(den > 0)) return { r: null, n, reason: 'constant' };
  // Limita a [-1, 1] contra erro de arredondamento.
  const r = Math.max(-1, Math.min(1, sxy / den));
  return { r, n };
}

/**
 * Matriz de correlação de Pearson entre as colunas numéricas de `columnInfo`
 * e pares com |r| ≥ `threshold` (multicolinearidade).
 *
 * Retorna `{ error: true, message }` quando há menos de duas colunas
 * numéricas (contrato herdado do Neurix).
 */
export function correlationMatrix(
  rows: Row[],
  columnInfo: ColumnInfo[],
  threshold = 0.8,
  options: CorrelationOptions = {},
): CorrelationResult | CorrelationError {
  assertRows(rows, 'correlationMatrix');
  const cols = normalizeColumns(columnInfo, 'correlationMatrix');
  if (!(threshold >= 0 && threshold <= 1)) throw new NeurixDataError('INVALID_THRESHOLD', 'correlationMatrix: threshold deve estar em [0, 1].');
  const minObs = options.minObservations ?? 3;
  const precision = options.precision === undefined ? 3 : options.precision;

  const numCols = cols.filter((c) => isNumericType(c.type)).map((c) => c.name);
  if (numCols.length < 2) return { error: true, message: 'São necessárias ≥ 2 colunas numéricas.' };

  const series = numCols.map((name) => rows.map((r) => toNumberOrNull(r[name], options)));
  const k = numCols.length;
  const matrix: (number | null)[][] = Array.from({ length: k }, () => Array<number | null>(k).fill(null));
  const nMatrix: number[][] = Array.from({ length: k }, () => Array<number>(k).fill(0));
  const highPairs: CorrelationResult['high_pairs'] = [];
  const undefinedPairs: UndefinedCorrelation[] = [];

  for (let i = 0; i < k; i++) {
    for (let j = i; j < k; j++) {
      const res = pearson(series[i]!, series[j]!, minObs);
      // Diagonal: 1 somente se a variável tem variância > 0 e observações suficientes.
      const r = res.r === null ? null : i === j ? 1 : roundTo(res.r, precision);
      matrix[i]![j] = r;
      matrix[j]![i] = r;
      nMatrix[i]![j] = res.n;
      nMatrix[j]![i] = res.n;
      if (i !== j) {
        if (r === null) undefinedPairs.push({ a: numCols[i]!, b: numCols[j]!, reason: res.reason!, n: res.n });
        else if (Math.abs(r) >= threshold) highPairs.push({ a: numCols[i]!, b: numCols[j]!, r, n: res.n });
      }
    }
  }
  highPairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  return {
    method: 'pearson',
    missing: 'pairwise',
    columns: numCols,
    matrix,
    n_matrix: nMatrix,
    high_pairs: highPairs,
    undefined_pairs: undefinedPairs,
    threshold,
  };
}
