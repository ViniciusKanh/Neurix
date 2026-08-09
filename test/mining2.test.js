import { describe, it, expect } from 'vitest';
import { deriveColumn, binningColumn, oneHotColumn, labelEncodeColumn, scaleColumn, logColumn, compileFormula } from '../src/lib/featureEng.js';
import { makeModel, partialDependence, fairnessMetrics } from '../src/lib/realML.js';
import { exportSklearn } from '../src/lib/governance.js';

function classRows(n = 400) {
  const rows = []; let s = 7;
  const rnd = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
  for (let i = 0; i < n; i++) { const renda = 1000 + rnd() * 9000, idade = 18 + Math.floor(rnd() * 50); const genero = rnd() < 0.5 ? 'F' : 'M'; rows.push({ renda: +renda.toFixed(2), idade, genero, diagnostico: (renda > 5000 && idade > 30) ? 1 : 0 }); }
  return rows;
}
const CI = [{ name: 'renda', type: 'number' }, { name: 'idade', type: 'int' }, { name: 'genero', type: 'string' }, { name: 'diagnostico', type: 'int' }];

describe('featureEng', () => {
  const rows = [{ a: 10, b: 2, cat: 'x' }, { a: 20, b: 4, cat: 'y' }, { a: 30, b: 5, cat: 'x' }];
  it('formula evaluator respects precedence and functions', () => {
    const f = compileFormula('a / b + log(100)'); // log = log10
    expect(f({ a: 10, b: 2 })).toBeCloseTo(7, 5); // 5 + 2
  });
  it('deriveColumn adds a computed column', () => {
    const r = deriveColumn(rows, 'razao', 'a / b'); expect(r.rows[0].razao).toBe(5);
  });
  it('binning creates a categorical band column', () => {
    const r = binningColumn(rows, 'a', 3, 'width'); expect(r.added[0]).toBe('a_faixa'); expect(r.rows[0].a_faixa).toMatch(/faixa_/);
  });
  it('one-hot expands categories', () => {
    const r = oneHotColumn(rows, 'cat'); expect(r.added).toEqual(expect.arrayContaining(['cat=x', 'cat=y'])); expect(r.rows[0]['cat=x']).toBe(1);
  });
  it('label encode maps categories to ints', () => {
    const r = labelEncodeColumn(rows, 'cat'); expect(typeof r.rows[0].cat_cod).toBe('number');
  });
  it('scale z-score has ~0 mean', () => {
    const r = scaleColumn(rows, 'a', 'zscore'); const vals = r.rows.map((x) => x.a_norm); const m = vals.reduce((s, v) => s + v, 0) / vals.length; expect(Math.abs(m)).toBeLessThan(1e-6);
  });
  it('minmax scales into [0,1]', () => {
    const r = scaleColumn(rows, 'a', 'minmax'); const vals = r.rows.map((x) => x.a_norm); expect(Math.min(...vals)).toBe(0); expect(Math.max(...vals)).toBe(1);
  });
  it('log transform is monotonic', () => {
    const r = logColumn(rows, 'a'); expect(r.rows[2].a_log).toBeGreaterThan(r.rows[0].a_log);
  });
});

describe('partial dependence', () => {
  it('PDP for an informative feature increases the positive-class score', () => {
    const rows = classRows(400);
    const m = makeModel(rows, 'diagnostico', CI, 'classification', 'random_forest');
    const pd = partialDependence(m, rows, 'renda', { grid: 10, ice: 5 });
    expect(pd.error).toBeFalsy();
    expect(pd.pdp.length).toBe(10);
    expect(pd.ice.length).toBe(5);
    expect(pd.pdp[pd.pdp.length - 1].y).toBeGreaterThan(pd.pdp[0].y); // renda ↑ → P(1) ↑
  });
});

describe('fairness', () => {
  it('computes per-group metrics and disparity', () => {
    const rows = classRows(400);
    const m = makeModel(rows, 'diagnostico', CI, 'classification', 'random_forest');
    const f = fairnessMetrics(m, rows, 'diagnostico', 'genero');
    expect(f.error).toBeFalsy();
    expect(f.groups.length).toBeGreaterThanOrEqual(2);
    expect(f.disparate_impact).toBeGreaterThan(0);
    expect(f.disparate_impact).toBeLessThanOrEqual(1);
  });
});

describe('exportSklearn', () => {
  it('generates a classification script with the right estimator', () => {
    const py = exportSklearn({ name: 'Risco', dataset_filename: 'c.csv' }, { type: 'classification', config: { target_column: 'diagnostico' }, results: { best_model: 'Random Forest' } });
    expect(py).toContain('RandomForestClassifier');
    expect(py).toContain('train_test_split');
    expect(py).toContain('stratify=y');
  });
  it('generates a regression script', () => {
    const py = exportSklearn({ name: 'E' }, { type: 'regression', config: { target_column: 'zona' }, results: { best_model: 'Ridge' } });
    expect(py).toContain('Ridge(alpha');
    expect(py).toContain('r2_score');
  });
});
