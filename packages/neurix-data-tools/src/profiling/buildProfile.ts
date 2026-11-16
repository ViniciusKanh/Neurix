/**
 * Perfilamento estatístico local de um dataset. Nada é enviado a servidores.
 *
 * Amostragem (quando há mais linhas que `statCap`):
 * - `systematic` (padrão): uma linha a cada ⌈n / cap⌉ — determinística;
 * - `random`: amostra aleatória simples sem reposição, com `seed`;
 * - `head`: as primeiras `cap` linhas (rápido, mas enviesado se o arquivo
 *   estiver ordenado).
 * Estatísticas calculadas sobre amostra são ESTIMATIVAS: mínimo/máximo podem
 * não ser os globais, a cardinalidade tende a ser subestimada e categorias
 * raras podem não aparecer. `sampled` e `rows_analyzed` indicam isso.
 *
 * Privacidade: `sampleN` padrão é 0 — nenhuma linha real entra no relatório
 * a menos que seja pedido explicitamente.
 */
import type { ColumnInfo, ColumnProfile, DatasetProfile, ProfileOptions, Row, SamplingStrategy } from '../types/index.js';
import { assertRows, isMissing, isNumericType, mulberry32, NeurixDataError, normalizeColumns, parseNumber, roundTo } from '../internal/values.js';
import { frequencies, max, mean, median, min, mode, std } from '../statistics/descriptive.js';
import { inferColumns } from './inferColumns.js';
import { countDuplicates } from '../quality/duplicates.js';

function trimVal(v: unknown, maxLen: number): unknown {
  return typeof v === 'string' && v.length > maxLen ? v.slice(0, maxLen) + '…' : v;
}

/** Seleciona as linhas analisadas conforme a estratégia (ordem original preservada). */
export function sampleRows(rows: Row[], cap: number, strategy: SamplingStrategy = 'systematic', seed = 42): Row[] {
  if (!Number.isInteger(cap) || cap < 1) throw new NeurixDataError('INVALID_CAP', 'sampleRows: cap deve ser inteiro ≥ 1.');
  if (rows.length <= cap) return rows;
  if (strategy === 'head') return rows.slice(0, cap);
  if (strategy === 'systematic') {
    const step = Math.ceil(rows.length / cap);
    return rows.filter((_, i) => i % step === 0);
  }
  if (strategy === 'random') {
    // Fisher–Yates parcial sobre os índices, depois reordena.
    const rnd = mulberry32(seed);
    const idx = rows.map((_, i) => i);
    for (let i = 0; i < cap; i++) {
      const j = i + Math.floor(rnd() * (idx.length - i));
      [idx[i], idx[j]] = [idx[j]!, idx[i]!];
    }
    return idx.slice(0, cap).sort((a, b) => a - b).map((i) => rows[i]!);
  }
  throw new NeurixDataError('INVALID_SAMPLING', `sampleRows: estratégia inválida "${String(strategy)}".`);
}

/**
 * Constrói o perfil: tipos, ausentes, cardinalidade, estatísticas numéricas
 * (mín., máx., média, mediana, desvio-padrão AMOSTRAL n−1, válidos e
 * inválidos) e categóricas (moda, frequências top-N).
 */
export function buildProfile(rows: Row[], columnInfo?: ColumnInfo[], options: ProfileOptions = {}): DatasetProfile {
  assertRows(rows, 'buildProfile');
  const given = normalizeColumns(columnInfo, 'buildProfile');
  const cols: ColumnInfo[] = given.length ? given : inferColumns(rows, options);
  const cap = options.statCap ?? 5000;
  const strategy = options.sampling ?? 'systematic';
  const seed = options.seed ?? 42;
  const topN = options.topN ?? 5;
  const sampleN = options.sampleN ?? 0;
  const maxLen = options.maxStringLength ?? 60;
  const p = options.precision;
  const r = (v: number) => roundTo(v, p);
  if (!Number.isInteger(sampleN) || sampleN < 0) throw new NeurixDataError('INVALID_SAMPLE_N', 'buildProfile: sampleN deve ser inteiro ≥ 0.');

  const scan = sampleRows(rows, cap, strategy, seed);
  const n = scan.length;
  const warnings: string[] = [];
  if (!rows.length) warnings.push('Dataset vazio: estatísticas indisponíveis.');
  if (n < rows.length) warnings.push(`Estatísticas estimadas a partir de ${n} de ${rows.length} linhas (${strategy}).`);

  const columns: ColumnProfile[] = cols.map((c) => {
    const numeric = isNumericType(c.type);
    const present: unknown[] = [];
    for (const row of scan) if (!isMissing(row[c.name])) present.push(row[c.name]);
    const missing = n - present.length;
    const freqs = frequencies(present);
    const base: ColumnProfile = {
      name: c.name,
      type: numeric ? 'numérica' : 'categórica',
      inferred_type: numeric ? 'numeric' : 'categorical',
      numeric,
      missing,
      null_pct: n ? r((missing / n) * 100) : 0,
      unique: freqs.length,
      ...(options.target && c.name === options.target ? { role: 'alvo' as const } : {}),
    };
    if (numeric) {
      const vals: number[] = [];
      let invalid = 0;
      for (const v of present) {
        const pn = parseNumber(v, options);
        if (pn.status === 'valid') vals.push(pn.value);
        else invalid++;
      }
      base.valid = vals.length;
      base.invalid = invalid;
      if (vals.length) {
        base.min = r(min(vals)!);
        base.max = r(max(vals)!);
        base.mean = r(mean(vals)!);
        base.median = r(median(vals)!);
        const sd = std(vals, 1);
        base.std = sd === null ? null : r(sd);
      }
    } else {
      base.top = freqs.slice(0, topN).map((f) => ({ value: trimVal(f.value, maxLen), count: f.count }));
      base.mode = present.length ? trimVal(mode(present), maxLen) : undefined;
    }
    return base;
  });

  const sample = rows.slice(0, sampleN).map((row) => {
    const o: Row = {};
    for (const c of cols) o[c.name] = trimVal(row[c.name], maxLen);
    return o;
  });

  return {
    rows: rows.length,
    columns_count: cols.length,
    rows_analyzed: n,
    sampled: n < rows.length,
    sampling: { strategy, cap, seed: strategy === 'random' ? seed : null },
    columns,
    ...(options.includeDuplicates ? { duplicates: countDuplicates(scan, cols) } : {}),
    sample,
    target: options.target || null,
    task: options.task || null,
    warnings,
  };
}
