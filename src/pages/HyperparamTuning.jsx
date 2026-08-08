import React, { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Settings2, Play, Square, Trophy, TrendingUp, Zap, Plus, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { hyperSearch, hyperSpace } from '@/lib/realML';
import { getDataset } from '@/lib/datasetStore';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, ZAxis, Legend, ReferenceLine
} from 'recharts';

const TOOLTIP_STYLE = { background: 'hsl(222,40%,9%)', border: '1px solid hsl(222,25%,16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };

// Real engine models (names understood by normalizeModelName).
const MODELS = [
  { value: 'Random Forest', label: 'Random Forest', tasks: ['classification', 'regression'] },
  { value: 'Gradient Boosting', label: 'Gradient Boosting', tasks: ['classification', 'regression'] },
  { value: 'Árvore de Decisão', label: 'Árvore de Decisão', tasks: ['classification', 'regression'] },
  { value: 'KNN', label: 'K-Nearest Neighbors', tasks: ['classification', 'regression'] },
  { value: 'SVM', label: 'SVM (linear)', tasks: ['classification'] },
  { value: 'Regressão Logística', label: 'Regressão Logística', tasks: ['classification'] },
  { value: 'Ridge', label: 'Ridge', tasks: ['regression'] },
  { value: 'Lasso', label: 'Lasso', tasks: ['regression'] },
];

const MAX_REAL_TRIALS = 30; // real CV per trial is costly — keep responsive

export default function HyperparamTuning() {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedModel, setSelectedModel] = useState('Random Forest');
  const [nTrials, setNTrials] = useState(20);
  const [targetColumn, setTargetColumn] = useState('');
  const [taskType, setTaskType] = useState('classification');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [trials, setTrials] = useState([]);
  const [bestResult, setBestResult] = useState(null);
  const [liveTrials, setLiveTrials] = useState([]);
  const intervalRef = useRef(null);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 50) });
  const project = projects.find(p => p.id === selectedProjectId);
  const modelsForTask = MODELS.filter(m => m.tasks.includes(taskType));
  const modelDef = MODELS.find(m => m.value === selectedModel);
  const tunables = hyperSpace(selectedModel, taskType).params;

  // Keep the selected model valid for the chosen task.
  useEffect(() => {
    if (!modelsForTask.find(m => m.value === selectedModel)) setSelectedModel(modelsForTask[0]?.value || 'Random Forest');
  }, [taskType]); // eslint-disable-line

  const stopOptimization = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsRunning(false);
    toast.info('Exibição interrompida');
  };

  const runTuning = async () => {
    if (!selectedProjectId) return toast.error('Selecione um projeto');
    if (!targetColumn) return toast.error('Selecione a coluna alvo');
    if (!tunables.length) return toast.error('Este modelo não possui hiperparâmetros ajustáveis no motor.');

    setIsRunning(true);
    setTrials([]); setLiveTrials([]); setBestResult(null); setProgress(0);

    // Load the FULL local dataset and run a REAL random search scored by k-fold CV.
    let rows = [];
    try { const d = await getDataset(selectedProjectId); rows = (d && d.rows) || []; } catch { rows = []; }
    if (rows.length < 30) {
      setIsRunning(false);
      return toast.error('Dataset não está neste dispositivo (mín. 30 linhas). Reenvie no ML Studio para busca real.');
    }
    const effTrials = Math.min(nTrials, MAX_REAL_TRIALS);
    if (nTrials > MAX_REAL_TRIALS) toast.info(`Busca real limitada a ${MAX_REAL_TRIALS} trials para manter a resposta fluida.`);

    let hs;
    try {
      await new Promise(r => setTimeout(r, 30));
      const t0 = performance.now();
      hs = hyperSearch(rows, targetColumn, project.column_info || [], taskType, selectedModel, effTrials, 4);
      hs._elapsed = (performance.now() - t0) / 1000;
    } catch (e) {
      setIsRunning(false);
      return toast.error('Falha na busca: ' + e.message);
    }
    if (!hs || hs.error) { setIsRunning(false); return toast.error(hs?.message || 'Não foi possível otimizar.'); }

    // Order by evaluation order and compute best-so-far for the convergence chart.
    const ordered = [...hs.trials].sort((a, b) => a.trial - b.trial);
    const perTrial = (hs._elapsed || 0) / (ordered.length || 1);
    let best = -Infinity;
    const disp = ordered.map((t) => { best = Math.max(best, t.score); return { trial: t.trial, score: t.score, best_so_far: Number(best.toFixed(4)), duration_s: Number(perTrial.toFixed(2)), pruned: false, params: t.params }; });

    // Reveal progressively for a live feel.
    let i = 0; const batch = Math.max(1, Math.floor(disp.length / 20));
    intervalRef.current = setInterval(() => {
      if (i >= disp.length) {
        clearInterval(intervalRef.current);
        setTrials(disp);
        setBestResult({ trial: (disp.find(d => d.score === hs.best_score) || {}).trial, score: hs.best_score, params: hs.best_params, cv_std: hs.best_std });
        setIsRunning(false); setProgress(100);
        toast.success(`Busca real concluída! Melhor ${hs.metric}: ${(hs.best_score * 100).toFixed(2)}%`);
        return;
      }
      setLiveTrials(prev => [...prev, ...disp.slice(i, i + batch)]);
      setProgress(Math.round((i + batch) / disp.length * 100));
      i += batch;
    }, 90);
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const exportResults = () => {
    const data = { project: project?.name, model: selectedModel, method: 'Random Search + k-fold CV (real)', n_trials: trials.length, target: targetColumn, task_type: taskType, best_result: bestResult, all_trials: trials, tunable_params: tunables.map(t => t.name), generated_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `optuna_tuning_${selectedModel}_${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Resultados exportados!');
  };

  const displayTrials = isRunning ? liveTrials : trials;
  const prunedCount = displayTrials.filter(t => t.pruned).length;

  return (
    <div>
      <PageHeader title="Hyperparameter Tuning" subtitle="Busca real de hiperparâmetros (random search) avaliada por validação cruzada k-fold sobre o dataset local" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2">
          <GlowCard>
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Settings2 className="w-4 h-4 text-primary" /> Configuração do Espaço de Busca</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Projeto</label>
                <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setTargetColumn(''); }}>
                  <SelectTrigger className="mt-1 bg-secondary/50 text-xs h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{projects.filter(p => p.dataset_file_url).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Algoritmo</label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger className="mt-1 bg-secondary/50 text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{modelsForTask.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Coluna Alvo</label>
                <Select value={targetColumn} onValueChange={setTargetColumn} disabled={!project}>
                  <SelectTrigger className="mt-1 bg-secondary/50 text-xs h-8"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(project?.column_info || []).map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tarefa</label>
                <Select value={taskType} onValueChange={setTaskType}>
                  <SelectTrigger className="mt-1 bg-secondary/50 text-xs h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="classification">Classificação</SelectItem>
                    <SelectItem value="regression">Regressão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Search space (engine-defined, real) */}
            <div className="mb-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Espaço de Busca — {modelDef?.label}</p>
              {tunables.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2.5 rounded-lg bg-secondary/30 border border-border/30">Este modelo não tem hiperparâmetros ajustáveis no motor (ex.: Naive Bayes). Escolha outro.</p>
              ) : (
                <div className="space-y-2">
                  {tunables.map(p => (
                    <div key={p.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/30">
                      <code className="text-xs text-primary font-mono w-40 flex-shrink-0">{p.name}</code>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground flex-shrink-0">{p.type}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">intervalo [{p.min} … {p.max}]</span>
                    </div>
                  ))}
                  <p className="text-[10px] text-muted-foreground">Cada trial sorteia valores neste intervalo e é avaliado por validação cruzada 4-fold.</p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Trials:</label>
                <Input type="number" value={nTrials} onChange={e => setNTrials(Math.min(200, Math.max(10, parseInt(e.target.value) || 50)))} className="h-7 w-20 text-xs bg-secondary/50 font-mono" min={10} max={200} />
              </div>
              <div className="flex-1 min-w-48">
                <span className="text-[10px] text-muted-foreground">Método: <strong className="text-foreground">Random Search + CV 4-fold (real)</strong></span>
              </div>
              {!isRunning ? (
                <Button onClick={runTuning} disabled={!selectedProjectId || !targetColumn} className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs">
                  <Play className="w-3.5 h-3.5 mr-1.5" /> Iniciar Otimização
                </Button>
              ) : (
                <Button onClick={stopOptimization} variant="destructive" className="h-8 text-xs">
                  <Square className="w-3.5 h-3.5 mr-1.5" /> Parar
                </Button>
              )}
            </div>
          </GlowCard>
        </div>

        {/* Stats sidebar */}
        <div className="space-y-3">
          {isRunning && (
            <GlowCard className="border-primary/30">
              <p className="text-xs font-semibold text-primary mb-3 flex items-center gap-2 animate-pulse">
                <Zap className="w-3.5 h-3.5" /> Otimizando... {progress}%
              </p>
              <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden mb-3">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded bg-secondary/30">
                  <p className="text-base font-bold font-mono text-primary">{liveTrials.length}</p>
                  <p className="text-[9px] text-muted-foreground">Trials</p>
                </div>
                <div className="p-2 rounded bg-secondary/30">
                  <p className="text-base font-bold font-mono text-emerald-400">{liveTrials.length > 0 ? (Math.max(...liveTrials.map(t => t.best_so_far)) * 100).toFixed(2) + '%' : '—'}</p>
                  <p className="text-[9px] text-muted-foreground">Melhor Score</p>
                </div>
                <div className="p-2 rounded bg-secondary/30">
                  <p className="text-base font-bold font-mono text-amber-400">{prunedCount}</p>
                  <p className="text-[9px] text-muted-foreground">Pruned</p>
                </div>
                <div className="p-2 rounded bg-secondary/30">
                  <p className="text-base font-bold font-mono text-muted-foreground">{nTrials - liveTrials.length}</p>
                  <p className="text-[9px] text-muted-foreground">Restantes</p>
                </div>
              </div>
            </GlowCard>
          )}

          {bestResult && !isRunning && (
            <GlowCard glowColor="success" className="border-emerald-400/30">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-emerald-400" />
                <p className="text-xs font-semibold text-emerald-400">Melhor Trial #{bestResult.trial}</p>
              </div>
              <p className="text-2xl font-bold font-mono text-emerald-400">{(bestResult.score * 100).toFixed(3)}%</p>
              <p className="text-[10px] text-muted-foreground mb-3">{taskType === 'classification' ? 'Validation F1-Score' : 'Validation R²'} · CV ±{(bestResult.cv_std * 100).toFixed(3)}%</p>
              <div className="space-y-1 mb-3">
                {Object.entries(bestResult.params).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="font-mono text-muted-foreground">{k}</span>
                    <span className="font-mono font-bold text-primary">{String(v)}</span>
                  </div>
                ))}
              </div>
              <Button onClick={exportResults} size="sm" variant="outline" className="w-full h-7 text-xs border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10">
                <Download className="w-3 h-3 mr-1.5" /> Exportar Resultados
              </Button>
            </GlowCard>
          )}

          <GlowCard hover={false} className="p-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Método de busca</p>
            <p className="text-xs font-semibold text-foreground">Random Search</p>
            <p className="text-[10px] text-muted-foreground">Cada trial é avaliado por validação cruzada 4-fold no dataset local — scores reais, sem simulação.</p>
          </GlowCard>
        </div>
      </div>

      {displayTrials.length === 0 && !isRunning && (
        <EmptyState icon={Settings2} title="Nenhuma otimização executada" description="Configure o espaço de busca e clique em Iniciar para usar TPE Bayesiano ou Random Search" />
      )}

      {displayTrials.length > 0 && (
        <div className="space-y-5">
          {/* Convergence chart */}
          <GlowCard>
            <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> Gráfico de Convergência</h3>
            <p className="text-[10px] text-muted-foreground mb-4">Linha laranja = melhor score acumulado. Pontos verdes = trials aceitos. Pontos cinza = pruned/inferiores.</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={displayTrials}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                  <XAxis dataKey="trial" tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} label={{ value: 'Trial #', position: 'insideBottom', offset: -2, fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} tickFormatter={v => `${(v * 100).toFixed(1)}%`} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [`${(v * 100).toFixed(3)}%`, n]} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey="score" stroke="hsl(187,92%,55%)" dot={{ r: 2, fill: 'hsl(187,92%,55%)' }} name="Score do Trial" strokeWidth={1} strokeOpacity={0.6} />
                  <Line type="monotone" dataKey="best_so_far" stroke="hsl(35,92%,60%)" dot={false} name="Melhor Acumulado" strokeWidth={2.5} />
                  {bestResult && <ReferenceLine y={bestResult.score} stroke="hsl(152,68%,50%)" strokeDasharray="6 3" label={{ value: `Best: ${(bestResult.score * 100).toFixed(2)}%`, fontSize: 9, fill: 'hsl(152,68%,50%)' }} />}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlowCard>

          {/* Score distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <GlowCard>
              <h3 className="font-semibold text-sm mb-4">Distribuição de Scores</h3>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={displayTrials.map((t, i) => ({ trial: t.trial, score: parseFloat((t.score * 100).toFixed(2)), best: parseFloat((t.best_so_far * 100).toFixed(2)) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,14%)" />
                    <XAxis dataKey="trial" tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                    <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} unit="%" />
                    <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => `${v}%`} />
                    <Line type="monotone" dataKey="score" stroke="hsl(265,70%,60%)" dot={false} strokeWidth={1} name="Score" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </GlowCard>

            {/* Trials table */}
            <GlowCard>
              <h3 className="font-semibold text-sm mb-3">Últimos Trials</h3>
              <div className="overflow-y-auto max-h-48">
                <table className="w-full text-xs">
                  <thead className="sticky top-0">
                    <tr className="bg-secondary/80">
                      <th className="p-1.5 text-left text-muted-foreground">#</th>
                      <th className="p-1.5 text-left text-muted-foreground">Score</th>
                      <th className="p-1.5 text-left text-muted-foreground">Melhor</th>
                      <th className="p-1.5 text-left text-muted-foreground">Duração</th>
                      <th className="p-1.5 text-left text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...displayTrials].reverse().slice(0, 30).map((t, i) => (
                      <tr key={i} className={cn('hover:bg-secondary/30', t.score === bestResult?.score ? 'border-l-2 border-emerald-400' : '')}>
                        <td className="p-1.5 font-mono text-muted-foreground">{t.trial}</td>
                        <td className="p-1.5 font-mono text-primary">{(t.score * 100).toFixed(3)}%</td>
                        <td className="p-1.5 font-mono text-emerald-400">{(t.best_so_far * 100).toFixed(3)}%</td>
                        <td className="p-1.5 font-mono text-muted-foreground">{t.duration_s}s</td>
                        <td className="p-1.5">
                          <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold', t.pruned ? 'bg-amber-400/10 text-amber-400' : 'bg-emerald-400/10 text-emerald-400')}>
                            {t.pruned ? 'PRUNED' : 'OK'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlowCard>
          </div>
        </div>
      )}
    </div>
  );
}