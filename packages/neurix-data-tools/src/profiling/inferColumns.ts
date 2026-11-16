/**
 * Inferência simples de tipos de coluna a partir de uma amostra de linhas.
 */
import type { NumericParseOptions, Row } from '../types/index.js';
import { assertRows, isMissing, parseNumber, unionKeys } from '../internal/values.js';

export interface InferredColumn {
  name: string;
  type: 'number' | 'string';
  numeric: boolean;
}

export interface InferColumnsOptions extends NumericParseOptions {
  /** Linhas inspecionadas (do início). Padrão 200, como no Neurix. */
  sampleSize?: number;
}

/**
 * Infere `number` quando TODOS os valores não ausentes da amostra são números
 * válidos pela regra estrita de `parseNumber`; caso contrário `string`.
 * Colunas totalmente ausentes são `string`. A ordem das colunas segue a
 * primeira linha e, depois, chaves que aparecem só em linhas seguintes.
 */
export function inferColumns(rows: Row[], options: InferColumnsOptions = {}): InferredColumn[] {
  assertRows(rows, 'inferColumns');
  if (!rows.length) return [];
  const first = Object.keys(rows[0]!);
  const extra = unionKeys(rows).filter((k) => !first.includes(k));
  const sample = rows.slice(0, options.sampleSize ?? 200);
  return [...first, ...extra].map((name) => {
    const vals = sample.map((r) => r[name]).filter((v) => !isMissing(v));
    const numeric = vals.length > 0 && vals.every((v) => parseNumber(v, options).status === 'valid');
    return { name, type: numeric ? 'number' : 'string', numeric };
  });
}
