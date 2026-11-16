/**
 * Diagnóstico HEURÍSTICO de possível vazamento de alvo (target leakage).
 *
 * Os sinais abaixo indicam que um atributo "prevê bem demais" o alvo.
 * Nenhum deles comprova vazamento: um atributo legítimo e muito informativo
 * também os produz. A confirmação depende do contexto temporal (o atributo
 * existe no momento da predição?), causal e do processo de coleta.
 *
 * Sinais:
 * - `near_copy`: ≥ copyThreshold dos pares válidos têm valor idêntico ao alvo.
 * - `high_correlation` (alvo numérico × atributo numérico): |r de Pearson| alto.
 * - `categorical_association` (alvo numérico × atributo categórico):
 *   razão de correlação η² (variância explicada pelas categorias) alta.
 * - `category_purity` (alvo categórico × atributo categórico): cada categoria
 *   do atributo corresponde quase sempre a uma única classe.
 * - `threshold_separation` (alvo binário × atributo numérico): um único
 *   limiar separa as classes quase perfeitamente.
 */
import type { ColumnInfo, LeakageOptions, LeakageReport, LeakageSuspect, Row } from '../types/index.js';
import { assertRows, isMissing, isNumericType, normalizeColumns, toNumberOrNull } from '../internal/values.js';
import { pearson } from '../statistics/correlation.js';

const DISCLAIMER =
  'Diagnóstico heurístico: os sinais indicam associação muito forte com o alvo, não comprovam vazamento. ' +
  'Confirme se o atributo estaria disponível no momento da predição e como foi coletado.';

/** Amostragem sistemática determinística (a cada k-ésima linha). */
function systematic<T>(rows: T[], cap: number): T[] {
  if (rows.length <= cap) return rows;
  const step = Math.ceil(rows.length / cap);
  return rows.filter((_, i) => i % step === 0);
}

/**
 * Executa as heurísticas de vazamento.
 *
 * @param task `'regression'` trata o alvo como numérico; `'classification'`
 *   como categórico (mesmo que seja 0/1). Sem `task`, usa o tipo da coluna-alvo.
 */
export function detectTargetLeakage(
  rows: Row[],
  targetColumn: string,
  columnInfo: ColumnInfo[],
  task?: string,
  options: LeakageOptions = {},
): LeakageReport {
  assertRows(rows, 'detectTargetLeakage');
  const all = normalizeColumns(columnInfo, 'detectTargetLeakage');
  const targetIsNum = task ? task === 'regression' : !!all.find((c) => c.name === targetColumn && isNumericType(c.type));
  const base = {
    analyzed_rows: 0,
    target_kind: (targetIsNum ? 'numeric' : 'categorical') as 'numeric' | 'categorical',
    heuristic: true as const,
    disclaimer: DISCLAIMER,
  };
  if (!rows.length || !targetColumn) return { has_leak: false, has_suspects: false, leaks: [], ...base };

  const copyT = options.copyThreshold ?? 0.99;
  const corrT = options.correlationThreshold ?? 0.98;
  const purityT = options.purityThreshold ?? 0.99;
  const sepT = options.separationThreshold ?? 0.99;
  const etaT = options.etaSquaredThreshold ?? 0.96;

  const sample = systematic(rows, options.maxRows ?? 3000);
  const target = sample.map((r) => r[targetColumn]);
  const targetNum = targetIsNum ? target.map((v) => toNumberOrNull(v)) : [];
  const leaks: LeakageSuspect[] = [];

  for (const c of all) {
    if (c.name === targetColumn) continue;
    const vals = sample.map((r) => r[c.name]);
    const featNumeric = isNumericType(c.type);

    // 1) Cópia (quase) exata do alvo — comparação textual.
    let same = 0;
    let valid = 0;
    for (let i = 0; i < sample.length; i++) {
      if (isMissing(vals[i]) || isMissing(target[i])) continue;
      valid++;
      if (String(vals[i]) === String(target[i])) same++;
    }
    if (valid > 0 && same / valid >= copyT) {
      leaks.push({
        feature: c.name,
        signal: 'near_copy',
        reason: `É praticamente uma cópia da coluna-alvo (${((same / valid) * 100).toFixed(1)}% dos valores idênticos).`,
        severity: 'alto',
        metrics: { identical_ratio: same / valid, n: valid },
      });
      continue;
    }

    if (targetIsNum && featNumeric) {
      // 2) Correlação linear excepcionalmente alta.
      const res = pearson(vals.map((v) => toNumberOrNull(v)), targetNum, 6);
      if (res.r !== null && Math.abs(res.r) >= corrT) {
        leaks.push({
          feature: c.name,
          signal: 'high_correlation',
          reason: `Correlação quase perfeita com o alvo (r = ${res.r.toFixed(3)}).`,
          severity: 'alto',
          metrics: { r: res.r, n: res.n },
        });
      }
    } else if (targetIsNum && !featNumeric) {
      // 3) η²: fração da variância do alvo explicada pelas categorias.
      const groups = new Map<string, number[]>();
      const ys: number[] = [];
      for (let i = 0; i < sample.length; i++) {
        const y = targetNum[i];
        if (isMissing(vals[i]) || y === null || y === undefined) continue;
        const k = String(vals[i]);
        if (!groups.has(k)) groups.set(k, []);
        groups.get(k)!.push(y);
        ys.push(y);
      }
      const n = ys.length;
      // Exclui atributos com cara de identificador (categorias ≥ metade das linhas).
      if (n > 5 && groups.size > 1 && groups.size < 0.5 * n) {
        const m = ys.reduce((s, v) => s + v, 0) / n;
        let ssTot = 0;
        for (const y of ys) ssTot += (y - m) ** 2;
        let ssBetween = 0;
        for (const g of groups.values()) {
          const gm = g.reduce((s, v) => s + v, 0) / g.length;
          ssBetween += g.length * (gm - m) ** 2;
        }
        if (ssTot > 0) {
          const eta2 = ssBetween / ssTot;
          if (eta2 >= etaT) {
            leaks.push({
              feature: c.name,
              signal: 'categorical_association',
              reason: `As categorias explicam ${(eta2 * 100).toFixed(1)}% da variância do alvo (η²).`,
              severity: 'alto',
              metrics: { eta_squared: eta2, categories: groups.size, n },
            });
          }
        }
      }
    } else if (!featNumeric) {
      // 4) Pureza: cada categoria → uma única classe.
      const map = new Map<string, Map<string, number>>();
      let n = 0;
      for (let i = 0; i < sample.length; i++) {
        if (isMissing(vals[i]) || isMissing(target[i])) continue;
        const k = String(vals[i]);
        const t = String(target[i]);
        if (!map.has(k)) map.set(k, new Map());
        const inner = map.get(k)!;
        inner.set(t, (inner.get(t) ?? 0) + 1);
        n++;
      }
      if (n > 0 && map.size > 1 && map.size < 0.5 * n) {
        let pure = 0;
        for (const inner of map.values()) pure += Math.max(...inner.values());
        const purity = pure / n;
        if (purity >= purityT) {
          leaks.push({
            feature: c.name,
            signal: 'category_purity',
            reason: `Cada categoria corresponde a uma única classe do alvo (pureza ${(purity * 100).toFixed(1)}%).`,
            severity: 'alto',
            metrics: { purity, categories: map.size, n },
          });
        }
      }
    } else {
      // 5) Limiar único separando duas classes.
      const classes = [...new Set(target.filter((v) => !isMissing(v)).map(String))].sort();
      if (classes.length === 2) {
        const pts: [number, number][] = [];
        for (let i = 0; i < sample.length; i++) {
          const x = toNumberOrNull(vals[i]);
          if (x === null || isMissing(target[i])) continue;
          pts.push([x, String(target[i]) === classes[1] ? 1 : 0]);
        }
        if (pts.length > 10) {
          pts.sort((a, b) => a[0] - b[0]);
          const P = pts.filter((p) => p[1] === 1).length;
          const N = pts.length - P;
          let leftPos = 0;
          let leftNeg = 0;
          let best = 0;
          // Só avalia cortes entre valores distintos (um limiar real).
          for (let i = 0; i < pts.length - 1; i++) {
            if (pts[i]![1] === 1) leftPos++;
            else leftNeg++;
            if (pts[i]![0] === pts[i + 1]![0]) continue;
            const acc = Math.max(leftNeg + (P - leftPos), leftPos + (N - leftNeg)) / pts.length;
            if (acc > best) best = acc;
          }
          if (best >= sepT) {
            leaks.push({
              feature: c.name,
              signal: 'threshold_separation',
              reason: `Um único limiar separa as classes com ${(best * 100).toFixed(1)}% de acerto.`,
              severity: 'médio',
              metrics: { accuracy: best, n: pts.length },
            });
          }
        }
      }
    }
  }
  return { has_leak: leaks.length > 0, has_suspects: leaks.length > 0, leaks, ...base, analyzed_rows: sample.length };
}
