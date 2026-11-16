/**
 * Duplicatas de linhas com chave estruturada e determinística.
 *
 * A implementação original concatenava `String(valor)` sem separador, o que
 * causava colisões (`{a:'ab', b:'c'}` ≡ `{a:'a', b:'bc'}`) e confundia tipos
 * (`1` ≡ `'1'`). Aqui cada valor é codificado com seu tipo e as colunas são
 * delimitadas por uma serialização JSON de array.
 *
 * Regras (documentadas e testadas):
 * - Com `columnInfo`, compara-se apenas essas colunas, na ordem dada.
 * - Sem `columnInfo`, usa-se a união ORDENADA das chaves de todas as linhas —
 *   a ordem das propriedades no objeto não importa.
 * - `1` (número) ≠ `'1'` (string); `true` ≠ `'true'`; `0` = `-0`.
 * - Ausentes (undefined, null, '', espaços, NaN) são iguais entre si por
 *   padrão (`treatMissingAsEqual: true`); com `false`, são distintos.
 * - `Infinity` e `-Infinity` são valores distintos de NaN e entre si.
 */
import type { ColumnInfo, DropDuplicatesResult, DuplicateOptions, Row } from '../types/index.js';
import { assertRows, normalizeColumns, rowKey, unionKeys } from '../internal/values.js';

function keyColumns(rows: Row[], columnInfo: ColumnInfo[] | undefined, fn: string): string[] {
  const cols = normalizeColumns(columnInfo, fn).map((c) => c.name);
  return cols.length ? cols : unionKeys(rows);
}

/** Índices das linhas que repetem uma linha anterior (mantém a 1ª ocorrência). */
export function findDuplicates(rows: Row[], columnInfo?: ColumnInfo[], options: DuplicateOptions = {}): number[] {
  assertRows(rows, 'findDuplicates');
  const cols = keyColumns(rows, columnInfo, 'findDuplicates');
  const eq = options.treatMissingAsEqual ?? true;
  const seen = new Set<string>();
  const dup: number[] = [];
  rows.forEach((r, i) => {
    const k = rowKey(r, cols, eq);
    if (seen.has(k)) dup.push(i);
    else seen.add(k);
  });
  return dup;
}

/** Quantidade de linhas duplicadas (excluindo a primeira ocorrência). */
export function countDuplicates(rows: Row[], columnInfo?: ColumnInfo[], options?: DuplicateOptions): number {
  return findDuplicates(rows, columnInfo, options).length;
}

/**
 * Remove linhas duplicadas mantendo a primeira ocorrência. Não modifica a
 * entrada: retorna um novo array com as mesmas referências de linha.
 */
export function dropDuplicates(rows: Row[], columnInfo?: ColumnInfo[], options?: DuplicateOptions): DropDuplicatesResult {
  const dup = findDuplicates(rows, columnInfo, options);
  const drop = new Set(dup);
  return { rows: rows.filter((_, i) => !drop.has(i)), removed: dup.length, removed_indices: dup };
}
