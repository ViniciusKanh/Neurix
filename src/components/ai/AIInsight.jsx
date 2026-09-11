import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Loader2, RefreshCw, TrendingUp, Clock } from 'lucide-react';
import { aiApi } from '@/api/base44Client';
import { getAI, saveAI } from '@/lib/aiCache';
import { toast } from 'sonner';

/**
 * Optional, cache-backed AI interpretation block.
 * - Loads the LAST result from local cache on mount (no token spend).
 * - Only calls Gemini when the user clicks. Result is cached by `cacheKey`.
 *
 * Props: cacheKey, buildContext() -> object, enabled, label, title, className
 */
export default function AIInsight({ cacheKey, buildContext, enabled = true, label = 'Analisar com IA', title = 'Análise por IA (Gemini)', className = '' }) {
  const [data, setData] = useState(null); // { interpretation, recommendations }
  const [savedAt, setSavedAt] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setData(null); setSavedAt(null);
    if (!cacheKey) return;
    getAI(cacheKey).then((c) => { if (alive && c?.data) { setData(c.data); setSavedAt(c.savedAt); } });
    return () => { alive = false; };
  }, [cacheKey]);

  const run = async () => {
    if (!enabled) return;
    setLoading(true);
    try {
      const r = await aiApi.interpret(buildContext());
      const payload = { interpretation: r.interpretation || '', recommendations: r.recommendations || [] };
      setData(payload); setSavedAt(new Date().toISOString());
      await saveAI(cacheKey, payload);
      toast.success('Análise da IA atualizada.');
    } catch (e) {
      toast.error(e.message || 'Falha na IA. Verifique Configurações → IA.');
    } finally { setLoading(false); }
  };

  return (
    <div className={`rounded-lg border border-primary/25 bg-primary/5 p-4 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs font-semibold text-primary flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> {title}</p>
        <div className="flex items-center gap-2">
          {savedAt && <span className="text-[10px] text-muted-foreground hidden sm:flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(savedAt).toLocaleString('pt-BR')}</span>}
          <button onClick={run} disabled={loading || !enabled} title={!enabled ? 'Sem dados suficientes' : undefined}
            className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-primary/40 text-primary hover:bg-primary/10 transition disabled:opacity-50">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : data ? <RefreshCw className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
            {loading ? 'Analisando…' : data ? 'Regenerar' : label}
          </button>
        </div>
      </div>

      {!data ? (
        <p className="text-xs text-muted-foreground">{enabled ? 'Clique para gerar uma leitura em linguagem clara com o Gemini. O resultado fica salvo localmente e é reaproveitado — sem gastar tokens de novo.' : 'Gere ou selecione dados para habilitar a análise por IA.'}</p>
      ) : (
        <>
          <div className="prose prose-sm prose-invert max-w-none">
            <ReactMarkdown components={{
              p: ({ children }) => <p className="text-xs text-muted-foreground mb-2 leading-relaxed">{children}</p>,
              strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
              ul: ({ children }) => <ul className="list-disc ml-4 space-y-0.5">{children}</ul>,
              li: ({ children }) => <li className="text-xs text-muted-foreground">{children}</li>,
              h2: ({ children }) => <h4 className="text-xs font-semibold text-foreground mt-2 mb-1">{children}</h4>,
              h3: ({ children }) => <h4 className="text-xs font-semibold text-foreground mt-2 mb-1">{children}</h4>,
            }}>{data.interpretation}</ReactMarkdown>
          </div>
          {data.recommendations?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-primary/15">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Próximos passos</p>
              <ul className="space-y-1">{data.recommendations.map((r, i) => <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5"><TrendingUp className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" /> {r}</li>)}</ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
