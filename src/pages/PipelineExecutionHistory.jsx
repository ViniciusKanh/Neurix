import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CheckCircle2, XCircle, Loader2, Clock, RefreshCw, AlertTriangle,
  ChevronDown, ChevronRight, Terminal, Play, Search, Filter, RotateCcw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { executePipeline } from '@/lib/pipelineExecutor';
import { NODE_TYPES } from '@/components/pipeline/NodeTypes';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20', label: 'Sucesso' },
  failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20', label: 'Falhou' },
  running: { icon: Loader2, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', label: 'Executando', spin: true },
  pending: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-secondary/20', border: 'border-border/20', label: 'Pendente' },
  timeout: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/20', label: 'Timeout' },
};

const TRIGGER_LABEL = { manual: '▶ Manual', scheduled: '⏰ Agendado', rerun: '↺ Re-run' };

function NodeLogRow({ log }) {
  const [expanded, setExpanded] = useState(log.status === 'failed');
  const sc = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
  const Icon = sc.icon;

  return (
    <div className={cn('rounded border transition-all', sc.border, sc.bg)}>
      <button className="w-full flex items-center gap-2 px-3 py-2 text-left" onClick={() => setExpanded(v => !v)}>
        <Icon className={cn('w-3.5 h-3.5 flex-shrink-0', sc.color, sc.spin && 'animate-spin')} />
        <span className="text-xs font-medium text-foreground flex-1 truncate">{log.node_name}</span>
        <span className="text-[9px] font-mono text-muted-foreground">{NODE_TYPES[log.node_type]?.label || log.node_type}</span>
        {log.duration_ms && <span className="text-[9px] font-mono text-muted-foreground/60">{log.duration_ms}ms</span>}
        {log.rows_in !== undefined && (
          <span className="text-[8px] font-mono text-muted-foreground/50">{log.rows_in}→{log.rows_out}</span>
        )}
        {expanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <div className="px-4 pb-3 space-y-2">
              {(log.rows_in !== undefined) && (
                <div className="flex gap-4 text-xs font-mono">
                  <span className="text-muted-foreground">Entrada: <span className="text-primary">{log.rows_in}</span> linhas</span>
                  <span className="text-muted-foreground">Saída: <span className="text-accent">{log.rows_out}</span> linhas</span>
                  {log.rows_in && log.rows_out < log.rows_in && (
                    <span className="text-amber-400">▼ {log.rows_in - log.rows_out} removidos</span>
                  )}
                </div>
              )}
              {log.log && (
                <div>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Terminal className="w-2.5 h-2.5" /> Log de execução
                  </p>
                  <pre className="text-[10px] font-mono text-muted-foreground bg-secondary/30 rounded p-2.5 whitespace-pre-wrap break-words leading-relaxed border border-border/20">
                    {log.log}
                  </pre>
                </div>
              )}
              {log.error && (
                <div>
                  <p className="text-[9px] text-red-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-2.5 h-2.5" /> Erro detalhado
                  </p>
                  <pre className="text-[10px] font-mono text-red-300 bg-red-400/10 rounded p-2.5 whitespace-pre-wrap break-words border border-red-400/20">
                    {log.error}
                  </pre>
                </div>
              )}
              <div className="flex gap-4 text-[9px] font-mono text-muted-foreground/50">
                {log.started_at && <span>Início: {new Date(log.started_at).toLocaleTimeString('pt-BR')}</span>}
                {log.finished_at && <span>Fim: {new Date(log.finished_at).toLocaleTimeString('pt-BR')}</span>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExecutionCard({ exec, onRerun }) {
  const [expanded, setExpanded] = useState(false);
  const sc = STATUS_CONFIG[exec.status] || STATUS_CONFIG.pending;
  const Icon = sc.icon;
  const nodeLogs = exec.node_logs || [];
  const failedNodes = nodeLogs.filter(l => l.status === 'failed');
  const pct = exec.total_nodes ? Math.round((exec.completed_nodes || 0) / exec.total_nodes * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border transition-all', sc.border, expanded ? sc.bg : 'bg-card/50')}
    >
      {/* Card header */}
      <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => setExpanded(v => !v)}>
        <Icon className={cn('w-5 h-5 flex-shrink-0', sc.color, sc.spin && 'animate-spin')} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold text-foreground truncate">{exec.pipeline_name}</p>
            <span className={cn('text-[9px] px-1.5 py-0.5 rounded font-bold', sc.bg, sc.color, 'border', sc.border)}>
              {sc.label}
            </span>
            <span className="text-[9px] text-muted-foreground font-mono">{TRIGGER_LABEL[exec.trigger] || exec.trigger}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {exec.started_at && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(exec.started_at).toLocaleString('pt-BR')}
              </span>
            )}
            {exec.duration_seconds && (
              <span className="text-[10px] font-mono text-muted-foreground/70">⏱ {exec.duration_seconds}s</span>
            )}
            <span className="text-[10px] font-mono text-muted-foreground/60">
              {exec.completed_nodes || 0}/{exec.total_nodes || 0} nós
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {exec.status === 'failed' || exec.status === 'timeout' ? (
            <Button
              onClick={e => { e.stopPropagation(); onRerun(exec); }}
              size="sm"
              variant="ghost"
              className="h-7 text-[9px] gap-1 text-amber-400 hover:bg-amber-400/10 hover:text-amber-300"
            >
              <RotateCcw className="w-3 h-3" /> Re-run
            </Button>
          ) : null}
          {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="h-1 rounded-full bg-secondary/40 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', sc.color.replace('text-', 'bg-'))}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Error summary */}
      {exec.error_message && !expanded && (
        <div className="mx-4 mb-3 flex items-start gap-2 p-2 rounded-lg bg-red-400/10 border border-red-400/20">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-red-300">{exec.error_message}</p>
        </div>
      )}

      {/* Expanded: node logs */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {exec.failed_node && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-400/10 border border-red-400/20">
                  <XCircle className="w-4 h-4 text-red-400" />
                  <div>
                    <p className="text-xs font-semibold text-red-400">Falhou no nó: {exec.failed_node}</p>
                    {exec.error_message && <p className="text-[10px] text-red-300/80 mt-0.5">{exec.error_message}</p>}
                  </div>
                </div>
              )}

              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Terminal className="w-3 h-3" /> Logs por nó ({nodeLogs.length})
                </p>
                <div className="space-y-1.5">
                  {nodeLogs.map((log, i) => <NodeLogRow key={log.node_id || i} log={log} />)}
                  {nodeLogs.length === 0 && <p className="text-xs text-muted-foreground/50 text-center py-4">Sem logs disponíveis</p>}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PipelineExecutionHistory() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [rerunning, setRerunning] = useState(null);

  const { data: executions = [], isLoading, refetch } = useQuery({
    queryKey: ['pipeline_executions'],
    queryFn: () => base44.entities.PipelineExecution.list('-created_date', 100),
    refetchInterval: 5000,
  });

  const filtered = executions.filter(e => {
    const matchName = !search || e.pipeline_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || e.status === filterStatus;
    return matchName && matchStatus;
  });

  const handleRerun = async (exec) => {
    setRerunning(exec.id);
    const snapshot = exec.pipeline_snapshot;
    if (!snapshot?.nodes?.length) {
      toast.error('Snapshot do pipeline não disponível para re-run');
      setRerunning(null);
      return;
    }
    toast('Iniciando re-run...');
    await executePipeline({
      pipeline: { id: exec.pipeline_id, name: exec.pipeline_name },
      nodes: snapshot.nodes,
      edges: [],
      projectData: null,
      trigger: 'rerun',
      timeoutMinutes: 30,
    });
    queryClient.invalidateQueries({ queryKey: ['pipeline_executions'] });
    setRerunning(null);
    toast.success('Re-run concluído!');
  };

  const stats = {
    total: executions.length,
    success: executions.filter(e => e.status === 'success').length,
    failed: executions.filter(e => e.status === 'failed').length,
    running: executions.filter(e => e.status === 'running').length,
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Terminal className="w-5 h-5 text-primary" />
            Histórico de Execuções
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Logs detalhados de cada run de pipeline</p>
        </div>
        <Button onClick={() => refetch()} variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground hover:text-primary">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground', bg: 'bg-secondary/20', border: 'border-border/20' },
          { label: 'Sucesso', value: stats.success, color: 'text-emerald-400', bg: 'bg-emerald-400/5', border: 'border-emerald-400/20' },
          { label: 'Falhou', value: stats.failed, color: 'text-red-400', bg: 'bg-red-400/5', border: 'border-red-400/20' },
          { label: 'Em execução', value: stats.running, color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/20' },
        ].map(s => (
          <div key={s.label} className={cn('rounded-xl border p-3 text-center', s.bg, s.border)}>
            <p className={cn('text-2xl font-bold font-mono', s.color)}>{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar pipeline..."
            className="pl-8 h-8 text-sm bg-secondary/30"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs bg-secondary/30">
            <Filter className="w-3 h-3 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">Todos os status</SelectItem>
            <SelectItem value="success" className="text-xs">✅ Sucesso</SelectItem>
            <SelectItem value="failed" className="text-xs">❌ Falhou</SelectItem>
            <SelectItem value="running" className="text-xs">🔄 Executando</SelectItem>
            <SelectItem value="timeout" className="text-xs">⏱ Timeout</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Executions list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Terminal className="w-12 h-12 text-muted-foreground/20 mx-auto" />
          <p className="text-muted-foreground">Nenhuma execução encontrada</p>
          <p className="text-sm text-muted-foreground/50">Execute um pipeline pelo editor visual para ver o histórico aqui</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(exec => (
            <ExecutionCard
              key={exec.id}
              exec={exec}
              onRerun={handleRerun}
            />
          ))}
        </div>
      )}
    </div>
  );
}