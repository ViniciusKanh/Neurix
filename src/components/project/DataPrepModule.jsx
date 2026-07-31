import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import GlowCard from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  FlaskConical, CheckCircle2, Trash2, Loader2, Plus, ChevronDown, ChevronUp,
  Filter, Sigma, Tag, BarChart2, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';

const PREP_OPERATIONS = [
  {
    id: 'fill_missing',
    label: 'Preencher Valores Ausentes',
    icon: Filter,
    color: 'text-primary',
    bg: 'bg-primary/10',
    description: 'Substituir valores nulos/vazios em uma coluna',
    fields: [
      { key: 'column', label: 'Coluna', type: 'column_select' },
      { key: 'strategy', label: 'Estratégia', type: 'select', options: ['mean', 'median', 'mode', 'constant', 'forward_fill', 'drop_rows'] },
      { key: 'fill_value', label: 'Valor Constante', type: 'text', showWhen: { key: 'strategy', value: 'constant' } },
    ],
  },
  {
    id: 'remove_outliers',
    label: 'Remover Outliers',
    icon: Sigma,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    description: 'Detectar e remover outliers estatísticos',
    fields: [
      { key: 'column', label: 'Coluna Numérica', type: 'numeric_column_select' },
      { key: 'method', label: 'Método', type: 'select', options: ['IQR (1.5x)', 'Z-Score (3σ)', 'Percentil (1%-99%)'] },
    ],
  },
  {
    id: 'scale_features',
    label: 'Escalonar Features Numéricas',
    icon: BarChart2,
    color: 'text-accent',
    bg: 'bg-accent/10',
    description: 'Normalizar ou padronizar colunas numéricas',
    fields: [
      { key: 'columns', label: 'Colunas (ou "todas")', type: 'multi_column_select' },
      { key: 'method', label: 'Método de Escalonamento', type: 'select', options: ['Min-Max (0–1)', 'Padrão (Z-score)', 'Robust Scaler', 'Transformação Log'] },
    ],
  },
  {
    id: 'encode_categorical',
    label: 'Codificar Variáveis Categóricas',
    icon: Tag,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    description: 'Converter categorias de texto para formato numérico',
    fields: [
      { key: 'column', label: 'Coluna Categórica', type: 'categorical_column_select' },
      { key: 'method', label: 'Método de Codificação', type: 'select', options: ['One-Hot Encoding', 'Label Encoding', 'Target Encoding', 'Binary Encoding'] },
    ],
  },
];

const STEP_ICONS = { fill_missing: Filter, remove_outliers: Sigma, scale_features: BarChart2, encode_categorical: Tag };
const STEP_COLORS = { fill_missing: 'text-primary', remove_outliers: 'text-amber-400', scale_features: 'text-accent', encode_categorical: 'text-emerald-400' };

export default function DataPrepModule({ project, onProjectUpdate }) {
  const [selectedOp, setSelectedOp] = useState(null);
  const [config, setConfig] = useState({});
  const [isApplying, setIsApplying] = useState(false);
  const [expandedStep, setExpandedStep] = useState(null);
  const queryClient = useQueryClient();

  const columns = project.column_info || [];
  const numericCols = columns.filter(c => ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64'].includes((c.type || '').toLowerCase()));
  const categoricalCols = columns.filter(c => ['string', 'object', 'category', 'text', 'varchar'].includes((c.type || '').toLowerCase()));
  const prepSteps = project.prep_steps || [];

  const getColumnOptions = (type) => {
    if (type === 'numeric_column_select') return numericCols.length > 0 ? numericCols : columns;
    if (type === 'categorical_column_select') return categoricalCols.length > 0 ? categoricalCols : columns;
    return columns;
  };

  const applyStep = async () => {
    if (!selectedOp) return;
    const op = PREP_OPERATIONS.find(o => o.id === selectedOp);
    if (!op) return;

    // Validate required fields
    const missingField = op.fields.find(f => {
      if (f.showWhen && config[f.showWhen.key] !== f.showWhen.value) return false;
      return !config[f.key];
    });
    if (missingField) return toast.error(`Preencha o campo: ${missingField.label}`);

    setIsApplying(true);
    await new Promise(r => setTimeout(r, 600)); // simulate processing

    // Local simulation — no external API
    const targetCol = config.column || config.columns;
    const affectedCols = targetCol === 'all' ? columns.map(c => c.name) : [targetCol].filter(Boolean);
    const nullRows = affectedCols.reduce((s, cn) => {
      const col = columns.find(c => c.name === cn);
      return s + Math.round((project.dataset_size || 200) * ((col?.null_percent || 0) / 100));
    }, 0);
    const affectedRows = selectedOp === 'fill_missing' ? nullRows || Math.round((project.dataset_size || 200) * 0.05)
      : selectedOp === 'remove_outliers' ? Math.round((project.dataset_size || 200) * 0.04)
      : Math.round((project.dataset_size || 200) * 0.9);

    const summaries = {
      fill_missing: `${affectedRows} valores ausentes preenchidos em "${affectedCols.join(', ')}" usando estratégia "${config.strategy}".`,
      remove_outliers: `${affectedRows} outliers removidos de "${affectedCols.join(', ')}" pelo método "${config.method}".`,
      scale_features: `${affectedCols.length} colunas escalonadas com "${config.method}". Valores agora na faixa padronizada.`,
      encode_categorical: `Coluna "${affectedCols[0]}" codificada com "${config.method}". Categorias convertidas para numérico.`,
    };
    const notes = {
      fill_missing: 'Imputação pode introduzir viés se os dados não são MCAR. Avalie o impacto na distribuição.',
      remove_outliers: 'Remoção de outliers melhora modelos lineares mas pode prejudicar detecção de anomalias.',
      scale_features: 'Escalonamento essencial para SVM, KNN e Redes Neurais. Árvores não precisam.',
      encode_categorical: 'One-Hot pode causar alta dimensionalidade. Label Encoding assume ordem nas categorias.',
    };

    const newStep = {
      id: `step_${Date.now()}`,
      type: selectedOp,
      label: op.label,
      config: { ...config },
      applied_at: new Date().toISOString(),
      affected_rows: affectedRows,
      affected_columns: affectedCols,
      summary: summaries[selectedOp] || op.label,
      technical_note: notes[selectedOp] || '',
    };

    const updatedSteps = [...prepSteps, newStep];
    await base44.entities.Project.update(project.id, { prep_steps: updatedSteps });
    queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    onProjectUpdate?.();

    setConfig({});
    setSelectedOp(null);
    setIsApplying(false);
    toast.success(`Etapa aplicada: ${op.label}`);
  };

  const removeStep = async (stepId) => {
    const updated = prepSteps.filter(s => s.id !== stepId);
    await base44.entities.Project.update(project.id, { prep_steps: updated });
    queryClient.invalidateQueries({ queryKey: ['project', project.id] });
    onProjectUpdate?.();
    toast.success('Etapa removida');
  };

  const selectedOpDef = PREP_OPERATIONS.find(o => o.id === selectedOp);

  return (
    <GlowCard className="lg:col-span-2">
      <div className="flex items-center gap-2 mb-5">
        <FlaskConical className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Preparação de Dados</h3>
        {prepSteps.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{prepSteps.length} etapa{prepSteps.length > 1 ? 's' : ''} aplicada{prepSteps.length > 1 ? 's' : ''}</span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Operation Builder */}
        <div className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Selecionar Operação</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {PREP_OPERATIONS.map((op) => (
                <button
                  key={op.id}
                  onClick={() => { setSelectedOp(op.id); setConfig({}); }}
                  className={cn(
                    "flex items-start gap-2 p-3 rounded-lg border text-left transition-all duration-200",
                    selectedOp === op.id
                      ? "border-primary/50 bg-primary/5"
                      : "border-border/40 bg-secondary/30 hover:border-border hover:bg-secondary/50"
                  )}
                >
                  <div className={cn("p-1.5 rounded-md flex-shrink-0 mt-0.5", op.bg)}>
                    <op.icon className={cn("w-3 h-3", op.color)} />
                  </div>
                  <div>
                    <p className={cn("text-xs font-medium", selectedOp === op.id ? "text-primary" : "text-foreground")}>{op.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{op.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Config Fields */}
          <AnimatePresence mode="wait">
            {selectedOpDef && (
              <motion.div
                key={selectedOp}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3 p-4 rounded-lg bg-secondary/30 border border-border/30"
              >
                <p className="text-xs font-semibold text-foreground">Configurar: {selectedOpDef.label}</p>
                {selectedOpDef.fields.map((field) => {
                  if (field.showWhen && config[field.showWhen.key] !== field.showWhen.value) return null;

                  const colOptions = getColumnOptions(field.type);

                  return (
                    <div key={field.key}>
                      <Label className="text-xs">{field.label}</Label>
                      {field.type === 'select' ? (
                        <Select value={config[field.key] || ''} onValueChange={v => setConfig(c => ({ ...c, [field.key]: v }))}>
                          <SelectTrigger className="mt-1 h-8 text-xs bg-background/50">
                            <SelectValue placeholder={`Select ${field.label.toLowerCase()}`} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options.map(opt => <SelectItem key={opt} value={opt} className="text-xs">{opt}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : field.type === 'text' ? (
                        <Input
                          value={config[field.key] || ''}
                          onChange={e => setConfig(c => ({ ...c, [field.key]: e.target.value }))}
                          className="mt-1 h-8 text-xs bg-background/50"
                          placeholder="Enter value..."
                        />
                      ) : (
                        <Select value={config[field.key] || ''} onValueChange={v => setConfig(c => ({ ...c, [field.key]: v }))}>
                          <SelectTrigger className="mt-1 h-8 text-xs bg-background/50">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {field.type === 'multi_column_select' && <SelectItem value="all" className="text-xs">All Numeric Columns</SelectItem>}
                            {colOptions.map(col => <SelectItem key={col.name} value={col.name} className="text-xs font-mono">{col.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                })}
                <Button
                  onClick={applyStep}
                  disabled={isApplying}
                  size="sm"
                  className="w-full mt-2 bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs"
                >
                  {isApplying
                    ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Aplicando...</>
                    : <><Plus className="w-3 h-3 mr-1.5" /> Aplicar Etapa</>
                  }
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right: Step History */}
        <div>
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Histórico do Pipeline</Label>
          <div className="mt-2 space-y-2 max-h-96 overflow-y-auto scrollbar-thin pr-1">
            {prepSteps.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-xs">Nenhuma etapa aplicada</p>
                <p className="text-[10px] mt-0.5">Selecione uma operação e aplique</p>
              </div>
            ) : (
              <AnimatePresence>
                {prepSteps.map((step, idx) => {
                  const StepIcon = STEP_ICONS[step.type] || FlaskConical;
                  const isExpanded = expandedStep === step.id;
                  return (
                    <motion.div
                      key={step.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="relative"
                    >
                      {/* Connector line */}
                      {idx < prepSteps.length - 1 && (
                        <div className="absolute left-[18px] top-full w-px h-2 bg-border/40 z-10" />
                      )}
                      <div className="rounded-lg border border-border/30 bg-secondary/20 overflow-hidden">
                        <div
                          className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer hover:bg-secondary/40 transition-colors"
                          onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                        >
                          {/* Step number + icon */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-muted-foreground w-4 text-center">{idx + 1}</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                          </div>
                          <StepIcon className={cn("w-3 h-3 flex-shrink-0", STEP_COLORS[step.type])} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{step.label}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {step.affected_columns?.slice(0, 2).join(', ')}
                              {step.affected_columns?.length > 2 && ` +${step.affected_columns.length - 2} more`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
                            <button
                              onClick={(e) => { e.stopPropagation(); removeStep(step.id); }}
                              className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 pt-1 border-t border-border/20 space-y-2">
                                {step.summary && (
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">{step.summary}</p>
                                )}
                                {step.technical_note && (
                                  <p className="text-[10px] text-accent/70 leading-relaxed">{step.technical_note}</p>
                                )}
                                <div className="flex items-center gap-4 text-[10px] text-muted-foreground pt-1">
                                  {step.affected_rows != null && (
                                    <span>{step.affected_rows.toLocaleString()} linhas afetadas</span>
                                  )}
                                  <span>{format(new Date(step.applied_at), 'MMM d, HH:mm')}</span>
                                </div>
                                {step.config && Object.keys(step.config).length > 0 && (
                                  <div className="flex flex-wrap gap-1 pt-0.5">
                                    {Object.entries(step.config).map(([k, v]) => (
                                      <span key={k} className="px-1.5 py-0.5 rounded bg-secondary text-[10px] text-muted-foreground font-mono">
                                        {k}: {v}
                                      </span>
                                    ))}
                                  </div>
                                )}
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
        </div>
      </div>
    </GlowCard>
  );
}