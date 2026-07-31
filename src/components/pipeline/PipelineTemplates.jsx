import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Play, Sparkles, TrendingUp, Network, AlertTriangle,
  ArrowUpDown, Brain, Wand2, Search, RefreshCw, Target,
  Shield, GitMerge, Clock, Filter, Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TEMPLATES = [
  {
    id: 'classification_full',
    label: 'Classificação Completa',
    description: 'Pipeline completo: imputação → normalização → encoding → split → Random Forest + avaliação',
    icon: Brain,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/30',
    taskType: 'classification',
    difficulty: 'Iniciante',
    tags: ['supervisionado', 'classificação'],
    nodes: [
      { type: 'data_source', label: 'Dataset', x: 60, y: 200 },
      { type: 'imputer', label: 'Imputar Nulos', x: 300, y: 100, config: { strategy: 'mean', columns: [] } },
      { type: 'scaler', label: 'Normalizar', x: 300, y: 220, config: { method: 'standard', columns: [] } },
      { type: 'encoder', label: 'One-Hot Encoding', x: 300, y: 340, config: { method: 'onehot', columns: [] } },
      { type: 'split', label: 'Train/Test Split 80/20', x: 560, y: 220, config: { test_size: 0.2, stratify: true, random_state: 42 } },
      { type: 'model_classification', label: 'Random Forest', x: 820, y: 140, config: { algorithm: 'random_forest', target_column: '' } },
      { type: 'evaluator', label: 'Avaliar Modelo', x: 820, y: 300 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' }, { from: 0, to: 3, port: 'data' },
      { from: 1, to: 4, port: 'data' }, { from: 2, to: 4, port: 'data' }, { from: 3, to: 4, port: 'data' },
      { from: 4, to: 5, fromPort: 'train', toPort: 'train', port: 'train' },
      { from: 4, to: 6, fromPort: 'test', toPort: 'test', port: 'test' },
      { from: 5, to: 6, fromPort: 'model', toPort: 'model', port: 'model' },
    ]
  },
  {
    id: 'regression_quick',
    label: 'Regressão com XGBoost',
    description: 'Regressão otimizada: limpeza + normalização + XGBoost para previsão de valores contínuos',
    icon: TrendingUp,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    border: 'border-cyan-400/30',
    taskType: 'regression',
    difficulty: 'Iniciante',
    tags: ['supervisionado', 'regressão'],
    nodes: [
      { type: 'data_source', label: 'Dataset', x: 60, y: 180 },
      { type: 'imputer', label: 'Imputar Mediana', x: 280, y: 100, config: { strategy: 'median', columns: [] } },
      { type: 'scaler', label: 'MinMaxScaler', x: 280, y: 240, config: { method: 'minmax', columns: [] } },
      { type: 'split', label: 'Split 80/20', x: 500, y: 170, config: { test_size: 0.2, stratify: false, random_state: 42 } },
      { type: 'model_regression', label: 'XGBoost Regressor', x: 720, y: 100, config: { algorithm: 'xgboost', target_column: '' } },
      { type: 'evaluator', label: 'Avaliar (RMSE/R²)', x: 720, y: 250 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' },
      { from: 1, to: 3, port: 'data' }, { from: 2, to: 3, port: 'data' },
      { from: 3, to: 4, fromPort: 'train', toPort: 'train', port: 'train' },
      { from: 3, to: 5, fromPort: 'test', toPort: 'test', port: 'test' },
      { from: 4, to: 5, fromPort: 'model', toPort: 'model', port: 'model' },
    ]
  },
  {
    id: 'clustering_explore',
    label: 'Clusterização K-Means',
    description: 'Segmentação de clientes/produtos: normalização + K-Means para descoberta de padrões',
    icon: Network,
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/30',
    taskType: 'clustering',
    difficulty: 'Iniciante',
    tags: ['não-supervisionado', 'agrupamento'],
    nodes: [
      { type: 'data_source', label: 'Dataset', x: 60, y: 160 },
      { type: 'select_columns', label: 'Selecionar Features', x: 280, y: 80, config: { columns: [] } },
      { type: 'imputer', label: 'Imputar', x: 280, y: 200, config: { strategy: 'mean', columns: [] } },
      { type: 'scaler', label: 'StandardScaler', x: 280, y: 320, config: { method: 'standard', columns: [] } },
      { type: 'model_clustering', label: 'K-Means (k=3)', x: 520, y: 200, config: { algorithm: 'kmeans', n_clusters: 3 } },
      { type: 'output', label: 'Exportar Clusters', x: 740, y: 200 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' }, { from: 0, to: 3, port: 'data' },
      { from: 1, to: 4, port: 'data' }, { from: 2, to: 4, port: 'data' }, { from: 3, to: 4, port: 'data' },
      { from: 4, to: 5, port: 'model' },
    ]
  },
  {
    id: 'anomaly_detect',
    label: 'Detecção de Anomalias',
    description: 'Isolation Forest para encontrar fraudes, erros e outliers em dados de produção',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    border: 'border-orange-400/30',
    taskType: 'anomaly_detection',
    difficulty: 'Intermediário',
    tags: ['anomalia', 'fraude'],
    nodes: [
      { type: 'data_source', label: 'Dataset', x: 60, y: 180 },
      { type: 'imputer', label: 'Imputar Mediana', x: 280, y: 100, config: { strategy: 'median', columns: [] } },
      { type: 'outlier_removal', label: 'Remover Outliers Extremos', x: 280, y: 240, config: { method: 'iqr', threshold: 3.0, columns: [] } },
      { type: 'scaler', label: 'RobustScaler', x: 280, y: 360, config: { method: 'robust', columns: [] } },
      { type: 'model_clustering', label: 'Isolation Forest', x: 520, y: 220, config: { algorithm: 'dbscan', n_clusters: 2 } },
      { type: 'output', label: 'Exportar Anomalias', x: 740, y: 220 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' }, { from: 0, to: 3, port: 'data' },
      { from: 1, to: 4, port: 'data' }, { from: 2, to: 4, port: 'data' }, { from: 3, to: 4, port: 'data' },
      { from: 4, to: 5, port: 'model' },
    ]
  },
  {
    id: 'feature_engineering_full',
    label: 'Feature Engineering Avançado',
    description: 'Engenharia completa: seleção + transformações + novas features + Gradient Boosting',
    icon: Wand2,
    color: 'text-teal-400',
    bg: 'bg-teal-400/10',
    border: 'border-teal-400/30',
    taskType: 'classification',
    difficulty: 'Intermediário',
    tags: ['features', 'engenharia'],
    nodes: [
      { type: 'data_source', label: 'Dataset', x: 60, y: 240 },
      { type: 'deduplicate', label: 'Remover Duplicatas', x: 280, y: 100, config: { columns: [] } },
      { type: 'select_columns', label: 'Selecionar Colunas', x: 280, y: 220, config: { columns: [] } },
      { type: 'imputer', label: 'Imputar', x: 280, y: 340, config: { strategy: 'mean', columns: [] } },
      { type: 'feature_engineering', label: 'Nova Feature Combinada', x: 520, y: 120, config: { new_column: 'feature_nova', formula: 'col_a * col_b' } },
      { type: 'encoder', label: 'One-Hot', x: 520, y: 260, config: { method: 'onehot', columns: [] } },
      { type: 'scaler', label: 'StandardScaler', x: 520, y: 380, config: { method: 'standard', columns: [] } },
      { type: 'split', label: 'Split 75/25', x: 760, y: 260, config: { test_size: 0.25, stratify: true, random_state: 0 } },
      { type: 'model_classification', label: 'Gradient Boosting', x: 980, y: 160, config: { algorithm: 'gradient_boosting', target_column: '' } },
      { type: 'evaluator', label: 'Avaliação Completa', x: 980, y: 320 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' }, { from: 0, to: 3, port: 'data' },
      { from: 2, to: 4, port: 'data' }, { from: 3, to: 5, port: 'data' }, { from: 3, to: 6, port: 'data' },
      { from: 4, to: 7, port: 'data' }, { from: 5, to: 7, port: 'data' }, { from: 6, to: 7, port: 'data' },
      { from: 7, to: 8, fromPort: 'train', toPort: 'train', port: 'train' },
      { from: 7, to: 9, fromPort: 'test', toPort: 'test', port: 'test' },
      { from: 8, to: 9, fromPort: 'model', toPort: 'model', port: 'model' },
    ]
  },
  {
    id: 'pca_dimensionality',
    label: 'Redução PCA + Visualização',
    description: 'Pipeline PCA: normalização → redução para 2D/3D → clustering para visualização interpretável',
    icon: ArrowUpDown,
    color: 'text-indigo-400',
    bg: 'bg-indigo-400/10',
    border: 'border-indigo-400/30',
    taskType: 'dimensionality_reduction',
    difficulty: 'Intermediário',
    tags: ['PCA', 'visualização'],
    nodes: [
      { type: 'data_source', label: 'Dataset', x: 60, y: 180 },
      { type: 'imputer', label: 'Imputar', x: 280, y: 100, config: { strategy: 'mean', columns: [] } },
      { type: 'scaler', label: 'StandardScaler', x: 280, y: 240, config: { method: 'standard', columns: [] } },
      { type: 'pca', label: 'PCA → 2 Componentes', x: 500, y: 170, config: { n_components: 2, method: 'pca' } },
      { type: 'model_clustering', label: 'K-Means no PCA', x: 720, y: 100, config: { algorithm: 'kmeans', n_clusters: 3 } },
      { type: 'output', label: 'Exportar 2D', x: 720, y: 240 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' },
      { from: 1, to: 3, port: 'data' }, { from: 2, to: 3, port: 'data' },
      { from: 3, to: 4, port: 'data' }, { from: 3, to: 5, port: 'data' },
      { from: 4, to: 5, port: 'model' },
    ]
  },
  {
    id: 'credit_scoring',
    label: 'Score de Crédito / Risco',
    description: 'Pipeline financeiro: limpeza rigorosa → encoding → remoção outliers → XGBoost para risco de crédito',
    icon: Shield,
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/30',
    taskType: 'classification',
    difficulty: 'Avançado',
    tags: ['finanças', 'risco', 'crédito'],
    nodes: [
      { type: 'data_source', label: 'Dataset Financeiro', x: 60, y: 220 },
      { type: 'deduplicate', label: 'Remover Duplicatas', x: 280, y: 100, config: { columns: [] } },
      { type: 'imputer', label: 'Imputar (Mediana)', x: 280, y: 220, config: { strategy: 'median', columns: [] } },
      { type: 'outlier_removal', label: 'Remover Outliers (IQR)', x: 280, y: 340, config: { method: 'iqr', threshold: 1.5, columns: [] } },
      { type: 'encoder', label: 'Encoding Binário', x: 520, y: 160, config: { method: 'onehot', columns: [] } },
      { type: 'scaler', label: 'RobustScaler', x: 520, y: 300, config: { method: 'robust', columns: [] } },
      { type: 'split', label: 'Stratified 80/20', x: 760, y: 230, config: { test_size: 0.2, stratify: true, random_state: 99 } },
      { type: 'model_classification', label: 'XGBoost Score', x: 980, y: 140, config: { algorithm: 'xgboost', target_column: 'default' } },
      { type: 'evaluator', label: 'AUC/KS/Gini', x: 980, y: 300 },
      { type: 'explain', label: 'SHAP Explicabilidade', x: 980, y: 440 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' }, { from: 0, to: 3, port: 'data' },
      { from: 1, to: 4, port: 'data' }, { from: 2, to: 4, port: 'data' }, { from: 3, to: 5, port: 'data' },
      { from: 4, to: 6, port: 'data' }, { from: 5, to: 6, port: 'data' },
      { from: 6, to: 7, fromPort: 'train', toPort: 'train', port: 'train' },
      { from: 6, to: 8, fromPort: 'test', toPort: 'test', port: 'test' },
      { from: 7, to: 8, fromPort: 'model', toPort: 'model', port: 'model' },
      { from: 7, to: 9, port: 'model' },
    ]
  },
  {
    id: 'nlp_text',
    label: 'Análise de Sentimentos / Texto',
    description: 'Pipeline NLP: encoding de texto → vetorização → classificação de sentimentos',
    icon: Search,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/30',
    taskType: 'classification',
    difficulty: 'Intermediário',
    tags: ['NLP', 'texto', 'sentimentos'],
    nodes: [
      { type: 'data_source', label: 'Dataset Texto', x: 60, y: 180 },
      { type: 'filter_rows', label: 'Filtrar Nulos', x: 280, y: 100, config: { condition: 'texto != null' } },
      { type: 'encoder', label: 'TF-IDF / Bag of Words', x: 280, y: 240, config: { method: 'label', columns: ['texto'] } },
      { type: 'scaler', label: 'Normalizar Vetores', x: 500, y: 170, config: { method: 'standard', columns: [] } },
      { type: 'split', label: 'Split 80/20', x: 720, y: 170, config: { test_size: 0.2, stratify: true, random_state: 42 } },
      { type: 'model_classification', label: 'SVM / LogReg Texto', x: 940, y: 100, config: { algorithm: 'random_forest', target_column: 'sentimento' } },
      { type: 'evaluator', label: 'F1 / Precision / Recall', x: 940, y: 260 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' },
      { from: 1, to: 3, port: 'data' }, { from: 2, to: 3, port: 'data' },
      { from: 3, to: 4, port: 'data' },
      { from: 4, to: 5, fromPort: 'train', toPort: 'train', port: 'train' },
      { from: 4, to: 6, fromPort: 'test', toPort: 'test', port: 'test' },
      { from: 5, to: 6, fromPort: 'model', toPort: 'model', port: 'model' },
    ]
  },
  {
    id: 'churn_prediction',
    label: 'Previsão de Churn',
    description: 'Prever cancelamento de clientes: comportamento → features → modelo de retenção',
    icon: Target,
    color: 'text-pink-400',
    bg: 'bg-pink-400/10',
    border: 'border-pink-400/30',
    taskType: 'classification',
    difficulty: 'Intermediário',
    tags: ['churn', 'retenção', 'clientes'],
    nodes: [
      { type: 'data_source', label: 'Dados de Clientes', x: 60, y: 220 },
      { type: 'filter_rows', label: 'Clientes Ativos > 30 dias', x: 280, y: 120, config: { condition: 'dias_ativo > 30' } },
      { type: 'imputer', label: 'Imputar Nulos', x: 280, y: 260, config: { strategy: 'median', columns: [] } },
      { type: 'feature_engineering', label: 'Taxa de Engajamento', x: 500, y: 120, config: { new_column: 'engajamento', formula: 'logins / dias_ativo' } },
      { type: 'encoder', label: 'Encoding Plano/Região', x: 500, y: 280, config: { method: 'onehot', columns: ['plano', 'regiao'] } },
      { type: 'scaler', label: 'Normalizar', x: 500, y: 400, config: { method: 'standard', columns: [] } },
      { type: 'split', label: 'Stratified 80/20', x: 740, y: 260, config: { test_size: 0.2, stratify: true, random_state: 42 } },
      { type: 'model_classification', label: 'Random Forest Churn', x: 960, y: 160, config: { algorithm: 'random_forest', target_column: 'churned' } },
      { type: 'evaluator', label: 'Métricas Churn', x: 960, y: 320 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' },
      { from: 1, to: 3, port: 'data' }, { from: 2, to: 4, port: 'data' }, { from: 2, to: 5, port: 'data' },
      { from: 3, to: 6, port: 'data' }, { from: 4, to: 6, port: 'data' }, { from: 5, to: 6, port: 'data' },
      { from: 6, to: 7, fromPort: 'train', toPort: 'train', port: 'train' },
      { from: 6, to: 8, fromPort: 'test', toPort: 'test', port: 'test' },
      { from: 7, to: 8, fromPort: 'model', toPort: 'model', port: 'model' },
    ]
  },
  {
    id: 'time_series_prep',
    label: 'Preparação de Séries Temporais',
    description: 'Feature engineering temporal: lag features + rolling window + modelo para previsão de séries',
    icon: Clock,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/30',
    taskType: 'regression',
    difficulty: 'Avançado',
    tags: ['séries temporais', 'forecasting'],
    nodes: [
      { type: 'data_source', label: 'Série Temporal', x: 60, y: 200 },
      { type: 'sort_rows', label: 'Ordenar por Data', x: 280, y: 120, config: { column: 'data', ascending: true } },
      { type: 'filter_rows', label: 'Filtrar Período', x: 280, y: 260, config: { condition: 'data >= 2020-01-01' } },
      { type: 'feature_engineering', label: 'Lag Feature (t-1)', x: 500, y: 120, config: { new_column: 'valor_lag1', formula: 'valor.shift(1)' } },
      { type: 'feature_engineering', label: 'Rolling Mean 7d', x: 500, y: 260, config: { new_column: 'media_7d', formula: 'valor.rolling(7).mean()' } },
      { type: 'imputer', label: 'Imputar Lags Nulos', x: 500, y: 380, config: { strategy: 'mean', columns: [] } },
      { type: 'split', label: 'Split Temporal', x: 740, y: 260, config: { test_size: 0.2, stratify: false, random_state: 0 } },
      { type: 'model_regression', label: 'XGBoost Forecast', x: 960, y: 160, config: { algorithm: 'xgboost', target_column: 'valor' } },
      { type: 'evaluator', label: 'MAE/RMSE/MAPE', x: 960, y: 320 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' },
      { from: 1, to: 3, port: 'data' }, { from: 2, to: 4, port: 'data' }, { from: 2, to: 5, port: 'data' },
      { from: 3, to: 6, port: 'data' }, { from: 4, to: 6, port: 'data' }, { from: 5, to: 6, port: 'data' },
      { from: 6, to: 7, fromPort: 'train', toPort: 'train', port: 'train' },
      { from: 6, to: 8, fromPort: 'test', toPort: 'test', port: 'test' },
      { from: 7, to: 8, fromPort: 'model', toPort: 'model', port: 'model' },
    ]
  },
  {
    id: 'hyperparameter_pipeline',
    label: 'AutoML com Tuning',
    description: 'Pipeline completo com tuning automático de hiperparâmetros via Random Search + cross-validation',
    icon: RefreshCw,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    border: 'border-violet-400/30',
    taskType: 'classification',
    difficulty: 'Avançado',
    tags: ['AutoML', 'tuning', 'cross-validation'],
    nodes: [
      { type: 'data_source', label: 'Dataset', x: 60, y: 200 },
      { type: 'imputer', label: 'Imputar', x: 280, y: 120, config: { strategy: 'mean', columns: [] } },
      { type: 'scaler', label: 'Normalizar', x: 280, y: 260, config: { method: 'standard', columns: [] } },
      { type: 'encoder', label: 'Encoding', x: 280, y: 380, config: { method: 'onehot', columns: [] } },
      { type: 'cross_validation', label: 'K-Fold CV (k=5)', x: 520, y: 260, config: { n_folds: 5, stratified: true, random_state: 42 } },
      { type: 'hyperparameter_tuning', label: 'Random Search 50 iter', x: 760, y: 160, config: { method: 'random_search', n_iter: 50 } },
      { type: 'model_classification', label: 'Melhor Modelo', x: 760, y: 340, config: { algorithm: 'gradient_boosting', target_column: '' } },
      { type: 'evaluator', label: 'Avaliação Final', x: 980, y: 260 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' }, { from: 0, to: 3, port: 'data' },
      { from: 1, to: 4, port: 'data' }, { from: 2, to: 4, port: 'data' }, { from: 3, to: 4, port: 'data' },
      { from: 4, to: 5, fromPort: 'train', toPort: 'train', port: 'train' },
      { from: 4, to: 6, fromPort: 'train', toPort: 'train', port: 'train' },
      { from: 5, to: 6, fromPort: 'model', toPort: 'model', port: 'model' },
      { from: 4, to: 7, fromPort: 'test', toPort: 'test', port: 'test' },
      { from: 6, to: 7, fromPort: 'model', toPort: 'model', port: 'model' },
    ]
  },
  {
    id: 'data_cleaning_only',
    label: 'Limpeza de Dados Completa',
    description: 'Pipeline exclusivo de limpeza: dedup + filtros + imputação + remoção de outliers → exportar limpo',
    icon: Filter,
    color: 'text-sky-400',
    bg: 'bg-sky-400/10',
    border: 'border-sky-400/30',
    taskType: 'exploration',
    difficulty: 'Iniciante',
    tags: ['limpeza', 'ETL', 'qualidade'],
    nodes: [
      { type: 'data_source', label: 'Dataset Bruto', x: 60, y: 180 },
      { type: 'deduplicate', label: 'Remover Duplicatas', x: 280, y: 80, config: { columns: [] } },
      { type: 'filter_rows', label: 'Filtrar Inválidos', x: 280, y: 220, config: { condition: 'id != null' } },
      { type: 'imputer', label: 'Imputar Nulos', x: 280, y: 340, config: { strategy: 'median', columns: [] } },
      { type: 'outlier_removal', label: 'Remover Outliers', x: 500, y: 200, config: { method: 'iqr', threshold: 1.5, columns: [] } },
      { type: 'select_columns', label: 'Selecionar Finais', x: 720, y: 200, config: { columns: [] } },
      { type: 'output', label: 'Exportar Limpo', x: 940, y: 200 },
    ],
    edges: [
      { from: 0, to: 1, port: 'data' }, { from: 0, to: 2, port: 'data' }, { from: 0, to: 3, port: 'data' },
      { from: 1, to: 4, port: 'data' }, { from: 2, to: 4, port: 'data' }, { from: 3, to: 4, port: 'data' },
      { from: 4, to: 5, port: 'data' },
      { from: 5, to: 6, port: 'data' },
    ]
  },
];

const DIFFICULTY_COLOR = {
  'Iniciante': 'text-emerald-400 bg-emerald-400/10',
  'Intermediário': 'text-amber-400 bg-amber-400/10',
  'Avançado': 'text-rose-400 bg-rose-400/10',
};

function genId(prefix = 'n') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

// Mini flow preview component
function MiniFlowPreview({ nodes }) {
  const step_types = ['data', 'transform', 'preprocessing', 'split', 'model', 'output'];
  const seen = new Set();
  const steps = nodes.reduce((acc, n) => {
    const category = n.category || 'data';
    if (!seen.has(category)) { seen.add(category); acc.push({ label: n.label, type: n.type }); }
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-1 flex-wrap mt-2">
      {nodes.map((n, i) => (
        <React.Fragment key={i}>
          <div className="px-1.5 py-0.5 rounded text-[8px] font-mono bg-secondary/40 text-muted-foreground truncate max-w-[80px]" title={n.label}>
            {n.label}
          </div>
          {i < nodes.length - 1 && <span className="text-primary/40 text-[8px]">→</span>}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function PipelineTemplates({ onLoadTemplate }) {
  const [search, setSearch] = useState('');
  const [preview, setPreview] = useState(null);
  const [filterDiff, setFilterDiff] = useState('Todos');

  const filtered = TEMPLATES.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = !q || t.label.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.tags.some(tag => tag.includes(q));
    const matchDiff = filterDiff === 'Todos' || t.difficulty === filterDiff;
    return matchSearch && matchDiff;
  });

  const loadTemplate = (tpl) => {
    const idMap = {};
    const nodes = tpl.nodes.map((n, i) => {
      const id = genId('tpl');
      idMap[i] = id;
      return { id, type: n.type, x: n.x, y: n.y, label: n.label, config: { ...(n.config || {}) } };
    });
    const edges = (tpl.edges || []).map(e => ({
      id: genId('edge'),
      from: idMap[e.from],
      to: idMap[e.to],
      fromPort: e.fromPort || e.port || 'data',
      toPort: e.toPort || e.port || 'data',
      portType: e.port || 'data',
    })).filter(e => e.from && e.to);
    onLoadTemplate(nodes, edges, `[${tpl.label}]`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-3 border-b border-border/20 flex-shrink-0 space-y-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
          <span className="text-[11px] font-bold text-foreground">{TEMPLATES.length} Templates</span>
        </div>
        <Input
          placeholder="Buscar template..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-6 text-[10px] bg-secondary/40 border-border/20"
        />
        <div className="flex gap-1">
          {['Todos', 'Iniciante', 'Intermediário', 'Avançado'].map(d => (
            <button
              key={d}
              onClick={() => setFilterDiff(d)}
              className={cn(
                'text-[8px] px-1.5 py-0.5 rounded font-medium transition-all',
                filterDiff === d ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {d === 'Todos' ? 'Todos' : d}
            </button>
          ))}
        </div>
      </div>

      {/* Template list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-2">
        <AnimatePresence>
          {filtered.map((tpl, idx) => (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ delay: idx * 0.03 }}
              className={cn(
                'rounded-lg border transition-all cursor-pointer',
                preview === tpl.id
                  ? `${tpl.border} ${tpl.bg}`
                  : 'border-border/20 bg-secondary/10 hover:border-border/40 hover:bg-secondary/20'
              )}
              onClick={() => setPreview(prev => prev === tpl.id ? null : tpl.id)}
            >
              <div className="p-2.5">
                <div className="flex items-start gap-2">
                  <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5', tpl.bg)}>
                    <tpl.icon className={cn('w-3 h-3', tpl.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-[10px] font-semibold text-foreground">{tpl.label}</p>
                      <span className={cn('text-[7px] px-1 py-0.5 rounded font-bold', DIFFICULTY_COLOR[tpl.difficulty])}>
                        {tpl.difficulty}
                      </span>
                    </div>
                    <p className="text-[9px] text-muted-foreground leading-relaxed mt-0.5 line-clamp-2">{tpl.description}</p>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <span className="text-[8px] font-mono bg-secondary/60 px-1 py-0.5 rounded text-muted-foreground">
                        {tpl.nodes.length} blocos
                      </span>
                      {tpl.tags.slice(0, 2).map(tag => (
                        <span key={tag} className="text-[7px] px-1 py-0.5 rounded bg-primary/10 text-primary/70 font-mono">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {preview === tpl.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mx-2.5 mb-2.5 pt-2 border-t border-border/20">
                      <p className="text-[8px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">Fluxo do pipeline:</p>
                      <MiniFlowPreview nodes={tpl.nodes} />
                      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                        <div className="bg-secondary/30 rounded p-1">
                          <p className="text-[9px] font-bold text-primary">{tpl.nodes.length}</p>
                          <p className="text-[7px] text-muted-foreground">blocos</p>
                        </div>
                        <div className="bg-secondary/30 rounded p-1">
                          <p className="text-[9px] font-bold text-accent">{tpl.edges.length}</p>
                          <p className="text-[7px] text-muted-foreground">conexões</p>
                        </div>
                        <div className="bg-secondary/30 rounded p-1">
                          <p className={cn('text-[9px] font-bold', tpl.color)}>{tpl.difficulty[0]}</p>
                          <p className="text-[7px] text-muted-foreground">nível</p>
                        </div>
                      </div>
                      <Button
                        onClick={(e) => { e.stopPropagation(); loadTemplate(tpl); }}
                        className="w-full h-7 text-[10px] bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
                      >
                        <Play className="w-3 h-3 mr-1.5" /> Carregar no Canvas
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-8">
            <p className="text-xs text-muted-foreground">Nenhum template encontrado</p>
          </div>
        )}
      </div>
    </div>
  );
}