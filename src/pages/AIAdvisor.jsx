import React, { useState, useEffect, useMemo } from 'react';
import { base44, aiApi } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { motion } from 'framer-motion';
import {
  Sparkles, Wand2, Loader2, Save, Plus, Check, AlertTriangle, Lightbulb,
  ArrowRight, Settings2, Download, FileSpreadsheet,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { getDataset, saveDataset } from '@/lib/datasetStore';
import { buildProfile } from '@/lib/datasetProfile';
import { applySuggestion, validateSuggestion, transformLabel } from '@/lib/aiFeatures';
import { correlationMatrix, detectTargetLeakage } from '@/lib/dataQuality';
import { classBalance } from '@/lib/realML';
import { getAI, saveAI } from '@/lib/aiCache';
import { exportRowsToExcel, exportRowsToCSV, excelName, csvName } from '@/lib/exportDataset';

// transform family → accent color (encodes the kind of engineering move)
const FAMILY = {
  formula: 'hsl(187,92%,55%)', binning: 'hsl(265,70%,64%)', onehot: 'hsl(152,68%,52%)',
  label: 'hsl(40,100%,58%)', scale: 'hsl(210,90%,62%)', log: 'hsl(330,85%,64%)',
};
const SEV = { alto: 'hsl(0,80%,60%)', 'médio': 'hsl(40,100%,58%)', baixo: 'hsl(210,20%,55%)' };
const TASK_MAP = { classificação: 'classification', classificacao: 'classification', regressão: 'regression', regressao: 'regression', agrupamento: 'clustering', clustering: 'clustering' };

export default function AIAdvisor() {
  const { user } = useAuth();
  const [projectId, setProjectId] = useState('');
  const [target, setTarget] = useState('__none__');
  const [task, setTask] = useState('__none__');
  const [rows, setRows] = useState(null);
  const [dsState, setDsState] = useState('none'); // none|loading|ready|missing
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [cachedAt, setCachedAt] = useState(null); // when the shown analysis was generated
  const [stale, setStale] = useState(false);       // dataset changed since the cached analysis

  // working copy for applied features
  const [working, setWorking] = useState(null);
  const [appliedNames, setAppliedNames] = useState([]);
  const [appliedLog, setAppliedLog] = useState([]);
  const [saving, setSaving] = useState(false);

  const { data: status } = useQuery({ queryKey: ['ai-status'], queryFn: () => aiApi.status().catch(() => ({ configured: false, enabled: false })) });
  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const project = projects.find((p) => p.id === projectId);
  const cols = (project?.column_info || []).map((c) => c.name);

  useEffect(() => {
    let alive = true; setRows(null); setResult(null); setWorking(null); setAppliedNames([]); setAppliedLog([]); setTarget('__none__'); setTask('__none__'); setError(null); setCachedAt(null); setStale(false);
    if (!projectId) { setDsState('none'); return; }
    setDsState('loading');
    (async () => {
      try {
        const d = await getDataset(projectId);
        if (!alive) return;
        if (!d?.rows?.length) { setDsState('missing'); return; }
        setRows(d.rows); setWorking(d.rows); setDsState('ready');
        // Pull the LAST analysis from local cache (no token spend).
        const cached = await getAI(`advisor:${projectId}`);
        if (alive && cached?.data) {
          setResult(cached.data); setCachedAt(cached.savedAt);
          const sig = cached.signature;
          if (sig && (sig.rows !== d.rows.length || sig.cols !== Object.keys(d.rows[0]).length)) setStale(true);
        }
      } catch { if (alive) setDsState('missing'); }
    })();
    return () => { alive = false; };
  }, [projectId]);

  const currentCols = useMemo(() => (working?.length ? Object.keys(working[0]) : cols), [working, cols]);

  // Real signals computed by our own engine — grounds the AI so it doesn't guess.
  const computeSignals = (dataRows, colInfo, tgt, tsk) => {
    const signals = {};
    try { const corr = correlationMatrix(dataRows, colInfo, 0.8); if (!corr.error && corr.high_pairs?.length) signals.high_correlations = corr.high_pairs.slice(0, 10); } catch { /* */ }
    const constants = (colInfo || []).filter((c) => (c.unique_count || 0) === 1).map((c) => c.name);
    if (constants.length) signals.constant_columns = constants;
    if (tgt) {
      const inferred = tsk || (colInfo?.find((c) => c.name === tgt && ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((c.type || '').toLowerCase())) ? 'regression' : 'classification');
      try { const lk = detectTargetLeakage(dataRows, tgt, colInfo, inferred); if (lk.has_leak) signals.leakage = lk.leaks; } catch { /* */ }
      if (inferred === 'classification') { try { const b = classBalance(dataRows, tgt); if (!b.error) signals.class_balance = b; } catch { /* */ } }
    }
    return signals;
  };

  const analyze = async () => {
    if (!rows || !rows.length) { toast.error('Selecione um projeto com dataset neste dispositivo.'); return; }
    setRunning(true); setError(null);
    try {
      const tgt = target === '__none__' ? '' : target;
      const tsk = task === '__none__' ? '' : (task === 'classificação' ? 'classification' : task === 'regressão' ? 'regression' : 'clustering');
      const profile = buildProfile(rows, project?.column_info, { target: tgt, task: task === '__none__' ? '' : task });
      profile.signals = computeSignals(rows, project?.column_info, tgt, tsk);
      const r = await aiApi.analyze(profile);
      if (!r || (!r.suggested_features && !r.dataset_summary)) throw new Error('O Gemini respondeu, mas sem conteúdo utilizável. Tente novamente ou troque o modelo em Configurações → IA.');
      setResult(r); setCachedAt(new Date().toISOString()); setStale(false);
      await saveAI(`advisor:${projectId}`, r, { rows: rows.length, cols: Object.keys(rows[0]).length });
      toast.success('Análise concluída pelo Gemini.');
    } catch (e) {
      console.error('[AIAdvisor] analyze falhou:', e);
      setError(e.message || 'Falha ao analisar. Verifique a chave do Gemini em Configurações → IA e o deploy da API.');
      toast.error(e.message || 'Falha ao analisar.');
    } finally { setRunning(false); }
  };

  const apply = (sug) => {
    const err = validateSuggestion(sug, currentCols);
    if (err) return toast.error(err);
    const res = applySuggestion(working, sug);
    if (!res.added.length) return toast.error('A transformação não gerou colunas.');
    setWorking(res.rows); setAppliedNames((a) => [...new Set([...a, ...res.added])]); setAppliedLog((l) => [...l, res.report]);
    toast.success(`Feature aplicada: ${res.added.join(', ')}`);
  };

  const exportExcel = async () => {
    try { await exportRowsToExcel(working, excelName(`${project?.name || 'dataset'}_features`)); toast.success('Excel exportado — pronto para reimportar.'); }
    catch (e) { toast.error(e.message); }
  };
  const exportCsv = () => {
    try { exportRowsToCSV(working, csvName(`${project?.name || 'dataset'}_features`)); toast.success('CSV exportado.'); }
    catch (e) { toast.error(e.message); }
  };

  const saveWorking = async () => {
    setSaving(true);
    try {
      const colInfo = Object.keys(working[0]).map((name) => ({ name, type: working.every((r) => r[name] === '' || r[name] == null || !isNaN(parseFloat(r[name]))) ? 'number' : 'string' }));
      await saveDataset(projectId, working, colInfo, { filename: (project?.dataset_filename || 'dataset') + ' (IA features)', size: working.length });
      toast.success('Dataset atualizado com as novas features. Retreine no ML Studio para usá-las.');
    } catch (e) { toast.error('Falha ao salvar: ' + e.message); }
    finally { setSaving(false); }
  };

  const notReady = !status?.configured || !status?.enabled;

  return (
    <div>
      <PageHeader title="Consultor de Pré-processamento" subtitle="O Gemini analisa seu dataset e propõe limpeza, tarefas de ML e novas features — prontas para aplicar" icon={Sparkles} />

      {/* Setup gate */}
      {notReady && (
        <GlowCard className="mb-4 border-amber-400/30">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-400">{status?.configured ? 'Integração desativada' : 'Gemini ainda não configurado'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {user?.role === 'admin'
                  ? 'Cadastre a chave da API do Gemini e ative a integração em Configurações → IA para liberar o consultor.'
                  : 'Peça a um administrador para cadastrar a chave do Gemini em Configurações → IA.'}
              </p>
            </div>
            {user?.role === 'admin' && <Link to="/settings"><Button size="sm" variant="outline" className="border-amber-400/40 text-amber-400 hover:bg-amber-400/10"><Settings2 className="w-3.5 h-3.5 mr-1.5" /> Configurar</Button></Link>}
          </div>
        </GlowCard>
      )}

      {/* Controls */}
      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{projects.filter((p) => p.dataset_file_url).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Coluna-alvo (opcional)</label>
            <Select value={target} onValueChange={setTarget} disabled={dsState !== 'ready'}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none__">Deixar a IA sugerir</SelectItem>{cols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tarefa (opcional)</label>
            <Select value={task} onValueChange={setTask} disabled={dsState !== 'ready'}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none__">Deixar a IA sugerir</SelectItem><SelectItem value="classificação">Classificação</SelectItem><SelectItem value="regressão">Regressão</SelectItem><SelectItem value="agrupamento">Agrupamento</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={analyze} disabled={dsState !== 'ready' || running} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
              {running ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Analisando…</> : <><Wand2 className="w-4 h-4 mr-1.5" /> {result ? 'Analisar novamente' : 'Analisar com IA'}</>}
            </Button>
          </div>
        </div>
        {dsState === 'missing' && <p className="text-[11px] text-amber-400 mt-2">Dataset não está neste dispositivo — reenvie no ML Studio.</p>}
        {dsState === 'ready' && <p className="text-[10px] text-muted-foreground mt-2">Enviaremos ao Gemini apenas o perfil das colunas e uma amostra (até 12 linhas), nunca o dataset completo.</p>}
      </GlowCard>

      {/* Scanning hero */}
      {running && (
        <GlowCard className="mb-4 overflow-hidden relative">
          <div className="absolute inset-0 pointer-events-none">
            <motion.div initial={{ y: '-100%' }} animate={{ y: '100%' }} transition={{ repeat: Infinity, duration: 1.4, ease: 'linear' }} className="h-1/2 w-full" style={{ background: 'linear-gradient(hsl(187 92% 55% / 0), hsl(187 92% 55% / 0.14), hsl(187 92% 55% / 0))' }} />
          </div>
          <div className="relative flex items-center gap-3 py-6 justify-center">
            <Wand2 className="w-5 h-5 text-primary animate-pulse" />
            <p className="text-sm font-display tracking-wide text-foreground">Lendo o perfil do dataset e consultando o Gemini…</p>
          </div>
        </GlowCard>
      )}

      {error && !running && (
        <GlowCard className="mb-4 border-destructive/40 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-destructive">Não foi possível concluir a análise</p>
              <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
              <p className="text-[11px] text-muted-foreground mt-2">Verifique: (1) a chave e o modelo em Configurações → IA (botão “Testar chave”); (2) se a integração está <strong>Habilitada</strong>; (3) se o app foi reimplantado após adicionar o endpoint <code>/api/ai</code>.</p>
            </div>
          </div>
        </GlowCard>
      )}

      {!result && !running ? (
        <EmptyState icon={Sparkles} title="Nenhuma análise ainda" description="Selecione um projeto e clique em Analisar com IA para receber um diagnóstico, ações possíveis e sugestões de features." />
      ) : result && (
        <div className="space-y-4">
          {/* Diagnosis hero */}
          <div className="relative overflow-hidden rounded-2xl border border-primary/20 glass-strong hud-corners p-6">
            <div className="pointer-events-none absolute -right-10 -top-16 w-72 h-72 rounded-full bg-primary/10 blur-[90px]" />
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-primary/60 flex items-center gap-2"><Sparkles className="w-3.5 h-3.5" /> Diagnóstico · {result.model || 'Gemini'}</p>
              {cachedAt && <span className="text-[10px] text-muted-foreground">Gerada em {new Date(cachedAt).toLocaleString('pt-BR')} · salva localmente</span>}
            </div>
            {stale && (
              <p className="text-[11px] text-amber-400 mb-2">⚠ O dataset mudou desde esta análise. Clique em “Analisar novamente” para atualizar.</p>
            )}
            <p className="text-base sm:text-lg text-foreground leading-relaxed font-display max-w-3xl">{result.dataset_summary}</p>
          </div>

          {/* Possible actions — what you can do with this dataset */}
          {result.possible_actions?.length > 0 && (
            <GlowCard>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-primary" /> O que você pode fazer com estes dados</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {result.possible_actions.map((a, i) => {
                  const tone = a.type === 'modelo' ? 'hsl(265,70%,64%)' : a.type === 'negócio' ? 'hsl(152,68%,52%)' : 'hsl(187,92%,55%)';
                  return (
                    <div key={i} className="rounded-lg bg-secondary/25 p-3 border-t-2" style={{ borderColor: tone }}>
                      <span className="text-[9px] uppercase tracking-wide font-semibold" style={{ color: tone }}>{a.type || 'ação'}</span>
                      <p className="text-xs font-semibold text-foreground mt-0.5">{a.action}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{a.how}</p>
                    </div>
                  );
                })}
              </div>
            </GlowCard>
          )}

          {/* Recommended preprocessing pipeline */}
          {result.preprocessing_steps?.length > 0 && (
            <GlowCard>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><ArrowRight className="w-4 h-4 text-primary" /> Pipeline de pré-processamento recomendado</h3>
              <ol className="space-y-1.5">
                {result.preprocessing_steps.map((s, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs text-muted-foreground">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            </GlowCard>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Quality issues */}
            {result.quality_issues?.length > 0 && (
              <GlowCard>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> O que encontramos</h3>
                <div className="space-y-2">
                  {result.quality_issues.map((q, i) => (
                    <div key={i} className="rounded-lg bg-secondary/25 p-3 border-l-2" style={{ borderColor: SEV[q.severity] || SEV.baixo }}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-foreground">{q.issue}</span>
                        {q.severity && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: `${SEV[q.severity]}22`, color: SEV[q.severity] }}>{q.severity}</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground">→ {q.action}</p>
                    </div>
                  ))}
                </div>
              </GlowCard>
            )}

            {/* Recommended tasks */}
            {result.recommended_tasks?.length > 0 && (
              <GlowCard>
                <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4 text-primary" /> Tarefas recomendadas</h3>
                <div className="space-y-2">
                  {result.recommended_tasks.map((t, i) => {
                    const tkey = TASK_MAP[(t.task || '').toLowerCase()];
                    const href = tkey ? `/ml-studio?project=${projectId}&task=${tkey}` : `/ml-studio?project=${projectId}`;
                    return (
                      <div key={i} className="rounded-lg bg-secondary/25 p-3 flex items-start gap-3">
                        <div className="flex-1">
                          <p className="text-xs font-semibold text-foreground">{t.task}{t.target ? <span className="text-muted-foreground"> · alvo <code className="text-primary">{t.target}</code></span> : ''}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{t.reason}</p>
                        </div>
                        <Link to={href} className="text-primary hover:text-primary/80 flex-shrink-0 mt-0.5" title="Abrir no ML Studio"><ArrowRight className="w-4 h-4" /></Link>
                      </div>
                    );
                  })}
                </div>
              </GlowCard>
            )}
          </div>

          {/* Suggested features ledger */}
          {result.suggested_features?.length > 0 && (
            <GlowCard>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Features sugeridas</h3>
                {appliedNames.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-accent">{appliedNames.length} aplicada(s)</span>
                    <Button size="sm" variant="outline" onClick={exportExcel} className="border-emerald-400/40 text-emerald-400 hover:bg-emerald-400/10"><FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" /> Excel</Button>
                    <Button size="sm" variant="outline" onClick={exportCsv} className="border-primary/40 text-primary hover:bg-primary/10"><Download className="w-3.5 h-3.5 mr-1.5" /> CSV</Button>
                    <Button size="sm" onClick={saveWorking} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">{saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Salvar no app</Button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {result.suggested_features.map((f, i) => {
                  const already = appliedNames.includes((f.name || '').trim().replace(/\s+/g, '_')) || (f.transform === 'onehot' && appliedLog.some((l) => l.includes(f.source_column)));
                  const err = validateSuggestion(f, currentCols);
                  const color = FAMILY[f.transform] || FAMILY.formula;
                  return (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3) }}
                      className="rounded-lg bg-secondary/20 p-3 border-l-2 flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderColor: color }}>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${color}22`, color }}>{transformLabel(f.transform)}</span>
                          <span className="text-sm font-mono font-semibold text-foreground truncate">{f.name}</span>
                          {f.transform === 'formula' && f.formula && <code className="text-[10px] text-muted-foreground truncate">= {f.formula}</code>}
                          {f.transform !== 'formula' && f.source_column && <code className="text-[10px] text-muted-foreground">de {f.source_column}</code>}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{f.rationale}{f.expected_benefit ? <span className="text-foreground/70"> — {f.expected_benefit}</span> : ''}</p>
                        {err && <p className="text-[10px] text-amber-400 mt-0.5">⚠ {err}</p>}
                      </div>
                      <Button size="sm" onClick={() => apply(f)} disabled={!!err || already}
                        className={already ? 'bg-accent/20 text-accent cursor-default' : 'bg-primary/90 text-primary-foreground hover:bg-primary'}>
                        {already ? <><Check className="w-3.5 h-3.5 mr-1.5" /> Aplicada</> : <><Plus className="w-3.5 h-3.5 mr-1.5" /> Aplicar</>}
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
              {appliedNames.length > 0 && (
                <p className="text-[10px] text-muted-foreground mt-3">Features aplicadas a uma cópia local. Clique em “Salvar no dataset” para persistir, depois retreine no ML Studio ou refine no Estúdio de Feature Engineering.</p>
              )}
            </GlowCard>
          )}
        </div>
      )}
    </div>
  );
}
