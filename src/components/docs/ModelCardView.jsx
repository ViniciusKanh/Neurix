import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { IdCard, Download, Loader2, ShieldCheck, AlertTriangle, Code2 } from 'lucide-react';
import { getDataset } from '@/lib/datasetStore';
import { crossValidate, classBalance } from '@/lib/realML';
import { buildModelCard, buildModelBundle, downloadJSON, exportSklearn, downloadText } from '@/lib/governance';
import { toast } from 'sonner';

export default function ModelCardView({ projects = [] }) {
  const [projectId, setProjectId] = useState('');
  const [analysisId, setAnalysisId] = useState('');
  const [card, setCard] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data: analyses = [] } = useQuery({
    queryKey: ['analyses', projectId],
    queryFn: () => base44.entities.Analysis.filter({ project_id: projectId }, '-created_date', 50),
    enabled: !!projectId,
  });

  const project = projects.find((p) => p.id === projectId);
  const models = analyses.filter((a) => a.status === 'completed' && ['classification', 'regression'].includes(a.type));
  const analysis = models.find((a) => a.id === analysisId);

  useEffect(() => {
    let alive = true;
    setCard(null);
    if (!project || !analysis) return;
    (async () => {
      setBusy(true);
      const extra = {};
      try {
        const d = await getDataset(projectId);
        const target = analysis.config?.target_column;
        if (d?.rows?.length && target) {
          if (analysis.type === 'classification') { const b = classBalance(d.rows, target); if (!b.error) extra.balance = b; }
          const modelName = analysis.results?.best_model || 'auto';
          const cv = crossValidate(d.rows, target, project.column_info, analysis.type, modelName, 5);
          if (!cv.error) extra.cv = cv;
        }
      } catch { /* uses holdout only */ }
      if (alive) { setCard(buildModelCard(project, analysis, extra)); setBusy(false); }
    })();
    return () => { alive = false; };
  }, [projectId, analysisId]); // eslint-disable-line

  const exportJSON = () => {
    if (!card) return;
    downloadJSON(buildModelBundle(project, analysis, card), `model-card-${(project?.name || 'modelo').replace(/\s+/g, '_')}.json`);
    toast.success('Model Card exportado em JSON.');
  };

  const exportPython = () => {
    if (!analysis) return;
    downloadText(exportSklearn(project, analysis), `pipeline-${(project?.name || 'modelo').replace(/\s+/g, '_')}.py`, 'text/x-python');
    toast.success('Script Python (pandas + scikit-learn) exportado.');
  };

  return (
    <div className="space-y-4">
      <GlowCard>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setAnalysisId(''); }}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Modelo treinado</label>
            <Select value={analysisId} onValueChange={setAnalysisId} disabled={!projectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder={models.length ? 'Selecione o modelo' : 'Nenhum modelo treinado'} /></SelectTrigger>
              <SelectContent>{models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.type}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </GlowCard>

      {!analysis ? (
        <EmptyState icon={IdCard} title="Cartão do Modelo (Model Card)" description="Selecione um projeto e um modelo treinado para gerar a ficha de governança: dados, features, métricas, validação e limitações." />
      ) : busy ? (
        <div className="flex items-center gap-2 justify-center py-16 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Compondo o Model Card…</div>
      ) : card && (
        <GlowCard>
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="font-semibold text-foreground flex items-center gap-2"><IdCard className="w-4 h-4 text-primary" /> {card.model_name}</h3>
              <p className="text-xs text-muted-foreground">{card.task} · alvo <span className="font-mono text-foreground">{card.target}</span> · projeto {card.project}</p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={exportPython} className="border-primary/40 text-primary hover:bg-primary/10"><Code2 className="w-3.5 h-3.5 mr-1.5" /> Python</Button>
              <Button size="sm" onClick={exportJSON} className="bg-primary text-primary-foreground hover:bg-primary/90"><Download className="w-3.5 h-3.5 mr-1.5" /> JSON</Button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {card.performance.map(([k, v]) => (
              <div key={k} className="rounded-lg bg-secondary/40 p-3 text-center">
                <p className="text-lg font-bold font-mono text-primary">{v}</p>
                <p className="text-[10px] text-muted-foreground">{k}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Dados</p>
              <p className="text-xs text-muted-foreground">Treinado em <strong className="text-foreground">{(card.trained_on || 0).toLocaleString('pt-BR')}</strong> linhas{card.test_size ? `, testado em ${card.test_size}` : ''}.</p>
              <p className="text-xs text-muted-foreground mt-1">Validação: <strong className="text-foreground">{card.validation.method}</strong>{card.validation.mean != null ? ` — ${card.validation.metric} ${(card.validation.mean * 100).toFixed(1)}% ± ${(card.validation.std * 100).toFixed(1)}` : ''}.</p>
              {card.classes && <p className="text-xs text-muted-foreground mt-1">Classes: {card.classes.join(', ')}.</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">Features ({card.features.length})</p>
              <div className="flex flex-wrap gap-1">
                {card.features.slice(0, 20).map((f) => <span key={f} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-foreground/80">{f}</span>)}
              </div>
            </div>
          </div>

          {card.feature_importance?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-1.5">Variáveis mais influentes</p>
              <div className="space-y-1">
                {card.feature_importance.slice(0, 6).map((f, i) => {
                  const val = f.importance ?? f.score ?? 0;
                  const max = card.feature_importance[0]?.importance ?? card.feature_importance[0]?.score ?? 1;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[11px] w-32 truncate text-foreground/80">{f.feature}</span>
                      <div className="flex-1 h-2 rounded-full bg-background/60 overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (Math.abs(val) / (Math.abs(max) || 1)) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3">
            <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5 mb-1"><AlertTriangle className="w-3.5 h-3.5" /> Limitações e cuidados</p>
            <ul className="space-y-1">
              {card.limitations.map((l, i) => <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5"><ShieldCheck className="w-3 h-3 text-amber-400/70 flex-shrink-0 mt-0.5" /> {l}</li>)}
            </ul>
          </div>

          <p className="text-[10px] text-muted-foreground mt-3">Gerado em {new Date(card.generated_at).toLocaleString('pt-BR')}.</p>
        </GlowCard>
      )}
    </div>
  );
}
