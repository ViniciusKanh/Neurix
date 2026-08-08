/**
 * Model governance helpers — build a Model Card and export a portable
 * model bundle (metadata + scaler + metrics) as JSON. No AI.
 */

// Composes a structured Model Card from a project + a completed analysis.
export function buildModelCard(project, analysis, extra = {}) {
  const res = analysis?.results || {};
  const cfg = analysis?.config || {};
  const type = analysis?.type;
  const metrics = res.metrics || {};
  const isClass = type === 'classification';
  const perf = isClass
    ? [
        ['Acurácia', pct(metrics.accuracy)],
        ['Precisão', pct(metrics.precision)],
        ['Recall', pct(metrics.recall)],
        ['F1-Score', pct(metrics.f1_score)],
      ]
    : [
        ['R²', pct(metrics.r2_score)],
        ['RMSE', fmt(metrics.rmse)],
        ['MAE', fmt(metrics.mae)],
        ['MAPE', metrics.mape != null ? `${fmt(metrics.mape)}%` : '—'],
      ];

  const limitations = [];
  if ((res.trained_on || 0) < 200) limitations.push('Base pequena (< 200 linhas): métricas podem variar bastante.');
  if (isClass && res.class_labels && res.class_labels.length > 6) limitations.push('Muitas classes: avalie desempenho por classe individualmente.');
  if (extra.balance?.imbalanced) limitations.push(`Classes desbalanceadas (razão ${extra.balance.imbalance_ratio}×): prefira F1/recall a acurácia.`);
  if (isClass && metrics.accuracy != null && metrics.accuracy < 0.7) limitations.push('Acurácia moderada: o modelo pode não estar pronto para produção.');
  if (!isClass && metrics.r2_score != null && metrics.r2_score < 0.5) limitations.push('R² baixo: capacidade preditiva limitada.');
  if (!limitations.length) limitations.push('Sem limitações críticas detectadas — ainda assim, monitore drift em produção.');

  return {
    model_name: res.best_model || cfg.model || 'Modelo',
    project: project?.name || '—',
    task: isClass ? 'Classificação' : type === 'regression' ? 'Regressão' : type,
    target: cfg.target_column || '—',
    features: cfg.feature_columns || project?.column_info?.map((c) => c.name).filter((n) => n !== cfg.target_column) || [],
    classes: res.class_labels || null,
    trained_on: res.trained_on || null,
    test_size: res.test_size || null,
    validation: extra.cv && !extra.cv.error
      ? { method: `${extra.cv.k}-fold CV`, metric: extra.cv.metric, mean: extra.cv.mean, std: extra.cv.std }
      : { method: 'Holdout', note: 'Split treino/teste único.' },
    performance: perf,
    feature_importance: (extra.importance?.importances || res.feature_importance || []).slice(0, 10),
    balance: extra.balance && !extra.balance.error ? extra.balance : null,
    limitations,
    generated_at: new Date().toISOString(),
    created_by: analysis?.created_by || project?.created_by || null,
  };
}

// Portable model bundle for reuse/documentation (JSON download).
export function buildModelBundle(project, analysis, card) {
  const cfg = analysis?.config || {};
  return {
    format: 'neurix-model-bundle',
    version: 1,
    exported_at: new Date().toISOString(),
    project: { id: project?.id, name: project?.name, rows: project?.row_count || null },
    model: {
      name: analysis?.results?.best_model || cfg.model,
      task: analysis?.type,
      target: cfg.target_column,
      classes: analysis?.results?.class_labels || null,
      feature_columns: cfg.feature_columns || null,
      hyperparameters: cfg.hyperparameters || null,
    },
    metrics: analysis?.results?.metrics || null,
    model_card: card || null,
    note: 'Bundle de documentação/scoring. Reimporte o dataset no ML Studio para re-treinar de forma idêntica (motor determinístico com seed fixa).',
  };
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const pct = (v) => (v == null ? '—' : `${(v * 100).toFixed(1)}%`);
const fmt = (v) => (v == null ? '—' : Number(v).toLocaleString('pt-BR'));
