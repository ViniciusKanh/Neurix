import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import GlowCard from '@/components/ui/GlowCard';
import ReactMarkdown from 'react-markdown';
import { Trophy, Swords, Loader2, Sparkles, TrendingUp, CheckCircle2, AlertTriangle, BarChart2 } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ScatterChart, Scatter, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)'];
const TOOLTIP_STYLE = { background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };
const TABS = [{ id: 'overview', label: 'Visão Geral' }, { id: 'metrics', label: 'Métricas' }, { id: 'scatter', label: 'Dispersão' }, { id: 'radar', label: 'Radar' }, { id: 'ai', label: 'Veredicto' }];

const BATCH_SCENARIOS = [
  { id: 'balanced', label: 'Dados balanceados', description: 'Batch representativo com distribuição similar ao treino' },
  { id: 'skewed', label: 'Dados enviesados', description: 'Batch com distribuição desbalanceada ou outliers' },
  { id: 'temporal', label: 'Dados mais recentes', description: 'Batch de dados mais recentes que o treino' },
  { id: 'edge_cases', label: 'Casos extremos', description: 'Batch focado em casos limítrofes e difíceis' },
];

export default function ChampionChallenger() {
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedProjectId, setSelectedProjectId] = useState(urlParams.get('project') || '');
  const [championId, setChampionId] = useState('');
  const [challengerId, setChallengerId] = useState('');
  const [batchSize, setBatchSize] = useState('1000');
  const [scenario, setScenario] = useState('balanced');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 50) });
  const { data: analyses = [] } = useQuery({
    queryKey: ['analyses', selectedProjectId],
    queryFn: () => base44.entities.Analysis.filter({ project_id: selectedProjectId }, '-created_date', 20),
    enabled: !!selectedProjectId,
  });
  const { data: deployments = [] } = useQuery({ queryKey: ['deployments'], queryFn: () => base44.entities.ModelDeployment.list('-created_date', 50) });

  const projectsWithData = projects.filter(p => p.dataset_file_url);
  const project = projectsWithData.find(p => p.id === selectedProjectId);
  const completedAnalyses = analyses.filter(a => a.status === 'completed');
  const projectDeployments = deployments.filter(d => d.project_id === selectedProjectId);

  const champion = completedAnalyses.find(a => a.id === championId);
  const challenger = completedAnalyses.find(a => a.id === challengerId);

  const runComparison = async () => {
    if (!project) return toast.error('Selecione um projeto');
    if (!championId || !challengerId) return toast.error('Selecione Champion e Challenger');
    if (championId === challengerId) return toast.error('Selecione modelos diferentes');
    setIsRunning(true);
    setResult(null);

    await new Promise(r => setTimeout(r, 400));
    const { compareModels } = await import('@/lib/localChampionChallenger');
    const res = compareModels(champion, challenger, { scenario, batchSize: parseInt(batchSize) || 1000 });

    setResult(res);
    setIsRunning(false);
    setActiveTab('overview');
    toast.success('Comparação Champion vs Challenger concluída!');
  };

  const radarData = result ? (result.metric_comparison || [])
    .filter(m => ['accuracy', 'f1', 'precision', 'recall', 'auc_roc'].includes(m.metric))
    .map(m => ({ metric: m.metric.toUpperCase(), champion: parseFloat((m.champion * 100).toFixed(1)), challenger: parseFloat((m.challenger * 100).toFixed(1)) }))
    : [];

  const WinnerBadge = ({ winner }) => {
    if (winner === 'champion') return <span className="px-3 py-1 rounded-full bg-amber-400/10 text-amber-400 text-xs font-bold flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5" /> Champion Vence</span>;
    if (winner === 'challenger') return <span className="px-3 py-1 rounded-full bg-emerald-400/10 text-emerald-400 text-xs font-bold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Challenger Vence</span>;
    return <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">Empate</span>;
  };

  return (
    <div>
      <PageHeader title="Champion vs Challenger" subtitle="Compare dois modelos no mesmo batch de dados e decida qual promover para produção" />

      <GlowCard className="mb-5">
        <h3 className="font-semibold text-foreground mb-4 text-sm flex items-center gap-2"><Swords className="w-4 h-4 text-primary" /> Configurar Comparação</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Projeto</label>
            <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setChampionId(''); setChallengerId(''); }}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{projectsWithData.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><Trophy className="w-3 h-3 text-amber-400" /> Champion (modelo atual)</label>
            <Select value={championId} onValueChange={setChampionId} disabled={!selectedProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50 border-amber-400/30"><SelectValue placeholder="Modelo atual" /></SelectTrigger>
              <SelectContent>{completedAnalyses.map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1.5"><TrendingUp className="w-3 h-3 text-emerald-400" /> Challenger (novo candidato)</label>
            <Select value={challengerId} onValueChange={setChallengerId} disabled={!selectedProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50 border-emerald-400/30"><SelectValue placeholder="Novo modelo" /></SelectTrigger>
              <SelectContent>{completedAnalyses.filter(a => a.id !== championId).map(a => <SelectItem key={a.id} value={a.id}>{a.name} ({a.type})</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tamanho do Batch</label>
            <Input value={batchSize} onChange={e => setBatchSize(e.target.value)} className="mt-1 bg-secondary/50 font-mono" placeholder="1000" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Cenário do Batch</label>
            <Select value={scenario} onValueChange={setScenario}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{BATCH_SCENARIOS.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <Button onClick={runComparison} disabled={isRunning || !selectedProjectId || !championId || !challengerId}
          className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
          {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Comparando modelos...</> : <><Swords className="w-4 h-4 mr-2" /> Executar Comparação</>}
        </Button>
      </GlowCard>

      {!result && !isRunning && (
        <EmptyState icon={Swords} title="Configure a comparação" description="Selecione Champion e Challenger, defina o batch e execute a comparação lado a lado" />
      )}

      {result && (
        <div className="space-y-5">
          {/* Winner banner */}
          <GlowCard className={cn('border-2', result.winner === 'challenger' ? 'border-emerald-400/50 bg-emerald-400/5' : result.winner === 'champion' ? 'border-amber-400/50 bg-amber-400/5' : 'border-primary/50')}>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-card">
                {result.winner === 'challenger' ? '🏆' : result.winner === 'champion' ? '👑' : '🤝'}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1 flex-wrap">
                  <h3 className="font-bold text-foreground text-lg">
                    {result.winner === 'challenger' ? result.challenger?.name : result.winner === 'champion' ? result.champion?.name : 'Empate'}
                  </h3>
                  <WinnerBadge winner={result.winner} />
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-semibold', result.confidence_level === 'high' ? 'bg-emerald-400/10 text-emerald-400' : result.confidence_level === 'medium' ? 'bg-amber-400/10 text-amber-400' : 'bg-secondary text-muted-foreground')}>
                    Confiança {result.confidence_level === 'high' ? 'Alta' : result.confidence_level === 'medium' ? 'Média' : 'Baixa'}
                  </span>
                  {result.statistical_significance && <span className="px-2 py-0.5 rounded text-[10px] bg-primary/10 text-primary">Significativo p={result.p_value?.toFixed(4)}</span>}
                </div>
                <p className="text-sm text-muted-foreground">{result.winner_reason}</p>
              </div>
              <div className="text-right">
                <p className={cn('text-xs font-semibold', result.recommendation === 'promote_challenger' ? 'text-emerald-400' : result.recommendation === 'keep_champion' ? 'text-amber-400' : 'text-primary')}>
                  {result.recommendation === 'promote_challenger' ? '✅ Promover Challenger' : result.recommendation === 'keep_champion' ? '⚠ Manter Champion' : '🔬 Mais Testes'}
                </p>
                <p className="text-[10px] text-muted-foreground max-w-xs">{result.recommendation_detail}</p>
              </div>
            </div>
          </GlowCard>

          {/* Side-by-side cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ data: result.champion, label: 'Champion', color: 'text-amber-400', border: 'border-amber-400/30', icon: '👑' },
              { data: result.challenger, label: 'Challenger', color: 'text-emerald-400', border: 'border-emerald-400/30', icon: '🚀' }].map(({ data, label, color, border, icon }) => (
              <GlowCard key={label} className={cn('border', border)}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{icon}</span>
                  <div>
                    <p className={cn('text-sm font-bold', color)}>{label}</p>
                    <p className="text-[10px] text-muted-foreground">{data?.name} · {data?.type}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    { k: 'accuracy', l: 'Acurácia' }, { k: 'f1', l: 'F1' }, { k: 'auc_roc', l: 'AUC-ROC' },
                    { k: 'precision', l: 'Precisão' }, { k: 'recall', l: 'Recall' }, { k: 'avg_latency_ms', l: 'Latência' }
                  ].map(({ k, l }) => (
                    <div key={k} className="text-center p-1.5 rounded bg-secondary/30">
                      <p className={cn('text-sm font-bold font-mono', color)}>
                        {k === 'avg_latency_ms' ? `${data?.batch_metrics?.[k] || 0}ms` : `${((data?.batch_metrics?.[k] || 0) * 100).toFixed(1)}%`}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{l}</p>
                    </div>
                  ))}
                </div>
                <div>
                  {data?.strengths?.length > 0 && (
                    <div className="mb-2">
                      <p className="text-[10px] text-emerald-400 font-semibold mb-1">✓ Pontos Fortes</p>
                      {data.strengths.slice(0, 3).map((s, i) => <p key={i} className="text-[10px] text-muted-foreground">· {s}</p>)}
                    </div>
                  )}
                  {data?.weaknesses?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-destructive font-semibold mb-1">✗ Pontos Fracos</p>
                      {data.weaknesses.slice(0, 2).map((w, i) => <p key={i} className="text-[10px] text-muted-foreground">· {w}</p>)}
                    </div>
                  )}
                </div>
              </GlowCard>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap', activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && result.metric_comparison && (
            <GlowCard>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Comparação Detalhada de Métricas</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/60">
                      {['Métrica', 'Champion', 'Challenger', 'Δ%', 'Vencedor'].map(h => (
                        <th key={h} className="text-left p-2.5 text-muted-foreground font-semibold border-b border-border/40">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(result.metric_comparison || []).map((m, i) => (
                      <tr key={i} className={cn('hover:bg-secondary/40', i % 2 === 0 ? 'bg-secondary/10' : '')}>
                        <td className="p-2.5 border-b border-border/10 font-semibold text-foreground capitalize">{m.metric?.replace(/_/g, ' ')}</td>
                        <td className="p-2.5 border-b border-border/10 font-mono text-amber-400">{typeof m.champion === 'number' ? m.champion.toFixed(4) : m.champion}</td>
                        <td className="p-2.5 border-b border-border/10 font-mono text-emerald-400">{typeof m.challenger === 'number' ? m.challenger.toFixed(4) : m.challenger}</td>
                        <td className="p-2.5 border-b border-border/10 font-mono">
                          {m.delta_pct != null && (
                            <span className={m.delta_pct > 0 ? 'text-emerald-400' : 'text-destructive'}>{m.delta_pct > 0 ? '+' : ''}{m.delta_pct.toFixed(1)}%</span>
                          )}
                        </td>
                        <td className="p-2.5 border-b border-border/10">
                          {m.winner === 'champion' ? <span className="text-amber-400 text-[10px] font-semibold">👑 Champion</span>
                            : m.winner === 'challenger' ? <span className="text-emerald-400 text-[10px] font-semibold">🚀 Challenger</span>
                            : <span className="text-muted-foreground text-[10px]">Empate</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlowCard>
          )}

          {activeTab === 'metrics' && (
            <GlowCard>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Gráfico Comparativo de Métricas</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(result.metric_comparison || []).filter(m => m.metric !== 'avg_latency_ms' && m.metric !== 'throughput_per_sec')}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                    <XAxis dataKey="metric" tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                    <YAxis domain={[0, 1]} tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${(Number(v) * 100).toFixed(2)}%`]} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar dataKey="champion" name="Champion" fill="hsl(35,92%,60%)" radius={[3,3,0,0]} />
                    <Bar dataKey="challenger" name="Challenger" fill="hsl(152,68%,50%)" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlowCard>
          )}

          {activeTab === 'scatter' && result.scatter_data?.length > 0 && (
            <GlowCard>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Dispersão: Confiança Champion × Challenger por Amostra</h3>
              <p className="text-xs text-muted-foreground mb-3">Cada ponto = uma amostra do batch. Pontos perto da diagonal = modelos concordam; afastados = divergência.</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                    <XAxis dataKey="champion_conf" name="Champion" type="number" domain={[0, 1]} tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} label={{ value: 'Confiança Champion', position: 'insideBottom', offset: -3, fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                    <YAxis dataKey="challenger_conf" name="Challenger" type="number" domain={[0, 1]} tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} label={{ value: 'Confiança Challenger', angle: -90, position: 'insideLeft', fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [typeof v === 'number' ? v.toFixed(3) : v, n]} />
                    <Scatter data={result.scatter_data.slice(0, 150)} fill="hsl(187,92%,55%)" fillOpacity={0.5} />
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </GlowCard>
          )}

          {activeTab === 'radar' && radarData.length > 0 && (
            <GlowCard>
              <h3 className="font-semibold text-foreground mb-4 text-sm">Radar de Performance</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="hsl(222,25%,16%)" />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                    <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 7, fill: 'hsl(215,20%,55%)' }} />
                    <Radar name="Champion" dataKey="champion" stroke="hsl(35,92%,60%)" fill="hsl(35,92%,60%)" fillOpacity={0.2} />
                    <Radar name="Challenger" dataKey="challenger" stroke="hsl(152,68%,50%)" fill="hsl(152,68%,50%)" fillOpacity={0.2} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}%`]} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </GlowCard>
          )}

          {activeTab === 'ai' && result.ai_verdict && (
            <GlowCard glowColor="accent">
              <div className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-accent" /><h3 className="font-semibold text-foreground">Veredicto da IA</h3></div>
              {result.business_impact && (
                <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 mb-4">
                  <p className="text-xs font-semibold text-accent mb-1">Impacto de Negócio</p>
                  <p className="text-sm text-muted-foreground">{result.business_impact}</p>
                </div>
              )}
              <ReactMarkdown components={{
                p: ({ children }) => <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{children}</p>,
                h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mb-2 mt-5">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-accent mb-2 mt-4">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc ml-5 space-y-1 mb-3">{children}</ul>,
                li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
              }}>{result.ai_verdict}</ReactMarkdown>
            </GlowCard>
          )}
        </div>
      )}
    </div>
  );
}