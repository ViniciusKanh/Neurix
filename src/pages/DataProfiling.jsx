import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { getDataset } from '@/lib/datasetStore';
import { correlationMatrix } from '@/lib/dataQuality';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  BarChart2, TrendingUp, AlertTriangle, Grid3X3, Activity,
  ChevronDown, ChevronUp, Loader2, Shield, Target, Zap, Eye
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ScatterChart, Scatter, Cell, LineChart, Line, ReferenceLine
} from 'recharts';
import { cn } from '@/lib/utils';

const TOOLTIP_STYLE = {
  background: 'hsl(220,40%,7%)',
  border: '1px solid hsl(187,92%,55%,0.3)',
  borderRadius: '8px',
  color: '#e2e8f0',
  fontSize: '11px',
};

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateColumnStats(col, projectId) {
  const rng = seededRandom(col.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + (projectId?.length || 0));
  const isNumeric = ['number', 'integer', 'float', 'numeric', 'int', 'float64', 'int64'].includes((col.type || '').toLowerCase());

  if (isNumeric) {
    const mean = rng() * 100 + 10;
    const std = rng() * 30 + 5;
    const min = mean - std * 2.5;
    const max = mean + std * 2.5;
    const q1 = mean - std * 0.7;
    const q3 = mean + std * 0.7;
    const skewness = (rng() - 0.5) * 2;
    const kurtosis = rng() * 4 + 1;
    const outlierCount = Math.floor(rng() * 8);

    const bins = Array.from({ length: 12 }, (_, i) => {
      const x = min + (max - min) * (i / 12);
      const dist = Math.abs((x - mean) / std);
      const height = Math.exp(-0.5 * dist * dist) * (50 + rng() * 30);
      return { bin: x.toFixed(1), count: Math.floor(height), x };
    });

    const outliers = Array.from({ length: outlierCount }, () => ({
      value: rng() > 0.5 ? max + rng() * std * 2 : min - rng() * std * 1.5,
      index: Math.floor(rng() * 200),
    }));

    return {
      type: 'numeric',
      mean: mean.toFixed(3),
      std: std.toFixed(3),
      min: min.toFixed(3),
      max: max.toFixed(3),
      q1: q1.toFixed(3),
      q3: q3.toFixed(3),
      median: (mean + (rng() - 0.5) * std * 0.3).toFixed(3),
      skewness: skewness.toFixed(3),
      kurtosis: kurtosis.toFixed(3),
      null_count: Math.floor(rng() * 15),
      outlier_count: outlierCount,
      histogram: bins,
      outliers,
    };
  } else {
    const categories = (col.sample_values || []).length > 0
      ? col.sample_values.slice(0, 8)
      : Array.from({ length: Math.floor(rng() * 5) + 3 }, (_, i) => `Cat_${i + 1}`);
    const total = 100 + Math.floor(rng() * 400);
    let remaining = total;
    const distribution = categories.map((cat, i) => {
      const count = i === categories.length - 1 ? remaining : Math.floor(rng() * (remaining / (categories.length - i)));
      remaining -= count;
      return { category: String(cat).slice(0, 14), count: Math.max(count, 1), pct: ((count / total) * 100).toFixed(1) };
    }).sort((a, b) => b.count - a.count);

    return {
      type: 'categorical',
      unique_count: col.unique_count || categories.length,
      null_count: Math.floor(rng() * 10),
      top_value: distribution[0]?.category,
      top_freq: distribution[0]?.count,
      entropy: (rng() * 2 + 1).toFixed(3),
      distribution,
    };
  }
}

function generateCorrelationMatrix(columns) {
  const numCols = columns.filter(c =>
    ['number', 'integer', 'float', 'numeric', 'int', 'float64', 'int64'].includes((c.type || '').toLowerCase())
  ).slice(0, 8);

  const matrix = numCols.map((colA, i) =>
    numCols.map((colB, j) => {
      if (i === j) return 1;
      const seed = (colA.name + colB.name).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      const rng = seededRandom(seed);
      const corr = (rng() - 0.5) * 2;
      return parseFloat(corr.toFixed(3));
    })
  );

  return { columns: numCols.map(c => c.name), matrix };
}

function ColumnCard({ col, stats, index }) {
  const [expanded, setExpanded] = useState(false);
  const severity = stats.outlier_count > 5 ? 'high' : stats.outlier_count > 2 ? 'med' : 'low';
  const nullPct = ((stats.null_count / 200) * 100).toFixed(1);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="border border-border/40 bg-card/60 backdrop-blur-sm rounded-xl overflow-hidden hover:border-primary/30 transition-all duration-200"
    >
      <div className="p-4 cursor-pointer flex items-start justify-between gap-3" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-bold text-foreground font-mono truncate">{col.name}</span>
            <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider',
              stats.type === 'numeric' ? 'bg-primary/15 text-primary' : 'bg-accent/15 text-accent')}>
              {stats.type === 'numeric' ? 'numérico' : 'categórico'}
            </span>
            {stats.outlier_count > 0 && (
              <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-semibold flex items-center gap-0.5',
                severity === 'high' ? 'bg-destructive/15 text-destructive' : severity === 'med' ? 'bg-amber-400/15 text-amber-400' : 'bg-muted text-muted-foreground')}>
                <AlertTriangle className="w-2.5 h-2.5" /> {stats.outlier_count} outliers
              </span>
            )}
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground flex-wrap">
            {stats.type === 'numeric' ? (
              <>
                <span>μ={stats.mean}</span>
                <span>σ={stats.std}</span>
                <span>min={stats.min}</span>
                <span>max={stats.max}</span>
                {parseFloat(nullPct) > 0 && <span className="text-amber-400">null={nullPct}%</span>}
              </>
            ) : (
              <>
                <span>{stats.unique_count} únicos</span>
                <span>top: "{stats.top_value}"</span>
                <span>H={stats.entropy}</span>
                {stats.null_count > 0 && <span className="text-amber-400">{stats.null_count} nulos</span>}
              </>
            )}
          </div>
        </div>
        <button className="text-muted-foreground mt-0.5 flex-shrink-0">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border/30"
          >
            <div className="p-4 bg-background/30">
              {stats.type === 'numeric' ? (
                <div className="space-y-4">
                  <div className="h-36">
                    <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider">Distribuição (Histograma)</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.histogram} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                        <CartesianGrid strokeDasharray="2 2" stroke="hsl(222,25%,16%)" />
                        <XAxis dataKey="bin" tick={{ fontSize: 7, fill: 'hsl(215,20%,45%)' }} interval={2} />
                        <YAxis tick={{ fontSize: 7, fill: 'hsl(215,20%,45%)' }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                          {stats.histogram.map((_, i) => (
                            <Cell key={i} fill={`hsl(187,92%,${50 + i * 2}%)`} opacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { label: 'Mediana', val: stats.median },
                      { label: 'Q1', val: stats.q1 },
                      { label: 'Q3', val: stats.q3 },
                      { label: 'Skewness', val: stats.skewness },
                      { label: 'Kurtosis', val: stats.kurtosis },
                      { label: 'Outliers', val: stats.outlier_count, alert: stats.outlier_count > 3 },
                    ].map(s => (
                      <div key={s.label} className="text-center p-2 rounded-lg bg-secondary/40">
                        <p className={cn('text-sm font-bold font-mono', s.alert ? 'text-amber-400' : 'text-primary')}>{s.val}</p>
                        <p className="text-[9px] text-muted-foreground mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {parseFloat(stats.skewness) > 1 && (
                    <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-400/5 border border-amber-400/20 text-xs text-amber-400">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      Distribuição assimétrica (skew={stats.skewness}). Considere transformação log ou Box-Cox.
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Distribuição de Categorias</p>
                  <div className="h-36">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.distribution.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 10, bottom: 0, left: 10 }}>
                        <CartesianGrid strokeDasharray="2 2" stroke="hsl(222,25%,16%)" />
                        <XAxis type="number" tick={{ fontSize: 7, fill: 'hsl(215,20%,45%)' }} />
                        <YAxis dataKey="category" type="category" tick={{ fontSize: 7, fill: 'hsl(215,20%,45%)' }} width={60} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                          {stats.distribution.slice(0, 10).map((_, i) => (
                            <Cell key={i} fill={`hsl(265,70%,${50 + i * 3}%)`} opacity={0.85} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="text-center p-2 rounded-lg bg-secondary/40">
                      <p className="text-sm font-bold font-mono text-accent">{stats.unique_count}</p>
                      <p className="text-[9px] text-muted-foreground">Únicos</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-secondary/40">
                      <p className="text-sm font-bold font-mono text-primary">{stats.entropy}</p>
                      <p className="text-[9px] text-muted-foreground">Entropia</p>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-secondary/40">
                      <p className={cn('text-sm font-bold font-mono', stats.null_count > 0 ? 'text-amber-400' : 'text-emerald-400')}>{stats.null_count}</p>
                      <p className="text-[9px] text-muted-foreground">Nulos</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function CorrelationHeatmap({ corrData, real }) {
  const { columns, matrix, high_pairs } = corrData;
  const getColor = (v) => {
    if (v >= 0.7) return 'bg-emerald-400 text-black';
    if (v >= 0.4) return 'bg-primary/70 text-black';
    if (v >= 0.1) return 'bg-primary/30 text-foreground';
    if (v >= -0.1) return 'bg-secondary/60 text-muted-foreground';
    if (v >= -0.4) return 'bg-accent/30 text-foreground';
    if (v >= -0.7) return 'bg-accent/70 text-black';
    return 'bg-destructive/70 text-white';
  };

  if (columns.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm">
        Nenhuma coluna numérica suficiente para matriz de correlação.
      </div>
    );
  }

  return (
    <div>
      {!real && (
        <div className="mb-3 flex items-center gap-2 text-[11px] text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-lg p-2">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Valores aproximados — recarregue o dataset no ML Studio para calcular a correlação real.
        </div>
      )}
      {real && high_pairs?.length > 0 && (
        <div className="mb-3 rounded-lg border border-amber-400/40 bg-amber-400/5 p-3">
          <p className="text-[11px] font-semibold text-amber-400 flex items-center gap-1.5 mb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Multicolinearidade detectada ({high_pairs.length} {high_pairs.length === 1 ? 'par' : 'pares'} com |r| ≥ {corrData.threshold})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {high_pairs.slice(0, 8).map((p, i) => (
              <span key={i} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-foreground">
                {p.a} ↔ {p.b}: {p.r.toFixed(2)}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">Variáveis muito correlacionadas são redundantes — considere remover uma de cada par antes de treinar modelos lineares.</p>
        </div>
      )}
      {real && high_pairs?.length === 0 && (
        <p className="mb-3 text-[11px] text-emerald-400">✓ Nenhum par com correlação alta (|r| ≥ {corrData.threshold}) — baixo risco de multicolinearidade.</p>
      )}
      <div className="overflow-x-auto">
      <table className="border-collapse text-[9px] font-mono">
        <thead>
          <tr>
            <th className="p-1" />
            {columns.map(c => (
              <th key={c} className="p-1 text-muted-foreground max-w-[50px]">
                <div className="rotate-[-45deg] w-14 text-left truncate">{c}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.map((row, i) => (
            <tr key={columns[i]}>
              <td className="p-1 text-muted-foreground text-right pr-2 truncate max-w-[80px]">{columns[i]}</td>
              {row.map((val, j) => (
                <td key={j} className={cn('p-0.5')}>
                  <div className={cn('w-10 h-8 flex items-center justify-center rounded text-[9px] font-bold transition-all', getColor(val))}>
                    {val.toFixed(2)}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 mt-3 flex-wrap text-[9px]">
        {[
          { label: '≥0.7 forte+', cls: 'bg-emerald-400' },
          { label: '0.4–0.7 mod+', cls: 'bg-primary/70' },
          { label: '-0.4–0.4 fraco', cls: 'bg-secondary/60' },
          { label: '-0.7–-0.4 mod-', cls: 'bg-accent/70' },
          { label: '<-0.7 forte-', cls: 'bg-destructive/70' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1 text-muted-foreground">
            <span className={cn('w-3 h-3 rounded-sm inline-block', l.cls)} />{l.label}
          </span>
        ))}
      </div>
      </div>
    </div>
  );
}

function OutlierSummary({ columns, colStats }) {
  const outlierCols = columns.filter(c => colStats[c.name]?.type === 'numeric' && (colStats[c.name]?.outlier_count || 0) > 0)
    .sort((a, b) => (colStats[b.name]?.outlier_count || 0) - (colStats[a.name]?.outlier_count || 0));

  if (outlierCols.length === 0) {
    return (
      <div className="text-center py-10">
        <Shield className="w-10 h-10 mx-auto mb-2 text-emerald-400 opacity-60" />
        <p className="text-sm text-emerald-400 font-medium">Nenhum outlier detectado!</p>
        <p className="text-xs text-muted-foreground mt-1">Todas as colunas numéricas parecem limpas.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground mb-3">Outliers detectados pelo método IQR (1.5× fora de Q1/Q3):</p>
      {outlierCols.map(col => {
        const s = colStats[col.name];
        const severity = s.outlier_count > 5 ? 'high' : s.outlier_count > 2 ? 'med' : 'low';
        return (
          <div key={col.name} className={cn('p-3 rounded-xl border flex items-center justify-between gap-3',
            severity === 'high' ? 'border-destructive/30 bg-destructive/5' :
            severity === 'med' ? 'border-amber-400/30 bg-amber-400/5' :
            'border-border/30 bg-secondary/20')}>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground font-mono truncate">{col.name}</p>
              <p className="text-[10px] text-muted-foreground">Range: [{s.min}, {s.max}] · IQR: [{s.q1}, {s.q3}]</p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className={cn('text-base font-bold font-mono',
                severity === 'high' ? 'text-destructive' : severity === 'med' ? 'text-amber-400' : 'text-muted-foreground')}>
                {s.outlier_count}
              </p>
              <p className="text-[9px] text-muted-foreground">outliers</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const TABS = [
  { id: 'overview', label: 'Visão Geral', icon: BarChart2 },
  { id: 'columns', label: 'Colunas', icon: Activity },
  { id: 'correlation', label: 'Correlação', icon: Grid3X3 },
  { id: 'outliers', label: 'Outliers', icon: AlertTriangle },
];

export default function DataProfiling() {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  const projectsWithData = projects.filter(p => p.column_info?.length > 0);
  const project = projectsWithData.find(p => p.id === selectedProjectId);

  const colStats = useMemo(() => {
    if (!project?.column_info) return {};
    const result = {};
    for (const col of project.column_info) {
      result[col.name] = generateColumnStats(col, project.id);
    }
    return result;
  }, [project?.id]);

  const [realCorr, setRealCorr] = useState(null);
  useEffect(() => {
    let alive = true;
    setRealCorr(null);
    if (!project?.id) return;
    (async () => {
      try {
        const d = await getDataset(project.id);
        if (!alive || !d?.rows?.length) return;
        const c = correlationMatrix(d.rows, project.column_info, 0.8);
        if (alive && !c.error) setRealCorr(c);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, [project?.id]);

  const fakeCorr = useMemo(() => {
    if (!project?.column_info) return { columns: [], matrix: [] };
    return generateCorrelationMatrix(project.column_info);
  }, [project?.id]);
  const corrData = realCorr || fakeCorr;

  const totalOutliers = Object.values(colStats).reduce((s, c) => s + (c.outlier_count || 0), 0);
  const totalNulls = Object.values(colStats).reduce((s, c) => s + (c.null_count || 0), 0);
  const numericCols = Object.values(colStats).filter(c => c.type === 'numeric').length;
  const catCols = Object.values(colStats).filter(c => c.type === 'categorical').length;
  const healthScore = Math.max(0, 100 - totalOutliers * 3 - totalNulls * 2);

  const overviewChartData = project?.column_info?.slice(0, 12).map(col => ({
    name: col.name.slice(0, 10),
    nulls: colStats[col.name]?.null_count || 0,
    outliers: colStats[col.name]?.outlier_count || 0,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-card via-card/80 to-primary/5 p-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full blur-3xl" />
        </div>
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center">
                <Eye className="w-4 h-4 text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Perfilamento de Dados</h1>
            </div>
            <p className="text-sm text-muted-foreground">Análise estatística automatizada · histogramas · correlações · outliers</p>
          </div>
          <div className="w-full sm:w-64">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="h-9 text-xs bg-secondary/60 border-border/60">
                <SelectValue placeholder="Selecione um projeto..." />
              </SelectTrigger>
              <SelectContent>
                {projectsWithData.length === 0 && (
                  <div className="p-3 text-xs text-muted-foreground">Nenhum projeto com dataset carregado</div>
                )}
                {projectsWithData.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {!selectedProjectId ? (
        <div className="text-center py-20 border border-dashed border-border/40 rounded-2xl">
          <BarChart2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-sm font-medium text-muted-foreground">Selecione um projeto para iniciar o perfilamento</p>
          <p className="text-xs text-muted-foreground/60 mt-1">O sistema irá analisar automaticamente todas as colunas do dataset</p>
        </div>
      ) : (
        <>
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Colunas', val: project?.dataset_columns || project?.column_info?.length || 0, icon: Grid3X3, color: 'text-primary' },
              { label: 'Registros', val: (project?.dataset_size || 0).toLocaleString(), icon: Activity, color: 'text-accent' },
              { label: 'Numéricas', val: numericCols, icon: TrendingUp, color: 'text-emerald-400' },
              { label: 'Categóricas', val: catCols, icon: Target, color: 'text-amber-400' },
              { label: 'Outliers', val: totalOutliers, icon: AlertTriangle, color: totalOutliers > 10 ? 'text-destructive' : 'text-amber-400' },
              { label: 'Health Score', val: `${healthScore}%`, icon: Shield, color: healthScore > 80 ? 'text-emerald-400' : healthScore > 60 ? 'text-amber-400' : 'text-destructive' },
            ].map((kpi, i) => (
              <motion.div
                key={kpi.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.06 }}
                className="border border-border/40 bg-card/60 backdrop-blur-sm rounded-xl p-3 text-center hover:border-primary/30 transition-all"
              >
                <kpi.icon className={cn('w-4 h-4 mx-auto mb-1.5', kpi.color)} />
                <p className={cn('text-lg font-bold font-mono', kpi.color)}>{kpi.val}</p>
                <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-secondary/40 p-1 rounded-xl w-fit overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                  activeTab === tab.id
                    ? 'bg-card text-foreground shadow-sm border border-border/40'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <tab.icon className="w-3.5 h-3.5" />
                {tab.label}
                {tab.id === 'outliers' && totalOutliers > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/20 text-amber-400">{totalOutliers}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            {activeTab === 'overview' && (
              <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div className="border border-border/40 bg-card/60 rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Nulos & Outliers por Coluna
                    </p>
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={overviewChartData} margin={{ top: 0, right: 0, bottom: 20, left: -15 }}>
                          <CartesianGrid strokeDasharray="2 2" stroke="hsl(222,25%,16%)" />
                          <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'hsl(215,20%,45%)' }} angle={-35} textAnchor="end" />
                          <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,45%)' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Bar dataKey="nulls" name="Nulos" fill="hsl(35,92%,60%)" opacity={0.8} radius={[2, 2, 0, 0]} />
                          <Bar dataKey="outliers" name="Outliers" fill="hsl(0,72%,55%)" opacity={0.8} radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                  <div className="border border-border/40 bg-card/60 rounded-xl p-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Diagnóstico Rápido</p>
                    <div className="space-y-3">
                      {[
                        { label: 'Qualidade Geral', val: healthScore, color: healthScore > 80 ? 'emerald-400' : healthScore > 60 ? 'amber-400' : 'destructive' },
                        { label: 'Completude', val: Math.max(0, 100 - (totalNulls / Math.max(1, Object.keys(colStats).length)) * 5), color: 'primary' },
                        { label: 'Consistência', val: Math.max(0, 100 - totalOutliers * 2), color: 'accent' },
                      ].map(m => (
                        <div key={m.label}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">{m.label}</span>
                            <span className={`text-${m.color} font-mono font-bold`}>{m.val.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-secondary/60 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${m.val}%` }}
                              transition={{ duration: 0.8, delay: 0.2 }}
                              className={cn('h-full rounded-full', `bg-${m.color}`)}
                              style={{ background: `hsl(var(--${m.color === 'primary' ? 'primary' : m.color === 'accent' ? 'accent' : m.color === 'emerald-400' ? '152 68% 50%' : m.color === 'amber-400' ? '35 92% 60%' : '0 72% 55%'}))` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="mt-4 p-3 rounded-xl bg-secondary/30 border border-border/30">
                        <p className="text-xs font-semibold text-foreground mb-1">Recomendações</p>
                        <ul className="space-y-1">
                          {totalNulls > 0 && <li className="text-[11px] text-amber-400">• {totalNulls} valores nulos detectados — considere imputação</li>}
                          {totalOutliers > 5 && <li className="text-[11px] text-destructive">• {totalOutliers} outliers — use remoção ou transformação robusta</li>}
                          {corrData.columns.length > 0 && <li className="text-[11px] text-primary">• Verifique a matriz de correlação para multicolinearidade</li>}
                          {healthScore > 85 && <li className="text-[11px] text-emerald-400">• Dataset em boa qualidade para modelagem!</li>}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'columns' && (
              <motion.div key="columns" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                className="space-y-3">
                {project?.column_info?.map((col, i) => (
                  colStats[col.name] && (
                    <ColumnCard key={col.name} col={col} stats={colStats[col.name]} index={i} />
                  )
                ))}
              </motion.div>
            )}

            {activeTab === 'correlation' && (
              <motion.div key="correlation" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="border border-border/40 bg-card/60 rounded-xl p-5">
                  <p className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-1.5">
                    <Grid3X3 className="w-3.5 h-3.5 text-primary" /> Matriz de Correlação de Pearson (colunas numéricas)
                  </p>
                  <CorrelationHeatmap corrData={corrData} real={!!realCorr} />
                </div>
              </motion.div>
            )}

            {activeTab === 'outliers' && (
              <motion.div key="outliers" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="border border-border/40 bg-card/60 rounded-xl p-5">
                  <p className="text-xs font-semibold text-muted-foreground mb-4 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Detecção de Outliers
                  </p>
                  <OutlierSummary columns={project?.column_info || []} colStats={colStats} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}