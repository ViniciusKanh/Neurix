import React from 'react';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  draft:      'bg-secondary/60 text-muted-foreground border-border/50',
  exploring:  'bg-primary/10 text-primary border-primary/30',
  modeling:   'bg-accent/10 text-accent border-accent/30',
  completed:  'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  running:    'bg-primary/12 text-primary border-primary/40',
  pending:    'bg-amber-400/10 text-amber-400 border-amber-400/30',
  failed:     'bg-destructive/10 text-destructive border-destructive/30',
  active:     'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  inactive:   'bg-secondary/60 text-muted-foreground border-border/50',
  deploying:  'bg-primary/12 text-primary border-primary/40',
};

const LABELS = {
  draft: 'Rascunho', exploring: 'Explorando', modeling: 'Modelando', completed: 'Concluído',
  running: 'Executando', pending: 'Pendente', failed: 'Falhou', active: 'Ativo',
  inactive: 'Inativo', deploying: 'Publicando',
};

const PULSE = { running: true, deploying: true };
const DOT = { running: true, active: true, deploying: true, completed: true };

export default function StatusBadge({ status }) {
  const key = status || 'draft';
  const style = STATUS_STYLES[key] || STATUS_STYLES.draft;
  const label = LABELS[key] || (status ? status.replace(/_/g, ' ') : 'Rascunho');
  const dotColor = key === 'completed' || key === 'active' ? 'bg-emerald-400'
    : key === 'failed' ? 'bg-destructive' : key === 'pending' ? 'bg-amber-400' : 'bg-primary';

  return (
    <span className={cn('inline-flex items-center gap-1.5 pl-1.5 pr-2 py-0.5 rounded-full border text-[10px] font-semibold', style)}>
      {DOT[key] && (
        <span className="relative flex w-1.5 h-1.5">
          {PULSE[key] && <span className={cn('absolute inset-0 rounded-full animate-ping opacity-70', dotColor)} />}
          <span className={cn('relative w-1.5 h-1.5 rounded-full', dotColor)} />
        </span>
      )}
      {label}
    </span>
  );
}
