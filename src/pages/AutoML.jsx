import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import GlowCard from '@/components/ui/GlowCard';
import ReactMarkdown from 'react-markdown';
import { Zap, Play, Loader2, Trophy, Download, Sparkles, TrendingUp, Clock } from 'lucide-react';
import { runAutoML } from '@/lib/localML';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)', 'hsl(330,70%,60%)', 'hsl(210,80%,60%)', 'hsl(50,92%,55%)'];
const TOOLTIP_STYLE = { background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };
const TASK_TYPES = [
  { value: 'classification', label: 'Classificação', primary_metric: 'f1_score' },
  { value: 'regression', label: 'Regressão', primary_metric: 'r2_score' },
];
const TIME_BUDGETS = ['1 min', '3 min', '5 min', '10 min'];
const TABS = [
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'best', label: 'Melhor Modelo' },
  { id: 'preprocessing', label: 'Pré-processamento' },
  { id: 'ai', label: 'Análise IA' },
];

export default function AutoML() {
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedProjectId, setSelectedProjectId] = useState(urlParams.get('project') || '');
  const [taskType, setTaskType] = useState('classification');
  const [targetColumn, setTargetColumn] = useState('');
  const [timeBudget, setTimeBudget] = useState('5 min');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('leaderboard');

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 50) });
  const projectsWithData = projects.filter(p => p.dataset_file_url);
  const project = projectsWithData.find(p => p.id === selectedProjectId);
  const primaryMetricLabel = taskType === 'regression' ? 'R²' : 'F1-Score';

  const runAutoMLPipeline = async () => {
    if (!project) return toast.error('Selecione um projeto');
    if (!targetColumn) return toast.error('Selecione a coluna alvo');
    setIsRunning(true); setResult(null);

    await new Promise(r => setTimeout(r, 1800)); // simulate training time
    const res = runAutoML(project, targetColumn, taskType, timeBudget);

    setResult(res); setIsRunning(false);
    toast.success('AutoML Pipeline concluído!');
  };

  const exportBestModel = () => {
    if (!result?.best_model) return;
    const data = { project: project?.name, task: taskType, target: targetColumn, generated_at: new Date().toISOString(), best_model: result.best_model, full_leaderboard: result.leaderboard };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `automl_best_model_${project?.name?.replace(/\s+/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Modelo exportado!');
  };

  return (
    <div>
      <PageHeader title="AutoML Pipeline" subtitle="Teste automaticamente dezenas de modelos e estratégias em paralelo" />

      <GlowCard className="mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Projeto</label>
            <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setTargetColumn(''); setResult(null); }}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{projectsWithData.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tarefa</label>
            <Select value={taskType} onValueChange={setTaskType}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{TASK_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Coluna Alvo</label>
            <Select value={targetColumn} onValueChange={setTargetColumn} disabled={!project}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{(project?.column_info || []).map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Budget</label>
            <Select value={timeBudget} onValueChange={setTimeBudget}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{TIME_BUDGETS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={runAutoMLPipeline} disabled={isRunning || !selectedProjectId || !targetColumn} className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
            {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executando AutoML...</> : <><Zap className="w-4 h-4 mr-2" /> Iniciar AutoML Pipeline</>}
          </Button>
          {result && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{result.total_models_tested} modelos</span><span>·</span>
              <span>{result.preprocessing_strategies_tested} estratégias</span><span>·</span>
              <Clock className="w-3 h-3" /><span>{result.total_time_seconds?.toFixed(0)}s</span>
            </div>
          )}
        </div>
      </GlowCard>

      {!result && !isRunning && <EmptyState icon={Zap} title="AutoML não executado" description="Configure e inicie o pipeline para testar automaticamente dezenas de modelos" />}

      {result && (
        <div className="space-y-5">
          {result.best_model && (
            <GlowCard glowColor="success" className="border-emerald-400/30">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-400/10 flex items-center justify-center"><Trophy className="w-5 h-5 text-emerald-400" /></div>
                  <div>
                    <p className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Melhor Modelo</p>
                    <p className="text-lg font-bold text-foreground">{result.best_model.name}</p>
                    <p className="text-xs text-muted-foreground">{result.best_model.preprocessing}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {result.leaderboard?.[0]?.primary_metric != null && (
                    <div className="text-center">
                      <p className="text-2xl font-bold font-mono text-emerald-400">{(result.leaderboard[0].primary_metric * 100).toFixed(1)}%</p>
                      <p className="text-[10px] text-muted-foreground">{primaryMetricLabel}</p>
                    </div>
                  )}
                  <Button onClick={exportBestModel} size="sm" variant="outline" className="border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10">
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Exportar Modelo
                  </Button>
                </div>
              </div>
              {result.best_model.why_best && <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/30">{result.best_model.why_best}</p>}
            </GlowCard>
          )}

          <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap', activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'leaderboard' && (
            <GlowCard>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Leaderboard Global</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/60">
                      {['#', 'Modelo', 'Pré-processamento', primaryMetricLabel, 'CV Score', 'CV Std', 'Overfitting', 'Complexidade', 'Tempo'].map(h => (
                        <th key={h} className="text-left p-2.5 text-muted-foreground font-semibold border-b border-border/40 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(result.leaderboard || []).slice(0, 30).map((model, i) => (
                      <tr key={i} className={cn('hover:bg-secondary/40 transition-colors', i % 2 === 0 ? 'bg-secondary/10' : '', model.is_best ? 'border-l-2 border-emerald-400' : '')}>
                        <td className="p-2.5 border-b border-border/10">
                          <div className="flex items-center gap-1">
                            {model.rank === 1 && <Trophy className="w-3 h-3 text-amber-400" />}
                            <span className={cn('font-mono font-bold', model.rank === 1 ? 'text-amber-400' : model.rank <= 3 ? 'text-primary' : 'text-muted-foreground')}>{model.rank}</span>
                          </div>
                        </td>
                        <td className="p-2.5 border-b border-border/10 font-medium text-foreground whitespace-nowrap">{model.model_name}</td>
                        <td className="p-2.5 border-b border-border/10 text-muted-foreground max-w-xs truncate">{model.preprocessing}</td>
                        <td className="p-2.5 border-b border-border/10">
                          <span className={cn('font-mono font-bold', model.rank === 1 ? 'text-emerald-400' : model.rank <= 5 ? 'text-primary' : 'text-foreground')}>
                            {(model.primary_metric * 100).toFixed(2)}%
                          </span>
                        </td>
                        <td className="p-2.5 border-b border-border/10 font-mono text-muted-foreground">{model.cv_score?.toFixed(3) ?? '—'}</td>
                        <td className="p-2.5 border-b border-border/10 font-mono text-muted-foreground">±{model.cv_std?.toFixed(3) ?? '—'}</td>
                        <td className="p-2.5 border-b border-border/10">
                          <span className={cn('font-mono', (model.overfitting_score || 0) > 0.3 ? 'text-destructive' : 'text-emerald-400')}>
                            {((model.overfitting_score || 0) * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td className="p-2.5 border-b border-border/10">
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px]', model.complexity === 'low' ? 'bg-emerald-400/10 text-emerald-400' : model.complexity === 'medium' ? 'bg-amber-400/10 text-amber-400' : 'bg-destructive/10 text-destructive')}>
                            {model.complexity}
                          </span>
                        </td>
                        <td className="p-2.5 border-b border-border/10 font-mono text-muted-foreground">{model.training_time?.toFixed(1)}s</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlowCard>
          )}

          {activeTab === 'best' && result.best_model && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-3 text-sm">Hiperparâmetros</h3>
                  <div className="space-y-2">
                    {Object.entries(result.best_model.hyperparameters || {}).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                        <span className="text-xs font-mono text-muted-foreground">{k}</span>
                        <span className="text-xs font-mono font-bold text-primary">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </GlowCard>
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-3 text-sm">Métricas Completas</h3>
                  <div className="space-y-2">
                    {Object.entries(result.best_model.full_metrics || {}).map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                        <span className="text-xs text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                        <span className="text-xs font-mono font-bold text-emerald-400">{typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              </div>
              {result.best_model.feature_importance?.length > 0 && (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-4 text-sm">Feature Importance</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.best_model.feature_importance.slice(0, 12)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                        <YAxis dataKey="feature" type="category" tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} width={100} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="score" fill={COLORS[0]} radius={[0,3,3,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlowCard>
              )}
            </div>
          )}

          {activeTab === 'preprocessing' && (
            <div className="space-y-5">
              {result.preprocessing_comparison?.length > 0 && (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-4 text-sm">Estratégias de Pré-processamento</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.preprocessing_comparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                        <XAxis dataKey="strategy" tick={{ fontSize: 7, fill: 'hsl(215,20%,55%)' }} angle={-15} textAnchor="end" height={40} />
                        <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} domain={[0, 1]} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="avg_score" name="Score Médio" fill={COLORS[0]} radius={[3,3,0,0]} />
                        <Bar dataKey="best_score" name="Melhor Score" fill={COLORS[2]} radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlowCard>
              )}
              {result.algorithm_comparison?.length > 0 && (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-4 text-sm">Comparação por Algoritmo</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.algorithm_comparison}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                        <XAxis dataKey="algorithm" tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                        <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} domain={[0, 1]} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="avg_score" name="Score Médio" fill={COLORS[1]} radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlowCard>
              )}
              {result.insights?.length > 0 && (
                <GlowCard glowColor="accent">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Insights do AutoML</h3>
                  <div className="space-y-2">
                    {result.insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="text-accent font-bold flex-shrink-0">{i + 1}.</span><span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}
            </div>
          )}

          {activeTab === 'ai' && result.ai_summary && (
            <GlowCard glowColor="accent">
              <div className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-accent" /><h3 className="font-semibold text-foreground">Análise do AutoML — IA</h3></div>
              <ReactMarkdown components={{
                p: ({ children }) => <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{children}</p>,
                h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mb-2 mt-5 pb-1 border-b border-border/30">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-accent mb-2 mt-3">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc ml-5 space-y-1 mb-3">{children}</ul>,
                li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
              }}>{result.ai_summary}</ReactMarkdown>
            </GlowCard>
          )}
        </div>
      )}
    </div>
  );
}