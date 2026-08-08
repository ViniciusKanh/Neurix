import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Search, CornerDownLeft } from 'lucide-react';

// Quick navigation targets (⌘K / Ctrl+K).
const ITEMS = [
  { label: 'Painel', path: '/', kw: 'home dashboard inicio' },
  { label: 'Projetos', path: '/projects', kw: 'projetos' },
  { label: 'Novo Projeto', path: '/projects/new', kw: 'criar novo dataset upload' },
  { label: 'Explorador de Dados', path: '/explorer', kw: 'eda dados exploração' },
  { label: 'Perfilamento de Dados', path: '/data-profiling', kw: 'profiling' },
  { label: 'ML Studio', path: '/ml-studio', kw: 'treinar modelo classificação regressão' },
  { label: 'Laboratório do Modelo', path: '/model-lab', kw: 'simulador xai explicação fronteira avaliação what-if' },
  { label: 'Scoring em Lote', path: '/batch-score', kw: 'pontuar prever csv lote batch' },
  { label: 'AutoML Pipeline', path: '/automl', kw: 'automl' },
  { label: 'Comparação de Modelos', path: '/model-comparison', kw: 'comparar' },
  { label: 'Hyperparameter Tuning', path: '/hyperparam-tuning', kw: 'hiperparametros tuning' },
  { label: 'Testes ML Avançados', path: '/advanced-ml', kw: 'causal sobrevivência calibração' },
  { label: 'Regras de Associação', path: '/association-rules', kw: 'apriori regras' },
  { label: 'Séries Temporais', path: '/time-series', kw: 'forecast previsão temporal' },
  { label: 'Inferência & Retreino', path: '/inference', kw: 'prever inferencia' },
  { label: 'Deploy', path: '/deploy', kw: 'produção deploy' },
  { label: 'Monitoramento', path: '/monitoring', kw: 'drift monitorar' },
  { label: 'Champion vs Challenger', path: '/champion-challenger', kw: 'comparar promover' },
  { label: 'Testes A/B', path: '/ab-test', kw: 'ab teste' },
  { label: 'Relatórios', path: '/reports', kw: 'relatorio pdf' },
  { label: 'Visualização 3D', path: '/visualization-3d', kw: 'pca 3d cluster' },
  { label: 'Configurações', path: '/settings', kw: 'perfil tema aparencia senha 2fa email' },
];

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const navigate = useNavigate();
  const { user } = useAuth();
  const inputRef = useRef();

  const items = user?.role === 'admin' ? [...ITEMS, { label: 'Controle de Usuários', path: '/users', kw: 'usuarios admin permissao' }] : ITEMS;
  const filtered = items.filter((i) => {
    const s = (i.label + ' ' + i.kw).toLowerCase();
    return q.trim().split(/\s+/).every((t) => s.includes(t.toLowerCase()));
  });

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); setQ(''); setSel(0); }
      else if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => { setOpen(true); setQ(''); setSel(0); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('neurix:open-palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('neurix:open-palette', onOpen); };
  }, []);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30); }, [open]);
  useEffect(() => { setSel(0); }, [q]);

  if (!open) return null;

  const go = (path) => { setOpen(false); navigate(path); };
  const onInputKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter' && filtered[sel]) { e.preventDefault(); go(filtered[sel].path); }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <div className="w-full max-w-lg rounded-2xl glass-strong border border-primary/20 overflow-hidden shadow-2xl" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-border/50">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onInputKey}
            placeholder="Buscar telas… (ex.: ML Studio, deploy, simulador)"
            className="flex-1 bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted-foreground" />
          <kbd className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">Esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto scrollbar-thin p-1.5">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nada encontrado.</p>
          ) : filtered.map((i, idx) => (
            <button key={i.path} onMouseEnter={() => setSel(idx)} onClick={() => go(i.path)}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm ${idx === sel ? 'bg-primary/15 text-primary' : 'text-foreground hover:bg-primary/5'}`}>
              <span>{i.label}</span>
              {idx === sel && <CornerDownLeft className="w-3.5 h-3.5 opacity-60" />}
            </button>
          ))}
        </div>
        <div className="px-4 py-2 border-t border-border/50 text-[10px] text-muted-foreground flex gap-3">
          <span>↑↓ navegar</span><span>↵ abrir</span><span>⌘K / Ctrl+K</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
