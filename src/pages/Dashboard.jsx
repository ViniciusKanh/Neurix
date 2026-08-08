import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  FolderOpen, Database, Brain, BarChart3, Cpu, Zap, Plus, Activity,
  TrendingUp, ArrowRight, Rocket, Network, FlaskConical, FileText, Sparkles, Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';
import GlowCard from '@/components/ui/GlowCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useAuth } from '@/lib/AuthContext';
import { ModaraLogoMark } from '@/components/layout/ModaraLogo';

const TYPE_META = {
  classification: { label: 'Classificação', color: 'hsl(185,100%,50%)' },
  regression: { label: 'Regressão', color: 'hsl(160,100%,45%)' },
  clustering: { label: 'Agrupamento', color: 'hsl(265,90%,65%)' },
  association_rules: { label: 'Regras de Assoc.', color: 'hsl(40,100%,55%)' },
  anomaly_detection: { label: 'Anomalias', color: 'hsl(330,90%,60%)' },
  dimensionality_reduction: { label: 'Redução Dim.', color: 'hsl(210,90%,60%)' },
  feature_selection: { label: 'Feature Selection', color: 'hsl(150,80%,55%)' },
  exploration: { label: 'Exploração', color: 'hsl(50,90%,55%)' },
};

const fmtDate = (d) => { try { return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }); } catch { return '—'; } };

export default function Dashboard() {
  const { user } = useAuth();

  const { data: projects = [], isLoading: lp } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const { data: analyses = [], isLoading: la } = useQuery({ queryKey: ['analyses'], queryFn: () => base44.entities.Analysis.list('-updated_date', 200) });

  if (lp || la) return <LoadingSpinner text="Carregando painel..." />;

  const completedAnalyses = analyses.filter((a) => a.status === 'completed');
  const models = completedAnalyses.filter((a) => ['classification', 'regression'].includes(a.type));
  const datasets = projects.filter((p) => p.dataset_file_url);

  const byType = {};
  completedAnalyses.forEach((a) => { byType[a.type] = (byType[a.type] || 0) + 1; });
  const typeEntries = Object.entries(byType).sort((x, y) => y[1] - x[1]);
  const maxType = Math.max(1, ...typeEntries.map(([, v]) => v));

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  const firstName = (user?.full_name || user?.email || '').split(' ')[0].split('@')[0];

  const kpis = [
    { icon: FolderOpen, label: 'Projetos', value: projects.length, sub: `${projects.filter((p) => p.status === 'completed').length} concluídos`, to: '/projects', grad: 'from-primary to-accent' },
    { icon: Database, label: 'Datasets', value: datasets.length, sub: 'com dados', to: '/explorer', grad: 'from-accent to-primary' },
    { icon: Brain, label: 'Análises', value: completedAnalyses.length, sub: `${analyses.length} no total`, to: '/ml-studio', grad: 'from-primary to-accent' },
    { icon: Cpu, label: 'Modelos', value: models.length, sub: 'treinados', to: '/deploy', grad: 'from-accent to-primary' },
  ];

  const quick = [
    { icon: Plus, label: 'Novo Projeto', to: '/projects/new' },
    { icon: Brain, label: 'ML Studio', to: '/ml-studio' },
    { icon: BarChart3, label: 'Explorador', to: '/explorer' },
    { icon: Zap, label: 'AutoML', to: '/automl' },
    { icon: Network, label: 'Regras Assoc.', to: '/association-rules' },
    { icon: TrendingUp, label: 'Séries Temp.', to: '/time-series' },
    { icon: Rocket, label: 'Deploy', to: '/deploy' },
    { icon: Activity, label: 'Monitoramento', to: '/monitoring' },
    { icon: FlaskConical, label: 'Testes A/B', to: '/ab-test' },
    { icon: FileText, label: 'Relatórios', to: '/reports' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 glass-strong hud-corners">
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-40" />
        <div className="pointer-events-none absolute -right-10 -top-16 w-72 h-72 rounded-full bg-primary/15 blur-[90px]" />
        <div className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.07] hidden md:block"><ModaraLogoMark size={200} /></div>
        <div className="relative p-6 sm:p-8">
          <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> Painel · Neurix
          </p>
          <h1 className="mt-2 text-2xl sm:text-3xl font-display font-extrabold tracking-tight">
            {greeting}{firstName ? ', ' : ''}<span className="text-gradient-primary">{firstName}</span> 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-lg">
            Sua workbench de Machine Learning 100% local. {projects.length ? `${projects.length} projeto(s), ${models.length} modelo(s) treinado(s).` : 'Comece criando seu primeiro projeto.'}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Link to="/projects/new" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold py-2.5 px-5 text-sm hover:opacity-90 glow-primary">
              <Plus className="w-4 h-4" /> Novo Projeto
            </Link>
            <Link to="/ml-studio" className="inline-flex items-center gap-2 rounded-xl border border-border/60 py-2.5 px-5 text-sm text-foreground hover:border-primary/50 hover:text-primary transition">
              <Brain className="w-4 h-4" /> Treinar modelo
            </Link>
            <span className="ml-auto text-[11px] font-mono text-muted-foreground flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
            </span>
          </div>
        </div>
      </div>

      {/* Guided start (no projects yet) */}
      {projects.length === 0 && (
        <GlowCard glowColor="accent">
          <h3 className="font-semibold text-sm mb-1 flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Comece em 3 passos</h3>
          <p className="text-xs text-muted-foreground mb-4">Do dataset ao modelo avaliado — tudo local, sem enviar seus dados para servidores.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { n: 1, icon: Database, title: 'Importe seu dataset', desc: 'Crie um projeto e envie um CSV/Excel. Os dados ficam no seu dispositivo.', to: '/projects/new', cta: 'Criar projeto' },
              { n: 2, icon: Brain, title: 'Treine modelos', desc: 'No ML Studio, escolha a coluna-alvo e treine vários modelos de verdade.', to: '/ml-studio', cta: 'Abrir ML Studio' },
              { n: 3, icon: FlaskConical, title: 'Avalie e simule', desc: 'Use o Laboratório do Modelo: ROC, threshold, importância e what-if.', to: '/model-lab', cta: 'Laboratório' },
            ].map((s) => (
              <Link key={s.n} to={s.to}>
                <div className="group h-full rounded-xl border border-border/50 bg-card/50 p-4 hover:border-primary/50 hover:bg-primary/5 transition-all">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="w-6 h-6 rounded-full bg-primary/15 text-primary text-xs font-bold flex items-center justify-center">{s.n}</span>
                    <s.icon className="w-4 h-4 text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{s.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1 mb-3 leading-relaxed">{s.desc}</p>
                  <span className="text-xs text-primary inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">{s.cta} <ArrowRight className="w-3 h-3" /></span>
                </div>
              </Link>
            ))}
          </div>
        </GlowCard>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <motion.div key={k.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Link to={k.to}>
              <div className="group relative overflow-hidden rounded-xl glass border border-border/60 p-4 hover:border-primary/40 transition-all h-full">
                <div className="pointer-events-none absolute -right-6 -bottom-6 w-20 h-20 rounded-full bg-primary/5 group-hover:bg-primary/10 blur-xl transition" />
                <div className="flex items-center justify-between">
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${k.grad} flex items-center justify-center text-primary-foreground shadow-lg`}>
                    <k.icon className="w-5 h-5" />
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition" />
                </div>
                <p className="mt-3 text-3xl font-bold font-mono tracking-tight text-foreground">{k.value}</p>
                <p className="text-xs text-foreground/80">{k.label}</p>
                <p className="text-[10px] text-primary/60">{k.sub}</p>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Activity + Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent projects */}
        <GlowCard className="lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><FolderOpen className="w-4 h-4 text-primary" /> Projetos recentes</h3>
            <Link to="/projects" className="text-xs text-primary hover:underline flex items-center gap-1">Ver todos <ArrowRight className="w-3 h-3" /></Link>
          </div>
          {projects.length === 0 ? (
            <div className="text-center py-10">
              <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum projeto ainda.</p>
              <Link to="/projects/new" className="text-xs text-primary hover:underline">Criar o primeiro →</Link>
            </div>
          ) : (
            <div className="space-y-1.5">
              {projects.slice(0, 6).map((p) => {
                const nA = completedAnalyses.filter((a) => a.project_id === p.id).length;
                return (
                  <Link key={p.id} to={`/projects/${p.id}`}>
                    <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-primary/5 border border-transparent hover:border-primary/20 transition">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Database className="w-4 h-4 text-primary" /></div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-foreground">{p.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {p.dataset_columns ? `${p.dataset_columns} colunas · ${(p.dataset_size || 0).toLocaleString('pt-BR')} linhas` : 'Sem dataset'} · {nA} análise(s)
                        </p>
                      </div>
                      <span className={`text-[9px] px-2 py-0.5 rounded-full flex-shrink-0 ${p.status === 'completed' ? 'bg-accent/15 text-accent' : 'bg-muted/30 text-muted-foreground'}`}>{p.status}</span>
                      <span className="text-[10px] text-muted-foreground font-mono hidden sm:block flex-shrink-0">{fmtDate(p.updated_date)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </GlowCard>

        {/* Distribution by type */}
        <GlowCard>
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3"><BarChart3 className="w-4 h-4 text-accent" /> Análises por tipo</h3>
          {typeEntries.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8 text-center">Nenhuma análise concluída ainda.</p>
          ) : (
            <div className="space-y-3">
              {typeEntries.map(([type, count]) => {
                const meta = TYPE_META[type] || { label: type, color: 'hsl(210,20%,55%)' };
                return (
                  <div key={type}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-foreground/80">{meta.label}</span>
                      <span className="font-mono text-muted-foreground">{count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-background/60 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(count / maxType) * 100}%` }} transition={{ duration: 0.6 }} className="h-full rounded-full" style={{ background: meta.color, boxShadow: `0 0 10px ${meta.color}` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlowCard>
      </div>

      {/* Quick actions */}
      <div>
        <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider mb-3">Ações rápidas</p>
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2.5">
          {quick.map((q) => (
            <Link key={q.to} to={q.to}>
              <motion.div whileHover={{ y: -3 }} className="flex flex-col items-center gap-2 p-3 rounded-xl border border-border/40 bg-card/50 hover:border-primary/50 hover:bg-primary/5 hover:text-primary text-muted-foreground transition-all cursor-pointer h-full">
                <q.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium text-center leading-tight">{q.label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent analyses */}
      {completedAnalyses.length > 0 && (
        <GlowCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Análises recentes</h3>
            <Link to="/ml-studio" className="text-xs text-primary hover:underline flex items-center gap-1">Ver no ML Studio <ArrowRight className="w-3 h-3" /></Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {completedAnalyses.slice(0, 6).map((a) => {
              const meta = TYPE_META[a.type] || { label: a.type, color: 'hsl(210,20%,55%)' };
              const proj = projects.find((p) => p.id === a.project_id);
              const m = a.results?.metrics || {};
              const primary = m.accuracy ?? m.f1_score ?? m.r2_score ?? m.r2;
              return (
                <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-card/40">
                  <span className="w-2 h-8 rounded-full flex-shrink-0" style={{ background: meta.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">{a.name}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{meta.label}{proj ? ` · ${proj.name}` : ''}</p>
                  </div>
                  {primary != null && <span className="text-xs font-mono text-primary flex-shrink-0">{(primary * 100).toFixed(1)}%</span>}
                </div>
              );
            })}
          </div>
        </GlowCard>
      )}
    </motion.div>
  );
}
