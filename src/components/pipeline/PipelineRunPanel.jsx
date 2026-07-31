// Real-time execution panel shown during/after pipeline run
import React from 'react';
import { cn } from '@/lib/utils';
import { NODE_TYPES } from './NodeTypes';
import { CheckCircle2, XCircle, Loader2, Clock, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUS_ICON = {
  success: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />,
  failed: <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />,
  running: <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />,
  pending: <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />,
};

function NodeLogRow({ log, index }) {
  const [expanded, setExpanded] = React.useState(log.status === 'failed');
  const type = NODE_TYPES[log.node_type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className={cn(
        'rounded-md border transition-all',
        log.status === 'success' && 'border-emerald-400/20 bg-emerald-400/5',
        log.status === 'failed' && 'border-red-400/30 bg-red-400/8',
        log.status === 'running' && 'border-primary/30 bg-primary/5',
        log.status === 'pending' && 'border-border/20 bg-secondary/10',
      )}
    >
      <button
        className="w-full flex items-center gap-2 p-2 text-left"
        onClick={() => setExpanded(v => !v)}
      >
        {STATUS_ICON[log.status] || STATUS_ICON.pending}
        <span className="text-[10px] font-semibold text-foreground flex-1 truncate">{log.node_name}</span>
        <span className="text-[8px] font-mono text-muted-foreground">{type?.label || log.node_type}</span>
        {log.duration_ms && (
          <span className="text-[8px] font-mono text-muted-foreground/60 ml-1">{log.duration_ms}ms</span>
        )}
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 space-y-1.5">
              {(log.rows_in !== undefined || log.rows_out !== undefined) && (
                <div className="flex gap-3 text-[8px] font-mono">
                  <span className="text-muted-foreground">Entradas: <span className="text-primary">{log.rows_in ?? '—'}</span></span>
                  <span className="text-muted-foreground">Saídas: <span className="text-accent">{log.rows_out ?? '—'}</span></span>
                  {log.rows_in && log.rows_out !== undefined && log.rows_out < log.rows_in && (
                    <span className="text-amber-400">▼ {log.rows_in - log.rows_out} removidos</span>
                  )}
                </div>
              )}
              {log.log && (
                <pre className="text-[8px] font-mono text-muted-foreground bg-secondary/20 rounded p-1.5 whitespace-pre-wrap break-words leading-relaxed">
                  {log.log}
                </pre>
              )}
              {log.error && (
                <div className="flex items-start gap-1.5 p-1.5 rounded bg-red-400/10 border border-red-400/20">
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  <pre className="text-[8px] font-mono text-red-300 whitespace-pre-wrap break-words">{log.error}</pre>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PipelineRunPanel({ progress, nodes, onClose }) {
  if (!progress) return null;
  const { status, nodeLogs = [], currentNode, nodeIndex, total } = progress;
  const pct = total ? Math.round(((nodeIndex || 0) / total) * 100) : (status === 'success' ? 100 : 0);

  return (
    <div className="flex flex-col h-full">
      {/* Status header */}
      <div className="p-3 border-b border-border/20 flex-shrink-0">
        <div className="flex items-center gap-2 mb-2">
          {status === 'running' && <Loader2 className="w-4 h-4 text-primary animate-spin" />}
          {status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {status === 'failed' && <XCircle className="w-4 h-4 text-red-400" />}
          {status === 'timeout' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
          <span className={cn(
            'text-xs font-bold',
            status === 'running' && 'text-primary',
            status === 'success' && 'text-emerald-400',
            status === 'failed' && 'text-red-400',
            status === 'timeout' && 'text-amber-400',
          )}>
            {status === 'running' && `Executando... nó ${(nodeIndex || 0) + 1}/${total}`}
            {status === 'success' && 'Execução concluída com sucesso!'}
            {status === 'failed' && `Falha em: ${progress.failedNode?.label || '?'}`}
            {status === 'timeout' && 'Timeout atingido'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
          <motion.div
            className={cn(
              'h-full rounded-full transition-all',
              status === 'success' && 'bg-emerald-400',
              status === 'failed' && 'bg-red-400',
              status === 'timeout' && 'bg-amber-400',
              status === 'running' && 'bg-primary',
            )}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
        <p className="text-[8px] font-mono text-muted-foreground mt-1">{pct}% completo · {nodeLogs.filter(l => l.status === 'success').length} nós OK</p>
      </div>

      {/* Node logs */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
        {nodeLogs.map((log, i) => (
          <NodeLogRow key={log.node_id || i} log={log} index={i} />
        ))}

        {/* Pending nodes */}
        {status === 'running' && nodes && nodeLogs.length < nodes.length && (
          <div className="space-y-1">
            {nodes.slice(nodeLogs.length).map((n, i) => (
              <div key={n.id} className="flex items-center gap-2 p-2 rounded-md border border-border/15 opacity-30">
                <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-[10px] text-muted-foreground truncate">{n.label || NODE_TYPES[n.type]?.label || n.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}