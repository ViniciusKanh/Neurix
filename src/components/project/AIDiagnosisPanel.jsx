import React from 'react';
import GlowCard from '@/components/ui/GlowCard';
import ReactMarkdown from 'react-markdown';
import { Sparkles } from 'lucide-react';

export default function AIDiagnosisPanel({ diagnosis }) {
  if (!diagnosis) return null;

  return (
    <GlowCard glowColor="accent">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-accent" /> Diagnóstico da IA
      </h3>
      <div className="prose prose-sm prose-invert max-w-none text-sm">
        <ReactMarkdown
          components={{
            p: ({ children }) => <p className="text-muted-foreground mb-2 leading-relaxed">{children}</p>,
            h1: ({ children }) => <h1 className="text-base font-semibold text-foreground mb-2">{children}</h1>,
            h2: ({ children }) => <h2 className="text-sm font-semibold text-foreground mb-2 mt-3">{children}</h2>,
            h3: ({ children }) => <h3 className="text-sm font-semibold text-foreground mb-1 mt-2">{children}</h3>,
            ul: ({ children }) => <ul className="list-disc ml-4 space-y-1 mb-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal ml-4 space-y-1 mb-2">{children}</ol>,
            li: ({ children }) => <li className="text-muted-foreground text-xs">{children}</li>,
            strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
            code: ({ children }) => <code className="text-primary font-mono text-xs bg-primary/10 px-1 rounded">{children}</code>,
          }}
        >
          {diagnosis}
        </ReactMarkdown>
      </div>
    </GlowCard>
  );
}