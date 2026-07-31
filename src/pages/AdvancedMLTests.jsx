import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Brain, Play, Loader2, FlaskConical, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import {
  runSurvivalAnalysis, runCausalInference, runTimeSeriesML,
  runModelCalibration, runCostSensitiveLearning, runMultilabelClassification
} from '@/lib/advancedML';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  LineChart, Line, AreaChart, Area, ScatterChart, Scatter
} from 'recharts';

const COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)', 'hsl(330,70%,60%)'];
const TT = { background: 'hsl(222,40%,9%)', border: '1px solid hsl(222,25%,16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };

const MODULES = [
  {
    id: 'survival_analysis',
    label: 'Análise de Sobrevivência',
    icon: '⏱️',
    desc: 'Kaplan-Meier, Cox PH, Weibull — tempo até evento',
    needsTarget: true,
    targetLabel: 'Coluna de Tempo',
    params: [
      { id: 'event_col', label: 'Coluna de Evento (0/1)', type: 'column' },
      { id: 'groups', label: 'Coluna de Grupos (opcional)', type: 'column_opt' },
    ],
  },
  {
    id: 'causal_inference',
    label: 'Inferência Causal',
    icon: '🔗',
    desc: 'DoWhy, Propensity Score, ATE, CATE, IV',
    needsTarget: true,
    targetLabel: 'Coluna de Tratamento (0/1)',
    params: [
      { id: 'outcome_col', label: 'Coluna de Outcome', type: 'column' },
      { id: 'method', label: 'Método', type: 'select', options: ['Propensity Score Matching', 'Inverse Probability Weighting', 'Double ML', 'Instrumental Variables'] },
    ],
  },
  {
    id: 'time_series_ml',
    label: 'Time Series ML',
    icon: '📈',
    desc: 'ARIMA, Prophet, LSTM features, Lag features, Walk-forward CV',
    needsTarget: true,
    targetLabel: 'Coluna de Data/Tempo',
    params: [
      { id: 'target_col', label: 'Coluna Alvo (valor)', type: 'column' },
      { id: 'horizon', label: 'Horizonte de Previsão', type: 'select', options: ['7 dias', '14 dias', '30 dias', '90 dias', '1 ano'] },
    ],
  },
  {
    id: 'model_calibration',
    label: 'Calibração de Modelos',
    icon: '🎯',
    desc: 'Platt Scaling, Isotonic Regression, ECE, Reliability Diagram',
    needsTarget: true,
    targetLabel: 'Coluna Alvo (classe)',
    params: [
      { id: 'base_model', label: 'Modelo Base', type: 'select', options: ['Random Forest', 'XGBoost', 'Gradient Boosting', 'SVM', 'Rede Neural'] },
      { id: 'method', label: 'Método de Calibração', type: 'select', options: ['Platt Scaling', 'Isotonic Regression', 'Beta Calibration', 'Temperature Scaling'] },
    ],
  },
  {
    id: 'cost_sensitive',
    label: 'Cost-Sensitive Learning',
    icon: '💰',
    desc: 'Otimiza threshold com matriz de custos personalizada — reduz custo esperado',
    needsTarget: true,
    targetLabel: 'Coluna Alvo (classe)',
    params: [
      { id: 'fp_cost', label: 'Custo Falso Positivo (R$)', type: 'number', default: '100' },
      { id: 'fn_cost', label: 'Custo Falso Negativo (R$)', type: 'number', default: '500' },
      { id: 'model', label: 'Modelo', type: 'select', options: ['XGBoost', 'Random Forest', 'Gradient Boosting', 'Regressão Logística'] },
    ],
  },
  {
    id: 'multilabel',
    label: 'Classificação Multi-Label',
    icon: '🏷️',
    desc: 'Binary Relevance, Label Powerset, Classifier Chains, Hamming Loss',
    needsTarget: false,
    params: [
      { id: 'label_cols', label: 'Nº de Labels (auto-detectado)', type: 'info', value: 'Detectado automaticamente' },
      { id: 'strategy', label: 'Estratégia', type: 'select', options: ['Binary Relevance', 'Classifier Chains', 'Label Powerset', 'RAkEL'] },
    ],
  },
];

const RUN_FN = {
  survival_analysis: runSurvivalAnalysis,
  causal_inference: runCausalInference,
  time_series_ml: runTimeSeriesML,
  model_calibration: runModelCalibration,
  cost_sensitive: runCostSensitiveLearning,
  multilabel: runMultilabelClassification,
};

export default function AdvancedMLTests() {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedModule, setSelectedModule] = useState('');
  const [targetColumn, setTargetColumn] = useState('');
  const [paramValues, setParamValues] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [expandedResult, setExpandedResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 50) });
  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['analyses-advanced', selectedProjectId],
    queryFn: () => base44.entities.Analysis.filter({ project_id: selectedProjectId }, '-created_date', 30),
    enabled: !!selectedProjectId,
  });

  const projectsWithData = projects.filter(p => p.dataset_file_url);
  const project = projectsWithData.find(p => p.id === selectedProjectId);
  const moduleDef = MODULES.find(m => m.id === selectedModule);
  const advancedAnalyses = analyses.filter(a => Object.keys(RUN_FN).includes(a.type));

  const setParam = (id, val) => setParamValues(prev => ({ ...prev, [id]: val }));

  const runAnalysis = async () => {
    if (!selectedProjectId || !selectedModule) return toast.error('Selecione o projeto e o módulo');
    if (moduleDef?.needsTarget && !targetColumn) return toast.error(`Selecione a coluna: ${moduleDef.targetLabel}`);
    setIsRunning(true);

    const analysis = await base44.entities.Analysis.create({
      project_id: selectedProjectId,
      type: selectedModule,
      name: `${moduleDef.label} — ${new Date().toLocaleString('pt-BR')}`,
      status: 'running',
      config: { target_column: targetColumn, ...paramValues },
    });

    await new Promise(r => setTimeout(r, 1500));
    const fn = RUN_FN[selectedModule];
    const result = fn(project, targetColumn, paramValues);

    await base44.entities.Analysis.update(analysis.id, {
      status: 'completed', results: result,
      ai_interpretation: result?.interpretation || '',
      ai_recommendations: result?.recommendations || [],
    });

    queryClient.invalidateQueries({ queryKey: ['analyses-advanced', selectedProjectId] });
    setIsRunning(false);
    toast.success('Análise avançada concluída!');
  };

  const deleteAnalysis = async (id, e) => {
    e.stopPropagation();
    await base44.entities.Analysis.delete(id);
    queryClient.invalidateQueries({ queryKey: ['analyses-advanced', selectedProjectId] });
  };

  return (
    <div>
      <PageHeader title="Testes ML Avançados"
        subtitle="Módulos especializados: Sobrevivência, Causal, Time Series ML, Calibração e mais" />

      {/* Project selector */}
      <GlowCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Projeto:</Label>
          <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setTargetColumn(''); setParamValues({}); }}>
            <SelectTrigger className="bg-secondary/50 w-full sm:w-72">
              <SelectValue placeholder="Selecione um projeto com dataset" />
            </SelectTrigger>
            <SelectContent>
              {projectsWithData.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {project && <span className="text-xs text-muted-foreground">{project.dataset_size?.toLocaleString('pt-BR')} linhas · {project.dataset_columns} colunas</span>}
        </div>
      </GlowCard>

      {/* Module grid */}
      <div className="mb-5">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider">Módulo Avançado</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
          {MODULES.map(m => (
            <button key={m.id} onClick={() => { setSelectedModule(m.id); setTargetColumn(''); setParamValues({}); }}
              className={cn('p-3 rounded-xl border text-left transition-all',
                selectedModule === m.id ? 'border-primary/50 bg-primary/10' : 'border-border/40 bg-secondary/30 hover:border-border')}>
              <span className="text-xl">{m.icon}</span>
              <p className={cn('text-[11px] font-semibold mt-1 leading-tight', selectedModule === m.id ? 'text-primary' : 'text-foreground')}>{m.label}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{m.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Config */}
      {selectedModule && (
        <GlowCard className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{moduleDef?.icon} Configurar: {moduleDef?.label}</p>
          <div className="flex flex-wrap items-end gap-3">
            {moduleDef?.needsTarget && project && (
              <div>
                <Label className="text-xs text-muted-foreground">{moduleDef.targetLabel} *</Label>
                <Select value={targetColumn} onValueChange={setTargetColumn}>
                  <SelectTrigger className="mt-1 bg-secondary/50 w-48">
                    <SelectValue placeholder="Selecione coluna" />
                  </SelectTrigger>
                  <SelectContent>
                    {(project.column_info || []).map(c => (
                      <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {moduleDef?.params?.map(p => {
              if (p.type === 'info') return (
                <div key={p.id}>
                  <Label className="text-xs text-muted-foreground">{p.label}</Label>
                  <p className="mt-1 text-xs text-muted-foreground px-2 py-1 bg-secondary/50 rounded-md">{p.value}</p>
                </div>
              );
              if (p.type === 'column' || p.type === 'column_opt') return (
                <div key={p.id}>
                  <Label className="text-xs text-muted-foreground">{p.label}</Label>
                  <Select value={paramValues[p.id] || ''} onValueChange={v => setParam(p.id, v)}>
                    <SelectTrigger className="mt-1 bg-secondary/50 w-44">
                      <SelectValue placeholder={p.type === 'column_opt' ? 'Opcional' : 'Selecione'} />
                    </SelectTrigger>
                    <SelectContent>
                      {p.type === 'column_opt' && <SelectItem value={null}>Nenhuma</SelectItem>}
                      {(project?.column_info || []).map(c => (
                        <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
              if (p.type === 'select') return (
                <div key={p.id}>
                  <Label className="text-xs text-muted-foreground">{p.label}</Label>
                  <Select value={paramValues[p.id] || p.options[0]} onValueChange={v => setParam(p.id, v)}>
                    <SelectTrigger className="mt-1 bg-secondary/50 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {p.options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              );
              if (p.type === 'number') return (
                <div key={p.id}>
                  <Label className="text-xs text-muted-foreground">{p.label}</Label>
                  <Input className="mt-1 bg-secondary/50 w-40 h-9 text-xs" type="number"
                    value={paramValues[p.id] ?? p.default ?? ''}
                    onChange={e => setParam(p.id, e.target.value)} />
                </div>
              );
              return null;
            })}

            <div className="ml-auto">
              <Button onClick={runAnalysis} disabled={isRunning || !selectedProjectId || !selectedModule}
                className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
                {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Executando...</> : <><Play className="w-4 h-4 mr-2" />Executar</>}
              </Button>
            </div>
          </div>
        </GlowCard>
      )}

      {/* Results */}
      {isLoading ? (
        <LoadingSpinner text="Carregando análises..." />
      ) : advancedAnalyses.length === 0 ? (
        <EmptyState icon={FlaskConical} title="Nenhuma análise avançada" description="Selecione um módulo acima e execute sua primeira análise especializada" />
      ) : (
        <div className="space-y-4">
          {advancedAnalyses.map(a => (
            <GlowCard key={a.id} hover={false} className="relative group">
              <button onClick={(e) => { e.stopPropagation(); deleteAnalysis(a.id, e); }}
                className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-card/80 border border-border/30 text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all opacity-0 group-hover:opacity-100">
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <div className="flex items-center gap-3 mb-3 cursor-pointer" onClick={() => setExpandedResult(expandedResult === a.id ? null : a.id)}>
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-base">
                  {MODULES.find(m => m.id === a.type)?.icon || '🧪'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{MODULES.find(m => m.id === a.type)?.label || a.type}</p>
                </div>
                <span className={cn('text-[10px] px-2 py-0.5 rounded font-semibold', {
                  'bg-emerald-400/10 text-emerald-400': a.status === 'completed',
                  'bg-amber-400/10 text-amber-400': a.status === 'running',
                  'bg-destructive/10 text-destructive': a.status === 'failed',
                })}>{a.status}</span>
                {expandedResult === a.id ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>

              {expandedResult === a.id && a.results && (
                <AdvancedResultView analysis={a} />
              )}
            </GlowCard>
          ))}
        </div>
      )}
    </div>
  );
}

function AdvancedResultView({ analysis }) {
  const r = analysis.results;
  const type = analysis.type;

  return (
    <div className="border-t border-border/30 pt-4 space-y-4">
      {/* Interpretation */}
      {r.interpretation && (
        <div className="prose prose-sm prose-invert max-w-none text-xs leading-relaxed">
          <ReactMarkdown>{r.interpretation}</ReactMarkdown>
        </div>
      )}

      {/* Survival Analysis charts */}
      {type === 'survival_analysis' && r.km_curves && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Curvas Kaplan-Meier</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={r.km_curves} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                  <XAxis dataKey="t" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} label={{ value: 'Tempo', position: 'insideBottom', fontSize: 9, fill: 'hsl(215,20%,55%)', dy: 8 }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <Tooltip contentStyle={TT} formatter={v => [`${(v * 100).toFixed(1)}%`]} />
                  <Line type="stepAfter" dataKey="overall" stroke="hsl(187,92%,55%)" dot={false} strokeWidth={2} name="Global" />
                  {r.group_curves?.map((g, i) => (
                    <Line key={g.name} type="stepAfter" dataKey={g.name} stroke={COLORS[(i + 1) % COLORS.length]} dot={false} strokeWidth={1.5} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {r.cox_results && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Hazard Ratios — Cox PH</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.cox_results} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                    <YAxis dataKey="feature" type="category" width={80} tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                    <Tooltip contentStyle={TT} formatter={(v, n) => [v.toFixed(3), 'Hazard Ratio']} />
                    <Bar dataKey="hr" radius={[0, 4, 4, 0]}>
                      {r.cox_results.map((d, i) => <Cell key={i} fill={d.hr > 1 ? 'hsl(330,70%,60%)' : 'hsl(152,68%,50%)'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Causal Inference */}
      {type === 'causal_inference' && r.ate_results && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Average Treatment Effect (ATE)</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={r.ate_results}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                  <XAxis dataKey="method" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <Tooltip contentStyle={TT} />
                  <Bar dataKey="ate" name="ATE" radius={[4, 4, 0, 0]}>
                    {r.ate_results.map((d, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
          {r.cate_distribution && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Distribuição CATE</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={r.cate_distribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                    <XAxis dataKey="bucket" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                    <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                    <Tooltip contentStyle={TT} />
                    <Bar dataKey="count" name="Indivíduos" fill="hsl(265,70%,60%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Time Series ML */}
      {type === 'time_series_ml' && r.forecast && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Previsão e Intervalo de Confiança</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={r.forecast} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                  <defs>
                    <linearGradient id="confGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(265,70%,60%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(265,70%,60%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                  <XAxis dataKey="period" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <Tooltip contentStyle={TT} />
                  <Area type="monotone" dataKey="upper_ci" stroke="transparent" fill="url(#confGrad)" name="IC 95%" />
                  <Area type="monotone" dataKey="lower_ci" stroke="transparent" fill="hsl(222,40%,9%)" name="IC lower" />
                  <Line type="monotone" dataKey="actual" stroke="hsl(187,92%,55%)" dot={false} strokeWidth={2} name="Real" />
                  <Line type="monotone" dataKey="predicted" stroke="hsl(265,70%,60%)" dot={false} strokeWidth={2} strokeDasharray="5 5" name="Previsto" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Model Calibration */}
      {type === 'model_calibration' && r.calibration_curve && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Reliability Diagram</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={r.calibration_curve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                  <XAxis dataKey="mean_pred" tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <Tooltip contentStyle={TT} formatter={v => [`${(v * 100).toFixed(1)}%`]} />
                  <Line type="monotone" dataKey="fraction_pos" stroke="hsl(187,92%,55%)" strokeWidth={2} dot={{ r: 3 }} name="Modelo" />
                  <Line type="monotone" dataKey="mean_pred" stroke="hsl(215,20%,55%)" strokeWidth={1} strokeDasharray="4 4" dot={false} name="Perfeito" />
                  {r.calibrated_curve && <Line type="monotone" dataKey="calibrated_frac" stroke="hsl(152,68%,50%)" strokeWidth={2} dot={{ r: 3 }} name="Calibrado" data={r.calibrated_curve} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {r.metrics && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Métricas de Calibração</p>
              <div className="space-y-2">
                {Object.entries(r.metrics).map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5 px-2 rounded bg-secondary/30 text-xs">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono font-bold text-primary">{typeof v === 'number' ? v.toFixed(4) : v}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Cost-Sensitive */}
      {type === 'cost_sensitive' && r.threshold_analysis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Custo Esperado por Threshold</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={r.threshold_analysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                  <XAxis dataKey="threshold" tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <Tooltip contentStyle={TT} />
                  <Line type="monotone" dataKey="expected_cost" stroke="hsl(35,92%,60%)" strokeWidth={2} dot={false} name="Custo Esperado" />
                  <Line type="monotone" dataKey="f1" stroke="hsl(187,92%,55%)" strokeWidth={1.5} dot={false} name="F1-Score" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          {r.optimal && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-2">Threshold Ótimo</p>
              <div className="space-y-2">
                {[
                  { label: 'Threshold Ótimo', value: `${(r.optimal.threshold * 100).toFixed(1)}%` },
                  { label: 'Custo Mínimo Esperado', value: `R$ ${r.optimal.expected_cost?.toFixed(2)}` },
                  { label: 'F1 no Threshold Ótimo', value: `${(r.optimal.f1 * 100).toFixed(1)}%` },
                  { label: 'Economia vs Threshold=0.5', value: `R$ ${r.optimal.savings?.toFixed(2)}` },
                ].map((item, i) => (
                  <div key={i} className="flex justify-between py-1.5 px-2 rounded bg-secondary/30 text-xs">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono font-bold text-primary">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Multi-label */}
      {type === 'multilabel' && r.label_metrics && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">Métricas por Label</p>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={r.label_metrics}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                <YAxis domain={[0, 1]} tickFormatter={v => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                <Tooltip contentStyle={TT} formatter={v => `${(v * 100).toFixed(1)}%`} />
                <Bar dataKey="f1" name="F1" fill="hsl(187,92%,55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="precision" name="Precision" fill="hsl(265,70%,60%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="recall" name="Recall" fill="hsl(152,68%,50%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recommendations */}
      {r.recommendations?.length > 0 && (
        <div className="pt-2 border-t border-border/20">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-2">Recomendações</p>
          <ul className="space-y-1">
            {r.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="text-primary mt-0.5">•</span>{rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}