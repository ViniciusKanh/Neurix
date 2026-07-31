import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import GlowCard from '@/components/ui/GlowCard';
import ReactMarkdown from 'react-markdown';
import { Activity, AlertTriangle, CheckCircle2, Loader2, Sparkles, BarChart2, Info, RefreshCw, Zap, TrendingDown, ChevronRight, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)'];
const TOOLTIP_STYLE = { background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };
const TABS = [{ id: 'drift', label: 'Data Drift' }, { id: 'columns', label: 'Colunas' }, { id: 'performance', label: 'Performance' }, { id: 'alerts', label: 'Alertas' }, { id: 'ai', label: 'Análise' }];

function DriftBadge({ score }) {
  if (score == null) return null;
  if (score < 0.05) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/10 text-emerald-400">✓ Estável</span>;
  if (score < 0.15) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/10 text-amber-400">⚠ Drift Leve</span>;
  if (score < 0.3) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/10 text-orange-500">⚠ Drift Moderado</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-destructive/10 text-destructive">🚨 Drift Crítico</span>;
}

const SIMULATION_SCENARIOS = [
  { id: 'stable', label: '✓ Dados estáveis (sem drift)', description: 'Simula um batch de produção similar ao treino — modelo saudável' },
  { id: 'mild_drift', label: '⚠ Drift leve (mudança sazonal)', description: 'Simula dados com pequenas mudanças de distribuição — monitoramento recomendado' },
  { id: 'high_drift', label: '🚨 Drift crítico (mudança brusca)', description: 'Simula dados muito diferentes do treino — retreinamento necessário' },
  { id: 'concept_drift', label: '🔄 Concept Drift (padrões mudaram)', description: 'A relação entre features e target mudou — modelo desatualizado' },
];

export default function ModelMonitoring() {
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedProjectId, setSelectedProjectId] = useState(urlParams.get('project') || '');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [scenario, setScenario] = useState('stable');
  const [customBatchSize, setCustomBatchSize] = useState('500');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('drift');
  const [triggerAutoML, setTriggerAutoML] = useState(false);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(null); // 'automl'|'evaluate'|'notify'|'done'
  const [candidateResult, setCandidateResult] = useState(null);
  const [showApproval, setShowApproval] = useState(false);
  const queryClient = useQueryClient();

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
  const selectedAnalysis = completedAnalyses.find(a => a.id === selectedAnalysisId);
  const projectDeployments = deployments.filter(d => d.project_id === selectedProjectId);

  const runMonitoring = async () => {
    if (!project) return toast.error('Selecione um projeto');
    setIsAnalyzing(true);
    setResult(null);

    await new Promise(r => setTimeout(r, 400));
    const { computeDrift } = await import('@/lib/localMonitoring');
    const res = computeDrift(project, { scenario, batchSize: customBatchSize, model: selectedAnalysis });

    setResult(res);
    setIsAnalyzing(false);
    setActiveTab('drift');

    if (res.retraining_trigger?.should_trigger && res.overall_drift_score > 0.2) {
      setTriggerAutoML(true);
    }
    toast.success('Análise de monitoramento concluída!');
  };

  const triggerAutoMLPipeline = async () => {
    if (!project) return;
    setTriggerAutoML(false);
    setPipelineRunning(true);
    setCandidateResult(null);
    setShowApproval(false);

    // Step 1: AutoML retraining (local simulation based on the current model)
    setPipelineStep('automl');
    await new Promise(r => setTimeout(r, 900));
    const baseAcc = selectedAnalysis?.results?.metrics?.accuracy ?? selectedAnalysis?.results?.metrics?.r2 ?? 0.82;
    const dropped = result?.performance_estimate?.estimated_current_accuracy ?? baseAcc;
    const recovered = Math.min(0.99, Math.max(dropped, baseAcc) + 0.02);
    const improvement = ((recovered - dropped) / Math.max(dropped, 0.01)) * 100;
    const candidateModels = ['XGBoost', 'Random Forest', 'Gradient Boosting', 'Regressão Logística'];
    const automlRes = {
      best_model: candidateModels[0],
      accuracy: Number(recovered.toFixed(3)),
      f1: Number(Math.max(0, recovered - 0.02).toFixed(3)),
      auc: Number(Math.min(0.99, recovered + 0.01).toFixed(3)),
      training_time_minutes: Number((1 + Math.random() * 4).toFixed(1)),
      improvement_over_previous: Number(improvement.toFixed(1)),
      leaderboard: candidateModels.map((mo, i) => ({ model: mo, score: Number((recovered - i * 0.03).toFixed(3)) })),
    };

    // Step 2: Evaluate candidate (local rule)
    setPipelineStep('evaluate');
    await new Promise(r => setTimeout(r, 800));
    const approved = automlRes.improvement_over_previous > 1.5;
    const evalRes = {
      approved,
      recommendation: approved
        ? `Promover "${automlRes.best_model}": recupera ${automlRes.improvement_over_previous.toFixed(1)}% de desempenho perdido com o drift.`
        : 'Ganho pequeno — manter o modelo atual e continuar monitorando.',
      risks: approved
        ? ['Validar em dados reais antes do deploy definitivo.', 'Monitorar drift após promoção.']
        : ['Retreinar novamente quando houver mais dados novos.'],
      confidence_level: automlRes.improvement_over_previous > 5 ? 'high' : automlRes.improvement_over_previous > 1.5 ? 'medium' : 'low',
    };

    // Step 3: Notify
    setPipelineStep('notify');
    await new Promise(r => setTimeout(r, 500));
    setCandidateResult({ automl: automlRes, eval: evalRes });
    setPipelineRunning(false);
    setPipelineStep('done');
    setShowApproval(true);
    toast.success('Pipeline concluído! Aguardando aprovação para deploy.');
  };

  const approveAndDeploy = () => {
    setShowApproval(false);
    setPipelineStep(null);
    window.location.href = `/deployment?project=${selectedProjectId}&trigger=automl`;
  };

  const overallScore = result?.overall_drift_score ?? 0;
  const driftedCols = (result?.column_drift || []).filter(c => c.is_drifted);
  const stableCols = (result?.column_drift || []).filter(c => !c.is_drifted);

  return (
    <div>
      <PageHeader title="Monitoramento de Modelos" subtitle="Detecte Data Drift, monitore performance e dispare retreinamento automático" />

      {/* Config panel */}
      <GlowCard className="mb-5">
        <h3 className="font-semibold text-foreground mb-4 text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Configurar Monitoramento</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Projeto</label>
            <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setSelectedAnalysisId(''); setResult(null); }}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{projectsWithData.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Modelo (opcional)</label>
            <Select value={selectedAnalysisId} onValueChange={setSelectedAnalysisId} disabled={!selectedProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Qualquer análise" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Análise geral do projeto</SelectItem>
                {completedAnalyses.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tamanho do Batch Simulado</label>
            <Input value={customBatchSize} onChange={e => setCustomBatchSize(e.target.value)} className="mt-1 bg-secondary/50 font-mono" placeholder="500" />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 block">Cenário de Batch de Produção</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SIMULATION_SCENARIOS.map(s => (
              <button key={s.id} onClick={() => setScenario(s.id)}
                className={cn('p-3 rounded-lg border text-left transition-all', scenario === s.id ? 'border-primary/60 bg-primary/5' : 'border-border/30 bg-secondary/20 hover:border-border/60')}>
                <p className="text-xs font-semibold text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
              </button>
            ))}
          </div>
        </div>

        <Button onClick={runMonitoring} disabled={isAnalyzing || !selectedProjectId} className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
          {isAnalyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando Drift...</> : <><Activity className="w-4 h-4 mr-2" /> Executar Monitoramento</>}
        </Button>

        {projectDeployments.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2">
            {projectDeployments.length} deployment(s) ativo(s) neste projeto: {projectDeployments.map(d => d.name).join(', ')}
          </p>
        )}
      </GlowCard>

      {/* AutoML trigger banner */}
      {triggerAutoML && result && (
        <GlowCard className="mb-5 border-destructive/50 bg-destructive/5">
          <div className="flex items-center gap-3 flex-wrap">
            <TrendingDown className="w-5 h-5 text-destructive flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-destructive">🚨 Drift Crítico Detectado — Retreinamento Recomendado</p>
              <p className="text-xs text-muted-foreground">{result.retraining_trigger?.reason}</p>
            </div>
            <Button onClick={triggerAutoMLPipeline} disabled={pipelineRunning} size="sm" className="bg-destructive text-white hover:bg-destructive/90">
              <Zap className="w-3.5 h-3.5 mr-1.5" /> Disparar Pipeline AutoML
            </Button>
            <Button onClick={() => setTriggerAutoML(false)} size="sm" variant="ghost" className="h-7 text-xs">Ignorar</Button>
          </div>
        </GlowCard>
      )}

      {/* Pipeline running steps */}
      {pipelineRunning && (
        <GlowCard className="mb-5 border-primary/40 bg-primary/5">
          <p className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin text-primary" /> Pipeline Automatizado em Execução</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[{id:'automl',label:'🔁 Retreinando AutoML'},{id:'evaluate',label:'🧪 Avaliando Candidato'},{id:'notify',label:'📬 Preparando Notificação'}].map((s,i) => (
              <React.Fragment key={s.id}>
                <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', pipelineStep === s.id ? 'bg-primary text-primary-foreground' : 'bg-secondary/50 text-muted-foreground')}>{s.label}</span>
                {i < 2 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              </React.Fragment>
            ))}
          </div>
        </GlowCard>
      )}

      {/* Approval banner */}
      {showApproval && candidateResult && (
        <GlowCard className="mb-5 border-emerald-400/50 bg-emerald-400/5">
          <div className="flex items-start gap-3 flex-wrap">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-semibold text-emerald-400">✅ Modelo Candidato Pronto para Deploy</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[{label:'Melhor Modelo', value: candidateResult.automl.best_model},{label:'Acurácia', value: `${(candidateResult.automl.accuracy * 100).toFixed(1)}%`},{label:'F1 Score', value: candidateResult.automl.f1?.toFixed(3)},{label:'Melhora', value: `+${candidateResult.automl.improvement_over_previous?.toFixed(1)}%`}].map((s,i) => (
                  <div key={i} className="text-center p-2 rounded bg-secondary/30">
                    <p className="text-sm font-bold font-mono text-primary">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{candidateResult.eval.recommendation}</p>
              {candidateResult.eval.risks?.length > 0 && (
                <p className="text-xs text-amber-400">⚠ Riscos: {candidateResult.eval.risks.join('; ')}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={approveAndDeploy} size="sm" className="bg-emerald-500 text-white hover:bg-emerald-600">
                <Rocket className="w-3.5 h-3.5 mr-1.5" /> Aprovar Deploy
              </Button>
              <Button onClick={() => setShowApproval(false)} size="sm" variant="ghost" className="h-7 text-xs">Rejeitar</Button>
            </div>
          </div>
        </GlowCard>
      )}

      {!result && !isAnalyzing && (

        <EmptyState icon={Activity} title="Configure e execute o monitoramento"
          description="Selecione um projeto, escolha o cenário de batch e clique em Executar. Não é necessário fazer upload — a análise é baseada nos dados do projeto." />
      )}

      {result && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Score de Drift', value: `${(overallScore * 100).toFixed(1)}%`, color: overallScore > 0.3 ? 'text-destructive' : overallScore > 0.15 ? 'text-amber-400' : 'text-emerald-400' },
              { label: 'Colunas com Drift', value: driftedCols.length, color: driftedCols.length > 0 ? 'text-destructive' : 'text-emerald-400' },
              { label: 'Colunas Estáveis', value: stableCols.length, color: 'text-emerald-400' },
              { label: 'Retreinamento', value: result.performance_estimate?.retraining_recommended ? '🔄 Sim' : '✓ Não', color: result.performance_estimate?.retraining_recommended ? 'text-destructive' : 'text-emerald-400' },
            ].map((s, i) => (
              <GlowCard key={i} className="text-center py-3" hover={false}>
                <p className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </GlowCard>
            ))}
          </div>

          <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap', activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'drift' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {result.distribution_comparison?.length > 0 && (
                  <GlowCard>
                    <h3 className="font-semibold text-foreground mb-3 text-sm flex items-center gap-2"><BarChart2 className="w-4 h-4 text-primary" /> Comparação de Distribuições</h3>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={result.distribution_comparison.slice(0, 10)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                          <XAxis dataKey="feature" tick={{ fontSize: 7, fill: 'hsl(215,20%,55%)' }} angle={-30} textAnchor="end" height={35} />
                          <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          <Bar dataKey="original" name="Treino" fill={COLORS[0]} radius={[3,3,0,0]} />
                          <Bar dataKey="batch" name="Batch Prod." fill={COLORS[1]} radius={[3,3,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </GlowCard>
                )}

                {result.drift_timeline?.length > 0 && (
                  <GlowCard>
                    <h3 className="font-semibold text-foreground mb-3 text-sm">Evolução do Drift no Tempo</h3>
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={result.drift_timeline}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                          <XAxis dataKey="period" tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                          <YAxis domain={[0, 1]} tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${(Number(v) * 100).toFixed(1)}%`, 'Drift Score']} />
                          <Bar dataKey="drift_score" name="Drift Score" radius={[3,3,0,0]}
                            fill="hsl(187,92%,55%)"
                            label={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </GlowCard>
                )}
              </div>

              {result.batch_summary && (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-3 text-sm">Resumo do Batch Simulado — "{result.batch_summary.scenario_simulated || scenario}"</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Linhas no Batch', value: result.batch_summary.rows || customBatchSize, color: 'text-primary' },
                      { label: 'Colunas Correspondentes', value: result.batch_summary.columns_matched || project?.dataset_columns, color: 'text-emerald-400' },
                      { label: 'Colunas Faltando', value: result.batch_summary.columns_missing || 0, color: 'text-amber-400' },
                      { label: 'Severidade', value: result.drift_severity || '—', color: overallScore > 0.3 ? 'text-destructive' : 'text-emerald-400' },
                    ].map((s, i) => (
                      <div key={i} className="text-center p-2.5 rounded-lg bg-secondary/30">
                        <p className={cn('text-lg font-bold font-mono', s.color)}>{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}
            </div>
          )}

          {activeTab === 'columns' && (
            <GlowCard>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/60">
                      {['Coluna', 'Score', 'Status', 'Método', 'Média Treino', 'Média Batch', 'Δ%', 'Impacto no Modelo'].map(h => (
                        <th key={h} className="text-left p-2.5 text-muted-foreground font-semibold border-b border-border/40 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(result.column_drift || []).sort((a, b) => (b.drift_score || 0) - (a.drift_score || 0)).map((col, i) => {
                      const delta = col.original_mean && col.batch_mean ? ((col.batch_mean - col.original_mean) / Math.abs(col.original_mean || 1) * 100) : null;
                      return (
                        <tr key={i} className={cn('hover:bg-secondary/40', i % 2 === 0 ? 'bg-secondary/10' : '', col.is_drifted ? 'border-l-2 border-l-destructive/40' : '')}>
                          <td className="p-2.5 border-b border-border/10 font-mono text-foreground">{col.column}</td>
                          <td className="p-2.5 border-b border-border/10">
                            <div className="flex items-center gap-2">
                              <div className="w-12 h-1.5 rounded-full bg-secondary/50">
                                <div className="h-full rounded-full" style={{ width: `${Math.min((col.drift_score || 0) * 100, 100)}%`, backgroundColor: col.drift_score > 0.3 ? 'hsl(0,72%,55%)' : col.drift_score > 0.15 ? 'hsl(35,92%,60%)' : 'hsl(152,68%,50%)' }} />
                              </div>
                              <span className="font-mono text-[10px]">{((col.drift_score || 0) * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td className="p-2.5 border-b border-border/10"><DriftBadge score={col.drift_score} /></td>
                          <td className="p-2.5 border-b border-border/10 text-muted-foreground text-[10px]">{col.method || '—'}</td>
                          <td className="p-2.5 border-b border-border/10 font-mono text-muted-foreground">{col.original_mean?.toFixed(3) ?? '—'}</td>
                          <td className="p-2.5 border-b border-border/10 font-mono text-muted-foreground">{col.batch_mean?.toFixed(3) ?? '—'}</td>
                          <td className="p-2.5 border-b border-border/10 font-mono">
                            {delta != null ? <span className={delta > 10 ? 'text-destructive' : delta > 5 ? 'text-amber-400' : 'text-emerald-400'}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}%</span> : '—'}
                          </td>
                          <td className="p-2.5 border-b border-border/10 text-muted-foreground text-[10px] max-w-xs">{col.impact_on_model || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlowCard>
          )}

          {activeTab === 'performance' && result.performance_estimate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Queda de Acurácia Est.', value: `-${((result.performance_estimate.estimated_accuracy_drop || 0) * 100).toFixed(1)}%`, color: 'text-destructive' },
                  { label: 'Acurácia Atual Est.', value: `${((result.performance_estimate.estimated_current_accuracy || 0) * 100).toFixed(1)}%`, color: 'text-amber-400' },
                  { label: 'Score de Confiabilidade', value: `${((result.performance_estimate.reliability_score || 0) * 100).toFixed(0)}%`, color: 'text-primary' },
                  { label: 'Retreinamento', value: result.performance_estimate.retraining_recommended ? '🔄 Sim' : '✓ Não', color: result.performance_estimate.retraining_recommended ? 'text-destructive' : 'text-emerald-400' },
                ].map((s, i) => (
                  <GlowCard key={i} className="text-center py-3" hover={false}>
                    <p className={cn('text-xl font-bold font-mono', s.color)}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </GlowCard>
                ))}
              </div>
              {result.performance_estimate.performance_degradation_reason && (
                <GlowCard className="border-amber-400/30">
                  <p className="text-xs font-semibold text-amber-400 mb-1">Causa da Degradação</p>
                  <p className="text-sm text-muted-foreground">{result.performance_estimate.performance_degradation_reason}</p>
                </GlowCard>
              )}
              {result.performance_estimate.estimated_metrics && (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-3 text-sm">Métricas Estimadas no Batch</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {Object.entries(result.performance_estimate.estimated_metrics).slice(0, 4).map(([k, v]) => (
                      <div key={k} className="text-center p-3 rounded-lg bg-secondary/30">
                        <p className="text-base font-bold font-mono text-primary">{typeof v === 'number' ? v.toFixed(3) : v}</p>
                        <p className="text-[10px] text-muted-foreground">{k.replace(/_/g, ' ')}</p>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}
              {result.retraining_trigger && (
                <GlowCard className={cn(result.retraining_trigger.should_trigger ? 'border-destructive/40' : 'border-emerald-400/30')}>
                  <h3 className="font-semibold text-foreground mb-2 text-sm">Gatilho de Retreinamento</h3>
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className={cn('text-sm font-bold', result.retraining_trigger.urgency === 'immediate' ? 'text-destructive' : result.retraining_trigger.urgency === 'soon' ? 'text-amber-400' : 'text-emerald-400')}>
                      {result.retraining_trigger.urgency === 'immediate' ? '🚨 Imediato' : result.retraining_trigger.urgency === 'soon' ? '⚠ Em breve' : result.retraining_trigger.urgency === 'monitor' ? '👁 Monitorar' : '✓ Não necessário'}
                    </span>
                    <p className="text-xs text-muted-foreground flex-1">{result.retraining_trigger.reason}</p>
                    {result.retraining_trigger.should_trigger && (
                      <Button onClick={triggerAutoMLPipeline} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
                        <Zap className="w-3.5 h-3.5 mr-1.5" /> Disparar AutoML
                      </Button>
                    )}
                  </div>
                </GlowCard>
              )}
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="space-y-3">
              {(result.alerts || []).length === 0 && (
                <GlowCard className="text-center py-8 border-emerald-400/30">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="text-sm text-foreground">Nenhum alerta — modelo estável</p>
                </GlowCard>
              )}
              {(result.alerts || []).map((alert, i) => (
                <GlowCard key={i} className={cn(alert.severity === 'critical' ? 'border-destructive/50 bg-destructive/5' : alert.severity === 'warning' ? 'border-amber-400/40 bg-amber-400/5' : 'border-primary/30 bg-primary/5')}>
                  <div className="flex items-start gap-3">
                    {alert.severity === 'critical' ? <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" /> : alert.severity === 'warning' ? <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" /> : <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={cn('text-xs font-bold uppercase', alert.severity === 'critical' ? 'text-destructive' : alert.severity === 'warning' ? 'text-amber-400' : 'text-primary')}>{alert.severity}</span>
                        {alert.column && <span className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono text-muted-foreground">{alert.column}</span>}
                      </div>
                      <p className="text-sm text-foreground">{alert.message}</p>
                      {alert.action && <p className="text-xs text-muted-foreground mt-1">→ {alert.action}</p>}
                    </div>
                  </div>
                </GlowCard>
              ))}
            </div>
          )}

          {activeTab === 'ai' && result.ai_analysis && (
            <GlowCard glowColor="accent">
              <div className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-accent" /><h3 className="font-semibold text-foreground">Análise de Monitoramento — IA</h3></div>
              <ReactMarkdown components={{
                p: ({ children }) => <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{children}</p>,
                h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mb-2 mt-5 pb-1 border-b border-border/30">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-accent mb-2 mt-3">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc ml-5 space-y-1 mb-3">{children}</ul>,
                li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
              }}>{result.ai_analysis}</ReactMarkdown>
            </GlowCard>
          )}
        </div>
      )}
    </div>
  );
}