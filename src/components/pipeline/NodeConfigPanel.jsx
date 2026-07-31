import React from 'react';
import { cn } from '@/lib/utils';
import { NODE_TYPES } from './NodeTypes';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Trash2, Settings2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export default function NodeConfigPanel({ node, projects, onUpdateNode, onDeleteNode }) {
  if (!node) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <Settings2 className="w-8 h-8 text-muted-foreground/30 mb-3" />
        <p className="text-xs text-muted-foreground">Selecione um bloco no canvas para configurar</p>
      </div>
    );
  }

  const type = NODE_TYPES[node.type];
  const cfg = node.config || {};

  const updateCfg = (key, value) => {
    onUpdateNode(node.id, { config: { ...cfg, [key]: value } });
  };
  const updateLabel = (label) => onUpdateNode(node.id, { label });

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/20">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className={cn('text-xs font-bold', type?.textColor)}>{type?.label}</p>
            <p className="text-[9px] text-muted-foreground capitalize">{type?.category}</p>
          </div>
          <button onClick={() => onDeleteNode(node.id)} className="text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {/* Label */}
        <div className="space-y-1.5">
          <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Rótulo (opcional)</Label>
          <Input
            value={node.label || ''}
            onChange={e => updateLabel(e.target.value)}
            placeholder="Nome descritivo..."
            className="h-7 text-xs bg-secondary/40"
          />
        </div>

        {/* Data Source */}
        {node.type === 'data_source' && (
          <div className="space-y-1.5">
            <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Projeto / Dataset</Label>
            <Select
              value={cfg.project_id || ''}
              onValueChange={v => {
                const proj = projects.find(p => p.id === v);
                onUpdateNode(node.id, { config: { ...cfg, project_id: v }, projectName: proj?.name, label: proj?.name });
              }}
            >
              <SelectTrigger className="h-7 text-xs bg-secondary/40"><SelectValue placeholder="Selecionar projeto..." /></SelectTrigger>
              <SelectContent>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.dataset_size ? `(${p.dataset_size.toLocaleString('pt-BR')} linhas)` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Imputer */}
        {node.type === 'imputer' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Estratégia de Imputação</Label>
              <Select value={cfg.strategy || 'mean'} onValueChange={v => updateCfg('strategy', v)}>
                <SelectTrigger className="h-7 text-xs bg-secondary/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mean">Mean — Média aritmética</SelectItem>
                  <SelectItem value="median">Median — Mediana</SelectItem>
                  <SelectItem value="mode">Mode — Moda (mais frequente)</SelectItem>
                  <SelectItem value="constant">Constant — Valor fixo</SelectItem>
                  <SelectItem value="ffill">Forward Fill</SelectItem>
                  <SelectItem value="drop">Drop — Remover linhas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {cfg.strategy === 'constant' && (
              <div className="space-y-1.5">
                <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Valor Constante</Label>
                <Input value={cfg.fill_value || ''} onChange={e => updateCfg('fill_value', e.target.value)} placeholder="ex: 0" className="h-7 text-xs bg-secondary/40" />
              </div>
            )}
            <ColumnList label="Colunas Alvo" value={cfg.columns || []} onChange={v => updateCfg('columns', v)} placeholder="col1, col2, ..." />
          </div>
        )}

        {/* Scaler */}
        {node.type === 'scaler' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Método de Normalização</Label>
              <Select value={cfg.method || 'standard'} onValueChange={v => updateCfg('method', v)}>
                <SelectTrigger className="h-7 text-xs bg-secondary/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">StandardScaler — Z-score (μ=0, σ=1)</SelectItem>
                  <SelectItem value="minmax">MinMaxScaler — [0, 1]</SelectItem>
                  <SelectItem value="robust">RobustScaler — IQR (resistente a outliers)</SelectItem>
                  <SelectItem value="log">Log Transform — log(1+x)</SelectItem>
                  <SelectItem value="sqrt">Sqrt Transform — √x</SelectItem>
                  <SelectItem value="normalize">L2 Normalize — por linha</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ColumnList label="Colunas Numéricas" value={cfg.columns || []} onChange={v => updateCfg('columns', v)} placeholder="col1, col2, ..." />
          </div>
        )}

        {/* Encoder */}
        {node.type === 'encoder' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Método de Codificação</Label>
              <Select value={cfg.method || 'onehot'} onValueChange={v => updateCfg('method', v)}>
                <SelectTrigger className="h-7 text-xs bg-secondary/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="onehot">One-Hot Encoding</SelectItem>
                  <SelectItem value="label">Label Encoding — inteiros</SelectItem>
                  <SelectItem value="ordinal">Ordinal Encoding</SelectItem>
                  <SelectItem value="binary">Binary Encoding</SelectItem>
                  <SelectItem value="target">Target Encoding</SelectItem>
                  <SelectItem value="frequency">Frequency Encoding</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <ColumnList label="Colunas Categóricas" value={cfg.columns || []} onChange={v => updateCfg('columns', v)} placeholder="col1, col2, ..." />
          </div>
        )}

        {/* Split */}
        {node.type === 'split' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Proporção Teste (%)</Label>
              <Input
                type="number" min="5" max="50" step="5"
                value={Math.round((cfg.test_size || 0.2) * 100)}
                onChange={e => updateCfg('test_size', Number(e.target.value) / 100)}
                className="h-7 text-xs bg-secondary/40"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Random State (seed)</Label>
              <Input type="number" value={cfg.random_state || 42} onChange={e => updateCfg('random_state', Number(e.target.value))} className="h-7 text-xs bg-secondary/40" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Estratificar</Label>
              <Switch checked={!!cfg.stratify} onCheckedChange={v => updateCfg('stratify', v)} />
            </div>
          </div>
        )}

        {/* Model Classification */}
        {node.type === 'model_classification' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Algoritmo</Label>
              <Select value={cfg.algorithm || 'random_forest'} onValueChange={v => updateCfg('algorithm', v)}>
                <SelectTrigger className="h-7 text-xs bg-secondary/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="random_forest">Random Forest</SelectItem>
                  <SelectItem value="logistic_regression">Logistic Regression</SelectItem>
                  <SelectItem value="gradient_boosting">Gradient Boosting</SelectItem>
                  <SelectItem value="xgboost">XGBoost</SelectItem>
                  <SelectItem value="svm">SVM</SelectItem>
                  <SelectItem value="knn">KNN</SelectItem>
                  <SelectItem value="decision_tree">Decision Tree</SelectItem>
                  <SelectItem value="naive_bayes">Naive Bayes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Coluna Alvo (Target)</Label>
              <Input value={cfg.target_column || ''} onChange={e => updateCfg('target_column', e.target.value)} placeholder="nome_da_coluna" className="h-7 text-xs bg-secondary/40" />
            </div>
          </div>
        )}

        {/* Model Regression */}
        {node.type === 'model_regression' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Algoritmo</Label>
              <Select value={cfg.algorithm || 'linear_regression'} onValueChange={v => updateCfg('algorithm', v)}>
                <SelectTrigger className="h-7 text-xs bg-secondary/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="linear_regression">Linear Regression</SelectItem>
                  <SelectItem value="ridge">Ridge Regression</SelectItem>
                  <SelectItem value="lasso">Lasso Regression</SelectItem>
                  <SelectItem value="random_forest">Random Forest Regressor</SelectItem>
                  <SelectItem value="gradient_boosting">Gradient Boosting Regressor</SelectItem>
                  <SelectItem value="svr">SVR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Coluna Alvo (Target)</Label>
              <Input value={cfg.target_column || ''} onChange={e => updateCfg('target_column', e.target.value)} placeholder="nome_da_coluna" className="h-7 text-xs bg-secondary/40" />
            </div>
          </div>
        )}

        {/* Model Clustering */}
        {node.type === 'model_clustering' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Algoritmo</Label>
              <Select value={cfg.algorithm || 'kmeans'} onValueChange={v => updateCfg('algorithm', v)}>
                <SelectTrigger className="h-7 text-xs bg-secondary/40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kmeans">K-Means</SelectItem>
                  <SelectItem value="dbscan">DBSCAN</SelectItem>
                  <SelectItem value="hierarchical">Hierarchical</SelectItem>
                  <SelectItem value="gaussian_mixture">Gaussian Mixture</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Nº de Clusters (K)</Label>
              <Input type="number" min="2" max="20" value={cfg.n_clusters || 3} onChange={e => updateCfg('n_clusters', Number(e.target.value))} className="h-7 text-xs bg-secondary/40" />
            </div>
          </div>
        )}

        {/* Filter Rows */}
        {node.type === 'filter_rows' && (
          <div className="space-y-1.5">
            <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Condição (ex: age {'>'} 18)</Label>
            <Input value={cfg.condition || ''} onChange={e => updateCfg('condition', e.target.value)} placeholder="coluna > valor" className="h-7 text-xs bg-secondary/40" />
          </div>
        )}

        {/* Select Columns */}
        {node.type === 'select_columns' && (
          <ColumnList label="Colunas a Manter" value={cfg.columns || []} onChange={v => updateCfg('columns', v)} placeholder="col1, col2, ..." />
        )}

        {/* Feature Engineering */}
        {node.type === 'feature_engineering' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Nova Coluna</Label>
              <Input value={cfg.new_column || ''} onChange={e => updateCfg('new_column', e.target.value)} placeholder="nome_nova_coluna" className="h-7 text-xs bg-secondary/40" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">Fórmula</Label>
              <Input value={cfg.formula || ''} onChange={e => updateCfg('formula', e.target.value)} placeholder="col_a + col_b * 2" className="h-7 text-xs bg-secondary/40" />
              <p className="text-[8px] text-muted-foreground">Use nomes de colunas e operadores +, -, *, /</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ColumnList({ label, value, onChange, placeholder }) {
  const text = Array.isArray(value) ? value.join(', ') : value;
  return (
    <div className="space-y-1.5">
      <Label className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</Label>
      <Input
        value={text}
        onChange={e => onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
        placeholder={placeholder}
        className="h-7 text-xs bg-secondary/40"
      />
      <p className="text-[8px] text-muted-foreground">Separado por vírgulas. Vazio = todas as colunas.</p>
    </div>
  );
}