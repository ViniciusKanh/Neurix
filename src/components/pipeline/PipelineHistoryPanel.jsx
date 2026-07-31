import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import {
  CheckCircle2, XCircle, Loader2, Clock, AlertTriangle,
  ChevronDown, ChevronRight, Terminal, RotateCcw, ExternalLink,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { NODE_TYPES } from './NodeTypes';

const STATUS_CFG = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/8', border: 'border-emerald-400/25', label: 'OK' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/8', border: 'border-red-400/25', label: 'Falhou' },
  running: { icon: Loader2, color: 'text-primary', bg: 'bg-primary/8', border: 'border-primary/25', label: 'Run', spin: true },
  pending: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-secondary/20', border: 'border-border/20', label: '...' },
  timeout: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/8', border: 'border-amber-400/25', label: 'Timeout' },
};

function NodeLogRow({ log }) {
  const [open, setOpen] = useState(log.status === 'failed');
  const sc = STATUS_CFG[log.status] || STATUS_CFG.pending;
  const Icon = sc.icon;

  return (
    <div className={cn('rounded border text-[9px] transition-all', sc.border, sc.bg)}>
      <button className="w-full flex items-center gap-1.5 px-2 py-1.5 text-left" onClick={() => setOpen(v => !v)}>
        <Icon className={cn('w-3 h-3 flex-shrink-0', sc.color, sc.spin && 'animate-spin')} />
        <span className="font-medium text-foreground flex-1 truncate">{log.node_name}</span>
        {log.duration_ms && <span className="font-mono text-muted-foreground/50">{log.duration_ms}ms</span>}
        {log.rows_in !== undefined && (
          <span className="font-mono text-muted-foreground/40">{log.rows_in}→{log.rows_out}</span>
        )}
        {open ? <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" /> : <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-3 pb-2 space-y-1">
              {log.log && (
                <pre className="text-[8px] font-mono text-muted-foreground bg-secondary/20 rounded p-1.5 whitespace-pre-wrap break-words leading-relaxed">
                  {log.log}
                </pre>
              )}
              {log.error && (
                <pre className="text-[8px] font-mono text-red-300 bg-red-400/10 rounded p-1.5 whitespace-pre-wrap break-words border border-red-400/20">
                  {log.error}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExecRow({ exec }) {
  const [open, setOpen] = useState(false);
  const sc = STATUS_CFG[exec.status] || STATUS_CFG.pending;
  const Icon = sc.icon;
  const nodeLogs = exec.node_logs || [];
  const pct = exec.total_nodes ? Math.round(((exec.completed_nodes || 0) / exec.total_nodes) * 100) : (exec.status === 'success' ? 100 : 0);

  return (
    <div className={cn('rounded-lg border transition-all', sc.border, open ? sc.bg : 'bg-secondary/5')}>
      <button className="w-full flex items-center gap-2 px-2.5 py-2 text-left" onClick={() => setOpen(v => !v)}>
        <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', sc.color, sc.spin && 'animate-spin')} />
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-semibold text-foreground truncate">{exec.pipeline_name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded', sc.bg, sc.color)}>{sc.label}</span>
            {exec.started_at && (
              <span className="text-[8px] font-mono text-muted-foreground">
                {new Date(exec.started_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            {exec.duration_seconds && (
              <span className="text-[8px] font-mono text-muted-foreground/50">{exec.duration_seconds}s</span>
            )}
          </div>
        </div>
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
      </button>

      {/* Progress bar */}
      <div className="px-2.5 pb-1.5">
        <div className="h-0.5 rounded-full bg-secondary/40 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', sc.color.replace('text-', 'bg-'))}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[7px] font-mono text-muted-foreground/40">{exec.completed_nodes || 0}/{exec.total_nodes || 0} nós</span>
          <span className="text-[7px] font-mono text-muted-foreground/40">{pct}%</span>
        </div>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-2.5 pb-2.5 space-y-1.5 border-t border-border/20 pt-2">
              {exec.error_message && (
                <div className="flex items-start gap-1.5 p-1.5 rounded bg-red-400/10 border border-red-400/20">
                  <AlertTriangle className="w-2.5 h-2.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[8px] text-red-300">{exec.error_message}</p>
                </div>
              )}
              {nodeLogs.length > 0 && (
                <div>
                  <p className="text-[8px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Terminal className="w-2.5 h-2.5" /> Nós ({nodeLogs.length})
                  </p>
                  <div className="space-y-1">
                    {nodeLogs.map((log, i) => <NodeLogRow key={log.node_id || i} log={log} />)}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PipelineHistoryPanel({ pipelineName }) {
  const { data: executions = [], isLoading, refetch } = useQuery({
    queryKey: ['pipeline_executions'],
    queryFn: () => base44.entities.PipelineExecution.list('-created_date', 30),
    refetchInterval: 8000,
  });

  const filtered = pipelineName
    ? executions.filter(e => e.pipeline_name?.toLowerCase().includes(pipelineName.toLowerCase()))
    : executions;

  const stats = {
    total: filtered.length,
    success: filtered.filter(e => e.status === 'success').length,
    failed: filtered.filter(e => e.status === 'failed').length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-2.5 border-b border-border/20 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-primary" />
            <span className="text-[11px] font-bold text-foreground">Histórico de Runs</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => refetch()}
              className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary transition-colors"
              title="Atualizar"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <Link to="/pipeline-history">
              <button className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary transition-colors" title="Ver histórico completo">
                <ExternalLink className="w-3 h-3" />
              </button>
            </Link>
          </div>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-3 gap-1">
          {[
            { label: 'Total', value: stats.total, color: 'text-foreground' },
            { label: 'OK', value: stats.success, color: 'text-emerald-400' },
            { label: 'Erro', value: stats.failed, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="text-center bg-secondary/20 rounded p-1.5 border border-border/15">
              <p className={cn('text-sm font-bold font-mono', s.color)}>{s.value}</p>
              <p className="text-[7px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1.5">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <Terminal className="w-8 h-8 text-muted-foreground/20 mx-auto" />
            <p className="text-[10px] text-muted-foreground">Nenhuma execução encontrada</p>
            <p className="text-[9px] text-muted-foreground/50">Execute um pipeline para ver o histórico aqui</p>
          </div>
        ) : (
          filtered.map(exec => <ExecRow key={exec.id} exec={exec} />)
        )}
      </div>
    </div>
  );
}