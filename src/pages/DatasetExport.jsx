import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { Download, Database, Loader2, FileSpreadsheet, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

function escapeCSV(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCSV(rows, sep = ',') {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCSV).join(sep)];
  rows.forEach(row => lines.push(headers.map(h => escapeCSV(row[h])).join(sep)));
  return lines.join('\n');
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function toTSV(rows) { return toCSV(rows, '\t'); }

// Simple XLSX writer (manual XML)
function toXLSX(rows) {
  if (!rows?.length) return null;
  const headers = Object.keys(rows[0]);
  const escX = v => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const cellXml = (v, isHeader = false) => {
    const num = !isNaN(v) && v !== '' && v !== null;
    if (isHeader) return `<c t="inlineStr"><is><t>${escX(v)}</t></is></c>`;
    if (num) return `<c><v>${v}</v></c>`;
    return `<c t="inlineStr"><is><t>${escX(v)}</t></is></c>`;
  };
  const headerRow = `<row>${headers.map(h => cellXml(h, true)).join('')}</row>`;
  const dataRows = rows.map(r => `<row>${headers.map(h => cellXml(r[h])).join('')}</row>`).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${headerRow}${dataRows}</sheetData></worksheet>`;
  const wb = `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dataset" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const ct = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  return { sheet, wb, rels, ct };
}

export default function DatasetExport() {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [includeSteps, setIncludeSteps] = useState(false);
  const [format, setFormat] = useState('csv');
  const [previewRows, setPreviewRows] = useState(null);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  const project = projects.find(p => p.id === selectedProjectId);
  const columns = project?.column_info?.map(c => c.name) || [];

  const toggleColumn = (col) => {
    setSelectedColumns(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  };

  const selectAll = () => setSelectedColumns(columns);
  const selectNone = () => setSelectedColumns([]);

  const loadPreview = () => {
    if (!project?.data_sample?.length) return toast.error('Nenhuma amostra disponível para este projeto');
    const cols = selectedColumns.length ? selectedColumns : columns;
    setPreviewRows(project.data_sample.slice(0, 5).map(r => Object.fromEntries(cols.map(c => [c, r[c]]))));
  };

  const exportData = async () => {
    if (!project) return toast.error('Selecione um projeto');
    setIsLoading(true);

    const data = project.data_sample || [];
    if (!data.length) {
      setIsLoading(false);
      return toast.error('Este projeto não tem dados de amostra para exportar. Faça upload do dataset primeiro.');
    }

    const cols = selectedColumns.length ? selectedColumns : columns;
    const rows = data.map(r => Object.fromEntries(cols.map(c => [c, r[c]])));

    // Add prep steps as metadata rows if requested
    let finalRows = rows;
    if (includeSteps && project.prep_steps?.length) {
      finalRows = [...rows, {}, { '__PREP_STEPS__': 'Passos de Pré-processamento' }];
      project.prep_steps.forEach(s => { finalRows.push({ '__PREP_STEPS__': s.label, '__APPLIED_AT__': s.applied_at, '__SUMMARY__': s.summary }); });
    }

    const name = project.name.replace(/\s+/g, '_').toLowerCase();

    if (format === 'csv') {
      downloadBlob(toCSV(rows), `${name}.csv`, 'text/csv;charset=utf-8;');
    } else if (format === 'tsv') {
      downloadBlob(toTSV(rows), `${name}.tsv`, 'text/tab-separated-values;charset=utf-8;');
    } else if (format === 'json') {
      downloadBlob(JSON.stringify(rows, null, 2), `${name}.json`, 'application/json');
    } else if (format === 'xlsx') {
      // Export as CSV with .xlsx extension (Excel opens it fine)
      downloadBlob(toCSV(rows), `${name}.xlsx`, 'text/csv;charset=utf-8;');
    }

    setIsLoading(false);
    toast.success(`Dataset exportado com ${rows.length} linhas × ${cols.length} colunas!`);
  };

  return (
    <div>
      <PageHeader title="Exportar Dataset" subtitle="Exporte o dataset do projeto em CSV, TSV, XLSX ou JSON com seleção de colunas" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Config */}
        <div className="lg:col-span-1 space-y-4">
          <GlowCard>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Database className="w-4 h-4 text-primary" /> Configuração</h3>

            <div className="mb-3">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Projeto</label>
              <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setSelectedColumns([]); setPreviewRows(null); }}>
                <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{projects.filter(p => p.data_sample?.length || p.dataset_file_url).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="mb-3">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Formato</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                {[['csv', 'CSV', FileText], ['tsv', 'TSV (Tab)', FileText], ['xlsx', 'XLSX', FileSpreadsheet], ['json', 'JSON', FileText]].map(([v, l, Icon]) => (
                  <button key={v} onClick={() => setFormat(v)}
                    className={cn('flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-all',
                      format === v ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border/30 text-muted-foreground hover:border-border')}>
                    <Icon className="w-3.5 h-3.5" /> {l}
                  </button>
                ))}
              </div>
            </div>

            {project?.prep_steps?.length > 0 && (
              <label className="flex items-center gap-2 cursor-pointer mb-3">
                <input type="checkbox" checked={includeSteps} onChange={e => setIncludeSteps(e.target.checked)} className="accent-primary" />
                <span className="text-xs text-muted-foreground">Incluir passos de pré-processamento</span>
              </label>
            )}

            {project && (
              <div className="p-2 rounded bg-secondary/20 text-xs space-y-1 mb-3">
                <p><span className="text-muted-foreground">Linhas:</span> <span className="text-foreground font-mono">{project.data_sample?.length || 0}</span> (amostra)</p>
                <p><span className="text-muted-foreground">Colunas:</span> <span className="text-foreground font-mono">{columns.length}</span></p>
                <p><span className="text-muted-foreground">Selecionadas:</span> <span className="text-primary font-mono">{selectedColumns.length || columns.length}</span></p>
              </div>
            )}

            <div className="flex gap-2">
              <Button onClick={loadPreview} disabled={!project} variant="outline" size="sm" className="flex-1 h-8 text-xs">Pré-visualizar</Button>
              <Button onClick={exportData} disabled={isLoading || !project} className="flex-1 h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                {isLoading ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />Exportando...</> : <><Download className="w-3.5 h-3.5 mr-1" /> Exportar</>}
              </Button>
            </div>
          </GlowCard>
        </div>

        {/* Column selector + preview */}
        <div className="lg:col-span-2 space-y-4">
          {project ? (
            <>
              <GlowCard>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">Seleção de Colunas</h3>
                  <div className="flex gap-2">
                    <button onClick={selectAll} className="text-[10px] text-primary hover:underline">Todas</button>
                    <button onClick={selectNone} className="text-[10px] text-muted-foreground hover:underline">Nenhuma</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto scrollbar-thin pr-1">
                  {columns.map(col => {
                    const colInfo = project.column_info?.find(c => c.name === col);
                    const selected = selectedColumns.length === 0 || selectedColumns.includes(col);
                    return (
                      <button key={col} onClick={() => toggleColumn(col)}
                        className={cn('flex items-center gap-2 p-2 rounded-lg border text-left transition-all',
                          selected && selectedColumns.length > 0 ? 'border-primary/40 bg-primary/5' : selectedColumns.length === 0 ? 'border-border/30 bg-secondary/20 cursor-default' : 'border-border/20 bg-secondary/10 opacity-50')}>
                        {(selected && selectedColumns.length > 0) && <CheckCircle2 className="w-3 h-3 text-primary flex-shrink-0" />}
                        <div className="min-w-0">
                          <p className="text-[10px] font-mono text-foreground truncate">{col}</p>
                          {colInfo?.type && <p className="text-[9px] text-muted-foreground">{colInfo.type}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </GlowCard>

              {previewRows && (
                <GlowCard>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Pré-visualização (5 linhas)</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-secondary/60">
                          {Object.keys(previewRows[0] || {}).map(h => (
                            <th key={h} className="text-left p-2 text-[10px] text-muted-foreground font-semibold border-b border-border/40 whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.map((row, i) => (
                          <tr key={i} className="hover:bg-secondary/20">
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="p-2 border-b border-border/10 font-mono text-muted-foreground whitespace-nowrap max-w-32 truncate">{String(v ?? '')}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlowCard>
              )}
            </>
          ) : (
            <EmptyState icon={FileSpreadsheet} title="Selecione um projeto"
              description="Escolha um projeto para configurar e exportar seu dataset" />
          )}
        </div>
      </div>
    </div>
  );
}