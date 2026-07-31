import React from 'react';
import GlowCard from '@/components/ui/GlowCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Database } from 'lucide-react';

export default function DataPreviewTable({ data, columns }) {
  if (!data || data.length === 0) return null;

  const colNames = columns?.map(c => c.name) || Object.keys(data[0] || {});

  return (
    <GlowCard>
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Database className="w-4 h-4 text-primary" /> Prévia dos Dados
        <span className="text-xs text-muted-foreground font-normal ml-auto">
          Exibindo {data.length} linhas × {colNames.length} colunas
        </span>
      </h3>
      <ScrollArea className="w-full">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50">
                {colNames.slice(0, 10).map((col, i) => (
                  <TableHead key={i} className="text-xs font-mono text-primary whitespace-nowrap">
                    {col}
                  </TableHead>
                ))}
                {colNames.length > 10 && <TableHead className="text-xs text-muted-foreground">+{colNames.length - 10} more</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.slice(0, 10).map((row, ri) => (
                <TableRow key={ri} className="border-border/30 hover:bg-secondary/30">
                  {colNames.slice(0, 10).map((col, ci) => (
                    <TableCell key={ci} className="text-xs font-mono text-muted-foreground whitespace-nowrap max-w-40 truncate">
                      {row[col] !== null && row[col] !== undefined ? String(row[col]) : <span className="text-destructive/50 italic">null</span>}
                    </TableCell>
                  ))}
                  {colNames.length > 10 && <TableCell className="text-xs text-muted-foreground">...</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>
    </GlowCard>
  );
}