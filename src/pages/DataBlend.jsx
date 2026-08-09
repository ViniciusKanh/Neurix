import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { Combine, Play, Loader2, Download, Save, Table2 } from 'lucide-react';
import { toast } from 'sonner';
import { getDataset, saveDataset } from '@/lib/datasetStore';
import { concatDatasets, joinDatasets } from '@/lib/blend';
import { inferColumns } from '@/lib/featureEng';

export default function DataBlend() {
  const qc = useQueryClient();
  const [aId, setAId] = useState('');
  const [bId, setBId] = useState('');
  const [mode, setMode] = useState('concat'); // concat | join
  const [joinType, setJoinType] = useState('left');
  const [keyA, setKeyA] = useState('');
  const [keyB, setKeyB] = useState('');
  const [dataA, setDataA] = useState(null);
  const [dataB, setDataB] = useState(null);
  const [result, setResult] = useState(null);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const withData = projects.filter((p) => p.dataset_file_url);
  const colsA = dataA?.length ? Object.keys(dataA[0]) : [];
  const colsB = dataB?.length ? Object.keys(dataB[0]) : [];

  useEffect(() => { load(aId, setDataA); }, [aId]); // eslint-disable-line
  useEffect(() => { load(bId, setDataB); }, [bId]); // eslint-disable-line
  const load = async (id, setter) => { setter(null); setResult(null); if (!id) return; try { const d = await getDataset(id); setter(d?.rows || []); } catch { setter([]); } };

  const run = () => {
    if (!dataA?.length || !dataB?.length) return toast.error('Ambos os projetos precisam ter dataset neste dispositivo (reenvie no ML Studio).');
    let r;
    if (mode === 'concat') r = concatDatasets(dataA, dataB);
    else { if (!keyA || !keyB) return toast.error('Selecione as chaves de junção.'); r = joinDatasets(dataA, dataB, keyA, keyB, joinType); }
    if (r.error) return toast.error(r.message);
    setResult(r); toast.success(r.report);
  };

  const download = () => {
    if (!result) return;
    const esc = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [result.columns.join(','), ...result.rows.map((r) => result.columns.map((c) => esc(r[c])).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'blend.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  const createProject = async () => {
    if (!result) return;
    const name = newName.trim() || `Blend ${new Date().toLocaleDateString('pt-BR')}`;
    setSaving(true);
    try {
      const colInfo = inferColumns(result.rows).map((c) => ({ name: c.name, type: c.numeric ? 'number' : 'string' }));
      const proj = await base44.entities.Project.create({
        name, description: `Gerado por Join/Blend (${mode})`, status: 'ready',
        dataset_file_url: `local://${name}`, dataset_filename: `${name}.csv`,
        dataset_size: result.rows.length, dataset_columns: result.columns.length, row_count: result.rows.length,
        column_info: colInfo,
      });
      await saveDataset(proj.id, result.rows, colInfo, { filename: `${name}.csv`, size: result.rows.length });
      qc.invalidateQueries({ queryKey: ['projects'] });
      toast.success(`Projeto "${name}" criado com ${result.rows.length.toLocaleString('pt-BR')} linhas.`);
    } catch (e) { toast.error('Falha ao criar projeto: ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <PageHeader title="Join & Blend" subtitle="Combine dois datasets — concatene linhas ou junte por uma chave — e gere um novo projeto" icon={Combine} />

      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted-foreground">Dataset A</label>
            <Select value={aId} onValueChange={setAId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{withData.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            {aId && <p className="text-[10px] text-muted-foreground mt-1">{dataA ? `${dataA.length.toLocaleString('pt-BR')} linhas · ${colsA.length} colunas` : 'carregando/ausente…'}</p>}
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Dataset B</label>
            <Select value={bId} onValueChange={setBId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{withData.filter((p) => p.id !== aId).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            {bId && <p className="text-[10px] text-muted-foreground mt-1">{dataB ? `${dataB.length.toLocaleString('pt-BR')} linhas · ${colsB.length} colunas` : 'carregando/ausente…'}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Operação</label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="mt-1 bg-secondary/50 w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="concat">Concatenar (empilhar linhas)</SelectItem><SelectItem value="join">Juntar por chave</SelectItem></SelectContent>
            </Select>
          </div>
          {mode === 'join' && (
            <>
              <div><label className="text-xs text-muted-foreground">Chave A</label><Select value={keyA} onValueChange={setKeyA}><SelectTrigger className="mt-1 bg-secondary/50 w-40"><SelectValue placeholder="coluna" /></SelectTrigger><SelectContent>{colsA.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground">Chave B</label><Select value={keyB} onValueChange={setKeyB}><SelectTrigger className="mt-1 bg-secondary/50 w-40"><SelectValue placeholder="coluna" /></SelectTrigger><SelectContent>{colsB.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="text-xs text-muted-foreground">Tipo</label><Select value={joinType} onValueChange={setJoinType}><SelectTrigger className="mt-1 bg-secondary/50 w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="left">Left (mantém A)</SelectItem><SelectItem value="inner">Inner (só correspondências)</SelectItem></SelectContent></Select></div>
            </>
          )}
          <Button onClick={run} className="bg-primary text-primary-foreground hover:bg-primary/90"><Play className="w-4 h-4 mr-1.5" /> Combinar</Button>
        </div>
      </GlowCard>

      {!result ? (
        <EmptyState icon={Combine} title="Nenhuma combinação" description="Selecione dois projetos com dataset local e escolha concatenar ou juntar por chave." />
      ) : (
        <GlowCard>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Table2 className="w-4 h-4 text-primary" /> {result.rows.length.toLocaleString('pt-BR')} linhas · {result.columns.length} colunas</h3>
            <div className="flex items-center gap-2">
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="nome do novo projeto" className="bg-secondary/50 h-8 text-xs w-48" />
              <Button size="sm" onClick={createProject} disabled={saving} className="bg-accent text-accent-foreground hover:bg-accent/90">{saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />} Criar projeto</Button>
              <Button size="sm" variant="outline" onClick={download}><Download className="w-3.5 h-3.5 mr-1.5" /> CSV</Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground mb-2">{result.report}</p>
          <div className="overflow-x-auto scrollbar-thin border border-border/40 rounded-lg max-h-[55vh]">
            <table className="w-full text-xs">
              <thead className="sticky top-0"><tr className="bg-secondary/80">{result.columns.map((c) => <th key={c} className="text-left p-2 whitespace-nowrap text-muted-foreground border-b border-border/40">{c}</th>)}</tr></thead>
              <tbody>
                {result.rows.slice(0, 100).map((r, i) => (
                  <tr key={i} className={i % 2 ? '' : 'bg-secondary/20'}>{result.columns.map((c) => <td key={c} className="p-2 whitespace-nowrap font-mono text-foreground/80">{String(r[c] ?? '')}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > 100 && <p className="text-[10px] text-muted-foreground mt-2">Prévia de 100 linhas. Baixe o CSV ou crie o projeto para o resultado completo.</p>}
        </GlowCard>
      )}
    </div>
  );
}
