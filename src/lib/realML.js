/**
 * Real Machine Learning engine — trains actual models on the FULL dataset rows
 * (loaded from Turso), computing real metrics on a held-out test split.
 * Pure JavaScript, runs in the browser. No AI, no external services.
 *
 * Supports: classification (Logistic/Softmax, Decision Tree, KNN, Naive Bayes),
 * regression (Linear, Decision Tree, KNN) and K-Means clustering.
 */

// ---------- utils ----------
function seededRand(seed = 42) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
}
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const isNumericType = (t) => ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((t || '').toLowerCase());

function shuffleIdx(n, rand) {
  const idx = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
  return idx;
}

// ---------- dataset builder ----------
// Builds a numeric feature matrix + target from raw rows.
export function buildDataset(rows, targetColumn, columnInfo, task) {
  const cols = columnInfo || [];
  const hasTarget = cols.some((c) => c.name === targetColumn);
  const nRows = rows.length || 1;
  // Drop identifier columns by NAME (not by cardinality — continuous features
  // like income/amount are also nearly unique and must be kept).
  const isIdLike = (c) => {
    const nm = (c.name || '').toLowerCase().trim();
    const idName = nm === 'id' || /_id$/.test(nm) || (/id$/.test(nm) && nm.length <= 16)
      || /(codigo|código|cpf|cnpj|uuid|guid|matric)/.test(nm);
    return idName && (c.unique_count || 0) >= 0.5 * nRows;
  };
  let featCols = (hasTarget ? cols.filter((c) => c.name !== targetColumn) : cols).filter((c) => !isIdLike(c));
  if (featCols.length === 0) featCols = hasTarget ? cols.filter((c) => c.name !== targetColumn) : cols;
  const targetInfo = cols.find((c) => c.name === targetColumn);

  // categorical encoders (one-hot, top categories)
  const encoders = {};
  featCols.forEach((c) => {
    if (!isNumericType(c.type)) {
      const counts = {};
      rows.forEach((r) => { const v = String(r[c.name] ?? ''); if (v !== '') counts[v] = (counts[v] || 0) + 1; });
      const cats = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([k]) => k);
      encoders[c.name] = cats;
    }
  });

  const featureNames = [];
  featCols.forEach((c) => {
    if (isNumericType(c.type)) featureNames.push(c.name);
    else encoders[c.name].forEach((cat) => featureNames.push(`${c.name}=${cat}`));
  });

  // target encoding
  let classes = null;
  const X = [], y = [];
  const numericTarget = task === 'regression';
  if (hasTarget && !numericTarget) {
    const set = new Set();
    rows.forEach((r) => { const v = r[targetColumn]; if (v !== undefined && v !== null && v !== '') set.add(String(v)); });
    classes = [...set].sort();
  }

  for (const r of rows) {
    let yv = 0;
    if (hasTarget) {
      const tv = r[targetColumn];
      if (tv === undefined || tv === null || tv === '') continue;
      if (numericTarget) { yv = parseFloat(tv); if (isNaN(yv)) continue; }
      else { yv = classes.indexOf(String(tv)); if (yv < 0) continue; }
    }

    const xr = [];
    for (const c of featCols) {
      if (isNumericType(c.type)) {
        const num = parseFloat(r[c.name]);
        xr.push(isNaN(num) ? 0 : num);
      } else {
        const v = String(r[c.name] ?? '');
        encoders[c.name].forEach((cat) => xr.push(v === cat ? 1 : 0));
      }
    }
    X.push(xr); y.push(yv);
  }

  // standardize (z-score) — store stats
  const d = featureNames.length;
  const means = Array(d).fill(0), stds = Array(d).fill(1);
  for (let j = 0; j < d; j++) {
    const col = X.map((r) => r[j]);
    means[j] = mean(col);
    const v = mean(col.map((x) => (x - means[j]) ** 2));
    stds[j] = Math.sqrt(v) || 1;
  }
  const Xs = X.map((r) => r.map((v, j) => (v - means[j]) / stds[j]));

  return { X: Xs, Xraw: X, y, featureNames, classes, means, stds, targetInfo, encoders, featCols };
}

// Encode + standardize a single raw row using the dataset's fitted stats.
function encodeRow(rawRow, meta) {
  const { featCols, encoders, means, stds } = meta;
  const xr = [];
  for (const c of featCols) {
    if (isNumericType(c.type)) { const num = parseFloat(rawRow[c.name]); xr.push(isNaN(num) ? 0 : num); }
    else { const v = String(rawRow[c.name] ?? ''); (encoders[c.name] || []).forEach((cat) => xr.push(v === cat ? 1 : 0)); }
  }
  return xr.map((v, j) => (v - means[j]) / (stds[j] || 1));
}

// ---------- fit-only models (return a predictor over a standardized vector) ----------
function fitSoftmax(X, y, K, epochs = 250, lr = 0.3) {
  const n = X.length, d = X[0].length;
  const W = Array.from({ length: K }, () => Array(d + 1).fill(0));
  const feat = (x) => [1, ...x];
  for (let ep = 0; ep < epochs; ep++) {
    const grad = Array.from({ length: K }, () => Array(d + 1).fill(0));
    for (let i = 0; i < n; i++) {
      const xf = feat(X[i]);
      const scores = W.map((w) => w.reduce((s, wj, j) => s + wj * xf[j], 0));
      const mx = Math.max(...scores);
      const exps = scores.map((s) => Math.exp(s - mx));
      const sum = exps.reduce((a, b) => a + b, 0);
      for (let k = 0; k < K; k++) { const p = exps[k] / sum - (y[i] === k ? 1 : 0); for (let j = 0; j <= d; j++) grad[k][j] += p * xf[j]; }
    }
    for (let k = 0; k < K; k++) for (let j = 0; j <= d; j++) W[k][j] -= (lr / n) * grad[k][j];
  }
  return { predict(xs) { const xf = [1, ...xs]; const sc = W.map((w) => w.reduce((s, wj, j) => s + wj * xf[j], 0)); let b = 0; for (let k = 1; k < K; k++) if (sc[k] > sc[b]) b = k; return b; } };
}
function fitLinear(X, y, epochs = 400, lr = 0.1) {
  const d = X[0].length, n = X.length, w = Array(d + 1).fill(0), feat = (x) => [1, ...x];
  for (let ep = 0; ep < epochs; ep++) { const g = Array(d + 1).fill(0); for (let i = 0; i < n; i++) { const xf = feat(X[i]); const pred = w.reduce((s, wj, j) => s + wj * xf[j], 0); const err = pred - y[i]; for (let j = 0; j <= d; j++) g[j] += err * xf[j]; } for (let j = 0; j <= d; j++) w[j] -= (lr / n) * g[j]; }
  return { predict(xs) { const xf = [1, ...xs]; return w.reduce((s, wj, j) => s + wj * xf[j], 0); } };
}
function fitTreeModel(X, y, task) { const imp = {}; const tree = buildTree(X, y, task, 0, 10, 8, imp); return { predict(xs) { return predictTree(tree, xs); } }; }
function fitKNNModel(X, y, task, k = 5) { return { predict(xs) { const dd = X.map((t, i) => { let s = 0; for (let j = 0; j < xs.length; j++) s += (xs[j] - t[j]) ** 2; return [s, y[i]]; }); dd.sort((a, b) => a[0] - b[0]); const top = dd.slice(0, k); if (task === 'regression') return mean(top.map((t) => t[1])); const votes = {}; top.forEach((t) => votes[t[1]] = (votes[t[1]] || 0) + 1); return Number(Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]); } }; }
function fitNBModel(X, y, K) {
  const d = X[0].length;
  const st = Array.from({ length: K }, () => ({ prior: 0, mean: Array(d).fill(0), var: Array(d).fill(1), n: 0 }));
  X.forEach((x, i) => { const k = y[i]; st[k].n++; x.forEach((v, j) => st[k].mean[j] += v); });
  st.forEach((s) => { if (s.n) s.mean = s.mean.map((m) => m / s.n); s.prior = s.n / X.length; });
  X.forEach((x, i) => { const k = y[i]; x.forEach((v, j) => st[k].var[j] += (v - st[k].mean[j]) ** 2); });
  st.forEach((s) => { s.var = s.var.map((v) => (s.n ? v / s.n : 1) + 1e-6); });
  return { predict(xs) { let best = 0, bl = -Infinity; for (let k = 0; k < K; k++) { const s = st[k]; if (!s.n) continue; let lp = Math.log(s.prior); for (let j = 0; j < xs.length; j++) lp += -0.5 * Math.log(2 * Math.PI * s.var[j]) - ((xs[j] - s.mean[j]) ** 2) / (2 * s.var[j]); if (lp > bl) { bl = lp; best = k; } } return best; } };
}

// ---------- extra real models (RF, SVM, Ridge, Lasso, Gradient Boosting) ----------
function fitRandomForest(X, y, task, rand, nTrees = 12) {
  const n = X.length, trees = [];
  for (let t = 0; t < nTrees; t++) {
    const idx = Array.from({ length: n }, () => Math.floor(rand() * n));
    trees.push(buildTree(idx.map((i) => X[i]), idx.map((i) => y[i]), task, 0, 9, 6, {}));
  }
  return { predict(xs) {
    const preds = trees.map((tr) => predictTree(tr, xs));
    if (task === 'regression') return mean(preds);
    const votes = {}; preds.forEach((p) => votes[p] = (votes[p] || 0) + 1);
    return Number(Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]);
  } };
}

function fitSVM(X, y, K, epochs = 180, lr = 0.05, lambda = 0.001) {
  const d = X[0].length, n = X.length, feat = (x) => [1, ...x];
  const Ws = [];
  for (let c = 0; c < K; c++) {
    const w = Array(d + 1).fill(0);
    for (let ep = 0; ep < epochs; ep++) {
      for (let i = 0; i < n; i++) {
        const xf = feat(X[i]); const yi = y[i] === c ? 1 : -1;
        const margin = w.reduce((s, wj, j) => s + wj * xf[j], 0) * yi;
        for (let j = 0; j <= d; j++) { const reg = j === 0 ? 0 : lambda * w[j]; w[j] -= lr * (reg - (margin < 1 ? yi * xf[j] : 0)); }
      }
    }
    Ws.push(w);
  }
  return { predict(xs) { const xf = [1, ...xs]; let b = 0, bs = -Infinity; for (let c = 0; c < K; c++) { const s = Ws[c].reduce((a, wj, j) => a + wj * xf[j], 0); if (s > bs) { bs = s; b = c; } } return b; } };
}

function fitLinearPenalized(X, y, penalty, lambda, epochs = 400, lr = 0.1) {
  const d = X[0].length, n = X.length, w = Array(d + 1).fill(0), feat = (x) => [1, ...x];
  for (let ep = 0; ep < epochs; ep++) {
    const g = Array(d + 1).fill(0);
    for (let i = 0; i < n; i++) { const xf = feat(X[i]); const pred = w.reduce((s, wj, j) => s + wj * xf[j], 0); const err = pred - y[i]; for (let j = 0; j <= d; j++) g[j] += err * xf[j]; }
    for (let j = 0; j <= d; j++) { let reg = 0; if (j > 0) reg = penalty === 'l2' ? lambda * w[j] : lambda * Math.sign(w[j]); w[j] -= (lr / n) * g[j] + (lr / n) * reg; }
  }
  return { predict(xs) { const xf = [1, ...xs]; return w.reduce((s, wj, j) => s + wj * xf[j], 0); } };
}
const fitRidge = (X, y) => fitLinearPenalized(X, y, 'l2', 0.5);
const fitLasso = (X, y) => fitLinearPenalized(X, y, 'l1', 0.1);

function fitGBReg(X, y, rounds = 25, lr = 0.2, depth = 3) {
  const base = mean(y); const F = y.map(() => base); const trees = [];
  for (let m = 0; m < rounds; m++) { const resid = y.map((v, i) => v - F[i]); const tr = buildTree(X, resid, 'regression', 0, depth, 8, {}); trees.push(tr); for (let i = 0; i < X.length; i++) F[i] += lr * predictTree(tr, X[i]); }
  return { predict(xs) { let s = base; for (const tr of trees) s += lr * predictTree(tr, xs); return s; } };
}

function fitGBClass(X, y, K, rounds = 22, lr = 0.3, depth = 3) {
  const sigmoid = (z) => 1 / (1 + Math.exp(-z));
  const treesPer = [];
  for (let c = 0; c < K; c++) {
    const yc = y.map((v) => (v === c ? 1 : 0)); const F = X.map(() => 0); const trees = [];
    for (let m = 0; m < rounds; m++) { const grad = yc.map((v, i) => v - sigmoid(F[i])); const tr = buildTree(X, grad, 'regression', 0, depth, 8, {}); trees.push(tr); for (let i = 0; i < X.length; i++) F[i] += lr * predictTree(tr, X[i]); }
    treesPer.push(trees);
  }
  return { predict(xs) { let b = 0, bs = -Infinity; for (let c = 0; c < K; c++) { let s = 0; for (const tr of treesPer[c]) s += lr * predictTree(tr, xs); if (s > bs) { bs = s; b = c; } } return b; } };
}

function normalizeModelName(name, task) {
  const s = String(name || '').toLowerCase();
  if (s.includes('random') || s.includes('floresta')) return 'rf';
  if (s.includes('boosting') || s.includes('gradient') || s.includes('xgb')) return 'gb';
  if (s.includes('svm') || s.includes('svr') || s.includes('vector')) return 'svm';
  if (s.includes('ridge')) return 'ridge';
  if (s.includes('lasso')) return 'lasso';
  if (s.includes('árvore') || s.includes('arvore') || s.includes('tree') || s === 'decision_tree') return 'tree';
  if (s.includes('knn') || s.includes('nearest')) return 'knn';
  if (s.includes('naive') || s === 'naive_bayes') return 'nb';
  if (s.includes('linear') || s === 'linear_regression') return 'linear';
  if (s.includes('logíst') || s.includes('logist') || s === 'logistic_regression') return 'logistic';
  return task === 'regression' ? 'linear' : 'logistic';
}

// Trains a reusable predictor on the FULL data — used by Deploy/Inference.
export function trainPredictor(rows, targetColumn, columnInfo, task, modelName = 'auto') {
  const ds = buildDataset(rows, targetColumn, columnInfo, task);
  if (ds.X.length < 10) return null;
  const K = ds.classes ? ds.classes.length : 0;
  if (task === 'classification' && K < 2) return null;
  const pick = normalizeModelName(modelName, task);
  const rf = seededRand(999);
  let model;
  if (task === 'classification') {
    model = pick === 'tree' ? fitTreeModel(ds.X, ds.y, 'classification')
      : pick === 'rf' ? fitRandomForest(ds.X, ds.y, 'classification', rf)
      : pick === 'gb' ? fitGBClass(ds.X, ds.y, K)
      : pick === 'svm' ? fitSVM(ds.X, ds.y, K)
      : pick === 'knn' ? fitKNNModel(ds.X, ds.y, 'classification')
      : pick === 'nb' ? fitNBModel(ds.X, ds.y, K)
      : fitSoftmax(ds.X, ds.y, K);
  } else {
    model = pick === 'tree' ? fitTreeModel(ds.X, ds.y, 'regression')
      : pick === 'rf' ? fitRandomForest(ds.X, ds.y, 'regression', rf)
      : pick === 'gb' ? fitGBReg(ds.X, ds.y)
      : pick === 'ridge' ? fitRidge(ds.X, ds.y)
      : pick === 'lasso' ? fitLasso(ds.X, ds.y)
      : pick === 'knn' ? fitKNNModel(ds.X, ds.y, 'regression')
      : fitLinear(ds.X, ds.y);
  }
  const meta = { featCols: ds.featCols, encoders: ds.encoders, means: ds.means, stds: ds.stds };
  return {
    task, model_name: pick, classes: ds.classes, feature_columns: ds.featCols.map((c) => c.name),
    predict(rawRow) {
      const xs = encodeRow(rawRow, meta);
      const out = model.predict(xs);
      if (task === 'classification') return { value: ds.classes[out] ?? String(out), index: out };
      return { value: Number(out.toFixed(4)) };
    },
  };
}

// Fits the chosen model on already-encoded X/y (used by makeModel + evaluate).
function fitByName(X, y, task, modelName, K) {
  const pick = normalizeModelName(modelName, task);
  const rf = seededRand(999);
  if (task === 'classification') {
    return pick === 'tree' ? fitTreeModel(X, y, 'classification')
      : pick === 'rf' ? fitRandomForest(X, y, 'classification', rf)
      : pick === 'gb' ? fitGBClass(X, y, K)
      : pick === 'svm' ? fitSVM(X, y, K)
      : pick === 'knn' ? fitKNNModel(X, y, 'classification')
      : pick === 'nb' ? fitNBModel(X, y, K)
      : fitSoftmax(X, y, K);
  }
  return pick === 'tree' ? fitTreeModel(X, y, 'regression')
    : pick === 'rf' ? fitRandomForest(X, y, 'regression', rf)
    : pick === 'gb' ? fitGBReg(X, y)
    : pick === 'ridge' ? fitRidge(X, y)
    : pick === 'lasso' ? fitLasso(X, y)
    : pick === 'knn' ? fitKNNModel(X, y, 'regression')
    : fitLinear(X, y);
}

// Softmax that also returns class probabilities (for XAI + ROC/PR curves).
function softmaxProbaModel(X, y, K, epochs = 250, lr = 0.3) {
  const n = X.length, d = X[0].length;
  const W = Array.from({ length: K }, () => Array(d + 1).fill(0));
  const feat = (x) => [1, ...x];
  for (let ep = 0; ep < epochs; ep++) {
    const grad = Array.from({ length: K }, () => Array(d + 1).fill(0));
    for (let i = 0; i < n; i++) {
      const xf = feat(X[i]);
      const sc = W.map((w) => w.reduce((s, wj, j) => s + wj * xf[j], 0));
      const mx = Math.max(...sc); const ex = sc.map((s) => Math.exp(s - mx)); const sum = ex.reduce((a, b) => a + b, 0);
      for (let k = 0; k < K; k++) { const p = ex[k] / sum - (y[i] === k ? 1 : 0); for (let j = 0; j <= d; j++) grad[k][j] += p * xf[j]; }
    }
    for (let k = 0; k < K; k++) for (let j = 0; j <= d; j++) W[k][j] -= (lr / n) * grad[k][j];
  }
  return {
    proba(xs) { const xf = [1, ...xs]; const sc = W.map((w) => w.reduce((s, wj, j) => s + wj * xf[j], 0)); const mx = Math.max(...sc); const ex = sc.map((s) => Math.exp(s - mx)); const sum = ex.reduce((a, b) => a + b, 0); return ex.map((e) => e / sum); },
  };
}

// Reusable model bundle: hard predict (chosen model) + probability (logistic)
// + feature spec for building the What-if simulator UI. Used by the Model Lab.
export function makeModel(rows, targetColumn, columnInfo, task, modelName = 'auto') {
  const ds = buildDataset(rows, targetColumn, columnInfo, task);
  if (ds.X.length < 10) return null;
  const K = ds.classes ? ds.classes.length : 0;
  if (task === 'classification' && K < 2) return null;
  const meta = { featCols: ds.featCols, encoders: ds.encoders, means: ds.means, stds: ds.stds };
  const hard = fitByName(ds.X, ds.y, task, modelName, K);
  const pm = task === 'classification' ? softmaxProbaModel(ds.X, ds.y, K) : null;
  const spec = ds.featCols.map((c) => {
    if (isNumericType(c.type)) {
      const vals = rows.map((r) => parseFloat(r[c.name])).filter((v) => !isNaN(v));
      const mn = Math.min(...vals), mx = Math.max(...vals), me = mean(vals);
      return { name: c.name, numeric: true, min: Number(mn.toFixed(3)), max: Number(mx.toFixed(3)), mean: Number(me.toFixed(3)) };
    }
    const opts = ds.encoders[c.name] || [];
    return { name: c.name, numeric: false, options: opts, mean: opts[0] ?? '' };
  });
  const enc = (row) => encodeRow(row, meta);
  return {
    task, classes: ds.classes, features: spec, model_name: normalizeModelName(modelName, task), trained_on: ds.X.length,
    predict(row) { const out = hard.predict(enc(row)); return task === 'classification' ? { value: ds.classes[out] ?? String(out), index: out } : { value: Number(out.toFixed(4)) }; },
    proba(row) { return pm ? pm.proba(enc(row)) : null; },     // vector of class probs (classification)
    scalar(row) { const out = hard.predict(enc(row)); return task === 'classification' ? (pm ? pm.proba(enc(row))[K - 1] : out) : out; }, // scalar score for XAI
  };
}

// Holdout evaluation: confusion matrix + (binary) probability points for ROC/PR.
export function evaluateModel(rows, targetColumn, columnInfo, task, modelName, splitRatio = 0.25) {
  const ds = buildDataset(rows, targetColumn, columnInfo, task);
  if (ds.X.length < 20) return { error: true, message: 'Dados insuficientes (mín. 20 linhas).' };
  const rand = seededRand(2024);
  const { Xtr, ytr, Xte, yte } = split(ds.X, ds.y, splitRatio, rand);
  if (task === 'classification') {
    const K = ds.classes.length;
    const model = fitByName(Xtr, ytr, 'classification', modelName, K);
    const pred = Xte.map((x) => model.predict(x));
    const cm = Array.from({ length: K }, () => Array(K).fill(0));
    for (let i = 0; i < yte.length; i++) cm[yte[i]][pred[i]]++;
    let points = null;
    if (K === 2) { const pm = softmaxProbaModel(Xtr, ytr, 2); points = Xte.map((x, i) => ({ y: yte[i], score: pm.proba(x)[1] })); }
    return { task, classes: ds.classes, confusion: cm, points, test_size: yte.length, positive_class: ds.classes[K - 1] };
  }
  // regression: predicted vs actual for a scatter
  const model = fitByName(Xtr, ytr, 'regression', modelName, 0);
  const pred = Xte.map((x) => model.predict(x));
  const pts = yte.map((v, i) => ({ actual: v, predicted: Number(pred[i].toFixed(3)) }));
  const m = mean(yte); const ssTot = yte.reduce((s, v) => s + (v - m) ** 2, 0) || 1; const ssRes = yte.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0);
  return { task, r2: Number((1 - ssRes / ssTot).toFixed(4)), points: pts, test_size: yte.length };
}

function split(X, y, ratio, rand) {
  const n = X.length;
  const idx = shuffleIdx(n, rand);
  const nTest = Math.max(1, Math.round(n * ratio));
  const testI = new Set(idx.slice(0, nTest));
  const Xtr = [], ytr = [], Xte = [], yte = [];
  for (let i = 0; i < n; i++) {
    if (testI.has(i)) { Xte.push(X[i]); yte.push(y[i]); }
    else { Xtr.push(X[i]); ytr.push(y[i]); }
  }
  return { Xtr, ytr, Xte, yte };
}

// ---------- classification models ----------
function softmaxRegression(Xtr, ytr, Xte, K, epochs = 250, lr = 0.3) {
  const n = Xtr.length, d = Xtr[0].length;
  const W = Array.from({ length: K }, () => Array(d + 1).fill(0)); // +bias
  const feat = (x) => [1, ...x];
  for (let ep = 0; ep < epochs; ep++) {
    const grad = Array.from({ length: K }, () => Array(d + 1).fill(0));
    for (let i = 0; i < n; i++) {
      const xf = feat(Xtr[i]);
      const scores = W.map((w) => w.reduce((s, wj, j) => s + wj * xf[j], 0));
      const mx = Math.max(...scores);
      const exps = scores.map((s) => Math.exp(s - mx));
      const sum = exps.reduce((a, b) => a + b, 0);
      for (let k = 0; k < K; k++) {
        const p = exps[k] / sum - (ytr[i] === k ? 1 : 0);
        for (let j = 0; j <= d; j++) grad[k][j] += p * xf[j];
      }
    }
    for (let k = 0; k < K; k++) for (let j = 0; j <= d; j++) W[k][j] -= (lr / n) * grad[k][j];
  }
  return Xte.map((x) => {
    const xf = feat(x);
    const scores = W.map((w) => w.reduce((s, wj, j) => s + wj * xf[j], 0));
    let best = 0; for (let k = 1; k < K; k++) if (scores[k] > scores[best]) best = k;
    return best;
  });
}

function gaussianNB(Xtr, ytr, Xte, K) {
  const d = Xtr[0].length;
  const stats = Array.from({ length: K }, () => ({ prior: 0, mean: Array(d).fill(0), var: Array(d).fill(1), n: 0 }));
  Xtr.forEach((x, i) => { const k = ytr[i]; stats[k].n++; x.forEach((v, j) => { stats[k].mean[j] += v; }); });
  stats.forEach((s) => { if (s.n) s.mean = s.mean.map((m) => m / s.n); s.prior = s.n / Xtr.length; });
  Xtr.forEach((x, i) => { const k = ytr[i]; x.forEach((v, j) => { stats[k].var[j] += (v - stats[k].mean[j]) ** 2; }); });
  stats.forEach((s) => { s.var = s.var.map((v) => (s.n ? v / s.n : 1) + 1e-6); });
  return Xte.map((x) => {
    let best = 0, bestLog = -Infinity;
    for (let k = 0; k < K; k++) {
      const s = stats[k]; if (!s.n) continue;
      let logp = Math.log(s.prior);
      for (let j = 0; j < x.length; j++) logp += -0.5 * Math.log(2 * Math.PI * s.var[j]) - ((x[j] - s.mean[j]) ** 2) / (2 * s.var[j]);
      if (logp > bestLog) { bestLog = logp; best = k; }
    }
    return best;
  });
}

function knn(Xtr, ytr, Xte, k, task, rand) {
  // subsample train for speed
  let tr = Xtr, ty = ytr;
  if (Xtr.length > 2500) { const idx = shuffleIdx(Xtr.length, rand).slice(0, 2500); tr = idx.map((i) => Xtr[i]); ty = idx.map((i) => ytr[i]); }
  return Xte.map((x) => {
    const dists = tr.map((t, i) => { let s = 0; for (let j = 0; j < x.length; j++) s += (x[j] - t[j]) ** 2; return [s, ty[i]]; });
    dists.sort((a, b) => a[0] - b[0]);
    const top = dists.slice(0, k);
    if (task === 'regression') return mean(top.map((t) => t[1]));
    const votes = {}; top.forEach((t) => { votes[t[1]] = (votes[t[1]] || 0) + 1; });
    return Number(Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]);
  });
}

// ---------- decision tree (CART) ----------
function buildTree(X, y, task, depth, maxDepth, minSplit, importance) {
  const n = y.length;
  const leaf = () => (task === 'regression' ? mean(y) : mode(y));
  if (depth >= maxDepth || n < minSplit) return { leaf: leaf() };
  const impurity = task === 'regression' ? variance(y) : gini(y);
  if (impurity < 1e-9) return { leaf: leaf() };

  let best = null;
  const d = X[0].length;
  const step = Math.max(1, Math.floor(n / 60)); // candidate thresholds sampling
  for (let j = 0; j < d; j++) {
    const vals = X.map((r) => r[j]).slice().sort((a, b) => a - b);
    for (let t = step; t < n; t += step) {
      const thr = (vals[t] + vals[t - 1]) / 2;
      const li = [], ri = [];
      for (let i = 0; i < n; i++) (X[i][j] <= thr ? li : ri).push(i);
      if (li.length < 2 || ri.length < 2) continue;
      const yl = li.map((i) => y[i]), yr = ri.map((i) => y[i]);
      const imp = task === 'regression'
        ? (li.length * variance(yl) + ri.length * variance(yr)) / n
        : (li.length * gini(yl) + ri.length * gini(yr)) / n;
      const gain = impurity - imp;
      if (!best || gain > best.gain) best = { j, thr, gain, li, ri };
    }
  }
  if (!best || best.gain <= 1e-9) return { leaf: leaf() };
  importance[best.j] = (importance[best.j] || 0) + best.gain * n;
  return {
    j: best.j, thr: best.thr,
    left: buildTree(best.li.map((i) => X[i]), best.li.map((i) => y[i]), task, depth + 1, maxDepth, minSplit, importance),
    right: buildTree(best.ri.map((i) => X[i]), best.ri.map((i) => y[i]), task, depth + 1, maxDepth, minSplit, importance),
  };
}
function predictTree(node, x) { while (node.leaf === undefined) node = x[node.j] <= node.thr ? node.left : node.right; return node.leaf; }
function gini(y) { const c = {}; y.forEach((v) => c[v] = (c[v] || 0) + 1); const n = y.length; return 1 - Object.values(c).reduce((s, k) => s + (k / n) ** 2, 0); }
function variance(y) { const m = mean(y); return mean(y.map((v) => (v - m) ** 2)); }
function mode(y) { const c = {}; y.forEach((v) => c[v] = (c[v] || 0) + 1); return Number(Object.entries(c).sort((a, b) => b[1] - a[1])[0][0]); }

function decisionTree(Xtr, ytr, Xte, task, importanceOut) {
  const importance = {};
  const tree = buildTree(Xtr, ytr, task, 0, 10, 8, importance);
  if (importanceOut) Object.assign(importanceOut, importance);
  return Xte.map((x) => predictTree(tree, x));
}

// ---------- linear regression ----------
function linearRegression(Xtr, ytr, Xte, epochs = 400, lr = 0.1) {
  const d = Xtr[0].length;
  const w = Array(d + 1).fill(0);
  const feat = (x) => [1, ...x];
  const n = Xtr.length;
  for (let ep = 0; ep < epochs; ep++) {
    const grad = Array(d + 1).fill(0);
    for (let i = 0; i < n; i++) {
      const xf = feat(Xtr[i]);
      const pred = w.reduce((s, wj, j) => s + wj * xf[j], 0);
      const err = pred - ytr[i];
      for (let j = 0; j <= d; j++) grad[j] += err * xf[j];
    }
    for (let j = 0; j <= d; j++) w[j] -= (lr / n) * grad[j];
  }
  return Xte.map((x) => { const xf = feat(x); return w.reduce((s, wj, j) => s + wj * xf[j], 0); });
}

// ---------- metrics ----------
function classMetrics(yTrue, yPred, K) {
  const cm = Array.from({ length: K }, () => Array(K).fill(0));
  for (let i = 0; i < yTrue.length; i++) cm[yTrue[i]][yPred[i]]++;
  let correct = 0; for (let k = 0; k < K; k++) correct += cm[k][k];
  const accuracy = correct / yTrue.length;
  let pSum = 0, rSum = 0, fSum = 0, valid = 0;
  for (let k = 0; k < K; k++) {
    const tp = cm[k][k];
    const fp = cm.reduce((s, row, i) => s + (i !== k ? row[k] : 0), 0);
    const fn = cm[k].reduce((s, v, i) => s + (i !== k ? v : 0), 0);
    const prec = tp + fp ? tp / (tp + fp) : 0;
    const rec = tp + fn ? tp / (tp + fn) : 0;
    const f1 = prec + rec ? 2 * prec * rec / (prec + rec) : 0;
    if (cm[k].reduce((a, b) => a + b, 0) > 0) { pSum += prec; rSum += rec; fSum += f1; valid++; }
  }
  return {
    accuracy: r4(accuracy),
    precision: r4(pSum / (valid || 1)),
    recall: r4(rSum / (valid || 1)),
    f1_score: r4(fSum / (valid || 1)),
    confusion_matrix: cm,
  };
}
function regMetrics(yTrue, yPred) {
  const m = mean(yTrue);
  const ssTot = yTrue.reduce((s, v) => s + (v - m) ** 2, 0) || 1;
  const ssRes = yTrue.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0);
  const r2 = 1 - ssRes / ssTot;
  const rmse = Math.sqrt(ssRes / yTrue.length);
  const mae = mean(yTrue.map((v, i) => Math.abs(v - yPred[i])));
  const mape = mean(yTrue.map((v, i) => (v !== 0 ? Math.abs((v - yPred[i]) / v) : 0))) * 100;
  return { r2_score: r4(r2), rmse: r2num(rmse), mae: r2num(mae), mape: r2num(mape) };
}
const r4 = (v) => Number((v || 0).toFixed(4));
const r2num = (v) => Number((v || 0).toFixed(3));

// ---------- public API ----------
export function runRealClassification(rows, targetColumn, columnInfo, splitRatio = 0.2, selectedModel = 'all') {
  const rand = seededRand(12345);
  const ds = buildDataset(rows, targetColumn, columnInfo, 'classification');
  if (ds.X.length < 20 || !ds.classes || ds.classes.length < 2) {
    return { error: true, message: 'Dados insuficientes para classificação (mínimo 20 linhas e 2 classes na coluna-alvo).' };
  }
  const K = ds.classes.length;
  const { Xtr, ytr, Xte, yte } = split(ds.X, ds.y, splitRatio, rand);

  const importance = {};
  const candidates = {
    'Regressão Logística': () => softmaxRegression(Xtr, ytr, Xte, K),
    'Árvore de Decisão': () => decisionTree(Xtr, ytr, Xte, 'classification', importance),
    'Random Forest': () => { const m = fitRandomForest(Xtr, ytr, 'classification', rand); return Xte.map((x) => m.predict(x)); },
    'Gradient Boosting': () => { const m = fitGBClass(Xtr, ytr, K); return Xte.map((x) => m.predict(x)); },
    'SVM': () => { const m = fitSVM(Xtr, ytr, K); return Xte.map((x) => m.predict(x)); },
    'KNN': () => knn(Xtr, ytr, Xte, 5, 'classification', rand),
    'Naive Bayes': () => gaussianNB(Xtr, ytr, Xte, K),
  };
  const chosen = selectedModel && selectedModel !== 'all' ? pickModels(candidates, selectedModel) : candidates;

  const leaderboard = [];
  for (const [name, fn] of Object.entries(chosen)) {
    const t0 = performance.now();
    const pred = fn();
    const { confusion_matrix, ...met } = classMetrics(yte, pred, K);
    leaderboard.push({ name, metrics: { ...met, training_time: Number(((performance.now() - t0) / 1000).toFixed(2)) }, confusion_matrix });
  }
  // ensure tree importance exists
  if (!Object.keys(importance).length) decisionTree(Xtr, ytr, [Xte[0]], 'classification', importance);

  leaderboard.sort((a, b) => b.metrics.f1_score - a.metrics.f1_score);
  const best = leaderboard[0];
  const fi = featureImportance(importance, ds.featureNames);

  const interpretation = `**Classificação real concluída** (${ds.X.length.toLocaleString('pt-BR')} linhas, ${K} classes)

Melhor modelo: **${best.name}** — Acurácia **${(best.metrics.accuracy * 100).toFixed(1)}%**, F1 **${(best.metrics.f1_score * 100).toFixed(1)}%** (avaliado em ${yte.length} amostras de teste).

Classes: ${ds.classes.join(', ')}. Top features: ${fi.slice(0, 3).map((f) => `**${f.feature}**`).join(', ') || '—'}.`;

  return {
    metrics: best.metrics,
    models_comparison: leaderboard,
    feature_importance: fi,
    confusion_matrix: best.confusion_matrix,
    class_labels: ds.classes,
    interpretation,
    best_model: best.name,
    trained_on: ds.X.length,
    test_size: yte.length,
    recommendations: [
      `Modelo recomendado: ${best.name}`,
      fi[0] ? `Feature mais influente: ${fi[0].feature}` : 'Avalie mais features',
      'Métricas calculadas sobre conjunto de teste real (holdout).',
    ],
  };
}

export function runRealRegression(rows, targetColumn, columnInfo, splitRatio = 0.2, selectedModel = 'all') {
  const rand = seededRand(54321);
  const ds = buildDataset(rows, targetColumn, columnInfo, 'regression');
  if (ds.X.length < 20) return { error: true, message: 'Dados insuficientes para regressão (mínimo 20 linhas com alvo numérico).' };
  const { Xtr, ytr, Xte, yte } = split(ds.X, ds.y, splitRatio, rand);

  const importance = {};
  const candidates = {
    'Regressão Linear': () => linearRegression(Xtr, ytr, Xte),
    'Ridge': () => { const m = fitRidge(Xtr, ytr); return Xte.map((x) => m.predict(x)); },
    'Lasso': () => { const m = fitLasso(Xtr, ytr); return Xte.map((x) => m.predict(x)); },
    'Árvore de Decisão': () => decisionTree(Xtr, ytr, Xte, 'regression', importance),
    'Random Forest': () => { const m = fitRandomForest(Xtr, ytr, 'regression', rand); return Xte.map((x) => m.predict(x)); },
    'Gradient Boosting': () => { const m = fitGBReg(Xtr, ytr); return Xte.map((x) => m.predict(x)); },
    'KNN': () => knn(Xtr, ytr, Xte, 5, 'regression', rand),
  };
  const chosen = selectedModel && selectedModel !== 'all' ? pickModels(candidates, selectedModel) : candidates;

  const leaderboard = [];
  for (const [name, fn] of Object.entries(chosen)) {
    const t0 = performance.now();
    const pred = fn();
    const met = regMetrics(yte, pred);
    leaderboard.push({ name, metrics: { ...met, training_time: Number(((performance.now() - t0) / 1000).toFixed(2)) } });
  }
  if (!Object.keys(importance).length) decisionTree(Xtr, ytr, [Xte[0]], 'regression', importance);

  leaderboard.sort((a, b) => b.metrics.r2_score - a.metrics.r2_score);
  const best = leaderboard[0];
  const fi = featureImportance(importance, ds.featureNames);

  const interpretation = `**Regressão real concluída** (${ds.X.length.toLocaleString('pt-BR')} linhas)

Melhor modelo: **${best.name}** — R² **${(best.metrics.r2_score * 100).toFixed(1)}%**, RMSE **${best.metrics.rmse}** (teste com ${yte.length} amostras).

Top features: ${fi.slice(0, 3).map((f) => `**${f.feature}**`).join(', ') || '—'}.`;

  return {
    metrics: best.metrics,
    models_comparison: leaderboard,
    feature_importance: fi,
    interpretation,
    best_model: best.name,
    trained_on: ds.X.length,
    test_size: yte.length,
    recommendations: [
      `Modelo recomendado: ${best.name}`,
      best.metrics.r2_score < 0.5 ? 'R² baixo — considere mais features ou transformações.' : 'Boa capacidade preditiva.',
      'Métricas calculadas sobre conjunto de teste real (holdout).',
    ],
  };
}

export function runRealClustering(rows, columnInfo, k = 3) {
  const ds = buildDataset(rows, '__none__', columnInfo, 'regression'); // all columns numeric-encoded
  const X = ds.X;
  if (X.length < 10 || X[0].length < 2) return { error: true, message: 'Clustering requer ≥ 10 linhas e ≥ 2 features numéricas.' };
  const rand = seededRand(777);
  const n = X.length, d = X[0].length;
  let centroids = shuffleIdx(n, rand).slice(0, k).map((i) => X[i].slice());
  let labels = Array(n).fill(0);
  for (let iter = 0; iter < 20; iter++) {
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) { let s = 0; for (let j = 0; j < d; j++) s += (X[i][j] - centroids[c][j]) ** 2; if (s < bd) { bd = s; best = c; } }
      labels[i] = best;
    }
    const sums = Array.from({ length: k }, () => Array(d).fill(0)); const cnt = Array(k).fill(0);
    for (let i = 0; i < n; i++) { cnt[labels[i]]++; for (let j = 0; j < d; j++) sums[labels[i]][j] += X[i][j]; }
    for (let c = 0; c < k; c++) if (cnt[c]) centroids[c] = sums[c].map((v) => v / cnt[c]);
  }
  let inertia = 0;
  for (let i = 0; i < n; i++) { for (let j = 0; j < d; j++) inertia += (X[i][j] - centroids[labels[i]][j]) ** 2; }
  const sizes = Array(k).fill(0); labels.forEach((l) => sizes[l]++);
  return {
    metrics: { inertia: r2num(inertia), clusters: k, silhouette: r4(silhouette(X, labels, rand)) },
    cluster_sizes: sizes,
    interpretation: `**Clustering real (K-Means)** — ${n.toLocaleString('pt-BR')} pontos agrupados em ${k} clusters. Tamanhos: ${sizes.join(', ')}.`,
    best_model: 'K-Means',
    trained_on: n,
    recommendations: ['Ajuste o número de clusters (k) conforme o silhouette.', 'Padronize features antes de agrupar (já aplicado).'],
  };
}

function silhouette(X, labels, rand) {
  const idx = X.length > 800 ? shuffleIdx(X.length, rand).slice(0, 800) : X.map((_, i) => i);
  let total = 0;
  for (const i of idx) {
    const same = [], other = {};
    for (const j of idx) { if (i === j) continue; let s = 0; for (let f = 0; f < X[i].length; f++) s += (X[i][f] - X[j][f]) ** 2; s = Math.sqrt(s); if (labels[j] === labels[i]) same.push(s); else { (other[labels[j]] = other[labels[j]] || []).push(s); } }
    const a = same.length ? mean(same) : 0;
    const b = Object.values(other).length ? Math.min(...Object.values(other).map((arr) => mean(arr))) : 0;
    total += (b - a) / (Math.max(a, b) || 1);
  }
  return total / idx.length;
}

function featureImportance(importance, names) {
  const total = Object.values(importance).reduce((a, b) => a + b, 0) || 1;
  return names.map((feature, j) => ({ feature, score: Number(((importance[j] || 0) / total).toFixed(4)) }))
    .sort((a, b) => b.score - a.score).slice(0, 15);
}

function pickModels(candidates, selectedModel) {
  const map = {
    logistic: 'Regressão Logística', logistic_regression: 'Regressão Logística', linear: 'Regressão Linear',
    linear_regression: 'Regressão Linear', decision_tree: 'Árvore de Decisão', tree: 'Árvore de Decisão',
    random_forest: 'Random Forest', gradient_boosting: 'Gradient Boosting', svm: 'SVM', svr: 'SVM',
    knn: 'KNN', naive_bayes: 'Naive Bayes', ridge: 'Ridge', lasso: 'Lasso',
  };
  const wanted = map[selectedModel];
  if (wanted && candidates[wanted]) return { [wanted]: candidates[wanted] };
  return candidates;
}

// ---------- reliability: cross-validation, permutation importance, class balance ----------

// Macro-F1 + accuracy from encoded labels.
function scoreClass(yTrue, yPred, K) {
  const cm = Array.from({ length: K }, () => Array(K).fill(0));
  for (let i = 0; i < yTrue.length; i++) cm[yTrue[i]][yPred[i]]++;
  let correct = 0; for (let k = 0; k < K; k++) correct += cm[k][k];
  let fSum = 0, valid = 0;
  for (let k = 0; k < K; k++) {
    const tp = cm[k][k];
    const fp = cm.reduce((s, row, i) => s + (i !== k ? row[k] : 0), 0);
    const fn = cm[k].reduce((s, v, i) => s + (i !== k ? v : 0), 0);
    const prec = tp + fp ? tp / (tp + fp) : 0, rec = tp + fn ? tp / (tp + fn) : 0;
    if (cm[k].reduce((a, b) => a + b, 0) > 0) { fSum += prec + rec ? 2 * prec * rec / (prec + rec) : 0; valid++; }
  }
  return { accuracy: correct / yTrue.length, f1: fSum / (valid || 1) };
}
function r2of(yTrue, yPred) {
  const m = mean(yTrue), ssTot = yTrue.reduce((s, v) => s + (v - m) ** 2, 0) || 1;
  const ssRes = yTrue.reduce((s, v, i) => s + (v - yPred[i]) ** 2, 0);
  return 1 - ssRes / ssTot;
}
const stdOf = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((v) => (v - m) ** 2))); };

// Stratified-ish k-fold cross-validation with mean ± std of the key metric.
export function crossValidate(rows, targetColumn, columnInfo, task, modelName, k = 5) {
  const ds = buildDataset(rows, targetColumn, columnInfo, task);
  if (ds.X.length < 30) return { error: true, message: 'Validação cruzada requer ≥ 30 linhas.' };
  const K = ds.classes ? ds.classes.length : 0;
  if (task === 'classification' && K < 2) return { error: true, message: 'A coluna-alvo precisa de ≥ 2 classes.' };
  const rand = seededRand(20240808);
  const idx = shuffleIdx(ds.X.length, rand);
  const folds = Array.from({ length: k }, () => []);
  idx.forEach((v, i) => folds[i % k].push(v));

  const primary = [], secondary = [];
  for (let f = 0; f < k; f++) {
    const testI = new Set(folds[f]);
    const Xtr = [], ytr = [], Xte = [], yte = [];
    for (let i = 0; i < ds.X.length; i++) (testI.has(i) ? (Xte.push(ds.X[i]), yte.push(ds.y[i])) : (Xtr.push(ds.X[i]), ytr.push(ds.y[i])));
    if (Xtr.length < 5 || !Xte.length) continue;
    const model = fitByName(Xtr, ytr, task, modelName, K);
    const pred = Xte.map((x) => model.predict(x));
    if (task === 'classification') { const s = scoreClass(yte, pred, K); primary.push(s.f1); secondary.push(s.accuracy); }
    else { primary.push(r2of(yte, pred)); secondary.push(Math.sqrt(mean(yte.map((v, i) => (v - pred[i]) ** 2)))); }
  }
  return {
    task, k: primary.length, model: normalizeModelName(modelName, task),
    metric: task === 'classification' ? 'F1 (macro)' : 'R²',
    secondary_metric: task === 'classification' ? 'Acurácia' : 'RMSE',
    folds: primary.map((v, i) => ({ fold: i + 1, primary: r4(v), secondary: r4(secondary[i]) })),
    mean: r4(mean(primary)), std: r4(stdOf(primary)),
    secondary_mean: r4(mean(secondary)), secondary_std: r4(stdOf(secondary)),
    trained_on: ds.X.length,
  };
}

// Permutation importance at the ORIGINAL-feature level (groups one-hot columns).
export function permutationImportance(rows, targetColumn, columnInfo, task, modelName, repeats = 3) {
  const ds = buildDataset(rows, targetColumn, columnInfo, task);
  if (ds.X.length < 30) return { error: true, message: 'Importância por permutação requer ≥ 30 linhas.' };
  const K = ds.classes ? ds.classes.length : 0;
  const rand = seededRand(13131);
  const { Xtr, ytr, Xte, yte } = split(ds.X, ds.y, 0.3, rand);
  const model = fitByName(Xtr, ytr, task, modelName, K);
  const score = (X) => { const p = X.map((x) => model.predict(x)); return task === 'classification' ? scoreClass(yte, p, K).accuracy : r2of(yte, p); };
  const baseline = score(Xte);

  // map each original feature to its encoded column indices
  const groups = []; let off = 0;
  ds.featCols.forEach((c) => {
    const width = isNumericType(c.type) ? 1 : (ds.encoders[c.name] || []).length;
    if (width > 0) groups.push({ name: c.name, cols: Array.from({ length: width }, (_, i) => off + i) });
    off += width;
  });

  const out = groups.map((g) => {
    let drop = 0;
    for (let rep = 0; rep < repeats; rep++) {
      const perm = shuffleIdx(Xte.length, rand);
      const Xp = Xte.map((row, i) => { const r = row.slice(); g.cols.forEach((cj) => { r[cj] = Xte[perm[i]][cj]; }); return r; });
      drop += baseline - score(Xp);
    }
    return { feature: g.name, importance: r4(drop / repeats) };
  }).sort((a, b) => b.importance - a.importance);

  return { task, baseline: r4(baseline), metric: task === 'classification' ? 'Acurácia' : 'R²', importances: out, trained_on: ds.X.length };
}

// Class distribution + imbalance diagnostics (classification only).
export function classBalance(rows, targetColumn) {
  const counts = {};
  rows.forEach((r) => { const v = r[targetColumn]; if (v !== undefined && v !== null && v !== '') { const s = String(v); counts[s] = (counts[s] || 0) + 1; } });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, c]) => s + c, 0) || 1;
  if (!entries.length) return { error: true, message: 'Coluna-alvo sem valores.' };
  const classes = entries.map(([label, count]) => ({ label, count, pct: Number(((count / total) * 100).toFixed(1)) }));
  const maxC = entries[0][1], minC = entries[entries.length - 1][1];
  const ratio = minC ? Number((maxC / minC).toFixed(2)) : Infinity;
  const minorityPct = Number(((minC / total) * 100).toFixed(1));
  return {
    total, classes, imbalance_ratio: ratio, minority_pct: minorityPct,
    imbalanced: ratio >= 3 || minorityPct < 15,
    severity: ratio >= 10 || minorityPct < 5 ? 'alto' : ratio >= 3 || minorityPct < 15 ? 'moderado' : 'ok',
  };
}
