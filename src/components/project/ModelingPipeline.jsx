import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import GlowCard from '@/components/ui/GlowCard';
import { toast } from 'sonner';
import {
  Database, FlaskConical, Brain, Cpu, BarChart3, ArrowRight,
  Pencil, Trash2, CheckCircle2, Target,
} from 'lucide-react';

const TYPE_LABEL = {
  classification: 'Classificação', regression: 'Regressão', clustering: 'Agrupamento',
  anomaly_detection: 'Detecção de Anomalias', dimensionality_reduction: 'Redução de Dimensionalidade',
  feature_selection: 'Seleção de Features', association_rules: 'Regras de Associação', exploration: 'Exploração',
};

export default function ModelingPipeline({ project, analyses = [] }) {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['analyses', project.id] });

  const rename = async (a) => {
    const novo = window.prompt('Novo nome da análise (a data permanece automática):', a.name);
    if (novo == null) return;
    const name = novo.trim();
    if (!name || name === a.name) return;
    await base44.entities.Analysis.update(a.id, { name });
    refresh();
    toast.success('Análise renomeada');
  };

  const remove = async (a) => {
    if (!window.confirm(`Excluir a análise "${a.name}"?`)) return;
    await base44.entities.Analysis.delete(a.id);
    refresh();
    toast.success('Análise removida');
  };

  const completed = analyses.filter((a) => a.status === 'completed');
  const models = completed.filter((a) => ['classification', 'regression'].includes(a.type));
  const targets = [...new Set(completed.map((a) => a.config?.target_column).filter(Boolean))];
  const techniques = [...new Set(completed.map((a) => TYPE_LABEL[a.type] || a.type))];

  const stages = [
    { icon: Database, label: 'Dataset', detail: `${project.dataset_size?.toLocaleString('pt-BR') || 0} linhas · ${project.dataset_columns || 0} colunas`, done: !!project.dataset_file_url },
    { icon: FlaskConical, label: 'Pré-processamento', detail: `${(project.prep_steps || []).length} etapa(s)`, done: (project.prep_steps || []).length > 0 },
    { icon: Brain, label: 'Feature Selection', detail: completed.some((a) => a.type === 'feature_selection') ? 'Executada' : 'Não executada', done: completed.some((a) => a.type === 'feature_selection') },
    { icon: Cpu, label: 'Modelagem', detail: `${models.length} modelo(s)`, done: models.length > 0 },
    { icon: BarChart3, label: 'Avaliação', detail: completed.length ? 'Métricas calculadas' : 'Pendente', done: completed.length > 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Pipeline */}
      <GlowCard>
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Cpu className="w-4 h-4 text-primary" /> Pipeline do Projeto
        </h3>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 sm:overflow-x-auto sm:pb-2">
          {stages.map((s, i) => (
            <React.Fragment key={s.label}>
              <div className={`flex-1 min-w-[150px] rounded-xl border p-3 text-center ${s.done ? 'border-primary/40 bg-primary/5' : 'border-border/40 bg-card/40'}`}>
                <s.icon className={`w-5 h-5 mx-auto mb-1.5 ${s.done ? 'text-primary' : 'text-muted-foreground'}`} />
                <p className="text-xs font-semibold text-foreground">{s.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.detail}</p>
                {s.done && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mx-auto mt-1.5" />}
              </div>
              {i < stages.length - 1 && (
                <ArrowRight className="w-4 h-4 text-muted-foreground mx-auto sm:mx-1 rotate-90 sm:rotate-0 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
      </GlowCard>

      {/* Modeling summary */}
      <GlowCard>
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-accent" /> Modelagem
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Análises concluídas" value={completed.length} />
          <Stat label="Modelos treinados" value={models.length} />
          <Stat label="Colunas-alvo" value={targets.length ? targets.join(', ') : '—'} />
          <Stat label="Status do projeto" value={project.status} />
        </div>
        {techniques.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/40">
            <p className="text-xs text-muted-foreground mb-2">Técnicas aplicadas</p>
            <div className="flex flex-wrap gap-2">
              {techniques.map((t) => (
                <span key={t} className="px-2.5 py-1 rounded-full text-xs bg-primary/10 text-primary border border-primary/20">{t}</span>
              ))}
            </div>
          </div>
        )}
      </GlowCard>

      {/* Analyses (rename / delete) */}
      <GlowCard>
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" /> Análises & Modelos
        </h3>
        {analyses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhuma análise ainda. Vá ao ML Studio para treinar modelos.
          </p>
        ) : (
          <div className="space-y-2">
            {analyses.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/40 bg-card/40 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{a.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {TYPE_LABEL[a.type] || a.type}
                    {a.config?.target_column ? ` · alvo: ${a.config.target_column}` : ''}
                    {a.created_date ? ` · ${new Date(a.created_date).toLocaleString('pt-BR')}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.status === 'completed' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-muted/30 text-muted-foreground'}`}>
                    {a.status}
                  </span>
                  <button onClick={() => rename(a)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition" title="Renomear">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(a)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition" title="Excluir">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlowCard>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-lg bg-card/40 border border-border/40 p-3">
      <p className="text-base font-bold text-foreground capitalize truncate">{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}
