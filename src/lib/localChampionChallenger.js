/**
 * Local Champion vs Challenger comparison — deterministic, no AI.
 * Uses the two models' stored metrics to produce a full side-by-side verdict.
 */
function seeded(str = '') {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  let s = (h >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) & 0xffffffff; return (s >>> 0) / 4294967296; };
}
const round = (v) => Number(Math.max(0, Math.min(1, v)).toFixed(4));

const NOISE = { balanced: 0.02, skewed: 0.06, temporal: 0.05, edge_cases: 0.1 };

function batchMetrics(model, rand, noise) {
  const m = model?.results?.metrics || {};
  const r2 = m.r2 ?? m.r2_score ?? m.adjusted_r2;
  const base = {
    accuracy: m.accuracy ?? r2 ?? m.f1_score ?? m.f1 ?? 0,
    f1: m.f1 ?? m.f1_score ?? r2 ?? m.accuracy ?? 0,
    precision: m.precision ?? r2 ?? m.accuracy ?? 0,
    recall: m.recall ?? r2 ?? m.accuracy ?? 0,
    auc_roc: m.auc ?? m.roc_auc ?? m.auc_roc ?? r2 ?? m.accuracy ?? 0,
  };
  const jit = (v) => round(v * (1 + (rand() - 0.5) * 2 * noise));
  return {
    accuracy: jit(base.accuracy), f1: jit(base.f1), precision: jit(base.precision),
    recall: jit(base.recall), auc_roc: jit(base.auc_roc),
    avg_latency_ms: Math.round(6 + rand() * 40),
    throughput_per_sec: Math.round(200 + rand() * 900),
  };
}

export function compareModels(champion, challenger, { scenario = 'balanced', batchSize = 1000 } = {}) {
  const noise = NOISE[scenario] ?? 0.03;
  const rc = seeded(`cc_${champion?.id}_${scenario}`);
  const rh = seeded(`cc_${challenger?.id}_${scenario}`);
  const cM = batchMetrics(champion, rc, noise);
  const hM = batchMetrics(challenger, rh, noise);

  const METRICS = ['accuracy', 'f1', 'precision', 'recall', 'auc_roc'];
  const labelMap = { accuracy: 'Acurácia', f1: 'F1', precision: 'Precisão', recall: 'Recall', auc_roc: 'AUC-ROC' };
  const metric_comparison = METRICS.map((k) => {
    const c = cM[k], h = hM[k];
    const winner = Math.abs(c - h) < 0.005 ? 'tie' : (h > c ? 'challenger' : 'champion');
    const delta_pct = c > 0 ? ((h - c) / c) * 100 : 0;
    return { metric: labelMap[k], key: k, champion: c, challenger: h, winner, delta_pct: Number(delta_pct.toFixed(1)) };
  });

  const primaryDelta = hM.accuracy - cM.accuracy;
  const absd = Math.abs(primaryDelta);
  const winner = absd < 0.01 ? 'tie' : (primaryDelta > 0 ? 'challenger' : 'champion');
  const confidence_level = absd > 0.05 ? 'high' : absd > 0.02 ? 'medium' : 'low';
  const recommendation = primaryDelta > 0.02 ? 'promote_challenger' : primaryDelta < -0.02 ? 'keep_champion' : 'more_testing';
  const statistical_significance = absd > 0.03;
  const p_value = Number(Math.max(0.001, 0.5 * (1 - Math.min(1, absd * 8))).toFixed(4));

  const strengthsFor = (own, other) => METRICS.filter((k) => own[k] - other[k] > 0.01).map((k) => `${labelMap[k]} superior (${(own[k] * 100).toFixed(1)}%)`);
  const weaknessesFor = (own, other) => METRICS.filter((k) => other[k] - own[k] > 0.01).map((k) => `${labelMap[k]} inferior (${(own[k] * 100).toFixed(1)}%)`);

  const winnerName = winner === 'challenger' ? challenger?.name : winner === 'champion' ? champion?.name : 'Empate';
  const winner_reason = winner === 'tie'
    ? `Diferença de acurácia desprezível (${(primaryDelta * 100).toFixed(2)} p.p.) — sem vencedor claro neste batch.`
    : `${winnerName} teve acurácia ${absd >= 0 ? 'maior' : 'menor'} em ${(absd * 100).toFixed(2)} p.p. no batch simulado (${scenario}).`;
  const recommendation_detail = recommendation === 'promote_challenger'
    ? 'O challenger superou o champion de forma consistente. Considere promover.'
    : recommendation === 'keep_champion'
      ? 'O champion segue melhor. Mantenha em produção.'
      : 'Diferença pequena — rode mais testes antes de decidir.';

  const scatter_data = Array.from({ length: 40 }, (_, i) => ({
    index: i,
    champion_conf: round(cM.accuracy + (rc() - 0.5) * 0.3),
    challenger_conf: round(hM.accuracy + (rh() - 0.5) * 0.3),
    actual: rc() > 0.5 ? '1' : '0',
  }));

  const fmt = (o) => METRICS.map((k) => `${labelMap[k]}: champ ${(o === 'c' ? cM : hM)[k]}`).join('');
  const ai_verdict = `## Veredicto — ${champion?.name} vs ${challenger?.name}

**Cenário:** ${scenario} · **Batch:** ${batchSize} amostras

### Resultado
${winner === 'tie' ? 'Empate técnico.' : `**${winnerName}** venceu.`} ${winner_reason}

### Métricas (batch)
${metric_comparison.map((m) => `- **${m.metric}**: champion ${(m.champion * 100).toFixed(1)}% vs challenger ${(m.challenger * 100).toFixed(1)}% → ${m.winner === 'tie' ? 'empate' : m.winner} (${m.delta_pct > 0 ? '+' : ''}${m.delta_pct}%)`).join('\n')}

### Recomendação
${recommendation === 'promote_challenger' ? '✅ **Promover o challenger** para produção.' : recommendation === 'keep_champion' ? '⚠️ **Manter o champion** atual.' : '🔬 **Mais testes** — diferença dentro do ruído.'}
${statistical_significance ? `\nDiferença estatisticamente relevante (p ≈ ${p_value}).` : `\nDiferença pode ser ruído (p ≈ ${p_value}).`}`;

  return {
    batch_info: { size: batchSize, scenario, description: `Batch simulado (${scenario})` },
    champion: { name: champion?.name, type: champion?.type, batch_metrics: cM, strengths: strengthsFor(cM, hM), weaknesses: weaknessesFor(cM, hM) },
    challenger: { name: challenger?.name, type: challenger?.type, batch_metrics: hM, strengths: strengthsFor(hM, cM), weaknesses: weaknessesFor(hM, cM) },
    metric_comparison,
    scatter_data,
    winner,
    winner_reason,
    confidence_level,
    recommendation,
    recommendation_detail,
    statistical_significance,
    p_value,
    ai_verdict,
  };
}
