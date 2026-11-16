/**
 * Testes estatísticos contra valores de referência calculados de forma
 * independente (à mão / NumPy / R), com tolerâncias explícitas.
 */
import { describe, expect, it } from 'vitest';
import {
  buildProfile,
  correlationMatrix,
  frequencies,
  max,
  mean,
  median,
  min,
  mode,
  pearson,
  quantile,
  std,
  sum,
  variance,
  type CorrelationResult,
} from '../src/index.js';
import { deepFreeze, lcg } from './helpers.js';

describe('estatística descritiva', () => {
  const v = [2, 4, 4, 4, 5, 5, 7, 9]; // exemplo clássico: σ populacional = 2

  it('média, mediana, variância e desvio-padrão conhecidos', () => {
    expect(mean(v)).toBe(5);
    expect(median(v)).toBe(4.5);
    expect(variance(v, 0)).toBe(4);
    expect(std(v, 0)).toBe(2);
    expect(variance(v, 1)).toBeCloseTo(32 / 7, 12);
    expect(median([3, 1, 2])).toBe(2);
  });

  it('números negativos', () => {
    const n = [-5, -1, 0, 3];
    expect(mean(n)).toBe(-0.75);
    expect(median(n)).toBe(-0.5);
    expect(min(n)).toBe(-5);
    expect(max(n)).toBe(3);
  });

  it('quantil tipo 7 (NumPy/R): quantile([1..10], 0.25) = 3.25', () => {
    const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(quantile(a, 0.25)).toBeCloseTo(3.25, 12);
    expect(quantile(a, 0.9)).toBeCloseTo(9.1, 12);
    expect(() => quantile(a, 2)).toThrow();
  });

  it('vazio → null; um único valor', () => {
    expect([mean([]), median([]), min([]), max([]), variance([]), std([1], 1)]).toEqual([null, null, null, null, null, null]);
    expect(std([7], 0)).toBe(0);
    expect(mode([])).toBeUndefined();
  });

  it('soma compensada e arrays grandes sem estouro de pilha', () => {
    expect(sum([0.1, 0.2, 0.3])).toBeCloseTo(0.6, 15);
    const big = Array.from({ length: 300_000 }, (_, i) => i);
    expect(max(big)).toBe(299_999);
    expect(min(big)).toBe(0);
  });

  it('moda e frequências determinísticas', () => {
    expect(mode(['b', 'a', 'a', 'b'])).toBe('b'); // empate → primeira ocorrência
    expect(mode([1, '1', 1])).toBe(1);
    expect(frequencies(['b', 'a', 'a', 'b', 'c'])).toEqual([
      { value: 'a', count: 2 },
      { value: 'b', count: 2 },
      { value: 'c', count: 1 },
    ]);
  });
});

describe('Pearson', () => {
  it('+1 e −1 exatos', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8]).r).toBeCloseTo(1, 12);
    expect(pearson([1, 2, 3, 4], [8, 6, 4, 2]).r).toBeCloseTo(-1, 12);
  });

  it('valor de referência (NumPy corrcoef) com tolerância', () => {
    // np.corrcoef([1,2,3,4,5],[2,1,4,3,5])[0,1] = 0.8
    expect(pearson([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]).r).toBeCloseTo(0.8, 12);
  });

  it('variância nula → null com motivo, nunca 0', () => {
    expect(pearson([1, 1, 1], [1, 2, 3])).toEqual({ r: null, n: 3, reason: 'constant' });
    expect(pearson([0.1, 0.1, 0.1, 0.1], [1, 2, 3, 4]).r).toBeNull();
  });

  it('observações insuficientes e ausentes pareados', () => {
    expect(pearson([1, 2], [3, 4])).toMatchObject({ r: null, reason: 'insufficient_observations' });
    expect(pearson([1, null, 3, 4, 5], [2, 9, 6, 8, null]).n).toBe(3);
  });
});

describe('correlationMatrix', () => {
  const ci = [
    { name: 'p', type: 'number' },
    { name: 'q', type: 'number' },
    { name: 'k', type: 'number' },
    { name: 'z', type: 'number' },
  ];
  const rows = deepFreeze([
    { p: 1, q: 2, k: 5, z: null },
    { p: 2, q: 4, k: 5, z: 1 },
    { p: 3, q: 6, k: 5, z: null },
    { p: 4, q: 8, k: 5, z: 2 },
  ]);

  it('indefinidos identificados, diagonal coerente e contagens', () => {
    const c = correlationMatrix(rows, ci) as CorrelationResult;
    expect(c.error).toBeFalsy();
    expect(c.matrix[0]![1]).toBe(1);
    expect(c.matrix[0]![2]).toBeNull(); // k constante
    expect(c.matrix[2]![2]).toBeNull(); // diagonal de constante é indefinida
    expect(c.matrix[0]![3]).toBeNull(); // z: só 2 pares
    expect(c.n_matrix[0]![3]).toBe(2);
    expect(c.high_pairs).toEqual([{ a: 'p', b: 'q', r: 1, n: 4 }]);
    const reasons = Object.fromEntries(c.undefined_pairs.map((u) => [`${u.a}-${u.b}`, u.reason]));
    expect(reasons['p-k']).toBe('constant');
    expect(reasons['p-z']).toBe('insufficient_observations');
    // simetria
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) expect(c.matrix[i]![j]).toBe(c.matrix[j]![i]);
  });

  it('strings numéricas são aceitas; "12abc" não', () => {
    const c = correlationMatrix(
      [{ a: '1', b: 1 }, { a: '2', b: 2 }, { a: '3', b: 3 }, { a: '12abc', b: 100 }],
      [{ name: 'a', type: 'number' }, { name: 'b', type: 'number' }],
    ) as CorrelationResult;
    expect(c.matrix[0]![1]).toBe(1);
    expect(c.n_matrix[0]![1]).toBe(3);
  });

  it('< 2 colunas numéricas → contrato de erro', () => {
    expect(correlationMatrix([{ a: 1 }], [{ name: 'a', type: 'number' }])).toEqual({ error: true, message: 'São necessárias ≥ 2 colunas numéricas.' });
  });

  it('precision=null mantém precisão total', () => {
    const c = correlationMatrix(
      [{ a: 1, b: 2 }, { a: 2, b: 1 }, { a: 3, b: 4 }, { a: 4, b: 3 }, { a: 5, b: 5 }],
      [{ name: 'a', type: 'number' }, { name: 'b', type: 'number' }],
      0.5,
      { precision: null },
    ) as CorrelationResult;
    expect(c.matrix[0]![1]).toBeCloseTo(0.8, 14);
  });
});

describe('buildProfile', () => {
  const rows = deepFreeze([
    { idade: 25, renda: 3200, setor: 'TI' },
    { idade: null, renda: 4100, setor: 'Saúde' },
    { idade: 31, renda: null, setor: 'TI' },
    { idade: 40, renda: '12abc', setor: '' },
  ]);
  const ci = [
    { name: 'idade', type: 'number' },
    { name: 'renda', type: 'number' },
    { name: 'setor', type: 'string' },
  ];

  it('estatísticas numéricas e categóricas', () => {
    const p = buildProfile(rows, ci, { target: 'setor' });
    const idade = p.columns[0]!;
    expect(idade).toMatchObject({ missing: 1, valid: 3, invalid: 0, min: 25, max: 40, median: 31, null_pct: 25 });
    expect(idade.mean).toBeCloseTo(32, 12);
    expect(idade.std).toBeCloseTo(Math.sqrt(57), 12); // amostral: Σ(x−32)² = 114, /2
    expect(p.columns[1]).toMatchObject({ valid: 2, invalid: 1 });
    const setor = p.columns[2]!;
    expect(setor).toMatchObject({ mode: 'TI', unique: 2, missing: 1, role: 'alvo' });
    expect(setor.top).toEqual([{ value: 'TI', count: 2 }, { value: 'Saúde', count: 1 }]);
    expect(p.sample).toEqual([]); // privacidade por padrão
    expect(p.target).toBe('setor');
  });

  it('dataset vazio não produz NaN', () => {
    const p = buildProfile([], ci);
    expect(JSON.stringify(p)).not.toMatch(/NaN|null_pct":null/);
    expect(p.columns[0]!.mean).toBeUndefined();
    expect(p.warnings[0]).toMatch(/vazio/);
  });

  it('amostra opcional, truncada e restrita às colunas', () => {
    const p = buildProfile([{ a: 'x'.repeat(100), segredo: 1 }], [{ name: 'a' }], { sampleN: 5, maxStringLength: 10 });
    expect(p.sample).toEqual([{ a: 'x'.repeat(10) + '…' }]);
  });

  it('amostragem: systematic, head e random reprodutível', () => {
    const rnd = lcg(11);
    const big = Array.from({ length: 1000 }, (_, i) => ({ i, v: rnd() }));
    const ci2 = [{ name: 'v', type: 'number' }];
    const s = buildProfile(big, ci2, { statCap: 100 });
    expect(s.sampled).toBe(true);
    expect(s.rows_analyzed).toBe(100);
    const r1 = buildProfile(big, ci2, { statCap: 100, sampling: 'random', seed: 9 });
    const r2 = buildProfile(big, ci2, { statCap: 100, sampling: 'random', seed: 9 });
    const r3 = buildProfile(big, ci2, { statCap: 100, sampling: 'random', seed: 10 });
    expect(r1.columns).toEqual(r2.columns);
    expect(r1.columns[0]!.mean).not.toBe(r3.columns[0]!.mean);
    expect(r1.sampling).toEqual({ strategy: 'random', cap: 100, seed: 9 });
    expect(buildProfile(big, ci2, { statCap: 100, sampling: 'head' }).columns[0]!.max).toBeLessThanOrEqual(1);
  });

  it('duplicatas opcionais e precisão', () => {
    const p = buildProfile([{ a: 1.23456 }, { a: 1.23456 }], [{ name: 'a', type: 'number' }], { includeDuplicates: true, precision: 2 });
    expect(p.duplicates).toBe(1);
    expect(p.columns[0]!.mean).toBe(1.23);
  });
});
