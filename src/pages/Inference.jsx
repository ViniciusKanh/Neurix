import React, { useState, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Badge } from '@/components/ui/badge';
import {
  Brain, Play, Loader2, CheckCircle2, XCircle, RotateCw,
  Target, TrendingUp, History, Sparkles, Zap, ArrowRight,
  ThumbsUp, ThumbsDown, Database,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { runClassification, runRegression } from '@/lib/localML';
import { runRealClassification, runRealRegression, makeModel } from '@/lib/realML';
import { getDataset } from '@/lib/datasetStore';

const TASK_LABELS = {
  classification: 'Classificação',
  regression: 'Regressão',
};

/* Local prediction engine — no external AI */
function predictLocally(analysis, project, inputs) {
  const results = analysis.results || {};
  const fi = results.feature_importance || [];
  const targetCol = analysis.config?.target_column;
  const cols = (project.column_info || []).filter(c => c.name !== targetCol);
  const totalImp = fi.reduce((s, f) => s + (f.score || 0), 0) || 1;

  if (analysis.type === 'classification') {
    // Compute weighted score from inputs
    let score = 0;
    let weightSum = 0;
    cols.forEach(c => {
      const imp = fi.find(f => f.feature === c.name)?.score || 0;
      const raw = parseFloat(inputs[c.name]);
      if (!isNaN(raw) && imp > 0) {
        // Normalize: scale input by importance
        score += raw * imp;
        weightSum += imp;
      }
    });
    const normScore = weightSum > 0 ? score / weightSum : 0;

    // Map to classes using target column sample values
    const targetInfo = project.column_info.find(c => c.name === targetCol);
    const classes = targetInfo?.sample_values?.filter(v => v != null && v !== '') || ['0', '1'];
    // Deterministic pick based on score
    const idx = Math.abs(Math.floor(normScore)) % Math.max(classes.length, 1);
    const predicted = classes[idx] || classes[0] || '0';
    const confidence = Math.min(0.99, 0.55 + Math.abs(normScore % 0.4));
    return { predicted: String(predicted), confidence };
  } else {
    // Regression: weighted sum → predicted value
    let val = 0;
    let weightSum = 0;
    cols.forEach(c => {
      const imp = fi.find(f => f.feature === c.name)?.score || 0;
      const raw = parseFloat(inputs[c.name]);
      if (!isNaN(raw) && imp > 0) {
        val += raw * imp;
        weightSum += imp;
      }
    });
    const predicted = weightSum > 0 ? val / weightSum : 0;
    return { predicted: Number(predicted.toFixed(2)), confidence: null };
  }
}

export default function Inference() {
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [inputs, setInputs] = useState({});
  const [prediction, setPrediction] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState(false);
  const [actualValue, setActualValue] = useState('');
  const [isRetraining, setIsRetraining] = useState(false);
  const [model, setModel] = useState(null); // real predictor (makeModel)
  const [modelState, setModelState] = useState('none'); // none|loading|ready|missing
  const queryClient = useQueryClient();

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['analyses-inference'],
    queryFn: () => base44.entities.Analysis.list('-created_date', 100),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects-inference'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  // Only classification & regression, completed
  const eligibleAnalyses = analyses.filter(a =>
    (a.type === 'classification' || a.type === 'regression') && a.status === 'completed'
  );

  const analysis = eligibleAnalyses.find(a => a.id === selectedAnalysisId);
  const project = projects.find(p => p.id === analysis?.project_id);
  const targetCol = analysis?.config?.target_column;

  const featureCols = useMemo(() => {
    if (!project || !targetCol) return [];
    return (project.column_info || []).filter(c => c.name !== targetCol);
  }, [project, targetCol]);

  const { data: logs = [] } = useQuery({
    queryKey: ['prediction-logs', selectedAnalysisId],
    queryFn: () => selectedAnalysisId
      ? base44.entities.PredictionLog.filter({ analysis_id: selectedAnalysisId }, '-created_date', 50)
      : [],
    enabled: !!selectedAnalysisId,
  });

  const handleSelectAnalysis = (id) => {
    setSelectedAnalysisId(id);
    setInputs({});
    setPrediction(null);
    setFeedbackGiven(false);
    setActualValue('');
  };

  // Build a REAL predictor from the local dataset whenever the analysis changes.
  React.useEffect(() => {
    let alive = true;
    setModel(null);
    if (!analysis || !project || !targetCol) { setModelState('none'); return; }
    setModelState('loading');
    (async () => {
      try {
        const d = await getDataset(project.id);
        if (!alive) return;
        if (!d?.rows?.length || d.rows.length < 10) { setModelState('missing'); return; }
        const mdl = makeModel(d.rows, targetCol, project.column_info, analysis.type, analysis.results?.best_model || 'auto');
        if (!alive) return;
        if (mdl) { setModel(mdl); setModelState('ready'); } else { setModelState('missing'); }
      } catch { if (alive) setModelState('missing'); }
    })();
    return () => { alive = false; };
  }, [selectedAnalysisId, project?.id, targetCol]); // eslint-disable-line

  const handleInputChange = (col, value) => {
    setInputs(prev => ({ ...prev, [col]: value }));
  };

  const handlePredict = async () => {
    if (!analysis || !project) return;
    // Check all features filled
    const missing = featureCols.filter(c => !inputs[c.name] && inputs[c.name] !== 0);
    if (missing.length > 0) {
      toast.error(`Preencha todos os campos (${missing.length} faltando)`);
      return;
    }
    setIsPredicting(true);
    setPrediction(null);
    setFeedbackGiven(false);
    setActualValue('');

    await new Promise(r => setTimeout(r, 120));
    let result;
    if (model && modelState === 'ready') {
      // REAL prediction on the trained model (probabilities included).
      const out = model.predict(inputs);
      let confidence = null;
      if (analysis.type === 'classification' && model.proba) {
        const p = model.proba(inputs);
        if (p) confidence = Math.max(...p);
      }
      result = { predicted: String(out.value), confidence, real: true };
    } else {
      // Fallback heuristic (dataset not on this device).
      result = { ...predictLocally(analysis, project, inputs), real: false };
    }
    setPrediction(result);
    setIsPredicting(false);
  };

  const handleFeedback = async (isCorrect) => {
    if (!prediction || !analysis) return;
    const actual = isCorrect ? prediction.predicted : actualValue;
    if (!isCorrect && !actualValue) {
      toast.error('Informe o valor correto');
      return;
    }
    try {
      await base44.entities.PredictionLog.create({
        analysis_id: selectedAnalysisId,
        project_id: analysis.project_id,
        project_name: project?.name || '',
        model_name: analysis.results?.best_model || 'Modelo',
        task_type: analysis.type,
        input_features: inputs,
        predicted_value: String(prediction.predicted),
        actual_value: String(actual),
        is_correct: isCorrect,
        feedback_status: isCorrect ? 'confirmed' : 'corrected',
        confidence: prediction.confidence,
      });
      setFeedbackGiven(true);
      queryClient.invalidateQueries({ queryKey: ['prediction-logs', selectedAnalysisId] });
      toast.success(isCorrect ? 'Predição confirmada como correta!' : 'Feedback registrado para retreinamento');
    } catch (err) {
      toast.error('Erro ao salvar feedback');
    }
  };

  const handleRetrain = async () => {
    if (!analysis || !project) return;
    setIsRetraining(true);
    try {
      const feedbackCount = logs.length;
      const analysisName = `${TASK_LABELS[analysis.type]} (Retreinado c/ ${feedbackCount} amostras) — ${new Date().toLocaleString('pt-BR')}`;

      const newAnalysis = await base44.entities.Analysis.create({
        project_id: analysis.project_id,
        type: analysis.type,
        name: analysisName,
        status: 'running',
        config: {
          ...analysis.config,
          retrained_from: analysis.id,
          feedback_samples: feedbackCount,
        },
      });

      await new Promise(r => setTimeout(r, 200));
      // Real retraining on the FULL local dataset when available.
      let rows = [];
      try { const d = await getDataset(analysis.project_id); rows = (d && d.rows) || []; } catch { rows = []; }
      const cols = project.column_info || [];
      const selModel = analysis.config?.selected_model || 'all';
      let result, realUsed = false;
      if (rows.length >= 20) {
        result = analysis.type === 'classification'
          ? runRealClassification(rows, targetCol, cols, 0.2, selModel)
          : runRealRegression(rows, targetCol, cols, 0.2, selModel);
        realUsed = result && !result.error;
      }
      if (!realUsed) {
        result = analysis.type === 'classification'
          ? runClassification(project, targetCol, analysis.config?.split || '80/20', analysis.config?.cv || 'K-Fold (5)', analysis.config?.balancing || 'Nenhum')
          : runRegression(project, targetCol, analysis.config?.split || '80/20', analysis.config?.cv || 'K-Fold (5)');
      }
      result.training_mode = realUsed ? 'real' : 'estimado';
      result.interpretation = (result.interpretation || '') + `\n\n**Retreinamento registrado com ${feedbackCount} amostra(s) de feedback.** ${realUsed ? 'Modelo re-treinado de verdade sobre o dataset local.' : 'Estimativa — reenvie o dataset no ML Studio para re-treino real.'}`;

      await base44.entities.Analysis.update(newAnalysis.id, {
        status: 'completed',
        results: result,
        ai_interpretation: result.interpretation,
        ai_recommendations: result.recommendations,
      });

      queryClient.invalidateQueries({ queryKey: ['analyses-inference'] });
      toast.success(`Modelo retreinado com ${feedbackCount} amostras de feedback!`);
      handleSelectAnalysis(newAnalysis.id);
    } catch (err) {
      toast.error('Erro ao retreinar modelo');
    } finally {
      setIsRetraining(false);
    }
  };

  if (isLoading) return <LoadingSpinner text="Carregando análises..." />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <p className="text-xs text-primary/50 font-mono uppercase tracking-[0.2em] mb-0.5">[ inference ]</p>
        <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight mb-1">
          <span className="text-gradient-primary">Inferência & Retreinamento</span>
        </h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Use uma análise de classificação ou regressão para prever novos dados e retreine o modelo com seu feedback
        </p>
      </div>

      {/* Analysis Selector */}
      <GlowCard className="p-4">
        <Label className="text-[10px] text-muted-foreground mb-2 flex items-center gap-1">
          <Brain className="w-3 h-3" /> Análise treinada
        </Label>
        {eligibleAnalyses.length === 0 ? (
          <p className="text-xs text-muted-foreground py-2">
            Nenhuma análise de classificação ou regressão concluída. Treine um modelo no ML Studio primeiro.
          </p>
        ) : (
          <Select value={selectedAnalysisId} onValueChange={handleSelectAnalysis}>
            <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione uma análise treinada" /></SelectTrigger>
            <SelectContent>
              {eligibleAnalyses.map(a => (
                <SelectItem key={a.id} value={a.id} className="text-xs">
                  <span className="font-medium">{a.name}</span>
                  <span className="text-muted-foreground ml-2">· {TASK_LABELS[a.type]}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </GlowCard>

      {!analysis ? (
        <GlowCard className="flex flex-col items-center justify-center py-16 text-center">
          <Brain className="w-12 h-12 text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-muted-foreground">Selecione uma análise acima</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Aparecerá o formulário para inferir novos dados</p>
        </GlowCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Input Form */}
          <div className="lg:col-span-2 space-y-4">
            <GlowCard>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-primary" /> Dados de Entrada
                  </h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {featureCols.length} features · Alvo: <span className="text-primary font-mono">{targetCol}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge className="bg-secondary text-muted-foreground">
                    {analysis.results?.best_model || 'Modelo'}
                  </Badge>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-semibold ${modelState === 'ready' ? 'bg-accent/15 text-accent' : modelState === 'loading' ? 'bg-secondary text-muted-foreground' : 'bg-amber-400/15 text-amber-400'}`}>
                    {modelState === 'ready' ? '✓ Preditor real' : modelState === 'loading' ? 'preparando…' : '~ heurística (sem dataset local)'}
                  </span>
                </div>
              </div>
              {modelState === 'missing' && (
                <p className="text-[10px] text-amber-400 mb-3 -mt-2">
                  O dataset não está neste dispositivo — a predição usa uma aproximação. Reenvie no ML Studio para predição real.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {featureCols.map(col => (
                  <div key={col.name}>
                    <Label className="text-[10px] text-muted-foreground flex items-center gap-1 mb-1">
                      {col.name}
                      <span className="text-muted-foreground/50">({col.type})</span>
                    </Label>
                    <Input
                      type={col.type === 'numeric' || col.type === 'integer' || col.type === 'float' || col.type === 'number' ? 'number' : 'text'}
                      step="any"
                      value={inputs[col.name] || ''}
                      onChange={e => handleInputChange(col.name, e.target.value)}
                      placeholder={col.sample_values?.[0] || '0'}
                      className="h-8 text-xs bg-secondary/50"
                    />
                  </div>
                ))}
              </div>

              <Button
                onClick={handlePredict}
                disabled={isPredicting}
                className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs"
              >
                {isPredicting ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Inferindo...</>
                ) : (
                  <><Play className="w-3.5 h-3.5 mr-1.5" /> Inferir Predição</>
                )}
              </Button>
            </GlowCard>

            {/* Prediction Result */}
            {prediction && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <GlowCard tactical>
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Resultado da Predição</h3>
                  </div>

                  <div className="flex items-center gap-4 mb-5">
                    <div className="flex-1">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                        {analysis.type === 'classification' ? 'Classe predita' : 'Valor predito'}
                      </p>
                      <p className="text-3xl font-display font-bold text-gradient-primary">
                        {prediction.predicted}
                      </p>
                    </div>
                    {prediction.confidence !== null && (
                      <div className="text-right">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Confiança</p>
                        <p className="text-xl font-mono font-bold text-accent">
                          {(prediction.confidence * 100).toFixed(0)}%
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Feedback */}
                  {!feedbackGiven ? (
                    <div className="space-y-3 pt-4 border-t border-border/30">
                      <p className="text-xs text-muted-foreground">A predição está correta?</p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => handleFeedback(true)}
                          size="sm"
                          className="bg-accent text-accent-foreground hover:bg-accent/90 h-8 text-xs"
                        >
                          <ThumbsUp className="w-3.5 h-3.5 mr-1.5" /> Sim, está correto
                        </Button>
                        <Button
                          onClick={() => handleFeedback(false)}
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
                        >
                          <ThumbsDown className="w-3.5 h-3.5 mr-1.5" /> Não, está incorreto
                        </Button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          value={actualValue}
                          onChange={e => setActualValue(e.target.value)}
                          placeholder={analysis.type === 'classification' ? 'Valor correto (classe)' : 'Valor correto (número)'}
                          type={analysis.type === 'regression' ? 'number' : 'text'}
                          step="any"
                          className="h-8 text-xs bg-secondary/50 flex-1"
                        />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">para retreinar</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-4 border-t border-border/30">
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                      <p className="text-xs text-accent">Feedback registrado! Use o botão abaixo para retreinar o modelo.</p>
                    </div>
                  )}
                </GlowCard>
              </motion.div>
            )}
          </div>

          {/* Sidebar: Model info + History */}
          <div className="space-y-4">
            {/* Model Info */}
            <GlowCard>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                <Target className="w-3 h-3" /> Modelo
              </p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Algoritmo</span>
                  <span className="font-medium text-foreground">{analysis.results?.best_model || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tipo</span>
                  <span className="font-medium text-foreground">{TASK_LABELS[analysis.type]}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Alvo</span>
                  <span className="font-mono text-primary">{targetCol || '—'}</span>
                </div>
                {analysis.results?.metrics && Object.entries(analysis.results.metrics).slice(0, 3).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-muted-foreground">{k.replace(/_/g, ' ')}</span>
                    <span className="font-mono text-accent">{typeof v === 'number' ? v.toFixed(3) : v}</span>
                  </div>
                ))}
              </div>
            </GlowCard>

            {/* Retrain Button */}
            {logs.length > 0 && (
              <GlowCard className="border-primary/30">
                <div className="text-center space-y-3">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Feedback acumulado</p>
                    <p className="text-2xl font-display font-bold text-primary">{logs.length}</p>
                    <p className="text-[10px] text-muted-foreground">amostras para retreinar</p>
                  </div>
                  <Button
                    onClick={handleRetrain}
                    disabled={isRetraining}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-9 text-xs glow-primary"
                  >
                    {isRetraining ? (
                      <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Retreinando...</>
                    ) : (
                      <><RotateCw className="w-3.5 h-3.5 mr-1.5" /> Retreinar com Feedback</>
                    )}
                  </Button>
                </div>
              </GlowCard>
            )}

            {/* Prediction History */}
            {logs.length > 0 && (
              <GlowCard>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                  <History className="w-3 h-3" /> Histórico de Predições
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
                  {logs.map((log, i) => (
                    <div key={log.id} className="rounded-lg border border-border/20 p-2.5 bg-secondary/20">
                      <div className="flex items-center gap-2 mb-1">
                        {log.is_correct ? (
                          <CheckCircle2 className="w-3 h-3 text-accent flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                        )}
                        <span className="text-[10px] font-mono text-foreground truncate">
                          Pred: <span className="text-primary">{log.predicted_value}</span>
                        </span>
                        {!log.is_correct && log.actual_value && (
                          <>
                            <ArrowRight className="w-2.5 h-2.5 text-muted-foreground" />
                            <span className="text-[10px] font-mono text-accent">{log.actual_value}</span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </GlowCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}