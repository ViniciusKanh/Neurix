import React from 'react';
import { cn } from '@/lib/utils';

const STATUS_STYLES = {
  draft:      'bg-secondary/60 text-muted-foreground border-border/40',
  exploring:  'bg-primary/10 text-primary border-primary/30',
  modeling:   'bg-accent/10 text-accent border-accent/30',
  completed:  'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  running:    'bg-primary/15 text-primary border-primary/40 animate-pulse',
  pending:    'bg-amber-400/10 text-amber-400 border-amber-400/30',
  failed:     'bg-destructive/10 text-destructive border-destructive/30',
  active:     'bg-emerald-400/10 text-emerald-400 border-emerald-400/30',
  inactive:   'bg-secondary/60 text-muted-foreground border-border/40',
  deploying:  'bg-primary/15 text-primary border-primary/40 animate-pulse',
};

const STATUS_DOT = {
  running: true, active: true, deploying: true, completed: true,
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] || STATUS_STYLES.draft;
  const label = status ? status.replace(/_/g, ' ').toUpperCase() : 'DRAFT';
  const hasDot = STATUS_DOT[status];

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[9px] font-bold font-mono uppercase tracking-wider',
      style
    )}>
      {hasDot && <span className={cn('w-1 h-1 rounded-full flex-shrink-0',
        status === 'completed' || status === 'active' ? 'bg-emerald-400' :
        status === 'failed' ? 'bg-destructive' : 'bg-primary'
      )} />}
      {label}
    </span>
  );
}