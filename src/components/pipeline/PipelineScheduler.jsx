import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Clock, Plus, Trash2, Mail, AlertTriangle, CheckCircle2, Play, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CRON_PRESETS = [
  { label: 'A cada hora', cron: '0 * * * *' },
  { label: 'Diário às 00h', cron: '0 0 * * *' },
  { label: 'Diário às 08h', cron: '0 8 * * *' },
  { label: 'Diário às 18h', cron: '0 18 * * *' },
  { label: 'Seg-Sex às 09h', cron: '0 9 * * 1-5' },
  { label: 'Semanalmente (Segunda)', cron: '0 9 * * 1' },
  { label: 'Quinzenal (15 e 30)', cron: '0 9 15,30 * *' },
  { label: 'Mensal (dia 1)', cron: '0 9 1 * *' },
  { label: 'Personalizado', cron: 'custom' },
];

function computeNextRun(cron) {
  // Simple display helper — returns approximate next run
  if (!cron) return '—';
  if (cron.startsWith('0 * ')) return 'Próxima hora cheia';
  if (cron === '0 0 * * *') return 'Amanhã às 00:00';
  if (cron === '0 8 * * *') return 'Amanhã às 08:00';
  if (cron === '0 18 * * *') return 'Hoje às 18:00';
  if (cron.includes('1-5')) return 'Próximo dia útil às 09:00';
  if (cron === '0 9 * * 1') return 'Próxima segunda às 09:00';
  return 'Conforme agendamento';
}

export default function PipelineScheduler({ pipelines }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    pipeline_id: '',
    cron_preset: '0 9 * * 1-5',
    cron_custom: '',
    notify_email: '',
    notify_on_success: false,
    notify_on_failure: true,
    timeout_minutes: 30,
    enabled: true,
  });

  const { data: schedules = [], isLoading } = useQuery({
    queryKey: ['pipeline_schedules'],
    queryFn: () => base44.entities.PipelineSchedule.list('-created_date', 50),
  });

  const selectedCronPreset = CRON_PRESETS.find(p => p.cron === form.cron_preset) || CRON_PRESETS[CRON_PRESETS.length - 1];
  const effectiveCron = form.cron_preset === 'custom' ? form.cron_custom : form.cron_preset;

  const handleSave = async () => {
    if (!form.pipeline_id) return toast.error('Selecione um pipeline');
    if (!effectiveCron) return toast.error('Defina uma expressão cron');
    const pipeline = pipelines.find(p => p.id === form.pipeline_id);
    await base44.entities.PipelineSchedule.create({
      pipeline_id: form.pipeline_id,
      pipeline_name: pipeline?.name || '—',
      cron_expression: effectiveCron,
      cron_label: selectedCronPreset?.label !== 'Personalizado' ? selectedCronPreset?.label : effectiveCron,
      enabled: form.enabled,
      notify_email: form.notify_email,
      notify_on_success: form.notify_on_success,
      notify_on_failure: form.notify_on_failure,
      timeout_minutes: parseInt(form.timeout_minutes) || 30,
      next_run_at: computeNextRun(effectiveCron),
      last_status: 'pending',
    });
    queryClient.invalidateQueries({ queryKey: ['pipeline_schedules'] });
    toast.success('Agendamento criado!');
    setShowForm(false);
    setForm({ pipeline_id: '', cron_preset: '0 9 * * 1-5', cron_custom: '', notify_email: '', notify_on_success: false, notify_on_failure: true, timeout_minutes: 30, enabled: true });
  };

  const toggleEnabled = async (schedule) => {
    await base44.entities.PipelineSchedule.update(schedule.id, { enabled: !schedule.enabled });
    queryClient.invalidateQueries({ queryKey: ['pipeline_schedules'] });
    toast(`Agendamento ${!schedule.enabled ? 'ativado' : 'pausado'}`);
  };

  const deleteSchedule = async (id) => {
    await base44.entities.PipelineSchedule.delete(id);
    queryClient.invalidateQueries({ queryKey: ['pipeline_schedules'] });
    toast('Agendamento removido');
  };

  const STATUS_STYLE = {
    success: 'text-emerald-400',
    failed: 'text-red-400',
    running: 'text-primary',
    pending: 'text-muted-foreground',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border/20 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-primary" />
          <span className="text-[11px] font-bold text-foreground">Agendamentos</span>
          <span className="text-[8px] px-1 py-0.5 rounded bg-primary/10 text-primary font-mono">{schedules.length}</span>
        </div>
        <Button
          onClick={() => setShowForm(v => !v)}
          size="sm"
          className="h-6 text-[9px] bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 gap-1"
          variant="ghost"
        >
          <Plus className="w-2.5 h-2.5" /> Novo
        </Button>
      </div>

      {/* New Schedule Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-border/20"
          >
            <div className="p-3 space-y-2.5 bg-secondary/10">
              <p className="text-[10px] font-bold text-primary">Novo Agendamento</p>

              {/* Pipeline select */}
              <div>
                <label className="text-[8px] text-muted-foreground uppercase tracking-wider mb-1 block">Pipeline</label>
                <Select value={form.pipeline_id} onValueChange={v => setForm(f => ({ ...f, pipeline_id: v }))}>
                  <SelectTrigger className="h-7 text-[10px] bg-secondary/40">
                    <SelectValue placeholder="Selecionar pipeline..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Recorrência */}
              <div>
                <label className="text-[8px] text-muted-foreground uppercase tracking-wider mb-1 block">Recorrência</label>
                <Select value={form.cron_preset} onValueChange={v => setForm(f => ({ ...f, cron_preset: v }))}>
                  <SelectTrigger className="h-7 text-[10px] bg-secondary/40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRON_PRESETS.map(p => (
                      <SelectItem key={p.cron} value={p.cron} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.cron_preset === 'custom' && (
                <div>
                  <label className="text-[8px] text-muted-foreground uppercase tracking-wider mb-1 block">Expressão Cron</label>
                  <Input
                    value={form.cron_custom}
                    onChange={e => setForm(f => ({ ...f, cron_custom: e.target.value }))}
                    placeholder="0 9 * * 1-5"
                    className="h-7 text-[10px] font-mono bg-secondary/40"
                  />
                  <p className="text-[8px] text-muted-foreground/60 mt-0.5">min hora dia mês dia_semana</p>
                </div>
              )}

              {/* Timeout */}
              <div>
                <label className="text-[8px] text-muted-foreground uppercase tracking-wider mb-1 block">Timeout (minutos)</label>
                <Input
                  type="number"
                  value={form.timeout_minutes}
                  onChange={e => setForm(f => ({ ...f, timeout_minutes: e.target.value }))}
                  className="h-7 text-[10px] bg-secondary/40"
                  min={1} max={480}
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-[8px] text-muted-foreground uppercase tracking-wider mb-1 block">
                  <Mail className="w-2.5 h-2.5 inline mr-0.5" /> E-mail de notificação
                </label>
                <Input
                  value={form.notify_email}
                  onChange={e => setForm(f => ({ ...f, notify_email: e.target.value }))}
                  placeholder="email@empresa.com"
                  className="h-7 text-[10px] bg-secondary/40"
                />
              </div>

              {/* Notify toggles */}
              <div className="flex items-center justify-between">
                <label className="text-[9px] text-muted-foreground">Notificar em sucesso</label>
                <Switch
                  checked={form.notify_on_success}
                  onCheckedChange={v => setForm(f => ({ ...f, notify_on_success: v }))}
                  className="scale-75"
                />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-[9px] text-muted-foreground">Notificar em falha</label>
                <Switch
                  checked={form.notify_on_failure}
                  onCheckedChange={v => setForm(f => ({ ...f, notify_on_failure: v }))}
                  className="scale-75"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={handleSave} size="sm" className="flex-1 h-7 text-[10px] bg-primary text-primary-foreground">
                  <CheckCircle2 className="w-3 h-3 mr-1" /> Salvar
                </Button>
                <Button onClick={() => setShowForm(false)} variant="ghost" size="sm" className="h-7 text-[9px] text-muted-foreground">
                  Cancelar
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Schedule list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-2">
        {isLoading && <p className="text-[10px] text-muted-foreground text-center py-4">Carregando...</p>}
        {!isLoading && schedules.length === 0 && (
          <div className="text-center py-8 space-y-2">
            <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto" />
            <p className="text-[10px] text-muted-foreground">Nenhum agendamento configurado</p>
            <p className="text-[9px] text-muted-foreground/50">Clique em "Novo" para criar</p>
          </div>
        )}
        {schedules.map(sch => (
          <motion.div
            key={sch.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'rounded-lg border p-2.5 transition-all',
              sch.enabled ? 'border-primary/20 bg-primary/5' : 'border-border/20 bg-secondary/10 opacity-60'
            )}
          >
            <div className="flex items-start gap-2">
              <Switch
                checked={sch.enabled}
                onCheckedChange={() => toggleEnabled(sch)}
                className="scale-75 mt-0.5 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-foreground truncate">{sch.pipeline_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                  <span className="text-[8px] font-mono bg-secondary/60 px-1 py-0.5 rounded text-primary">{sch.cron_expression}</span>
                  <span className="text-[8px] text-muted-foreground">{sch.cron_label}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {sch.notify_email && (
                    <span className="text-[7px] text-muted-foreground/70 flex items-center gap-0.5">
                      <Mail className="w-2.5 h-2.5" /> {sch.notify_email}
                    </span>
                  )}
                  <span className="text-[7px] font-mono text-muted-foreground/60">timeout: {sch.timeout_minutes}min</span>
                </div>
                {sch.last_run_at && (
                  <p className="text-[7px] text-muted-foreground/50 mt-0.5">
                    Última execução: {new Date(sch.last_run_at).toLocaleString('pt-BR')}
                    {sch.last_status && <span className={cn('ml-1', STATUS_STYLE[sch.last_status])}>({sch.last_status})</span>}
                  </p>
                )}
                {sch.next_run_at && (
                  <p className="text-[7px] text-primary/60 mt-0.5">📅 {sch.next_run_at}</p>
                )}
              </div>
              <button
                onClick={() => deleteSchedule(sch.id)}
                className="text-muted-foreground/40 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}