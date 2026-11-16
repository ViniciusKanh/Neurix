/**
 * Conversão de colunas numéricas para `number` com regras estritas.
 */
import type { CoerceOptions, CoerceResult, ColumnInfo, Row } from '../types/index.js';
import { assertRows, isNumericType, normalizeColumns, parseNumber } from '../internal/values.js';

/**
 * Converte strings numéricas das colunas numéricas em `number`.
 *
 * - Regras de `parseNumber`: `"12abc"`, `"1.2.3"`, `"1.234,56"`, booleanos e
 *   valores não finitos são INVÁLIDOS (antes, `parseFloat("12abc")` virava 12).
 * - Inválidos são mantidos como estão (`onInvalid: 'keep'`, padrão) ou
 *   trocados por `null` (`onInvalid: 'null'`) — nunca por zero.
 * - Ausentes não são alterados. Números já válidos não são contados.
 * - Retorna novas linhas; a entrada não é modificada.
 */
export function coerceTypes(rows: Row[], columnInfo: ColumnInfo[], options: CoerceOptions = {}): CoerceResult {
  assertRows(rows, 'coerceTypes');
  const onInvalid = options.onInvalid ?? 'keep';
  if (onInvalid !== 'keep' && onInvalid !== 'null') throw new TypeError('coerceTypes: onInvalid deve ser "keep" ou "null".');
  const numCols = normalizeColumns(columnInfo, 'coerceTypes').filter((c) => isNumericType(c.type)).map((c) => c.name);
  let coerced = 0;
  let invalid = 0;
  const byCol: Record<string, number> = {};
  const samples: Record<string, unknown[]> = {};

  const out = rows.map((r) => {
    const nr: Row = { ...r };
    for (const name of numCols) {
      const v = nr[name];
      const p = parseNumber(v, options);
      if (p.status === 'valid') {
        if (typeof v !== 'number') {
          nr[name] = p.value;
          coerced++;
        }
      } else if (p.status === 'invalid') {
        invalid++;
        byCol[name] = (byCol[name] ?? 0) + 1;
        const s = (samples[name] ??= []);
        if (s.length < 5) s.push(v);
        if (onInvalid === 'null') nr[name] = null;
      }
    }
    return nr;
  });
  return { rows: out, coerced, invalid, invalid_by_column: byCol, invalid_samples: samples, onInvalid };
}
