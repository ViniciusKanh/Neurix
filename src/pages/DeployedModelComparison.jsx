import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import GlowCard from '@/components/ui/GlowCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import {
  GitCompare, Target, Crosshair, Zap, TrendingUp, Trophy, Server,
  AlertTriangle, Activity, CircleDollarSign, ArrowUp, ArrowDown, Minus,
  CheckCircle2, Gauge, Clock, BarChart3, Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const BLUE_COLOR = 'hsl(187,92%,50%)';
const PURPLE_COLOR = 'hsl(265,70%,60%)';
const BLUE_HEX = '#00c8e8';
const PURPLE_HEX = '#8b5cf6';

function StatRow({ label, valueA, valueB, format = 'number', suffix = '', higherBetter = true, icon: Icon }) {
  const numA = typeof valueA === 'number' ? valueA : parseFloat(valueA);
  const numB = typeof valueB === 'number' ? valueB : parseFloat(valueB);
  const bothValid = !isNaN(numA) && !isNaN(numB);
  const diff = bothValid ? numB - numA : 0;
  const pctDiff = bothValid && numA !== 0 ? Math.abs((diff / numA) * 100) : 0;
  const aWins = bothValid && higherBetter ? numA > numB : numA < numB;
  const bWins = bothValid && higherBetter ? numB > numA : numB < numA;

  const formattedA = format === 'percent' ? `${numA.toFixed(1)}%` : format === 'ms' ? `${numA}ms` : `${numA.toLocaleString('pt-BR')}${suffix}`;
  const formattedB = format === 'percent' ? `${numB.toFixed(1)}%` : format === 'ms' ? `${numB}ms` : `${numB.toLocaleString('pt-BR')}${suffix}`;

  return (
    <div className="py-2.5 border-b border-border/20 last:border-0">
      <div className="flex items-center gap-1.5 mb-2">
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
        <span className="text-[11px] font-semibold text-foreground">{label}</span>
        {bothValid && (
          <span className={cn('text-[10px] font-semibold ml-auto', diff > 0 ? 'text-accent' : diff < 0 ? 'text-destructive' : 'text-muted-foreground')}>
            {diff > 0 ? `+${pctDiff.toFixed(1)}%` : diff < 0 ? `-${pctDiff.toFixed(1)}%` : 'Empate'}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('text-sm font-mono font-bold flex-1', aWins && bothValid ? 'text-accent' : 'text-foreground/80')}>
          {formattedA}
        </span>
        <div className="w-20 h-1.5 rounded-full bg-secondary overflow-hidden flex-shrink-0">
          {bothValid && (() => {
            const max = Math.max(numA, numB);
            const min = Math.min(numA, numB);
            const leftPct = (numA / (numA + numB)) * 100;
            return (
              <>
                <div className="h-full float-left rounded-l-full" style={{ width: `${leftPct}%`, backgroundColor: aWins ? BLUE_HEX : PURPLE_HEX }} />
                <div className="h-full float-right rounded-r-full" style={{ width: `${100 - leftPct}%`, backgroundColor: bWins ? PURPLE_HEX : BLUE_HEX }} />
              </>
            );
          })()}
        </div>
        <span className={cn('text-sm font-mono font-bold flex-1 text-right', bWins && bothValid ? 'text-accent' : 'text-foreground/80')}>
          {formattedB}
        </span>
      </div>
    </div>
  );
}

function WinnerBanner({ modelA, modelB, metrics }) {
  const scoreA = metrics.reduce((s, m) => {
    if (isNaN(m.valueA) || isNaN(m.valueB)) return s;
    if (m.higherBetter) return s + (m.valueA > m.valueB ? 1 : m.valueA < m.valueB ? -1 : 0);
    return s + (m.valueA < m.valueB ? 1 : m.valueA > m.valueB ? -1 : 0);
  }, 0);

  if (scoreA > 0) {
    return (
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-xl px-4 py-3">
        <Trophy className="w-5 h-5 text-accent" />
        <div>
          <p className="text-xs font-bold text-accent">Melhor Performance</p>
          <p className="text-[11px] text-foreground">{modelA?.name || 'Modelo A'} lidera em {metrics.filter(m => !isNaN(m.valueA) && !isNaN(m.valueB) && (m.higherBetter ? m.valueA > m.valueB : m.valueA < m.valueB)).length} de {metrics.filter(m => !isNaN(m.valueA) && !isNaN(m.valueB)).length} métricas</p>
        </div>
      </motion.div>
    );
  } else if (scoreA < 0) {
    return (
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-xl px-4 py-3">
        <Trophy className="w-5 h-5 text-accent" />
        <div>
          <p className="text-xs font-bold text-accent">Melhor Performance</p>
          <p className="text-[11px] text-foreground">{modelB?.name || 'Modelo B'} lidera em {metrics.filter(m => !isNaN(m.valueA) && !isNaN(m.valueB) && (m.higherBetter ? m.valueB > m.valueA : m.valueB < m.valueA)).length} de {metrics.filter(m => !isNaN(m.valueA) && !isNaN(m.valueB)).length} métricas</p>
        </div>
      </motion.div>
    );
  }
  return null;
}

export default function DeployedModelComparison() {
  const [modelAId, setModelAId] = useState(null);
  const [modelBId, setModelBId] = useState(null);

  const { data: deployments = [], isLoading } = useQuery({
    queryKey: ['deployments-compare'],
    queryFn: () => base44.entities.ModelDeployment.list('-created_date', 50),
  });

  const active = deployments.filter(d => d.status === 'active');
  const modelA = active.find(d => d.id === modelAId);
  const modelB = active.find(d => d.id === modelBId);

  const getMetric = (model, key) => {
    if (!model?.model_metrics) return NaN;
    const v = model.model_metrics[key];
    if (v == null) return NaN;
    if (key === 'accuracy' || key === 'precision' || key === 'recall' || key === 'f1_score' || key === 'auc') {
      return Number(v) <= 1 ? Number(v) : Number(v) / 100;
    }
    return Number(v);
  };

  if (isLoading) return <LoadingSpinner text="Carregando modelos..." />;

  const allMetrics = [
    { key: 'accuracy', label: 'Acurácia', icon: Target, format: 'percent', higherBetter: true },
    { key: 'precision', label: 'Precisão', icon: Crosshair, format: 'percent', higherBetter: true },
    { key: 'recall', label: 'Recall', icon: Gauge, format: 'percent', higherBetter: true },
    { key: 'f1_score', label: 'F1-Score', icon: TrendingUp, format: 'percent', higherBetter: true },
  ];

  const validMetrics = modelA && modelB ? allMetrics.filter(m => !isNaN(getMetric(modelA, m.key)) && !isNaN(getMetric(modelB, m.key))) : allMetrics;

  const comparisonMetrics = (modelA && modelB) ? [
    ...validMetrics.map(m => ({ ...m, valueA: getMetric(modelA, m.key), valueB: getMetric(modelB, m.key) })),
    { key: 'latency', label: 'Latência Média', icon: Clock, format: 'ms', higherBetter: false, valueA: modelA.avg_latency_ms || 0, valueB: modelB.avg_latency_ms || 0 },
    { key: 'error_rate', label: 'Taxa de Erro', icon: AlertTriangle, format: 'percent', higherBetter: false, valueA: (modelA.error_rate || 0), valueB: (modelB.error_rate || 0) },
    { key: 'total_calls', label: 'Total de Chamadas', icon: Activity, format: 'number', suffix: '', higherBetter: true, valueA: modelA.total_calls || 0, valueB: modelB.total_calls || 0 },
  ] : [];

  // Cost estimation (based on latency + calls)
  const estimatedCost = (model) => {
    if (!model) return 0;
    const calls = model.total_calls || 0;
    const avgMs = model.avg_latency_ms || 0;
    const computeSeconds = (calls * avgMs) / 1000;
    return computeSeconds * 0.00005;
  };

  // Side-by-side bar data
  const barData = comparisonMetrics
    .filter(m => m.format === 'percent' && !isNaN(m.valueA) && !isNaN(m.valueB))
    .map(m => ({
      metric: m.label,
      [modelA?.name?.slice(0, 14) || 'A']: +(m.valueA * 100).toFixed(1),
      [modelB?.name?.slice(0, 14) || 'B']: +(m.valueB * 100).toFixed(1),
    }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-primary/50 font-mono uppercase tracking-[0.2em]">[ mlops ]</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-1">
          <span className="text-gradient-primary">Model Comparator</span>
        </h1>
        <p className="text-sm text-muted-foreground">Compare dois modelos lado a lado e escolha o melhor para produção</p>
      </div>

      {/* Model Selectors */}
      <GlowCard className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Model A */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: BLUE_HEX }} />
              Modelo A
            </p>
            {active.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum modelo ativo</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {active.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setModelAId(d.id === modelAId ? null : d.id)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all',
                      d.id === modelAId
                        ? 'border-primary/50 bg-primary/10 text-primary shadow-sm'
                        : 'border-border/30 bg-secondary/30 text-muted-foreground hover:border-border/50'
                    )}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model B */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PURPLE_HEX }} />
              Modelo B
            </p>
            {active.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum modelo ativo</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {active.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setModelBId(d.id === modelBId ? null : d.id)}
                    disabled={d.id === modelAId}
                    className={cn(
                      'px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all',
                      d.id === modelAId ? 'opacity-30 cursor-not-allowed border-border/20 bg-secondary/10 text-muted-foreground/50' : '',
                      d.id === modelBId && d.id !== modelAId
                        ? 'border-purple-400/50 bg-purple-400/10 text-purple-400 shadow-sm'
                        : d.id !== modelAId ? 'border-border/30 bg-secondary/30 text-muted-foreground hover:border-border/50' : ''
                    )}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </GlowCard>

      {!modelA || !modelB ? (
        <GlowCard className="flex flex-col items-center justify-center py-16 text-center">
          {active.length === 0 ? (
            <>
              <Server className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Nenhum modelo ativo</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Implante modelos para compará-los aqui</p>
            </>
          ) : (
            <>
              <GitCompare className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-semibold text-muted-foreground">Selecione dois modelos</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Escolha um modelo para cada lado acima</p>
            </>
          )}
        </GlowCard>
      ) : (
        <>
          {/* Winner Banner */}
          <WinnerBanner modelA={modelA} modelB={modelB} metrics={comparisonMetrics} />

          {/* Side-by-side metric rows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlowCard>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: BLUE_HEX }} />
                <h3 className="font-semibold text-foreground text-sm">{modelA.name}</h3>
                <Badge className="text-[9px] bg-secondary text-muted-foreground">{modelA.model_name}</Badge>
              </div>
              <div className="space-y-0">
                <StatRow label="Acurácia" valueA={getMetric(modelA, 'accuracy') * 100} valueB={null} format="percent" icon={Target} higherBetter />
                <StatRow label="Precisão" valueA={getMetric(modelA, 'precision') * 100} valueB={null} format="percent" icon={Crosshair} higherBetter />
                <StatRow label="Recall" valueA={getMetric(modelA, 'recall') * 100} valueB={null} format="percent" icon={Gauge} higherBetter />
                <StatRow label="F1-Score" valueA={getMetric(modelA, 'f1_score') * 100} valueB={null} format="percent" icon={TrendingUp} higherBetter />
                <StatRow label="Latência" valueA={modelA.avg_latency_ms || 0} valueB={null} format="ms" icon={Clock} higherBetter={false} />
                <StatRow label="Taxa de Erro" valueA={modelA.error_rate || 0} valueB={null} format="percent" icon={AlertTriangle} higherBetter={false} />
                <StatRow label="Chamadas" valueA={modelA.total_calls || 0} valueB={null} format="number" icon={Activity} higherBetter />
              </div>
            </GlowCard>

            <GlowCard>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PURPLE_HEX }} />
                <h3 className="font-semibold text-foreground text-sm">{modelB.name}</h3>
                <Badge className="text-[9px] bg-secondary text-muted-foreground">{modelB.model_name}</Badge>
              </div>
              <div className="space-y-0">
                <StatRow label="Acurácia" valueA={null} valueB={getMetric(modelB, 'accuracy') * 100} format="percent" icon={Target} higherBetter />
                <StatRow label="Precisão" valueA={null} valueB={getMetric(modelB, 'precision') * 100} format="percent" icon={Crosshair} higherBetter />
                <StatRow label="Recall" valueA={null} valueB={getMetric(modelB, 'recall') * 100} format="percent" icon={Gauge} higherBetter />
                <StatRow label="F1-Score" valueA={null} valueB={getMetric(modelB, 'f1_score') * 100} format="percent" icon={TrendingUp} higherBetter />
                <StatRow label="Latência" valueA={null} valueB={modelB.avg_latency_ms || 0} format="ms" icon={Clock} higherBetter={false} />
                <StatRow label="Taxa de Erro" valueA={null} valueB={modelB.error_rate || 0} format="percent" icon={AlertTriangle} higherBetter={false} />
                <StatRow label="Chamadas" valueA={null} valueB={modelB.total_calls || 0} format="number" icon={Activity} higherBetter />
              </div>
            </GlowCard>
          </div>

          {/* Direct Comparison */}
          <GlowCard>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <GitCompare className="w-3.5 h-3.5 text-primary" /> Comparação Direta
            </h3>
            <div className="space-y-0">
              {comparisonMetrics.map((m, i) => (
                <StatRow key={i} {...m} />
              ))}
            </div>
          </GlowCard>

          {/* Bar Chart + Cost */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Side-by-side bar */}
            <GlowCard>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <BarChart3 className="w-3.5 h-3.5 text-primary" /> Métricas de Performance
              </h3>
              {barData.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}
                      barSize={20} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" vertical={false} />
                      <XAxis dataKey="metric" tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} unit="%" />
                      <Tooltip contentStyle={{ background: 'hsl(222,40%,9%)', border: '1px solid hsl(222,25%,16%)', borderRadius: 8, color: '#fff', fontSize: 11 }} />
                      <Bar dataKey={modelA.name.slice(0, 14)} fill={BLUE_HEX} radius={[3, 3, 0, 0]} />
                      <Bar dataKey={modelB.name.slice(0, 14)} fill={PURPLE_HEX} radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-64 flex items-center justify-center">
                  <p className="text-xs text-muted-foreground">Sem métricas de performance disponíveis</p>
                </div>
              )}
            </GlowCard>

            {/* Cost Estimate */}
            <GlowCard>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <CircleDollarSign className="w-3.5 h-3.5 text-accent" /> Estimativa de Custo
              </h3>
              <div className="space-y-4">
                <p className="text-[10px] text-muted-foreground">Custo estimado com base no volume de chamadas e latência média (≈ $0.00005/seg de computação).</p>

                <div className="grid grid-cols-2 gap-3">
                  {[modelA, modelB].map((m, i) => {
                    const cost = estimatedCost(m);
                    const calls = m.total_calls || 0;
                    const avgMs = m.avg_latency_ms || 0;
                    const totalSec = ((calls * avgMs) / 1000).toFixed(1);
                    return (
                      <div key={m.id} className="rounded-lg border p-3" style={{ borderColor: i === 0 ? BLUE_HEX + '40' : PURPLE_HEX + '40' }}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: i === 0 ? BLUE_HEX : PURPLE_HEX }} />
                          <p className="text-[11px] font-semibold text-foreground truncate">{m.name}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground">Tempo total</span>
                            <span className="font-mono text-foreground">{totalSec}s</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground">Chamadas</span>
                            <span className="font-mono text-foreground">{calls.toLocaleString('pt-BR')}</span>
                          </div>
                          <div className="flex justify-between text-[10px]">
                            <span className="text-muted-foreground">Latência média</span>
                            <span className="font-mono text-foreground">{avgMs}ms</span>
                          </div>
                          <div className="flex justify-between items-center pt-2 border-t border-border/20">
                            <span className="text-[11px] font-semibold text-foreground">Custo estimado</span>
                            <span className="text-sm font-mono font-bold" style={{ color: i === 0 ? BLUE_HEX : PURPLE_HEX }}>
                              ${cost.toFixed(4)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {(() => {
                  const costA = estimatedCost(modelA);
                  const costB = estimatedCost(modelB);
                  const cheaper = costA < costB ? modelA.name : modelB.name;
                  const diff = Math.abs(costA - costB);
                  return (
                    <div className="flex items-center gap-2 bg-accent/5 border border-accent/20 rounded-lg px-3 py-2">
                      <CircleDollarSign className="w-4 h-4 text-accent" />
                      <p className="text-[11px] text-foreground">
                        <span className="font-semibold text-accent">{cheaper}</span> é ~${diff.toFixed(4)} mais econômico em processamento
                      </p>
                    </div>
                  );
                })()}
              </div>
            </GlowCard>
          </div>

          {/* Model cards summary */}
          <div className="grid grid-cols-2 gap-4">
            {[modelA, modelB].map((m, i) => {
              const cost = estimatedCost(m);
              const met = m.model_metrics || {};
              const hasMetrics = Object.keys(met).length > 0;
              return (
                <GlowCard key={m.id} tactical>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: i === 0 ? BLUE_HEX : PURPLE_HEX }} />
                      <h3 className="text-sm font-semibold text-foreground">{m.name}</h3>
                    </div>
                    <Badge className="text-[9px] bg-accent/10 text-accent">ATIVO</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mb-3">{m.model_name} · {m.task_type || 'modelo'}</p>

                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div className="bg-secondary/30 rounded-lg p-2">
                      <p className="text-muted-foreground">Acurácia</p>
                      <p className="text-sm font-mono font-bold" style={{ color: i === 0 ? BLUE_HEX : PURPLE_HEX }}>
                        {hasMetrics && met.accuracy != null ? `${(Number(met.accuracy) <= 1 ? Number(met.accuracy) * 100 : Number(met.accuracy)).toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-2">
                      <p className="text-muted-foreground">Recall</p>
                      <p className="text-sm font-mono font-bold" style={{ color: i === 0 ? BLUE_HEX : PURPLE_HEX }}>
                        {hasMetrics && met.recall != null ? `${(Number(met.recall) <= 1 ? Number(met.recall) * 100 : Number(met.recall)).toFixed(1)}%` : '—'}
                      </p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-2">
                      <p className="text-muted-foreground">Latência</p>
                      <p className="text-sm font-mono font-bold" style={{ color: i === 0 ? BLUE_HEX : PURPLE_HEX }}>{m.avg_latency_ms ? `${m.avg_latency_ms}ms` : '—'}</p>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-2">
                      <p className="text-muted-foreground">Custo est.</p>
                      <p className="text-sm font-mono font-bold" style={{ color: i === 0 ? BLUE_HEX : PURPLE_HEX }}>${cost.toFixed(4)}</p>
                    </div>
                  </div>

                  {m.endpoint_url && (
                    <div className="mt-3 pt-3 border-t border-border/30">
                      <p className="text-[9px] text-muted-foreground mb-1">Endpoint</p>
                      <code className="text-[10px] font-mono text-muted-foreground break-all">{m.endpoint_url}</code>
                    </div>
                  )}
                </GlowCard>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}