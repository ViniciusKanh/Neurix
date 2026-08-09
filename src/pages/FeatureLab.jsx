import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { Wand2, Plus, Save, Loader2, Undo2, Table2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { getDataset, saveDataset } from '@/lib/datasetStore';
import { deriveColumn, binningColumn, oneHotColumn, labelEncodeColumn, scaleColumn, logColumn, inferColumns } from '@/lib/featureEng';

const TRANSFORMS = [
  { id: 'derive', label: 'Coluna derivada (fórmula)' },
  { id: 'bin', label: 'Discretização (binning)' },
  { id: 'onehot', label: 'One-Hot Encoding' },
  { id: 'label', label: 'Label Encoding' },
  { id: 'scale', label: 'Normalização (escala)' },
  { id: 'log', label: 'Transformação log' },
];

export default function FeatureLab() {
  const [projectId, setProjectId] = useState('');
  const [state, setState] = useState('none'); // none|loading|ready|missing
  const [orig, setOrig] = useState(null);
  const [rows, setRows] = useState(null);
  const [log, setLog] = useState([]);
  const [added, setAdded] = useState([]);
  const [saving, setSaving] = useState(false);

  const [tType, setTType] = useState('derive');
  const [name, setName] = useState('');
  const [formula, setFormula] = useState('');
  const [col, setCol] = useState('');
  const [k, setK] = useState(4);
  const [binMethod, setBinMethod] = useState('width');
  const [scaleMethod, setScaleMethod] = useState('zscore');

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });

  useEffect(() => {
    let alive = true; setRows(null); setOrig(null); setLog([]); setAdded([]);
    if (!projectId) { setState('none'); return; }
    setState('loading');
    (async () => {
      try { const d = await getDataset(projectId); if (!alive) return; if (!d?.rows?.length) { setState('missing'); return; } setOrig(d.rows); setRows(d.rows); setState('ready'); }
      catch { if (alive) setState('missing'); }
    })();
    return () => { alive = false; };
  }, [projectId]);

  const columns = useMemo(() => (rows ? inferColumns(rows) : []), [rows]);
  const numericCols = columns.filter((c) => c.numeric).map((c) => c.name);
  const allCols = columns.map((c) => c.name);
  const catCols = columns.filter((c) => !c.numeric).map((c) => c.name);

  const apply = () => {
    if (!rows) return;
    try {
      let res;
      if (tType === 'derive') { if (!name.trim() || !formula.trim()) return toast.error('Informe nome e fórmula.'); res = deriveColumn(rows, name.trim(), formula.trim()); }
      else if (tType === 'bin') { if (!col) return toast.error('Selecione a coluna.'); res = binningColumn(rows, col, Number(k) || 4, binMethod); }
      else if (tType === 'onehot') { if (!col) return toast.error('Selecione a coluna.'); res = oneHotColumn(rows, col); }
      else if (tType === 'label') { if (!col) return toast.error('Selecione a coluna.'); res = labelEncodeColumn(rows, col); }
      else if (tType === 'scale') { if (!col) return toast.error('Selecione a coluna.'); res = scaleColumn(rows, col, scaleMethod); }
      else if (tType === 'log') { if (!col) return toast.error('Selecione a coluna.'); res = logColumn(rows, col); }
      if (!res || !res.added.length) return toast.error('Transformação não produziu colunas (verifique os tipos).');
      setRows(res.rows); setAdded((a) => [...new Set([...a, ...res.added])]); setLog((l) => [...l, res.report]);
      setName(''); setFormula('');
      toast.success(res.report);
    } catch (e) { toast.error('Erro: ' + e.message); }
  };

  const reset = () => { setRows(orig); setAdded([]); setLog([]); toast.info('Transformações desfeitas.'); };

  const save = async () => {
    setSaving(true);
    try {
      const project = projects.find((p) => p.id === projectId);
      await saveDataset(projectId, rows, inferColumns(rows), { filename: (project?.dataset_filename || 'dataset') + ' (features)', size: rows.length });
      toast.success('Dataset com novas features salvo localmente. Retreine no ML Studio para usá-las.');
    } catch (e) { toast.error('Falha ao salvar: ' + e.message); }
    finally { setSaving(false); }
  };

  const previewCols = rows?.length ? Object.keys(rows[0]) : [];

  return (
    <div>
      <PageHeader title="Estúdio de Feature Engineering" subtitle="Crie e transforme variáveis — fórmulas, binning, encoding, escala e log — e salve no dataset local" icon={Wand2} />

      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
              <SelectContent>{projects.filter((p) => p.dataset_file_url).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end text-[11px] text-muted-foreground">
            {state === 'ready' && rows ? `${rows.length.toLocaleString('pt-BR')} linhas · ${previewCols.length} colunas${added.length ? ` (+${added.length} nova(s))` : ''}` : state === 'loading' ? 'Carregando…' : state === 'missing' ? 'Dataset não está neste dispositivo (reenvie no ML Studio).' : 'Selecione um projeto.'}
          </div>
        </div>
      </GlowCard>

      {state === 'ready' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <GlowCard className="lg:col-span-1">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Nova transformação</h3>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Tipo</label>
            <Select value={tType} onValueChange={setTType}>
              <SelectTrigger className="mt-1 mb-3 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{TRANSFORMS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
            </Select>

            {tType === 'derive' && (
              <div className="space-y-2">
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="nome da nova coluna" className="bg-secondary/50 h-8 text-xs" />
                <Input value={formula} onChange={(e) => setFormula(e.target.value)} placeholder="ex.: renda / idade + log(renda)" className="bg-secondary/50 h-8 text-xs font-mono" />
                <p className="text-[10px] text-muted-foreground">Operadores: + - * / % ^ ( ) · funções: log, ln, sqrt, abs, exp, min, max · use os nomes das colunas.</p>
              </div>
            )}
            {tType !== 'derive' && (
              <div className="space-y-2">
                <label className="text-[10px] text-muted-foreground uppercase tracking-wide">Coluna</label>
                <Select value={col} onValueChange={setCol}>
                  <SelectTrigger className="bg-secondary/50 h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{(tType === 'onehot' || tType === 'label' ? (catCols.length ? catCols : allCols) : numericCols).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
                {tType === 'bin' && (
                  <div className="flex gap-2">
                    <Input type="number" value={k} onChange={(e) => setK(e.target.value)} className="bg-secondary/50 h-8 text-xs w-20" min={2} max={12} />
                    <Select value={binMethod} onValueChange={setBinMethod}><SelectTrigger className="bg-secondary/50 h-8 text-xs flex-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="width">Largura igual</SelectItem><SelectItem value="freq">Frequência igual</SelectItem></SelectContent></Select>
                  </div>
                )}
                {tType === 'scale' && (
                  <Select value={scaleMethod} onValueChange={setScaleMethod}><SelectTrigger className="bg-secondary/50 h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="zscore">Z-score (média 0, desvio 1)</SelectItem><SelectItem value="minmax">Min-Max [0, 1]</SelectItem></SelectContent></Select>
                )}
              </div>
            )}
            <Button onClick={apply} className="w-full mt-3 bg-primary text-primary-foreground hover:bg-primary/90"><Plus className="w-3.5 h-3.5 mr-1.5" /> Aplicar</Button>

            {log.length > 0 && (
              <div className="mt-4 border-t border-border/30 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Transformações ({log.length})</p>
                  <button onClick={reset} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"><Undo2 className="w-3 h-3" /> desfazer tudo</button>
                </div>
                <ul className="space-y-1">
                  {log.map((l, i) => <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5"><Sparkles className="w-3 h-3 text-accent flex-shrink-0 mt-0.5" /> {l}</li>)}
                </ul>
                <Button onClick={save} disabled={saving || !added.length} className="w-full mt-3 bg-accent text-accent-foreground hover:bg-accent/90">
                  {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Salvar dataset com features
                </Button>
              </div>
            )}
          </GlowCard>

          <GlowCard className="lg:col-span-2">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Table2 className="w-4 h-4 text-primary" /> Prévia <span className="text-xs text-muted-foreground">(20 linhas)</span></h3>
            <div className="overflow-x-auto scrollbar-thin border border-border/40 rounded-lg max-h-[60vh]">
              <table className="w-full text-xs">
                <thead className="sticky top-0"><tr className="bg-secondary/80">{previewCols.map((c) => <th key={c} className={`text-left p-2 whitespace-nowrap border-b border-border/40 ${added.includes(c) ? 'text-accent' : 'text-muted-foreground'}`}>{c}{added.includes(c) && ' ✦'}</th>)}</tr></thead>
                <tbody>
                  {rows.slice(0, 20).map((r, i) => (
                    <tr key={i} className={i % 2 ? '' : 'bg-secondary/20'}>
                      {previewCols.map((c) => <td key={c} className={`p-2 whitespace-nowrap font-mono ${added.includes(c) ? 'text-accent' : 'text-foreground/80'}`}>{String(r[c] ?? '')}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlowCard>
        </div>
      )}

      {state === 'missing' && <EmptyState icon={Wand2} title="Dataset não está neste dispositivo" description="O dataset fica salvo localmente. Reenvie o arquivo no ML Studio para criar features." />}
      {state === 'none' && <EmptyState icon={Wand2} title="Estúdio de Feature Engineering" description="Selecione um projeto para começar a construir e transformar variáveis." />}
    </div>
  );
}
