import React from 'react';
import { cn } from '@/lib/utils';
import { NODE_TYPES, PORT_COLORS } from './NodeTypes';
import {
  Database, Filter, ArrowUpDown, Wrench, Tags, Wand2,
  Scissors, Brain, TrendingUp, Network, BarChart3, Download, Columns,
  PenLine, ArrowDownUp, Copy, ShieldAlert, Minimize2, RefreshCw,
  SlidersHorizontal, Lightbulb
} from 'lucide-react';

const ICONS = {
  Database, Filter, ArrowUpDown, Wrench, Tags, Wand2, Scissors,
  Brain, TrendingUp, Network, BarChart3, Download, Columns,
  PenLine, ArrowDownUp, Copy, ShieldAlert, Minimize2, RefreshCw,
  SlidersHorizontal, Lightbulb
};

const CAT_HEADER_COLORS = {
  data: 'from-primary/30 to-primary/10 border-primary/40',
  transform: 'from-amber-400/30 to-amber-400/10 border-amber-400/40',
  preprocessing: 'from-orange-400/25 to-cyan-400/10 border-orange-400/30',
  split: 'from-indigo-400/30 to-indigo-400/10 border-indigo-400/40',
  model: 'from-emerald-400/30 to-emerald-400/10 border-emerald-400/40',
  output: 'from-pink-400/30 to-pink-400/10 border-pink-400/40',
};

export default function PipelineNode({ node, isSelected, onDragStart, onStartConnect, onFinishConnect, connecting }) {
  const type = NODE_TYPES[node.type];
  if (!type) return null;

  const Icon = ICONS[type.icon] || Database;
  const headerGrad = CAT_HEADER_COLORS[type.category] || 'from-primary/20 to-primary/5 border-primary/30';

  const isCompatibleTarget = connecting && connecting.nodeId !== node.id;

  return (
    <div
      className={cn(
        'absolute rounded-xl border transition-all duration-100 select-none',
        'bg-card/90 backdrop-blur-sm',
        isSelected
          ? `${type.borderColor} shadow-lg`
          : 'border-border/30 hover:border-border/60',
        isCompatibleTarget && 'border-primary/60 shadow-[0_0_12px_hsl(185_100%_50%/0.25)]'
      )}
      style={{ left: node.x, top: node.y, width: 200, zIndex: isSelected ? 10 : 3 }}
      onMouseDown={(e) => onDragStart(node.id, e)}
      onMouseUp={() => isCompatibleTarget && onFinishConnect(node.id, null, type.inputs[0])}
    >
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-xl border-b bg-gradient-to-r', headerGrad)}>
        <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0', type.bgColor)}>
          <Icon className={cn('w-3 h-3', type.textColor)} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={cn('text-[10px] font-bold leading-none truncate', type.textColor)}>{type.label}</p>
          {node.label && <p className="text-[9px] text-muted-foreground truncate mt-0.5">{node.label}</p>}
        </div>
      </div>

      {/* Body */}
      <div className="px-3 py-2 min-h-[40px] flex items-center">
        <p className="text-[9px] text-muted-foreground leading-relaxed line-clamp-2">
          {getNodeSummary(node, type)}
        </p>
      </div>

      {/* Input ports (left) */}
      {type.inputs.map((port, i) => (
        <div
          key={`in-${port}`}
          className={cn(
            'absolute flex items-center gap-1 cursor-crosshair group',
          )}
          style={{ left: -8, top: 50 + i * 24, transform: 'translateY(-50%)' }}
          onMouseUp={(e) => { e.stopPropagation(); onFinishConnect(node.id, PORT_COLORS[port], port); }}
        >
          <div className={cn('w-3 h-3 rounded-full border-2 border-background transition-all group-hover:scale-125', PORT_COLORS[port] || 'bg-primary')} />
          <span className="text-[8px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity font-mono">{port}</span>
        </div>
      ))}

      {/* Output ports (right) */}
      {type.outputs.map((port, i) => (
        <div
          key={`out-${port}`}
          className="absolute flex items-center gap-1 cursor-crosshair group"
          style={{ right: -8, top: 50 + i * 24, transform: 'translateY(-50%)' }}
          onMouseDown={(e) => { e.stopPropagation(); onStartConnect(node.id, PORT_COLORS[port], port, e); }}
        >
          <span className="text-[8px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity font-mono">{port}</span>
          <div className={cn('w-3 h-3 rounded-full border-2 border-background transition-all group-hover:scale-125', PORT_COLORS[port] || 'bg-primary')} />
        </div>
      ))}
    </div>
  );
}

function getNodeSummary(node, type) {
  const cfg = node.config || {};
  if (node.type === 'data_source') return node.projectName ? `📂 ${node.projectName}` : 'Selecione o dataset';
  if (node.type === 'imputer') return `Estratégia: ${cfg.strategy || 'mean'} · ${cfg.columns?.length || 0} col.`;
  if (node.type === 'scaler') return `Método: ${cfg.method || 'standard'} · ${cfg.columns?.length || 0} col.`;
  if (node.type === 'encoder') return `Método: ${cfg.method || 'onehot'} · ${cfg.columns?.length || 0} col.`;
  if (node.type === 'split') return `Test: ${Math.round((cfg.test_size || 0.2) * 100)}% · Seed: ${cfg.random_state || 42}`;
  if (node.type === 'cross_validation') return `K-Fold: ${cfg.n_folds || 5} · ${cfg.stratified ? 'Estratificado' : 'Simples'}`;
  if (node.type === 'model_classification') return `Alg: ${cfg.algorithm || 'random_forest'} · Target: ${cfg.target_column || '?'}`;
  if (node.type === 'model_regression') return `Alg: ${cfg.algorithm || 'linear'} · Target: ${cfg.target_column || '?'}`;
  if (node.type === 'model_clustering') return `Alg: ${cfg.algorithm || 'kmeans'} · K=${cfg.n_clusters || 3}`;
  if (node.type === 'hyperparameter_tuning') return `${cfg.method || 'random_search'} · ${cfg.n_iter || 20} iter.`;
  if (node.type === 'filter_rows') return cfg.condition || 'Sem filtro definido';
  if (node.type === 'select_columns') return `${cfg.columns?.length || 0} colunas selecionadas`;
  if (node.type === 'rename_columns') return 'Renomear colunas';
  if (node.type === 'sort_rows') return `Por: ${cfg.column || '?'} (${cfg.ascending !== false ? 'ASC' : 'DESC'})`;
  if (node.type === 'deduplicate') return `Dedup: ${cfg.columns?.length || 0} col. chave`;
  if (node.type === 'feature_engineering') return cfg.formula || 'Fórmula não definida';
  if (node.type === 'outlier_removal') return `${cfg.method || 'iqr'} · threshold: ${cfg.threshold || 1.5}`;
  if (node.type === 'pca') return `${cfg.method?.toUpperCase() || 'PCA'} → ${cfg.n_components || 2} componentes`;
  if (node.type === 'evaluator') return 'Métricas de avaliação';
  if (node.type === 'output') return 'Exportar modelo treinado';
  if (node.type === 'explain') return 'SHAP values / importância';
  return type?.description || type?.label || node.type;
}