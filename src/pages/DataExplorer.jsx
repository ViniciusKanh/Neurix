import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import GlowCard from '@/components/ui/GlowCard';
import DataPreviewTable from '@/components/project/DataPreviewTable';
import DataQualityPanel from '@/components/project/DataQualityPanel';
import CorrelationHeatmap from '@/components/project/CorrelationHeatmap';
import QuickStatsPanel from '@/components/explorer/QuickStatsPanel';
import ReactMarkdown from 'react-markdown';
import {
  Database, BarChart2, Table2, AlertTriangle, Sparkles, Loader2,
  TrendingUp, CheckCircle2, AlertCircle, PieChart, Hash, GitBranch, Scale, Boxes
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart as RePieChart, Pie, Cell, ScatterChart, Scatter, ZAxis
} from 'recharts';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)', 'hsl(330,70%,60%)', 'hsl(210,80%,60%)', 'hsl(50,92%,55%)'];
const TOOLTIP_STYLE = { background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };

const TABS = [
  { id: 'overview', label: 'Visão Geral', icon: Database },
  { id: 'distributions', label: 'Distribuições', icon: BarChart2 },
  { id: 'outliers', label: 'Outliers', icon: AlertTriangle },
  { id: 'bivariate', label: 'Bivariada', icon: TrendingUp },
  { id: 'stats', label: 'Estatísticas', icon: Hash },
  { id: 'quality', label: 'Qualidade', icon: AlertCircle },
  { id: 'balancing', label: 'Balanceamento', icon: Scale },
  { id: 'correlation', label: 'Correlação', icon: PieChart },
  { id: 'preview', label: 'Prévia', icon: Table2 },
  { id: 'ai', label: 'EDA (Análise)', icon: Sparkles },
];

function StatCard({ label, value, sub, color = 'text-primary' }) {
  return (
    <GlowCard className="text-center py-3" hover={false}>
      <p className={cn('text-xl font-bold font-mono', color)}>{value}</p>
      <p className="text-xs font-medium text-foreground mt-0.5">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </GlowCard>
  );
}

function DistributionChart({ col, color }) {
  const vals = col.sample_values || [];
  const isNumeric = ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((col.type || '').toLowerCase());

  if (isNumeric) {
    // Build histogram buckets for numeric columns
    const nums = vals.map(v => parseFloat(v)).filter(n => !isNaN(n));
    if (nums.length < 2) return null;
    const min = Math.min(...nums), max = Math.max(...nums);
    const buckets = 8;
    const step = (max - min) / buckets || 1;
    const histo = Array.from({ length: buckets }, (_, i) => ({
      range: `${(min + i * step).toFixed(1)}–${(min + (i + 1) * step).toFixed(1)}`,
      count: nums.filter(n => n >= min + i * step && n < min + (i + 1) * step).length,
    }));
    return (
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={histo} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
            <XAxis dataKey="range" tick={{ fontSize: 6, fill: 'hsl(215,20%,55%)' }} interval={0} angle={-30} textAnchor="end" height={30} />
            <YAxis tick={{ fontSize: 7, fill: 'hsl(215,20%,55%)' }} width={20} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" name="Frequência" fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  } else {
    // Categorical: frequency bar chart
    const freq = {};
    vals.forEach(v => { const k = String(v ?? 'nulo'); freq[k] = (freq[k] || 0) + 1; });
    const data = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name: name.length > 12 ? name.slice(0, 11) + '…' : name, count }));
    if (data.length < 1) return null;
    return (
      <div className="h-32">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
            <XAxis dataKey="name" tick={{ fontSize: 7, fill: 'hsl(215,20%,55%)' }} interval={0} angle={-30} textAnchor="end" height={30} />
            <YAxis tick={{ fontSize: 7, fill: 'hsl(215,20%,55%)' }} width={20} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" name="Frequência" fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }
}

function BalancingPanel({ project, columns, target, setTarget }) {
  // Candidate targets: categorical, low-to-moderate cardinality.
  const candidates = columns.filter(
    (c) => (c.value_counts && c.value_counts.length >= 2) ||
      (['categorical', 'string', 'object', 'category', 'boolean', 'bool'].includes((c.type || '').toLowerCase()) &&
        (c.unique_count || 0) >= 2 && (c.unique_count || 0) <= 50)
  );
  const col = columns.find((c) => c.name === target) || candidates[0];

  // Distribution: prefer value_counts computed at parse; else derive from sample.
  let dist = [];
  if (col) {
    if (col.value_counts && col.value_counts.length) {
      dist = col.value_counts.map((v) => ({ label: String(v.value), count: v.count }));
    } else {
      const counts = {};
      (project.data_sample || []).forEach((r) => {
        const k = String(r[col.name] ?? 'nulo');
        counts[k] = (counts[k] || 0) + 1;
      });
      dist = Object.entries(counts).map(([label, count]) => ({ label, count }));
    }
  }
  dist.sort((a, b) => b.count - a.count);
  const total = dist.reduce((s, d) => s + d.count, 0) || 1;
  const withPct = dist.map((d) => ({ ...d, pct: (d.count / total) * 100 }));
  const majority = withPct[0];
  const minority = withPct[withPct.length - 1];
  const ratio = majority && minority && minority.count > 0 ? majority.count / minority.count : 0;

  let verdict, vcolor, recs;
  if (!col || dist.length < 2) { verdict = 'Indeterminado'; vcolor = 'text-muted-foreground'; recs = []; }
  else if (ratio < 1.5) { verdict = 'Balanceado'; vcolor = 'text-emerald-400'; recs = ['Distribuição equilibrada — não é necessário rebalancear.']; }
  else if (ratio < 3) { verdict = 'Leve desbalanceamento'; vcolor = 'text-primary'; recs = ['Pode treinar sem rebalancear; monitore recall da classe minoritária.', 'Opcional: class_weight="balanced".']; }
  else if (ratio <= 10) { verdict = 'Desbalanceamento moderado'; vcolor = 'text-amber-400'; recs = ['Use oversampling (SMOTE) ou undersampling.', 'Aplique class_weight="balanced" no modelo.', 'Avalie por F1/AUC, não por acurácia.']; }
  else { verdict = 'Desbalanceamento severo'; vcolor = 'text-destructive'; recs = ['Oversampling (SMOTE/ADASYN) da classe minoritária.', 'Undersampling da majoritária ou modelos sensíveis a custo.', 'Considere coletar mais dados da classe rara.', 'Métricas: F1, AUC-PR, recall — nunca só acurácia.']; }

  const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(35,92%,60%)', 'hsl(330,70%,60%)', 'hsl(265,70%,60%)', 'hsl(210,80%,60%)'];

  return (
    <div className="space-y-4">
      <GlowCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-foreground">Análise de Balanceamento</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Coluna alvo:</span>
            <Select value={col?.name || ''} onValueChange={setTarget}>
              <SelectTrigger className="bg-secondary/50 w-52 h-8 text-xs"><SelectValue placeholder="Selecione a classe" /></SelectTrigger>
              <SelectContent>
                {candidates.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!col || candidates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma coluna categórica adequada para análise de classes. (Reenvie o dataset se ele foi importado antes desta atualização.)
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <Metric label="Classes" value={dist.length} />
              <Metric label="Razão maj/min" value={ratio ? `${ratio.toFixed(1)}×` : '—'} />
              <Metric label="Maioria" value={majority ? `${majority.pct.toFixed(0)}%` : '—'} sub={majority?.label} />
              <Metric label="Minoria" value={minority ? `${minority.pct.toFixed(0)}%` : '—'} sub={minority?.label} />
            </div>

            <div className="h-56 mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={withPct} margin={{ top: 4, right: 8, left: -18, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                  <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} interval={0} angle={-20} textAnchor="end" height={40} />
                  <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => n === 'count' ? [v, 'Contagem'] : [v, n]} />
                  <Bar dataKey="count" name="Contagem" radius={[3, 3, 0, 0]}>
                    {withPct.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className={cn('text-sm font-semibold', vcolor)}>Veredito: {verdict}</p>
          </>
        )}
      </GlowCard>

      {recs.length > 0 && (
        <GlowCard glowColor="accent">
          <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-accent" /> Recomendações de balanceamento</h3>
          <ul className="space-y-1.5">
            {recs.map((r, i) => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><CheckCircle2 className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" /> {r}</li>)}
          </ul>
        </GlowCard>
      )}

      <GlowCard>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Boxes className="w-4 h-4 text-primary" />
            <div>
              <h3 className="font-semibold text-foreground text-sm">Agrupamento não supervisionado</h3>
              <p className="text-xs text-muted-foreground">Sem coluna alvo — descubra grupos naturais (K-Means, DBSCAN, Hierárquico).</p>
            </div>
          </div>
          <Link to={`/ml-studio?project=${project.id}&task=clustering`}>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Boxes className="w-3.5 h-3.5 mr-1.5" /> Rodar agrupamento
            </Button>
          </Link>
        </div>
      </GlowCard>
    </div>
  );
}

function Metric({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-card/40 border border-border/40 p-3 text-center">
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70 truncate">{sub}</p>}
    </div>
  );
}

export default function DataExplorer() {
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedProjectId, setSelectedProjectId] = useState(urlParams.get('project') || '');
  const [activeTab, setActiveTab] = useState('overview');
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [bivariateCol1, setBivariateCol1] = useState('');
  const [bivariateCol2, setBivariateCol2] = useState('');
  const [bivariateResult, setBivariateResult] = useState(null);
  const [isBivariate, setIsBivariate] = useState(false);
  const [balanceTarget, setBalanceTarget] = useState('');

  const { data: projects = [], isLoading: loadingProjects } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 50) });

  const projectsWithData = projects.filter(p => p.dataset_file_url);
  const project = projectsWithData.find(p => p.id === selectedProjectId);
  const columns = project?.column_info || [];

  const isNumeric = (c) => ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((c.type || '').toLowerCase());
  const isCategorical = (c) => ['string', 'object', 'category', 'categorical', 'text', 'varchar'].includes((c.type || '').toLowerCase());
  const isDate = (c) => ['date', 'datetime', 'timestamp', 'time'].includes((c.type || '').toLowerCase());
  const isBool = (c) => ['bool', 'boolean'].includes((c.type || '').toLowerCase());

  const numericCols = columns.filter(isNumeric);
  const categoricalCols = columns.filter(isCategorical);
  const dateCols = columns.filter(isDate);
  const boolCols = columns.filter(isBool);
  const highNullCols = columns.filter(c => (c.null_percent || 0) > 30);
  const constantCols = columns.filter(c => c.unique_count === 1);
  const highCardCols = columns.filter(c => c.unique_count > 100);

  const typePieData = (() => {
    const g = {};
    columns.forEach(c => {
      const t = isNumeric(c) ? 'Numérico' : isCategorical(c) ? 'Categórico' : isBool(c) ? 'Booleano' : isDate(c) ? 'Data/Hora' : 'Outro';
      g[t] = (g[t] || 0) + 1;
    });
    return Object.entries(g).map(([name, value]) => ({ name, value }));
  })();

  const nullsData = columns.filter(c => c.null_percent != null && c.null_percent > 0)
    .map(c => ({ name: c.name.length > 14 ? c.name.slice(0, 13) + '…' : c.name, percent: parseFloat((c.null_percent || 0).toFixed(1)) }))
    .sort((a, b) => b.percent - a.percent).slice(0, 15);

  const avgNulls = columns.length > 0 ? columns.reduce((s, c) => s + (c.null_percent || 0), 0) / columns.length : 0;

  // Bivariate analysis computed locally (Pearson) from the data sample — no AI.
  const runBivariateAnalysis = async () => {
    if (!project || !bivariateCol1 || !bivariateCol2) return;
    setIsBivariate(true);
    setBivariateResult(null);
    await new Promise(r => setTimeout(r, 300));

    const sample = project.data_sample || [];
    const pairs = sample
      .map(row => ({ x: parseFloat(row[bivariateCol1]), y: parseFloat(row[bivariateCol2]) }))
      .filter(p => !isNaN(p.x) && !isNaN(p.y));

    let r = 0;
    if (pairs.length >= 3) {
      const n = pairs.length;
      const mx = pairs.reduce((s, p) => s + p.x, 0) / n;
      const my = pairs.reduce((s, p) => s + p.y, 0) / n;
      let num = 0, dx = 0, dy = 0;
      pairs.forEach(p => { num += (p.x - mx) * (p.y - my); dx += (p.x - mx) ** 2; dy += (p.y - my) ** 2; });
      r = (dx > 0 && dy > 0) ? num / Math.sqrt(dx * dy) : 0;
    }
    const abs = Math.abs(r);
    const strength = abs >= 0.7 ? 'forte' : abs >= 0.4 ? 'moderada' : abs >= 0.2 ? 'fraca' : 'muito fraca/inexistente';
    const dir = r > 0 ? 'positiva' : r < 0 ? 'negativa' : 'nula';

    setBivariateResult({
      correlation_type: `Pearson (${dir})`,
      correlation_coefficient: r,
      interpretation: pairs.length < 3
        ? 'Amostra insuficiente para calcular correlação (necessário ao menos 3 pares numéricos válidos).'
        : `Correlação ${strength} ${dir} entre "${bivariateCol1}" e "${bivariateCol2}" (r = ${r.toFixed(3)}), calculada sobre ${pairs.length} registros da amostra.`,
      scatter_data: pairs.slice(0, 200),
      insight: abs >= 0.7 ? 'Variáveis fortemente relacionadas — atenção a multicolinearidade se ambas forem preditoras.' : 'Relação linear limitada; considere transformações ou relações não-lineares.',
      recommendation: abs >= 0.4 ? 'Boa candidata a feature preditiva; avalie manter apenas uma se a correlação for muito alta.' : 'Baixo poder linear isolado; teste em conjunto com outras variáveis.',
    });
    setIsBivariate(false);
  };

  // EDA computed locally from column metadata + sample — no AI.
  const generateAIAnalysis = async () => {
    if (!project) return;
    setIsGeneratingAI(true);
    await new Promise(r => setTimeout(r, 400));

    const highNull = columns.filter(c => (c.null_percent || 0) > 20);
    const highCard = categoricalCols.filter(c => (c.unique_count || 0) > 50);
    const lowCardCat = categoricalCols.filter(c => (c.unique_count || 0) >= 2 && (c.unique_count || 0) <= 20);
    const constants = columns.filter(c => (c.unique_count || 0) <= 1);

    let md = `## Relatório EDA — ${project.dataset_filename || project.name}\n\n`;
    md += `### 1. Estrutura\n`;
    md += `- **${project.dataset_size?.toLocaleString('pt-BR') || 0}** linhas × **${project.dataset_columns || columns.length}** colunas\n`;
    md += `- Numéricas: **${numericCols.length}** | Categóricas: **${categoricalCols.length}** | Datas: **${dateCols.length}**\n\n`;

    md += `### 2. Qualidade dos Dados\n`;
    md += `- Taxa média de nulos: **${avgNulls.toFixed(1)}%**\n`;
    md += highNull.length ? `- ⚠️ Colunas com >20% de nulos: ${highNull.map(c => `\`${c.name}\` (${(c.null_percent||0).toFixed(0)}%)`).join(', ')}\n` : `- ✅ Nenhuma coluna com excesso de nulos\n`;
    if (constants.length) md += `- ⚠️ Colunas praticamente constantes (candidatas a remoção): ${constants.map(c => `\`${c.name}\``).join(', ')}\n`;
    if (highCard.length) md += `- ⚠️ Alta cardinalidade (>50): ${highCard.map(c => `\`${c.name}\``).join(', ')} — considere agrupar categorias\n`;
    md += '\n';

    md += `### 3. Colunas Numéricas\n`;
    if (numericCols.length) numericCols.slice(0, 15).forEach(c => {
      md += `- \`${c.name}\`: ${c.unique_count ?? '—'} valores distintos, ${(c.null_percent||0).toFixed(0)}% nulos${(c.sample_values||[]).length ? ` — ex.: ${(c.sample_values||[]).slice(0,3).join(', ')}` : ''}\n`;
    }); else md += `- Nenhuma coluna numérica.\n`;
    md += '\n';

    md += `### 4. Colunas Categóricas\n`;
    if (categoricalCols.length) categoricalCols.slice(0, 15).forEach(c => {
      md += `- \`${c.name}\`: ${c.unique_count ?? '—'} categorias${(c.sample_values||[]).length ? ` — ex.: ${(c.sample_values||[]).slice(0,4).join(', ')}` : ''}\n`;
    }); else md += `- Nenhuma coluna categórica.\n`;
    md += '\n';

    md += `### 5. Tarefas de ML recomendadas\n`;
    if (lowCardCat.length) md += `- **Classificação** — alvos candidatos: ${lowCardCat.slice(0,3).map(c => `\`${c.name}\``).join(', ')}\n`;
    if (numericCols.length) md += `- **Regressão** — alvos numéricos: ${numericCols.slice(0,3).map(c => `\`${c.name}\``).join(', ')}\n`;
    if (categoricalCols.length >= 2) md += `- **Regras de associação** — ${categoricalCols.length} colunas categóricas\n`;
    if (numericCols.length >= 3) md += `- **Clustering** — ${numericCols.length} colunas numéricas para segmentação\n`;
    md += '\n';

    md += `### 6. Feature Engineering sugerida\n`;
    if (highNull.length) md += `- Imputação (média/mediana/moda) nas colunas com nulos\n`;
    if (numericCols.length) md += `- Normalização/padronização das numéricas (StandardScaler/MinMax)\n`;
    if (categoricalCols.length) md += `- Encoding das categóricas (One-Hot para baixa cardinalidade, target/frequency para alta)\n`;
    if (highCard.length) md += `- Agrupar categorias raras nas colunas de alta cardinalidade\n`;

    setAiAnalysis(md);
    setIsGeneratingAI(false);
    setActiveTab('ai');
    toast.success('Análise EDA gerada (cálculo local)');
  };

  if (loadingProjects) return <LoadingSpinner text="Carregando projetos..." />;

  return (
    <div>
      <PageHeader title="Explorador de Dados"
        subtitle="Análise exploratória completa — distribuições, qualidade, correlações e EDA inteligente"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {project && (
              <Button onClick={generateAIAnalysis} disabled={isGeneratingAI} size="sm" variant="outline" className="border-accent/40 text-accent hover:bg-accent/10">
                {isGeneratingAI ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Gerando EDA...</> : <><Sparkles className="w-3.5 h-3.5 mr-1.5" /> EDA com IA</>}
              </Button>
            )}
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-56 bg-secondary/50"><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
              <SelectContent>
                {projectsWithData.length === 0 && <div className="p-3 text-xs text-muted-foreground text-center">Nenhum projeto com dataset</div>}
                {projectsWithData.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      />

      {!project ? (
        <EmptyState icon={Database} title="Selecione um projeto" description="Escolha um projeto com dataset para explorar os dados" />
      ) : (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <StatCard label="Linhas" value={project.dataset_size?.toLocaleString('pt-BR') ?? '—'} color="text-primary" />
            <StatCard label="Colunas" value={columns.length || '—'} color="text-accent" />
            <StatCard label="Numéricas" value={numericCols.length} color="text-emerald-400" sub={`${((numericCols.length / (columns.length || 1)) * 100).toFixed(0)}%`} />
            <StatCard label="Categóricas" value={categoricalCols.length} color="text-amber-400" />
            <StatCard label="Nulos > 30%" value={highNullCols.length} color={highNullCols.length > 0 ? 'text-destructive' : 'text-emerald-400'} />
            <StatCard label="Completude Média" value={`${(100 - avgNulls).toFixed(1)}%`} color={avgNulls > 20 ? 'text-amber-400' : 'text-emerald-400'} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg overflow-x-auto scrollbar-thin w-fit">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap',
                  activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                <tab.icon className="w-3 h-3" />{tab.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><PieChart className="w-4 h-4 text-primary" /> Composição do Dataset</h3>
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={typePieData} cx="50%" cy="50%" outerRadius={75} innerRadius={35} dataKey="value"
                          label={({ name, value, percent }) => `${name} (${value}) ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                          {typePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                </GlowCard>
                <DataQualityPanel columns={columns} />
              </div>
              {/* Quick Stats — distribuições e correlações locais */}
              <QuickStatsPanel columns={columns} />

              {project.ai_diagnosis && (
                <GlowCard glowColor="accent">
                  <p className="text-xs font-semibold text-accent mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Diagnóstico dos Dados</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{project.ai_diagnosis}</p>
                </GlowCard>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Variáveis Constantes', items: constantCols, color: 'text-amber-400', desc: 'Sem variação — podem ser removidas' },
                  { label: 'Alta Cardinalidade (>100 únicos)', items: highCardCols, color: 'text-primary', desc: 'Requer codificação especial' },
                  { label: 'Alta taxa de nulos (>30%)', items: highNullCols, color: 'text-destructive', desc: 'Risco para modelagem' },
                ].map((section, i) => (
                  <GlowCard key={i} className="py-3">
                    <p className={cn('text-xs font-semibold mb-1', section.color)}>{section.label}</p>
                    <p className="text-[10px] text-muted-foreground mb-2">{section.desc}</p>
                    {section.items.length === 0
                      ? <p className="text-[10px] text-emerald-400">✓ Nenhuma detectada</p>
                      : <div className="flex flex-wrap gap-1">{section.items.slice(0, 6).map(c => <span key={c.name} className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono text-muted-foreground">{c.name}</span>)}</div>
                    }
                  </GlowCard>
                ))}
              </div>
            </div>
          )}

          {/* DISTRIBUTIONS */}
          {activeTab === 'distributions' && (
            <div className="space-y-5">
              {/* Numeric columns */}
              {numericCols.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Hash className="w-4 h-4 text-emerald-400" /> Colunas Numéricas — Histogramas</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {numericCols.slice(0, 12).map((col, i) => {
                      const chart = <DistributionChart col={col} color={COLORS[i % COLORS.length]} />;
                      if (!chart) return null;
                      return (
                        <GlowCard key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-mono text-primary font-medium truncate max-w-[70%]">{col.name}</p>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400 text-[10px]">{col.type}</span>
                          </div>
                          <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground">
                            <span>{col.unique_count ?? '?'} únicos</span>
                            {col.null_percent != null && <span className={cn(col.null_percent > 10 ? 'text-amber-400' : 'text-emerald-400')}>{col.null_percent.toFixed(1)}% nulos</span>}
                          </div>
                          {chart}
                          {col.sample_values?.length > 0 && (
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">Amostras: {col.sample_values.slice(0, 5).join(', ')}</p>
                          )}
                        </GlowCard>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Categorical columns */}
              {categoricalCols.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><BarChart2 className="w-4 h-4 text-amber-400" /> Colunas Categóricas — Frequências</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {categoricalCols.slice(0, 12).map((col, i) => {
                      const chart = <DistributionChart col={col} color={COLORS[(i + 3) % COLORS.length]} />;
                      if (!chart) return null;
                      return (
                        <GlowCard key={i}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-mono text-amber-400 font-medium truncate max-w-[70%]">{col.name}</p>
                            <span className="px-1.5 py-0.5 rounded bg-amber-400/10 text-amber-400 text-[10px]">{col.type}</span>
                          </div>
                          <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground">
                            <span>{col.unique_count ?? '?'} categorias</span>
                            {col.null_percent != null && <span>{col.null_percent.toFixed(1)}% nulos</span>}
                          </div>
                          {chart}
                        </GlowCard>
                      );
                    })}
                  </div>
                </div>
              )}

              {numericCols.length === 0 && categoricalCols.length === 0 && (
                <EmptyState icon={BarChart2} title="Sem dados de distribuição" description="As colunas do dataset não possuem valores de amostra suficientes" />
              )}
            </div>
          )}

          {/* STATS */}
          {activeTab === 'stats' && (
            <GlowCard>
              <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Table2 className="w-4 h-4 text-primary" /> Estatísticas Descritivas por Coluna</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-secondary/60">
                      {['Coluna', 'Tipo', 'Únicos', 'Nulos (%)', 'Alta Card.', 'Constante', 'Qualidade', 'Valores de Amostra'].map(h => (
                        <th key={h} className="text-left p-2.5 text-muted-foreground font-semibold border-b border-border/40 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {columns.map((col, i) => (
                      <tr key={i} className={cn('hover:bg-secondary/40 transition-colors', i % 2 === 0 ? 'bg-secondary/20' : '')}>
                        <td className="p-2.5 border-b border-border/20">
                          <span className={cn('font-mono font-medium', isNumeric(col) ? 'text-emerald-400' : isCategorical(col) ? 'text-amber-400' : 'text-primary')}>{col.name}</span>
                          {col.unique_count === 1 && <span className="ml-1 text-[9px] text-amber-400">CONSTANTE</span>}
                        </td>
                        <td className="p-2.5 border-b border-border/20">
                          <span className={cn('px-1.5 py-0.5 rounded text-[10px]', isNumeric(col) ? 'bg-emerald-400/10 text-emerald-400' : isCategorical(col) ? 'bg-amber-400/10 text-amber-400' : 'bg-secondary text-muted-foreground')}>{col.type || '—'}</span>
                        </td>
                        <td className="p-2.5 border-b border-border/20 font-mono text-muted-foreground">{col.unique_count ?? '—'}</td>
                        <td className="p-2.5 border-b border-border/20">
                          {col.null_percent != null ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-12 h-1.5 rounded-full bg-secondary/60">
                                <div className="h-full rounded-full" style={{ width: `${Math.min(col.null_percent, 100)}%`, backgroundColor: col.null_percent > 30 ? 'hsl(0,72%,55%)' : col.null_percent > 10 ? 'hsl(35,92%,60%)' : 'hsl(152,68%,50%)' }} />
                              </div>
                              <span className={cn('font-mono font-semibold text-[10px]', col.null_percent > 30 ? 'text-destructive' : col.null_percent > 10 ? 'text-amber-400' : 'text-emerald-400')}>{col.null_percent.toFixed(1)}%</span>
                            </div>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-2.5 border-b border-border/20 text-center">
                          {typeof col.unique_count === 'number' && col.unique_count > 100 ? <span className="text-primary">✓</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-2.5 border-b border-border/20 text-center">
                          {col.unique_count === 1 ? <span className="text-amber-400">⚠</span> : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-2.5 border-b border-border/20">
                          {col.null_percent == null ? <span className="text-muted-foreground">—</span>
                            : col.null_percent > 30 ? <span className="flex items-center gap-1 text-destructive text-[10px]"><AlertCircle className="w-3 h-3" /> Ruim</span>
                            : col.null_percent > 10 ? <span className="flex items-center gap-1 text-amber-400 text-[10px]"><AlertCircle className="w-3 h-3" /> Médio</span>
                            : <span className="flex items-center gap-1 text-emerald-400 text-[10px]"><CheckCircle2 className="w-3 h-3" /> Bom</span>}
                        </td>
                        <td className="p-2.5 border-b border-border/20 text-muted-foreground max-w-xs truncate font-mono text-[10px]">
                          {(col.sample_values || []).slice(0, 4).join(', ') || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlowCard>
          )}

          {/* QUALITY */}
          {activeTab === 'quality' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Taxa de Nulos por Coluna</h3>
                  {nullsData.length === 0
                    ? <div className="text-center py-6 text-xs text-emerald-400">✓ Nenhum valor nulo detectado</div>
                    : (
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={nullsData} layout="vertical" margin={{ left: 0, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" horizontal={false} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} tickFormatter={v => `${v}%`} />
                            <YAxis dataKey="name" type="category" tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} width={90} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} formatter={v => [`${v}%`, 'Nulos']} />
                            <Bar dataKey="percent" radius={[0, 3, 3, 0]}
                              fill="hsl(0,72%,55%)"
                              label={{ position: 'right', fontSize: 8, fill: 'hsl(215,20%,55%)', formatter: v => `${v}%` }} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                </GlowCard>
                <div className="space-y-3">
                  <GlowCard>
                    <h3 className="font-semibold text-foreground mb-3 text-sm">Resumo de Qualidade</h3>
                    <div className="space-y-2">
                      {[
                        { label: 'Completude média', value: `${(100 - avgNulls).toFixed(1)}%`, color: avgNulls > 20 ? 'text-destructive' : avgNulls > 5 ? 'text-amber-400' : 'text-emerald-400' },
                        { label: 'Colunas com >30% nulos', value: highNullCols.length, color: highNullCols.length > 0 ? 'text-destructive' : 'text-emerald-400' },
                        { label: 'Variáveis constantes', value: constantCols.length, color: constantCols.length > 0 ? 'text-amber-400' : 'text-emerald-400' },
                        { label: 'Alta cardinalidade (>100)', value: highCardCols.length, color: 'text-primary' },
                        { label: 'Colunas de data/hora', value: dateCols.length, color: 'text-accent' },
                        { label: 'Colunas booleanas', value: boolCols.length, color: 'text-muted-foreground' },
                      ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-2 rounded bg-secondary/30">
                          <span className="text-xs text-muted-foreground">{item.label}</span>
                          <span className={cn('text-sm font-bold font-mono', item.color)}>{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </GlowCard>
                  {highNullCols.length > 0 && (
                    <GlowCard>
                      <h3 className="font-semibold text-foreground mb-2 text-sm flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-destructive" /> Colunas Críticas</h3>
                      <div className="space-y-1.5">
                        {highNullCols.map(col => (
                          <div key={col.name} className="flex items-center justify-between p-2 rounded bg-destructive/5 border border-destructive/20">
                            <span className="text-xs font-mono text-foreground">{col.name}</span>
                            <span className="text-xs font-bold text-destructive">{(col.null_percent || 0).toFixed(1)}% nulos</span>
                          </div>
                        ))}
                      </div>
                    </GlowCard>
                  )}
                </div>
              </div>
              <DataQualityPanel columns={columns} />
            </div>
          )}

          {activeTab === 'outliers' && (
            <div className="space-y-4">
              <GlowCard>
                <h3 className="font-semibold text-foreground mb-3 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Detecção de Outliers (Regra IQR)</h3>
                <p className="text-xs text-muted-foreground mb-4">Estimativa baseada nas amostras. Valores além de 1.5×IQR são marcados como potenciais outliers.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {numericCols.slice(0, 15).map((col, i) => {
                    const nums = (col.sample_values || []).map(v => parseFloat(v)).filter(n => !isNaN(n));
                    if (nums.length < 4) return null;
                    const sorted = [...nums].sort((a, b) => a - b);
                    const q1 = sorted[Math.floor(sorted.length * 0.25)];
                    const q3 = sorted[Math.floor(sorted.length * 0.75)];
                    const iqr = q3 - q1;
                    const outliers = nums.filter(n => n < q1 - 1.5 * iqr || n > q3 + 1.5 * iqr);
                    const pct = (outliers.length / nums.length * 100).toFixed(1);
                    return (
                      <div key={i} className={cn('p-3 rounded-lg border', outliers.length > 0 ? 'border-amber-400/30 bg-amber-400/5' : 'border-border/20 bg-secondary/10')}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-mono font-semibold text-foreground truncate max-w-[70%]">{col.name}</span>
                          <span className={cn('text-[10px] font-bold', outliers.length > 0 ? 'text-amber-400' : 'text-emerald-400')}>{outliers.length > 0 ? `⚠ ${pct}%` : '✓ OK'}</span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-[10px] text-muted-foreground mb-1">
                          <div className="text-center p-1 rounded bg-secondary/30"><p className="font-mono">{sorted[0]?.toFixed(2)}</p><p>Mín</p></div>
                          <div className="text-center p-1 rounded bg-secondary/30"><p className="font-mono">{((q1+q3)/2).toFixed(2)}</p><p>Mediana</p></div>
                          <div className="text-center p-1 rounded bg-secondary/30"><p className="font-mono">{sorted[sorted.length-1]?.toFixed(2)}</p><p>Máx</p></div>
                        </div>
                        {outliers.length > 0 && <p className="text-[10px] text-amber-400">{outliers.length} outlier(s): [{outliers.slice(0,3).map(v=>v.toFixed(1)).join(', ')}{outliers.length>3?'...':''}]</p>}
                      </div>
                    );
                  })}
                </div>
              </GlowCard>
            </div>
          )}

          {activeTab === 'bivariate' && (
            <div className="space-y-4">
              <GlowCard>
                <h3 className="font-semibold text-foreground mb-1 text-sm flex items-center gap-2"><GitBranch className="w-4 h-4 text-primary" /> Análise Bivariada (Pearson)</h3>
                <p className="text-xs text-muted-foreground mb-4">Selecione duas colunas para analisar correlação, scatter e insights.</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Coluna X</label>
                    <Select value={bivariateCol1} onValueChange={setBivariateCol1}>
                      <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{columns.map(c => <SelectItem key={c.name} value={c.name}>{c.name} ({c.type})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Coluna Y</label>
                    <Select value={bivariateCol2} onValueChange={setBivariateCol2}>
                      <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{columns.filter(c=>c.name!==bivariateCol1).map(c => <SelectItem key={c.name} value={c.name}>{c.name} ({c.type})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end">
                    <Button onClick={runBivariateAnalysis} disabled={isBivariate||!bivariateCol1||!bivariateCol2} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                      {isBivariate ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando...</> : <><TrendingUp className="w-4 h-4 mr-2" /> Analisar</>}
                    </Button>
                  </div>
                </div>
                {bivariateResult && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-3 rounded-lg bg-secondary/30">
                        <p className="text-xl font-bold font-mono text-primary">{bivariateResult.correlation_coefficient?.toFixed(3)}</p>
                        <p className="text-[10px] text-muted-foreground">{bivariateResult.correlation_type}</p>
                      </div>
                      <div className="col-span-2 p-3 rounded-lg bg-secondary/30">
                        <p className="text-xs font-semibold text-foreground mb-0.5">{bivariateResult.interpretation}</p>
                        <p className="text-[10px] text-muted-foreground">{bivariateResult.insight}</p>
                      </div>
                    </div>
                    {bivariateResult.scatter_data?.length > 0 && (
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                            <XAxis dataKey="x" name={bivariateCol1} tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                            <YAxis dataKey="y" name={bivariateCol2} tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                            <ZAxis range={[40, 80]} />
                            <Tooltip contentStyle={TOOLTIP_STYLE} />
                            <Scatter data={bivariateResult.scatter_data} fill="hsl(187,92%,55%)" opacity={0.8} />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {bivariateResult.recommendation && (
                      <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                        <p className="text-xs text-muted-foreground"><span className="text-accent font-semibold">Recomendação ML: </span>{bivariateResult.recommendation}</p>
                      </div>
                    )}
                  </div>
                )}
              </GlowCard>
            </div>
          )}

          {activeTab === 'balancing' && (
            <BalancingPanel project={project} columns={columns} target={balanceTarget} setTarget={setBalanceTarget} />
          )}

          {activeTab === 'correlation' && <CorrelationHeatmap project={project} />}
          {activeTab === 'preview' && <DataPreviewTable data={project.data_sample} columns={columns} />}

          {/* AI EDA */}
          {activeTab === 'ai' && (
            <div className="space-y-5">
              {!aiAnalysis ? (
                <GlowCard className="text-center py-16">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-accent opacity-50" />
                  <p className="text-sm font-medium text-foreground mb-2">Análise EDA Automática</p>
                  <p className="text-xs text-muted-foreground mb-5 max-w-md mx-auto">O sistema gera um relatório EDA completo (cálculo local, sem IA) a partir das estatísticas do seu dataset — distribuições, qualidade, correlações, riscos e recomendações.</p>
                  <Button onClick={generateAIAnalysis} disabled={isGeneratingAI} className="bg-accent text-accent-foreground hover:bg-accent/90">
                    {isGeneratingAI ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando dataset...</> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar EDA Completo</>}
                  </Button>
                </GlowCard>
              ) : (
                <GlowCard glowColor="accent">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /><h3 className="font-semibold text-foreground">Análise EDA</h3></div>
                    <Button onClick={generateAIAnalysis} disabled={isGeneratingAI} size="sm" variant="ghost" className="text-xs text-muted-foreground">
                      {isGeneratingAI ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Regenerando...</> : 'Regenerar'}
                    </Button>
                  </div>
                  <ReactMarkdown components={{
                    p: ({ children }) => <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{children}</p>,
                    h1: ({ children }) => <h1 className="text-xl font-bold text-foreground mb-3 mt-6">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mb-2 mt-5 pb-1 border-b border-border/30">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold text-accent mb-2 mt-4">{children}</h3>,
                    ul: ({ children }) => <ul className="list-disc ml-5 space-y-1 mb-3">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal ml-5 space-y-1 mb-3">{children}</ol>,
                    li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                    strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                    blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/40 pl-4 my-3 text-muted-foreground italic">{children}</blockquote>,
                    table: ({ children }) => <div className="overflow-x-auto mb-3"><table className="w-full text-xs border-collapse">{children}</table></div>,
                    th: ({ children }) => <th className="text-left p-2 border-b border-border text-foreground font-semibold bg-secondary/60">{children}</th>,
                    td: ({ children }) => <td className="p-2 border-b border-border/30 text-muted-foreground">{children}</td>,
                    code: ({ inline, children }) => inline ? <code className="px-1 py-0.5 rounded bg-secondary text-primary text-xs font-mono">{children}</code> : <pre className="bg-secondary/50 p-3 rounded-lg text-xs font-mono text-foreground overflow-x-auto mb-3">{children}</pre>,
                  }}>{aiAnalysis}</ReactMarkdown>
                </GlowCard>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}