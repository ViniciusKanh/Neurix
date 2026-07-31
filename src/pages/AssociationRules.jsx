import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import GlowCard from '@/components/ui/GlowCard';
import ReactMarkdown from 'react-markdown';
import { Network, Play, Loader2, Sparkles, ArrowRight, Database, Filter, Info, CheckCircle2, AlertTriangle, Save, History, Trash2, Lightbulb, ShoppingCart, XCircle, Gauge } from 'lucide-react';
import { assessAssociationSuitability } from '@/lib/localAssociation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Legend } from 'recharts';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const ALGORITHMS = ['Apriori', 'FP-Growth', 'Eclat', 'Closed Frequent Itemsets'];
const METRIC_KEYS = ['support', 'confidence', 'lift', 'leverage', 'conviction'];
const COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)'];
const TOOLTIP_STYLE = { background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };

const TABS = [
  { id: 'config', label: 'Configuração' },
  { id: 'aptidao', label: 'Aptidão da Base' },
  { id: 'rules', label: 'Regras Encontradas' },
  { id: 'interpretation', label: 'Interpretação' },
  { id: 'transform', label: 'Transformação de Dados' },
  { id: 'compare', label: 'Comparativo' },
  { id: 'ai', label: 'Análise' },
];

function LiftBadge({ lift }) {
  if (lift >= 3) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-400/10 text-emerald-400">🔥 Forte ({lift.toFixed(2)})</span>;
  if (lift >= 2) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary">✓ Boa ({lift.toFixed(2)})</span>;
  if (lift >= 1.2) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-400/10 text-amber-400">≈ Fraca ({lift.toFixed(2)})</span>;
  return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary text-muted-foreground">— Sem assoc.</span>;
}

function RuleCard({ rule, index }) {
  const [expanded, setExpanded] = useState(false);
  const antStr = (rule.antecedent || []).join(' + ');
  const conStr = (rule.consequent || []).join(' + ');
  const liftColor = rule.lift >= 3 ? 'text-emerald-400' : rule.lift >= 2 ? 'text-primary' : 'text-amber-400';

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.03 }}>
      <div className={cn('rounded-xl border p-4 transition-all cursor-pointer', expanded ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-card/60 hover:border-border/70')} onClick={() => setExpanded(!expanded)}>
        {/* Rule header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex flex-wrap gap-1">
              {(rule.antecedent || []).map((a, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-mono text-xs font-medium border border-primary/20">{a}</span>
              ))}
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex flex-wrap gap-1">
              {(rule.consequent || []).map((c, i) => (
                <span key={i} className="px-2 py-1 rounded-lg bg-accent/10 text-accent font-mono text-xs font-medium border border-accent/20">{c}</span>
              ))}
            </div>
          </div>
          <LiftBadge lift={rule.lift || 0} />
        </div>

        {/* Metrics row */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          {[
            { label: 'Suporte', value: (rule.support || 0).toFixed(3), color: 'text-muted-foreground' },
            { label: 'Confiança', value: `${((rule.confidence || 0) * 100).toFixed(1)}%`, color: 'text-foreground' },
            { label: 'Lift', value: (rule.lift || 0).toFixed(3), color: liftColor },
            { label: 'Conviction', value: (rule.conviction || 0).toFixed(2), color: 'text-muted-foreground' },
          ].map((m, i) => (
            <div key={i} className="text-center">
              <p className={cn('text-sm font-bold font-mono', m.color)}>{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
          <span className={cn('ml-auto text-[10px] px-1.5 py-0.5 rounded capitalize', rule.quality === 'high' ? 'bg-emerald-400/10 text-emerald-400' : rule.quality === 'medium' ? 'bg-amber-400/10 text-amber-400' : 'bg-secondary text-muted-foreground')}>
            {rule.quality || '—'}
          </span>
        </div>

        {/* Expanded interpretation */}
        {expanded && rule.interpretation && (
          <div className="mt-4 pt-3 border-t border-border/30">
            <p className="text-xs font-semibold text-accent mb-1 flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5" /> Por que essa regra ocorre?</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{rule.interpretation}</p>
          </div>
        )}
        {expanded && rule.practical_meaning && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-emerald-400 mb-1">Significado prático:</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{rule.practical_meaning}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SuitabilityPanel({ project }) {
  if (!project) {
    return <EmptyState icon={Database} title="Selecione um projeto" description="Escolha um projeto com dataset para avaliar a aptidão." />;
  }
  const a = assessAssociationSuitability(project);
  const color = a.score >= 80 ? 'text-emerald-400' : a.score >= 60 ? 'text-primary' : a.score >= 40 ? 'text-amber-400' : 'text-destructive';
  const ring = a.score >= 80 ? 'border-emerald-400/40' : a.score >= 60 ? 'border-primary/40' : a.score >= 40 ? 'border-amber-400/40' : 'border-destructive/40';

  return (
    <div className="space-y-4">
      <GlowCard className={cn('border', ring)}>
        <div className="flex items-center gap-4 flex-wrap">
          <div className={cn('w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center', ring)}>
            <span className={cn('text-2xl font-bold', color)}>{a.score}</span>
            <span className="text-[9px] text-muted-foreground">/100</span>
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <Gauge className={cn('w-5 h-5', color)} />
              <h3 className={cn('text-lg font-bold', color)}>{a.verdict}</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{a.verdict_detail}</p>
          </div>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mt-4 pt-4 border-t border-border/40">
          {[
            ['Linhas', a.stats.rows.toLocaleString('pt-BR')],
            ['Colunas', a.stats.total_cols],
            ['Categóricas', a.stats.cat_cols],
            ['Numéricas', a.stats.num_cols],
            ['Cardin. média', a.stats.avg_cardinality],
            ['Nulos médios', `${a.stats.avg_nulls}%`],
          ].map(([label, value]) => (
            <div key={label} className="text-center">
              <p className="text-sm font-semibold text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
            </div>
          ))}
        </div>
      </GlowCard>

      <GlowCard>
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-primary" /> Critérios avaliados</h3>
        <div className="space-y-2">
          {a.checks.map((c, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              {c.ok
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                : <XCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />}
              <span className={c.ok ? 'text-muted-foreground' : 'text-foreground'}>{c.text}</span>
            </div>
          ))}
        </div>
      </GlowCard>

      {a.recommendations.length > 0 && (
        <GlowCard glowColor="accent">
          <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-accent" /> Como deixar a base mais apta</h3>
          <ul className="space-y-1.5">
            {a.recommendations.map((r, i) => (
              <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" /> {r}
              </li>
            ))}
          </ul>
        </GlowCard>
      )}
    </div>
  );
}

export default function AssociationRules() {
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedProjectId, setSelectedProjectId] = useState(urlParams.get('project') || '');
  const [activeTab, setActiveTab] = useState('config');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAnalysisId, setSavedAnalysisId] = useState(null);

  const { data: savedAnalyses = [], refetch: refetchSaved } = useQuery({
    queryKey: ['association_analyses', selectedProjectId],
    queryFn: () => base44.entities.AssociationAnalysis.filter({ project_id: selectedProjectId }, '-created_date', 20),
    enabled: !!selectedProjectId,
  });

  const [minSupport, setMinSupport] = useState('0.05');
  const [minConfidence, setMinConfidence] = useState('0.3');
  const [minLift, setMinLift] = useState('1.0');
  const [selectedAlgorithms, setSelectedAlgorithms] = useState(['Apriori', 'FP-Growth']);
  const [maxRuleLen, setMaxRuleLen] = useState('4');
  const [filterItem, setFilterItem] = useState('');
  const [sortMetric, setSortMetric] = useState('lift');
  const [showRedundant, setShowRedundant] = useState(false);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 50) });
  const projectsWithData = projects.filter(p => p.dataset_file_url);
  const project = projectsWithData.find(p => p.id === selectedProjectId);

  const toggleAlgorithm = (alg) => setSelectedAlgorithms(prev => prev.includes(alg) ? prev.filter(a => a !== alg) : [...prev, alg]);

  const runAnalysis = async () => {
    if (!project) return toast.error('Selecione um projeto');
    if (selectedAlgorithms.length === 0) return toast.error('Selecione ao menos um algoritmo');
    setIsRunning(true);
    setResult(null);

    // Local association rules engine — no external API
    await new Promise(r => setTimeout(r, 1200));
    const { runLocalAssociation } = await import('@/lib/localAssociation');
    const res = runLocalAssociation(project, { minSupport: parseFloat(minSupport), minConfidence: parseFloat(minConfidence), minLift: parseFloat(minLift), algorithms: selectedAlgorithms, maxRuleLen: parseInt(maxRuleLen) });

    setResult(res);
    setSavedAnalysisId(null);
    setIsRunning(false);
    setActiveTab('rules');
    toast.success('Análise de regras concluída!');
  };

  const filteredRules = (result?.rules || [])
    .filter(r => !filterItem || r.antecedent?.some(a => a.toLowerCase().includes(filterItem.toLowerCase())) || r.consequent?.some(c => c.toLowerCase().includes(filterItem.toLowerCase())))
    .filter(r => showRedundant || !r.is_redundant)
    .filter(r => (r.support || 0) >= parseFloat(minSupport || 0))
    .filter(r => (r.confidence || 0) >= parseFloat(minConfidence || 0))
    .filter(r => (r.lift || 0) >= parseFloat(minLift || 0))
    .sort((a, b) => (b[sortMetric] || 0) - (a[sortMetric] || 0));

  const saveAnalysis = async () => {
    if (!result || !project) return;
    setIsSaving(true);
    const rules = result.rules || [];
    const highQ = rules.filter(r => r.quality === 'high');
    const avgLift = rules.length > 0 ? rules.reduce((s, r) => s + (r.lift || 0), 0) / rules.length : 0;
    const avgConf = rules.length > 0 ? rules.reduce((s, r) => s + (r.confidence || 0), 0) / rules.length : 0;
    const avgSup = rules.length > 0 ? rules.reduce((s, r) => s + (r.support || 0), 0) / rules.length : 0;
    const saved = await base44.entities.AssociationAnalysis.create({
      project_id: project.id, project_name: project.name,
      name: `Análise ${format(new Date(), 'dd/MM/yyyy HH:mm')} — sup:${minSupport} conf:${minConfidence}`,
      algorithms: selectedAlgorithms, min_support: parseFloat(minSupport), min_confidence: parseFloat(minConfidence),
      min_lift: parseFloat(minLift), max_rule_len: parseInt(maxRuleLen), total_rules: rules.length,
      high_quality_rules: highQ.length, avg_lift: avgLift, avg_confidence: avgConf, avg_support: avgSup, result: result,
    });
    setSavedAnalysisId(saved.id);
    refetchSaved();
    setIsSaving(false);
    toast.success('Análise salva!');
  };

  const loadSavedAnalysis = (saved) => {
    setResult(saved.result); setSavedAnalysisId(saved.id);
    setMinSupport(String(saved.min_support)); setMinConfidence(String(saved.min_confidence));
    setMinLift(String(saved.min_lift)); setSelectedAlgorithms(saved.algorithms || []);
    setActiveTab('rules');
    toast.success(`Análise carregada!`);
  };

  const deleteSavedAnalysis = async (id, e) => {
    e.stopPropagation();
    await base44.entities.AssociationAnalysis.delete(id);
    refetchSaved();
    toast.success('Análise removida');
  };

  return (
    <div>
      <PageHeader title="Regras de Associação"
        subtitle="Mineração de padrões frequentes com interpretações causais contextuais"
        actions={
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-56 bg-secondary/50"><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
            <SelectContent>{projectsWithData.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        }
      />

      {!project ? (
        <EmptyState icon={Network} title="Selecione um projeto" description="Escolha um projeto com dataset para iniciar a mineração de regras de associação" />
      ) : (
        <div className="space-y-5">
          <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg overflow-x-auto scrollbar-thin w-fit">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} disabled={tab.id !== 'config' && !result}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 whitespace-nowrap',
                  activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  tab.id !== 'config' && !result && 'opacity-40 cursor-not-allowed')}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* CONFIG */}
          {activeTab === 'config' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <GlowCard>
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Filter className="w-4 h-4 text-primary" /> Parâmetros de Mineração</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground">Suporte Mín.</Label>
                      <Input value={minSupport} onChange={e => setMinSupport(e.target.value)} className="mt-1 h-8 text-xs bg-background/50 font-mono" />
                      <p className="text-[10px] text-muted-foreground mt-0.5">0.0 – 1.0</p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Confiança Mín.</Label>
                      <Input value={minConfidence} onChange={e => setMinConfidence(e.target.value)} className="mt-1 h-8 text-xs bg-background/50 font-mono" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Lift Mín.</Label>
                      <Input value={minLift} onChange={e => setMinLift(e.target.value)} className="mt-1 h-8 text-xs bg-background/50 font-mono" />
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Tamanho Máximo da Regra</Label>
                    <Input value={maxRuleLen} onChange={e => setMaxRuleLen(e.target.value)} className="mt-1 h-8 text-xs bg-background/50 font-mono w-24" />
                  </div>
                </div>
              </GlowCard>

              <GlowCard>
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><Network className="w-4 h-4 text-primary" /> Algoritmos</h3>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {ALGORITHMS.map(alg => {
                    const isSel = selectedAlgorithms.includes(alg);
                    return (
                      <button key={alg} onClick={() => toggleAlgorithm(alg)}
                        className={cn('flex items-center gap-2 p-2.5 rounded-lg border text-xs text-left transition-all',
                          isSel ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/40 bg-secondary/30 text-muted-foreground hover:border-border')}>
                        <div className={cn('w-2 h-2 rounded-full flex-shrink-0', isSel ? 'bg-primary' : 'bg-border')} />
                        {alg}
                      </button>
                    );
                  })}
                </div>
                <Button onClick={runAnalysis} disabled={isRunning} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
                  {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executando Mineração...</> : <><Play className="w-4 h-4 mr-2" /> Executar Mineração de Regras</>}
                </Button>
              </GlowCard>

              <GlowCard className="lg:col-span-2">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Info className="w-4 h-4 text-accent" /> O que é uma Regra de Associação?</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground mb-4">
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="font-semibold text-foreground mb-1">Suporte</p>
                    <p>Frequência que o conjunto de itens aparece. <code className="text-primary">P(A∪B)</code>. Ex: leite+cerveja aparecem em 5% das compras.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="font-semibold text-foreground mb-1">Confiança</p>
                    <p>Probabilidade de B dado A. <code className="text-primary">P(B|A)</code>. Ex: 70% de quem compra leite, compra cerveja.</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <p className="font-semibold text-foreground mb-1">Lift {'>'} 1 = Associação Real</p>
                    <p>Quanto A e B co-ocorrem além do acaso. Lift=3 significa que ocorrem 3× mais juntos do que aleatoriamente.</p>
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                  <div className="flex items-center gap-2 mb-2"><ShoppingCart className="w-4 h-4 text-accent" /><p className="text-xs font-semibold text-accent">Exemplos reais de regras de associação:</p></div>
                  <div className="space-y-1.5 text-xs text-muted-foreground">
                    <p>🛒 <strong className="text-foreground">Leite → Cerveja</strong> — Lift: 2.3 — <em>Compras de família reunida: quem leva leite para os filhos leva cerveja para os adultos</em></p>
                    <p>🌤️ <strong className="text-foreground">Pressão Baixa + Umidade Alta → Chuva</strong> — Lift: 4.1 — <em>Condições meteorológicas clássicas que precedem chuva</em></p>
                    <p>💊 <strong className="text-foreground">Idade {'>'} 60 + Diabetes → Pressão Alta</strong> — Lift: 3.7 — <em>Comorbidades frequentes em pacientes idosos diabéticos</em></p>
                  </div>
                </div>
              </GlowCard>

              {/* Saved analyses */}
              {savedAnalyses.length > 0 && (
                <GlowCard className="lg:col-span-2">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><History className="w-4 h-4 text-primary" /> Análises Salvas ({savedAnalyses.length})</h3>
                  <div className="space-y-2">
                    {savedAnalyses.map(saved => (
                      <div key={saved.id} onClick={() => loadSavedAnalysis(saved)}
                        className={cn('flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all hover:border-primary/40',
                          savedAnalysisId === saved.id ? 'border-primary/60 bg-primary/5' : 'border-border/30 bg-secondary/20')}>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{saved.name}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                            <span>{saved.total_rules} regras</span><span>·</span>
                            <span>{saved.high_quality_rules} alta qualidade</span><span>·</span>
                            <span>Lift médio: {saved.avg_lift?.toFixed(2)}</span>
                          </div>
                        </div>
                        <button onClick={(e) => deleteSavedAnalysis(saved.id, e)} className="p-1 rounded text-muted-foreground hover:text-destructive ml-3">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}
            </div>
          )}

          {/* RULES */}
          {activeTab === 'aptidao' && (
            <SuitabilityPanel project={project} />
          )}

          {activeTab === 'rules' && result && (
            <div className="space-y-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground">{filteredRules.length} regras filtradas de {result.rules?.length || 0}</span>
                  {savedAnalysisId && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Salva</span>}
                </div>
                <Button onClick={saveAnalysis} disabled={isSaving || !!savedAnalysisId} size="sm" variant="outline" className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10">
                  {isSaving ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Salvando...</> : <><Save className="w-3 h-3 mr-1" /> Salvar Análise</>}
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Total de Regras', value: result.rules?.length || 0, color: 'text-primary' },
                  { label: 'Alta Qualidade', value: (result.rules || []).filter(r => r.quality === 'high').length, color: 'text-emerald-400' },
                  { label: 'Lift médio', value: (result.rules?.length ? (result.rules.reduce((s, r) => s + (r.lift || 0), 0) / result.rules.length).toFixed(2) : '—'), color: 'text-amber-400' },
                  { label: 'Filtradas (atual)', value: filteredRules.length, color: 'text-accent' },
                ].map((s, i) => (
                  <GlowCard key={i} className="text-center py-3" hover={false}>
                    <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
                  </GlowCard>
                ))}
              </div>

              <GlowCard>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Filtrar por item</Label>
                    <Input value={filterItem} onChange={e => setFilterItem(e.target.value)} className="mt-1 h-7 text-xs w-36 bg-background/50" placeholder="ex: produto A" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-muted-foreground">Ordenar por</Label>
                    <Select value={sortMetric} onValueChange={setSortMetric}>
                      <SelectTrigger className="mt-1 h-7 text-xs w-32 bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>{METRIC_KEYS.map(k => <SelectItem key={k} value={k} className="text-xs">{k}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground">
                    <input type="checkbox" checked={showRedundant} onChange={e => setShowRedundant(e.target.checked)} className="rounded" />
                    Mostrar redundantes
                  </label>
                </div>
              </GlowCard>

              {/* Rule cards */}
              <div className="space-y-3">
                {filteredRules.slice(0, 30).map((rule, i) => <RuleCard key={rule.id || i} rule={rule} index={i} />)}
                {filteredRules.length > 30 && <p className="text-xs text-muted-foreground text-center py-2">Mostrando 30 de {filteredRules.length} regras. Use filtros para refinar.</p>}
                {filteredRules.length === 0 && <div className="text-center py-8 text-muted-foreground text-xs">Nenhuma regra com os filtros atuais</div>}
              </div>

              {filteredRules.length > 0 && (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-4 text-sm">Suporte × Confiança × Lift</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" />
                        <XAxis dataKey="support" name="Suporte" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} label={{ value: 'Suporte', position: 'insideBottom', offset: -2, fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                        <YAxis dataKey="confidence" name="Confiança" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} label={{ value: 'Confiança', angle: -90, position: 'insideLeft', fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [typeof v === 'number' ? v.toFixed(3) : v, n]} />
                        <Scatter data={filteredRules.slice(0, 100).map(r => ({ support: r.support, confidence: r.confidence, lift: r.lift }))} fill="hsl(187,92%,55%)" fillOpacity={0.6} />
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                </GlowCard>
              )}

              {result.key_insights?.length > 0 && (
                <GlowCard glowColor="accent">
                  <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Principais Insights</h3>
                  <div className="space-y-2">
                    {result.key_insights.map((insight, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <span className="text-accent font-bold flex-shrink-0">{i + 1}.</span><span>{insight}</span>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}
            </div>
          )}

          {/* INTERPRETATION */}
          {activeTab === 'interpretation' && result && (
            <div className="space-y-5">
              {result.interpretation_summary && (
                <GlowCard glowColor="accent" className="border-accent/30">
                  <div className="flex items-center gap-2 mb-3"><Lightbulb className="w-5 h-5 text-accent" /><h3 className="font-semibold text-foreground">Narrativa Geral das Regras</h3></div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{result.interpretation_summary}</p>
                </GlowCard>
              )}

              {result.rule_clusters?.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.rule_clusters.map((cluster, i) => (
                    <GlowCard key={i} className="border-border/40">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <h4 className="text-sm font-semibold text-foreground">{cluster.name}</h4>
                        <span className="ml-auto text-xs font-mono text-muted-foreground">{cluster.rules_count} regras · lift médio: {cluster.avg_lift?.toFixed(2)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed">{cluster.description}</p>
                      {cluster.example_rule && (
                        <div className="p-2 rounded-lg bg-secondary/40 text-xs font-mono text-primary">Exemplo: {cluster.example_rule}</div>
                      )}
                    </GlowCard>
                  ))}
                </div>
              )}

              <GlowCard>
                <h3 className="font-semibold text-foreground mb-4 text-sm flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-400" /> Regras com Interpretação Contextual (Top 10 por Lift)</h3>
                <div className="space-y-3">
                  {filteredRules.slice(0, 10).map((rule, i) => (
                    <div key={i} className="p-4 rounded-xl bg-secondary/30 border border-border/30">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <div className="flex flex-wrap gap-1">
                          {(rule.antecedent || []).map((a, j) => <span key={j} className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">{a}</span>)}
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                        <div className="flex flex-wrap gap-1">
                          {(rule.consequent || []).map((c, j) => <span key={j} className="px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-mono">{c}</span>)}
                        </div>
                        <LiftBadge lift={rule.lift || 0} />
                      </div>
                      {rule.interpretation && (
                        <p className="text-xs text-muted-foreground mt-2"><span className="text-amber-400 font-semibold">🔍 Por quê ocorre: </span>{rule.interpretation}</p>
                      )}
                      {rule.practical_meaning && (
                        <p className="text-xs text-muted-foreground mt-1"><span className="text-emerald-400 font-semibold">💡 Aplicação prática: </span>{rule.practical_meaning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </GlowCard>

              {result.practical_applications?.length > 0 && (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-3 text-sm">Aplicações Práticas</h3>
                  <div className="space-y-2">
                    {result.practical_applications.map((app, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/30 text-xs text-muted-foreground">
                        <span className="text-primary font-bold flex-shrink-0">→</span><span>{app}</span>
                      </div>
                    ))}
                  </div>
                </GlowCard>
              )}
            </div>
          )}

          {/* TRANSFORM */}
          {activeTab === 'transform' && result && (
            <div className="space-y-5">
              <GlowCard className={cn(result.dataset_is_transactional ? 'border-emerald-400/30' : 'border-amber-400/30')}>
                <div className="flex items-center gap-3">
                  {result.dataset_is_transactional ? <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />}
                  <div>
                    <p className="font-semibold text-foreground text-sm">{result.dataset_is_transactional ? 'Dataset já está em formato transacional' : 'Transformação necessária'}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{result.original_structure?.description}</p>
                  </div>
                </div>
              </GlowCard>
              <GlowCard>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Estrutura Original</h3>
                <p className="text-xs text-muted-foreground mb-2"><strong className="text-foreground">Definição de transação:</strong> {result.transaction_definition}</p>
                {result.sample_transactions?.length > 0 && (
                  <div className="space-y-1.5">
                    {result.sample_transactions.map((tx, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded bg-secondary/40 text-xs font-mono text-muted-foreground">
                        <span className="text-emerald-400 flex-shrink-0">T{i + 1}</span><span>{tx}</span>
                      </div>
                    ))}
                  </div>
                )}
              </GlowCard>
              {result.transformation_steps?.length > 0 && (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" /> Etapas de Transformação</h3>
                  <div className="space-y-3">
                    {result.transformation_steps.map((step, i) => (
                      <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="flex gap-3">
                        <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                        <div className="flex-1 p-3 rounded-lg bg-secondary/30 border border-border/30">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-xs font-semibold text-foreground">{step.name}</p>
                            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-[10px] text-primary font-mono">{step.technique}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{step.description}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </GlowCard>
              )}
            </div>
          )}

          {/* COMPARE */}
          {activeTab === 'compare' && result && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(result.algorithms_results || []).map((alg, i) => (
                  <GlowCard key={i}>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <h3 className="font-semibold text-foreground text-sm">{alg.algorithm}</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      {[{ label: 'Itemsets', value: alg.frequent_itemsets_found }, { label: 'Regras', value: alg.rules_generated }, { label: 'Lift Médio', value: alg.avg_lift?.toFixed(2) }].map((stat, j) => (
                        <div key={j} className="text-center p-2 rounded bg-secondary/30">
                          <p className="text-base font-bold font-mono" style={{ color: COLORS[i % COLORS.length] }}>{stat.value ?? '—'}</p>
                          <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{alg.execution_notes}</p>
                  </GlowCard>
                ))}
              </div>
              {(result.algorithms_results || []).length > 0 && (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-4 text-sm">Comparativo de Algoritmos</h3>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.algorithms_results || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                        <XAxis dataKey="algorithm" tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                        <YAxis tick={{ fontSize: 9, fill: 'hsl(215,20%,55%)' }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Legend wrapperStyle={{ fontSize: '10px' }} />
                        <Bar dataKey="rules_generated" name="Regras Geradas" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
                        <Bar dataKey="frequent_itemsets_found" name="Itemsets Frequentes" fill={COLORS[1]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </GlowCard>
              )}
              {/* Saved comparison */}
              {savedAnalyses.length >= 2 && (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-3 text-sm">Comparativo entre Análises Salvas</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-secondary/60">
                          {['Análise', 'Suporte', 'Confiança', 'Lift', 'Total Regras', 'Alta Qualidade', 'Lift Médio'].map(h => (
                            <th key={h} className="text-left p-2 text-muted-foreground font-semibold border-b border-border/40 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {savedAnalyses.map((saved, i) => (
                          <tr key={saved.id} className={cn('hover:bg-secondary/40 cursor-pointer', i % 2 === 0 ? 'bg-secondary/10' : '')} onClick={() => loadSavedAnalysis(saved)}>
                            <td className="p-2 border-b border-border/10 text-foreground font-medium max-w-xs truncate">{saved.name}</td>
                            <td className="p-2 border-b border-border/10 font-mono text-muted-foreground">{saved.min_support}</td>
                            <td className="p-2 border-b border-border/10 font-mono text-muted-foreground">{saved.min_confidence}</td>
                            <td className="p-2 border-b border-border/10 font-mono text-muted-foreground">{saved.min_lift}</td>
                            <td className="p-2 border-b border-border/10 font-mono text-primary">{saved.total_rules}</td>
                            <td className="p-2 border-b border-border/10 font-mono text-emerald-400">{saved.high_quality_rules}</td>
                            <td className="p-2 border-b border-border/10 font-mono font-bold text-amber-400">{saved.avg_lift?.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlowCard>
              )}
            </div>
          )}

          {/* AI */}
          {activeTab === 'ai' && result && (
            <GlowCard glowColor="accent">
              <div className="flex items-center gap-2 mb-4"><Network className="w-4 h-4 text-accent" /><h3 className="font-semibold text-foreground">Análise Interpretativa</h3></div>
              <ReactMarkdown components={{
                p: ({ children }) => <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{children}</p>,
                h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mb-2 mt-5">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-accent mb-2 mt-4">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc ml-5 space-y-1 mb-3">{children}</ul>,
                li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                blockquote: ({ children }) => <blockquote className="border-l-2 border-accent/30 pl-4 my-3 text-muted-foreground">{children}</blockquote>,
              }}>{result.ai_analysis || ''}</ReactMarkdown>
            </GlowCard>
          )}
        </div>
      )}
    </div>
  );
}