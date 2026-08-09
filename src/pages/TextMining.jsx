import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { FileText, Play, Loader2, Cloud, Hash, Smile } from 'lucide-react';
import { toast } from 'sonner';
import { getDataset } from '@/lib/datasetStore';
import { analyzeText } from '@/lib/textMining';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const TT = { background: 'hsl(220,40%,9%)', border: '1px solid hsl(210,30%,16%)', borderRadius: 8, color: '#fff', fontSize: 11 };
const CLOUD_COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,62%)', 'hsl(152,68%,50%)', 'hsl(40,100%,55%)', 'hsl(330,90%,62%)', 'hsl(210,90%,62%)'];

export default function TextMining() {
  const [projectId, setProjectId] = useState('');
  const [col, setCol] = useState('');
  const [rows, setRows] = useState(null);
  const [state, setState] = useState('none');
  const [res, setRes] = useState(null);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const project = projects.find((p) => p.id === projectId);
  // candidate text columns: non-numeric with longer average text
  const textCols = (project?.column_info || []).filter((c) => !['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((c.type || '').toLowerCase())).map((c) => c.name);

  useEffect(() => {
    let alive = true; setRows(null); setRes(null); setCol('');
    if (!projectId) { setState('none'); return; }
    setState('loading');
    (async () => { try { const d = await getDataset(projectId); if (!alive) return; if (!d?.rows?.length) { setState('missing'); return; } setRows(d.rows); setState('ready'); } catch { if (alive) setState('missing'); } })();
    return () => { alive = false; };
  }, [projectId]);

  const run = () => {
    if (!rows || !col) return toast.error('Selecione a coluna de texto.');
    const r = analyzeText(rows, col, { topN: 40 });
    if (r.error) return toast.error(r.message);
    setRes(r); toast.success(`${r.documents.toLocaleString('pt-BR')} documentos analisados.`);
  };

  return (
    <div>
      <PageHeader title="Text Mining / NLP" subtitle="Tokenização, TF-IDF, nuvem de palavras e sentimento sobre uma coluna de texto" icon={FileText} />

      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
              <SelectContent>{projects.filter((p) => p.dataset_file_url).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Coluna de texto</label>
            <Select value={col} onValueChange={setCol} disabled={state !== 'ready'}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder={textCols.length ? 'Selecione' : 'Sem colunas textuais'} /></SelectTrigger>
              <SelectContent>{textCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button onClick={run} disabled={state !== 'ready' || !col} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
              {state === 'loading' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />} Analisar
            </Button>
          </div>
        </div>
        {state === 'missing' && <p className="text-[11px] text-amber-400 mt-2">Dataset não está neste dispositivo — reenvie no ML Studio.</p>}
      </GlowCard>

      {!res ? (
        <EmptyState icon={FileText} title="Nenhuma análise de texto" description="Escolha uma coluna de texto (avaliações, descrições, comentários) e clique em Analisar." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['Documentos', res.documents], ['Vocabulário', res.vocabulary], ['Tokens', res.total_tokens], ['Tokens/doc', res.avg_tokens_per_doc]].map(([l, v]) => (
              <GlowCard key={l} className="text-center py-3" hover={false}><p className="text-xl font-bold font-mono text-primary">{typeof v === 'number' ? v.toLocaleString('pt-BR') : v}</p><p className="text-[10px] text-muted-foreground">{l}</p></GlowCard>
            ))}
          </div>

          <GlowCard>
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Cloud className="w-4 h-4 text-primary" /> Nuvem de palavras</h3>
            <div className="flex flex-wrap gap-x-3 gap-y-1 items-center justify-center py-4">
              {res.cloud.map((w, i) => (
                <span key={w.term} title={`${w.tf} ocorrências`} style={{ fontSize: w.size, color: CLOUD_COLORS[i % CLOUD_COLORS.length], lineHeight: 1.1 }} className="font-bold">{w.term}</span>
              ))}
            </div>
          </GlowCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <GlowCard>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Hash className="w-4 h-4 text-primary" /> Termos por relevância (TF-IDF)</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={res.top_tfidf.slice(0, 12)} layout="vertical" margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,30%,14%)" />
                    <XAxis type="number" tick={{ fontSize: 9, fill: 'hsl(210,20%,55%)' }} />
                    <YAxis dataKey="term" type="category" width={90} tick={{ fontSize: 9, fill: 'hsl(210,20%,55%)' }} />
                    <Tooltip contentStyle={TT} />
                    <Bar dataKey="tfidf" fill="hsl(265,70%,62%)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </GlowCard>

            <GlowCard>
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Smile className="w-4 h-4 text-primary" /> Sentimento (léxico) & tamanho dos textos</h3>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded bg-accent/10 p-2 text-center"><p className="text-lg font-bold font-mono text-accent">{res.sentiment.positive_pct}%</p><p className="text-[10px] text-muted-foreground">Positivo</p></div>
                <div className="rounded bg-secondary/40 p-2 text-center"><p className="text-lg font-bold font-mono text-muted-foreground">{(100 - res.sentiment.positive_pct - res.sentiment.negative_pct).toFixed(1)}%</p><p className="text-[10px] text-muted-foreground">Neutro</p></div>
                <div className="rounded bg-destructive/10 p-2 text-center"><p className="text-lg font-bold font-mono text-destructive">{res.sentiment.negative_pct}%</p><p className="text-[10px] text-muted-foreground">Negativo</p></div>
              </div>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={res.length_hist}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,30%,14%)" />
                    <XAxis dataKey="faixa" tick={{ fontSize: 8, fill: 'hsl(210,20%,55%)' }} />
                    <YAxis tick={{ fontSize: 8, fill: 'hsl(210,20%,55%)' }} />
                    <Tooltip contentStyle={TT} />
                    <Bar dataKey="n" radius={[3, 3, 0, 0]}>{res.length_hist.map((_, i) => <Cell key={i} fill="hsl(187,92%,50%)" />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Distribuição do nº de tokens por documento. Sentimento por léxico PT/EN (aproximado).</p>
            </GlowCard>
          </div>
        </div>
      )}
    </div>
  );
}
