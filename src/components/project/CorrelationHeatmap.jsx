import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import GlowCard from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/button';
import { Loader2, GitFork, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

// Interpolate color from blue (-1) → white (0) → red (1)
function corrColor(value) {
  const v = Math.max(-1, Math.min(1, value));
  if (v >= 0) {
    // white → red
    const r = 255;
    const g = Math.round(255 * (1 - v));
    const b = Math.round(255 * (1 - v));
    return `rgb(${r},${g},${b})`;
  } else {
    // white → blue
    const r = Math.round(255 * (1 + v));
    const g = Math.round(255 * (1 + v));
    const b = 255;
    return `rgb(${r},${g},${b})`;
  }
}

function textColor(value) {
  return Math.abs(value) > 0.5 ? '#fff' : '#888';
}

export default function CorrelationHeatmap({ project }) {
  const [corrData, setCorrData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const numericCols = (project.column_info || []).filter(c =>
    ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((c.type || '').toLowerCase())
  );

  // Real Pearson correlation matrix computed locally from the data sample — no AI.
  const generate = async () => {
    setIsLoading(true);
    await new Promise(r => setTimeout(r, 300));

    const names = numericCols.map(c => c.name);
    const sample = project.data_sample || [];
    const series = names.map(n => sample.map(row => parseFloat(row[n])));

    const pearson = (a, b) => {
      const idx = a.map((_, i) => i).filter(i => !isNaN(a[i]) && !isNaN(b[i]));
      const n = idx.length;
      if (n < 3) return 0;
      const ax = idx.map(i => a[i]), bx = idx.map(i => b[i]);
      const ma = ax.reduce((s, v) => s + v, 0) / n;
      const mb = bx.reduce((s, v) => s + v, 0) / n;
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < n; i++) { num += (ax[i] - ma) * (bx[i] - mb); da += (ax[i] - ma) ** 2; db += (bx[i] - mb) ** 2; }
      return (da > 0 && db > 0) ? num / Math.sqrt(da * db) : 0;
    };

    const matrix = names.map((_, i) => names.map((_, j) => Number(pearson(series[i], series[j]).toFixed(2))));
    const high = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const v = matrix[i][j];
        if (Math.abs(v) >= 0.7) high.push({ col1: names[i], col2: names[j], value: v, risk: Math.abs(v) >= 0.9 ? 'alto' : 'médio' });
      }
    }
    high.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

    const interpretation = high.length
      ? `Foram encontrados ${high.length} par(es) com |r| ≥ 0,7, indicando possível multicolinearidade — avalie remover uma das variáveis de cada par.`
      : 'Nenhum par com correlação forte (|r| ≥ 0,7) — baixo risco de multicolinearidade entre as variáveis numéricas.';

    setCorrData({ columns: names, matrix, high_correlations: high, interpretation });
    setIsLoading(false);
  };

  const cols = corrData?.columns || [];
  const matrix = corrData?.matrix || [];
  const highCorrs = corrData?.high_correlations || [];

  return (
    <GlowCard className="lg:col-span-2">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <GitFork className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Matriz de Correlação</h3>
          {numericCols.length > 0 && (
            <span className="text-xs text-muted-foreground">({numericCols.length} variáveis numéricas)</span>
          )}
        </div>
        <Button
          size="sm"
          onClick={generate}
          disabled={isLoading || numericCols.length < 2}
          className="bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs"
        >
          {isLoading
            ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Calculando...</>
            : <><Sparkles className="w-3 h-3 mr-1.5" /> Calcular Correlações</>
          }
        </Button>
      </div>

      {numericCols.length < 2 && (
        <p className="text-xs text-muted-foreground text-center py-8">
          São necessárias pelo menos 2 colunas numéricas para calcular correlações.
        </p>
      )}

      {!corrData && !isLoading && numericCols.length >= 2 && (
        <div className="text-center py-12 text-muted-foreground">
          <GitFork className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Clique em "Calcular Correlações" para gerar o mapa de calor</p>
          <p className="text-xs mt-1">Identifique multicolinearidade antes de treinar modelos</p>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground animate-pulse">Calculando correlações...</p>
        </div>
      )}

      {corrData && cols.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Heatmap Grid */}
          <div className="overflow-x-auto scrollbar-thin">
            <div className="inline-block min-w-full">
              {/* Column headers */}
              <div className="flex">
                <div className="w-28 flex-shrink-0" />
                {cols.map((col, ci) => (
                  <div
                    key={ci}
                    className="flex-1 min-w-[48px] text-center"
                    style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', paddingBottom: 4 }}
                  >
                    <span className="text-[9px] font-mono text-muted-foreground truncate block" style={{ maxHeight: 80 }}>
                      {col.length > 12 ? col.slice(0, 12) + '…' : col}
                    </span>
                  </div>
                ))}
              </div>
              {/* Rows */}
              {matrix.map((row, ri) => (
                <div key={ri} className="flex items-center">
                  <div className="w-28 flex-shrink-0 text-right pr-2">
                    <span className="text-[9px] font-mono text-muted-foreground truncate block">
                      {cols[ri]?.length > 14 ? cols[ri].slice(0, 14) + '…' : cols[ri]}
                    </span>
                  </div>
                  {row.map((val, ci) => (
                    <div
                      key={ci}
                      className="flex-1 min-w-[48px] h-11 flex items-center justify-center text-[10px] font-mono font-semibold transition-all duration-200 hover:scale-110 hover:z-10 relative cursor-default"
                      style={{
                        backgroundColor: corrColor(val),
                        color: textColor(val),
                        border: '1px solid rgba(0,0,0,0.15)',
                      }}
                      title={`${cols[ri]} × ${cols[ci]}: ${val.toFixed(3)}`}
                    >
                      {val.toFixed(2)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Color scale legend */}
          <div className="flex items-center gap-3 justify-center">
            <span className="text-[10px] text-muted-foreground">-1.0</span>
            <div className="h-3 w-48 rounded-full" style={{
              background: 'linear-gradient(to right, rgb(0,0,255), rgb(255,255,255), rgb(255,0,0))'
            }} />
            <span className="text-[10px] text-muted-foreground">+1.0</span>
          </div>

          {/* High Correlation Alerts */}
          {highCorrs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Alertas de Multicolinearidade
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {highCorrs.map((pair, i) => {
                  const isHigh = pair.risk === 'alto' || Math.abs(pair.value) > 0.85;
                  return (
                    <div key={i} className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs",
                      isHigh
                        ? "border-destructive/30 bg-destructive/5 text-destructive"
                        : "border-amber-500/30 bg-amber-500/5 text-amber-400"
                    )}>
                      {isHigh
                        ? <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                        : <CheckCircle2 className="w-3 h-3 flex-shrink-0" />
                      }
                      <span className="font-mono font-medium truncate">
                        {pair.col1} × {pair.col2}
                      </span>
                      <span className="ml-auto font-bold flex-shrink-0">
                        r = {pair.value?.toFixed(3)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Interpretation */}
          {corrData.interpretation && (
            <div className="p-4 rounded-lg bg-accent/5 border border-accent/20">
              <p className="text-xs font-semibold text-accent flex items-center gap-1 mb-1.5">
                <Sparkles className="w-3 h-3" /> Interpretação
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">{corrData.interpretation}</p>
            </div>
          )}
        </motion.div>
      )}
    </GlowCard>
  );
}