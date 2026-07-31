import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Wand2, Check, ChevronRight, Loader2, Brain, ArrowUpDown, Tags, Wrench, AlertTriangle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function analyzeDataset(project) {
  const suggestions = [];
  const cols = project.column_info || [];
  const sample = project.data_sample || [];

  // Count nulls per column
  const nullCounts = {};
  if (sample.length > 0) {
    cols.forEach(col => {
      const nulls = sample.filter(row => row[col.name] === null || row[col.name] === undefined || row[col.name] === '').length;
      nullCounts[col.name] = nulls;
    });
  }

  const numericCols = cols.filter(c => c.type === 'numeric' || c.type === 'float' || c.type === 'int' || c.type === 'number');
  const categoricalCols = cols.filter(c => c.type === 'categorical' || c.type === 'object' || c.type === 'string');
  const colsWithNulls = cols.filter(c => (c.null_percent || 0) > 0 || nullCounts[c.name] > 0);

  // Missing values
  if (colsWithNulls.length > 0) {
    const highNull = colsWithNulls.filter(c => (c.null_percent || 0) > 20);
    const lowNull = colsWithNulls.filter(c => (c.null_percent || 0) <= 20);

    if (lowNull.length > 0) {
      const numericWithNull = lowNull.filter(c => numericCols.find(n => n.name === c.name));
      const catWithNull = lowNull.filter(c => categoricalCols.find(n => n.name === c.name));

      if (numericWithNull.length > 0) {
        suggestions.push({
          id: 'impute_numeric',
          type: 'imputer',
          priority: 'high',
          title: 'Imputar valores nulos — Numéricos',
          description: `${numericWithNull.length} coluna(s) numérica(s) com valores ausentes. Recomendamos imputação pela média.`,
          icon: Wrench,
          color: 'text-orange-400',
          bg: 'bg-orange-400/10',
          badge: 'Crítico',
          badgeColor: 'bg-red-500/20 text-red-400',
          nodeType: 'imputer',
          config: { strategy: 'mean', columns: numericWithNull.map(c => c.name) },
          details: numericWithNull.map(c => `${c.name} (${(c.null_percent || 0).toFixed(1)}% nulo)`).join(', '),
          autoApply: true,
        });
      }

      if (catWithNull.length > 0) {
        suggestions.push({
          id: 'impute_categorical',
          type: 'imputer',
          priority: 'high',
          title: 'Imputar valores nulos — Categóricos',
          description: `${catWithNull.length} coluna(s) categórica(s) com valores ausentes. Recomendamos imputação pela moda.`,
          icon: Wrench,
          color: 'text-orange-400',
          bg: 'bg-orange-400/10',
          badge: 'Crítico',
          badgeColor: 'bg-red-500/20 text-red-400',
          nodeType: 'imputer',
          config: { strategy: 'mode', columns: catWithNull.map(c => c.name) },
          details: catWithNull.map(c => c.name).join(', '),
          autoApply: true,
        });
      }
    }

    if (highNull.length > 0) {
      suggestions.push({
        id: 'drop_high_null',
        type: 'imputer',
        priority: 'medium',
        title: 'Colunas com alta proporção de nulos',
        description: `${highNull.length} coluna(s) com >20% de valores ausentes. Considere remover ou imputar com valor constante.`,
        icon: AlertTriangle,
        color: 'text-amber-400',
        bg: 'bg-amber-400/10',
        badge: 'Aviso',
        badgeColor: 'bg-amber-500/20 text-amber-400',
        nodeType: 'imputer',
        config: { strategy: 'drop', columns: highNull.map(c => c.name) },
        details: highNull.map(c => `${c.name} (${(c.null_percent || 0).toFixed(1)}% nulo)`).join(', '),
        autoApply: false,
      });
    }
  }

  // Scaling for numeric columns
  if (numericCols.length > 1) {
    suggestions.push({
      id: 'scale_numeric',
      type: 'scaler',
      priority: 'high',
      title: 'Normalização de Escala — StandardScaler',
      description: `${numericCols.length} coluna(s) numérica(s) detectadas. Normalização evita que features com maior escala dominem o modelo.`,
      icon: ArrowUpDown,
      color: 'text-cyan-400',
      bg: 'bg-cyan-400/10',
      badge: 'Recomendado',
      badgeColor: 'bg-cyan-500/20 text-cyan-400',
      nodeType: 'scaler',
      config: { method: 'standard', columns: numericCols.map(c => c.name) },
      details: `StandardScaler: μ=0, σ=1 para ${numericCols.map(c => c.name).slice(0, 4).join(', ')}${numericCols.length > 4 ? ' ...' : ''}`,
      autoApply: true,
    });
  }

  // Encoding for categorical columns
  const encCols = categoricalCols.filter(c => (c.unique_count || 0) < 20 && (c.unique_count || 0) > 1);
  if (encCols.length > 0) {
    suggestions.push({
      id: 'encode_categorical',
      type: 'encoder',
      priority: 'high',
      title: 'Codificação One-Hot — Variáveis Categóricas',
      description: `${encCols.length} coluna(s) categórica(s) com baixa cardinalidade. One-Hot Encoding converte em variáveis binárias para o modelo.`,
      icon: Tags,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      badge: 'Recomendado',
      badgeColor: 'bg-purple-500/20 text-purple-400',
      nodeType: 'encoder',
      config: { method: 'onehot', columns: encCols.map(c => c.name) },
      details: encCols.map(c => `${c.name} (${c.unique_count || '?'} categorias)`).join(', '),
      autoApply: true,
    });
  }

  const highCardCols = categoricalCols.filter(c => (c.unique_count || 0) >= 20);
  if (highCardCols.length > 0) {
    suggestions.push({
      id: 'encode_high_card',
      type: 'encoder',
      priority: 'medium',
      title: 'Codificação Label — Alta Cardinalidade',
      description: `${highCardCols.length} coluna(s) com muitas categorias (≥20). Label Encoding ou Target Encoding são mais eficientes.`,
      icon: Tags,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10',
      badge: 'Opcional',
      badgeColor: 'bg-secondary text-muted-foreground',
      nodeType: 'encoder',
      config: { method: 'label', columns: highCardCols.map(c => c.name) },
      details: highCardCols.map(c => `${c.name} (${c.unique_count} categorias)`).join(', '),
      autoApply: false,
    });
  }

  return suggestions;
}

export default function SmartPreprocessor({ project, onApplySuggestions, onClose }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [aiInsight, setAiInsight] = useState('');

  const analyze = async () => {
    setAnalyzing(true);
    setAiInsight('');
    await new Promise(r => setTimeout(r, 800));
    const result = analyzeDataset(project);
    setSuggestions(result);
    const autoSelected = new Set(result.filter(s => s.autoApply).map(s => s.id));
    setSelected(autoSelected);

    // AI commentary
    try {
      const cols = (project.column_info || []).slice(0, 10).map(c =>
        `${c.name}(${c.type},${(c.null_percent || 0).toFixed(0)}%nulo,${c.unique_count || '?'}únicos)`
      ).join('; ');
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente de Machine Learning. Analise brevemente este dataset e dê 2 observações práticas em português (máx. 60 palavras total). Colunas: ${cols}. Linhas: ${project.dataset_size || '?'}. Formate como bullet points com •.`,
      });
      setAiInsight(res);
    } catch (_) {}
    setAnalyzing(false);
  };

  const toggleSuggestion = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const applySelected = async () => {
    if (selected.size === 0) return;
    setApplying(true);
    await new Promise(r => setTimeout(r, 400));
    const toApply = suggestions.filter(s => selected.has(s.id));
    onApplySuggestions(toApply);
    setApplying(false);
    onClose();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border/20 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Assistente Inteligente</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Análise automática do dataset e sugestões de pré-processamento
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {!suggestions && !analyzing && (
          <div className="text-center py-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <p className="text-xs text-muted-foreground mb-1">
              {project ? `Dataset: ${project.name}` : 'Nenhum dataset selecionado'}
            </p>
            {project && (
              <p className="text-[10px] text-muted-foreground mb-4">
                {project.dataset_size?.toLocaleString('pt-BR')} linhas · {project.dataset_columns} colunas
              </p>
            )}
            <Button
              onClick={analyze}
              disabled={!project}
              className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs h-8"
            >
              <Wand2 className="w-3.5 h-3.5 mr-1.5" />
              Analisar Dataset
            </Button>
          </div>
        )}

        {analyzing && (
          <div className="space-y-3">
            {['Analisando tipos de colunas...', 'Detectando valores ausentes...', 'Verificando escala...', 'Gerando recomendações IA...'].map((msg, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.18 }}
                className="flex items-center gap-2.5 p-2.5 rounded-lg bg-secondary/20">
                <Loader2 className="w-3.5 h-3.5 text-primary animate-spin flex-shrink-0" />
                <span className="text-xs text-muted-foreground">{msg}</span>
              </motion.div>
            ))}
          </div>
        )}

        {suggestions && (
          <AnimatePresence>
            {/* AI Insight */}
            {aiInsight && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-lg bg-accent/5 border border-accent/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3 text-accent" />
                  <span className="text-[9px] font-bold text-accent uppercase tracking-wide">Análise IA</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-line">{aiInsight}</p>
              </motion.div>
            )}

            {suggestions.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-6">
                <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <p className="text-xs font-semibold text-emerald-400">Dataset bem estruturado!</p>
                <p className="text-[10px] text-muted-foreground mt-1">Nenhum pré-processamento crítico detectado.</p>
              </motion.div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">{suggestions.length} sugestões</p>
                  <button onClick={() => setSelected(new Set(suggestions.filter(s => s.autoApply).map(s => s.id)))}
                    className="text-[9px] text-primary hover:underline">resetar seleção</button>
                </div>

                {suggestions.map(s => (
                  <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    onClick={() => toggleSuggestion(s.id)}
                    className={cn(
                      'p-3 rounded-lg border transition-all cursor-pointer',
                      selected.has(s.id)
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border/30 bg-secondary/10 hover:border-border/50'
                    )}>
                    <div className="flex items-start gap-2.5">
                      <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', s.bg)}>
                        <s.icon className={cn('w-3.5 h-3.5', s.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <p className="text-[11px] font-semibold text-foreground">{s.title}</p>
                          <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded-full', s.badgeColor)}>{s.badge}</span>
                        </div>
                        <p className="text-[9px] text-muted-foreground leading-relaxed">{s.description}</p>
                        {s.details && <p className="text-[8px] text-muted-foreground/60 mt-1 font-mono truncate">{s.details}</p>}
                      </div>
                      <div className={cn('w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                        selected.has(s.id) ? 'border-primary bg-primary' : 'border-border/40 bg-transparent')}>
                        {selected.has(s.id) && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        )}
      </div>

      {suggestions && selected.size > 0 && (
        <div className="p-4 border-t border-border/20 bg-card/50">
          <Button
            onClick={applySelected}
            disabled={applying}
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs font-semibold"
          >
            {applying
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Aplicando...</>
              : <><ChevronRight className="w-3.5 h-3.5 mr-1.5" />Aplicar {selected.size} transformação(ões) ao Pipeline</>
            }
          </Button>
          <p className="text-[9px] text-muted-foreground text-center mt-1.5">Blocos serão adicionados e conectados automaticamente</p>
        </div>
      )}
    </div>
  );
}