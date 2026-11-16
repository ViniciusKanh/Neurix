/**
 * Tipos públicos do @viniciuskanh/neurix-data-tools.
 *
 * Todos os relatórios e parâmetros aprendidos são objetos simples (plain
 * objects), serializáveis com `JSON.stringify` — exceto quando indicado.
 */

/** Uma linha do dataset: objeto com chave = nome da coluna. */
export type Row = Record<string, unknown>;

/**
 * Descrição de uma coluna. `type` aceita os rótulos usados pelo Neurix
 * (`number`, `int`, `float`, `numeric`, `float64`, `int64`, `double`, `integer`)
 * — todos tratados como numéricos. Qualquer outro valor (ex.: `string`) é
 * tratado como categórico.
 */
export interface ColumnInfo {
  name: string;
  type?: string;
}

/** Política de separador decimal ao converter strings em números. */
export type DecimalSeparator = '.' | ',' | 'auto';

/** Opções compartilhadas de conversão numérica estrita. */
export interface NumericParseOptions {
  /**
   * - `'.'`: apenas ponto como separador decimal (`"3.5"`).
   * - `','`: apenas vírgula (`"3,5"`).
   * - `'auto'` (padrão): aceita ponto; aceita vírgula somente quando a string
   *   contém exatamente uma vírgula e nenhum ponto. Separadores de milhar NÃO
   *   são suportados (`"1.234,56"` é inválido).
   */
  decimalSeparator?: DecimalSeparator;
}

/** Resultado de `parseNumber`. */
export type ParsedNumber =
  | { status: 'missing' }
  | { status: 'valid'; value: number }
  | { status: 'invalid'; raw: unknown; reason: string };

// ---------------------------------------------------------------- qualidade

export interface ColumnQuality {
  name: string;
  type: string | undefined;
  numeric: boolean;
  /** Valores ausentes (undefined, null, '', só espaços, NaN). */
  nulls: number;
  /** Percentual de ausentes, 1 casa decimal (compatível com o Neurix). */
  null_pct: number;
  /** Cardinalidade: valores distintos não ausentes (comparação por String). */
  unique: number;
  /** Valores não ausentes que não são números válidos numa coluna numérica. */
  type_mismatch: number;
  /** unique / valores não ausentes (0 quando não há valores). */
  cardinality_ratio: number;
  /** true quando há ≥ 1 valor e todos são iguais. */
  constant: boolean;
  /** true quando toda a coluna está ausente. */
  all_missing: boolean;
}

export type QualityIssueCode =
  | 'missing_values'
  | 'all_missing'
  | 'type_mismatch'
  | 'constant_column'
  | 'high_cardinality'
  | 'duplicate_rows';

export interface QualityIssue {
  code: QualityIssueCode;
  column?: string;
  count: number;
  message: string;
}

export interface QualityReport {
  rows: number;
  columns_count: number;
  columns: ColumnQuality[];
  duplicates: number;
  total_nulls: number;
  /** Nº de colunas com ausentes/erros de tipo (+1 se houver duplicatas). */
  issues: number;
  issue_list: QualityIssue[];
}

export interface DuplicateOptions {
  /**
   * Quando `true` (padrão), todos os marcadores de ausência (undefined, null,
   * '', string só com espaços, NaN) são considerados iguais entre si.
   * Quando `false`, cada marcador é distinto (null ≠ undefined ≠ '').
   */
  treatMissingAsEqual?: boolean;
}

export interface DropDuplicatesResult {
  rows: Row[];
  removed: number;
  /** Índices (na entrada) das linhas removidas. */
  removed_indices: number[];
}

// ---------------------------------------------------------------- conversão

export interface CoerceOptions extends NumericParseOptions {
  /** O que fazer com valores inválidos: manter (padrão) ou trocar por null. */
  onInvalid?: 'keep' | 'null';
}

export interface CoerceResult {
  rows: Row[];
  /** Valores convertidos de string para número. */
  coerced: number;
  /** Valores não ausentes que não puderam ser convertidos. */
  invalid: number;
  invalid_by_column: Record<string, number>;
  /** Até 5 exemplos de valores inválidos por coluna. */
  invalid_samples: Record<string, unknown[]>;
  onInvalid: 'keep' | 'null';
}

// ---------------------------------------------------------------- imputação

export type NumericImputeStrategy = 'mean' | 'median' | 'mode' | 'constant' | 'keep';
export type CategoricalImputeStrategy = 'mode' | 'constant' | 'keep';

export interface ColumnImputeOverride {
  strategy: NumericImputeStrategy | CategoricalImputeStrategy;
  fillValue?: unknown;
}

export interface ImputerOptions extends NumericParseOptions {
  /** Colunas a imputar. Se omitido, inferido a partir das linhas. */
  columns?: ColumnInfo[];
  numericStrategy?: NumericImputeStrategy;
  categoricalStrategy?: CategoricalImputeStrategy;
  /** Valor usado pela estratégia `constant` (quando não há override). */
  fillValue?: unknown;
  /** Estratégia específica por coluna. */
  perColumn?: Record<string, ColumnImputeOverride>;
  /** Coluna sem nenhum valor observado: erro ou manter ausentes (padrão). */
  onEmptyColumn?: 'error' | 'keep';
  /** Coluna inexistente nas linhas: erro (padrão) ou ignorar. */
  onMissingColumn?: 'error' | 'skip';
}

export interface ImputerColumnParams {
  name: string;
  numeric: boolean;
  strategy: NumericImputeStrategy | CategoricalImputeStrategy;
  /** Valor aprendido (ou constante). `null` quando nada será preenchido. */
  fill: unknown;
  /** Nº de valores observados (válidos) usados no ajuste. */
  observed: number;
  status: 'ok' | 'empty_column' | 'missing_column' | 'keep';
}

/** Parâmetros aprendidos por `Imputer.fit` — serializáveis em JSON. */
export interface ImputerParams {
  kind: 'imputer';
  version: 1;
  fitted_rows: number;
  decimalSeparator: DecimalSeparator;
  columns: ImputerColumnParams[];
  warnings: string[];
}

export interface ImputeResult {
  rows: Row[];
  filled: number;
  filled_by_column: Record<string, number>;
  /** Estratégia numérica (rótulo compatível com o Neurix). */
  strategy: string;
  /** Colunas que não foram preenchidas e o motivo. */
  skipped: { column: string; reason: string }[];
  params: ImputerParams;
}

// ---------------------------------------------------------------- features

export interface FeatureResult {
  rows: Row[];
  added: string[];
  report: string;
}

export interface ScalerParams {
  kind: 'scaler';
  version: 1;
  column: string;
  output: string;
  method: 'minmax' | 'zscore';
  /** Graus de liberdade do desvio-padrão (0 = populacional, 1 = amostral). */
  ddof: 0 | 1;
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  observed: number;
  /** true quando a coluna é constante (saída 0 para todo valor válido). */
  constant: boolean;
}

export interface BinnerParams {
  kind: 'binner';
  version: 1;
  column: string;
  output: string;
  method: 'width' | 'quantile';
  requested_bins: number;
  /** Faixas efetivas após remover limites coincidentes. */
  effective_bins: number;
  /** Limites internos estritamente crescentes; faixas fechadas à direita. */
  edges: number[];
  min: number;
  max: number;
  labels: string[];
  outOfRange: 'clip' | 'null';
  warnings: string[];
}

export interface OneHotParams {
  kind: 'onehot';
  version: 1;
  column: string;
  categories: string[];
  outputs: string[];
  handleUnknown: 'ignore' | 'error';
  handleMissing: 'zeros' | 'null';
}

export interface LabelEncoderParams {
  kind: 'label';
  version: 1;
  column: string;
  output: string;
  categories: string[];
  handleUnknown: 'null' | 'error';
}

// ---------------------------------------------------------------- profiling

export type SamplingStrategy = 'systematic' | 'random' | 'head';

export interface ProfileOptions extends NumericParseOptions {
  target?: string;
  task?: string;
  /** Nº de linhas reais incluídas em `sample`. Padrão 0 (privacidade). */
  sampleN?: number;
  /** Máximo de linhas analisadas para as estatísticas. Padrão 5000. */
  statCap?: number;
  sampling?: SamplingStrategy;
  /** Semente para `sampling: 'random'`. Padrão 42. */
  seed?: number;
  /** Nº de categorias mais frequentes reportadas. Padrão 5. */
  topN?: number;
  /** Conta linhas duplicadas (no subconjunto analisado). Padrão false. */
  includeDuplicates?: boolean;
  /** Arredonda estatísticas para N casas. Padrão: sem arredondamento. */
  precision?: number;
  /** Trunca strings da amostra neste comprimento. Padrão 60. */
  maxStringLength?: number;
}

export interface CategoryFrequency {
  value: unknown;
  count: number;
}

export interface ColumnProfile {
  name: string;
  /** Rótulo em português compatível com o Neurix. */
  type: 'numérica' | 'categórica';
  inferred_type: 'numeric' | 'categorical';
  numeric: boolean;
  missing: number;
  null_pct: number;
  unique: number;
  role?: 'alvo';
  valid?: number;
  invalid?: number;
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  /** Desvio-padrão amostral (n − 1); null com < 2 valores. */
  std?: number | null;
  top?: CategoryFrequency[];
  mode?: unknown;
}

export interface DatasetProfile {
  rows: number;
  columns_count: number;
  rows_analyzed: number;
  sampled: boolean;
  sampling: { strategy: SamplingStrategy; cap: number; seed: number | null };
  columns: ColumnProfile[];
  duplicates?: number;
  sample: Row[];
  target: string | null;
  task: string | null;
  warnings: string[];
}

// ---------------------------------------------------------------- correlação

export interface CorrelationOptions extends NumericParseOptions {
  /** Mínimo de pares válidos para calcular r. Padrão 3. */
  minObservations?: number;
  /** Casas decimais de r na matriz. Padrão 3 (compatível); `null` = sem arredondar. */
  precision?: number | null;
}

export interface UndefinedCorrelation {
  a: string;
  b: string;
  reason: 'constant' | 'insufficient_observations';
  n: number;
}

export interface CorrelationResult {
  error?: false;
  method: 'pearson';
  missing: 'pairwise';
  columns: string[];
  /** r de Pearson; `null` quando indefinido (ver `undefined_pairs`). */
  matrix: (number | null)[][];
  /** Nº de observações pareadas válidas em cada célula. */
  n_matrix: number[][];
  high_pairs: { a: string; b: string; r: number; n: number }[];
  undefined_pairs: UndefinedCorrelation[];
  threshold: number;
}

export interface CorrelationError {
  error: true;
  message: string;
}

export interface PearsonResult {
  r: number | null;
  n: number;
  reason?: 'constant' | 'insufficient_observations';
}

// ---------------------------------------------------------------- leakage

export type LeakageSignal =
  | 'near_copy'
  | 'high_correlation'
  | 'category_purity'
  | 'categorical_association'
  | 'threshold_separation';

export interface LeakageSuspect {
  feature: string;
  signal: LeakageSignal;
  /** Texto em português (compatível com o Neurix). */
  reason: string;
  severity: 'alto' | 'médio';
  metrics: Record<string, number>;
}

export interface LeakageOptions {
  maxRows?: number;
  copyThreshold?: number;
  correlationThreshold?: number;
  purityThreshold?: number;
  separationThreshold?: number;
  etaSquaredThreshold?: number;
}

export interface LeakageReport {
  /** Mantido por compatibilidade: true quando há ao menos um suspeito. */
  has_leak: boolean;
  has_suspects: boolean;
  leaks: LeakageSuspect[];
  analyzed_rows: number;
  target_kind: 'numeric' | 'categorical';
  heuristic: true;
  disclaimer: string;
}
