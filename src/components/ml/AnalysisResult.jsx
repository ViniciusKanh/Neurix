import React from 'react';
import GlowCard from '@/components/ui/GlowCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { Sparkles, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function AnalysisResult({ analysis }) {
  const results = analysis.results || {};
  const featureImportance = results.feature_importance || [];
  const modelsComparison = results.models_comparison || [];

  const typeLabel = {
    classification: 'Classificação',
    regression: 'Regressão',
    clustering: 'Agrupamento',
    anomaly_detection: 'Detecção de Anomalias',
    dimensionality_reduction: 'Redução de Dimensionalidade',
    exploration: 'Exploração',
  }[analysis.type] || analysis.type?.replace(/_/g, ' ');

  return (
    <GlowCard>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-foreground">{analysis.name}</h3>
          <p className="text-xs text-muted-foreground">{typeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {results.training_mode && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${results.training_mode === 'real' ? 'bg-accent/15 text-accent' : 'bg-amber-400/15 text-amber-400'}`}>
              {results.training_mode === 'real' ? `✓ Treino real${results.trained_on ? ` · ${results.trained_on.toLocaleString('pt-BR')} linhas` : ''}` : '~ Estimativa'}
            </span>
          )}
          <StatusBadge status={analysis.status} />
        </div>
      </div>

      {analysis.status === 'completed' && (
        <div className="space-y-4">
          {/* Feature selection method */}
          {results.method && (
            <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
              <div className="flex items-center gap-2 mb-1.5">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Método de Seleção de Features</span>
              </div>
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary/15 text-primary">
                  {results.method.category_label}
                </span>
                {results.method.filter_name && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] bg-secondary text-foreground">
                    {results.method.filter_name}
                  </span>
                )}
                {(results.method.also_ran || []).map((x, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-full text-[11px] bg-accent/10 text-accent">{x}</span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{results.method.rationale}</p>
            </div>
          )}

          {/* Metrics summary */}
          {results.metrics && Object.keys(results.metrics).length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Object.entries(results.metrics).slice(0, 8).map(([key, value]) => (
                <div key={key} className="bg-secondary/40 rounded-lg p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">{key.replace(/_/g, ' ')}</p>
                  <p className="text-lg font-bold font-mono text-primary">
                    {typeof value === 'number' ? value.toFixed(4) : String(value)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Models Comparison Chart */}
          {modelsComparison.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Comparação de Modelos</p>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelsComparison.map(m => ({
                    name: m.name,
                    ...Object.fromEntries(Object.entries(m.metrics || {}).map(([k, v]) => [k, typeof v === 'number' ? parseFloat(v.toFixed(4)) : v]))
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }} />
                    <Tooltip contentStyle={{ background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    {Object.keys(modelsComparison[0]?.metrics || {}).slice(0, 3).map((key, i) => (
                      <Bar key={key} dataKey={key} fill={['hsl(187, 92%, 55%)', 'hsl(265, 70%, 60%)', 'hsl(152, 68%, 50%)'][i % 3]} radius={[4, 4, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Feature Importance */}
          {featureImportance.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Importância das Features</p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={featureImportance.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }} />
                    <YAxis dataKey="feature" type="category" width={120} tick={{ fontSize: 9, fill: 'hsl(215, 20%, 55%)' }} />
                    <Tooltip contentStyle={{ background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                    <Bar dataKey="score" fill="hsl(187, 92%, 55%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Cross-validation (mean ± std) */}
          {results.cross_validation && (
            <div className="rounded-lg border border-accent/25 bg-accent/5 p-3">
              <p className="text-xs font-semibold text-accent uppercase mb-2">
                Validação Cruzada — {results.cross_validation.k}-fold
              </p>
              <div className="flex flex-wrap items-center gap-4 mb-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">{results.cross_validation.metric}</p>
                  <p className="text-lg font-bold font-mono text-foreground">
                    {(results.cross_validation.mean * 100).toFixed(1)}%
                    <span className="text-xs text-muted-foreground"> ± {(results.cross_validation.std * 100).toFixed(1)}</span>
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{results.cross_validation.secondary_metric}</p>
                  <p className="text-sm font-mono text-muted-foreground">
                    {results.cross_validation.secondary_mean.toFixed(3)} ± {results.cross_validation.secondary_std.toFixed(3)}
                  </p>
                </div>
                <div className="flex gap-1 ml-auto">
                  {results.cross_validation.folds.map((f) => (
                    <span key={f.fold} title={`Fold ${f.fold}: ${(f.primary * 100).toFixed(1)}%`}
                      className="w-6 h-6 rounded flex items-center justify-center text-[9px] font-mono bg-secondary/60 text-foreground/80">
                      {(f.primary * 100).toFixed(0)}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Desvio baixo = desempenho estável entre partições. Métrica mais confiável que um único holdout.
              </p>
            </div>
          )}

          {/* Permutation importance (global) */}
          {results.permutation_importance?.importances?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">
                Importância por Permutação <span className="normal-case text-[10px]">(queda de {results.permutation_importance.metric} ao embaralhar cada variável)</span>
              </p>
              <div className="h-40 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={results.permutation_importance.importances.slice(0, 8)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215, 20%, 55%)' }} />
                    <YAxis dataKey="feature" type="category" width={120} tick={{ fontSize: 9, fill: 'hsl(215, 20%, 55%)' }} />
                    <Tooltip contentStyle={{ background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' }} />
                    <Bar dataKey="importance" fill="hsl(265, 70%, 62%)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Class balance */}
          {results.class_balance && !results.class_balance.error && (
            <div className={`rounded-lg border p-3 ${results.class_balance.imbalanced ? 'border-amber-400/40 bg-amber-400/5' : 'border-border/40 bg-secondary/20'}`}>
              <p className="text-xs font-semibold uppercase mb-2 text-muted-foreground">
                Balanceamento de Classes {results.class_balance.imbalanced && <span className="text-amber-400">· desbalanceado ({results.class_balance.severity})</span>}
              </p>
              <div className="flex h-4 w-full rounded overflow-hidden mb-2">
                {results.class_balance.classes.map((c, i) => (
                  <div key={c.label} title={`${c.label}: ${c.pct}% (${c.count})`}
                    style={{ width: `${c.pct}%`, background: ['hsl(187,92%,50%)', 'hsl(265,70%,62%)', 'hsl(152,68%,50%)', 'hsl(40,100%,55%)', 'hsl(330,90%,60%)'][i % 5] }} />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                {results.class_balance.classes.map((c) => <span key={c.label}><strong className="text-foreground">{c.label}</strong> {c.pct}%</span>)}
                <span className="ml-auto">razão {results.class_balance.imbalance_ratio}×</span>
              </div>
            </div>
          )}

          {/* Interpretation (computed) */}
          {analysis.ai_interpretation && (
            <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-xs font-semibold text-accent flex items-center gap-1 mb-2">
                <TrendingUp className="w-3 h-3" /> Interpretação dos Resultados
              </p>
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="text-xs text-muted-foreground mb-1.5 leading-relaxed">{children}</p>,
                    strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
                    ul: ({ children }) => <ul className="list-disc ml-4 space-y-0.5">{children}</ul>,
                    li: ({ children }) => <li className="text-xs text-muted-foreground">{children}</li>,
                  }}
                >
                  {analysis.ai_interpretation}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {analysis.ai_recommendations?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Recomendações</p>
              <div className="space-y-1.5">
                {analysis.ai_recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <TrendingUp className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                    <span>{rec}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </GlowCard>
  );
}