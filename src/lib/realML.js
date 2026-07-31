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
  const featCols = hasTarget ? cols.filter((c) => c.name !== targetColumn) : cols;
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

  return { X: Xs, Xraw: X, y, featureNames, classes, means, stds, targetInfo };
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
    'Árvore de Decisão': () => decisionTree(Xtr, ytr, Xte, 'regression', importance),
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
    decision_tree: 'Árvore de Decisão', tree: 'Árvore de Decisão', knn: 'KNN', naive_bayes: 'Naive Bayes',
  };
  const wanted = map[selectedModel];
  if (wanted && candidates[wanted]) return { [wanted]: candidates[wanted] };
  return candidates;
}
