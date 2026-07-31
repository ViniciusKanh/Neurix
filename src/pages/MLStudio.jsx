import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/ui/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import GlowCard from '@/components/ui/GlowCard';
import AnalysisResult from '@/components/ml/AnalysisResult';
import ModelComparison from '@/components/ml/ModelComparison';
import { Brain, Play, Loader2, GitCompare, Settings2, Trash2, Wrench, Pencil } from 'lucide-react';

import { runClassification, runRegression, runClustering, runAnomalyDetection, runDimReduction, runFeatureSelection } from '@/lib/localML';
import { runRealClassification, runRealRegression, runRealClustering } from '@/lib/realML';
import { datarowsApi } from '@/api/base44Client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const TASK_TYPES = [
  { value: 'classification', label: 'Classificação', desc: 'Prever categorias ou classes', needsTarget: true },
  { value: 'regression', label: 'Regressão', desc: 'Prever valores contínuos', needsTarget: true },
  { value: 'clustering', label: 'Agrupamento (Clustering)', desc: 'Descobrir grupos naturais nos dados', needsTarget: false },
  { value: 'anomaly_detection', label: 'Detecção de Anomalias', desc: 'Identificar padrões incomuns', needsTarget: false },
  { value: 'dimensionality_reduction', label: 'Redução de Dimensionalidade', desc: 'PCA, t-SNE, UMAP para simplificar dados', needsTarget: false },
  { value: 'feature_selection', label: 'Seleção de Features', desc: 'Identificar variáveis mais importantes', needsTarget: true },
];

const SPLIT_OPTIONS = ['70/30', '80/20', '75/25', '60/40'];

// Only the models the local engine actually trains (real, no external libs).
const MODEL_OPTIONS = {
  classification: [
    { value: 'all', label: 'Todos os modelos (recomendado)' },
    { value: 'logistic_regression', label: 'Regressão Logística' },
    { value: 'decision_tree', label: 'Árvore de Decisão' },
    { value: 'knn', label: 'K-Nearest Neighbors' },
    { value: 'naive_bayes', label: 'Naive Bayes' },
  ],
  regression: [
    { value: 'all', label: 'Todos os modelos (recomendado)' },
    { value: 'linear_regression', label: 'Regressão Linear' },
    { value: 'decision_tree', label: 'Árvore de Decisão' },
    { value: 'knn', label: 'K-Nearest Neighbors' },
  ],
};
const CV_OPTIONS = ['Sem CV', 'K-Fold (5)', 'K-Fold (10)', 'StratifiedKFold (5)', 'Leave-One-Out'];
const BALANCING_OPTIONS = ['Nenhum', 'SMOTE', 'RandomOverSampler', 'RandomUnderSampler', 'SMOTEENN'];

const TABS = [
  { id: 'analysis', label: 'Análises ML', icon: Brain },
  { id: 'comparison', label: 'Comparação de Modelos', icon: GitCompare },
];

// Prompts removed — now using local ML engine (lib/localML.js)
const _UNUSED = {
  classification: (project, target, split, cv, balance) => `
Simule uma análise de CLASSIFICAÇÃO completa sobre o dataset.
Modelos obrigatórios (min 4): Regressão Logística, Random Forest, XGBoost, SVM, Gradient Boosting.
Split: ${split} | Validação cruzada: ${cv} | Balanceamento: ${balance}
Coluna alvo: ${target || 'detectar automaticamente'}

Para cada modelo retorne:
- accuracy, precision, recall, f1_score, auc, training_time (simulado)
- Matriz de confusão resumida (TP, TN, FP, FN)
- Feature importance (top 10)
- Comparação entre modelos com ranking
- Interpretação SHAP dos top features
- Recomendação clara do melhor modelo com justificativa técnica`,

  regression: (project, target, split, cv, balance) => `
Simule uma análise de REGRESSÃO completa.
Modelos: Regressão Linear, Ridge, Lasso, ElasticNet, Random Forest, XGBoost, SVR.
Split: ${split} | Validação cruzada: ${cv}
Coluna alvo: ${target || 'detectar automaticamente'}

Para cada modelo retorne:
- rmse, mae, mape, r2_score, adjusted_r2
- Análise de resíduos
- Feature importance (top 10)
- Curva de aprendizado (simulada)
- Diagnóstico de overfitting/underfitting`,

  clustering: (project, target, split, cv, balance) => `
Simule uma análise de AGRUPAMENTO (Clustering) completa.
Algoritmos: K-Means, DBSCAN, Agglomerative, Gaussian Mixture.
Analise k=2 a k=7 para K-Means.

Retorne:
- Silhouette score para cada k e algoritmo
- Davies-Bouldin index
- Calinski-Harabasz score
- Perfil detalhado de cada cluster (tamanho, features características, interpretação)
- Comparação entre algoritmos
- k ótimo recomendado com justificativa`,

  anomaly_detection: (project, target, split, cv, balance) => `
Simule uma análise de DETECÇÃO DE ANOMALIAS completa.
Algoritmos: Isolation Forest, Local Outlier Factor, One-Class SVM, DBSCAN, AutoEncoder.

Retorne:
- Percentual de anomalias por algoritmo
- Scores de anomalia (distribuição)
- Top 10 registros mais anômalos com pontuações
- Features mais relevantes para as anomalias
- Comparação de performance entre algoritmos
- Threshold recomendado para cada algoritmo`,

  dimensionality_reduction: (project, target, split, cv, balance) => `
Simule uma análise de REDUÇÃO DE DIMENSIONALIDADE.
Técnicas: PCA, t-SNE, UMAP, Factor Analysis, Autoencoders.

Retorne:
- Variância explicada por componente (PCA)
- Número recomendado de componentes
- Loadings das principais componentes (top features)
- Qualidade da projeção por técnica
- Interpretação dos eixos principais
- Recomendação da técnica mais adequada`,

  feature_selection: (project, target, split, cv, balance) => `
Simule uma análise de SELEÇÃO DE FEATURES.
Técnicas: Filter (correlação, chi2, ANOVA), Wrapper (RFE, RFECV), Embedded (Lasso, Random Forest importance).
Coluna alvo: ${target || 'detectar automaticamente'}

Retorne:
- Ranking das features por importância (todas as técnicas)
- Features redundantes ou correlacionadas
- Subset ótimo de features recomendado
- Impacto na performance ao remover features
- Features com multicolinearidade (VIF)
- Recomendação final`,
};

export default function MLStudio() {
  const urlParams = new URLSearchParams(window.location.search);
  const projectIdFromUrl = urlParams.get('project');
  const taskFromUrl = urlParams.get('task')?.toLowerCase()?.replace(/\s+/g, '_') || '';

  const [activeTab, setActiveTab] = useState('analysis');
  const [selectedProjectId, setSelectedProjectId] = useState(projectIdFromUrl || '');
  const [taskType, setTaskType] = useState(TASK_TYPES.find(t => t.value === taskFromUrl) ? taskFromUrl : '');
  const [targetColumn, setTargetColumn] = useState('');
  const [splitRatio, setSplitRatio] = useState('80/20');
  const [cvStrategy, setCvStrategy] = useState('K-Fold (5)');
  const [balancing, setBalancing] = useState('Nenhum');
  const [isRunning, setIsRunning] = useState(false);
  const [expandConfig, setExpandConfig] = useState(false);
  const [selectedModel, setSelectedModel] = useState('all');
  const [customName, setCustomName] = useState('');
  const queryClient = useQueryClient();
  void Wrench;

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  const { data: analyses = [], isLoading: loadingAnalyses } = useQuery({
    queryKey: ['analyses', selectedProjectId],
    queryFn: () => base44.entities.Analysis.filter({ project_id: selectedProjectId }, '-created_date', 20),
    enabled: !!selectedProjectId,
  });

  const projectsWithData = projects.filter(p => p.dataset_file_url);
  const project = projectsWithData.find(p => p.id === selectedProjectId);
  const taskDef = TASK_TYPES.find(t => t.value === taskType);

  const runAnalysis = async () => {
    if (!selectedProjectId || !taskType) return toast.error('Selecione o projeto e o tipo de análise');
    if (taskDef?.needsTarget && !targetColumn) return toast.error('Selecione a coluna alvo para este tipo de análise');
    setIsRunning(true);

    const nameMap = {
      classification: 'Classificação', regression: 'Regressão', clustering: 'Agrupamento',
      anomaly_detection: 'Detecção de Anomalias', dimensionality_reduction: 'Redução de Dimensionalidade',
      feature_selection: 'Seleção de Features',
    };
    // Nome: usa o nome informado pelo usuário; senão gera um padrão com o modelo.
    // A DATA fica sempre automática (created_date), não entra no nome.
    const label = nameMap[taskType] || taskType;
    const modelPart = (taskType === 'classification' || taskType === 'regression') && selectedModel && selectedModel !== 'all'
      ? ` · ${selectedModel}` : '';
    const analysisName = customName.trim() || `${label}${modelPart}`;

    const analysis = await base44.entities.Analysis.create({
      project_id: selectedProjectId, type: taskType, name: analysisName, status: 'running',
      config: { target_column: targetColumn, split: splitRatio, cv: cvStrategy, balancing, selected_model: selectedModel },
    });
    setCustomName('');

    try {
      // Try REAL training on the full stored rows; fall back to the estimator.
      let rows = [];
      try {
        const r = await datarowsApi.getAll(selectedProjectId, 20000);
        rows = r.rows || [];
      } catch { rows = []; }

      const testRatio = (() => { const m = /\/(\d+)/.exec(splitRatio || ''); return m ? Math.min(0.5, Math.max(0.1, parseInt(m[1]) / 100)) : 0.2; })();
      const canReal = rows.length >= 20 && ['classification', 'regression', 'clustering'].includes(taskType);

      let result; let realUsed = false;
      if (canReal && taskType === 'classification') { result = runRealClassification(rows, targetColumn, project.column_info, testRatio, selectedModel); realUsed = !result.error; }
      else if (canReal && taskType === 'regression') { result = runRealRegression(rows, targetColumn, project.column_info, testRatio, selectedModel); realUsed = !result.error; }
      else if (canReal && taskType === 'clustering') { result = runRealClustering(rows, project.column_info, 3); realUsed = !result.error; }

      // Fallback (no rows stored, or real engine returned an error/edge case)
      if (!result || result.error) {
        realUsed = false;
        await new Promise(r => setTimeout(r, 600));
        if (taskType === 'classification') result = runClassification(project, targetColumn, splitRatio, cvStrategy, balancing);
        else if (taskType === 'regression') result = runRegression(project, targetColumn, splitRatio, cvStrategy);
        else if (taskType === 'clustering') result = runClustering(project);
        else if (taskType === 'anomaly_detection') result = runAnomalyDetection(project);
        else if (taskType === 'dimensionality_reduction') result = runDimReduction(project);
        else if (taskType === 'feature_selection') result = runFeatureSelection(project, targetColumn);
        else result = { interpretation: 'Análise concluída.', recommendations: [] };
      }

      result.training_mode = realUsed ? 'real' : 'estimado';

      // When a specific model is chosen, focus the result on it (works for both
      // real training and the estimator) so it differs from "Todos os modelos".
      if (selectedModel && selectedModel !== 'all' && Array.isArray(result.models_comparison)) {
        const nameMap = { logistic_regression: 'Regressão Logística', decision_tree: 'Árvore de Decisão', knn: 'KNN', naive_bayes: 'Naive Bayes', linear_regression: 'Regressão Linear' };
        const wanted = nameMap[selectedModel];
        const found = wanted && result.models_comparison.find((m) => m.name === wanted || (m.name || '').toLowerCase().includes(wanted.toLowerCase()));
        if (found) {
          result.models_comparison = [found];
          result.metrics = found.metrics;
          result.best_model = found.name;
          if (found.confusion_matrix) result.confusion_matrix = found.confusion_matrix;
          result.interpretation = `**Modelo específico: ${found.name}**\n\n` + (result.interpretation || '');
        }
      }

      await base44.entities.Analysis.update(analysis.id, {
        status: 'completed', results: result,
        ai_interpretation: result?.interpretation || '',
        ai_recommendations: result?.recommendations || [],
      });

      queryClient.invalidateQueries({ queryKey: ['analyses', selectedProjectId] });
      toast.success(realUsed ? `Treino real concluído sobre ${(result.trained_on || rows.length).toLocaleString('pt-BR')} linhas!` : 'Análise concluída (estimativa — projeto sem linhas armazenadas).');
    } catch (err) {
      try { await base44.entities.Analysis.update(analysis.id, { status: 'failed', ai_interpretation: `Falha: ${err.message}` }); } catch { /* ignore */ }
      queryClient.invalidateQueries({ queryKey: ['analyses', selectedProjectId] });
      toast.error(`Falha ao treinar: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  const deleteAnalysis = async (id, e) => {
    e.stopPropagation();
    await base44.entities.Analysis.delete(id);
    queryClient.invalidateQueries({ queryKey: ['analyses', selectedProjectId] });
    toast.success('Análise removida');
  };

  const renameAnalysis = async (a, e) => {
    e.stopPropagation();
    const novo = window.prompt('Novo nome da análise (a data permanece automática):', a.name);
    if (novo == null) return;
    const name = novo.trim();
    if (!name || name === a.name) return;
    await base44.entities.Analysis.update(a.id, { name });
    queryClient.invalidateQueries({ queryKey: ['analyses', selectedProjectId] });
    toast.success('Análise renomeada');
  };

  const nonAssocAnalyses = analyses.filter(a => a.type !== 'association_rules');

  return (
    <div>
      <PageHeader title="ML Studio" subtitle="Treine, avalie e compare modelos de machine learning" />

      {/* Project selector */}
      <GlowCard className="mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">Projeto Ativo:</Label>
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="bg-secondary/50 w-full sm:w-72">
              <SelectValue placeholder="Selecione um projeto com dataset" />
            </SelectTrigger>
            <SelectContent>
              {projectsWithData.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {project && (
            <span className="text-xs text-muted-foreground">
              {project.dataset_size?.toLocaleString('pt-BR')} linhas · {project.dataset_columns} colunas
            </span>
          )}
        </div>
      </GlowCard>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-secondary/30 p-1 rounded-lg w-fit">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200',
              activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Comparison Tab */}
      {activeTab === 'comparison' && (
        selectedProjectId
          ? <ModelComparison analyses={analyses} />
          : <EmptyState icon={Brain} title="Selecione um projeto" description="Escolha um projeto para comparar modelos" />
      )}

      {/* ML Analysis Tab */}
      {activeTab === 'analysis' && (
        <div>
          {/* Config */}
          <GlowCard className="mb-6">
            {/* Task types */}
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tipo de Análise ML</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mt-2">
                {TASK_TYPES.map(t => (
                  <button key={t.value} onClick={() => { setTaskType(t.value); setTargetColumn(''); }}
                    className={cn('p-2.5 rounded-lg border text-left transition-all',
                      taskType === t.value ? 'border-primary/50 bg-primary/10' : 'border-border/40 bg-secondary/30 hover:border-border'
                    )}
                  >
                    <p className={cn('text-xs font-medium leading-tight', taskType === t.value ? 'text-primary' : 'text-foreground')}>{t.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Main params */}
            <div className="flex flex-wrap items-end gap-3">
              {(taskType === 'classification' || taskType === 'regression') && (
                <div>
                  <Label className="text-xs text-muted-foreground">Modelo Específico</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="mt-1 bg-secondary/50 w-52">
                      <SelectValue placeholder="Selecione o modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(MODEL_OPTIONS[taskType] || []).map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground">Nome da análise (opcional)</Label>
                <Input
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  placeholder="ex.: Random Forest v1"
                  className="mt-1 bg-secondary/50 w-56"
                />
              </div>

              {taskDef?.needsTarget && project && (
                <div>
                  <Label className="text-xs text-muted-foreground">Coluna Alvo *</Label>
                  <Select value={targetColumn} onValueChange={setTargetColumn}>
                    <SelectTrigger className="mt-1 bg-secondary/50 w-48">
                      <SelectValue placeholder="Selecione a coluna alvo" />
                    </SelectTrigger>
                    <SelectContent>
                      {(project.column_info || []).map(c => (
                        <SelectItem key={c.name} value={c.name}>{c.name} <span className="text-muted-foreground">({c.type})</span></SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <button onClick={() => setExpandConfig(!expandConfig)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                <Settings2 className="w-3.5 h-3.5" />
                {expandConfig ? 'Ocultar' : 'Configurações avançadas'}
              </button>

              <div className="ml-auto">
                <Button onClick={runAnalysis} disabled={isRunning || !selectedProjectId || !taskType}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
                  {isRunning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executando...</> : <><Play className="w-4 h-4 mr-2" /> Executar Análise</>}
                </Button>
              </div>
            </div>

            {/* Advanced config */}
            {expandConfig && (
              <div className="mt-4 pt-4 border-t border-border/30 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Split Treino/Teste</Label>
                  <Select value={splitRatio} onValueChange={setSplitRatio}>
                    <SelectTrigger className="mt-1 h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                    <SelectContent>{SPLIT_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Validação Cruzada</Label>
                  <Select value={cvStrategy} onValueChange={setCvStrategy}>
                    <SelectTrigger className="mt-1 h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                    <SelectContent>{CV_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {['classification'].includes(taskType) && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Balanceamento de Classes</Label>
                    <Select value={balancing} onValueChange={setBalancing}>
                      <SelectTrigger className="mt-1 h-8 text-xs bg-background/50"><SelectValue /></SelectTrigger>
                      <SelectContent>{BALANCING_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}
          </GlowCard>

          {/* Results */}
          {loadingAnalyses ? (
            <LoadingSpinner text="Carregando análises..." />
          ) : nonAssocAnalyses.length === 0 ? (
            <EmptyState icon={Brain} title="Nenhuma análise ainda" description="Configure e execute sua primeira análise de ML acima" />
          ) : (
            <div className="space-y-6">
              {nonAssocAnalyses.map(a => (
                <div key={a.id} className="relative group">
                  <div className="absolute top-3 right-3 z-10 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
                    <button
                      onClick={(e) => renameAnalysis(a, e)}
                      className="p-1.5 rounded-lg bg-card/80 border border-border/30 text-muted-foreground hover:text-primary hover:border-primary/30 transition-all"
                      title="Renomear análise"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => deleteAnalysis(a.id, e)}
                      className="p-1.5 rounded-lg bg-card/80 border border-border/30 text-muted-foreground hover:text-destructive hover:border-destructive/30 transition-all"
                      title="Remover análise"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground mb-1 pl-1">
                    {a.created_date ? new Date(a.created_date).toLocaleString('pt-BR') : ''}
                  </p>
                  <AnalysisResult analysis={a} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}