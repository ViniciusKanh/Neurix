import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { Sigma, Play, Loader2, FlaskConical, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getDataset } from '@/lib/datasetStore';
import { tTest2, anova1, chiSquareIndependence, normality, correlationTest } from '@/lib/statistics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, Cell } from 'recharts';

const TT = { background: 'hsl(220,40%,9%)', border: '1px solid hsl(210,30%,16%)', borderRadius: 8, color: '#fff', fontSize: 11 };
const TESTS = [
  { id: 'ttest', label: 'Teste t (2 grupos)', need: 'num+group', desc: 'Compara a média de uma variável numérica entre dois grupos.' },
  { id: 'anova', label: 'ANOVA (k grupos)', need: 'num+group', desc: 'Compara médias entre vários grupos.' },
  { id: 'chi2', label: 'Qui-quadrado', need: 'cat+cat', desc: 'Testa associação entre duas variáveis categóricas.' },
  { id: 'normality', label: 'Normalidade', need: 'num', desc: 'Verifica se uma variável segue distribuição normal (Jarque-Bera).' },
  { id: 'corr', label: 'Correlação (significância)', need: 'num+num', desc: 'Testa se a correlação entre duas numéricas é significativa.' },
];
const isNum = (t) => ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((t || '').toLowerCase());

export default function StatisticsLab() {
  const [projectId, setProjectId] = useState('');
  const [test, setTest] = useState('ttest');
  const [colA, setColA] = useState('');
  const [colB, setColB] = useState('');
  const [rows, setRows] = useState(null);
  const [state, setState] = useState('none');
  const [result, setResult] = useState(null);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 100) });
  const project = projects.find((p) => p.id === projectId);
  const cols = project?.column_info || [];
  const numCols = cols.filter((c) => isNum(c.type)).map((c) => c.name);
  const catCols = cols.filter((c) => !isNum(c.type)).map((c) => c.name);
  const groupCols = cols.filter((c) => !isNum(c.type) || (c.unique_count || 99) <= 12).map((c) => c.name);
  const def = TESTS.find((t) => t.id === test);

  useEffect(() => {
    let alive = true; setRows(null); setResult(null);
    if (!projectId) { setState('none'); return; }
    setState('loading');
    (async () => {
      try { const d = await getDataset(projectId); if (!alive) return; if (!d?.rows?.length) { setState('missing'); return; } setRows(d.rows); setState('ready'); }
      catch { if (alive) setState('missing'); }
    })();
    return () => { alive = false; };
  }, [projectId]);

  useEffect(() => { setColA(''); setColB(''); setResult(null); }, [test]);

  // Column options per test slot
  const aOptions = def?.need === 'chi2' ? catCols : def?.need === 'num' || def?.need?.startsWith('num') ? numCols : numCols;
  const bOptions = def?.need === 'num+group' ? groupCols : def?.need === 'cat+cat' ? catCols : def?.need === 'num+num' ? numCols : [];
  const needB = def?.need !== 'num';

  const run = () => {
    if (!rows) return;
    if (!colA || (needB && !colB)) return toast.error('Selecione as colunas.');
    let res;
    try {
      if (test === 'normality') res = normality(rows.map((r) => r[colA]));
      else if (test === 'corr') res = correlationTest(rows.map((r) => r[colA]), rows.map((r) => r[colB]));
      else if (test === 'chi2') res = chiSquareIndependence(rows.map((r) => r[colA]), rows.map((r) => r[colB]));
      else if (test === 'ttest' || test === 'anova') {
        // group the numeric colA by categorical colB
        const groups = {};
        rows.forEach((r) => { const g = String(r[colB] ?? ''); const v = parseFloat(r[colA]); if (g !== '' && !isNaN(v)) { (groups[g] = groups[g] || []).push(v); } });
        const entries = Object.entries(groups).filter(([, arr]) => arr.length >= 2).sort((a, b) => b[1].length - a[1].length);
        if (test === 'ttest') {
          if (entries.length < 2) return toast.error('São necessários ≥ 2 grupos com dados.');
          res = tTest2(entries[0][1], entries[1][1]);
          res._groupLabels = [entries[0][0], entries[1][0]];
          if (entries.length > 2) res._note = `Comparando os 2 maiores grupos: "${entries[0][0]}" vs "${entries[1][0]}".`;
        } else {
          res = anova1(entries.map(([, arr]) => arr));
          res._groupLabels = entries.map(([g]) => g);
        }
      }
      if (res?.error) return toast.error(res.message);
      setResult({ ...res, _test: test });
    } catch (e) { toast.error('Falha no cálculo: ' + e.message); }
  };

  const chart = useMemo(() => {
    if (!result) return null;
    if ((result._test === 'ttest' || result._test === 'anova') && result.group_means) {
      return { type: 'bars', data: (result._groupLabels || result.group_means.map((_, i) => `G${i + 1}`)).map((g, i) => ({ grupo: String(g).slice(0, 16), media: result.group_means ? result.group_means[i] : result.groups[i].mean })) };
    }
    if (result._test === 'ttest' && result.groups) return { type: 'bars', data: result.groups.map((g, i) => ({ grupo: (result._groupLabels || ['A', 'B'])[i], media: g.mean })) };
    if (result._test === 'corr') { const pts = rows.map((r) => ({ x: parseFloat(r[colA]), y: parseFloat(r[colB]) })).filter((p) => !isNaN(p.x) && !isNaN(p.y)).slice(0, 300); return { type: 'scatter', data: pts }; }
    if (result._test === 'normality') {
      const vals = rows.map((r) => parseFloat(r[colA])).filter((v) => !isNaN(v));
      const min = Math.min(...vals), max = Math.max(...vals), k = 12, step = (max - min) / k || 1;
      const bins = Array.from({ length: k }, (_, i) => ({ faixa: (min + i * step).toFixed(1), n: vals.filter((v) => v >= min + i * step && v < min + (i + 1) * step).length }));
      return { type: 'hist', data: bins };
    }
    return null;
  }, [result]); // eslint-disable-line

  return (
    <div>
      <PageHeader title="Laboratório Estatístico" subtitle="Testes de hipótese com p-valores reais — t-test, ANOVA, qui-quadrado, normalidade e correlação" icon={Sigma} />

      <GlowCard className="mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-muted-foreground">Projeto</label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
              <SelectContent>{projects.filter((p) => p.dataset_file_url).map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Teste</label>
            <Select value={test} onValueChange={setTest}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{TESTS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">{def?.desc}</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wide">{def?.need === 'chi2' ? 'Variável categórica A' : def?.need === 'num+group' ? 'Variável numérica' : 'Variável A (numérica)'}</label>
            <Select value={colA} onValueChange={setColA} disabled={state !== 'ready'}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{aOptions.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {needB && (
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wide">{def?.need === 'num+group' ? 'Agrupar por (categoria)' : def?.need === 'cat+cat' ? 'Variável categórica B' : 'Variável B (numérica)'}</label>
              <Select value={colB} onValueChange={setColB} disabled={state !== 'ready'}>
                <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{bOptions.filter((c) => c !== colA).map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-end">
            <Button onClick={run} disabled={state !== 'ready'} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
              {state === 'loading' ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Play className="w-4 h-4 mr-1.5" />} Rodar teste
            </Button>
          </div>
        </div>
        {state === 'missing' && <p className="text-[11px] text-amber-400 mt-2">Dataset não está neste dispositivo — reenvie no ML Studio.</p>}
      </GlowCard>

      {!result ? (
        <EmptyState icon={FlaskConical} title="Nenhum teste executado" description="Escolha um teste e as variáveis para calcular estatística, p-valor e interpretação." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GlowCard>
            <div className="flex items-center gap-2 mb-3">
              {result.significant ? <CheckCircle2 className="w-4 h-4 text-accent" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
              <h3 className="font-semibold text-sm">{result.test}</h3>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Stat label="Estatística" value={result.statistic} />
              <Stat label="p-valor" value={result.p_value} highlight={result.significant} />
              {result.df != null && <Stat label="Graus de liberdade" value={result.df} />}
              {result.df1 != null && <Stat label="gl (entre/dentro)" value={`${result.df1} / ${result.df2}`} />}
              {result.r != null && <Stat label="r (Pearson)" value={result.r} />}
              {result.cramers_v != null && <Stat label="V de Cramér" value={result.cramers_v} />}
              {result.skewness != null && <Stat label="Assimetria" value={result.skewness} />}
              {result.kurtosis != null && <Stat label="Curtose" value={result.kurtosis} />}
            </div>
            <div className={`rounded-lg p-3 text-xs leading-relaxed ${result.significant ? 'bg-accent/5 border border-accent/20 text-foreground' : 'bg-secondary/30 text-muted-foreground'}`}>
              {result._note && <p className="text-amber-400 mb-1">{result._note}</p>}
              {result.interpretation}
            </div>
          </GlowCard>

          {chart && (
            <GlowCard>
              <h3 className="font-semibold text-sm mb-3">Visualização</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  {chart.type === 'scatter' ? (
                    <ScatterChart margin={{ left: 0, right: 10, bottom: 6 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,30%,14%)" />
                      <XAxis type="number" dataKey="x" name={colA} tick={{ fontSize: 9, fill: 'hsl(210,20%,55%)' }} />
                      <YAxis type="number" dataKey="y" name={colB} tick={{ fontSize: 9, fill: 'hsl(210,20%,55%)' }} />
                      <Tooltip contentStyle={TT} />
                      <Scatter data={chart.data} fill="hsl(var(--primary))" opacity={0.6} />
                    </ScatterChart>
                  ) : (
                    <BarChart data={chart.data}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(210,30%,14%)" />
                      <XAxis dataKey={chart.type === 'hist' ? 'faixa' : 'grupo'} tick={{ fontSize: 9, fill: 'hsl(210,20%,55%)' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'hsl(210,20%,55%)' }} />
                      <Tooltip contentStyle={TT} />
                      <Bar dataKey={chart.type === 'hist' ? 'n' : 'media'} radius={[3, 3, 0, 0]}>
                        {chart.data.map((_, i) => <Cell key={i} fill={['hsl(187,92%,50%)', 'hsl(265,70%,62%)', 'hsl(152,68%,50%)', 'hsl(40,100%,55%)', 'hsl(330,90%,60%)'][i % 5]} />)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </GlowCard>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }) {
  return (
    <div className="rounded-lg bg-secondary/40 p-2.5 text-center">
      <p className={`text-lg font-bold font-mono ${highlight ? 'text-accent' : 'text-primary'}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}
