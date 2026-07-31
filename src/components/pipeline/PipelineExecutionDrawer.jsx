// Execution history drawer below the canvas — shows step-by-step status, timing, error logs
import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { NODE_TYPES } from './NodeTypes';
import {
  CheckCircle2, XCircle, Loader2, Clock, AlertTriangle,
  ChevronDown, ChevronUp, ChevronRight, Terminal,
  FileText, Zap, BarChart2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_CFG = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/25', dot: 'bg-emerald-400', label: 'OK' },
  failed:  { icon: XCircle,      color: 'text-red-400',     bg: 'bg-red-400/10',     border: 'border-red-400/25',     dot: 'bg-red-400',     label: 'Erro' },
  running: { icon: Loader2,      color: 'text-primary',     bg: 'bg-primary/10',     border: 'border-primary/25',     dot: 'bg-primary',     label: 'Run', spin: true },
  pending: { icon: Clock,        color: 'text-muted-foreground', bg: 'bg-secondary/10', border: 'border-border/20',  dot: 'bg-muted-foreground/30', label: '...' },
  timeout: { icon: AlertTriangle,color: 'text-amber-400',   bg: 'bg-amber-400/10',   border: 'border-amber-400/25',   dot: 'bg-amber-400',   label: 'Timeout' },
};

function StepRow({ log, index, total }) {
  const [open, setOpen] = useState(log.status === 'failed');
  const sc = STATUS_CFG[log.status] || STATUS_CFG.pending;
  const Icon = sc.icon;
  const isLast = index === total - 1;

  return (
    <div className="flex gap-2">
      {/* Timeline */}
      <div className="flex flex-col items-center flex-shrink-0 w-5">
        <div className={cn('w-2.5 h-2.5 rounded-full border-2 mt-2.5 flex-shrink-0 transition-all', sc.dot,
          log.status === 'running' && 'animate-pulse border-primary/40',
          log.status !== 'running' && 'border-transparent'
        )} />
        {!isLast && <div className="w-px flex-1 bg-border/25 mt-1" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 mb-2 rounded-lg border transition-all overflow-hidden', sc.border, open ? sc.bg : 'bg-transparent hover:bg-secondary/10')}>
        <button className="w-full flex items-center gap-2 px-3 py-2 text-left" onClick={() => setOpen(v => !v)}>
          <Icon className={cn('w-3 h-3 flex-shrink-0', sc.color, sc.spin && 'animate-spin')} />
          <span className="text-[10px] font-semibold text-foreground flex-1 truncate">
            {log.node_name || NODE_TYPES[log.node_type]?.label || log.node_type}
          </span>
          <span className="text-[8px] font-mono text-muted-foreground/50 flex-shrink-0">{NODE_TYPES[log.node_type]?.label || log.node_type}</span>
          {log.duration_ms != null && (
            <span className="text-[8px] font-mono text-muted-foreground/60 flex-shrink-0 flex items-center gap-0.5">
              <Zap className="w-2 h-2" />{log.duration_ms}ms
            </span>
          )}
          {log.rows_in != null && (
            <span className="text-[8px] font-mono text-muted-foreground/40 flex-shrink-0">{log.rows_in}→{log.rows_out}</span>
          )}
          <span className={cn('text-[7px] font-bold px-1 py-0.5 rounded flex-shrink-0', sc.bg, sc.color)}>{sc.label}</span>
          {open ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-3 pb-3 space-y-2 border-t border-border/15 pt-2">
                {/* Timings */}
                <div className="flex gap-4 text-[8px] font-mono text-muted-foreground/60 flex-wrap">
                  {log.started_at && <span>Início: {new Date(log.started_at).toLocaleTimeString('pt-BR')}</span>}
                  {log.finished_at && <span>Fim: {new Date(log.finished_at).toLocaleTimeString('pt-BR')}</span>}
                  {log.duration_ms != null && <span className="text-primary/50">⏱ {log.duration_ms}ms</span>}
                </div>

                {/* Row stats */}
                {log.rows_in != null && (
                  <div className="flex gap-3 text-[9px] font-mono flex-wrap">
                    <span className="text-muted-foreground">Entrada: <span className="text-primary">{log.rows_in?.toLocaleString()}</span> linhas</span>
                    <span className="text-muted-foreground">Saída: <span className="text-accent">{log.rows_out?.toLocaleString()}</span> linhas</span>
                    {log.rows_in > 0 && log.rows_out < log.rows_in && (
                      <span className="text-amber-400">▼ {(log.rows_in - log.rows_out).toLocaleString()} removidas</span>
                    )}
                  </div>
                )}

                {/* Log output */}
                {log.log && (
                  <div>
                    <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <Terminal className="w-2.5 h-2.5" /> Saída do nó
                    </p>
                    <pre className="text-[9px] font-mono text-muted-foreground bg-secondary/20 rounded p-2 whitespace-pre-wrap break-words leading-relaxed border border-border/15 max-h-32 overflow-y-auto scrollbar-thin">
                      {log.log}
                    </pre>
                  </div>
                )}

                {/* Error */}
                {log.error && (
                  <div>
                    <p className="text-[8px] text-red-400/70 uppercase tracking-wider mb-1 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" /> Erro detalhado
                    </p>
                    <pre className="text-[9px] font-mono text-red-300 bg-red-400/10 rounded p-2 whitespace-pre-wrap break-words border border-red-400/20 max-h-24 overflow-y-auto scrollbar-thin">
                      {log.error}
                    </pre>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function PipelineExecutionDrawer({ progress, nodes, isOpen, onToggle }) {
  if (!progress) return null;

  const { status, nodeLogs = [], nodeIndex, total } = progress;
  const pct = total ? Math.round(((nodeIndex || 0) / total) * 100) : (status === 'success' ? 100 : 0);
  const successCount = nodeLogs.filter(l => l.status === 'success').length;
  const failedCount = nodeLogs.filter(l => l.status === 'failed').length;
  const totalDuration = nodeLogs.reduce((s, l) => s + (l.duration_ms || 0), 0);

  // Pending nodes (not yet run)
  const pendingNodes = nodes ? nodes.slice(nodeLogs.length) : [];

  const statusColor = {
    running: 'text-primary border-primary/30 bg-primary/5',
    success: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5',
    failed:  'text-red-400 border-red-400/30 bg-red-400/5',
    timeout: 'text-amber-400 border-amber-400/30 bg-amber-400/5',
  }[status] || 'text-muted-foreground border-border/20';

  return (
    <div className="flex-shrink-0 border-t border-border/20 bg-card/40 backdrop-blur-sm">
      {/* Drawer toggle header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2 flex-1">
          <Terminal className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold text-foreground tracking-wide uppercase">Histórico de Execução</span>
          <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded border', statusColor)}>
            {status === 'running' ? `${pct}%` : status?.toUpperCase()}
          </span>

          {/* Summary pills */}
          <div className="flex items-center gap-2 ml-2">
            <span className="text-[8px] font-mono text-muted-foreground/60 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{successCount} OK
            </span>
            {failedCount > 0 && (
              <span className="text-[8px] font-mono text-red-400/80 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{failedCount} erro
              </span>
            )}
            {totalDuration > 0 && (
              <span className="text-[8px] font-mono text-muted-foreground/40 flex items-center gap-1">
                <Zap className="w-2 h-2" />{totalDuration > 1000 ? `${(totalDuration / 1000).toFixed(1)}s` : `${totalDuration}ms`}
              </span>
            )}
          </div>
        </div>

        {/* Progress bar (compact) */}
        <div className="w-32 h-1 rounded-full bg-secondary/40 overflow-hidden flex-shrink-0">
          <motion.div
            className={cn('h-full rounded-full', {
              'bg-primary': status === 'running',
              'bg-emerald-400': status === 'success',
              'bg-red-400': status === 'failed',
              'bg-amber-400': status === 'timeout',
            })}
            initial={{ width: 0 }}
            animate={{ width: `${status === 'success' ? 100 : pct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <span className="text-[8px] font-mono text-muted-foreground/40">{nodeLogs.length}/{total || 0}</span>
        {isOpen
          ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        }
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 280, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="h-[280px] overflow-y-auto scrollbar-thin px-4 py-3">
              {/* All logged nodes */}
              {nodeLogs.map((log, i) => (
                <StepRow key={log.node_id || i} log={log} index={i} total={nodeLogs.length + pendingNodes.length} />
              ))}

              {/* Pending nodes (greyed out) */}
              {status === 'running' && pendingNodes.map((n, i) => (
                <div key={n.id} className="flex gap-2">
                  <div className="flex flex-col items-center flex-shrink-0 w-5">
                    <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/15 mt-2.5 flex-shrink-0" />
                    {i < pendingNodes.length - 1 && <div className="w-px flex-1 bg-border/15 mt-1" />}
                  </div>
                  <div className="flex-1 mb-2 px-3 py-2 rounded-lg border border-border/10 opacity-30">
                    <span className="text-[10px] text-muted-foreground truncate">
                      {n.label || NODE_TYPES[n.type]?.label || n.type}
                    </span>
                  </div>
                </div>
              ))}

              {nodeLogs.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <p className="text-xs text-muted-foreground/40">Execute o pipeline para ver o histórico de etapas aqui</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}