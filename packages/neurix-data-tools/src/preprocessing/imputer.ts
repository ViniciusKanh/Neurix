/**
 * Imputação de valores ausentes com separação entre AJUSTE e APLICAÇÃO.
 *
 * Uso recomendado em Machine Learning (sem vazamento estatístico):
 *   const imp = new Imputer({ numericStrategy: 'median' }).fit(treino);
 *   const treinoOk = imp.transform(treino).rows;
 *   const testeOk  = imp.transform(teste).rows;   // usa a mediana do TREINO
 *   salvar(imp.getParams());                       // JSON reprodutível
 *
 * Regras:
 * - Só valores AUSENTES (undefined, null, '', espaços, NaN) são preenchidos.
 *   Valores inválidos (ex.: "12abc", Infinity) não são tocados — use
 *   `coerceTypes` para tratá-los explicitamente.
 * - Coluna sem nenhum valor observado: os ausentes são mantidos e um aviso é
 *   registrado (ou erro, com `onEmptyColumn: 'error'`). Zero/'' nunca são
 *   usados como substitutos implícitos.
 * - `mean`/`median` exigem coluna numérica; usá-los em coluna categórica lança erro.
 * - Valores imputados não são arredondados.
 */
import type {
  CategoricalImputeStrategy,
  ColumnInfo,
  ImputeResult,
  ImputerColumnParams,
  ImputerOptions,
  ImputerParams,
  NumericImputeStrategy,
  Row,
} from '../types/index.js';
import {
  assertRows,
  columnExists,
  isMissing,
  isNumericType,
  NeurixDataError,
  normalizeColumns,
  toNumberOrNull,
} from '../internal/values.js';
import { mean, median, mode } from '../statistics/descriptive.js';
import { inferColumns } from '../profiling/inferColumns.js';

const NUMERIC_STRATEGIES = new Set<string>(['mean', 'median', 'mode', 'constant', 'keep']);
const CATEGORICAL_STRATEGIES = new Set<string>(['mode', 'constant', 'keep']);

function learnColumn(rows: Row[], col: ColumnInfo, opts: ImputerOptions, warnings: string[]): ImputerColumnParams {
  const numeric = isNumericType(col.type);
  const override = opts.perColumn?.[col.name];
  const strategy = override?.strategy ?? (numeric ? opts.numericStrategy ?? 'median' : opts.categoricalStrategy ?? 'mode');
  const allowed = numeric ? NUMERIC_STRATEGIES : CATEGORICAL_STRATEGIES;
  if (!allowed.has(strategy)) {
    throw new NeurixDataError(
      'INCOMPATIBLE_STRATEGY',
      `Imputer: estratégia "${strategy}" incompatível com a coluna ${numeric ? 'numérica' : 'categórica'} "${col.name}".`,
    );
  }
  const base = { name: col.name, numeric, strategy };

  if (rows.length && !columnExists(rows, col.name)) {
    if ((opts.onMissingColumn ?? 'error') === 'error') {
      throw new NeurixDataError('COLUMN_NOT_FOUND', `Imputer: coluna "${col.name}" não existe nas linhas.`);
    }
    warnings.push(`Coluna "${col.name}" não encontrada; ignorada.`);
    return { ...base, fill: null, observed: 0, status: 'missing_column' };
  }
  if (strategy === 'keep') return { ...base, fill: null, observed: 0, status: 'keep' };
  if (strategy === 'constant') {
    const fill = override && 'fillValue' in override ? override.fillValue : opts.fillValue;
    if (fill === undefined) throw new NeurixDataError('MISSING_FILL_VALUE', `Imputer: estratégia "constant" sem fillValue para "${col.name}".`);
    return { ...base, fill, observed: 0, status: 'ok' };
  }

  let fill: unknown;
  let observed: number;
  if (numeric) {
    const vals = rows.map((r) => toNumberOrNull(r[col.name], opts)).filter((v): v is number => v !== null);
    observed = vals.length;
    fill = strategy === 'mean' ? mean(vals) : strategy === 'median' ? median(vals) : mode(vals);
  } else {
    const vals = rows.map((r) => r[col.name]).filter((v) => !isMissing(v));
    observed = vals.length;
    fill = mode(vals);
  }
  if (!observed) {
    if ((opts.onEmptyColumn ?? 'keep') === 'error') {
      throw new NeurixDataError('EMPTY_COLUMN', `Imputer: coluna "${col.name}" não tem valores observados.`);
    }
    warnings.push(`Coluna "${col.name}" sem valores observados; ausentes mantidos.`);
    return { ...base, fill: null, observed: 0, status: 'empty_column' };
  }
  return { ...base, fill, observed, status: 'ok' };
}

/** Transformador de imputação com `fit`/`transform`/`fitTransform`. */
export class Imputer {
  private readonly options: ImputerOptions;
  private params: ImputerParams | null = null;

  constructor(options: ImputerOptions = {}) {
    if (options.numericStrategy && !NUMERIC_STRATEGIES.has(options.numericStrategy)) {
      throw new NeurixDataError('INVALID_STRATEGY', `Imputer: numericStrategy inválida "${options.numericStrategy}".`);
    }
    if (options.categoricalStrategy && !CATEGORICAL_STRATEGIES.has(options.categoricalStrategy)) {
      throw new NeurixDataError('INVALID_STRATEGY', `Imputer: categoricalStrategy inválida "${options.categoricalStrategy}".`);
    }
    this.options = { ...options };
  }

  /** Aprende os valores de preenchimento SOMENTE a partir de `rows`. */
  fit(rows: Row[]): this {
    assertRows(rows, 'Imputer.fit');
    let cols = normalizeColumns(this.options.columns, 'Imputer.fit');
    if (!cols.length) cols = inferColumns(rows, this.options);
    const warnings: string[] = [];
    if (!rows.length) warnings.push('Dataset vazio: nenhum parâmetro aprendido.');
    this.params = {
      kind: 'imputer',
      version: 1,
      fitted_rows: rows.length,
      decimalSeparator: this.options.decimalSeparator ?? 'auto',
      columns: cols.map((c) => learnColumn(rows, c, this.options, warnings)),
      warnings,
    };
    return this;
  }

  /** Preenche ausentes com os parâmetros aprendidos; não modifica a entrada. */
  transform(rows: Row[]): ImputeResult {
    const params = this.getParams();
    assertRows(rows, 'Imputer.transform');
    const byCol: Record<string, number> = {};
    const active = params.columns.filter((c) => c.status === 'ok');
    let filled = 0;
    const out = rows.map((r) => {
      const nr: Row = { ...r };
      for (const c of active) {
        if (isMissing(nr[c.name])) {
          nr[c.name] = c.fill;
          byCol[c.name] = (byCol[c.name] ?? 0) + 1;
          filled++;
        }
      }
      return nr;
    });
    const firstNumeric = params.columns.find((c) => c.numeric);
    return {
      rows: out,
      filled,
      filled_by_column: byCol,
      strategy: String(firstNumeric?.strategy ?? this.options.numericStrategy ?? 'median'),
      skipped: params.columns
        .filter((c) => c.status !== 'ok')
        .map((c) => ({ column: c.name, reason: c.status })),
      params,
    };
  }

  /** `fit(rows)` seguido de `transform(rows)`. */
  fitTransform(rows: Row[]): ImputeResult {
    return this.fit(rows).transform(rows);
  }

  /** Parâmetros aprendidos (cópia serializável). Lança erro se não ajustado. */
  getParams(): ImputerParams {
    if (!this.params) throw new NeurixDataError('NOT_FITTED', 'Imputer: chame fit() antes de transform()/getParams().');
    return JSON.parse(JSON.stringify(this.params)) as ImputerParams;
  }

  /** Recria um Imputer já ajustado a partir de parâmetros persistidos. */
  static fromParams(params: ImputerParams): Imputer {
    if (!params || params.kind !== 'imputer') throw new NeurixDataError('INVALID_PARAMS', 'Imputer.fromParams: parâmetros inválidos.');
    const imp = new Imputer({ decimalSeparator: params.decimalSeparator });
    imp.params = JSON.parse(JSON.stringify(params)) as ImputerParams;
    return imp;
  }
}

/**
 * Atalho compatível com o Neurix: numéricas por `strategy` (`'median'` |
 * `'mean'` | `'mode'`), categóricas por moda. Ajusta e aplica sobre o MESMO
 * conjunto — para treino/teste use `Imputer`. Colunas inexistentes ou vazias
 * são ignoradas e listadas em `skipped`.
 */
export function imputeNulls(
  rows: Row[],
  columnInfo?: ColumnInfo[],
  strategy: Exclude<NumericImputeStrategy, 'constant' | 'keep'> = 'median',
  options: Omit<ImputerOptions, 'columns' | 'numericStrategy'> = {},
): ImputeResult {
  const imp = new Imputer({
    onMissingColumn: 'skip',
    categoricalStrategy: 'mode' as CategoricalImputeStrategy,
    ...options,
    columns: columnInfo,
    numericStrategy: strategy,
  });
  return imp.fitTransform(rows);
}
