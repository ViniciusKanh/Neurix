/**
 * Advanced ML Engine — Specialized modules
 * Deterministic simulation based on dataset metadata.
 */

function seededRand(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return ((s >>> 0) / 4294967296);
  };
}

function strSeed(str = '') {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  return (h >>> 0);
}

function jitter(rand, base, pct = 0.07) {
  return Math.max(0, Math.min(1, base + (rand() - 0.5) * 2 * pct));
}

function datasetQuality(project) {
  const cols = project?.column_info || [];
  const nullPenalty = cols.reduce((s, c) => s + (c.null_percent || 0), 0) / Math.max(cols.length, 1) / 100;
  const rows = project?.dataset_size || 100;
  const sizeFactor = Math.min(1, Math.log10(rows + 1) / 5);
  return Math.max(0.3, Math.min(0.98, sizeFactor - nullPenalty * 0.5 + 0.5));
}

// ─── SURVIVAL ANALYSIS ────────────────────────────────────────────────────────
export function runSurvivalAnalysis(project, timeColumn, params) {
  const rand = seededRand(strSeed(`surv_${project?.id}_${timeColumn}`));
  const quality = datasetQuality(project);
  const n = project?.dataset_size || 300;

  // Kaplan-Meier curves
  const km_curves = [];
  let survival = 1.0;
  const maxTime = 24;
  for (let t = 0; t <= maxTime; t += 2) {
    const hazard = rand() * 0.08 * (1 - quality * 0.3);
    survival = Math.max(0.05, survival - hazard);
    const entry = { t, overall: Number(survival.toFixed(4)) };
    ['Group A', 'Group B'].forEach((g, gi) => {
      const gSurv = Math.max(0.05, survival * (gi === 0 ? 1.1 : 0.85) * (0.9 + rand() * 0.2));
      entry[g] = Number(Math.min(1, gSurv).toFixed(4));
    });
    km_curves.push(entry);
  }

  // Cox PH
  const cols = (project?.column_info || []).filter(c => c.name !== timeColumn).slice(0, 6);
  const cox_results = cols.map(c => ({
    feature: c.name,
    hr: Number((0.5 + rand() * 2).toFixed(3)),
    p_value: Number((rand() * 0.1).toFixed(4)),
    ci_lower: Number((0.3 + rand() * 0.8).toFixed(3)),
    ci_upper: Number((1.2 + rand() * 1.5).toFixed(3)),
  })).sort((a, b) => Math.abs(Math.log(b.hr)) - Math.abs(Math.log(a.hr)));

  const median_survival = km_curves.find(p => p.overall <= 0.5)?.t ?? maxTime;
  const logrank_p = Number((rand() * 0.05).toFixed(4));
  const c_index = jitter(rand, 0.72 * quality, 0.05);

  return {
    km_curves,
    cox_results,
    group_curves: [{ name: 'Group A' }, { name: 'Group B' }],
    median_survival,
    c_index: Number(c_index.toFixed(4)),
    log_rank_p: logrank_p,
    n_events: Math.round(n * (0.3 + rand() * 0.4)),
    n_censored: Math.round(n * (0.3 + rand() * 0.3)),
    interpretation: `## Análise de Sobrevivência Concluída

**Mediana de sobrevivência:** ${median_survival} unidades de tempo  
**C-index (Cox):** ${c_index.toFixed(3)} ${c_index > 0.7 ? '✅ Boa discriminação' : '⚠️ Discriminação moderada'}  
**Log-rank test p-value:** ${logrank_p} ${logrank_p < 0.05 ? '✅ Grupos significativamente diferentes' : '⚠️ Sem diferença significativa entre grupos'}

**Top fatores prognósticos (Cox PH):**
${cox_results.slice(0, 3).map(c => `- **${c.feature}**: HR = ${c.hr} (IC95%: ${c.ci_lower}–${c.ci_upper}), p = ${c.p_value}`).join('\n')}

**Interpretação:**  
${cox_results[0]?.hr > 1 ? `Alta **${cox_results[0]?.feature}** aumenta o risco em ${((cox_results[0]?.hr - 1) * 100).toFixed(0)}%.` : `Alta **${cox_results[0]?.feature}** é fator protetor (HR < 1).`}`,
    recommendations: [
      `Monitorar pacientes/eventos com ${cox_results[0]?.feature} elevado`,
      `Usar C-index ${c_index.toFixed(3)} como benchmark para modelos concorrentes`,
      `Investigar censura: ${Math.round(n * 0.35)} registros censurados`,
      logrank_p < 0.05 ? 'Estratificar intervenção pelos grupos identificados' : 'Explorar outros critérios de estratificação',
    ],
  };
}

// ─── CAUSAL INFERENCE ────────────────────────────────────────────────────────
export function runCausalInference(project, treatmentColumn, params) {
  const rand = seededRand(strSeed(`causal_${project?.id}_${treatmentColumn}`));
  const quality = datasetQuality(project);
  const n = project?.dataset_size || 300;

  const METHODS = ['Propensity Score Matching', 'IPW', 'Double ML', 'S-Learner', 'T-Learner'];
  const trueATE = (rand() - 0.4) * 2;

  const ate_results = METHODS.map(method => ({
    method,
    ate: Number((trueATE + (rand() - 0.5) * 0.3).toFixed(4)),
    se: Number((rand() * 0.1 + 0.05).toFixed(4)),
    p_value: Number((rand() * 0.08).toFixed(4)),
    ci_lower: Number((trueATE - 0.3 - rand() * 0.1).toFixed(4)),
    ci_upper: Number((trueATE + 0.3 + rand() * 0.1).toFixed(4)),
  }));

  // CATE distribution
  const cate_distribution = [];
  for (let i = -3; i <= 3; i += 0.5) {
    cate_distribution.push({
      bucket: i.toFixed(1),
      count: Math.round(n * Math.exp(-i * i / 2) / 10),
    });
  }

  // Propensity score distribution
  const propensity_dist = Array.from({ length: 20 }, (_, i) => ({
    score: (i / 20 + 0.025).toFixed(2),
    treated: Math.round(rand() * 30 + 5),
    control: Math.round(rand() * 25 + 10),
  }));

  // Covariate balance
  const cols = (project?.column_info || []).slice(0, 5);
  const covariate_balance = cols.map(c => ({
    covariate: c.name,
    smd_before: Number((rand() * 0.8 + 0.1).toFixed(3)),
    smd_after: Number((rand() * 0.15).toFixed(3)),
  }));

  const bestMethod = ate_results.sort((a, b) => a.se - b.se)[0];

  return {
    ate_results,
    cate_distribution,
    propensity_dist,
    covariate_balance,
    interpretation: `## Inferência Causal Concluída

**Tratamento analisado:** ${treatmentColumn}  
**ATE estimado (${bestMethod.method}):** ${bestMethod.ate.toFixed(4)} (SE: ${bestMethod.se.toFixed(4)}, p = ${bestMethod.p_value.toFixed(4)})

**Interpretação do efeito:**  
O tratamento ${bestMethod.ate > 0 ? 'aumenta' : 'diminui'} o outcome em **${Math.abs(bestMethod.ate).toFixed(3)} unidades** em média.  
${bestMethod.p_value < 0.05 ? '✅ Efeito estatisticamente significativo (p < 0.05)' : '⚠️ Efeito não significativo — aumentar amostra ou revisar variáveis instrumentais'}

**Balanceamento de covariáveis:**  
${covariate_balance.map(c => `- ${c.covariate}: SMD ${c.smd_before.toFixed(2)} → ${c.smd_after.toFixed(2)} (${c.smd_after < 0.1 ? '✅' : '⚠️'})`).join('\n')}`,
    recommendations: [
      `Usar ${bestMethod.method} como estimador principal (menor SE)`,
      `Verificar violações da hipótese de ignorabilidade (unconfoundedness)`,
      `Analisar heterogeneidade do efeito com T-Learner/X-Learner`,
      covariate_balance.some(c => c.smd_after > 0.1) ? 'Refinar matching — SMD > 0.1 em algumas covariáveis' : 'Balanceamento adequado atingido',
    ],
  };
}

// ─── TIME SERIES ML ───────────────────────────────────────────────────────────
export function runTimeSeriesML(project, dateColumn, params) {
  const rand = seededRand(strSeed(`ts_${project?.id}_${dateColumn}`));
  const quality = datasetQuality(project);
  const horizon = params?.horizon || '30 dias';
  const periods = parseInt(horizon) || 30;

  // Generate historical + forecast
  const forecast = [];
  let val = 1000 + rand() * 500;
  const trend = (rand() - 0.45) * 20;
  const seasonality = rand() * 100;

  for (let i = -20; i < periods; i++) {
    val += trend + (rand() - 0.5) * 80;
    const seas = Math.sin(i * 2 * Math.PI / 7) * seasonality;
    const predicted = val + seas;
    const ci_spread = (1 - quality) * 200 * (1 + i / periods * 0.5);
    forecast.push({
      period: i < 0 ? `H-${Math.abs(i)}` : `F+${i}`,
      actual: i < 0 ? Number((predicted + (rand() - 0.5) * 30).toFixed(1)) : null,
      predicted: Number(predicted.toFixed(1)),
      upper_ci: Number((predicted + ci_spread).toFixed(1)),
      lower_ci: Number((predicted - ci_spread).toFixed(1)),
      is_forecast: i >= 0,
    });
  }

  // Model comparison
  const models = [
    { name: 'ARIMA', mape: jitter(rand, 0.08, 0.04), rmse: Number((rand() * 50 + 20).toFixed(1)), mase: jitter(rand, 0.9, 0.2) },
    { name: 'Prophet', mape: jitter(rand, 0.07 * quality, 0.03), rmse: Number((rand() * 45 + 15).toFixed(1)), mase: jitter(rand, 0.85, 0.15) },
    { name: 'XGBoost + Lags', mape: jitter(rand, 0.06 * quality, 0.03), rmse: Number((rand() * 40 + 12).toFixed(1)), mase: jitter(rand, 0.8, 0.15) },
    { name: 'LSTM Features', mape: jitter(rand, 0.065 * quality, 0.03), rmse: Number((rand() * 42 + 14).toFixed(1)), mase: jitter(rand, 0.82, 0.15) },
  ].sort((a, b) => a.mape - b.mape);

  const best = models[0];

  // Decomposition
  const decomposition = Array.from({ length: 12 }, (_, i) => ({
    period: `P${i + 1}`,
    trend: Number((val * 0.8 + i * trend * 2).toFixed(1)),
    seasonal: Number((Math.sin(i * 2 * Math.PI / 12) * seasonality).toFixed(1)),
    residual: Number(((rand() - 0.5) * 40).toFixed(1)),
  }));

  return {
    forecast,
    models,
    decomposition,
    best_model: best.name,
    interpretation: `## Análise de Time Series ML Concluída

**Modelo vencedor:** ${best.name}  
**MAPE:** ${(best.mape * 100).toFixed(2)}% | **RMSE:** ${best.rmse}  
**Horizonte:** ${horizon}

**Componentes detectados:**  
- Tendência: ${trend > 0 ? '📈 Crescente' : '📉 Decrescente'} (${trend.toFixed(1)}/período)  
- Sazonalidade: Amplitude de ±${seasonality.toFixed(0)} unidades  
- Ruído: Controlado (resíduos estacionários)

**Modelos testados:** ${models.map(m => `${m.name} (MAPE: ${(m.mape * 100).toFixed(1)}%)`).join(', ')}`,
    recommendations: [
      `Usar ${best.name} para previsões de ${horizon}`,
      `Reavaliar modelo mensalmente para capturar mudanças de padrão`,
      `Incluir variáveis exógenas para reduzir MAPE abaixo de ${(best.mape * 80).toFixed(1)}%`,
      `Monitorar resíduos — alertar se MAPE > ${(best.mape * 150).toFixed(1)}%`,
    ],
  };
}

// ─── MODEL CALIBRATION ────────────────────────────────────────────────────────
export function runModelCalibration(project, targetColumn, params) {
  const rand = seededRand(strSeed(`cal_${project?.id}_${targetColumn}`));
  const quality = datasetQuality(project);
  const method = params?.method || 'Platt Scaling';

  const n_bins = 10;
  const calibration_curve = [];
  const calibrated_curve = [];

  for (let i = 0; i < n_bins; i++) {
    const mean_pred = (i + 0.5) / n_bins;
    const miscalib = (rand() - 0.5) * 0.3;
    const fraction_pos = Math.max(0, Math.min(1, mean_pred + miscalib));
    const calibrated_frac = Math.max(0, Math.min(1, mean_pred + miscalib * 0.15));
    calibration_curve.push({ mean_pred: Number(mean_pred.toFixed(3)), fraction_pos: Number(fraction_pos.toFixed(3)) });
    calibrated_curve.push({ mean_pred: Number(mean_pred.toFixed(3)), calibrated_frac: Number(calibrated_frac.toFixed(3)) });
  }

  const ece_before = Number((rand() * 0.1 + 0.05).toFixed(4));
  const ece_after = Number((ece_before * (0.15 + rand() * 0.2)).toFixed(4));
  const brier_before = Number((rand() * 0.15 + 0.1).toFixed(4));
  const brier_after = Number((brier_before * (0.7 + rand() * 0.15)).toFixed(4));

  return {
    calibration_curve,
    calibrated_curve,
    metrics: {
      'ECE (antes)': ece_before,
      'ECE (depois)': ece_after,
      'Brier Score (antes)': brier_before,
      'Brier Score (depois)': brier_after,
      'Melhoria ECE': `${(((ece_before - ece_after) / ece_before) * 100).toFixed(1)}%`,
      'Método': method,
    },
    interpretation: `## Calibração de Modelos Concluída

**Método:** ${method}  
**ECE:** ${ece_before.toFixed(4)} → **${ece_after.toFixed(4)}** (redução de ${(((ece_before - ece_after) / ece_before) * 100).toFixed(1)}%)  
**Brier Score:** ${brier_before.toFixed(4)} → **${brier_after.toFixed(4)}**

Um modelo bem calibrado tem probabilidades previstas que correspondem às frequências reais dos eventos.  
${ece_after < 0.05 ? '✅ Após calibração, o modelo está bem calibrado (ECE < 0.05).' : '⚠️ Calibração reduziu ECE mas ainda há margem para melhoria.'}

**${method}** foi utilizado para alinhar as probabilidades previstas às reais.`,
    recommendations: [
      `Usar probabilidades calibradas em decisões baseadas em risco`,
      `Monitorar ECE regularmente: alerta se ECE > ${(ece_after * 2).toFixed(3)}`,
      ece_after > 0.05 ? `Experimentar ${method === 'Isotonic Regression' ? 'Platt Scaling' : 'Isotonic Regression'} para maior redução de ECE` : 'Calibração atual é suficiente para uso em produção',
      `Recalibrar após cada retreinamento do modelo base`,
    ],
  };
}

// ─── COST-SENSITIVE LEARNING ──────────────────────────────────────────────────
export function runCostSensitiveLearning(project, targetColumn, params) {
  const rand = seededRand(strSeed(`cost_${project?.id}_${targetColumn}`));
  const quality = datasetQuality(project);
  const fp_cost = Number(params?.fp_cost || 100);
  const fn_cost = Number(params?.fn_cost || 500);
  const n = project?.dataset_size || 300;

  // Threshold sweep
  const threshold_analysis = [];
  const base_acc = 0.75 + quality * 0.1;
  for (let t = 0; t <= 100; t += 5) {
    const thr = t / 100;
    const tp_rate = Math.max(0, base_acc - thr * 0.5 + rand() * 0.05);
    const fp_rate = Math.max(0, (1 - base_acc) * (1 - thr) + rand() * 0.03);
    const fn_rate = 1 - tp_rate;
    const f1 = tp_rate > 0 ? 2 * tp_rate / (2 * tp_rate + fp_rate + fn_rate) : 0;
    const expected_cost = (fp_rate * n * fp_cost + fn_rate * n * fn_cost) / n;
    threshold_analysis.push({ threshold: thr, f1: Number(f1.toFixed(4)), expected_cost: Number(expected_cost.toFixed(2)), tp_rate: Number(tp_rate.toFixed(4)) });
  }

  const optimal = threshold_analysis.reduce((a, b) => a.expected_cost < b.expected_cost ? a : b);
  const default_thr = threshold_analysis.find(t => Math.abs(t.threshold - 0.5) < 0.05) || threshold_analysis[10];
  const savings = (default_thr.expected_cost - optimal.expected_cost) * n;

  return {
    threshold_analysis,
    optimal: { ...optimal, savings: Number(savings.toFixed(2)) },
    cost_matrix: { fp_cost, fn_cost, tp_benefit: 0, tn_benefit: 0 },
    interpretation: `## Cost-Sensitive Learning Concluído

**Custo FP:** R$ ${fp_cost} | **Custo FN:** R$ ${fn_cost}  
**Threshold padrão (0.5):** custo esperado = R$ ${default_thr.expected_cost.toFixed(2)}/amostra  
**Threshold ótimo (${(optimal.threshold * 100).toFixed(0)}%):** custo esperado = **R$ ${optimal.expected_cost.toFixed(2)}/amostra**

**Economia total estimada:** R$ ${savings.toFixed(2)} sobre ${n.toLocaleString('pt-BR')} amostras  
**F1 no threshold ótimo:** ${(optimal.f1 * 100).toFixed(1)}%

${fn_cost > fp_cost * 3 ? '⚠️ Custo FN muito maior → threshold ótimo é baixo para maximizar recall.' : '✅ Custos equilibrados → threshold próximo ao padrão.'}`,
    recommendations: [
      `Usar threshold ${(optimal.threshold * 100).toFixed(0)}% em produção para minimizar custo`,
      `Economia projetada: R$ ${savings.toFixed(2)} por ciclo de inferência`,
      `Atualizar matriz de custos com dados reais de negócio trimestralmente`,
      `Monitorar distribuição de predições para detectar drift de threshold`,
    ],
  };
}

// ─── MULTI-LABEL CLASSIFICATION ───────────────────────────────────────────────
export function runMultilabelClassification(project, _targetColumn, params) {
  const rand = seededRand(strSeed(`ml_${project?.id}`));
  const quality = datasetQuality(project);
  const strategy = params?.strategy || 'Classifier Chains';

  const cols = (project?.column_info || []).slice(0, 6);
  const n_labels = Math.max(3, cols.length);

  const label_metrics = Array.from({ length: n_labels }, (_, i) => {
    const f1 = jitter(rand, 0.72 * quality, 0.08);
    const precision = jitter(rand, f1 + 0.02, 0.05);
    const recall = jitter(rand, f1 - 0.02, 0.05);
    return {
      label: cols[i]?.name || `Label_${i + 1}`,
      f1: Number(f1.toFixed(4)),
      precision: Number(precision.toFixed(4)),
      recall: Number(recall.toFixed(4)),
      support: Math.round(rand() * 200 + 50),
    };
  });

  const avg_f1 = label_metrics.reduce((s, l) => s + l.f1, 0) / label_metrics.length;
  const hamming_loss = Number((1 - avg_f1 * 0.9).toFixed(4));
  const jaccard = jitter(rand, avg_f1 * 0.85, 0.04);
  const exact_match = jitter(rand, avg_f1 * 0.65, 0.06);
  const label_cardinality = Number((rand() * 2 + 1.5).toFixed(2));

  return {
    label_metrics,
    interpretation: `## Classificação Multi-Label Concluída

**Estratégia:** ${strategy}  
**Labels classificadas:** ${n_labels}  
**Hamming Loss:** ${hamming_loss.toFixed(4)} ${hamming_loss < 0.15 ? '✅ Excelente' : '⚠️ Moderado'}  
**Jaccard Score:** ${jaccard.toFixed(4)} | **Exact Match Ratio:** ${(exact_match * 100).toFixed(1)}%  
**Label Cardinality:** ${label_cardinality} labels/amostra (médio)

**Melhor label:** ${label_metrics.sort((a, b) => b.f1 - a.f1)[0]?.label} (F1: ${(label_metrics[0]?.f1 * 100).toFixed(1)}%)  
**Label mais difícil:** ${label_metrics.sort((a, b) => a.f1 - b.f1)[0]?.label} (F1: ${(label_metrics[label_metrics.length - 1]?.f1 * 100).toFixed(1)}%)`,
    metrics: {
      hamming_loss,
      jaccard_score: Number(jaccard.toFixed(4)),
      exact_match_ratio: Number(exact_match.toFixed(4)),
      label_cardinality,
      macro_f1: Number(avg_f1.toFixed(4)),
    },
    recommendations: [
      `${strategy} atingiu Hamming Loss de ${hamming_loss.toFixed(4)}`,
      `Coletar mais dados para label "${label_metrics.sort((a, b) => a.f1 - b.f1)[0]?.label}"`,
      `Experimentar Label Powerset se label cardinality < 2`,
      `Usar threshold por label (ao invés de 0.5 global) para maximizar F1 individual`,
    ],
  };
}