import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import GlowCard from '@/components/ui/GlowCard';
import ReactMarkdown from 'react-markdown';
import { TrendingUp, Loader2, Sparkles, AlertTriangle, Calendar, BarChart2, Waves } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, ComposedChart, Area } from 'recharts';
import { cn } from '@/lib/utils';

const TOOLTIP_STYLE = { background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };
const COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)', 'hsl(0,72%,55%)'];
const TABS = [{ id: 'series', label: 'Série Temporal' }, { id: 'decomp', label: 'Decomposição STL' }, { id: 'anomalies', label: 'Anomalias' }, { id: 'forecast', label: 'Previsão' }, { id: 'ai', label: 'Análise' }];

const FORECAST_MODELS = [
  { id: 'moving_avg', label: 'Média Móvel', description: 'Suaviza tendências de curto prazo' },
  { id: 'exp_smoothing', label: 'Suavização Exponencial', description: 'Dá mais peso a dados recentes' },
  { id: 'linear_trend', label: 'Tendência Linear', description: 'Extrapola a tendência linear' },
  { id: 'seasonal_naive', label: 'Naive Sazonal', description: 'Repete o padrão da última temporada' },
];

export default function TimeSeries() {
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedProjectId, setSelectedProjectId] = useState(urlParams.get('project') || '');
  const [targetColumn, setTargetColumn] = useState('');
  const [dateColumn, setDateColumn] = useState('');
  const [forecastHorizon, setForecastHorizon] = useState('12');
  const [forecastModel, setForecastModel] = useState('exp_smoothing');
  const [windowSize, setWindowSize] = useState('7');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('series');

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 50) });
  const projectsWithData = projects.filter(p => p.dataset_file_url);
  const project = projectsWithData.find(p => p.id === selectedProjectId);
  const columns = project?.column_info || [];
  const numericCols = columns.filter(c => ['number','float','int','integer','numeric','float64','int64'].includes((c.type||'').toLowerCase()));
  const dateCols = columns.filter(c => ['date','datetime','timestamp','time'].includes((c.type||'').toLowerCase()));

  const runAnalysis = async () => {
    if (!project) return toast.error('Selecione um projeto');
    if (!targetColumn) return toast.error('Selecione a coluna alvo (variável temporal)');
    setIsAnalyzing(true);
    setResult(null);
    await new Promise(r => setTimeout(r, 400));

    const { runTimeSeries } = await import('@/lib/localTimeSeries');
    const res = runTimeSeries(project, {
      targetColumn,
      dateColumn: dateColumn || null,
      horizon: forecastHorizon,
      model: forecastModel,
      window: windowSize,
    });

    setIsAnalyzing(false);
    if (res.error) { toast.error(res.message); return; }
    setResult(res);
    setActiveTab('series');
    toast.success('Análise de série temporal concluída!');
  };

  const fullSeries = result ? [
    ...(result.series_data || []).map(d => ({ ...d, type: 'histórico' })),
    ...(result.forecast?.predictions || []).map(d => ({ period: d.period, forecast: d.value, lower: d.lower_bound, upper: d.upper_bound, type: 'previsão' })),
  ] : [];

  return (
    <div>
      <PageHeader title="Análise de Séries Temporais" subtitle="Decomposição STL, detecção de anomalias e previsão com modelos estatísticos" />

      <GlowCard className="mb-5">
        <h3 className="font-semibold text-foreground mb-4 text-sm flex items-center gap-2"><Calendar className="w-4 h-4 text-primary" /> Configurar Análise</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Projeto</label>
            <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setTargetColumn(''); setDateColumn(''); }}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{projectsWithData.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Variável Temporal (Alvo)</label>
            <Select value={targetColumn} onValueChange={setTargetColumn} disabled={!selectedProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Coluna numérica" /></SelectTrigger>
              <SelectContent>
                {numericCols.map(c => <SelectItem key={c.name} value={c.name}>{c.name} ({c.type})</SelectItem>)}
                {numericCols.length === 0 && <div className="p-2 text-xs text-muted-foreground">Nenhuma coluna numérica</div>}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Coluna de Data (opcional)</label>
            <Select value={dateColumn} onValueChange={setDateColumn} disabled={!selectedProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Índice sequencial" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>Índice sequencial</SelectItem>
                {dateCols.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                {columns.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Horizonte de Previsão</label>
            <Input value={forecastHorizon} onChange={e => setForecastHorizon(e.target.value)} className="mt-1 bg-secondary/50 font-mono" placeholder="12" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Janela (anomalias)</label>
            <Input value={windowSize} onChange={e => setWindowSize(e.target.value)} className="mt-1 bg-secondary/50 font-mono" placeholder="7" />
          </div>
          <div className="sm:col-span-2">
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Modelo de Previsão</label>
            <Select value={forecastModel} onValueChange={setForecastModel}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{FORECAST_MODELS.map(m => <SelectItem key={m.id} value={m.id}>{m.label} — {m.description}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={runAnalysis} disabled={isAnalyzing || !selectedProjectId || !targetColumn}
          className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
          {isAnalyzing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando série temporal...</> : <><TrendingUp className="w-4 h-4 mr-2" /> Analisar Série Temporal</>}
        </Button>
      </GlowCard>

      {!result && !isAnalyzing && (
        <EmptyState icon={TrendingUp} title="Configure a análise" description="Selecione o projeto, a variável temporal e o modelo de previsão" />
      )}

      {result && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Tendência', value: result.trend === 'ascending' ? '↑ Crescente' : result.trend === 'descending' ? '↓ Decrescente' : result.trend === 'stable' ? '→ Estável' : '〜 Cíclica', color: result.trend === 'ascending' ? 'text-emerald-400' : result.trend === 'descending' ? 'text-destructive' : 'text-amber-400' },
              { label: 'Sazonalidade', value: result.seasonality?.detected ? `✓ ${result.seasonality.type || 'Detectada'}` : '— Nenhuma', color: result.seasonality?.detected ? 'text-primary' : 'text-muted-foreground' },
              { label: 'Anomalias', value: (result.anomalies || []).length, color: (result.anomalies || []).length > 0 ? 'text-amber-400' : 'text-emerald-400' },
              { label: 'MAPE Previsão', value: result.forecast?.mape != null ? `${result.forecast.mape.toFixed(1)}%` : '—', color: (result.forecast?.mape || 0) < 10 ? 'text-emerald-400' : 'text-amber-400' },
            ].map((s, i) => (
              <GlowCard key={i} className="text-center py-3" hover={false}>
                <p className={cn('text-base font-bold font-mono', s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </GlowCard>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit overflow-x-auto">
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap', activeTab === tab.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'series' && (
            <GlowCard>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="font-semibold text-foreground text-sm">Série Temporal: {targetColumn}</h3>
                <div className="flex items-center gap-2">
                  {result.statistics && (
                    <div className="flex gap-3 text-[10px] text-muted-foreground">
                      <span>Média: <span className="text-foreground font-mono">{result.statistics.mean?.toFixed(2)}</span></span>
                      <span>Std: <span className="text-foreground font-mono">{result.statistics.std?.toFixed(2)}</span></span>
                      <span className={result.statistics.stationarity ? 'text-emerald-400' : 'text-amber-400'}>{result.statistics.stationarity ? '✓ Estacionária' : '⚠ Não-estacionária'}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={result.series_data || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                    <XAxis dataKey="period" tick={{ fontSize: 7, fill: 'hsl(215,20%,55%)' }} interval={Math.floor((result.series_data?.length || 1) / 8)} />
                    <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                    <Tooltip contentStyle={TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Area type="monotone" dataKey="value" name="Valor" fill="hsl(187,92%,55%,0.1)" stroke="hsl(187,92%,55%)" strokeWidth={1.5} dot={false} fillOpacity={0.1} />
                    <Line type="monotone" dataKey="moving_avg" name="Média Móvel" stroke="hsl(35,92%,60%)" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              {result.insights?.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/30 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.insights.map((ins, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><span className="text-primary font-bold flex-shrink-0">·</span>{ins}</p>
                  ))}
                </div>
              )}
            </GlowCard>
          )}

          {activeTab === 'decomp' && result.stl_decomposition && (
            <div className="space-y-4">
              {[
                { key: 'trend_component', label: 'Componente de Tendência', color: COLORS[0], description: 'Direção de longo prazo da série' },
                { key: 'seasonal_component', label: 'Componente Sazonal', color: COLORS[1], description: `Padrão repetitivo — ${result.seasonality?.type || 'detectado'}` },
                { key: 'residual_component', label: 'Resíduo (Ruído)', color: COLORS[4], description: 'Variação aleatória após remover tendência e sazonalidade' },
              ].map(({ key, label, color, description }) => (
                <GlowCard key={key}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-foreground text-sm">{label}</h3>
                      <p className="text-[10px] text-muted-foreground">{description}</p>
                    </div>
                  </div>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={result.stl_decomposition[key] || []}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                        <XAxis dataKey="period" tick={{ fontSize: 7, fill: 'hsl(215,20%,55%)' }} interval={Math.floor((result.stl_decomposition[key]?.length || 1) / 8)} />
                        <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                        <Tooltip contentStyle={TOOLTIP_STYLE} />
                        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} dot={false} />
                        {key === 'residual_component' && <ReferenceLine y={0} stroke="hsl(215,20%,55%)" strokeDasharray="3 3" />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </GlowCard>
              ))}
              {result.seasonality?.detected && (
                <GlowCard className="border-primary/30">
                  <p className="text-xs font-semibold text-primary mb-2">Sazonalidade Detectada</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Período', value: `${result.seasonality.period} unidades` },
                      { label: 'Tipo', value: result.seasonality.type },
                      { label: 'Força', value: `${((result.seasonality.strength || 0) * 100).toFixed(0)}%` },
                    ].map((s, i) => (
                      <div key={i} className="text-center p-2 rounded bg-secondary/30">
                        <p className="text-sm font-bold font-mono text-primary">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{result.seasonality.description}</p>
                </GlowCard>
              )}
            </div>
          )}

          {activeTab === 'anomalies' && (
            <div className="space-y-4">
              <GlowCard>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-foreground text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" /> Detecção de Anomalias — Janela Móvel ({windowSize} períodos)</h3>
                  <span className="text-xs text-muted-foreground">{(result.anomalies || []).length} anomalias detectadas</span>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={result.series_data || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                      <XAxis dataKey="period" tick={{ fontSize: 7, fill: 'hsl(215,20%,55%)' }} interval={Math.floor((result.series_data?.length || 1) / 8)} />
                      <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Line type="monotone" dataKey="value" stroke="hsl(187,92%,55%)" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="moving_avg" stroke="hsl(35,92%,60%)" strokeWidth={1} dot={false} strokeDasharray="4 2" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </GlowCard>

              {(result.anomalies || []).length > 0 ? (
                <GlowCard>
                  <h3 className="font-semibold text-foreground mb-3 text-sm">Anomalias Encontradas</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-secondary/60">
                          {['Período', 'Valor', 'Esperado', 'Z-Score', 'Severidade', 'Descrição'].map(h => (
                            <th key={h} className="text-left p-2.5 text-muted-foreground font-semibold border-b border-border/40 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(result.anomalies || []).map((a, i) => (
                          <tr key={i} className={cn('hover:bg-secondary/40', i % 2 === 0 ? 'bg-secondary/10' : '')}>
                            <td className="p-2.5 border-b border-border/10 font-mono text-muted-foreground">{a.period}</td>
                            <td className="p-2.5 border-b border-border/10 font-mono text-destructive font-semibold">{a.value?.toFixed(3)}</td>
                            <td className="p-2.5 border-b border-border/10 font-mono text-muted-foreground">{a.expected?.toFixed(3)}</td>
                            <td className="p-2.5 border-b border-border/10 font-mono text-amber-400">{a.z_score?.toFixed(2)}</td>
                            <td className="p-2.5 border-b border-border/10">
                              <span className={cn('px-1.5 py-0.5 rounded text-[10px] font-semibold', a.severity === 'high' ? 'bg-destructive/10 text-destructive' : a.severity === 'medium' ? 'bg-amber-400/10 text-amber-400' : 'bg-secondary text-muted-foreground')}>{a.severity}</span>
                            </td>
                            <td className="p-2.5 border-b border-border/10 text-muted-foreground max-w-xs">{a.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlowCard>
              ) : (
                <GlowCard className="text-center py-6 border-emerald-400/30">
                  <p className="text-sm text-emerald-400">✓ Nenhuma anomalia detectada na série</p>
                </GlowCard>
              )}
            </div>
          )}

          {activeTab === 'forecast' && result.forecast && (
            <div className="space-y-4">
              <GlowCard>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">Previsão — {result.forecast.model} ({forecastHorizon} períodos)</h3>
                    <p className="text-xs text-muted-foreground">{result.forecast.model_description}</p>
                  </div>
                  <div className="flex gap-4 text-[10px] text-muted-foreground">
                    <span>MAE: <span className="text-foreground font-mono">{result.forecast.mae?.toFixed(3)}</span></span>
                    <span>RMSE: <span className="text-foreground font-mono">{result.forecast.rmse?.toFixed(3)}</span></span>
                    <span>MAPE: <span className={cn('font-mono', (result.forecast.mape || 0) < 10 ? 'text-emerald-400' : 'text-amber-400')}>{result.forecast.mape?.toFixed(1)}%</span></span>
                  </div>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={[...(result.series_data || []).slice(-20), ...(result.forecast.predictions || [])]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,25%,16%)" />
                      <XAxis dataKey="period" tick={{ fontSize: 7, fill: 'hsl(215,20%,55%)' }} />
                      <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,55%)' }} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                      <Line type="monotone" dataKey="value" name="Histórico" stroke="hsl(187,92%,55%)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="value" name="Previsão" stroke="hsl(265,70%,60%)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 3, fill: 'hsl(265,70%,60%)' }} />
                      <Area type="monotone" dataKey="upper_bound" fill="hsl(265,70%,60%)" fillOpacity={0.1} stroke="none" />
                      <Area type="monotone" dataKey="lower_bound" fill="hsl(265,70%,60%)" fillOpacity={0.1} stroke="none" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </GlowCard>

              <GlowCard>
                <h3 className="font-semibold text-foreground mb-3 text-sm">Tabela de Previsões com Intervalos de Confiança</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary/60">
                        {['Período', 'Previsão', 'Limite Inferior', 'Limite Superior', 'Confiança'].map(h => (
                          <th key={h} className="text-left p-2 text-muted-foreground font-semibold border-b border-border/40">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(result.forecast.predictions || []).map((p, i) => (
                        <tr key={i} className={cn('hover:bg-secondary/40', i % 2 === 0 ? 'bg-secondary/10' : '')}>
                          <td className="p-2 border-b border-border/10 font-mono text-muted-foreground">{p.period}</td>
                          <td className="p-2 border-b border-border/10 font-mono font-semibold text-accent">{p.value?.toFixed(3)}</td>
                          <td className="p-2 border-b border-border/10 font-mono text-muted-foreground">{p.lower_bound?.toFixed(3)}</td>
                          <td className="p-2 border-b border-border/10 font-mono text-muted-foreground">{p.upper_bound?.toFixed(3)}</td>
                          <td className="p-2 border-b border-border/10">
                            <span className={cn('px-1.5 py-0.5 rounded text-[10px]', (p.confidence || 0) > 0.8 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-amber-400/10 text-amber-400')}>
                              {((p.confidence || 0) * 100).toFixed(0)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlowCard>
            </div>
          )}

          {activeTab === 'ai' && result.ai_analysis && (
            <GlowCard glowColor="accent">
              <div className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-accent" /><h3 className="font-semibold text-foreground">Análise de Série Temporal — IA</h3></div>
              <ReactMarkdown components={{
                p: ({ children }) => <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{children}</p>,
                h2: ({ children }) => <h2 className="text-base font-semibold text-foreground mb-2 mt-5">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold text-accent mb-2 mt-4">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc ml-5 space-y-1 mb-3">{children}</ul>,
                li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
              }}>{result.ai_analysis}</ReactMarkdown>
            </GlowCard>
          )}
        </div>
      )}
    </div>
  );
}