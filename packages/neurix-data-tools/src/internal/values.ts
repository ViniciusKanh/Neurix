/**
 * Utilitários internos de valores: ausência, tipagem, conversão numérica
 * estrita e chaves determinísticas. Não fazem parte da API pública direta,
 * exceto pelo que é reexportado em `src/index.ts`.
 */
import type { ColumnInfo, DecimalSeparator, NumericParseOptions, ParsedNumber, Row } from '../types/index.js';

/** Erro padronizado da biblioteca, com código estável para tratamento. */
export class NeurixDataError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = 'NeurixDataError';
    this.code = code;
  }
}

const NUMERIC_TYPES = new Set(['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double']);

/** true se o rótulo de tipo da coluna representa um atributo numérico. */
export function isNumericType(type: unknown): boolean {
  return typeof type === 'string' && NUMERIC_TYPES.has(type.toLowerCase());
}

/**
 * Política de ausência: `undefined`, `null`, string vazia, string só com
 * espaços e `NaN` numérico. `Infinity` NÃO é ausente — é um número inválido.
 */
export function isMissing(v: unknown): boolean {
  return (
    v === undefined ||
    v === null ||
    (typeof v === 'string' && v.trim() === '') ||
    (typeof v === 'number' && Number.isNaN(v))
  );
}

// Número decimal estrito: sinal opcional, dígitos, parte fracionária e expoente.
const STRICT_NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Converte um valor em número com regras explícitas (sem `parseFloat`
 * permissivo): `"12abc"`, `"1.2.3"`, `"1.234,56"`, booleanos, `Infinity` e
 * `"Infinity"` são inválidos. Nada é convertido silenciosamente em zero.
 */
export function parseNumber(v: unknown, options: NumericParseOptions = {}): ParsedNumber {
  const sep: DecimalSeparator = options.decimalSeparator ?? 'auto';
  if (isMissing(v)) return { status: 'missing' };
  if (typeof v === 'number') {
    return Number.isFinite(v)
      ? { status: 'valid', value: v }
      : { status: 'invalid', raw: v, reason: 'número não finito' };
  }
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isSafeInteger(n) ? { status: 'valid', value: n } : { status: 'invalid', raw: v, reason: 'bigint fora do intervalo seguro' };
  }
  if (typeof v !== 'string') return { status: 'invalid', raw: v, reason: `tipo ${typeof v} não é numérico` };

  let s = v.trim();
  if (sep === ',') {
    if (s.includes('.')) return { status: 'invalid', raw: v, reason: 'ponto não permitido com separador decimal vírgula' };
    s = s.replace(',', '.');
  } else if (sep === 'auto') {
    const commas = s.split(',').length - 1;
    if (commas === 1 && !s.includes('.')) s = s.replace(',', '.');
  }
  if (!STRICT_NUMBER.test(s)) return { status: 'invalid', raw: v, reason: 'formato numérico inválido' };
  const n = Number(s);
  if (!Number.isFinite(n)) return { status: 'invalid', raw: v, reason: 'número não finito' };
  return { status: 'valid', value: n };
}

/** Atalho: número válido ou `null` (ausente/inválido). */
export function toNumberOrNull(v: unknown, options?: NumericParseOptions): number | null {
  const p = parseNumber(v, options);
  return p.status === 'valid' ? p.value : null;
}

/**
 * Codifica um valor preservando tipo — base das chaves de duplicatas.
 * `0` e `-0` são iguais; objetos são serializados com chaves ordenadas.
 */
export function encodeValue(v: unknown, treatMissingAsEqual = true): unknown {
  if (treatMissingAsEqual && isMissing(v)) return ['∅'];
  if (v === undefined) return ['u'];
  if (v === null) return ['n'];
  switch (typeof v) {
    case 'number':
      if (Number.isNaN(v)) return ['nan'];
      if (!Number.isFinite(v)) return ['inf', v > 0 ? 1 : -1];
      return ['num', v === 0 ? 0 : v];
    case 'string':
      return ['s', v];
    case 'boolean':
      return ['b', v];
    case 'bigint':
      return ['bi', v.toString()];
    default:
      break;
  }
  if (v instanceof Date) return ['d', Number.isNaN(v.getTime()) ? 'invalid' : v.toISOString()];
  if (Array.isArray(v)) return ['a', v.map((x) => encodeValue(x, treatMissingAsEqual))];
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return ['o', Object.keys(o).sort().map((k) => [k, encodeValue(o[k], treatMissingAsEqual)])];
  }
  return ['?', String(v)];
}

/** Chave determinística de uma linha restrita às colunas informadas. */
export function rowKey(row: Row, columns: string[], treatMissingAsEqual = true): string {
  return JSON.stringify(columns.map((c) => encodeValue(row[c], treatMissingAsEqual)));
}

/** Valida que `rows` é um array de objetos. */
export function assertRows(rows: unknown, fn: string): asserts rows is Row[] {
  if (!Array.isArray(rows)) throw new NeurixDataError('INVALID_ROWS', `${fn}: "rows" deve ser um array de objetos.`);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (r === null || typeof r !== 'object' || Array.isArray(r)) {
      throw new NeurixDataError('INVALID_ROWS', `${fn}: a linha ${i} não é um objeto.`);
    }
  }
}

/** Valida e normaliza a lista de colunas. */
export function normalizeColumns(columnInfo: unknown, fn: string): ColumnInfo[] {
  if (columnInfo === undefined || columnInfo === null) return [];
  if (!Array.isArray(columnInfo)) throw new NeurixDataError('INVALID_COLUMNS', `${fn}: "columnInfo" deve ser um array.`);
  return columnInfo.map((c, i) => {
    if (!c || typeof c !== 'object' || typeof (c as ColumnInfo).name !== 'string') {
      throw new NeurixDataError('INVALID_COLUMNS', `${fn}: coluna ${i} sem "name" (string).`);
    }
    return c as ColumnInfo;
  });
}

/** União ordenada das chaves das linhas (determinística). */
export function unionKeys(rows: Row[]): string[] {
  const set = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) set.add(k);
  return [...set].sort();
}

/** true se ao menos uma linha possui a propriedade. */
export function columnExists(rows: Row[], name: string): boolean {
  return rows.some((r) => Object.prototype.hasOwnProperty.call(r, name));
}

/** Arredonda para `digits` casas, preservando null/undefined. */
export function roundTo(v: number, digits?: number | null): number {
  if (digits === undefined || digits === null) return v;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/**
 * PRNG determinístico (mulberry32). Usado apenas onde há aleatoriedade
 * explícita (amostragem, divisão treino/teste), sempre com semente.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Comparador de strings independente de locale (ordem por code unit). */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
