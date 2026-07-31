import React from 'react';
import GlowCard from '@/components/ui/GlowCard';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DataQualityPanel({ columns }) {
  if (!columns || columns.length === 0) return null;

  const avgNulls = columns.reduce((sum, c) => sum + (c.null_percent || 0), 0) / columns.length;
  const qualityScore = Math.max(0, Math.min(100, 100 - avgNulls));

  return (
    <GlowCard>
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Info className="w-4 h-4 text-primary" /> Visão Geral da Qualidade
      </h3>

      <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-secondary/50">
        <div className="text-center">
          <p className={cn("text-2xl font-bold", qualityScore > 80 ? "text-emerald-400" : qualityScore > 50 ? "text-amber-400" : "text-destructive")}>
            {qualityScore.toFixed(0)}%
          </p>
          <p className="text-[10px] text-muted-foreground">Score de Qualidade</p>
        </div>
        <div className="flex-1">
          <Progress value={qualityScore} className="h-2" />
        </div>
      </div>

      <div className="space-y-2 max-h-60 overflow-y-auto scrollbar-thin">
        {columns.map((col, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-secondary/30 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              {(col.null_percent || 0) > 20 ? (
                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              )}
              <span className="font-mono text-foreground truncate">{col.name}</span>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-2">
              <span className="text-muted-foreground">{col.type}</span>
              <span className={cn(
                (col.null_percent || 0) > 20 ? "text-amber-400" : "text-muted-foreground"
              )}>
                {(col.null_percent || 0).toFixed(1)}% null
              </span>
            </div>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}