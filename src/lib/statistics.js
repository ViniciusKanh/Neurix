/**
 * statistics.js — classical hypothesis tests with real p-values.
 * Pure JS, browser-side. p-values use the regularized incomplete beta/gamma
 * functions (Numerical Recipes style), so they are genuine, not approximations.
 */

// ---------- special functions ----------
function gammaln(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x, tmp = x + 5.5; tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (let j = 0; j < 6; j++) { y += 1; ser += c[j] / y; }
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// Regularized incomplete beta I_x(a,b)
function betai(a, b, x) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  const bt = Math.exp(gammaln(a + b) - gammaln(a) - gammaln(b) + a * Math.log(x) + b * Math.log(1 - x));
  if (x < (a + 1) / (a + b + 2)) return bt * betacf(a, b, x) / a;
  return 1 - bt * betacf(b, a, 1 - x) / b;
}
function betacf(a, b, x) {
  const MAXIT = 200, EPS = 3e-12, FPMIN = 1e-300;
  let qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN; d = 1 / d; let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

// Lower regularized incomplete gamma P(a,x) — for chi-square CDF.
function gammap(a, x) {
  if (x <= 0) return 0;
  if (x < a + 1) { // series
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 200; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-12) break; }
    return sum * Math.exp(-x + a * Math.log(x) - gammaln(a));
  }
  // continued fraction for Q, return 1-Q
  const FPMIN = 1e-300; let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2; d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; const del = d * c; h *= del; if (Math.abs(del - 1) < 1e-12) break;
  }
  return 1 - Math.exp(-x + a * Math.log(x) - gammaln(a)) * h;
}

// CDFs → two-sided / upper-tail p-values
const studentT_p2 = (t, df) => betai(df / 2, 0.5, df / (df + t * t)); // two-sided
const fDist_p = (f, d1, d2) => f <= 0 ? 1 : betai(d2 / 2, d1 / 2, d2 / (d2 + d1 * f)); // upper tail
const chi2_p = (x, k) => x <= 0 ? 1 : 1 - gammap(k / 2, x / 2); // upper tail

// ---------- helpers ----------
const nums = (a) => a.map((v) => parseFloat(v)).filter((v) => !isNaN(v));
const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const variance = (a, m) => a.reduce((s, v) => s + (v - m) ** 2, 0) / ((a.length - 1) || 1);
const sig = (p) => p < 0.001 ? 'p < 0.001 (altíssima significância)' : p < 0.01 ? `p = ${p.toFixed(4)} (muito significativo)` : p < 0.05 ? `p = ${p.toFixed(4)} (significativo)` : `p = ${p.toFixed(4)} (não significativo)`;
const r4 = (v) => Number((v ?? 0).toFixed(4));

// ---------- tests ----------

// Welch's two-sample t-test (unequal variances).
export function tTest2(aRaw, bRaw, alpha = 0.05) {
  const a = nums(aRaw), b = nums(bRaw);
  if (a.length < 2 || b.length < 2) return { error: true, message: 'Cada grupo precisa de ≥ 2 valores numéricos.' };
  const ma = mean(a), mb = mean(b), va = variance(a, ma), vb = variance(b, mb);
  const se = Math.sqrt(va / a.length + vb / b.length);
  const t = se === 0 ? 0 : (ma - mb) / se;
  const df = se === 0 ? a.length + b.length - 2 : (va / a.length + vb / b.length) ** 2 / (((va / a.length) ** 2) / (a.length - 1) + ((vb / b.length) ** 2) / (b.length - 1));
  const p = studentT_p2(Math.abs(t), df);
  return {
    test: "Teste t de Welch (2 amostras)", statistic: r4(t), df: r4(df), p_value: r4(p),
    groups: [{ n: a.length, mean: r4(ma), sd: r4(Math.sqrt(va)) }, { n: b.length, mean: r4(mb), sd: r4(Math.sqrt(vb)) }],
    significant: p < alpha,
    interpretation: `Diferença de médias ${r4(ma - mb)} — ${sig(p)}. ${p < alpha ? 'As médias dos dois grupos diferem de forma estatisticamente significativa.' : 'Não há evidência de diferença entre as médias.'}`,
  };
}

// One-way ANOVA across k groups.
export function anova1(groupsRaw, alpha = 0.05) {
  const groups = groupsRaw.map(nums).filter((g) => g.length >= 2);
  if (groups.length < 2) return { error: true, message: 'São necessários ≥ 2 grupos com ≥ 2 valores.' };
  const all = groups.flat(); const grand = mean(all); const N = all.length; const k = groups.length;
  let ssb = 0, ssw = 0;
  groups.forEach((g) => { const m = mean(g); ssb += g.length * (m - grand) ** 2; g.forEach((v) => { ssw += (v - m) ** 2; }); });
  const dfb = k - 1, dfw = N - k;
  const msb = ssb / dfb, msw = ssw / dfw;
  const F = msw === 0 ? 0 : msb / msw;
  const p = fDist_p(F, dfb, dfw);
  return {
    test: 'ANOVA de um fator', statistic: r4(F), df1: dfb, df2: dfw, p_value: r4(p),
    group_means: groups.map((g) => r4(mean(g))), significant: p < alpha,
    interpretation: `F(${dfb}, ${dfw}) = ${r4(F)} — ${sig(p)}. ${p < alpha ? 'Pelo menos um grupo tem média diferente dos demais.' : 'Não há evidência de diferença entre as médias dos grupos.'}`,
  };
}

// Chi-square test of independence between two categorical columns.
export function chiSquareIndependence(colA, colB, alpha = 0.05) {
  const pairs = colA.map((v, i) => [String(v ?? ''), String(colB[i] ?? '')]).filter(([x, y]) => x !== '' && y !== '');
  if (pairs.length < 5) return { error: true, message: 'Dados insuficientes.' };
  const rowsCats = [...new Set(pairs.map((p) => p[0]))], colCats = [...new Set(pairs.map((p) => p[1]))];
  if (rowsCats.length < 2 || colCats.length < 2) return { error: true, message: 'Cada variável precisa de ≥ 2 categorias.' };
  const obs = rowsCats.map(() => colCats.map(() => 0));
  pairs.forEach(([x, y]) => { obs[rowsCats.indexOf(x)][colCats.indexOf(y)]++; });
  const rowSum = obs.map((r) => r.reduce((a, b) => a + b, 0));
  const colSum = colCats.map((_, j) => obs.reduce((a, r) => a + r[j], 0));
  const n = pairs.length;
  let chi = 0;
  for (let i = 0; i < rowsCats.length; i++) for (let j = 0; j < colCats.length; j++) { const e = rowSum[i] * colSum[j] / n; if (e > 0) chi += (obs[i][j] - e) ** 2 / e; }
  const df = (rowsCats.length - 1) * (colCats.length - 1);
  const p = chi2_p(chi, df);
  const cramersV = Math.sqrt(chi / (n * Math.min(rowsCats.length - 1, colCats.length - 1)));
  return {
    test: 'Qui-quadrado de independência', statistic: r4(chi), df, p_value: r4(p), cramers_v: r4(cramersV),
    row_labels: rowsCats, col_labels: colCats, observed: obs, significant: p < alpha,
    interpretation: `χ²(${df}) = ${r4(chi)}, V de Cramér = ${r4(cramersV)} — ${sig(p)}. ${p < alpha ? 'As duas variáveis são associadas (não independentes).' : 'Não há evidência de associação entre as variáveis.'}`,
  };
}

// Normality via skewness/kurtosis (Jarque-Bera), p from chi-square(df=2).
export function normality(colRaw, alpha = 0.05) {
  const a = nums(colRaw);
  if (a.length < 8) return { error: true, message: 'São necessários ≥ 8 valores numéricos.' };
  const m = mean(a), n = a.length; const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / n);
  const skew = a.reduce((s, v) => s + ((v - m) / sd) ** 3, 0) / n;
  const kurt = a.reduce((s, v) => s + ((v - m) / sd) ** 4, 0) / n; // raw (normal=3)
  const jb = n / 6 * (skew ** 2 + (kurt - 3) ** 2 / 4);
  const p = chi2_p(jb, 2);
  return {
    test: 'Normalidade (Jarque-Bera)', statistic: r4(jb), p_value: r4(p), skewness: r4(skew), kurtosis: r4(kurt), n,
    significant: p < alpha,
    interpretation: `Assimetria ${r4(skew)}, curtose ${r4(kurt)} — ${sig(p)}. ${p < alpha ? 'A distribuição difere significativamente de uma normal.' : 'Não há evidência contra a normalidade (compatível com distribuição normal).'}`,
  };
}

// Pearson correlation significance test.
export function correlationTest(xRaw, yRaw, alpha = 0.05) {
  const pairs = xRaw.map((v, i) => [parseFloat(v), parseFloat(yRaw[i])]).filter(([x, y]) => !isNaN(x) && !isNaN(y));
  if (pairs.length < 4) return { error: true, message: 'São necessários ≥ 4 pares numéricos.' };
  const xs = pairs.map((p) => p[0]), ys = pairs.map((p) => p[1]);
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0; pairs.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
  const r = (sxx && syy) ? sxy / Math.sqrt(sxx * syy) : 0;
  const n = pairs.length; const df = n - 2;
  const t = Math.abs(r) >= 1 ? Infinity : r * Math.sqrt(df / (1 - r * r));
  const p = isFinite(t) ? studentT_p2(Math.abs(t), df) : 0;
  const strength = Math.abs(r) >= 0.7 ? 'forte' : Math.abs(r) >= 0.4 ? 'moderada' : Math.abs(r) >= 0.2 ? 'fraca' : 'muito fraca';
  return {
    test: 'Significância da correlação de Pearson', statistic: r4(t), df, p_value: r4(p), r: r4(r), n,
    significant: p < alpha,
    interpretation: `r = ${r4(r)} (correlação ${strength} ${r > 0 ? 'positiva' : 'negativa'}) — ${sig(p)}. ${p < alpha ? 'A correlação é estatisticamente significativa.' : 'A correlação não é estatisticamente significativa.'}`,
  };
}

export const _internal = { betai, gammap, studentT_p2, fDist_p, chi2_p };
