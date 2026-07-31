/**
 * Local data-drift monitoring — deterministic, no AI.
 * Simulates a production batch from the training sample according to the chosen
 * scenario and computes per-column drift, an overall score and a performance
 * estimate. Returns the shape the ModelMonitoring page expects.
 */
function seeded(str = '') {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  let s = (h >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
}
const mean = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const std = (a) => { if (a.length < 2) return 0; const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1)); };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// scenario -> { driftFactor, perfFactor }
const SCENARIOS = {
  stable: { drift: 0.04, perf: 0.05 },
  mild_drift: { drift: 0.18, perf: 0.25 },
  high_drift: { drift: 0.58, perf: 0.6 },
  concept_drift: { drift: 0.32, perf: 0.85 }, // features shift moderate, but relationship broke → big perf hit
};

export function computeDrift(project, { scenario = 'stable', batchSize = 500, model = null } = {}) {
  const cfg = SCENARIOS[scenario] || SCENARIOS.stable;
  const rand = seeded(`drift_${project?.id}_${scenario}`);
  const cols = project?.column_info || [];
  const sample = project?.data_sample || [];

  const isNum = (c) => ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((c.type || '').toLowerCase());

  const column_drift = cols.map((c) => {
    const numeric = isNum(c);
    let original_mean = 0, original_std = 1;
    if (numeric) {
      const vals = sample.map((r) => parseFloat(r[c.name])).filter((v) => !isNaN(v));
      original_mean = mean(vals);
      original_std = std(vals) || Math.abs(original_mean) * 0.1 || 1;
    }
    // per-column drift score driven by scenario + deterministic noise
    const score = clamp01(cfg.drift * (0.55 + 0.9 * rand()));
    const dir = rand() > 0.5 ? 1 : -1;
    const batch_mean = numeric ? Number((original_mean + dir * score * 2 * original_std).toFixed(3)) : 0;
    const batch_std = numeric ? Number((original_std * (1 + score * 0.6)).toFixed(3)) : 0;
    const is_drifted = score > 0.15;
    return {
      column: c.name,
      drift_score: Number(score.toFixed(3)),
      method: numeric ? 'KS-test' : 'Qui-quadrado',
      p_value: Number(Math.max(0.0001, 0.5 * (1 - score)).toFixed(4)),
      original_mean: Number(original_mean.toFixed(3)),
      batch_mean,
      original_std: Number(original_std.toFixed(3)),
      batch_std,
      is_drifted,
      drift_type: scenario === 'concept' ? (is_drifted ? 'concept' : 'estável') : (is_drifted ? 'covariate' : 'estável'),
      impact_on_model: score > 0.4 ? 'alto' : score > 0.15 ? 'médio' : 'baixo',
    };
  });

  const overall_drift_score = Number(mean(column_drift.map((c) => c.drift_score)).toFixed(3));
  const drifted = column_drift.filter((c) => c.is_drifted);
  const drift_severity = overall_drift_score > 0.4 ? 'Crítico' : overall_drift_score > 0.2 ? 'Moderado' : overall_drift_score > 0.08 ? 'Leve' : 'Nenhum';

  // model baseline metric
  const m = model?.results?.metrics || {};
  const baseAcc = clamp01(m.accuracy ?? m.r2 ?? m.r2_score ?? m.f1_score ?? m.f1 ?? 0.85);
  const accDrop = clamp01(overall_drift_score * cfg.perf * 0.7);
  const currentAcc = clamp01(baseAcc - accDrop);
  const retraining = overall_drift_score > 0.2 || accDrop > 0.1;

  const distribution_comparison = column_drift
    .filter((c) => c.original_mean !== 0 || c.batch_mean !== 0)
    .slice(0, 10)
    .map((c) => ({ column: c.column, treino: c.original_mean, producao: c.batch_mean }));

  // 6-period timeline ramping toward the current drift level
  const drift_timeline = Array.from({ length: 6 }, (_, i) => ({
    period: `T-${5 - i}`,
    drift_score: Number(clamp01(overall_drift_score * (0.4 + 0.12 * i) + (rand() - 0.5) * 0.05).toFixed(3)),
  }));

  return {
    batch_summary: { rows: parseInt(batchSize) || 500, columns_matched: cols.length, columns_missing: 0, scenario_simulated: scenario },
    overall_drift_score,
    drift_severity,
    columns_with_drift: drifted.length,
    columns_stable: cols.length - drifted.length,
    column_drift,
    distribution_comparison,
    drift_timeline,
    performance_estimate: {
      estimated_accuracy_drop: Number(accDrop.toFixed(3)),
      estimated_current_accuracy: Number(currentAcc.toFixed(3)),
      reliability_score: Number((1 - overall_drift_score).toFixed(3)),
      retraining_recommended: retraining,
      performance_degradation_reason: scenario === 'concept'
        ? 'Concept drift: a relação entre features e alvo mudou — as métricas caem mesmo com features parecidas.'
        : overall_drift_score > 0.2
          ? 'Mudança na distribuição das features (covariate drift) reduz a confiabilidade das previsões.'
          : 'Distribuição estável — desempenho preservado.',
      estimated_metrics: {
        accuracy: Number(currentAcc.toFixed(3)),
        f1: Number(clamp01(currentAcc - 0.02).toFixed(3)),
        precision: Number(clamp01(currentAcc - 0.01).toFixed(3)),
        recall: Number(clamp01(currentAcc - 0.03).toFixed(3)),
      },
    },
    retraining_trigger: {
      should_trigger: retraining,
      reason: retraining
        ? `Drift ${drift_severity.toLowerCase()} (score ${overall_drift_score}) — retreinamento recomendado.`
        : 'Sem drift relevante — retreinamento não necessário.',
    },
    insights: [
      `Score de drift geral: ${(overall_drift_score * 100).toFixed(0)}% (${drift_severity}).`,
      `${drifted.length} de ${cols.length} colunas com drift detectado.`,
      retraining ? 'Retreinamento recomendado.' : 'Modelo saudável para o cenário atual.',
    ],
    ai_analysis: `## Análise de Data Drift — ${project?.name || ''}

**Cenário:** ${scenario} · **Batch:** ${parseInt(batchSize) || 500} linhas

### Resultado
Score de drift geral: **${(overall_drift_score * 100).toFixed(0)}%** (severidade **${drift_severity}**). ${drifted.length} de ${cols.length} colunas apresentaram drift.

### Impacto estimado
${scenario === 'concept_drift'
  ? 'Concept drift: a relação entre as features e o alvo mudou. Mesmo com features parecidas, a acurácia cai — retreinamento é a única solução.'
  : overall_drift_score > 0.2
    ? `Queda estimada de desempenho de ${(accDrop * 100).toFixed(1)} p.p. (covariate drift).`
    : 'Distribuição estável — desempenho preservado.'}

### Colunas mais afetadas
${column_drift.slice().sort((a, b) => b.drift_score - a.drift_score).slice(0, 5).map((c) => `- **${c.column}**: drift ${(c.drift_score * 100).toFixed(0)}% (${c.impact_on_model})`).join('\n')}

### Recomendação
${retraining ? '🔄 **Retreinar o modelo** e revalidar antes de novo deploy.' : '✅ **Manter o modelo** — continuar monitorando periodicamente.'}`,
  };
}
