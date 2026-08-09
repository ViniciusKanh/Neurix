import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { Database, Play, Loader2, Download, Table2, TerminalSquare } from 'lucide-react';
import { toast } from 'sonner';
import { getDataset } from '@/lib/datasetStore';
import { runSQL } from '@/lib/miniSQL';

export default function SQLWorkbench() {
  const urlParams = new URLSearchParams(window.location.search);
  const [projectId, setProjectId] = useState(urlParams.get('project') || '');
  const [sql, setSql] = useState('SELECT * FROM data LIMIT 20');
  const [rows, setRows] = useState(null);
  const [state, setState] = useState('none'); // none|loading|ready|missing
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const project = projects.find((p) => p.id === projectId);
  const columns = project?.column_info?.map((c) => c.name) || [];

  useEffect(() => {
    let alive = true;
    setRows(null); setResult(null); setError(null);
    if (!projectId) { setState('none'); return; }
    setState('loading');
    (async () => {
      try {
        const d = await getDataset(projectId);
        if (!alive) return;
        if (!d?.rows?.length) { setState('missing'); return; }
        setRows(d.rows); setState('ready');
      } catch { if (alive) setState('missing'); }
    })();
    return () => { alive = false; };
  }, [projectId]);

  const run = () => {
    if (!rows) return;
    setError(null);
    try {
      const r = runSQL(rows, sql);
      setResult(r);
      toast.success(`${r.returned.toLocaleString('pt-BR')} linha(s) — ${r.total.toLocaleString('pt-BR')} no total.`);
    } catch (e) { setError(e.message); setResult(null); }
  };

  const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') run(); };

  const download = () => {
    if (!result) return;
    const esc = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const csv = [result.columns.join(','), ...result.rows.map((r) => result.columns.map((c) => esc(r[c])).join(','))].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'consulta.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  const examples = [
    'SELECT * FROM data LIMIT 20',
    columns.length ? `SELECT ${columns[0]}, COUNT(*) AS n FROM data GROUP BY ${columns[0]} ORDER BY n DESC` : 'SELECT coluna, COUNT(*) AS n FROM data GROUP BY coluna',
    columns.length >= 2 ? `SELECT AVG(${columns.find((c)=>true)}) AS media FROM data` : 'SELECT AVG(coluna) AS media FROM data',
  ];

  return (
    <div>
      <PageHeader title="Workbench SQL" subtitle="Consulte seu dataset local com SQL — agregações, filtros e agrupamentos, tudo no navegador" icon={TerminalSquare} />

      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted-foreground">Projeto (tabela <code className="text-primary">data</code>)</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
              <SelectContent>{projects.filter((p) => p.dataset_file_url).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <p className="text-[11px] text-muted-foreground">
              {state === 'ready' && rows ? `${rows.length.toLocaleString('pt-BR')} linhas · ${columns.length} colunas disponíveis` : state === 'loading' ? 'Carregando dataset local…' : state === 'missing' ? 'Dataset não está neste dispositivo (reenvie no ML Studio).' : 'Selecione um projeto.'}
            </p>
          </div>
        </div>

        <textarea
          value={sql} onChange={(e) => setSql(e.target.value)} onKeyDown={onKey} spellCheck={false}
          className="w-full h-28 rounded-lg bg-[hsl(220,45%,4%)] border border-border/50 p-3 font-mono text-xs text-foreground outline-none focus:border-primary/50 resize-y"
          placeholder="SELECT ... FROM data WHERE ... GROUP BY ... ORDER BY ... LIMIT ..."
        />
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <Button onClick={run} disabled={state !== 'ready'} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Play className="w-4 h-4 mr-1.5" /> Executar <span className="ml-1.5 text-[10px] opacity-70">⌘/Ctrl+Enter</span>
          </Button>
          {result && <Button onClick={download} size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1.5" /> CSV</Button>}
          <div className="flex flex-wrap gap-1 ml-auto">
            {examples.map((ex, i) => (
              <button key={i} onClick={() => setSql(ex)} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground hover:text-primary hover:bg-primary/10 truncate max-w-[240px]">{ex}</button>
            ))}
          </div>
        </div>
        {columns.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2">Colunas: {columns.map((c) => <code key={c} className="text-foreground/70 mr-1.5">{c}</code>)}</p>
        )}
        <p className="text-[10px] text-muted-foreground mt-1">Suporta: SELECT (colunas ou <code>COUNT/SUM/AVG/MIN/MAX</code>), WHERE (<code>= != &gt; &gt;= &lt; &lt;= LIKE</code>, AND/OR, IS NULL), GROUP BY, ORDER BY, LIMIT.</p>
      </GlowCard>

      {error && (
        <div className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive font-mono">⚠ {error}</div>
      )}

      {!result && !error ? (
        <EmptyState icon={Database} title="Nenhuma consulta executada" description="Selecione um projeto, escreva uma consulta SQL e clique em Executar (ou ⌘/Ctrl+Enter)." />
      ) : result && (
        <GlowCard>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm flex items-center gap-2"><Table2 className="w-4 h-4 text-primary" /> {result.returned.toLocaleString('pt-BR')} linha(s) <span className="text-xs text-muted-foreground">de {result.total.toLocaleString('pt-BR')}{result.returned < result.total ? ' (prévia)' : ''}</span></h3>
          </div>
          <div className="overflow-x-auto scrollbar-thin border border-border/40 rounded-lg max-h-[60vh]">
            <table className="w-full text-xs">
              <thead className="sticky top-0"><tr className="bg-secondary/80">{result.columns.map((c) => <th key={c} className="text-left p-2 whitespace-nowrap text-muted-foreground font-semibold border-b border-border/40">{c}</th>)}</tr></thead>
              <tbody>
                {result.rows.slice(0, 500).map((r, i) => (
                  <tr key={i} className={i % 2 ? '' : 'bg-secondary/20'}>
                    {result.columns.map((c) => <td key={c} className="p-2 whitespace-nowrap text-foreground/80 font-mono">{String(r[c] ?? '')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {result.rows.length > 500 && <p className="text-[10px] text-muted-foreground mt-2">Mostrando as primeiras 500 linhas. Baixe o CSV para o resultado completo.</p>}
        </GlowCard>
      )}
    </div>
  );
}
