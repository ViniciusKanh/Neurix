import { describe, it, expect } from 'vitest';
import { runSQL } from '../src/lib/miniSQL.js';
import { tTest2, anova1, chiSquareIndependence, normality, correlationTest, _internal } from '../src/lib/statistics.js';
import { detectTargetLeakage } from '../src/lib/dataQuality.js';

const rows = [];
for (let i = 0; i < 120; i++) rows.push({ id: i, renda: 1000 + (i % 10) * 500, regiao: ['S', 'N', 'L'][i % 3], idade: 20 + (i % 40), diag: i % 2 });

describe('miniSQL', () => {
  it('SELECT * with LIMIT', () => {
    const r = runSQL(rows, 'SELECT * FROM data LIMIT 5');
    expect(r.returned).toBe(5); expect(r.total).toBe(120);
  });
  it('GROUP BY with aggregates', () => {
    const r = runSQL(rows, 'SELECT regiao, COUNT(*) AS n, AVG(renda) AS m FROM data GROUP BY regiao');
    expect(r.rows.length).toBe(3);
    expect(r.rows.reduce((s, x) => s + x.n, 0)).toBe(120);
  });
  it('WHERE with AND + ORDER BY DESC', () => {
    const r = runSQL(rows, 'SELECT idade FROM data WHERE renda >= 3000 AND diag = 1 ORDER BY idade DESC');
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows[0].idade).toBeGreaterThanOrEqual(r.rows[r.rows.length - 1].idade);
  });
  it('LIKE wildcard', () => {
    const r = runSQL(rows, "SELECT * FROM data WHERE regiao LIKE 'S%'");
    expect(r.rows.every((x) => x.regiao === 'S')).toBe(true);
  });
  it('global aggregates', () => {
    const r = runSQL(rows, 'SELECT COUNT(*) AS total, MAX(renda) AS mx FROM data');
    expect(r.rows[0].total).toBe(120); expect(r.rows[0].mx).toBe(5500);
  });
  it('rejects non-data table', () => {
    expect(() => runSQL(rows, 'SELECT * FROM foo')).toThrow();
  });
});

describe('statistics special functions match references', () => {
  it('two-sided t p at 1.96 (large df) ≈ 0.05', () => {
    expect(_internal.studentT_p2(1.96, 1e5)).toBeCloseTo(0.05, 2);
  });
  it('chi-square p at 3.841 (df=1) ≈ 0.05', () => {
    expect(_internal.chi2_p(3.841, 1)).toBeCloseTo(0.05, 2);
  });
  it('F p at 1 (df 10,10) ≈ 0.5', () => {
    expect(_internal.fDist_p(1, 10, 10)).toBeCloseTo(0.5, 2);
  });
});

describe('statistical tests', () => {
  it('t-test detects a real mean difference', () => {
    const r = tTest2([5, 6, 7, 5, 6, 7], [9, 10, 11, 9, 10, 11]);
    expect(r.significant).toBe(true); expect(r.p_value).toBeLessThan(0.05);
  });
  it('t-test finds no difference for similar groups', () => {
    const r = tTest2([5, 6, 5, 6, 5, 6], [5, 6, 5, 6, 6, 5]);
    expect(r.significant).toBe(false);
  });
  it('ANOVA detects group differences', () => {
    const r = anova1([[1, 2, 1, 2], [5, 6, 5, 6], [9, 8, 9, 8]]);
    expect(r.significant).toBe(true);
  });
  it('chi-square detects association', () => {
    const a = ['x', 'x', 'x', 'y', 'y', 'y', 'x', 'x', 'y', 'y'];
    const b = ['a', 'a', 'a', 'b', 'b', 'b', 'a', 'a', 'b', 'b'];
    const r = chiSquareIndependence(a, b);
    expect(r.significant).toBe(true); expect(r.cramers_v).toBeGreaterThan(0.5);
  });
  it('correlation significance for a strong linear pair', () => {
    const r = correlationTest([1, 2, 3, 4, 5, 6], [2, 4, 6, 8, 10, 12]);
    expect(r.r).toBeCloseTo(1, 3); expect(r.significant).toBe(true);
  });
  it('normality flags a clearly skewed distribution', () => {
    const skewed = [1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 10, 50, 100];
    const r = normality(skewed);
    expect(r.error).toBeFalsy();
    expect(r.skewness).toBeGreaterThan(0.5);
  });
});

describe('target leakage', () => {
  const ci = [{ name: 'renda', type: 'number' }, { name: 'copia', type: 'int' }, { name: 'quase', type: 'number' }, { name: 'regiao_leak', type: 'string' }, { name: 'alvo', type: 'int' }];
  const rowsL = [];
  for (let i = 0; i < 200; i++) { const y = i % 2; rowsL.push({ renda: 1000 + Math.random() * 9000, copia: y, quase: y === 1 ? 100 + Math.random() : Math.random(), regiao_leak: y === 1 ? 'SIM' : 'NAO', alvo: y }); }
  it('flags exact copy, perfect separator and 1:1 category', () => {
    const r = detectTargetLeakage(rowsL, 'alvo', ci, 'classification');
    expect(r.has_leak).toBe(true);
    const feats = r.leaks.map((l) => l.feature);
    expect(feats).toEqual(expect.arrayContaining(['copia', 'quase', 'regiao_leak']));
    expect(feats).not.toContain('renda');
  });
  it('flags near-perfect correlation in regression', () => {
    const rr = [];
    for (let i = 0; i < 100; i++) rr.push({ x: Math.random() * 10, alvo: i * 2, quase: i * 6 });
    const r = detectTargetLeakage(rr, 'alvo', [{ name: 'x', type: 'number' }, { name: 'alvo', type: 'number' }, { name: 'quase', type: 'number' }], 'regression');
    expect(r.leaks.map((l) => l.feature)).toContain('quase');
  });
});
