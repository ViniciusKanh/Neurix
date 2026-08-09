import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { GitBranch, Play, Loader2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { getDataset } from '@/lib/datasetStore';
import { mineSequences } from '@/lib/sequentialMining';

export default function SequenceMining() {
  const [projectId, setProjectId] = useState('');
  const [idCol, setIdCol] = useState('');
  const [itemCol, setItemCol] = useState('');
  const [orderCol, setOrderCol] = useState('__none__');
  const [minSup, setMinSup] = useState(0.1);
  const [rows, setRows] = useState(null);
  const [state, setState] = useState('none');
  const [res, setRes] = useState(null);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const project = projects.find((p) => p.id === projectId);
  const allCols = (project?.column_info || []).map((c) => c.name);

  useEffect(() => {
    let alive = true; setRows(null); setRes(null); setIdCol(''); setItemCol(''); setOrderCol('__none__');
    if (!projectId) { setState('none'); return; }
    setState('loading');
    (async () => { try { const d = await getDataset(projectId); if (!alive) return; if (!d?.rows?.length) { setState('missing'); return; } setRows(d.rows); setState('ready'); } catch { if (alive) setState('missing'); } })();
    return () => { alive = false; };
  }, [projectId]);

  const run = () => {
    if (!rows || !idCol || !itemCol) return toast.error('Selecione a coluna de sequência (id) e a de item.');
    const r = mineSequences(rows, idCol, itemCol, orderCol === '__none__' ? null : orderCol, { minSupport: Number(minSup) || 0.1 });
    if (r.error) return toast.error(r.message);
    setRes(r); toast.success(`${r.patterns.length} padrão(ões) em ${r.sequences} sequências.`);
  };

  return (
    <div>
      <PageHeader title="Padrões Sequenciais" subtitle="Descubra sequências frequentes (ex.: jornada de páginas, ordem de compras) por grupo" icon={GitBranch} />

      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{projects.filter((p) => p.dataset_file_url).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Sequência por (id)</label>
            <Select value={idCol} onValueChange={setIdCol} disabled={state !== 'ready'}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="ex.: cliente" /></SelectTrigger>
              <SelectContent>{allCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Item / evento</label>
            <Select value={itemCol} onValueChange={setItemCol} disabled={state !== 'ready'}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="ex.: página" /></SelectTrigger>
              <SelectContent>{allCols.filter((c) => c !== idCol).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Ordenar por (opcional)</label>
            <Select value={orderCol} onValueChange={setOrderCol} disabled={state !== 'ready'}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="__none__">Ordem original</SelectItem>{allCols.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground">Suporte mín.</label>
              <Select value={String(minSup)} onValueChange={(v) => setMinSup(parseFloat(v))}>
                <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>{[0.05, 0.1, 0.2, 0.3, 0.5].map((s) => <SelectItem key={s} value={String(s)}>{(s * 100).toFixed(0)}%</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={run} disabled={state !== 'ready'} className="bg-primary text-primary-foreground hover:bg-primary/90"><Play className="w-4 h-4" /></Button>
          </div>
        </div>
        {state === 'missing' && <p className="text-[11px] text-amber-400 mt-2">Dataset não está neste dispositivo — reenvie no ML Studio.</p>}
      </GlowCard>

      {!res ? (
        <EmptyState icon={GitBranch} title="Nenhum padrão minerado" description="Escolha a coluna que identifica cada sequência (ex.: cliente/sessão) e a coluna de evento (ex.: página/produto)." />
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[['Sequências', res.sequences], ['Comprimento médio', res.avg_length], ['Padrões', res.patterns.length], ['Suporte mín.', `${(res.min_support * 100).toFixed(0)}% (${res.min_count})`]].map(([l, v]) => (
              <GlowCard key={l} className="text-center py-3" hover={false}><p className="text-xl font-bold font-mono text-primary">{v}</p><p className="text-[10px] text-muted-foreground">{l}</p></GlowCard>
            ))}
          </div>
          <GlowCard>
            <h3 className="font-semibold text-sm mb-3">Padrões frequentes</h3>
            <div className="overflow-x-auto scrollbar-thin border border-border/40 rounded-lg max-h-[55vh]">
              <table className="w-full text-xs">
                <thead className="sticky top-0"><tr className="bg-secondary/80">{['Padrão', 'Tamanho', 'Suporte', 'Ocorrências'].map((h) => <th key={h} className="text-left p-2 text-muted-foreground border-b border-border/40">{h}</th>)}</tr></thead>
                <tbody>
                  {res.patterns.map((p, i) => (
                    <tr key={i} className={i % 2 ? '' : 'bg-secondary/20'}>
                      <td className="p-2 font-mono text-foreground whitespace-nowrap">{p.pattern.split(' → ').map((s, j, arr) => <span key={j}>{s}{j < arr.length - 1 && <ArrowRight className="w-3 h-3 inline mx-1 text-primary" />}</span>)}</td>
                      <td className="p-2 text-muted-foreground">{p.size}</td>
                      <td className="p-2 font-mono text-primary">{(p.support * 100).toFixed(1)}%</td>
                      <td className="p-2 font-mono text-muted-foreground">{p.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlowCard>
        </div>
      )}
    </div>
  );
}
