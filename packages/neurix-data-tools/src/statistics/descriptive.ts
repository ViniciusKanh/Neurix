/**
 * Estatística descritiva sobre arrays numéricos já validados.
 * Funções sem estado; nenhuma usa spread em arrays grandes (evita estouro de
 * pilha de `Math.min(...arr)` com centenas de milhares de valores).
 * Arrays vazios retornam `null` em vez de 0 ou NaN.
 */
import { compareStrings, encodeValue } from '../internal/values.js';

/** Soma com compensação de Kahan (menor erro de arredondamento). */
export function sum(values: readonly number[]): number {
  let s = 0;
  let c = 0;
  for (const v of values) {
    const y = v - c;
    const t = s + y;
    c = t - s - y;
    s = t;
  }
  return s;
}

/** Média aritmética; `null` para array vazio. */
export function mean(values: readonly number[]): number | null {
  return values.length ? sum(values) / values.length : null;
}

/** Mínimo; `null` para array vazio. */
export function min(values: readonly number[]): number | null {
  if (!values.length) return null;
  let m = values[0]!;
  for (const v of values) if (v < m) m = v;
  return m;
}

/** Máximo; `null` para array vazio. */
export function max(values: readonly number[]): number | null {
  if (!values.length) return null;
  let m = values[0]!;
  for (const v of values) if (v > m) m = v;
  return m;
}

/**
 * Quantil com interpolação linear (equivalente ao tipo 7 de Hyndman & Fan,
 * padrão do R e do NumPy). `p` ∈ [0, 1]; `null` para array vazio.
 */
export function quantile(values: readonly number[], p: number): number | null {
  if (!values.length) return null;
  if (!(p >= 0 && p <= 1)) throw new RangeError('quantile: p deve estar em [0, 1].');
  const s = [...values].sort((a, b) => a - b);
  const h = (s.length - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return s[lo]! + (h - lo) * (s[hi]! - s[lo]!);
}

/** Mediana (quantil 0,5); `null` para array vazio. */
export function median(values: readonly number[]): number | null {
  return quantile(values, 0.5);
}

/**
 * Variância. `ddof = 0` → populacional (divide por n); `ddof = 1` → amostral
 * (divide por n − 1). `null` quando n − ddof ≤ 0.
 */
export function variance(values: readonly number[], ddof: 0 | 1 = 0): number | null {
  const n = values.length;
  if (n - ddof <= 0) return null;
  const m = sum(values) / n;
  let ss = 0;
  for (const v of values) ss += (v - m) * (v - m);
  return ss / (n - ddof);
}

/** Desvio-padrão (ver `variance` para `ddof`). */
export function std(values: readonly number[], ddof: 0 | 1 = 0): number | null {
  const v = variance(values, ddof);
  return v === null ? null : Math.sqrt(v);
}

/**
 * Moda determinística: maior frequência; empate resolvido pelo valor que
 * aparece primeiro na entrada. Valores são comparados preservando o tipo
 * (`1` ≠ `"1"`). Retorna `undefined` para array vazio.
 */
export function mode<T>(values: readonly T[]): T | undefined {
  const counts = new Map<string, { value: T; count: number; first: number }>();
  values.forEach((v, i) => {
    const k = JSON.stringify(encodeValue(v, false));
    const e = counts.get(k);
    if (e) e.count++;
    else counts.set(k, { value: v, count: 1, first: i });
  });
  let best: { value: T; count: number; first: number } | undefined;
  for (const e of counts.values()) {
    if (!best || e.count > best.count || (e.count === best.count && e.first < best.first)) best = e;
  }
  return best?.value;
}

/**
 * Tabela de frequências por representação textual, ordenada por contagem
 * decrescente e, em empate, por ordem lexicográfica (determinística).
 */
export function frequencies(values: readonly unknown[]): { value: string; count: number }[] {
  const m = new Map<string, number>();
  for (const v of values) {
    const k = String(v);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || compareStrings(a.value, b.value));
}
