import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { FlaskConical, Loader2, SlidersHorizontal, BarChart3, Grid3x3, Lightbulb, Play, Target } from 'lucide-react';
import { toast } from 'sonner';
import { getDataset } from '@/lib/datasetStore';
import { makeModel, evaluateModel } from '@/lib/realML';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell, ScatterChart, Scatter,
} from 'recharts';

const TT = { background: 'hsl(220,40%,9%)', border: '1px solid hsl(210,30%,16%)', borderRadius: 8, color: '#fff', fontSize: 11 };
const TABS = [
  { id: 'sim', label: 'Simulador', icon: SlidersHorizontal },
  { id: 'xai', label: 'Explicação (XAI)', icon: Lightbulb },
  { id: 'eval', label: 'Avaliação', icon: BarChart3 },
  { id: 'boundary', label: 'Fronteira 2D', icon: Grid3x3 },
];

export default function ModelLab() {
  const urlParams = new URLSearchParams(window.location.search);
  const [projectId, setProjectId] = useState(urlParams.get('project') || '');
  const [analysisId, setAnalysisId] = useState('');
  const [tab, setTab] = useState('sim');
  const [rows, setRows] = useState(null);
  const [model, setModel] = useState(null);
  const [evalRes, setEvalRes] = useState(null);
  const [building, setBuilding] = useState(false);
  const [inputs, setInputs] = useState({});

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const { data: analyses = [] } = useQuery({ queryKey: ['analyses', projectId], queryFn: () => base44.entities.Analysis.filter({ project_id: projectId }, '-created_date', 50), enabled: !!projectId });

  const project = projects.find((p) => p.id === projectId);
  const models = analyses.filter((a) => a.status === 'completed' && ['classification', 'regression'].includes(a.type));
  const analysis = models.find((a) => a.id === analysisId);
  const targetCol = analysis?.config?.target_column;

  // Build the model bundle from the local dataset when project/model change.
  useEffect(() => {
    let alive = true;
    setModel(null); setEvalRes(null);
    if (!project || !analysis || !targetCol) return;
    (async () => {
      setBuilding(true);
      try {
        const d = await getDataset(projectId);
        if (!d || !d.rows || d.rows.length < 10) { if (alive) { setRows([]); setBuilding(false); } return; }
        setRows(d.rows);
        await new Promise((r) => setTimeout(r, 30));
        const mdl = makeModel(d.rows, targetCol, project.column_info, analysis.type, analysis.results?.best_model);
        const ev = evaluateModel(d.rows, targetCol, project.column_info, analysis.type, analysis.results?.best_model);
        if (!alive) return;
        setModel(mdl); setEvalRes(ev);
        if (mdl) { const init = {}; mdl.features.forEach((f) => { init[f.name] = f.mean; }); setInputs(init); }
      } catch (e) { console.error('[ModelLab]', e); toast.error('Falha ao preparar o modelo: ' + e.message); }
      finally { if (alive) setBuilding(false); }
    })();
    return () => { alive = false; };
  }, [projectId, analysisId]); // eslint-disable-line

  const hasLocal = rows && rows.length >= 10;

  return (
    <div>
      <PageHeader title="Laboratório do Modelo" subtitle="Simule cenários, entenda as decisões do modelo e avalie a fundo" icon={FlaskConical} />

      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Projeto (dados)</label>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setAnalysisId(''); }}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
              <SelectContent>{projects.filter((p) => p.dataset_file_url).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Modelo treinado</label>
            <Select value={analysisId} onValueChange={setAnalysisId} disabled={!projectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder={models.length ? 'Selecione o modelo' : 'Nenhum modelo treinado'} /></SelectTrigger>
              <SelectContent>{models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.type}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </GlowCard>

      {!analysis ? (
        <EmptyState icon={FlaskConical} title="Selecione um modelo" description="Escolha um projeto e um modelo de classificação/regressão treinado no ML Studio." />
      ) : building ? (
        <div className="flex flex-col items-center py-20 gap-3"><Loader2 className="w-7 h-7 animate-spin text-primary" /><p className="text-sm text-muted-foreground">Preparando o modelo a partir do dataset local…</p></div>
      ) : !hasLocal ? (
        <EmptyState icon={FlaskConical} title="Dataset não está neste dispositivo" description="O dataset fica salvo localmente. Reenvie o arquivo no ML Studio (botão 'Recarregar dataset') para usar o Laboratório." />
      ) : !model ? (
        <EmptyState icon={FlaskConical} title="Não foi possível preparar o modelo" description="Verifique a coluna-alvo e o dataset." />
      ) : (
        <>
          <div className="flex gap-1 mb-5 bg-secondary/30 p-1 rounded-lg w-fit overflow-x-auto">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition whitespace-nowrap ${tab === t.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {tab === 'sim' && <Simulator model={model} inputs={inputs} setInputs={setInputs} />}
          {tab === 'xai' && <Explain model={model} inputs={inputs} />}
          {tab === 'eval' && <Evaluation ev={evalRes} model={model} />}
          {tab === 'boundary' && <Boundary model={model} rows={rows} targetCol={targetCol} />}
        </>
      )}
    </div>
  );
}

/* ── Simulador What-if ── */
function Simulator({ model, inputs, setInputs }) {
  const set = (k, v) => setInputs((s) => ({ ...s, [k]: v }));
  const pred = useMemo(() => { try { return model.predict(inputs); } catch { return null; } }, [model, inputs]);
  const proba = useMemo(() => { try { return model.proba(inputs); } catch { return null; } }, [model, inputs]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <GlowCard className="lg:col-span-2">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><SlidersHorizontal className="w-4 h-4 text-primary" /> Ajuste os valores</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {model.features.map((f) => (
            <div key={f.name}>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-foreground">{f.name}</label>
                <span className="text-xs font-mono text-primary">{f.numeric ? Number(inputs[f.name]).toLocaleString('pt-BR') : inputs[f.name]}</span>
              </div>
              {f.numeric ? (
                <input type="range" min={f.min} max={f.max} step={(f.max - f.min) / 100 || 1} value={inputs[f.name] ?? f.mean} onChange={(e) => set(f.name, parseFloat(e.target.value))} className="w-full accent-primary" />
              ) : (
                <Select value={String(inputs[f.name] ?? '')} onValueChange={(v) => set(f.name, v)}>
                  <SelectTrigger className="bg-secondary/50 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{f.options.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
          ))}
        </div>
      </GlowCard>

      <GlowCard glowColor="accent">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-accent" /> Predição</h3>
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Resultado</p>
        <p className="text-3xl font-bold text-gradient-primary mb-3">{pred ? String(pred.value) : '—'}</p>
        {model.task === 'classification' && proba && (
          <div className="space-y-2">
            {model.classes.map((c, i) => (
              <div key={c}>
                <div className="flex justify-between text-[11px] mb-0.5"><span className="text-foreground">{c}</span><span className="font-mono text-muted-foreground">{(proba[i] * 100).toFixed(1)}%</span></div>
                <div className="h-2 rounded-full bg-background/60 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${proba[i] * 100}%`, background: 'hsl(var(--primary))' }} /></div>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-4">Mova os controles à esquerda para ver a predição mudar ao vivo.</p>
      </GlowCard>
    </div>
  );
}

/* ── Explicação (XAI) por perturbação ── */
function Explain({ model, inputs }) {
  const data = useMemo(() => {
    const baseScalar = model.scalar(inputs);
    return model.features.map((f) => {
      const base = { ...inputs, [f.name]: f.mean };
      const contribution = baseScalar - model.scalar(base);
      return { feature: f.name, contribution: Number(contribution.toFixed(4)) };
    }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  }, [model, inputs]);

  const pred = model.predict(inputs);
  return (
    <div className="space-y-4">
      <GlowCard>
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-primary" /> O que influenciou esta predição</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Predição atual: <strong className="text-foreground">{String(pred.value)}</strong>. Barras à direita (verde) empurram o resultado para cima; à esquerda (vermelho), para baixo — comparado a cada feature no valor médio.
        </p>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,30%,14%)" />
              <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(210,20%,55%)' }} />
              <YAxis dataKey="feature" type="category" width={110} tick={{ fontSize: 10, fill: 'hsl(210,20%,55%)' }} />
              <Tooltip contentStyle={TT} />
              <ReferenceLine x={0} stroke="hsl(210,30%,30%)" />
              <Bar dataKey="contribution" radius={[0, 3, 3, 0]}>
                {data.map((d, i) => <Cell key={i} fill={d.contribution >= 0 ? 'hsl(160,100%,45%)' : 'hsl(0,80%,60%)'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlowCard>
    </div>
  );
}

/* ── Avaliação (matriz de confusão + ROC/PR + threshold) ── */
function Evaluation({ ev, model }) {
  const [thr, setThr] = useState(0.5);
  if (!ev || ev.error) return <EmptyState icon={BarChart3} title="Sem avaliação" description={ev?.message || 'Dados insuficientes.'} />;

  if (ev.task === 'regression') {
    return (
      <GlowCard>
        <h3 className="font-semibold text-sm mb-1">Predito vs Real — R² {(ev.r2 * 100).toFixed(1)}%</h3>
        <p className="text-xs text-muted-foreground mb-3">Quanto mais perto da diagonal, melhor. Avaliado em {ev.test_size} amostras de teste.</p>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ left: 10, right: 20, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,30%,14%)" />
              <XAxis type="number" dataKey="actual" name="Real" tick={{ fontSize: 10, fill: 'hsl(210,20%,55%)' }} />
              <YAxis type="number" dataKey="predicted" name="Predito" tick={{ fontSize: 10, fill: 'hsl(210,20%,55%)' }} />
              <Tooltip contentStyle={TT} />
              <Scatter data={ev.points} fill="hsl(var(--primary))" opacity={0.6} />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </GlowCard>
    );
  }

  // classification
  const K = ev.classes.length;
  const binary = K === 2 && ev.points;
  // threshold-based confusion for binary
  let cm = ev.confusion, metrics = null, roc = [], pr = [];
  if (binary) {
    let tp = 0, fp = 0, tn = 0, fn = 0;
    ev.points.forEach((p) => { const pos = p.score >= thr; if (p.y === 1 && pos) tp++; else if (p.y === 0 && pos) fp++; else if (p.y === 0 && !pos) tn++; else fn++; });
    cm = [[tn, fp], [fn, tp]];
    const acc = (tp + tn) / ev.points.length, prec = tp + fp ? tp / (tp + fp) : 0, rec = tp + fn ? tp / (tp + fn) : 0;
    metrics = { acc, prec, rec, f1: prec + rec ? 2 * prec * rec / (prec + rec) : 0 };
    // ROC & PR across thresholds
    const P = ev.points.filter((p) => p.y === 1).length, N = ev.points.length - P;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      let TP = 0, FP = 0; ev.points.forEach((p) => { if (p.score >= t) { if (p.y === 1) TP++; else FP++; } });
      roc.push({ fpr: N ? FP / N : 0, tpr: P ? TP / P : 0 });
      pr.push({ recall: P ? TP / P : 0, precision: TP + FP ? TP / (TP + FP) : 1 });
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <GlowCard>
        <h3 className="font-semibold text-sm mb-3">Matriz de Confusão {binary && <span className="text-xs text-muted-foreground">(threshold {thr.toFixed(2)})</span>}</h3>
        <div className="inline-block">
          <div className="flex"><div className="w-20" /><div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${K},1fr)` }}>{ev.classes.map((c) => <div key={c} className="text-[10px] text-center text-muted-foreground truncate">{c}</div>)}</div></div>
          {cm.map((row, i) => {
            const max = Math.max(...cm.flat(), 1);
            return (
              <div key={i} className="flex items-center gap-1 mt-1">
                <div className="w-20 text-[10px] text-right pr-2 text-muted-foreground truncate">{ev.classes[i]}</div>
                <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: `repeat(${K},1fr)` }}>
                  {row.map((v, j) => (
                    <div key={j} className="h-12 rounded flex items-center justify-center text-xs font-mono font-bold" style={{ background: `hsla(${i === j ? 160 : 0},80%,50%,${0.12 + (v / max) * 0.55})`, color: '#fff' }}>{v}</div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        {binary && (
          <div className="mt-4">
            <label className="text-xs text-muted-foreground">Threshold: <span className="font-mono text-primary">{thr.toFixed(2)}</span></label>
            <input type="range" min={0} max={1} step={0.01} value={thr} onChange={(e) => setThr(parseFloat(e.target.value))} className="w-full accent-primary" />
            <div className="grid grid-cols-4 gap-2 mt-2 text-center">
              {[['Acurácia', metrics.acc], ['Precisão', metrics.prec], ['Recall', metrics.rec], ['F1', metrics.f1]].map(([l, v]) => (
                <div key={l} className="rounded bg-secondary/40 p-2"><p className="text-sm font-bold font-mono text-primary">{(v * 100).toFixed(1)}%</p><p className="text-[9px] text-muted-foreground">{l}</p></div>
              ))}
            </div>
          </div>
        )}
      </GlowCard>

      {binary && (
        <GlowCard>
          <h3 className="font-semibold text-sm mb-3">Curvas ROC e Precision-Recall</h3>
          <div className="h-40 mb-3">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={roc} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,30%,14%)" />
                <XAxis dataKey="fpr" type="number" domain={[0, 1]} tick={{ fontSize: 9, fill: 'hsl(210,20%,55%)' }} label={{ value: 'FPR', position: 'insideBottom', fontSize: 9, fill: 'hsl(210,20%,55%)' }} />
                <YAxis type="number" domain={[0, 1]} tick={{ fontSize: 9, fill: 'hsl(210,20%,55%)' }} />
                <Tooltip contentStyle={TT} />
                <Line dataKey="tpr" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} name="ROC (TPR)" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pr} margin={{ left: -10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,30%,14%)" />
                <XAxis dataKey="recall" type="number" domain={[0, 1]} tick={{ fontSize: 9, fill: 'hsl(210,20%,55%)' }} label={{ value: 'Recall', position: 'insideBottom', fontSize: 9, fill: 'hsl(210,20%,55%)' }} />
                <YAxis type="number" domain={[0, 1]} tick={{ fontSize: 9, fill: 'hsl(210,20%,55%)' }} />
                <Tooltip contentStyle={TT} />
                <Line dataKey="precision" stroke="hsl(var(--accent))" dot={false} strokeWidth={2} name="Precisão" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>
      )}
    </div>
  );
}

/* ── Fronteira de decisão 2D ── */
function Boundary({ model, rows, targetCol }) {
  const numFeats = model.features.filter((f) => f.numeric);
  const [fx, setFx] = useState(numFeats[0]?.name);
  const [fy, setFy] = useState(numFeats[1]?.name);

  if (model.task !== 'classification') return <EmptyState icon={Grid3x3} title="Fronteira 2D" description="Disponível apenas para modelos de classificação." />;
  if (numFeats.length < 2) return <EmptyState icon={Grid3x3} title="Fronteira 2D" description="São necessárias ao menos 2 features numéricas." />;

  const fX = numFeats.find((f) => f.name === fx) || numFeats[0];
  const fY = numFeats.find((f) => f.name === fy) || numFeats[1];
  const G = 36;
  const grid = useMemo(() => {
    const base = {}; model.features.forEach((f) => { base[f.name] = f.mean; });
    const cells = [];
    for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) {
      const vx = fX.min + (fX.max - fX.min) * (i / (G - 1));
      const vy = fY.min + (fY.max - fY.min) * (j / (G - 1));
      const idx = model.predict({ ...base, [fX.name]: vx, [fY.name]: vy }).index;
      cells.push({ i, j, idx });
    }
    return cells;
  }, [model, fx, fy]); // eslint-disable-line

  const sample = useMemo(() => rows.slice(0, 250).map((r) => ({ x: parseFloat(r[fX.name]), y: parseFloat(r[fY.name]), c: String(r[targetCol]) })).filter((p) => !isNaN(p.x) && !isNaN(p.y)), [rows, fx, fy]); // eslint-disable-line
  const COLORS = ['hsl(185,100%,50%)', 'hsl(160,100%,45%)', 'hsl(40,100%,55%)', 'hsl(330,90%,60%)', 'hsl(265,90%,65%)'];
  const S = 460, cell = S / G;
  const px = (v) => ((v - fX.min) / (fX.max - fX.min || 1)) * S;
  const py = (v) => S - ((v - fY.min) / (fY.max - fY.min || 1)) * S;

  return (
    <GlowCard>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <h3 className="font-semibold text-sm flex items-center gap-2"><Grid3x3 className="w-4 h-4 text-primary" /> Fronteira de decisão</h3>
        <div className="flex items-center gap-2 ml-auto">
          <Select value={fx} onValueChange={setFx}><SelectTrigger className="bg-secondary/50 h-8 text-xs w-36"><SelectValue /></SelectTrigger><SelectContent>{numFeats.map((f) => <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>)}</SelectContent></Select>
          <span className="text-xs text-muted-foreground">×</span>
          <Select value={fy} onValueChange={setFy}><SelectTrigger className="bg-secondary/50 h-8 text-xs w-36"><SelectValue /></SelectTrigger><SelectContent>{numFeats.map((f) => <SelectItem key={f.name} value={f.name}>{f.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-start">
        <svg width={S} height={S} className="rounded-lg border border-border/40 max-w-full" style={{ background: 'hsl(220,45%,4%)' }}>
          {grid.map((c, k) => (
            <rect key={k} x={c.i * cell} y={S - (c.j + 1) * cell} width={cell + 0.5} height={cell + 0.5} fill={COLORS[c.idx % COLORS.length]} opacity={0.18} />
          ))}
          {sample.map((p, k) => (
            <circle key={k} cx={px(p.x)} cy={py(p.y)} r={3} fill={COLORS[model.classes.indexOf(p.c) % COLORS.length] || '#888'} opacity={0.9} stroke="#0008" strokeWidth={0.5} />
          ))}
        </svg>
        <div className="text-xs space-y-2">
          <p className="text-muted-foreground">Regiões coloridas = decisão do modelo. Pontos = dados reais. Eixos: <strong className="text-foreground">{fX.name}</strong> (x) × <strong className="text-foreground">{fY.name}</strong> (y). Demais features fixadas na média.</p>
          {model.classes.map((c, i) => (
            <div key={c} className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} /><span className="text-foreground">{c}</span></div>
          ))}
        </div>
      </div>
    </GlowCard>
  );
}
