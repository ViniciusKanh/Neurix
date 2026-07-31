// Cost monitor panel — shown below the pipeline canvas
import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { NODE_TYPES } from './NodeTypes';
import {
  DollarSign, Zap, Cpu, ChevronUp, ChevronDown,
  BarChart3, TrendingUp, AlertTriangle, Info
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

// Cost model per node type
const NODE_COST = {
  data_source:    { tokens: 0,    compute: 0.001, label: 'I/O' },
  filter_rows:    { tokens: 0,    compute: 0.002, label: 'CPU' },
  select_columns: { tokens: 0,    compute: 0.001, label: 'CPU' },
  sort_rows:      { tokens: 0,    compute: 0.003, label: 'CPU' },
  imputer:        { tokens: 800,  compute: 0.005, label: 'LLM+CPU' },
  scaler:         { tokens: 0,    compute: 0.004, label: 'CPU' },
  encoder:        { tokens: 0,    compute: 0.003, label: 'CPU' },
  feature_eng:    { tokens: 1500, compute: 0.008, label: 'LLM+CPU' },
  split:          { tokens: 0,    compute: 0.002, label: 'CPU' },
  cross_validation: { tokens: 0,  compute: 0.01,  label: 'CPU' },
  model_classify: { tokens: 2000, compute: 0.02,  label: 'LLM+GPU' },
  model_regression:{ tokens: 2000,compute: 0.02,  label: 'LLM+GPU' },
  model_cluster:  { tokens: 1800, compute: 0.018, label: 'LLM+GPU' },
  model_anomaly:  { tokens: 2200, compute: 0.022, label: 'LLM+GPU' },
  model_pca:      { tokens: 1200, compute: 0.012, label: 'LLM+GPU' },
  automl:         { tokens: 5000, compute: 0.05,  label: 'LLM+GPU' },
  hyperopt:       { tokens: 3500, compute: 0.035, label: 'LLM+GPU' },
  evaluator:      { tokens: 0,    compute: 0.004, label: 'CPU' },
  explain:        { tokens: 1500, compute: 0.015, label: 'LLM+GPU' },
  output:         { tokens: 0,    compute: 0.001, label: 'I/O' },
};

const TOKEN_PRICE_PER_1K = 0.00015; // USD
const COMPUTE_UNIT_PRICE = 1.0;     // USD multiplier

function getCost(node) {
  const base = NODE_COST[node.type] || { tokens: 500, compute: 0.005, label: 'Misto' };
  const tokenCost = (base.tokens / 1000) * TOKEN_PRICE_PER_1K * 1000;
  const computeCost = base.compute;
  const totalUSD = tokenCost + computeCost;
  return { ...base, tokenCost, computeCost, totalUSD };
}

const TOOLTIP_STYLE = {
  background: 'hsl(222,40%,9%)',
  border: '1px solid hsl(222,25%,16%)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '10px',
};

const COST_COLORS = ['hsl(187,92%,55%)', 'hsl(265,70%,60%)', 'hsl(152,68%,50%)', 'hsl(35,92%,60%)', 'hsl(330,70%,60%)'];

export default function PipelineCostMonitor({ nodes, isOpen, onToggle }) {
  const costs = useMemo(() => nodes.map(n => {
    const c = getCost(n);
    return {
      id: n.id,
      name: n.label || NODE_TYPES[n.type]?.label || n.type,
      type: n.type,
      ...c,
    };
  }), [nodes]);

  const totalTokens = costs.reduce((s, c) => s + c.tokens, 0);
  const totalUSD = costs.reduce((s, c) => s + c.totalUSD, 0);
  const llmNodes = costs.filter(c => c.tokens > 0);
  const cpuOnly = costs.filter(c => c.tokens === 0);

  const chartData = costs.map((c, i) => ({
    name: c.name.length > 10 ? c.name.slice(0, 10) + '…' : c.name,
    tokens: c.tokens,
    custo: +(c.totalUSD * 1000).toFixed(2), // in millicents for readability
    color: COST_COLORS[i % COST_COLORS.length],
  }));

  const highCostNodes = costs.filter(c => c.totalUSD > 0.01);
  const budgetWarning = totalUSD > 0.15;

  if (nodes.length === 0) return null;

  return (
    <div className="flex-shrink-0 border-t border-border/20 bg-card/40 backdrop-blur-sm">
      {/* Toggle header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-2 hover:bg-secondary/20 transition-colors"
      >
        <DollarSign className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[10px] font-bold text-foreground tracking-wide uppercase">Monitor de Custo Operacional</span>

        {/* KPI pills */}
        <div className="flex items-center gap-3 ml-2">
          <span className="text-[8px] font-mono text-primary/70 flex items-center gap-1">
            <Zap className="w-2 h-2" />{totalTokens.toLocaleString()} tokens
          </span>
          <span className={cn('text-[8px] font-mono font-bold flex items-center gap-1', budgetWarning ? 'text-amber-400' : 'text-emerald-400')}>
            <DollarSign className="w-2 h-2" />${totalUSD.toFixed(4)} est.
          </span>
          {budgetWarning && <AlertTriangle className="w-3 h-3 text-amber-400 animate-pulse" />}
          <span className="text-[8px] text-muted-foreground/40">{llmNodes.length} nós LLM · {cpuOnly.length} nós CPU</span>
        </div>

        <div className="ml-auto">
          {isOpen
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 260, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="h-[260px] flex gap-0 border-t border-border/10">
              {/* Left: chart */}
              <div className="w-64 flex-shrink-0 p-3 border-r border-border/10">
                <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                  <BarChart3 className="w-2.5 h-2.5" /> Tokens por Nó
                </p>
                <div className="h-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 2, right: 5, bottom: 20, left: 0 }}>
                      <XAxis dataKey="name" tick={{ fontSize: 8, fill: 'hsl(215,20%,45%)' }} angle={-30} textAnchor="end" />
                      <YAxis tick={{ fontSize: 8, fill: 'hsl(215,20%,45%)' }} width={30} />
                      <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [n === 'tokens' ? `${v} tokens` : `${v}m¢`, n]} />
                      <Bar dataKey="tokens" radius={[3, 3, 0, 0]}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Right: table */}
              <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
                {/* Summary row */}
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {[
                    { label: 'Total Tokens', value: totalTokens.toLocaleString(), color: 'text-primary', icon: Zap },
                    { label: 'Custo LLM', value: `$${(llmNodes.reduce((s, c) => s + c.totalUSD, 0)).toFixed(4)}`, color: 'text-amber-400', icon: TrendingUp },
                    { label: 'Custo Compute', value: `$${cpuOnly.reduce((s, c) => s + c.totalUSD, 0).toFixed(4)}`, color: 'text-accent', icon: Cpu },
                    { label: 'Total Est.', value: `$${totalUSD.toFixed(4)}`, color: budgetWarning ? 'text-amber-400' : 'text-emerald-400', icon: DollarSign },
                  ].map((s, i) => (
                    <div key={i} className="rounded-lg border border-border/15 bg-secondary/10 p-2 text-center">
                      <s.icon className={cn('w-3 h-3 mx-auto mb-1 opacity-60', s.color)} />
                      <p className={cn('text-xs font-bold font-mono', s.color)}>{s.value}</p>
                      <p className="text-[8px] text-muted-foreground/50">{s.label}</p>
                    </div>
                  ))}
                </div>

                {budgetWarning && (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-amber-400/25 bg-amber-400/5 mb-2">
                    <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <p className="text-[9px] text-amber-400/80">Pipeline com custo estimado alto. Considere reduzir nós LLM ou otimizar configurações.</p>
                  </div>
                )}

                {/* Per-node table */}
                <div className="space-y-1">
                  {costs.map((c, i) => (
                    <div key={c.id} className="flex items-center gap-2 py-1.5 border-b border-border/10 last:border-0">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: COST_COLORS[i % COST_COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold text-foreground truncate">{c.name}</p>
                        <p className="text-[8px] text-muted-foreground">{c.label}</p>
                      </div>
                      <span className="text-[9px] font-mono text-primary/70 w-20 text-right flex-shrink-0">
                        {c.tokens > 0 ? `${c.tokens.toLocaleString()} tok` : '—'}
                      </span>
                      <span className={cn(
                        'text-[9px] font-mono font-bold w-16 text-right flex-shrink-0',
                        c.totalUSD > 0.01 ? 'text-amber-400' : 'text-muted-foreground'
                      )}>
                        ${c.totalUSD.toFixed(4)}
                      </span>
                      {c.totalUSD > 0.01 && <AlertTriangle className="w-2.5 h-2.5 text-amber-400/60 flex-shrink-0" />}
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border/10">
                  <Info className="w-2.5 h-2.5 text-muted-foreground/30 flex-shrink-0" />
                  <p className="text-[8px] text-muted-foreground/30">Estimativa baseada em preços médios de API. Custos reais podem variar.</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}