import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { Rocket, Play, Loader2, Server, Activity, Target, Gauge, Zap, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const TASK_LABELS = { classification: 'Classificação', regression: 'Regressão' };

// Deterministic local prediction (no AI) — same approach as the Inference page.
function predictLocally(analysis, project, inputs) {
  const results = analysis.results || {};
  const fi = results.feature_importance || [];
  const targetCol = analysis.config?.target_column;
  const cols = (project.column_info || []).filter((c) => c.name !== targetCol);

  let score = 0, weightSum = 0;
  cols.forEach((c) => {
    const imp = fi.find((f) => f.feature === c.name)?.score || 0.1;
    const raw = parseFloat(inputs[c.name]);
    if (!isNaN(raw)) { score += raw * imp; weightSum += imp; }
  });
  const norm = weightSum > 0 ? score / weightSum : 0;

  if (analysis.type === 'classification') {
    const targetInfo = (project.column_info || []).find((c) => c.name === targetCol);
    const classes = targetInfo?.sample_values?.filter((v) => v != null && v !== '') || ['0', '1'];
    const idx = Math.abs(Math.floor(norm)) % Math.max(classes.length, 1);
    return { predicted: String(classes[idx] ?? classes[0] ?? '0'), confidence: Math.min(0.99, 0.55 + Math.abs(norm % 0.4)) };
  }
  return { predicted: Number((weightSum > 0 ? norm : 0).toFixed(2)), confidence: null };
}

export default function Deploy() {
  const urlParams = new URLSearchParams(window.location.search);
  const [projectId, setProjectId] = useState(urlParams.get('project') || '');
  const [analysisId, setAnalysisId] = useState('');
  const [inputs, setInputs] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });
  const { data: analyses = [] } = useQuery({
    queryKey: ['analyses', projectId],
    queryFn: () => base44.entities.Analysis.filter({ project_id: projectId }, '-created_date', 50),
    enabled: !!projectId,
  });

  const project = projects.find((p) => p.id === projectId);
  const models = analyses.filter((a) => (a.type === 'classification' || a.type === 'regression') && a.status === 'completed');
  const model = models.find((a) => a.id === analysisId);
  const targetCol = model?.config?.target_column;
  const featureCols = useMemo(
    () => (project?.column_info || []).filter((c) => c.name !== targetCol),
    [project, targetCol]
  );

  const run = async () => {
    if (!model || !project) return;
    setRunning(true);
    const t0 = performance.now();
    let pred = null;
    let mode = 'heurística';
    try {
      // Real prediction: reload the local dataset, retrain the chosen model, predict.
      const { getDataset } = await import('@/lib/datasetStore');
      const d = await getDataset(project.id);
      if (d && d.rows && d.rows.length >= 10 && ['classification', 'regression'].includes(model.type)) {
        const { trainPredictor } = await import('@/lib/realML');
        const predictor = trainPredictor(d.rows, targetCol, project.column_info, model.type, model.results?.best_model);
        if (predictor) {
          const out = predictor.predict(inputs);
          const conf = model.type === 'classification' ? (model.results?.metrics?.accuracy ?? null) : null;
          pred = { predicted: out.value, confidence: conf };
          mode = 'modelo real';
        }
      }
    } catch (e) { console.warn('[Deploy] preditor real indisponível, usando heurística:', e.message); }

    if (!pred) { await new Promise((r) => setTimeout(r, 300)); pred = predictLocally(model, project, inputs); }
    const latency = Math.round(performance.now() - t0);
    setPrediction({ ...pred, latency, mode });
    setLog((l) => [{ time: new Date().toLocaleTimeString('pt-BR'), predicted: pred.predicted, latency }, ...l].slice(0, 8));
    setRunning(false);
    toast.success(mode === 'modelo real' ? 'Predição com modelo real!' : 'Predição executada (heurística — recarregue o dataset p/ modelo real).');
  };

  const metrics = model?.results?.metrics || {};
  const primaryMetric = model?.type === 'classification'
    ? (metrics.accuracy ?? metrics.f1 ?? metrics.f1_score)
    : (metrics.r2 ?? metrics.rmse);

  return (
    <div>
      <PageHeader title="Deploy" subtitle="Veja o modelo em produção: selecione os dados e o classificador e faça inferência" icon={Rocket} />

      {/* Selectors */}
      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground">Projeto (dados)</Label>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setAnalysisId(''); setPrediction(null); }}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
              <SelectContent>
                {projects.filter((p) => p.dataset_file_url).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Classificador / Modelo</Label>
            <Select value={analysisId} onValueChange={(v) => { setAnalysisId(v); setPrediction(null); setInputs({}); }} disabled={!projectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder={models.length ? 'Selecione o modelo' : 'Nenhum modelo treinado'} /></SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name} · {TASK_LABELS[m.type]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </GlowCard>

      {!model ? (
        <EmptyState icon={Server} title="Selecione um modelo" description="Escolha um projeto e um classificador/regressor treinado para ver o endpoint em produção." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Production card */}
          <div className="lg:col-span-1 space-y-4">
            <GlowCard>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Server className="w-4 h-4 text-primary" />
                  <h3 className="font-semibold text-foreground text-sm">Modelo em Produção</h3>
                </div>
                <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> ATIVO
                </span>
              </div>
              <p className="text-sm font-medium text-foreground">{model.name}</p>
              <p className="text-xs text-muted-foreground mb-3">{TASK_LABELS[model.type]}</p>

              <div className="space-y-2 text-xs">
                <Row icon={Target} label="Alvo" value={targetCol || '—'} />
                <Row icon={Gauge} label={model.type === 'classification' ? 'Acurácia' : 'R²/RMSE'} value={primaryMetric != null ? Number(primaryMetric).toFixed(3) : '—'} />
                <Row icon={Zap} label="Endpoint" value={`/api/predict/${model.id.slice(0, 8)}`} mono />
                <Row icon={Activity} label="Features" value={featureCols.length} />
              </div>
            </GlowCard>

            {log.length > 0 && (
              <GlowCard>
                <h3 className="font-semibold text-foreground text-sm mb-2">Log de chamadas</h3>
                <div className="space-y-1.5">
                  {log.map((l, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-muted-foreground">{l.time}</span>
                      <span className="text-foreground">→ {String(l.predicted)}</span>
                      <span className="text-primary/70">{l.latency}ms</span>
                    </div>
                  ))}
                </div>
              </GlowCard>
            )}
          </div>

          {/* Inference form */}
          <div className="lg:col-span-2 space-y-4">
            <GlowCard>
              <h3 className="font-semibold text-foreground text-sm mb-3">Entrada de dados (inferência)</h3>
              {featureCols.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem colunas de entrada para este modelo.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {featureCols.map((c) => (
                    <div key={c.name}>
                      <Label className="text-xs text-muted-foreground">{c.name} <span className="opacity-60">({c.type})</span></Label>
                      <Input
                        value={inputs[c.name] ?? ''}
                        onChange={(e) => setInputs((s) => ({ ...s, [c.name]: e.target.value }))}
                        placeholder={(c.sample_values || [])[0] != null ? `ex.: ${c.sample_values[0]}` : ''}
                        className="mt-1 bg-secondary/50"
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button onClick={run} disabled={running} className="mt-4 bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
                {running ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executando...</> : <><Play className="w-4 h-4 mr-2" /> Executar predição</>}
              </Button>
            </GlowCard>

            {prediction && (
              <GlowCard glowColor="accent">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  <h3 className="font-semibold text-foreground text-sm">Resposta do modelo</h3>
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${prediction.mode === 'modelo real' ? 'bg-accent/15 text-accent' : 'bg-amber-400/15 text-amber-400'}`}>
                    {prediction.mode === 'modelo real' ? '✓ modelo real' : '~ heurística'}
                  </span>
                </div>
                <div className="flex flex-wrap items-end gap-6">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Predição</p>
                    <p className="text-3xl font-bold text-gradient-primary">{String(prediction.predicted)}</p>
                  </div>
                  {prediction.confidence != null && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Confiança</p>
                      <p className="text-xl font-semibold text-foreground">{(prediction.confidence * 100).toFixed(1)}%</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Latência</p>
                    <p className="text-xl font-semibold text-foreground">{prediction.latency}ms</p>
                  </div>
                </div>
              </GlowCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-1.5 text-muted-foreground"><Icon className="w-3.5 h-3.5" /> {label}</span>
      <span className={mono ? 'font-mono text-primary/80' : 'text-foreground font-medium'}>{value}</span>
    </div>
  );
}
