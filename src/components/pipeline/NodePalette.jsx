import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { NODE_TYPES, PALETTE_GROUPS } from './NodeTypes';
import {
  Database, Filter, ArrowUpDown, Wrench, Tags, Wand2,
  Scissors, Brain, TrendingUp, Network, BarChart3, Download, Columns, Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';

const ICONS = { Database, Filter, ArrowUpDown, Wrench, Tags, Wand2, Scissors, Brain, TrendingUp, Network, BarChart3, Download, Columns };

export default function NodePalette({ onAddNode }) {
  const [search, setSearch] = useState('');

  const filtered = search
    ? Object.entries(NODE_TYPES).filter(([_, t]) =>
        t.label.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/20">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar bloco..."
            className="h-7 text-xs bg-secondary/40 pl-7"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-4">
        {filtered ? (
          <div className="space-y-1.5">
            {filtered.map(([typeKey, type]) => (
              <PaletteItem key={typeKey} typeKey={typeKey} type={type} onAdd={onAddNode} />
            ))}
          </div>
        ) : (
          PALETTE_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <span className={cn('inline-block w-1 h-1 rounded-full', `bg-${group.color}-400`)} />
                {group.label}
              </p>
              <div className="space-y-1.5">
                {group.types.map(typeKey => (
                  <PaletteItem key={typeKey} typeKey={typeKey} type={NODE_TYPES[typeKey]} onAdd={onAddNode} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="p-3 border-t border-border/20">
        <p className="text-[9px] text-muted-foreground text-center leading-relaxed">
          Clique para adicionar ao canvas.<br />
          Arraste as portas <span className="text-primary">●</span> para conectar.
        </p>
      </div>
    </div>
  );
}

function PaletteItem({ typeKey, type, onAdd }) {
  const Icon = ICONS[type.icon] || Database;
  return (
    <button
      onClick={() => onAdd(typeKey)}
      className={cn(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border transition-all text-left group',
        'border-border/20 hover:border-primary/40 hover:bg-primary/5',
        'bg-secondary/10'
      )}
    >
      <div className={cn('w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-all group-hover:scale-110', type.bgColor)}>
        <Icon className={cn('w-3 h-3', type.textColor)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">{type.label}</p>
        <p className="text-[8px] text-muted-foreground capitalize">{type.category}</p>
      </div>
    </button>
  );
}