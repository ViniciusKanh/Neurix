import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import GlowCard from '@/components/ui/GlowCard';
import { Button } from '@/components/ui/button';
import {
  Search, ChevronDown, ChevronUp, Cpu, BookOpen,
  Download, Copy, CheckCircle2, ExternalLink, Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { MODEL_LIBRARY, CATEGORIES, FAMILIES } from './modelData';
import { toast } from 'sonner';

const CATEGORY_COLORS = {
  'Classificação': 'text-primary bg-primary/10 border-primary/20',
  'Regressão': 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  'Clustering': 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  'Anomaly Detection': 'text-red-400 bg-red-400/10 border-red-400/20',
  'Redução de Dimensionalidade': 'text-purple-400 bg-purple-400/10 border-purple-400/20',
};

function getCatColor(category) {
  for (const [key, val] of Object.entries(CATEGORY_COLORS)) {
    if (category.includes(key)) return val;
  }
  return 'text-muted-foreground bg-secondary border-border';
}

function CopyButton({ text, label = 'Copiar' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Código copiado!');
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copiado!' : label}
    </button>
  );
}

function exportModelConfig(model) {
  const config = {
    id: model.id,
    name: model.name,
    category: model.category,
    family: model.family,
    description: model.description,
    mathematical_theory: model.theory,
    complexity: model.complexity,
    hyperparameters: model.params,
    when_to_use: model.when_to_use,
    avoid_when: model.avoid_when,
    use_cases: model.use_cases,
    evaluation_metrics: model.metrics,
    advantages: model.pros,
    limitations: model.cons,
    related_algorithms: model.related,
    python_implementation: model.implementation,
    tuning_strategy: model.tuning,
    references: model.references,
    exported_at: new Date().toISOString(),
    platform: 'ML Studio',
  };
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${model.id}_config.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Configuração de "${model.name}" exportada!`);
}

function exportModelScript(model) {
  const script = `#!/usr/bin/env python3
"""
Modelo: ${model.name}
Categoria: ${model.category}
Família: ${model.family}
Gerado por: ML Studio — ${new Date().toLocaleDateString('pt-BR')}

Teoria:
${model.theory}

Quando usar: ${model.when_to_use}
Evitar quando: ${model.avoid_when}

Complexidade: ${model.complexity}
"""

# ─── Implementação ───────────────────────────────────────────────────────────
${model.implementation}


# ─── Hiperparâmetros e Tuning ────────────────────────────────────────────────
${typeof model.tuning === 'string' ? model.tuning : '# Ver documentação do modelo'}


# ─── Métricas de Avaliação ───────────────────────────────────────────────────
# ${Object.entries(model.metrics).map(([t, ms]) => t + ': ' + ms.join(', ')).join('\n# ')}


# ─── Referências ─────────────────────────────────────────────────────────────
# ${(model.references || []).join('\n# ')}
`;
  const blob = new Blob([script], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${model.id}_implementation.py`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Script Python de "${model.name}" exportado!`);
}

function RelatedChip({ name, onNavigate }) {
  // Find model by name (fuzzy match)
  const found = MODEL_LIBRARY.find(m =>
    m.name.toLowerCase().includes(name.toLowerCase()) ||
    name.toLowerCase().includes(m.name.toLowerCase().split(' ')[0])
  );
  return (
    <button
      onClick={() => found ? onNavigate(found.id) : null}
      title={found ? `Ver ${found.name}` : name}
      className={cn(
        'px-1.5 py-0.5 rounded text-[10px] transition-colors flex items-center gap-0.5',
        found
          ? 'bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer'
          : 'bg-secondary/60 text-muted-foreground cursor-default'
      )}
    >
      {name}
      {found && <ExternalLink className="w-2.5 h-2.5 ml-0.5 opacity-60" />}
    </button>
  );
}

function ParamTable({ params }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border/20">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="bg-secondary/60">
            <th className="text-left p-2.5 text-[10px] text-muted-foreground font-semibold border-b border-border/30 w-44">Parâmetro</th>
            <th className="text-left p-2.5 text-[10px] text-muted-foreground font-semibold border-b border-border/30">Descrição & Valores</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, i) => (
            <tr key={i} className={cn('hover:bg-secondary/20', i % 2 === 0 && 'bg-secondary/5')}>
              <td className="p-2.5 font-mono text-primary text-[10px] align-top border-b border-border/10">{p.name}</td>
              <td className="p-2.5 text-muted-foreground align-top text-xs border-b border-border/10">{p.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModelCard({ model, highlight, onRelatedClick }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const catColor = getCatColor(model.category);
  const tabs = ['overview', 'params', 'code', 'export', 'refs'];
  const tabLabels = {
    overview: '📋 Visão Geral',
    params: '⚙️ Parâmetros',
    code: '💻 Código',
    export: '📦 Exportar',
    refs: '📚 Refs'
  };

  const isHighlighted = highlight === model.id;

  React.useEffect(() => {
    if (isHighlighted) {
      setExpanded(true);
      setTimeout(() => {
        document.getElementById(`model-${model.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [isHighlighted, model.id]);

  return (
    <GlowCard
      id={`model-${model.id}`}
      hover={false}
      className={cn(expanded && 'border-primary/40', isHighlighted && 'ring-1 ring-primary/50')}
    >
      <button className="w-full text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground">{model.name}</p>
                <span className={cn('px-1.5 py-0.5 rounded border text-[9px] sm:text-[10px] font-semibold hidden xs:inline-block', catColor)}>
                  {model.category}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-secondary border border-border/30 text-[9px] text-muted-foreground hidden sm:inline-block">
                  {model.family}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 max-w-[85vw] sm:max-w-xl">
                {model.description.slice(0, 110)}...
              </p>
            </div>
          </div>
          {expanded
            ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          }
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border/30">
          {/* Tags mobile */}
          <div className="flex gap-1.5 flex-wrap mb-3 sm:hidden">
            <span className={cn('px-1.5 py-0.5 rounded border text-[10px] font-semibold', catColor)}>{model.category}</span>
            <span className="px-1.5 py-0.5 rounded bg-secondary border border-border/30 text-[10px] text-muted-foreground">{model.family}</span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-secondary/30 p-1 rounded-lg w-full mb-4 overflow-x-auto scrollbar-thin">
            {tabs.map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={cn(
                  'px-2 sm:px-3 py-1 rounded-md text-[10px] font-medium transition-all whitespace-nowrap flex-shrink-0',
                  activeTab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}>
                {tabLabels[t]}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-secondary/20 border border-border/20">
                  <p className="text-[10px] text-primary uppercase tracking-wider mb-2 font-semibold">Descrição</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{model.description}</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-400/5 border border-amber-400/20">
                  <p className="text-[10px] text-amber-400 uppercase tracking-wider mb-2 font-semibold">Fundamento Matemático</p>
                  <p className="text-[10px] text-muted-foreground leading-relaxed font-mono break-all">{model.theory}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-emerald-400/5 border border-emerald-400/20">
                  <p className="text-[10px] text-emerald-400 uppercase tracking-wider mb-2 font-semibold">✓ Vantagens</p>
                  <ul className="space-y-1">{model.pros.map((p, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-emerald-400 flex-shrink-0 mt-px">•</span>{p}</li>
                  ))}</ul>
                </div>
                <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <p className="text-[10px] text-destructive uppercase tracking-wider mb-2 font-semibold">✕ Limitações</p>
                  <ul className="space-y-1">{model.cons.map((c, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex gap-1.5"><span className="text-destructive flex-shrink-0 mt-px">•</span>{c}</li>
                  ))}</ul>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <p className="text-[10px] text-primary uppercase tracking-wider mb-1 font-semibold">✓ Use quando</p>
                  <p className="text-xs text-muted-foreground">{model.when_to_use}</p>
                </div>
                <div className="p-3 rounded-lg bg-secondary/20 border border-border/20">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-semibold">✕ Evite quando</p>
                  <p className="text-xs text-muted-foreground">{model.avoid_when}</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Casos de Uso</p>
                  <div className="flex flex-wrap gap-1">
                    {model.use_cases.map((u, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-secondary border border-border/30 text-[10px] text-muted-foreground">{u}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Métricas de Avaliação</p>
                  {Object.entries(model.metrics).map(([type, ms]) => (
                    <div key={type} className="mb-1">
                      <p className="text-[9px] text-muted-foreground uppercase">{type}:</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {ms.map((m, i) => <span key={i} className="px-1 py-0.5 rounded bg-accent/10 border border-accent/20 text-[9px] text-accent">{m}</span>)}
                      </div>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">Complexidade</p>
                  <code className="text-[10px] text-amber-400 font-mono leading-relaxed block break-all">{model.complexity}</code>
                  {model.related && (
                    <>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5 mt-3 font-semibold flex items-center gap-1">
                        <Tag className="w-3 h-3" /> Algoritmos Relacionados
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {model.related.map((r, i) => (
                          <RelatedChip key={i} name={r} onNavigate={onRelatedClick} />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'params' && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Hiperparâmetros com descrições e valores recomendados.</p>
              <ParamTable params={model.params} />
              {model.tuning && (
                <>
                  <div className="flex items-center justify-between mt-3 mb-1.5">
                    <p className="text-[10px] text-amber-400 uppercase tracking-wider font-semibold">🔧 Estratégia de Tuning</p>
                    <CopyButton text={model.tuning} label="Copiar código" />
                  </div>
                  <pre className="bg-secondary/50 rounded-lg p-3 text-[10px] font-mono text-amber-400 overflow-x-auto whitespace-pre-wrap">{model.tuning}</pre>
                </>
              )}
            </div>
          )}

          {activeTab === 'code' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Implementação completa em Python.</p>
                <CopyButton text={model.implementation} label="Copiar código" />
              </div>
              <pre className="bg-secondary/50 rounded-lg p-4 text-[11px] font-mono text-emerald-400 overflow-x-auto whitespace-pre leading-relaxed">{model.implementation}</pre>
            </div>
          )}

          {activeTab === 'export' && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Exporte a documentação e configuração completa do modelo para usar em outros ambientes.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-4 rounded-lg border border-border/30 bg-secondary/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Download className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Config JSON</p>
                      <p className="text-[10px] text-muted-foreground">Documentação + parâmetros</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Arquivo JSON com teoria, parâmetros, métricas, casos de uso e referências. Ideal para documentação e integração com outros sistemas.
                  </p>
                  <Button size="sm" className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => exportModelConfig(model)}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar JSON
                  </Button>
                </div>

                <div className="p-4 rounded-lg border border-border/30 bg-secondary/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-400/10 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Script Python</p>
                      <p className="text-[10px] text-muted-foreground">Implementação pronta + comentários</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Script <code className="text-emerald-400">.py</code> completo com implementação, tuning e referências em comentários. Pronto para usar em produção.
                  </p>
                  <Button size="sm" variant="outline" className="w-full border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10"
                    onClick={() => exportModelScript(model)}>
                    <Download className="w-3.5 h-3.5 mr-1.5" /> Baixar .py
                  </Button>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-400/5 border border-amber-400/20">
                <p className="text-[10px] text-amber-400 font-semibold mb-1">💡 Uso em Produção</p>
                <p className="text-[10px] text-muted-foreground">
                  Para usar em produção: (1) baixe o script .py, (2) instale as dependências listadas, 
                  (3) substitua <code className="text-amber-400">X_train, y_train</code> pelos seus dados, 
                  (4) ajuste os hiperparâmetros conforme tuning recomendado.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'refs' && (
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 font-semibold">📚 Referências Bibliográficas</p>
              {model.references?.map((r, i) => (
                <div key={i} className="flex gap-2 items-start p-2 rounded bg-secondary/20 hover:bg-secondary/30 transition-colors">
                  <span className="text-primary text-xs font-mono flex-shrink-0">[{i + 1}]</span>
                  <p className="text-xs text-muted-foreground">{r}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </GlowCard>
  );
}

export default function ModelLibrary() {
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('Todos');
  const [filterFamily, setFilterFamily] = useState('Todas as Famílias');
  const [highlightId, setHighlightId] = useState(null);

  const filtered = MODEL_LIBRARY.filter(m => {
    const matchCat = filterCat === 'Todos' || m.category.includes(filterCat);
    const matchFamily = filterFamily === 'Todas as Famílias' || m.family === filterFamily;
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) ||
      m.description.toLowerCase().includes(q) ||
      m.use_cases.some(u => u.toLowerCase().includes(q)) ||
      m.family.toLowerCase().includes(q);
    return matchCat && matchFamily && matchSearch;
  });

  const handleRelatedClick = (id) => {
    setFilterCat('Todos');
    setFilterFamily('Todas as Famílias');
    setSearch('');
    setHighlightId(id);
    setTimeout(() => setHighlightId(null), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total de Modelos', value: MODEL_LIBRARY.length, color: 'text-primary' },
          { label: 'Classificação', value: MODEL_LIBRARY.filter(m => m.category.includes('Classificação')).length, color: 'text-primary' },
          { label: 'Regressão', value: MODEL_LIBRARY.filter(m => m.category.includes('Regressão')).length, color: 'text-amber-400' },
          { label: 'Não Supervisionado', value: MODEL_LIBRARY.filter(m => ['Clustering', 'Anomaly Detection', 'Redução de Dimensionalidade'].some(c => m.category.includes(c))).length, color: 'text-emerald-400' },
        ].map((s, i) => (
          <div key={i} className="p-3 rounded-lg bg-secondary/30 border border-border/20 text-center">
            <p className={cn('text-xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-36">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar modelo, caso de uso..."
            className="pl-8 h-8 text-xs bg-secondary/50" />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="h-8 text-xs rounded-md border border-input bg-secondary/50 px-2 text-foreground min-w-0">
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterFamily} onChange={e => setFilterFamily(e.target.value)}
          className="h-8 text-xs rounded-md border border-input bg-secondary/50 px-2 text-foreground min-w-0 hidden sm:block">
          {FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <span className="text-xs text-muted-foreground whitespace-nowrap">{filtered.length} modelo(s)</span>
      </div>

      <div className="space-y-2">
        {filtered.map(model => (
          <ModelCard
            key={model.id}
            model={model}
            highlight={highlightId}
            onRelatedClick={handleRelatedClick}
          />
        ))}
      </div>
    </div>
  );
}