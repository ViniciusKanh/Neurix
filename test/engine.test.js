import { describe, it, expect } from 'vitest';
import {
  buildDataset, runRealClassification, runRealRegression, runRealClustering,
  crossValidate, permutationImportance, classBalance, makeModel, evaluateModel,
  hyperSearch, hyperSpace, compareModelsReal, trainPredictor,
} from '../src/lib/realML.js';
import {
  analyzeQuality, imputeNulls, dropDuplicates, coerceTypes, correlationMatrix,
} from '../src/lib/dataQuality.js';
import { buildModelCard, buildModelBundle } from '../src/lib/governance.js';

// ---- deterministic synthetic datasets ----
function makeClassRows(n = 400) {
  const rows = [];
  // deterministic pseudo-random for reproducibility
  let s = 12345;
  const rnd = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
  for (let i = 0; i < n; i++) {
    const renda = 1000 + rnd() * 9000;
    const idade = 18 + Math.floor(rnd() * 50);
    const emprestimo = renda * (0.4 + rnd());
    const y = (renda > 5000 && idade > 30) ? 1 : 0;
    rows.push({ renda: +renda.toFixed(2), idade, emprestimo: +emprestimo.toFixed(2), regiao: ['S', 'N', 'L'][i % 3], diagnostico: y });
  }
  return rows;
}
const CLASS_CI = [
  { name: 'renda', type: 'number' }, { name: 'idade', type: 'int' },
  { name: 'emprestimo', type: 'number' }, { name: 'regiao', type: 'string' },
  { name: 'diagnostico', type: 'int' },
];

function makeRegRows(n = 300) {
  const rows = [];
  let s = 999;
  const rnd = () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
  for (let i = 0; i < n; i++) {
    const x1 = rnd() * 10, x2 = rnd() * 5;
    const zona = 2 * x1 + 3 * x2 + rnd(); // strong linear signal
    rows.push({ x1: +x1.toFixed(3), x2: +x2.toFixed(3), zona: +zona.toFixed(3) });
  }
  return rows;
}
const REG_CI = [{ name: 'x1', type: 'number' }, { name: 'x2', type: 'number' }, { name: 'zona', type: 'number' }];

describe('buildDataset', () => {
  it('keeps continuous features (does not drop by cardinality)', () => {
    const ds = buildDataset(makeClassRows(200), 'diagnostico', CLASS_CI, 'classification');
    expect(ds.featCols.map((c) => c.name)).toEqual(expect.arrayContaining(['renda', 'idade', 'emprestimo']));
    expect(ds.classes).toEqual(['0', '1']);
    expect(ds.X.length).toBeGreaterThan(150);
  });
});

describe('classification engine', () => {
  const res = runRealClassification(makeClassRows(400), 'diagnostico', CLASS_CI, 0.2, 'all');
  it('produces a real leaderboard with good accuracy on separable data', () => {
    expect(res.error).toBeFalsy();
    expect(res.models_comparison.length).toBeGreaterThanOrEqual(5);
    expect(res.metrics.accuracy).toBeGreaterThan(0.8);
  });
  it('metrics are within [0,1]', () => {
    for (const m of res.models_comparison) {
      expect(m.metrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(m.metrics.accuracy).toBeLessThanOrEqual(1);
    }
  });
});

describe('regression engine', () => {
  it('recovers a strong linear signal (high R²)', () => {
    const res = runRealRegression(makeRegRows(300), 'zona', REG_CI, 0.2, 'all');
    expect(res.error).toBeFalsy();
    expect(res.metrics.r2_score).toBeGreaterThan(0.9);
  });
});

describe('clustering', () => {
  it('returns k clusters and a silhouette', () => {
    const res = runRealClustering(makeRegRows(120), REG_CI, 3);
    expect(res.error).toBeFalsy();
    expect(res.metrics.clusters).toBe(3);
    expect(res.cluster_sizes.reduce((a, b) => a + b, 0)).toBe(120);
  });
});

describe('crossValidate', () => {
  it('returns mean/std and per-fold scores', () => {
    const cv = crossValidate(makeClassRows(400), 'diagnostico', CLASS_CI, 'classification', 'random_forest', 5);
    expect(cv.error).toBeFalsy();
    expect(cv.folds.length).toBe(5);
    expect(cv.mean).toBeGreaterThan(0.7);
    expect(cv.std).toBeGreaterThanOrEqual(0);
  });
});

describe('permutationImportance', () => {
  it('ranks the informative feature (renda) at the top', () => {
    const pi = permutationImportance(makeClassRows(400), 'diagnostico', CLASS_CI, 'classification', 'logistic');
    expect(pi.error).toBeFalsy();
    expect(pi.importances[0].feature).toBe('renda');
  });
});

describe('classBalance', () => {
  it('computes proportions and ratio', () => {
    const b = classBalance(makeClassRows(400), 'diagnostico');
    expect(b.classes.length).toBe(2);
    expect(b.classes.reduce((s, c) => s + c.pct, 0)).toBeGreaterThan(99);
    expect(b.imbalance_ratio).toBeGreaterThanOrEqual(1);
  });
});

describe('makeModel + evaluateModel', () => {
  const rows = makeClassRows(400);
  it('predicts and returns probabilities', () => {
    const m = makeModel(rows, 'diagnostico', CLASS_CI, 'classification', 'logistic');
    expect(m).toBeTruthy();
    const inp = {}; m.features.forEach((f) => { inp[f.name] = f.numeric ? f.mean : f.options[0]; });
    const out = m.predict(inp);
    expect(['0', '1']).toContain(String(out.value));
    const p = m.proba(inp);
    expect(Math.abs(p.reduce((a, b) => a + b, 0) - 1)).toBeLessThan(1e-6);
  });
  it('evaluate returns a confusion matrix and ROC points (binary)', () => {
    const ev = evaluateModel(rows, 'diagnostico', CLASS_CI, 'classification', 'logistic');
    expect(ev.confusion.length).toBe(2);
    expect(ev.points.length).toBeGreaterThan(50);
  });
});

describe('hyperSearch', () => {
  it('returns ranked trials and a best config', () => {
    const hs = hyperSearch(makeClassRows(300), 'diagnostico', CLASS_CI, 'classification', 'random_forest', 8, 4);
    expect(hs.error).toBeFalsy();
    expect(hs.trials.length).toBeGreaterThan(0);
    expect(hs.best_score).toBeGreaterThan(0.7);
    expect(hs.trials[0].score).toBeGreaterThanOrEqual(hs.trials[hs.trials.length - 1].score);
  });
  it('hyperSpace lists tunable params for rf', () => {
    expect(hyperSpace('Random Forest', 'classification').params.map((p) => p.name)).toContain('n_trees');
  });
});

describe('compareModelsReal', () => {
  it('gives per-model metrics and distinct ROC curves', () => {
    const cmp = compareModelsReal(makeClassRows(400), 'diagnostico', CLASS_CI, 'classification', ['Regressão Logística', 'Random Forest', 'KNN'], 0.25);
    expect(cmp.error).toBeFalsy();
    expect(cmp.models.length).toBe(3);
    cmp.models.forEach((m) => expect(m.roc.length).toBeGreaterThan(10));
    // AUCs should not all be identical (real per-model scores)
    const aucs = cmp.models.map((m) => m.metrics.auc);
    expect(new Set(aucs).size).toBeGreaterThan(1);
  });
});

describe('trainPredictor', () => {
  it('trains and predicts a single row', () => {
    const p = trainPredictor(makeClassRows(300), 'diagnostico', CLASS_CI, 'classification', 'random_forest');
    expect(p).toBeTruthy();
    const out = p.predict({ renda: 8000, idade: 40, emprestimo: 9000, regiao: 'S' });
    expect(['0', '1']).toContain(String(out.value));
  });
});

describe('dataQuality', () => {
  const rows = [
    { a: 1, b: 'x', c: 10 }, { a: 2, b: 'y', c: 20 }, { a: '', b: 'x', c: 30 },
    { a: 2, b: 'y', c: 20 }, // duplicate of row 2
    { a: 4, b: '', c: '' },
  ];
  const ci = [{ name: 'a', type: 'number' }, { name: 'b', type: 'string' }, { name: 'c', type: 'number' }];
  it('analyzeQuality counts nulls and duplicates', () => {
    const q = analyzeQuality(rows, ci);
    expect(q.duplicates).toBe(1);
    expect(q.total_nulls).toBeGreaterThanOrEqual(3);
  });
  it('imputeNulls fills all empties', () => {
    const r = imputeNulls(rows, ci, 'median');
    expect(r.filled).toBeGreaterThan(0);
    expect(analyzeQuality(r.rows, ci).total_nulls).toBe(0);
  });
  it('dropDuplicates removes exact repeats', () => {
    expect(dropDuplicates(rows, ci).removed).toBe(1);
  });
  it('coerceTypes converts numeric strings', () => {
    const r = coerceTypes([{ a: '3', b: 'z', c: '5' }], ci);
    expect(typeof r.rows[0].a).toBe('number');
  });
  it('correlationMatrix flags perfectly correlated columns', () => {
    const corr = correlationMatrix([{ p: 1, q: 2 }, { p: 2, q: 4 }, { p: 3, q: 6 }, { p: 4, q: 8 }],
      [{ name: 'p', type: 'number' }, { name: 'q', type: 'number' }], 0.8);
    expect(corr.high_pairs.length).toBe(1);
    expect(Math.abs(corr.high_pairs[0].r)).toBeGreaterThan(0.99);
  });
});

describe('governance', () => {
  it('builds a model card and a portable bundle', () => {
    const analysis = { type: 'classification', config: { target_column: 'diagnostico', feature_columns: ['renda', 'idade'] }, results: { best_model: 'Random Forest', metrics: { accuracy: 0.9, precision: 0.9, recall: 0.88, f1_score: 0.89 }, trained_on: 400, test_size: 80, class_labels: ['0', '1'] } };
    const card = buildModelCard({ name: 'Risco', column_info: CLASS_CI }, analysis, { balance: classBalance(makeClassRows(400), 'diagnostico') });
    expect(card.model_name).toBe('Random Forest');
    expect(card.performance.length).toBe(4);
    const bundle = buildModelBundle({ id: 'p1', name: 'Risco' }, analysis, card);
    expect(bundle.format).toBe('neurix-model-bundle');
  });
});
