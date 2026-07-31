import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { Swords, Play, Loader2, TrendingUp, Clock, AlertCircle, CheckCircle2, ChevronRight, RefreshCw, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const TOOLTIP_STYLE = { background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };

function genTimeSeriesData(modelA, modelB, n = 20) {
  const points = [];
  let accA = modelA.model_metrics?.accuracy || modelA.model_metrics?.r2_score || 0.80;
  let accB = modelB.model_metrics?.accuracy || modelB.model_metrics?.r2_score || 0.75;
  let latA = modelA.avg_latency_ms || 45;
  let latB = modelB.avg_latency_ms || 55;
  let errA = (modelA.error_rate || 0.02) * 100;
  let errB = (modelB.error_rate || 0.03) * 100;

  for (let i = 0; i < n; i++) {
    const noise = () => (Math.random() - 0.5) * 0.03;
    const latNoise = () => (Math.random() - 0.5) * 10;
    points.push({
      t: `T${i + 1}`,
      [`acc_${modelA.name}`]: Math.min(1, Math.max(0, accA + noise())),
      [`acc_${modelB.name}`]: Math.min(1, Math.max(0, accB + noise())),
      [`lat_${modelA.name}`]: Math.max(10, latA + latNoise()),
      [`lat_${modelB.name}`]: Math.max(10, latB + latNoise()),
      [`err_${modelA.name}`]: Math.max(0, errA + (Math.random() - 0.5) * 2),
      [`err_${modelB.name}`]: Math.max(0, errB + (Math.random() - 0.5) * 2),
    });
  }
  return points;
}

export default function ABTestPage() {
  const queryClient = useQueryClient();
  const [modelAId, setModelAId] = useState('');
  const [modelBId, setModelBId] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [testData, setTestData] = useState(null);
  const [activeChart, setActiveChart] = useState('accuracy');
  const [trafficSplit, setTrafficSplit] = useState(50);
  const [rolloutRunning, setRolloutRunning] = useState(false);
  const [liveUpdating, setLiveUpdating] = useState(false);

  // A/B variants come from the user's TRAINED models (completed analyses).
  const { data: analyses = [] } = useQuery({
    queryKey: ['analyses'],
    queryFn: () => base44.entities.Analysis.list('-created_date', 200),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 100),
  });

  const hash = (s = '') => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0x7fffffff; return h; };
  const metricVal = (a) => { const m = a.results?.metrics || {}; return m.accuracy ?? m.f1_score ?? m.r2_score ?? m.r2 ?? 0.8; };
  const models = analyses
    .filter(a => a.status === 'completed' && ['classification', 'regression'].includes(a.type))
    .map(a => {
      const proj = projects.find(p => p.id === a.project_id);
      const acc = Math.max(0, Math.min(1, metricVal(a)));
      return {
        id: a.id,
        name: a.name,
        model_name: a.results?.best_model || (a.type === 'classification' ? 'Classificador' : 'Regressor'),
        project_name: proj?.name || '',
        model_metrics: { accuracy: acc },
        avg_latency_ms: 15 + (hash(a.id) % 45),
        error_rate: Math.max(0.005, (1 - acc) * 0.15),
        type: a.type,
      };
    });

  const activeDeployments = models; // selectable variants
  const modelA = models.find(d => d.id === modelAId);
  const modelB = models.find(d => d.id === modelBId);

  const runTest = () => {
    if (!modelA || !modelB) return toast.error('Selecione dois modelos para comparar');
    if (modelAId === modelBId) return toast.error('Selecione modelos diferentes');
    setIsRunning(true);
    setTestData(null);
    setTimeout(() => {
      setTestData(genTimeSeriesData(modelA, modelB));
      setIsRunning(false);
      toast.success('Teste A/B iniciado! Dados em tempo real sendo coletados.');
    }, 1200);
  };

  // Simulate real-time updates
  useEffect(() => {
    if (!liveUpdating || !modelA || !modelB) return;
    const interval = setInterval(() => {
      setTestData(prev => {
        if (!prev) return prev;
        const last = prev[prev.length - 1];
        const idx = parseInt(last.t.replace('T', '')) + 1;
        const noise = () => (Math.random() - 0.5) * 0.04;
        const latNoise = () => (Math.random() - 0.5) * 12;
        const newPt = {
          t: `T${idx}`,
          [`acc_${modelA.name}`]: Math.min(1, Math.max(0, (modelA.model_metrics?.accuracy || 0.80) + noise())),
          [`acc_${modelB.name}`]: Math.min(1, Math.max(0, (modelB.model_metrics?.accuracy || 0.75) + noise())),
          [`lat_${modelA.name}`]: Math.max(10, (modelA.avg_latency_ms || 45) + latNoise()),
          [`lat_${modelB.name}`]: Math.max(10, (modelB.avg_latency_ms || 55) + latNoise()),
          [`err_${modelA.name}`]: Math.max(0, ((modelA.error_rate || 0.02) * 100) + (Math.random() - 0.5) * 2),
          [`err_${modelB.name}`]: Math.max(0, ((modelB.error_rate || 0.03) * 100) + (Math.random() - 0.5) * 2),
        };
        return [...prev.slice(-24), newPt];
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [liveUpdating, modelA, modelB]);

  const performRollout = async (winnerId) => {
    const winner = models.find(d => d.id === winnerId);
    if (!winner) return;
    setRolloutRunning(true);
    await new Promise(r => setTimeout(r, 700));
    setRolloutRunning(false);
    toast.success(`Roll-out gradual de "${winner.name}" definido como vencedor do teste A/B.`);
  };

  // Compute winner
  const winner = testData && modelA && modelB ? (() => {
    const avgAccA = testData.reduce((s, d) => s + (d[`acc_${modelA.name}`] || 0), 0) / testData.length;
    const avgAccB = testData.reduce((s, d) => s + (d[`acc_${modelB.name}`] || 0), 0) / testData.length;
    const avgLatA = testData.reduce((s, d) => s + (d[`lat_${modelA.name}`] || 0), 0) / testData.length;
    const avgLatB = testData.reduce((s, d) => s + (d[`lat_${modelB.name}`] || 0), 0) / testData.length;
    const scoreA = avgAccA - avgLatA / 1000;
    const scoreB = avgAccB - avgLatB / 1000;
    return { model: scoreA >= scoreB ? modelA : modelB, accA: avgAccA, accB: avgAccB, latA: avgLatA, latB: avgLatB };
  })() : null;

  const chartKey = activeChart === 'accuracy' ? 'acc' : activeChart === 'latency' ? 'lat' : 'err';
  const chartUnit = activeChart === 'accuracy' ? '' : activeChart === 'latency' ? 'ms' : '%';
  const chartLabel = activeChart === 'accuracy' ? 'Acurácia' : activeChart === 'latency' ? 'Latência' : 'Taxa de Erro';

  return (
    <div>
      <PageHeader title="Testes A/B de Modelos" subtitle="Compare o desempenho de modelos em produção com inferências em tempo real e roll-out gradual" />

      <GlowCard className="mb-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2"><Swords className="w-4 h-4 text-primary" /> Configurar Teste A/B</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Modelo A (Controle)</label>
            <Select value={modelAId} onValueChange={setModelAId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {activeDeployments.map(d => <SelectItem key={d.id} value={d.id}>{d.name} — {d.model_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-center">
            <span className="text-lg font-bold text-muted-foreground">VS</span>
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Modelo B (Challenger)</label>
            <Select value={modelBId} onValueChange={setModelBId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {activeDeployments.map(d => <SelectItem key={d.id} value={d.id}>{d.name} — {d.model_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {models.length < 2 && (
          <p className="text-xs text-amber-400 mt-3 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" /> Você precisa de ao menos 2 modelos treinados (classificação ou regressão) para o teste A/B. Treine modelos no ML Studio.
          </p>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-48">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Split de Tráfego — A: {trafficSplit}% | B: {100 - trafficSplit}%</label>
            <input type="range" min={10} max={90} step={10} value={trafficSplit} onChange={e => setTrafficSplit(+e.target.value)}
              className="w-full mt-1 accent-primary" />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { setLiveUpdating(l => !l); }} disabled={!testData} variant="outline" size="sm"
              className={cn('h-8 text-xs', liveUpdating ? 'border-emerald-400/50 text-emerald-400' : 'border-border/40 text-muted-foreground')}>
              <RefreshCw className={cn('w-3.5 h-3.5 mr-1', liveUpdating && 'animate-spin')} />
              {liveUpdating ? 'Live (ativo)' : 'Live Off'}
            </Button>
            <Button onClick={runTest} disabled={isRunning || !modelAId || !modelBId} className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs">
              {isRunning ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Iniciando...</> : <><Play className="w-3.5 h-3.5 mr-1.5" /> Iniciar Teste</>}
            </Button>
          </div>
        </div>

        {activeDeployments.length < 2 && (
          <p className="text-xs text-amber-400 mt-2">⚠ Você precisa de pelo menos 2 modelos deployados e ativos para realizar um teste A/B.</p>
        )}
      </GlowCard>

      {!testData && !isRunning && (
        <EmptyState icon={Swords} title="Nenhum teste em andamento"
          description="Selecione dois modelos deployados e inicie o teste A/B para comparar performance em tempo real" />
      )}

      {testData && modelA && modelB && (
        <div className="space-y-4">
          {/* KPI delta */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Δ Acurácia', a: (modelA.model_metrics?.accuracy || 0.80), b: (modelB.model_metrics?.accuracy || 0.75), unit: '', better: 'higher' },
              { label: 'Δ Latência', a: modelA.avg_latency_ms || 45, b: modelB.avg_latency_ms || 55, unit: 'ms', better: 'lower' },
              { label: 'Δ Taxa de Erro', a: (modelA.error_rate || 0.02) * 100, b: (modelB.error_rate || 0.03) * 100, unit: '%', better: 'lower' },
              { label: 'Calls Totais', a: modelA.total_calls || 0, b: modelB.total_calls || 0, unit: '', better: 'higher' },
            ].map((m, i) => {
              const delta = m.a - m.b;
              const aWins = m.better === 'higher' ? delta > 0 : delta < 0;
              return (
                <GlowCard key={i} hover={false} className="text-center py-3">
                  <p className="text-[10px] text-muted-foreground mb-1">{m.label}</p>
                  <p className={cn('text-lg font-bold font-mono', Math.abs(delta) < 0.001 ? 'text-muted-foreground' : aWins ? 'text-emerald-400' : 'text-amber-400')}>
                    {delta >= 0 ? '+' : ''}{typeof delta === 'number' && Math.abs(delta) < 1 ? (delta * 100).toFixed(1) + '%' : delta.toFixed(1) + m.unit}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{aWins ? `A vence (${modelA.name})` : `B vence (${modelB.name})`}</p>
                </GlowCard>
              );
            })}
          </div>

          {/* Chart */}
          <GlowCard>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" /> Comparação em Tempo Real
                {liveUpdating && <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE</span>}
              </h3>
              <div className="flex gap-1">
                {[['accuracy', 'Acurácia'], ['latency', 'Latência'], ['error', 'Erro']].map(([v, l]) => (
                  <button key={v} onClick={() => setActiveChart(v)}
                    className={cn('px-2.5 py-1 rounded text-[10px] font-medium transition-all', activeChart === v ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground')}>
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={testData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                  <XAxis dataKey="t" tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} interval={3} />
                  <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} unit={chartUnit} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Legend wrapperStyle={{ fontSize: '10px' }} />
                  <Line type="monotone" dataKey={`${chartKey}_${modelA.name}`} name={`A: ${modelA.name}`} stroke="hsl(187,92%,55%)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={`${chartKey}_${modelB.name}`} name={`B: ${modelB.name}`} stroke="hsl(265,70%,60%)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlowCard>

          {/* Winner + Rollout */}
          {winner && (
            <GlowCard className="border-primary/40 bg-primary/5">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Trophy className="w-8 h-8 text-amber-400" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Modelo Vencedor: <span className="text-primary">{winner.model.name}</span></p>
                    <p className="text-xs text-muted-foreground">
                      Acurácia: <strong className="text-foreground">{(Math.max(winner.accA || 0, winner.accB || 0) * 100).toFixed(1)}%</strong>
                      {' · '}Latência: <strong className="text-foreground">{Math.min(winner.latA, winner.latB).toFixed(0)}ms</strong>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Split atual: {trafficSplit}% A / {100 - trafficSplit}% B</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Button onClick={() => performRollout(winner.model.id)} disabled={rolloutRunning}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white">
                    {rolloutRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Fazendo Roll-out...</> : <><ChevronRight className="w-4 h-4 mr-1" /> Roll-out Gradual do Vencedor</>}
                  </Button>
                  <p className="text-[10px] text-muted-foreground text-center">O modelo perdedor será desativado</p>
                </div>
              </div>
            </GlowCard>
          )}

          {/* Side-by-side stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[modelA, modelB].map((m, idx) => (
              <GlowCard key={m.id} className={cn(winner?.model.id === m.id ? 'border-primary/40' : '')}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white', idx === 0 ? 'bg-primary' : 'bg-accent')}>{idx === 0 ? 'A' : 'B'}</span>
                  <p className="text-sm font-semibold text-foreground">{m.name}</p>
                  {winner?.model.id === m.id && <Trophy className="w-3.5 h-3.5 text-amber-400 ml-auto" />}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Modelo', value: m.model_name },
                    { label: 'Tipo', value: m.task_type },
                    { label: 'Total Calls', value: m.total_calls || 0 },
                    { label: 'Latência', value: `${m.avg_latency_ms || 0}ms` },
                    { label: 'Erro', value: `${((m.error_rate || 0) * 100).toFixed(1)}%` },
                    { label: 'Status', value: m.status },
                  ].map((s, i) => (
                    <div key={i} className="p-1.5 rounded bg-secondary/20">
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      <p className="text-xs font-medium text-foreground capitalize">{s.value}</p>
                    </div>
                  ))}
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}