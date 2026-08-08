import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { Layers, Upload, Loader2, Download, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { getDataset } from '@/lib/datasetStore';
import { parseAnyFile } from '@/lib/parseDataset';
import { trainPredictor } from '@/lib/realML';

export default function BatchScore() {
  const [projectId, setProjectId] = useState('');
  const [analysisId, setAnalysisId] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null); // { columns, rows, predCol }

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const { data: analyses = [] } = useQuery({ queryKey: ['analyses', projectId], queryFn: () => base44.entities.Analysis.filter({ project_id: projectId }, '-created_date', 50), enabled: !!projectId });

  const project = projects.find((p) => p.id === projectId);
  const models = analyses.filter((a) => a.status === 'completed' && ['classification', 'regression'].includes(a.type));
  const analysis = models.find((a) => a.id === analysisId);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !project || !analysis) return;
    setRunning(true); setResult(null);
    try {
      const d = await getDataset(projectId);
      if (!d || !d.rows || d.rows.length < 10) throw new Error('Dataset de treino não está neste dispositivo. Reenvie no ML Studio.');
      const target = analysis.config?.target_column;
      const predictor = trainPredictor(d.rows, target, project.column_info, analysis.type, analysis.results?.best_model);
      if (!predictor) throw new Error('Não foi possível treinar o modelo com o dataset local.');

      const parsed = await parseAnyFile(file);
      const newRows = parsed.rows || parsed.data_sample || [];
      if (!newRows.length) throw new Error('Arquivo sem linhas legíveis.');

      const predCol = `predicao_${target || 'alvo'}`;
      const scored = newRows.map((r) => ({ ...r, [predCol]: predictor.predict(r).value }));
      const columns = [...Object.keys(newRows[0]), predCol];
      setResult({ columns, rows: scored, predCol, filename: file.name });
      toast.success(`${scored.length.toLocaleString('pt-BR')} linhas pontuadas!`);
    } catch (err) {
      toast.error(err.message);
    } finally { setRunning(false); e.target.value = ''; }
  };

  const download = () => {
    if (!result) return;
    const esc = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [result.columns.join(','), ...result.rows.map((r) => result.columns.map((c) => esc(r[c])).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = `scored_${(result.filename || 'dados').replace(/\.[^.]+$/, '')}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <PageHeader title="Scoring em Lote" subtitle="Pontue um novo arquivo inteiro com um modelo treinado e baixe o resultado" icon={Layers} />

      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-muted-foreground">Projeto (modelo de origem)</label>
            <Select value={projectId} onValueChange={(v) => { setProjectId(v); setAnalysisId(''); setResult(null); }}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
              <SelectContent>{projects.filter((p) => p.dataset_file_url).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Modelo treinado</label>
            <Select value={analysisId} onValueChange={(v) => { setAnalysisId(v); setResult(null); }} disabled={!projectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder={models.length ? 'Selecione o modelo' : 'Nenhum modelo treinado'} /></SelectTrigger>
              <SelectContent>{models.map((m) => <SelectItem key={m.id} value={m.id}>{m.name} · {m.type}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <label className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer transition ${analysis ? 'border-primary/40 hover:border-primary hover:bg-primary/5' : 'border-border/40 opacity-50 pointer-events-none'}`}>
          {running ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Upload className="w-6 h-6 text-primary" />}
          <span className="text-sm text-foreground">{running ? 'Pontuando…' : 'Enviar CSV/Excel para pontuar'}</span>
          <span className="text-[11px] text-muted-foreground">O arquivo deve ter as mesmas colunas de features do treino</span>
          <input type="file" accept=".csv,.tsv,.txt,.xlsx,.xls" hidden onChange={onFile} disabled={!analysis || running} />
        </label>
      </GlowCard>

      {!result ? (
        <EmptyState icon={Layers} title="Nenhum arquivo pontuado" description="Selecione um projeto + modelo e envie um arquivo para gerar as predições em lote." />
      ) : (
        <GlowCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Table2 className="w-4 h-4 text-primary" /> {result.rows.length.toLocaleString('pt-BR')} linhas pontuadas <span className="text-xs text-muted-foreground">(prévia de 50)</span></h3>
            <Button onClick={download} size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90"><Download className="w-3.5 h-3.5 mr-1.5" /> Baixar CSV</Button>
          </div>
          <div className="overflow-x-auto scrollbar-thin border border-border/40 rounded-lg">
            <table className="w-full text-xs">
              <thead><tr className="border-b border-border/60">{result.columns.map((c) => <th key={c} className={`text-left p-2 whitespace-nowrap ${c === result.predCol ? 'text-primary' : 'text-muted-foreground'}`}>{c}</th>)}</tr></thead>
              <tbody>
                {result.rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-b border-border/20">
                    {result.columns.map((c) => <td key={c} className={`p-2 whitespace-nowrap ${c === result.predCol ? 'text-primary font-mono font-semibold' : 'text-foreground/80'}`}>{String(r[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlowCard>
      )}
    </div>
  );
}
