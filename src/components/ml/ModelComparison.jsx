import React, { useState } from 'react';
import GlowCard from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/button';
import { GitCompare, CheckSquare, Square, Trophy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts';

const COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)', 'hsl(330,70%,60%)'];
const TOOLTIP_STYLE = {
  background: 'hsl(222, 40%, 9%)',
  border: '1px solid hsl(222, 25%, 16%)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '11px',
};

const TYPE_LABELS = {
  classification: 'Classificação',
  regression: 'Regressão',
  clustering: 'Agrupamento',
  anomaly_detection: 'Detecção de Anomalias',
};

export default function ModelComparison({ analyses }) {
  const completed = analyses.filter(a => a.status === 'completed');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState('');
  const [crossSelected, setCrossSelected] = useState([]);
  const [mode, setMode] = useState('within'); // 'within' | 'cross'

  const selectedAnalysis = completed.find(a => a.id === selectedAnalysisId);
  // Models within a single analysis
  const internalModels = selectedAnalysis?.results?.models_comparison || [];

  // Cross-analysis: pick completed analyses to compare (by top metric)
  const toggleCross = (id) => {
    setCrossSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-4)
    );
  };
  const crossChosen = completed.filter(a => crossSelected.includes(a.id));
  const allMetricKeys = [...new Set(crossChosen.flatMap(a => Object.keys(a.results?.metrics || {})))];
  const numericMetricKeys = allMetricKeys.filter(k =>
    crossChosen.some(a => typeof a.results?.metrics?.[k] === 'number')
  );
  const crossChartData = numericMetricKeys.map(key => {
    const entry = { metric: key.replace(/_/g, ' ') };
    crossChosen.forEach(a => {
      const val = a.results?.metrics?.[key];
      entry[a.name.split('—')[0].trim()] = typeof val === 'number' ? parseFloat(val.toFixed(4)) : null;
    });
    return entry;
  });

  // Within chart data
  const withinMetricKeys = internalModels.length > 0
    ? [...new Set(internalModels.flatMap(m => Object.keys(m.metrics || {})))].filter(k =>
        internalModels.some(m => typeof m.metrics?.[k] === 'number')
      )
    : [];
  const withinChartData = withinMetricKeys.map(key => {
    const entry = { metric: key.replace(/_/g, ' ') };
    internalModels.forEach(m => {
      const val = m.metrics?.[key];
      entry[m.name] = typeof val === 'number' ? parseFloat(val.toFixed(4)) : null;
    });
    return entry;
  });

  if (completed.length === 0) {
    return (
      <GlowCard className="text-center py-12">
        <GitCompare className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-30" />
        <p className="text-sm font-medium text-foreground">Comparação de Modelos</p>
        <p className="text-xs text-muted-foreground mt-1">
          Execute pelo menos uma análise para comparar modelos
        </p>
      </GlowCard>
    );
  }

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-fit">
        <button
          onClick={() => setMode('within')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'within' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Modelos dentro de uma Análise
        </button>
        <button
          onClick={() => setMode('cross')}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'cross' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          Comparar entre Análises
        </button>
      </div>

      {/* WITHIN MODE */}
      {mode === 'within' && (
        <div className="space-y-5">
          <GlowCard>
            <Label className="text-xs text-muted-foreground">Selecionar Análise</Label>
            <Select value={selectedAnalysisId} onValueChange={setSelectedAnalysisId}>
              <SelectTrigger className="mt-1.5 bg-secondary/50">
                <SelectValue placeholder="Escolha uma análise concluída" />
              </SelectTrigger>
              <SelectContent>
                {completed.map(a => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} — {TYPE_LABELS[a.type] || a.type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </GlowCard>

          {selectedAnalysis && internalModels.length === 0 && (
            <GlowCard className="text-center py-8">
              <p className="text-sm text-muted-foreground">Esta análise não possui dados de comparação de modelos internos.</p>
              <p className="text-xs text-muted-foreground mt-1">Tente re-executar a análise para gerar novos resultados.</p>
            </GlowCard>
          )}

          {internalModels.length > 0 && (
            <AnimatePresence>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                {/* Best model highlight */}
                {(() => {
                  const metricKey = withinMetricKeys[0];
                  if (!metricKey) return null;
                  const best = [...internalModels].sort((a, b) => (b.metrics?.[metricKey] || 0) - (a.metrics?.[metricKey] || 0))[0];
                  return (
                    <GlowCard glowColor="success" className="flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-foreground">Melhor Modelo: <span className="text-emerald-400">{best.name}</span></p>
                        <p className="text-xs text-muted-foreground">
                          {metricKey.replace(/_/g, ' ')}: <span className="font-mono text-emerald-400">{best.metrics?.[metricKey]?.toFixed(4)}</span>
                        </p>
                      </div>
                    </GlowCard>
                  );
                })()}

                {/* Metrics table */}
                <GlowCard>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Métricas por Modelo</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-secondary/60">
                          <th className="text-left p-2.5 text-muted-foreground font-semibold border-b border-border/40">Métrica</th>
                          {internalModels.map((m, i) => (
                            <th key={i} className="text-left p-2.5 font-semibold border-b border-border/40 whitespace-nowrap" style={{ color: COLORS[i] }}>
                              {m.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {withinMetricKeys.map((key, ri) => {
                          const vals = internalModels.map(m => m.metrics?.[key]);
                          const numVals = vals.filter(v => typeof v === 'number');
                          const best = numVals.length > 1 ? Math.max(...numVals) : null;
                          return (
                            <tr key={key} className={`${ri % 2 === 0 ? 'bg-secondary/20' : ''} hover:bg-secondary/40`}>
                              <td className="p-2.5 border-b border-border/20 font-mono text-muted-foreground">{key.replace(/_/g, ' ')}</td>
                              {internalModels.map((m, i) => {
                                const val = m.metrics?.[key];
                                const isNum = typeof val === 'number';
                                const isBest = isNum && val === best;
                                return (
                                  <td key={i} className="p-2.5 border-b border-border/20">
                                    <span className={`font-mono font-semibold ${isBest ? 'text-emerald-400' : 'text-foreground'}`}>
                                      {isNum ? val.toFixed(4) : (val ?? '—')}
                                    </span>
                                    {isBest && <span className="ml-1 text-[9px] text-emerald-400">✓</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </GlowCard>

                {/* Chart */}
                {withinChartData.length > 0 && (
                  <GlowCard>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-4">Gráfico Comparativo</p>
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={withinChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" />
                          <XAxis dataKey="metric" tick={{ fontSize: 9, fill: 'hsl(215, 20%, 55%)' }} />
                          <YAxis tick={{ fontSize: 9, fill: 'hsl(215, 20%, 55%)' }} />
                          <Tooltip contentStyle={TOOLTIP_STYLE} />
                          <Legend wrapperStyle={{ fontSize: '10px' }} />
                          {internalModels.map((m, i) => (
                            <Bar key={i} dataKey={m.name} fill={COLORS[i]} radius={[4, 4, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </GlowCard>
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      {/* CROSS MODE */}
      {mode === 'cross' && (
        <div className="space-y-5">
          {completed.length < 2 ? (
            <GlowCard className="text-center py-8">
              <p className="text-xs text-muted-foreground">Execute pelo menos 2 análises para comparar entre elas.</p>
            </GlowCard>
          ) : (
            <>
              <GlowCard>
                <p className="text-xs font-semibold text-muted-foreground mb-3">Selecione análises para comparar (máx. 4)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {completed.map(a => {
                    const isSel = crossSelected.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        onClick={() => toggleCross(a.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all duration-200 ${
                          isSel ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/40 bg-secondary/30 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                        }`}
                      >
                        {isSel ? <CheckSquare className="w-4 h-4 flex-shrink-0" /> : <Square className="w-4 h-4 flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{a.name}</p>
                          <p className="text-[10px] opacity-70">{TYPE_LABELS[a.type] || a.type}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </GlowCard>

              <AnimatePresence>
                {crossChosen.length >= 2 && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                    <GlowCard>
                      <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Métricas lado a lado</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-secondary/60">
                              <th className="text-left p-2.5 text-muted-foreground font-semibold border-b border-border/40">Métrica</th>
                              {crossChosen.map((a, i) => (
                                <th key={a.id} className="text-left p-2.5 font-semibold border-b border-border/40 whitespace-nowrap" style={{ color: COLORS[i] }}>
                                  {a.name.split('—')[0].trim()}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {allMetricKeys.map((key, ri) => {
                              const vals = crossChosen.map(a => a.results?.metrics?.[key]);
                              const numVals = vals.filter(v => typeof v === 'number');
                              const best = numVals.length > 1 ? Math.max(...numVals) : null;
                              return (
                                <tr key={key} className={`${ri % 2 === 0 ? 'bg-secondary/20' : ''} hover:bg-secondary/40`}>
                                  <td className="p-2.5 border-b border-border/20 font-mono text-muted-foreground">{key.replace(/_/g, ' ')}</td>
                                  {crossChosen.map((a, i) => {
                                    const val = a.results?.metrics?.[key];
                                    const isNum = typeof val === 'number';
                                    const isBest = isNum && val === best;
                                    return (
                                      <td key={a.id} className="p-2.5 border-b border-border/20">
                                        <span className={`font-mono font-semibold ${isBest ? 'text-emerald-400' : 'text-foreground'}`}>
                                          {isNum ? val.toFixed(4) : (val ?? '—')}
                                        </span>
                                        {isBest && <span className="ml-1 text-[9px] text-emerald-400">✓</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </GlowCard>

                    {crossChartData.length > 0 && (
                      <GlowCard>
                        <p className="text-xs font-semibold text-muted-foreground uppercase mb-4">Gráfico Comparativo</p>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={crossChartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" />
                              <XAxis dataKey="metric" tick={{ fontSize: 9, fill: 'hsl(215, 20%, 55%)' }} />
                              <YAxis tick={{ fontSize: 9, fill: 'hsl(215, 20%, 55%)' }} />
                              <Tooltip contentStyle={TOOLTIP_STYLE} />
                              <Legend wrapperStyle={{ fontSize: '10px' }} />
                              {crossChosen.map((a, i) => (
                                <Bar key={a.id} dataKey={a.name.split('—')[0].trim()} fill={COLORS[i]} radius={[4, 4, 0, 0]} />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </GlowCard>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      )}
    </div>
  );
}