/**
 * Relatório de qualidade por coluna e por tabela.
 */
import type { ColumnInfo, ColumnQuality, NumericParseOptions, QualityIssue, QualityReport, Row } from '../types/index.js';
import { assertRows, isMissing, isNumericType, normalizeColumns, parseNumber } from '../internal/values.js';
import { inferColumns } from '../profiling/inferColumns.js';
import { countDuplicates } from './duplicates.js';

export interface QualityOptions extends NumericParseOptions {
  /** Considera duplicatas tratando ausentes como iguais (padrão true). */
  treatMissingAsEqual?: boolean;
  /** Razão de cardinalidade a partir da qual uma coluna categórica é sinalizada (padrão 0,95). */
  highCardinalityRatio?: number;
  /** Mínimo de valores para avaliar alta cardinalidade (padrão 20). */
  highCardinalityMinValues?: number;
}

/**
 * Analisa qualidade: ausentes, erros de tipo, cardinalidade, colunas
 * constantes e linhas duplicadas. Sem `columnInfo`, as colunas são
 * inferidas com `inferColumns`. Não modifica a entrada.
 */
export function analyzeQuality(rows: Row[], columnInfo?: ColumnInfo[], options: QualityOptions = {}): QualityReport {
  assertRows(rows, 'analyzeQuality');
  let cols = normalizeColumns(columnInfo, 'analyzeQuality');
  if (!cols.length) cols = inferColumns(rows, options);
  const n = rows.length;
  const ratioLimit = options.highCardinalityRatio ?? 0.95;
  const minValues = options.highCardinalityMinValues ?? 20;
  const issueList: QualityIssue[] = [];

  const columns: ColumnQuality[] = cols.map((c) => {
    const numeric = isNumericType(c.type);
    let nulls = 0;
    let typeMismatch = 0;
    const seen = new Set<string>();
    for (const r of rows) {
      const v = r[c.name];
      if (isMissing(v)) {
        nulls++;
        continue;
      }
      seen.add(String(v));
      if (numeric && parseNumber(v, options).status === 'invalid') typeMismatch++;
    }
    const present = n - nulls;
    const q: ColumnQuality = {
      name: c.name,
      type: c.type,
      numeric,
      nulls,
      null_pct: n ? Number(((nulls / n) * 100).toFixed(1)) : 0,
      unique: seen.size,
      type_mismatch: typeMismatch,
      cardinality_ratio: present ? seen.size / present : 0,
      constant: present > 0 && seen.size === 1,
      all_missing: n > 0 && present === 0,
    };
    if (q.all_missing) issueList.push({ code: 'all_missing', column: c.name, count: nulls, message: `Coluna "${c.name}" está totalmente ausente.` });
    else if (nulls) issueList.push({ code: 'missing_values', column: c.name, count: nulls, message: `Coluna "${c.name}" tem ${nulls} valor(es) ausente(s).` });
    if (typeMismatch) issueList.push({ code: 'type_mismatch', column: c.name, count: typeMismatch, message: `Coluna numérica "${c.name}" tem ${typeMismatch} valor(es) não numérico(s).` });
    if (q.constant && n > 1) issueList.push({ code: 'constant_column', column: c.name, count: present, message: `Coluna "${c.name}" é constante.` });
    if (!numeric && present >= minValues && q.cardinality_ratio >= ratioLimit) {
      issueList.push({ code: 'high_cardinality', column: c.name, count: seen.size, message: `Coluna "${c.name}" tem cardinalidade muito alta (possível identificador).` });
    }
    return q;
  });

  const duplicates = countDuplicates(rows, cols, { treatMissingAsEqual: options.treatMissingAsEqual ?? true });
  if (duplicates) issueList.push({ code: 'duplicate_rows', count: duplicates, message: `${duplicates} linha(s) duplicada(s).` });

  return {
    rows: n,
    columns_count: cols.length,
    columns,
    duplicates,
    total_nulls: columns.reduce((s, c) => s + c.nulls, 0),
    issues: columns.filter((c) => c.nulls > 0 || c.type_mismatch > 0).length + (duplicates > 0 ? 1 : 0),
    issue_list: issueList,
  };
}
