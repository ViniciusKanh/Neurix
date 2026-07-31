import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import { BarChart3, TrendingUp, Brain, Activity, Zap, Target, Clock, ArrowUpRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend,
  ScatterChart, Scatter, ZAxis, LineChart, Line, AreaChart, Area,
  ReferenceLine, ComposedChart
} from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)', 'hsl(330,70%,60%)'];
const TT = { background: 'hsl(222,40%,9%)', border: '1px solid hsl(222,25%,16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };

const TYPE_LABELS = {
  classification: 'Classificação', regression: 'Regressão', clustering: 'Agrupamento',
  anomaly_detection: 'Anomalias', association_rules: 'Regras Assoc.',
  dimensionality_reduction: 'Red. Dim.', feature_selection: 'Feat. Selection',
  survival_analysis: 'Survival', causal_inference: 'Causal', time_series_ml: 'Time Series ML',
  model_calibration: 'Calibração', cost_sensitive: 'Cost-Sensitive',
};

const VIEWS = ['Visão Geral', 'Modelos & Métricas', 'Projetos', 'Produção'];

export default function AnalyticsDashboard() {
  const [view, setView] = useState('Visão Geral');

  const { data: projects = [], isLoading } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const { data: analyses = [] } = useQuery({ queryKey: ['analyses-all'], queryFn: () => base44.entities.Analysis.list('-created_date', 200) });
  const { data: deployments = [] } = useQuery({ queryKey: ['deployments-dash'], queryFn: () => base44.entities.ModelDeployment.list('-created_date', 100) });

  if (isLoading) return <LoadingSpinner text="Carregando analytics..." />;

  // ── Computed metrics ─────────────────────────────────────────────────────────
  const completedAnalyses = analyses.filter(a => a.status === 'completed');
  const activeDeploys = deployments.filter(d => d.status === 'active');
  const totalRows = projects.reduce((s, p) => s + (p.dataset_size || 0), 0);
  const totalCols = projects.reduce((s, p) => s + (p.dataset_columns || 0), 0);
  const withDataset = projects.filter(p => p.dataset_file_url);

  // ── Chart: analyses per type ──────────────────────────────────────────────────
  const typeCount = {};
  analyses.forEach(a => {
    const l = TYPE_LABELS[a.type] || a.type;
    typeCount[l] = (typeCount[l] || 0) + 1;
  });
  const typeData = Object.entries(typeCount).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // ── Chart: analyses per week (last 8 weeks) ───────────────────────────────────
  const weekBuckets = {};
  analyses.forEach(a => {
    const d = a.created_date;
    if (!d) return;
    const dt = new Date(d);
    const weekNum = Math.floor((Date.now() - dt.getTime()) / (7 * 24 * 3600 * 1000));
    if (weekNum > 7) return;
    const label = `S-${weekNum === 0 ? 'atual' : weekNum}`;
    weekBuckets[weekNum] = weekBuckets[weekNum] || { label, total: 0, completed: 0 };
    weekBuckets[weekNum].total++;
    if (a.status === 'completed') weekBuckets[weekNum].completed++;
  });
  const weekData = Object.entries(weekBuckets).sort(([a], [b]) => Number(b) - Number(a))
    .map(([, v]) => v).slice(0, 8).reverse();

  // ── Chart: radar — model types coverage ──────────────────────────────────────
  const radarData = [
    { subject: 'Classificação', value: analyses.filter(a => a.type === 'classification').length },
    { subject: 'Regressão', value: analyses.filter(a => a.type === 'regression').length },
    { subject: 'Clustering', value: analyses.filter(a => a.type === 'clustering').length },
    { subject: 'Anomalias', value: analyses.filter(a => a.type === 'anomaly_detection').length },
    { subject: 'Red. Dim.', value: analyses.filter(a => a.type === 'dimensionality_reduction').length },
    { subject: 'Feat. Sel.', value: analyses.filter(a => a.type === 'feature_selection').length },
  ];

  // ── Chart: accuracy distribution from completed analyses ─────────────────────
  const accBuckets = { '50-60%': 0, '60-70%': 0, '70-80%': 0, '80-90%': 0, '90-100%': 0 };
  completedAnalyses.forEach(a => {
    const v = a.results?.metrics?.accuracy ?? a.results?.accuracy ?? a.results?.auc ?? null;
    if (v === null) return;
    const pct = Number(v) * (Number(v) <= 1 ? 100 : 1);
    if (pct < 60) accBuckets['50-60%']++;
    else if (pct < 70) accBuckets['60-70%']++;
    else if (pct < 80) accBuckets['70-80%']++;
    else if (pct < 90) accBuckets['80-90%']++;
    else accBuckets['90-100%']++;
  });
  const accDistData = Object.entries(accBuckets).map(([name, value]) => ({ name, value }));

  // ── Chart: project status ────────────────────────────────────────────────────
  const statusCount = { draft: 0, exploring: 0, modeling: 0, completed: 0 };
  projects.forEach(p => { if (statusCount[p.status] !== undefined) statusCount[p.status]++; });
  const statusData = [
    { name: 'Rascunho', value: statusCount.draft, color: COLORS[4] },
    { name: 'Explorando', value: statusCount.exploring, color: COLORS[0] },
    { name: 'Modelando', value: statusCount.modeling, color: COLORS[1] },
    { name: 'Concluído', value: statusCount.completed, color: COLORS[2] },
  ];

  // ── Chart: deploy metrics scatter ────────────────────────────────────────────
  const scatterData = activeDeploys.map(d => ({
    calls: d.total_calls || 0,
    latency: d.avg_latency_ms || 0,
    error: d.error_rate || 0,
    name: d.name,
  }));

  // ── Heatmap-style: analyses per project ─────────────────────────────────────
  const projectAnalysisCount = {};
  analyses.forEach(a => { projectAnalysisCount[a.project_id] = (projectAnalysisCount[a.project_id] || 0) + 1; });
  const topProjects = projects
    .map(p => ({ ...p, analysisCount: projectAnalysisCount[p.id] || 0 }))
    .sort((a, b) => b.analysisCount - a.analysisCount)
    .slice(0, 10);

  const kpis = [
    { label: 'Projetos Ativos', value: projects.filter(p => ['exploring', 'modeling'].includes(p.status)).length, icon: Activity, color: 'text-primary', bg: 'bg-primary/10', delta: '+2 este mês' },
    { label: 'Total de Análises', value: analyses.length, icon: Brain, color: 'text-accent', bg: 'bg-accent/10', delta: `${completedAnalyses.length} concluídas` },
    { label: 'Registros Processados', value: totalRows.toLocaleString('pt-BR'), icon: BarChart3, color: 'text-emerald-400', bg: 'bg-emerald-400/10', delta: `${totalCols} features totais` },
    { label: 'Deploys Ativos', value: activeDeploys.length, icon: Zap, color: 'text-amber-400', bg: 'bg-amber-400/10', delta: `${(activeDeploys.reduce((s, d) => s + (d.total_calls || 0), 0)).toLocaleString('pt-BR')} calls` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics Dashboard"
        subtitle="Visão completa de toda a atividade do laboratório ML"
        actions={
          <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg">
            {VIEWS.map(v => (
              <button key={v} onClick={() => setView(v)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap',
                  view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {v}
              </button>
            ))}
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <GlowCard key={i} hover={false} className="p-4">
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl ${k.bg} flex items-center justify-center flex-shrink-0`}>
                <k.icon className={`w-4 h-4 ${k.color}`} />
              </div>
              <div className="min-w-0">
                <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{k.label}</p>
                <p className="text-[10px] text-emerald-400 mt-1 flex items-center gap-0.5"><ArrowUpRight className="w-2.5 h-2.5" />{k.delta}</p>
              </div>
            </div>
          </GlowCard>
        ))}
      </div>

      {/* Visão Geral */}
      {view === 'Visão Geral' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Weekly activity */}
            <div className="lg:col-span-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Atividade Semanal</h3>
              <GlowCard hover={false}>
                {weekData.length === 0 ? (
                  <div className="h-52 flex items-center justify-center"><p className="text-xs text-muted-foreground">Execute análises para ver atividade</p></div>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={weekData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                        <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} />
                        <Tooltip contentStyle={TT} />
                        <Legend wrapperStyle={{ fontSize: 10 }} />
                        <Bar dataKey="total" name="Total" fill="hsl(222,25%,22%)" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="completed" name="Concluídas" fill="hsl(187,92%,55%)" radius={[3, 3, 0, 0]} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </GlowCard>
            </div>
            {/* Radar */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cobertura de Técnicas ML</h3>
              <GlowCard hover={false}>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="hsl(222,25%,20%)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                      <PolarRadiusAxis tick={false} axisLine={false} />
                      <Radar name="Análises" dataKey="value" stroke="hsl(187,92%,55%)" fill="hsl(187,92%,55%)" fillOpacity={0.25} />
                      <Tooltip contentStyle={TT} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </GlowCard>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Type distribution */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Distribuição de Tipos de Análise</h3>
              <GlowCard hover={false}>
                {typeData.length === 0 ? (
                  <div className="h-44 flex items-center justify-center"><p className="text-xs text-muted-foreground">Nenhuma análise ainda</p></div>
                ) : (
                  <div className="h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={typeData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                        <YAxis dataKey="name" type="category" width={85} tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                        <Tooltip contentStyle={TT} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {typeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </GlowCard>
            </div>

            {/* Project status */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Status dos Projetos</h3>
              <GlowCard hover={false}>
                <div className="h-44 space-y-2 flex flex-col justify-center">
                  {statusData.map(s => (
                    <div key={s.name} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">{s.name}</span>
                        <span className="font-mono font-bold" style={{ color: s.color }}>{s.value}</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full">
                        <div className="h-1.5 rounded-full transition-all" style={{ width: `${projects.length ? (s.value / projects.length * 100) : 0}%`, backgroundColor: s.color }} />
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </div>
          </div>
        </div>
      )}

      {/* Modelos & Métricas */}
      {view === 'Modelos & Métricas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Accuracy distribution */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Distribuição de Acurácia / AUC</h3>
              <GlowCard hover={false}>
                {completedAnalyses.length === 0 ? (
                  <div className="h-52 flex items-center justify-center"><p className="text-xs text-muted-foreground">Execute análises para ver distribuição</p></div>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={accDistData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(215,20%,55%)' }} />
                        <Tooltip contentStyle={TT} />
                        <Bar dataKey="value" name="Modelos" radius={[4, 4, 0, 0]}>
                          {accDistData.map((d, i) => <Cell key={i} fill={i >= 3 ? 'hsl(152,68%,50%)' : i >= 2 ? 'hsl(35,92%,60%)' : 'hsl(330,70%,60%)'} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </GlowCard>
            </div>

            {/* Top performing analyses */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Top Análises por Performance</h3>
              <GlowCard hover={false} className="h-[232px] overflow-y-auto">
                {completedAnalyses.length === 0 ? (
                  <div className="h-full flex items-center justify-center"><p className="text-xs text-muted-foreground">Nenhuma análise concluída</p></div>
                ) : (
                  <div className="space-y-2">
                    {completedAnalyses
                      .map(a => {
                        const v = a.results?.metrics?.accuracy ?? a.results?.accuracy ?? a.results?.auc ?? a.results?.metrics?.r2_score ?? null;
                        return { ...a, score: v !== null ? Number(v) * (Number(v) <= 1 ? 100 : 1) : null };
                      })
                      .filter(a => a.score !== null)
                      .sort((a, b) => b.score - a.score)
                      .slice(0, 10)
                      .map((a, i) => (
                        <div key={a.id} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground w-5">{i + 1}.</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground truncate">{a.name}</p>
                            <div className="h-1 bg-secondary rounded-full mt-0.5">
                              <div className="h-1 rounded-full" style={{ width: `${Math.min(a.score, 100)}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                          <span className="text-xs font-mono font-bold" style={{ color: COLORS[i % COLORS.length] }}>{a.score.toFixed(1)}%</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </GlowCard>
            </div>
          </div>

          {/* Detailed metrics table */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Histórico de Análises</h3>
            <GlowCard hover={false}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30">
                      {['Nome', 'Tipo', 'Status', 'Acurácia/R²', 'Data'].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-muted-foreground font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {analyses.slice(0, 15).map(a => {
                      const v = a.results?.metrics?.accuracy ?? a.results?.accuracy ?? a.results?.auc ?? a.results?.metrics?.r2_score ?? null;
                      const score = v !== null ? (Number(v) * (Number(v) <= 1 ? 100 : 1)).toFixed(1) + '%' : '—';
                      return (
                        <tr key={a.id} className="border-b border-border/20 hover:bg-secondary/20 transition-colors">
                          <td className="py-2 px-3 text-foreground font-medium max-w-[180px] truncate">{a.name}</td>
                          <td className="py-2 px-3 text-muted-foreground">{TYPE_LABELS[a.type] || a.type}</td>
                          <td className="py-2 px-3">
                            <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold', {
                              'bg-emerald-400/10 text-emerald-400': a.status === 'completed',
                              'bg-amber-400/10 text-amber-400': a.status === 'running',
                              'bg-primary/10 text-primary': a.status === 'pending',
                              'bg-destructive/10 text-destructive': a.status === 'failed',
                            })}>{a.status}</span>
                          </td>
                          <td className="py-2 px-3 font-mono text-primary">{score}</td>
                          <td className="py-2 px-3 text-muted-foreground">{a.created_date ? format(new Date(a.created_date), 'dd/MM/yy', { locale: ptBR }) : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlowCard>
          </div>
        </div>
      )}

      {/* Projetos */}
      {view === 'Projetos' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Análises por Projeto (Top 10)</h3>
              <GlowCard hover={false}>
                {topProjects.length === 0 ? (
                  <div className="h-52 flex items-center justify-center"><p className="text-xs text-muted-foreground">Nenhum projeto com análises</p></div>
                ) : (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topProjects.map(p => ({ name: p.name.slice(0, 16), value: p.analysisCount, rows: p.dataset_size || 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                        <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                        <Tooltip contentStyle={TT} />
                        <Bar dataKey="value" name="Análises" radius={[4, 4, 0, 0]}>
                          {topProjects.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </GlowCard>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Resumo de Projetos</h3>
              <GlowCard hover={false} className="space-y-3">
                {[
                  { label: 'Total de Projetos', value: projects.length },
                  { label: 'Com Dataset', value: withDataset.length },
                  { label: 'Em Exploração', value: projects.filter(p => p.status === 'exploring').length },
                  { label: 'Em Modelagem', value: projects.filter(p => p.status === 'modeling').length },
                  { label: 'Concluídos', value: projects.filter(p => p.status === 'completed').length },
                  { label: 'Total de Linhas', value: totalRows.toLocaleString('pt-BR') },
                  { label: 'Total de Features', value: totalCols },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-1 border-b border-border/20 last:border-0">
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                    <span className="text-xs font-bold font-mono text-foreground">{item.value}</span>
                  </div>
                ))}
              </GlowCard>
            </div>
          </div>

          {/* Project cards */}
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Projetos com Mais Análises</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {topProjects.slice(0, 6).map((p, i) => (
              <Link key={p.id} to={`/projects/${p.id}`}>
                <GlowCard className="cursor-pointer group p-4">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">{p.name}</p>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: `${COLORS[i % COLORS.length]}20`, color: COLORS[i % COLORS.length] }}>
                      {p.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 rounded-lg bg-secondary/40">
                      <p className="text-base font-bold font-mono text-primary">{p.analysisCount}</p>
                      <p className="text-[9px] text-muted-foreground">análises</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-secondary/40">
                      <p className="text-base font-bold font-mono text-accent">{(p.dataset_size || 0).toLocaleString('pt-BR')}</p>
                      <p className="text-[9px] text-muted-foreground">linhas</p>
                    </div>
                  </div>
                </GlowCard>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Produção */}
      {view === 'Produção' && (
        <div className="space-y-4">
          {activeDeploys.length === 0 ? (
            <EmptyState icon={Zap} title="Nenhum deploy ativo" description="Implante um modelo em produção para ver métricas aqui" action={<Link to="/deployment" className="text-xs text-primary hover:underline">Ir para Deployments →</Link>} />
          ) : (
            <>
              {/* Scatter: calls x latency */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Calls vs Latência por Deploy</h3>
                  <GlowCard hover={false}>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                          <XAxis dataKey="calls" name="Calls" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} label={{ value: 'Calls', position: 'insideBottom', fontSize: 9, fill: 'hsl(215,20%,55%)', dy: 8 }} />
                          <YAxis dataKey="latency" name="Latência" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} label={{ value: 'ms', angle: -90, position: 'insideLeft', fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                          <ZAxis dataKey="error" range={[40, 200]} />
                          <Tooltip contentStyle={TT} cursor={{ strokeDasharray: '3 3' }} formatter={(v, n) => [v, n === 'calls' ? 'Calls' : n === 'latency' ? 'Latência (ms)' : 'Erro %']} />
                          <Scatter data={scatterData} fill="hsl(187,92%,55%)" fillOpacity={0.8} />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </GlowCard>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Performance dos Endpoints</h3>
                  <GlowCard hover={false} className="overflow-y-auto h-[232px]">
                    <div className="space-y-3">
                      {activeDeploys.map(d => {
                        const acc = d.model_metrics?.accuracy ?? d.model_metrics?.auc ?? null;
                        const errHigh = (d.error_rate || 0) > 5;
                        return (
                          <div key={d.id} className="p-3 rounded-lg bg-secondary/30 border border-border/20">
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-foreground">{d.name}</p>
                              <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-semibold', errHigh ? 'bg-destructive/10 text-destructive' : 'bg-emerald-400/10 text-emerald-400')}>
                                {errHigh ? 'ALERTA' : 'SAUDÁVEL'}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-1 text-center">
                              {[
                                { label: 'Calls', value: (d.total_calls || 0).toLocaleString('pt-BR'), color: 'text-primary' },
                                { label: 'Latência', value: d.avg_latency_ms ? `${d.avg_latency_ms}ms` : '—', color: 'text-accent' },
                                { label: 'Erro', value: `${d.error_rate ?? 0}%`, color: errHigh ? 'text-destructive' : 'text-amber-400' },
                                { label: 'Acc/AUC', value: acc !== null ? `${(Number(acc) * (Number(acc) <= 1 ? 100 : 1)).toFixed(0)}%` : '—', color: 'text-emerald-400' },
                              ].map((m, i) => (
                                <div key={i} className="p-1 rounded bg-secondary/40">
                                  <p className={`text-xs font-mono font-bold ${m.color}`}>{m.value}</p>
                                  <p className="text-[8px] text-muted-foreground">{m.label}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </GlowCard>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}