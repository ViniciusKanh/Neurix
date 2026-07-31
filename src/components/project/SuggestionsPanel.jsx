import React from 'react';
import GlowCard from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/button';
import { Brain, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

const confidenceColors = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-muted-foreground',
};

export default function SuggestionsPanel({ suggestions, projectId }) {
  const navigate = useNavigate();
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <GlowCard>
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" /> Sugestões de Tarefas ML
      </h3>
      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div key={i} className="p-3 rounded-lg bg-secondary/50 border border-border/30 hover:border-primary/30 transition-colors">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">{s.task}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.description}</p>
              </div>
              <span className={cn("text-[10px] font-medium uppercase tracking-wider flex-shrink-0", confidenceColors[s.confidence] || confidenceColors.medium)}>
                {s.confidence}
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 text-xs text-primary hover:text-primary/80 p-0 h-auto"
              onClick={() => navigate(`/ml-studio?project=${projectId}&task=${s.task}`)}
            >
              Iniciar Análise <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        ))}
      </div>
    </GlowCard>
  );
}