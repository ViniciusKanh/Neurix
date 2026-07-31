/**
 * Local time-series engine — deterministic, no AI.
 * Computes trend, seasonality, STL-style decomposition, anomalies and forecast
 * from the project's data sample. Returns the shape the TimeSeries page expects.
 */

const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const std = (a) => {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1));
};

function autocorr(a, lag) {
  const n = a.length;
  if (lag >= n) return 0;
  const m = mean(a);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) den += (a[i] - m) ** 2;
  for (let i = 0; i < n - lag; i++) num += (a[i] - m) * (a[i + lag] - m);
  return den > 0 ? num / den : 0;
}

function linreg(y) {
  const n = y.length;
  const xs = y.map((_, i) => i);
  const mx = mean(xs), my = mean(y);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (y[i] - my); den += (xs[i] - mx) ** 2; }
  const b = den > 0 ? num / den : 0;
  const a = my - b * mx;
  return { a, b };
}

function movingAverage(y, w) {
  const out = [];
  for (let i = 0; i < y.length; i++) {
    const from = Math.max(0, i - w + 1);
    out.push(mean(y.slice(from, i + 1)));
  }
  return out;
}

function nextPeriods(labels, horizon) {
  const last = labels[labels.length - 1];
  const prev = labels[labels.length - 2];
  const dLast = Date.parse(last), dPrev = Date.parse(prev);
  if (!isNaN(dLast) && !isNaN(dPrev)) {
    const step = dLast - dPrev || 86400000;
    return Array.from({ length: horizon }, (_, i) => new Date(dLast + step * (i + 1)).toISOString().slice(0, 10));
  }
  const nLast = parseFloat(last), nPrev = parseFloat(prev);
  if (!isNaN(nLast) && !isNaN(nPrev)) {
    const step = nLast - nPrev || 1;
    return Array.from({ length: horizon }, (_, i) => String(+(nLast + step * (i + 1)).toFixed(2)));
  }
  return Array.from({ length: horizon }, (_, i) => `t+${i + 1}`);
}

export function runTimeSeries(project, { targetColumn, dateColumn, horizon = 12, model = 'exp_smoothing', window = 7 }) {
  horizon = Math.max(1, Math.min(120, parseInt(horizon) || 12));
  window = Math.max(2, Math.min(60, parseInt(window) || 7));

  const rows = project.data_sample || [];
  let points = rows
    .map((r, i) => ({
      period: dateColumn && r[dateColumn] != null && r[dateColumn] !== '' ? String(r[dateColumn]) : String(i + 1),
      value: parseFloat(r[targetColumn]),
      _d: dateColumn ? Date.parse(r[dateColumn]) : i,
    }))
    .filter((p) => !isNaN(p.value));

  if (dateColumn && points.every((p) => !isNaN(p._d))) points.sort((a, b) => a._d - b._d);

  const values = points.map((p) => p.value);
  const labels = points.map((p) => p.period);
  const n = values.length;

  if (n < 4) {
    return { error: true, message: `Série muito curta (${n} pontos válidos). São necessários ao menos 4 pontos numéricos na coluna "${targetColumn}". Reenvie o dataset — agora guardamos mais linhas para análise temporal.` };
  }

  // --- statistics ---
  const m = mean(values), sd = std(values);
  const firstHalf = mean(values.slice(0, Math.floor(n / 2)));
  const secondHalf = mean(values.slice(Math.floor(n / 2)));
  const stationarity = sd === 0 ? true : Math.abs(secondHalf - firstHalf) < 0.5 * sd;
  const ac1 = autocorr(values, 1);

  // --- trend ---
  const { a, b } = linreg(values);
  const totalChange = b * (n - 1);
  let trend;
  if (Math.abs(totalChange) < 0.5 * sd || sd === 0) trend = 'stable';
  else trend = b > 0 ? 'ascending' : 'descending';

  // --- seasonality ---
  const candidates = [4, 6, 7, 12, 24, 52].filter((p) => p < n / 2);
  let best = { lag: 0, ac: 0 };
  for (const lag of candidates) {
    const ac = autocorr(values, lag);
    if (ac > best.ac) best = { lag, ac };
  }
  const seasonDetected = best.ac > 0.35 && best.lag > 0;
  const typeMap = { 4: 'quarterly', 6: 'semestral', 7: 'weekly', 12: 'monthly', 24: 'daily', 52: 'annual' };
  const seasonality = {
    detected: seasonDetected,
    period: seasonDetected ? best.lag : 0,
    type: seasonDetected ? (typeMap[best.lag] || 'seasonal') : 'none',
    strength: Number(best.ac.toFixed(3)),
    description: seasonDetected
      ? `Padrão sazonal a cada ${best.lag} períodos (autocorrelação ${best.ac.toFixed(2)}).`
      : 'Sem sazonalidade relevante detectada.',
  };
  if (trend === 'stable' && seasonDetected) trend = 'cyclical';

  // --- moving average + decomposition ---
  const ma = movingAverage(values, window);
  const p = seasonDetected ? best.lag : window;
  const trendComp = movingAverage(values, Math.max(p, window));
  const detrended = values.map((v, i) => v - trendComp[i]);
  const seasonalAvg = Array(p).fill(0).map((_, k) => {
    const g = detrended.filter((_, i) => i % p === k);
    return seasonDetected ? mean(g) : 0;
  });
  const seasonalComp = values.map((_, i) => seasonalAvg[i % p]);
  const residual = values.map((v, i) => v - trendComp[i] - seasonalComp[i]);
  const residStd = std(residual);

  const mk = (arr) => arr.map((v, i) => ({ period: labels[i], value: Number(v.toFixed(3)) }));

  // --- anomalies (z-score on residual) ---
  const anomalies = [];
  values.forEach((v, i) => {
    const z = residStd > 0 ? residual[i] / residStd : 0;
    if (Math.abs(z) > 2) {
      anomalies.push({
        period: labels[i], value: Number(v.toFixed(3)),
        expected: Number((trendComp[i] + seasonalComp[i]).toFixed(3)),
        z_score: Number(z.toFixed(2)),
        severity: Math.abs(z) > 3 ? 'high' : Math.abs(z) > 2.5 ? 'medium' : 'low',
        description: `Desvio de ${z.toFixed(1)}σ em relação ao esperado.`,
      });
    }
  });

  // --- forecast ---
  const fperiods = nextPeriods(labels, horizon);
  let preds = [];
  let fitted = [];

  if (model === 'linear_trend') {
    fitted = values.map((_, i) => a + b * i);
    preds = fperiods.map((per, h) => a + b * (n + h));
  } else if (model === 'moving_avg') {
    const level = mean(values.slice(-window));
    fitted = values.map((_, i) => (i === 0 ? values[0] : mean(values.slice(Math.max(0, i - window), i))));
    preds = fperiods.map(() => level);
  } else if (model === 'seasonal_naive' && seasonDetected) {
    fitted = values.map((v, i) => (i >= p ? values[i - p] : v));
    preds = fperiods.map((per, h) => values[n - p + (h % p)]);
  } else {
    // exp_smoothing → Holt linear (level + trend)
    const alpha = 0.4, beta = 0.15;
    let level = values[0], tr = values[1] - values[0];
    fitted = [values[0]];
    for (let i = 1; i < n; i++) {
      const prevLevel = level;
      level = alpha * values[i] + (1 - alpha) * (level + tr);
      tr = beta * (level - prevLevel) + (1 - beta) * tr;
      fitted.push(prevLevel + tr);
    }
    preds = fperiods.map((per, h) => level + (h + 1) * tr);
  }

  // in-sample error metrics
  const errs = [], perc = [];
  for (let i = 1; i < n; i++) {
    const e = values[i] - fitted[i];
    errs.push(e);
    if (values[i] !== 0) perc.push(Math.abs(e / values[i]));
  }
  const mae = mean(errs.map(Math.abs));
  const rmse = Math.sqrt(mean(errs.map((e) => e * e)));
  const mape = perc.length ? mean(perc) * 100 : 0;

  const band = 1.96 * (residStd || rmse || sd * 0.1);
  const predictions = preds.map((v, h) => ({
    period: fperiods[h],
    value: Number(v.toFixed(3)),
    lower_bound: Number((v - band * Math.sqrt(h + 1)).toFixed(3)),
    upper_bound: Number((v + band * Math.sqrt(h + 1)).toFixed(3)),
    confidence: Number(Math.max(0.5, 0.95 - 0.03 * h).toFixed(2)),
  }));

  const modelLabel = { moving_avg: 'Média Móvel', exp_smoothing: 'Suavização Exponencial (Holt)', linear_trend: 'Tendência Linear', seasonal_naive: 'Naive Sazonal' }[model] || model;

  // --- insights + analysis ---
  const trendTxt = trend === 'ascending' ? 'crescente' : trend === 'descending' ? 'decrescente' : trend === 'cyclical' ? 'cíclica' : 'estável';
  const insights = [
    `Série com ${n} pontos, média ${m.toFixed(2)} e desvio ${sd.toFixed(2)}.`,
    `Tendência ${trendTxt} (variação total ≈ ${totalChange.toFixed(2)}).`,
    seasonDetected ? `Sazonalidade ${seasonality.type} a cada ${best.lag} períodos.` : 'Sem sazonalidade relevante.',
    `${anomalies.length} anomalia(s) detectada(s) (|z| > 2).`,
    `Previsão por ${modelLabel}: MAPE ${mape.toFixed(1)}% (in-sample).`,
    stationarity ? 'Série aproximadamente estacionária.' : 'Série não-estacionária (média muda ao longo do tempo).',
  ];

  const ai_analysis = `## Análise da Série Temporal — ${targetColumn}

**Resumo:** ${n} observações, média **${m.toFixed(2)}**, desvio **${sd.toFixed(2)}**.

### Tendência
A série é **${trendTxt}** (inclinação ${b.toFixed(3)} por período; variação total ≈ ${totalChange.toFixed(2)}).

### Sazonalidade
${seasonDetected ? `Detectada sazonalidade **${seasonality.type}** (a cada ${best.lag} períodos, força ${best.ac.toFixed(2)}).` : 'Nenhum padrão sazonal relevante foi identificado.'}

### Anomalias
${anomalies.length ? `Foram encontradas **${anomalies.length}** anomalia(s) (desvios acima de 2σ do esperado).` : 'Nenhuma anomalia significativa.'}

### Previsão (${modelLabel})
Horizonte de **${horizon}** períodos. Qualidade in-sample: MAE ${mae.toFixed(2)}, RMSE ${rmse.toFixed(2)}, MAPE ${mape.toFixed(1)}%.
${mape < 10 ? '> Erro baixo — previsão confiável.' : mape < 25 ? '> Erro moderado — use com cautela.' : '> Erro alto — a série é difícil de prever com este modelo; teste outro modelo ou colete mais dados.'}

### Estatística
Autocorrelação (lag 1): ${ac1.toFixed(2)}. Série ${stationarity ? 'aproximadamente estacionária' : 'não-estacionária'}.`;

  return {
    series_data: values.map((v, i) => ({ period: labels[i], value: Number(v.toFixed(3)), moving_avg: Number(ma[i].toFixed(3)) })),
    trend,
    trend_magnitude: Number(b.toFixed(4)),
    seasonality,
    stl_decomposition: {
      trend_component: mk(trendComp),
      seasonal_component: mk(seasonalComp),
      residual_component: mk(residual),
    },
    anomalies,
    anomaly_threshold: 2,
    forecast: { model: modelLabel, horizon, predictions, mae: Number(mae.toFixed(3)), rmse: Number(rmse.toFixed(3)), mape: Number(mape.toFixed(2)), model_description: `${modelLabel} aplicado sobre ${n} observações.` },
    statistics: {
      mean: Number(m.toFixed(3)), std: Number(sd.toFixed(3)),
      min: Math.min(...values), max: Math.max(...values),
      autocorrelation: Number(ac1.toFixed(3)), stationarity, stationarity_test: 'Comparação de médias por metade (heurística)',
    },
    insights,
    ai_analysis,
  };
}
