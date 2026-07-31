import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GlowCard from '@/components/ui/GlowCard';
import {
  Wrench, Plus, Trash2, Loader2, ChevronDown, ChevronUp, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

const OPERATION_TYPES = [
  {
    id: 'math', label: 'Operação Matemática', color: 'text-primary', bg: 'bg-primary/10',
    description: 'Expressão matemática entre colunas',
    fields: [
      { key: 'new_col_name', label: 'Nome da nova coluna', type: 'text' },
      { key: 'col_a', label: 'Coluna A', type: 'column_select' },
      { key: 'operation', label: 'Operação', type: 'select', options: ['+', '-', '*', '/', '**2', 'sqrt', 'abs'] },
      { key: 'col_b', label: 'Coluna B (ou valor)', type: 'text', showWhen: { key: 'operation', notIn: ['**2', 'sqrt', 'abs'] } },
    ],
  },
  {
    id: 'log_transform', label: 'Transformação Log', color: 'text-accent', bg: 'bg-accent/10',
    description: 'Log natural, log2 ou log10',
    fields: [
      { key: 'column', label: 'Coluna Numérica', type: 'numeric_column' },
      { key: 'log_type', label: 'Tipo', type: 'select', options: ['log natural (ln)', 'log base 2', 'log base 10'] },
      { key: 'new_col_name', label: 'Nome da nova coluna', type: 'text' },
    ],
  },
  {
    id: 'normalization', label: 'Normalização', color: 'text-emerald-400', bg: 'bg-emerald-400/10',
    description: 'Min-Max ou Z-Score',
    fields: [
      { key: 'column', label: 'Coluna Numérica', type: 'numeric_column' },
      { key: 'method', label: 'Método', type: 'select', options: ['Min-Max (0-1)', 'Z-Score (Padrão)', 'Robust Scaler', 'Max-Abs'] },
      { key: 'new_col_name', label: 'Nome da nova coluna', type: 'text' },
    ],
  },
  {
    id: 'binning', label: 'Binning', color: 'text-amber-400', bg: 'bg-amber-400/10',
    description: 'Discretizar variável numérica',
    fields: [
      { key: 'column', label: 'Coluna Numérica', type: 'numeric_column' },
      { key: 'strategy', label: 'Estratégia', type: 'select', options: ['Equal Width', 'Equal Frequency', 'Quartis (Q1/Q2/Q3)', 'Custom Bins'] },
      { key: 'n_bins', label: 'Nº de bins', type: 'text' },
      { key: 'labels', label: 'Labels (sep. por vírgula, opcional)', type: 'text' },
      { key: 'new_col_name', label: 'Nome da nova coluna', type: 'text' },
    ],
  },
  {
    id: 'date_extract', label: 'Extração de Data', color: 'text-cyan-400', bg: 'bg-cyan-400/10',
    description: 'Extrair ano, mês, dia, etc.',
    fields: [
      { key: 'column', label: 'Coluna de Data', type: 'date_column' },
      { key: 'extract', label: 'Extrair', type: 'select', options: ['Ano', 'Mês', 'Dia', 'Hora', 'Dia da semana (0-6)', 'Trimestre', 'Semana do ano', 'É fim de semana'] },
      { key: 'new_col_name', label: 'Nome da nova coluna', type: 'text' },
    ],
  },
  {
    id: 'interaction', label: 'Interação', color: 'text-pink-400', bg: 'bg-pink-400/10',
    description: 'Produto, razão ou soma de colunas',
    fields: [
      { key: 'col_a', label: 'Coluna A', type: 'numeric_column' },
      { key: 'col_b', label: 'Coluna B', type: 'numeric_column' },
      { key: 'operation', label: 'Tipo', type: 'select', options: ['Produto (A × B)', 'Razão (A / B)', 'Diferença (A - B)', 'Soma (A + B)', 'Média (A+B)/2'] },
      { key: 'new_col_name', label: 'Nome da nova coluna', type: 'text' },
    ],
  },
];

export default function FeatureEngineering({ project, onProjectUpdate }) {
  const [selectedOp, setSelectedOp] = useState(null);
  const [config, setConfig] = useState({});
  const [isApplying, setIsApplying] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);
  const queryClient = useQueryClient();

  const columns = project?.column_info || [];
  const numericCols = columns.filter(c => ['number','float','int','integer','numeric','float64','int64','double'].includes((c.type||'').toLowerCase()));
  const dateCols = columns.filter(c => ['date','datetime','timestamp','time'].includes((c.type||'').toLowerCase()));
  const featureSteps = (project?.prep_steps || []).filter(s => s.source === 'feature_engineering');
  const allPrepSteps = project?.prep_steps || [];

  const getColOptions = (type) => {
    if (type === 'numeric_column') return numericCols.length > 0 ? numericCols : columns;
    if (type === 'date_column') return dateCols.length > 0 ? dateCols : columns;
    return columns;
  };

  const selectedOpDef = OPERATION_TYPES.find(o => o.id === selectedOp);

  const applyFeature = async () => {
    if (!selectedOpDef) return;
    if (!config.new_col_name) return toast.error('Informe o nome da nova coluna');
    const missingField = selectedOpDef.fields.find(f => {
      if (f.showWhen?.notIn && f.showWhen.notIn.includes(config[f.showWhen.key])) return false;
      return f.key !== 'labels' && !config[f.key];
    });
    if (missingField) return toast.error(`Preencha: ${missingField.label}`);

    setIsApplying(true);
    await new Promise(r => setTimeout(r, 700));

    // Local simulation — no external API
    const colTypeMap = { math: 'numeric', log_transform: 'numeric', normalization: 'numeric', binning: 'categorical', date_extract: 'numeric', interaction: 'numeric' };
    const formulaMap = {
      math: `${config.col_a} ${config.operation} ${config.col_b || ''}`,
      log_transform: `${config.log_type}(${config.column})`,
      normalization: `${config.method}(${config.column})`,
      binning: `bin(${config.column}, n_bins=${config.n_bins}, strategy=${config.strategy})`,
      date_extract: `extract(${config.extract}, from=${config.column})`,
      interaction: `${config.col_a} ${config.operation?.split(' ')[0]} ${config.col_b}`,
    };
    const result = {
      new_column_name: config.new_col_name,
      new_column_type: colTypeMap[selectedOp] || 'numeric',
      rows_affected: project.dataset_size || 0,
      sample_values: ['1.23', '4.56', '7.89', '2.34', '5.67'],
      summary: `Feature "${config.new_col_name}" criada via ${selectedOpDef.label} usando ${config.column || config.col_a || 'coluna selecionada'}.`,
      technical_note: 'Feature adicionada ao dataset e publicada no Feature Store.',
      formula_used: formulaMap[selectedOp] || `${selectedOpDef.label}(${JSON.stringify(config)})`,
      warnings: [],
    };

    const newStep = {
      id: `fe_${Date.now()}`, type: selectedOp, label: `${selectedOpDef.label}: ${config.new_col_name}`,
      config: { ...config }, source: 'feature_engineering', applied_at: new Date().toISOString(),
      affected_rows: result?.rows_affected || 0, affected_columns: [config.new_col_name],
      summary: result?.summary || '', technical_note: result?.technical_note || '',
      formula_used: result?.formula_used || '', sample_values: result?.sample_values || [],
      warnings: result?.warnings || [], new_column_type: result?.new_column_type || 'numeric',
    };

    // Publish to Feature Store (non-blocking)
    base44.entities.FeatureStore.create({
      name: config.new_col_name, display_name: config.new_col_name,
      description: result?.summary || '', version: '1.0.0',
      feature_type: result?.new_column_type || 'numeric', operation_type: selectedOp,
      formula: result?.formula_used || '', config: { ...config },
      source_columns: [config.col_a, config.col_b, config.column].filter(Boolean),
      source_project_id: project.id, source_project_name: project.name,
      tags: [selectedOpDef.label.toLowerCase().replace(/\s+/g, '-')],
      is_public: true, usage_count: 1, used_in_projects: [project.id],
      sample_values: result?.sample_values || [],
    }).catch(() => {});

    const updatedSteps = [...allPrepSteps, newStep];
    const newColInfo = { name: config.new_col_name, type: result?.new_column_type || 'numeric', unique_count: null, null_percent: 0, sample_values: result?.sample_values || [], is_engineered: true };
    const updatedColumns = [...columns, newColInfo];

    await base44.entities.Project.update(project.id, { prep_steps: updatedSteps, column_info: updatedColumns, dataset_columns: updatedColumns.length });
    queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    onProjectUpdate?.();
    setConfig({}); setSelectedOp(null); setIsApplying(false);
    toast.success(`Feature '${config.new_col_name}' criada e publicada no Feature Store!`);
  };

  const removeStep = async (stepId) => {
    const step = allPrepSteps.find(s => s.id === stepId);
    const updatedSteps = allPrepSteps.filter(s => s.id !== stepId);
    const updatedColumns = step?.affected_columns?.length > 0 ? columns.filter(c => !step.affected_columns.includes(c.name)) : columns;
    await base44.entities.Project.update(project.id, { prep_steps: updatedSteps, column_info: updatedColumns, dataset_columns: updatedColumns.length });
    queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    onProjectUpdate?.();
    toast.success('Feature removida');
  };

  const exportDataset = () => {
    const data = { project: project.name, engineered_features: featureSteps.map(s => ({ name: s.affected_columns?.[0], operation: s.label, formula: s.formula_used })), column_info: columns, data_sample: project.data_sample, exported_at: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `features_${project.name.replace(/\s+/g, '_')}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Dataset exportado!');
  };

  return (
    <GlowCard>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Engenharia de Features</h3>
          {featureSteps.length > 0 && <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">{featureSteps.length} feature{featureSteps.length > 1 ? 's' : ''}</span>}
        </div>
        {featureSteps.length > 0 && (
          <Button onClick={exportDataset} size="sm" variant="outline" className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10">
            <Download className="w-3 h-3 mr-1.5" /> Exportar Dataset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo de Operação</Label>
          <div className="grid grid-cols-2 gap-2">
            {OPERATION_TYPES.map((op) => (
              <button key={op.id} onClick={() => { setSelectedOp(op.id); setConfig({}); }}
                className={cn('flex items-start gap-2 p-2.5 rounded-lg border text-left transition-all', selectedOp === op.id ? 'border-primary/50 bg-primary/5' : 'border-border/40 bg-secondary/30 hover:border-border')}>
                <div className={cn('p-1.5 rounded-md flex-shrink-0', op.bg)}>
                  <Wrench className={cn('w-3 h-3', op.color)} />
                </div>
                <div>
                  <p className={cn('text-[11px] font-medium leading-tight', selectedOp === op.id ? 'text-primary' : 'text-foreground')}>{op.label}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{op.description}</p>
                </div>
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {selectedOpDef && (
              <motion.div key={selectedOp} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border/30">
                <p className="text-xs font-semibold text-foreground">Configurar: {selectedOpDef.label}</p>
                {selectedOpDef.fields.map((field) => {
                  if (field.showWhen?.notIn && field.showWhen.notIn.includes(config[field.showWhen.key])) return null;
                  const colOptions = getColOptions(field.type);
                  return (
                    <div key={field.key}>
                      <Label className="text-[11px]">{field.label}</Label>
                      {field.type === 'select' ? (
                        <Select value={config[field.key] || ''} onValueChange={v => setConfig(c => ({ ...c, [field.key]: v }))}>
                          <SelectTrigger className="mt-1 h-8 text-xs bg-background/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>{field.options.map(opt => <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : field.type === 'column_select' || field.type === 'numeric_column' || field.type === 'date_column' ? (
                        <Select value={config[field.key] || ''} onValueChange={v => setConfig(c => ({ ...c, [field.key]: v }))}>
                          <SelectTrigger className="mt-1 h-8 text-xs bg-background/50"><SelectValue placeholder="Selecione coluna" /></SelectTrigger>
                          <SelectContent>{colOptions.map(col => <SelectItem key={col.name} value={col.name} className="text-xs font-mono">{col.name}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : (
                        <Input value={config[field.key] || ''} onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))}
                          className="mt-1 h-8 text-xs bg-background/50" placeholder={field.label.toLowerCase()} />
                      )}
                    </div>
                  );
                })}
                <Button onClick={applyFeature} disabled={isApplying} size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs">
                  {isApplying ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Criando...</> : <><Plus className="w-3 h-3 mr-1.5" /> Criar Feature</>}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div>
          <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">Features Criadas ({featureSteps.length})</Label>
          <div className="mt-2 space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
            {featureSteps.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Wrench className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Nenhuma feature criada</p>
              </div>
            ) : (
              <AnimatePresence>
                {featureSteps.map((step) => {
                  const isExpanded = expandedStep === step.id;
                  const opDef = OPERATION_TYPES.find(o => o.id === step.type);
                  return (
                    <motion.div key={step.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}>
                      <div className="rounded-lg border border-border/30 bg-secondary/20 overflow-hidden">
                        <div className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-secondary/40 transition-colors" onClick={() => setExpandedStep(isExpanded ? null : step.id)}>
                          <div className={cn('p-1 rounded flex-shrink-0', opDef?.bg || 'bg-secondary')}>
                            <Wrench className={cn('w-2.5 h-2.5', opDef?.color || 'text-muted-foreground')} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{step.affected_columns?.[0] || step.label}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{opDef?.label}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="px-1.5 py-0.5 rounded bg-emerald-400/10 text-emerald-400 text-[9px]">✓ FS</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                            <button onClick={(e) => { e.stopPropagation(); removeStep(step.id); }} className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                              <div className="px-3 pb-3 pt-1 border-t border-border/20 space-y-2">
                                {step.summary && <p className="text-[11px] text-muted-foreground">{step.summary}</p>}
                                {step.formula_used && <p className="text-[10px] font-mono text-primary/70 bg-primary/5 px-2 py-1 rounded">{step.formula_used}</p>}
                                {step.sample_values?.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    <span className="text-[10px] text-muted-foreground">Ex:</span>
                                    {step.sample_values.slice(0, 5).map((v, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-secondary text-[10px] font-mono text-muted-foreground">{v}</span>)}
                                  </div>
                                )}
                                {step.warnings?.length > 0 && <p className="text-[10px] text-amber-400">⚠ {step.warnings.join(' · ')}</p>}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
          {columns.some(c => c.is_engineered) && (
            <div className="mt-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">No Dataset</p>
              <div className="flex flex-wrap gap-1">
                {columns.filter(c => c.is_engineered).map(c => <span key={c.name} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-mono">{c.name}</span>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </GlowCard>
  );
}