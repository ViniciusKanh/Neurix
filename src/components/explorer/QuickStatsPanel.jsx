import React, { useState } from 'react';
import GlowCard from '@/components/ui/GlowCard';
import { BarChart2, TrendingUp, Hash, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)', 'hsl(330,70%,60%)', 'hsl(210,80%,60%)'];
const TOOLTIP_STYLE = { background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' };

function computeLocalCorrelations(columns) {
  const numCols = columns.filter(c =>
    ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((c.type || '').toLowerCase()) &&
    (c.sample_values || []).length >= 3
  );
  const results = [];
  for (let i = 0; i < Math.min(numCols.length, 8); i++) {
    for (let j = i + 1; j < Math.min(numCols.length, 8); j++) {
      const a = numCols[i].sample_values.map(Number).filter(n => !isNaN(n));
      const b = numCols[j].sample_values.map(Number).filter(n => !isNaN(n));
      const len = Math.min(a.length, b.length);
      if (len < 3) continue;
      const meanA = a.slice(0, len).reduce((s, v) => s + v, 0) / len;
      const meanB = b.slice(0, len).reduce((s, v) => s + v, 0) / len;
      const num = a.slice(0, len).reduce((s, v, k) => s + (v - meanA) * (b[k] - meanB), 0);
      const denA = Math.sqrt(a.slice(0, len).reduce((s, v) => s + (v - meanA) ** 2, 0));
      const denB = Math.sqrt(b.slice(0, len).reduce((s, v) => s + (v - meanB) ** 2, 0));
      const r = (denA * denB) === 0 ? 0 : num / (denA * denB);
      results.push({ col1: numCols[i].name, col2: numCols[j].name, r: +r.toFixed(3) });
    }
  }
  return results.sort((a, b) => Math.abs(b.r) - Math.abs(a.r)).slice(0, 12);
}

function MiniDistBar({ col, idx }) {
  const vals = col.sample_values || [];
  const isNum = ['number', 'float', 'int', 'integer', 'numeric', 'float64', 'int64', 'double'].includes((col.type || '').toLowerCase());
  let data = [];

  if (isNum) {
    const nums = vals.map(Number).filter(n => !isNaN(n));
    if (nums.length < 2) return null;
    const min = Math.min(...nums), max = Math.max(...nums);
    const step = (max - min) / 5 || 1;
    data = Array.from({ length: 5 }, (_, i) => ({
      label: `${(min + i * step).toFixed(1)}`,
      v: nums.filter(n => n >= min + i * step && n < min + (i + 1) * step).length,
    }));
  } else {
    const freq = {};
    vals.forEach(v => { const k = String(v ?? 'null'); freq[k] = (freq[k] || 0) + 1; });
    data = Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, v]) => ({
      label: label.length > 8 ? label.slice(0, 7) + '…' : label, v,
    }));
  }

  if (!data.length) return null;
  const color = COLORS[idx % COLORS.length];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono font-semibold text-foreground truncate max-w-[65%]">{col.name}</span>
        <span className="text-[9px] px-1 rounded" style={{ background: color + '20', color }}>{col.type}</span>
      </div>
      <div className="h-20">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 6, fill: 'hsl(215,20%,50%)' }} interval={0} />
            <YAxis tick={{ fontSize: 6, fill: 'hsl(215,20%,50%)' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="v" radius={[2, 2, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={color} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default function QuickStatsPanel({ columns }) {
  const [showCorr, setShowCorr] = useState(true);
  const [showDist, setShowDist] = useState(true);

  const correlations = computeLocalCorrelations(columns);
  const previewCols = columns.filter(c => (c.sample_values || []).length >= 3).slice(0, 8);

  if (!columns.length) return null;

  return (
    <div className="space-y-4">
      {/* Distribuições rápidas */}
      <GlowCard hover={false}>
        <button className="w-full flex items-center justify-between" onClick={() => setShowDist(v => !v)}>
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Distribuições Rápidas</h3>
            <span className="text-[10px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">{previewCols.length} colunas</span>
          </div>
          {showDist ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>

        {showDist && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {previewCols.map((col, i) => (
              <div key={col.name} className="p-2.5 rounded-lg bg-secondary/20 border border-border/15">
                <MiniDistBar col={col} idx={i} />
                <div className="mt-1.5 flex gap-2 text-[9px] text-muted-foreground">
                  <span>{col.unique_count ?? '?'} únicos</span>
                  {col.null_percent != null && (
                    <span className={col.null_percent > 10 ? 'text-amber-400' : 'text-emerald-400/70'}>
                      {col.null_percent.toFixed(0)}% nulos
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlowCard>

      {/* Correlações locais */}
      {correlations.length > 0 && (
        <GlowCard hover={false}>
          <button className="w-full flex items-center justify-between" onClick={() => setShowCorr(v => !v)}>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Correlações entre Colunas</h3>
              <span className="text-[9px] text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">baseado nas amostras locais</span>
            </div>
            {showCorr ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showCorr && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {correlations.map((c, i) => {
                const abs = Math.abs(c.r);
                const isStrong = abs >= 0.7;
                const isMed = abs >= 0.4;
                const color = isStrong ? (c.r > 0 ? 'text-emerald-400' : 'text-destructive') : isMed ? 'text-amber-400' : 'text-muted-foreground';
                const bg = isStrong ? (c.r > 0 ? 'bg-emerald-400/5 border-emerald-400/15' : 'bg-destructive/5 border-destructive/15') : isMed ? 'bg-amber-400/5 border-amber-400/15' : 'bg-secondary/10 border-border/10';
                const label = isStrong ? (c.r > 0 ? 'Forte positiva' : 'Forte negativa') : isMed ? (c.r > 0 ? 'Moderada pos.' : 'Moderada neg.') : 'Fraca';
                const barW = Math.round(abs * 100);

                return (
                  <div key={i} className={cn('p-2.5 rounded-lg border', bg)}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-foreground truncate">{c.col1}</p>
                        <p className="text-[9px] text-muted-foreground truncate">↔ {c.col2}</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className={cn('text-sm font-bold font-mono', color)}>r={c.r}</p>
                        <p className={cn('text-[9px]', color)}>{label}</p>
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-secondary/40 mt-1">
                      <div className="h-full rounded-full transition-all" style={{ width: `${barW}%`, background: isStrong ? (c.r > 0 ? 'hsl(152,68%,50%)' : 'hsl(0,72%,55%)') : 'hsl(35,92%,60%)' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlowCard>
      )}
    </div>
  );
}