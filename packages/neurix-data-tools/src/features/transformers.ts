/**
 * Transformadores de atributos com `fit` / `transform` / `fitTransform`.
 *
 * Todos seguem o mesmo contrato:
 * - `fit(rows)` aprende parâmetros APENAS de `rows` (ex.: conjunto de treino);
 * - `transform(rows)` aplica os parâmetros aprendidos, sem reajustar;
 * - `getParams()` devolve um objeto JSON serializável;
 * - `Classe.fromParams(params)` reconstrói o transformador ajustado.
 * Nenhum método modifica as linhas de entrada.
 */
import type {
  BinnerParams,
  LabelEncoderParams,
  NumericParseOptions,
  OneHotParams,
  Row,
  ScalerParams,
} from '../types/index.js';
import { assertRows, compareStrings, isMissing, NeurixDataError, toNumberOrNull } from '../internal/values.js';
import { max, mean, min, quantile, std } from '../statistics/descriptive.js';

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function requireColumn(column: unknown, who: string): string {
  if (typeof column !== 'string' || !column) throw new NeurixDataError('INVALID_COLUMN', `${who}: "column" deve ser uma string não vazia.`);
  return column;
}

function numericValues(rows: Row[], column: string, opts: NumericParseOptions): number[] {
  const out: number[] = [];
  for (const r of rows) {
    const v = toNumberOrNull(r[column], opts);
    if (v !== null) out.push(v);
  }
  return out;
}

abstract class BaseTransformer<P> {
  protected params: P | null = null;
  abstract fit(rows: Row[]): this;
  abstract transform(rows: Row[]): Row[];
  fitTransform(rows: Row[]): Row[] {
    return this.fit(rows).transform(rows);
  }
  /** Parâmetros aprendidos (cópia). Lança `NOT_FITTED` se não ajustado. */
  getParams(): P {
    if (!this.params) throw new NeurixDataError('NOT_FITTED', `${this.constructor.name}: chame fit() antes.`);
    return clone(this.params);
  }
  protected fitted(): P {
    if (!this.params) throw new NeurixDataError('NOT_FITTED', `${this.constructor.name}: chame fit() antes de transform().`);
    return this.params;
  }
}

// ------------------------------------------------------------------ Scaler

export interface ScalerOptions extends NumericParseOptions {
  column: string;
  method?: 'minmax' | 'zscore';
  /** Nome da coluna de saída. Padrão `${column}_norm`. */
  output?: string;
  /** Desvio-padrão: 0 = populacional (padrão, como scikit-learn), 1 = amostral. */
  ddof?: 0 | 1;
}

/**
 * Escalonamento Min-Max ([0, 1] no treino) ou Z-score.
 * Coluna constante → saída 0 para todo valor válido (`constant: true`).
 * Ausentes/inválidos → `null`. Valores fora do intervalo de treino NÃO são
 * cortados no Min-Max (podem ficar < 0 ou > 1).
 */
export class Scaler extends BaseTransformer<ScalerParams> {
  private readonly opts: ScalerOptions;
  constructor(options: ScalerOptions) {
    super();
    requireColumn(options?.column, 'Scaler');
    const method = options.method ?? 'zscore';
    if (method !== 'minmax' && method !== 'zscore') throw new NeurixDataError('INVALID_METHOD', `Scaler: método inválido "${String(method)}".`);
    if (options.ddof !== undefined && options.ddof !== 0 && options.ddof !== 1) throw new NeurixDataError('INVALID_DDOF', 'Scaler: ddof deve ser 0 ou 1.');
    this.opts = { ...options, method };
  }

  fit(rows: Row[]): this {
    assertRows(rows, 'Scaler.fit');
    const { column } = this.opts;
    const vals = numericValues(rows, column, this.opts);
    if (!vals.length) throw new NeurixDataError('EMPTY_COLUMN', `Scaler: coluna "${column}" sem valores numéricos válidos.`);
    const ddof = this.opts.ddof ?? 0;
    const base = { kind: 'scaler' as const, version: 1 as const, column, output: this.opts.output ?? `${column}_norm`, method: this.opts.method!, ddof, observed: vals.length };
    if (this.opts.method === 'minmax') {
      const mn = min(vals)!;
      const mx = max(vals)!;
      this.params = { ...base, min: mn, max: mx, constant: mx === mn };
    } else {
      const m = mean(vals)!;
      const sd = vals.length - ddof > 0 ? std(vals, ddof)! : 0;
      this.params = { ...base, mean: m, std: sd, constant: !(sd > 0) };
    }
    return this;
  }

  /** Aplica a fórmula aprendida a um único valor (null se ausente/inválido). */
  scaleValue(v: unknown): number | null {
    const p = this.fitted();
    const x = toNumberOrNull(v, this.opts);
    if (x === null) return null;
    if (p.constant) return 0;
    return p.method === 'minmax' ? (x - p.min!) / (p.max! - p.min!) : (x - p.mean!) / p.std!;
  }

  transform(rows: Row[]): Row[] {
    const p = this.fitted();
    assertRows(rows, 'Scaler.transform');
    return rows.map((r) => ({ ...r, [p.output]: this.scaleValue(r[p.column]) }));
  }

  static fromParams(params: ScalerParams): Scaler {
    if (params?.kind !== 'scaler') throw new NeurixDataError('INVALID_PARAMS', 'Scaler.fromParams: parâmetros inválidos.');
    const s = new Scaler({ column: params.column, method: params.method, output: params.output, ddof: params.ddof });
    s.params = clone(params);
    return s;
  }
}

// ------------------------------------------------------------------ Binner

export interface BinnerOptions extends NumericParseOptions {
  column: string;
  /** Número de faixas desejado (inteiro ≥ 1). Padrão 4. */
  bins?: number;
  /** `width` (larguras iguais) ou `quantile` (frequências ~iguais). `freq` = `quantile`. */
  method?: 'width' | 'quantile' | 'freq';
  /** Nome da coluna de saída. Padrão `${column}_faixa`. */
  output?: string;
  /** Valores fora de [min, max] do treino: atribui à faixa extrema (`clip`, padrão) ou `null`. */
  outOfRange?: 'clip' | 'null';
}

/**
 * Discretização em faixas `faixa_1 … faixa_k`, fechadas à direita:
 * (−∞, e1], (e1, e2], …, (e_{k−1}, +∞).
 * Limites coincidentes (comuns em quantis com valores repetidos) são
 * removidos — o número efetivo de faixas pode ser menor que o pedido, e
 * isso é registrado em `warnings`/`effective_bins`.
 */
export class Binner extends BaseTransformer<BinnerParams> {
  private readonly opts: BinnerOptions;
  constructor(options: BinnerOptions) {
    super();
    requireColumn(options?.column, 'Binner');
    const bins = options.bins ?? 4;
    if (!Number.isInteger(bins) || bins < 1) throw new NeurixDataError('INVALID_BINS', `Binner: bins deve ser inteiro ≥ 1 (recebido ${String(bins)}).`);
    const method = options.method ?? 'width';
    if (!['width', 'quantile', 'freq'].includes(method)) throw new NeurixDataError('INVALID_METHOD', `Binner: método inválido "${String(method)}".`);
    this.opts = { ...options, bins, method };
  }

  fit(rows: Row[]): this {
    assertRows(rows, 'Binner.fit');
    const { column } = this.opts;
    const k = this.opts.bins!;
    const method = this.opts.method === 'width' ? 'width' : 'quantile';
    const vals = numericValues(rows, column, this.opts);
    if (!vals.length) throw new NeurixDataError('EMPTY_COLUMN', `Binner: coluna "${column}" sem valores numéricos válidos.`);
    const mn = min(vals)!;
    const mx = max(vals)!;
    const warnings: string[] = [];
    let raw: number[] = [];
    if (method === 'width') {
      const step = (mx - mn) / k;
      for (let i = 1; i < k; i++) raw.push(mn + i * step);
    } else {
      for (let i = 1; i < k; i++) raw.push(quantile(vals, i / k)!);
    }
    // Remove limites duplicados e limites iguais ao máximo (faixas vazias).
    const edges = [...new Set(raw)].sort((a, b) => a - b).filter((e) => e < mx);
    raw = edges;
    if (mn === mx) warnings.push(`Coluna "${column}" é constante: uma única faixa.`);
    else if (edges.length + 1 < k) warnings.push(`Limites coincidentes: ${edges.length + 1} faixa(s) efetiva(s) em vez de ${k}.`);
    const labels = Array.from({ length: edges.length + 1 }, (_, i) => `faixa_${i + 1}`);
    this.params = {
      kind: 'binner',
      version: 1,
      column,
      output: this.opts.output ?? `${column}_faixa`,
      method,
      requested_bins: k,
      effective_bins: labels.length,
      edges,
      min: mn,
      max: mx,
      labels,
      outOfRange: this.opts.outOfRange ?? 'clip',
      warnings,
    };
    return this;
  }

  /** Rótulo da faixa de um valor (null se ausente/inválido ou fora do intervalo com `outOfRange: 'null'`). */
  binValue(v: unknown): string | null {
    const p = this.fitted();
    const x = toNumberOrNull(v, this.opts);
    if (x === null) return null;
    if (p.outOfRange === 'null' && (x < p.min || x > p.max)) return null;
    let b = 0;
    while (b < p.edges.length && x > p.edges[b]!) b++;
    return p.labels[b]!;
  }

  transform(rows: Row[]): Row[] {
    const p = this.fitted();
    assertRows(rows, 'Binner.transform');
    return rows.map((r) => ({ ...r, [p.output]: this.binValue(r[p.column]) }));
  }

  static fromParams(params: BinnerParams): Binner {
    if (params?.kind !== 'binner') throw new NeurixDataError('INVALID_PARAMS', 'Binner.fromParams: parâmetros inválidos.');
    const b = new Binner({ column: params.column, bins: params.requested_bins, method: params.method, output: params.output, outOfRange: params.outOfRange });
    b.params = clone(params);
    return b;
  }
}

// ------------------------------------------------------------------ One-hot

export interface OneHotOptions {
  column: string;
  /** Mantém só as `topK` categorias mais frequentes no treino. */
  topK?: number;
  /** Categoria desconhecida no transform: zeros (`ignore`, padrão) ou erro. */
  handleUnknown?: 'ignore' | 'error';
  /** Valor ausente: zeros em todas as colunas (padrão) ou `null`. */
  handleMissing?: 'zeros' | 'null';
}

/**
 * One-hot encoding. Categorias = `String(valor)`; ordem determinística por
 * frequência decrescente e, no empate, lexicográfica. Colunas de saída
 * `${column}=${categoria}`. Categorias fora do `topK` são tratadas como
 * desconhecidas.
 */
export class OneHotEncoder extends BaseTransformer<OneHotParams> {
  private readonly opts: OneHotOptions;
  constructor(options: OneHotOptions) {
    super();
    requireColumn(options?.column, 'OneHotEncoder');
    if (options.topK !== undefined && !(Number.isInteger(options.topK) && options.topK >= 1)) {
      throw new NeurixDataError('INVALID_TOPK', 'OneHotEncoder: topK deve ser inteiro ≥ 1.');
    }
    this.opts = { ...options };
  }

  fit(rows: Row[]): this {
    assertRows(rows, 'OneHotEncoder.fit');
    const { column } = this.opts;
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = r[column];
      if (isMissing(v)) continue;
      const k = String(v);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const cats = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || compareStrings(a[0], b[0]))
      .slice(0, this.opts.topK ?? Infinity)
      .map(([k]) => k);
    this.params = {
      kind: 'onehot',
      version: 1,
      column,
      categories: cats,
      outputs: cats.map((c) => `${column}=${c}`),
      handleUnknown: this.opts.handleUnknown ?? 'ignore',
      handleMissing: this.opts.handleMissing ?? 'zeros',
    };
    return this;
  }

  transform(rows: Row[]): Row[] {
    const p = this.fitted();
    assertRows(rows, 'OneHotEncoder.transform');
    const known = new Set(p.categories);
    return rows.map((r, i) => {
      const nr: Row = { ...r };
      const v = r[p.column];
      if (isMissing(v)) {
        p.outputs.forEach((o) => { nr[o] = p.handleMissing === 'null' ? null : 0; });
        return nr;
      }
      const s = String(v);
      if (!known.has(s) && p.handleUnknown === 'error') {
        throw new NeurixDataError('UNKNOWN_CATEGORY', `OneHotEncoder: categoria desconhecida "${s}" na linha ${i}.`);
      }
      p.categories.forEach((c, j) => { nr[p.outputs[j]!] = s === c ? 1 : 0; });
      return nr;
    });
  }

  static fromParams(params: OneHotParams): OneHotEncoder {
    if (params?.kind !== 'onehot') throw new NeurixDataError('INVALID_PARAMS', 'OneHotEncoder.fromParams: parâmetros inválidos.');
    const e = new OneHotEncoder({ column: params.column, handleUnknown: params.handleUnknown, handleMissing: params.handleMissing });
    e.params = clone(params);
    return e;
  }
}

// ------------------------------------------------------------------ Label

export interface LabelEncoderOptions {
  column: string;
  /** Nome da coluna de saída. Padrão `${column}_cod`. */
  output?: string;
  /** Categoria desconhecida no transform: `null` (padrão) ou erro. */
  handleUnknown?: 'null' | 'error';
}

/**
 * Label encoding: categorias em ordem lexicográfica (code units, sem
 * dependência de locale) → 0…k−1. Ausentes → `null`.
 *
 * Atenção: os códigos são NOMINAIS. Modelos lineares/baseados em distância
 * interpretariam uma ordem inexistente; prefira one-hot nesses casos.
 */
export class LabelEncoder extends BaseTransformer<LabelEncoderParams> {
  private readonly opts: LabelEncoderOptions;
  constructor(options: LabelEncoderOptions) {
    super();
    requireColumn(options?.column, 'LabelEncoder');
    this.opts = { ...options };
  }

  fit(rows: Row[]): this {
    assertRows(rows, 'LabelEncoder.fit');
    const { column } = this.opts;
    const set = new Set<string>();
    for (const r of rows) if (!isMissing(r[column])) set.add(String(r[column]));
    this.params = {
      kind: 'label',
      version: 1,
      column,
      output: this.opts.output ?? `${column}_cod`,
      categories: [...set].sort(compareStrings),
      handleUnknown: this.opts.handleUnknown ?? 'null',
    };
    return this;
  }

  transform(rows: Row[]): Row[] {
    const p = this.fitted();
    assertRows(rows, 'LabelEncoder.transform');
    const map = new Map(p.categories.map((c, i) => [c, i]));
    return rows.map((r, i) => {
      const v = r[p.column];
      if (isMissing(v)) return { ...r, [p.output]: null };
      const code = map.get(String(v));
      if (code === undefined && p.handleUnknown === 'error') {
        throw new NeurixDataError('UNKNOWN_CATEGORY', `LabelEncoder: categoria desconhecida "${String(v)}" na linha ${i}.`);
      }
      return { ...r, [p.output]: code ?? null };
    });
  }

  static fromParams(params: LabelEncoderParams): LabelEncoder {
    if (params?.kind !== 'label') throw new NeurixDataError('INVALID_PARAMS', 'LabelEncoder.fromParams: parâmetros inválidos.');
    const e = new LabelEncoder({ column: params.column, output: params.output, handleUnknown: params.handleUnknown });
    e.params = clone(params);
    return e;
  }
}
