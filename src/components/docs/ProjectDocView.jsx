import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { BookOpen, Download, Brain, Copy, FileDown, CheckCircle2, AlertTriangle, BarChart3, Layers, Database, Zap, Clock, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { buildLocalReport } from '@/lib/localReports';

const REPORT_TYPES = [
  { id: 'technical', label: '📋 Técnico Completo', desc: 'Dataset, pipeline, modelos, métricas, próximos passos' },
  { id: 'executive', label: '📊 Resumo Executivo', desc: 'Descobertas, oportunidades e recomendações de negócio' },
  { id: 'eda', label: '🔬 Análise Exploratória', desc: 'Variáveis, qualidade, padrões e tendências dos dados' },
  { id: 'dataset', label: '🗄️ Perfil do Dataset', desc: 'Inventário de colunas, missing values e pipeline de prep' },
];

function QualityBadge({ score }) {
  const cfg = score >= 80
    ? { color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', label: 'Ótima' }
    : score >= 60
    ? { color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', label: 'Boa' }
    : { color: 'text-destructive bg-destructive/10 border-destructive/20', label: 'Baixa' };
  return (
    <span className={cn('px-2 py-0.5 rounded-full border text-[10px] font-bold', cfg.color)}>
      {score}% — {cfg.label}
    </span>
  );
}

function estimateQuality(project) {
  const cols = project.column_info || [];
  if (!cols.length) return 70;
  const avgNull = cols.reduce((s, c) => s + (c.null_percent || 0), 0) / cols.length;
  const rows = project.dataset_size || 100;
  const sizeFactor = Math.min(30, Math.log10(rows + 1) * 10);
  return Math.round(Math.max(30, Math.min(98, 85 - avgNull * 0.5 + sizeFactor * 0.2)));
}

function exportDocToPDF(docContent, projectName) {
  const printWindow = window.open('', '_blank');
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Documentação — ${projectName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Georgia', serif; font-size: 11pt; line-height: 1.7; color: #1a1a2e; padding: 2.5cm 3cm; }
    h1 { font-size: 22pt; color: #0f3460; margin: 1.5em 0 0.5em; border-bottom: 3px solid #0f3460; padding-bottom: 0.3em; }
    h2 { font-size: 15pt; color: #16213e; margin: 1.2em 0 0.4em; border-left: 4px solid #0f3460; padding-left: 0.6em; }
    h3 { font-size: 12pt; color: #16213e; margin: 1em 0 0.3em; }
    p { margin-bottom: 0.8em; text-align: justify; }
    ul, ol { margin: 0.5em 0 0.8em 1.5em; }
    li { margin-bottom: 0.3em; }
    code { font-family: 'Courier New', monospace; background: #f0f4ff; border: 1px solid #ccd6f6; padding: 1px 4px; border-radius: 3px; font-size: 9pt; color: #1a237e; }
    pre { font-family: 'Courier New', monospace; background: #f8f9ff; border: 1px solid #c5cae9; border-left: 4px solid #3f51b5; padding: 12px; border-radius: 4px; margin: 0.8em 0; white-space: pre-wrap; font-size: 9pt; color: #1a237e; }
    blockquote { border-left: 4px solid #90caf9; padding: 0.5em 1em; color: #555; background: #f0f7ff; margin: 0.8em 0; font-style: italic; }
    table { width: 100%; border-collapse: collapse; margin: 0.8em 0; font-size: 10pt; }
    th { background: #0f3460; color: white; padding: 8px 10px; text-align: left; }
    td { padding: 7px 10px; border-bottom: 1px solid #e0e0e0; }
    tr:nth-child(even) { background: #f5f7ff; }
    strong { color: #0f3460; }
    .cover { text-align: center; padding: 5cm 0 3cm; border-bottom: 3px solid #0f3460; margin-bottom: 2cm; }
    .cover h1 { font-size: 28pt; border: none; padding: 0; }
    @media print { body { padding: 1.5cm 2cm; } h1, h2 { page-break-after: avoid; } }
  </style>
</head>
<body>
  <div class="cover">
    <h1>📊 ${projectName}</h1>
    <div style="font-size:13pt;color:#555;margin-top:0.5em">Documentação Técnica de ML</div>
    <div style="font-size:10pt;color:#888;margin-top:2em">Gerado em: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
  </div>
  <div>${docContent
    .replace(/^######\s(.+)$/gm, '<h6>$1</h6>').replace(/^#####\s(.+)$/gm, '<h5>$1</h5>')
    .replace(/^####\s(.+)$/gm, '<h4>$1</h4>').replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^##\s(.+)$/gm, '<h2>$1</h2>').replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>').replace(/```[\w]*\n([\s\S]*?)```/g, '<pre>$1</pre>')
    .replace(/^>\s(.+)$/gm, '<blockquote>$1</blockquote>').replace(/^-\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>').replace(/\n\n/g, '</p><p>')
  }</div>
  <script>window.onload = function(){ window.print(); }</script>
</body></html>`;
  printWindow.document.write(html);
  printWindow.document.close();
}

const mdComponents = {
  h1: ({ children }) => <h1 className="text-lg font-bold text-foreground mb-3 mt-5 pb-2 border-b border-border/40 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-sm font-bold text-primary mb-2 mt-5 pl-2 border-l-2 border-primary/50">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-semibold text-foreground mb-1.5 mt-3">{children}</h3>,
  h4: ({ children }) => <h4 className="text-xs font-semibold text-muted-foreground mb-1 mt-2">{children}</h4>,
  p: ({ children }) => <p className="text-xs text-muted-foreground mb-2.5 leading-relaxed">{children}</p>,
  ul: ({ children }) => <ul className="mb-2 space-y-0.5 ml-4">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 space-y-0.5 ml-4 list-decimal">{children}</ol>,
  li: ({ children }) => <li className="text-xs text-muted-foreground list-disc">{children}</li>,
  strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-muted-foreground italic">{children}</em>,
  code: ({ inline, children }) => inline
    ? <code className="text-primary bg-primary/10 px-1 rounded text-[10px] font-mono">{children}</code>
    : <pre className="bg-secondary/50 p-3 rounded text-[10px] font-mono text-emerald-400 overflow-x-auto mb-2 whitespace-pre-wrap leading-relaxed">{children}</pre>,
  table: ({ children }) => <div className="overflow-x-auto mb-3 rounded border border-border/30"><table className="w-full text-xs border-collapse">{children}</table></div>,
  thead: ({ children }) => <thead className="bg-secondary/60">{children}</thead>,
  th: ({ children }) => <th className="p-2 text-left text-[10px] text-muted-foreground font-semibold border border-border/30">{children}</th>,
  td: ({ children }) => <td className="p-2 text-xs text-foreground border border-border/20">{children}</td>,
  blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-3 my-2 text-muted-foreground italic bg-primary/5 py-1 rounded-r">{children}</blockquote>,
  hr: () => <hr className="border-border/30 my-4" />,
};

export default function ProjectDocView({ projects, deployments }) {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reportType, setReportType] = useState('technical');
  const [isGenerating, setIsGenerating] = useState(false);
  const [projectDoc, setProjectDoc] = useState(null);

  const { data: analyses = [] } = useQuery({
    queryKey: ['analyses-docs', selectedProjectId],
    queryFn: () => base44.entities.Analysis.filter({ project_id: selectedProjectId, status: 'completed' }, '-created_date', 30),
    enabled: !!selectedProjectId,
  });

  const project = projects.find(p => p.id === selectedProjectId);
  const projectDeployments = deployments.filter(d => d.project_id === selectedProjectId);
  const qualityScore = project ? estimateQuality(project) : null;

  const numCols = (project?.column_info || []).filter(c => ['numeric', 'integer', 'float', 'int', 'number'].includes((c.type || '').toLowerCase()));
  const catCols = (project?.column_info || []).filter(c => ['categorical', 'string', 'object', 'text'].includes((c.type || '').toLowerCase()));
  const nullCols = (project?.column_info || []).filter(c => (c.null_percent || 0) > 20);

  const generateDoc = async () => {
    if (!project) return toast.error('Selecione um projeto');
    setIsGenerating(true);
    setProjectDoc(null);
    await new Promise(r => setTimeout(r, 600));
    const res = buildLocalReport(reportType, project, analyses);
    setProjectDoc(res);
    setIsGenerating(false);
    toast.success('Documentação gerada com sucesso!');
  };

  const copyDoc = () => { navigator.clipboard.writeText(projectDoc || ''); toast.success('Markdown copiado para a área de transferência!'); };

  const downloadMd = () => {
    const blob = new Blob([projectDoc], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${project?.name?.replace(/\s+/g, '_') || 'projeto'}_${reportType}.md`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Arquivo .md baixado!');
  };

  const downloadTxt = () => {
    const blob = new Blob([projectDoc], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${project?.name?.replace(/\s+/g, '_') || 'projeto'}_${reportType}.txt`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Arquivo .txt baixado!');
  };

  const downloadHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project?.name} — Documentação ML</title>
  <style>
    body { font-family: Georgia, serif; max-width: 860px; margin: 40px auto; padding: 0 24px; color: #1a1a2e; line-height: 1.7; font-size: 13pt; }
    h1 { font-size: 22pt; color: #0f3460; border-bottom: 3px solid #0f3460; padding-bottom: 0.3em; }
    h2 { font-size: 15pt; color: #16213e; border-left: 4px solid #0f3460; padding-left: 0.6em; }
    h3 { font-size: 12pt; color: #16213e; }
    code { font-family: 'Courier New', monospace; background: #f0f4ff; padding: 1px 4px; border-radius: 3px; font-size: 10pt; color: #1a237e; }
    pre { font-family: 'Courier New', monospace; background: #f8f9ff; border-left: 4px solid #3f51b5; padding: 12px; white-space: pre-wrap; font-size: 10pt; }
    table { width: 100%; border-collapse: collapse; margin: 1em 0; }
    th { background: #0f3460; color: white; padding: 8px 10px; text-align: left; }
    td { padding: 7px 10px; border-bottom: 1px solid #e0e0e0; }
    tr:nth-child(even) { background: #f5f7ff; }
    blockquote { border-left: 4px solid #90caf9; padding: 0.5em 1em; background: #f0f7ff; color: #555; }
    .footer { margin-top: 3em; border-top: 1px solid #ccc; padding-top: 1em; font-size: 10pt; color: #888; }
  </style>
</head>
<body>
${projectDoc
  .replace(/^######\s(.+)$/gm, '<h6>$1</h6>').replace(/^#####\s(.+)$/gm, '<h5>$1</h5>')
  .replace(/^####\s(.+)$/gm, '<h4>$1</h4>').replace(/^###\s(.+)$/gm, '<h3>$1</h3>')
  .replace(/^##\s(.+)$/gm, '<h2>$1</h2>').replace(/^#\s(.+)$/gm, '<h1>$1</h1>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/`([^`]+)`/g, '<code>$1</code>').replace(/```[\w]*\n([\s\S]*?)```/g, '<pre>$1</pre>')
  .replace(/^>\s(.+)$/gm, '<blockquote>$1</blockquote>')
  .replace(/^-\s(.+)$/gm, '<li>$1</li>').replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
  .replace(/\n\n/g, '</p><p>')
}
<div class="footer">Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })} · ML Studio</div>
</body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${project?.name?.replace(/\s+/g, '_') || 'projeto'}_${reportType}.html`;
    a.click(); URL.revokeObjectURL(url);
    toast.success('Arquivo HTML baixado! Abra no navegador para imprimir como PDF.');
  };

  const downloadPDF = () => {
    if (!projectDoc || !project) return;
    toast('Abrindo janela de impressão — use "Salvar como PDF" no diálogo...');
    exportDocToPDF(projectDoc, project.name);
  };

  const shareClipboard = () => {
    const shareText = `# ${project?.name} — Documentação ML\nGerado em ${new Date().toLocaleDateString('pt-BR')}\n\n${projectDoc}`;
    navigator.clipboard.writeText(shareText);
    toast.success('Texto completo copiado! Pronto para colar em e-mail ou documento.');
  };

  return (
    <div className="space-y-5">
      {/* Config card */}
      <GlowCard>
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-primary" /> Gerar Documentação Automática
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Documentação 100% local, sem IA externa. Gerada a partir dos metadados reais do projeto — dataset, análises, pipeline e deploys.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Projeto</label>
            <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setProjectDoc(null); }}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
              <SelectContent>
                {projects.filter(p => p.dataset_file_url || p.dataset_filename).map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo de Relatório</label>
            <Select value={reportType} onValueChange={v => { setReportType(v); setProjectDoc(null); }}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[9px] text-muted-foreground mt-1">
              {REPORT_TYPES.find(t => t.id === reportType)?.desc}
            </p>
          </div>
        </div>

        {/* Project preview */}
        {project && (
          <div className="mb-4 p-3 rounded-xl border border-border/20 bg-secondary/10 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Brain className="w-3.5 h-3.5 text-primary" />
                <p className="text-xs font-semibold text-foreground">{project.name}</p>
              </div>
              {qualityScore !== null && <QualityBadge score={qualityScore} />}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { label: 'Linhas', value: project.dataset_size?.toLocaleString('pt-BR') || '—', icon: Layers, color: 'text-primary' },
                { label: 'Colunas', value: project.dataset_columns || '—', icon: Database, color: 'text-accent' },
                { label: 'Análises', value: analyses.length, icon: BarChart3, color: 'text-emerald-400' },
                { label: 'Deploys', value: projectDeployments.length, icon: Zap, color: 'text-amber-400' },
              ].map((s, i) => (
                <div key={i} className="p-2 rounded-lg bg-secondary/30 border border-border/15 text-center">
                  <s.icon className={cn('w-3.5 h-3.5 mx-auto mb-0.5', s.color)} />
                  <p className={cn('text-sm font-bold font-mono', s.color)}>{s.value}</p>
                  <p className="text-[9px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Insights rápidos */}
            <div className="flex flex-wrap gap-2">
              {numCols.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-primary/10 border border-primary/20 text-primary">
                  {numCols.length} vars numéricas
                </span>
              )}
              {catCols.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-accent/10 border border-accent/20 text-accent">
                  {catCols.length} vars categóricas
                </span>
              )}
              {nullCols.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-amber-400/10 border border-amber-400/20 text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-2.5 h-2.5" /> {nullCols.length} cols com nulos
                </span>
              )}
              {(project.prep_steps || []).length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[9px] bg-emerald-400/10 border border-emerald-400/20 text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-2.5 h-2.5" /> {project.prep_steps.length} etapas de prep
                </span>
              )}
            </div>
          </div>
        )}

        <Button onClick={generateDoc} disabled={isGenerating || !selectedProjectId} className="bg-primary text-primary-foreground hover:bg-primary/90 w-full sm:w-auto">
          {isGenerating
            ? <><Clock className="w-4 h-4 mr-2 animate-spin" /> Gerando...</>
            : <><BookOpen className="w-4 h-4 mr-2" /> Gerar Documentação</>}
        </Button>

        {isGenerating && (
          <div className="mt-3 p-2.5 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-xs text-primary">⚡ Processando metadados localmente — sem chamadas externas...</p>
          </div>
        )}
      </GlowCard>

      {/* Result */}
      {projectDoc && (
        <GlowCard>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h3 className="font-semibold text-foreground text-sm">
                {REPORT_TYPES.find(t => t.id === reportType)?.label} — {project?.name}
              </h3>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Gerado localmente • {new Date().toLocaleDateString('pt-BR')} • {(projectDoc.split(' ').length).toLocaleString()} palavras
              </p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={copyDoc}>
                <Copy className="w-3 h-3 mr-1" /> Copiar
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-border/40" onClick={downloadMd}>
                <Download className="w-3 h-3 mr-1" /> .md
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-border/40" onClick={downloadTxt}>
                <Download className="w-3 h-3 mr-1" /> .txt
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-accent/30 text-accent hover:bg-accent/10" onClick={downloadHTML}>
                <Download className="w-3 h-3 mr-1" /> .html
              </Button>
              <Button size="sm" className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90" onClick={downloadPDF}>
                <FileDown className="w-3 h-3 mr-1" /> PDF
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-400/30 text-emerald-400 hover:bg-emerald-400/10" onClick={shareClipboard}>
                <Share2 className="w-3 h-3 mr-1" /> Compartilhar
              </Button>
            </div>
          </div>

          <div className="border border-border/30 rounded-lg p-5 bg-secondary/10 max-h-[70vh] overflow-y-auto scrollbar-thin">
            <ReactMarkdown components={mdComponents}>{projectDoc}</ReactMarkdown>
          </div>
        </GlowCard>
      )}

      {!projectDoc && !isGenerating && !selectedProjectId && (
        <EmptyState
          icon={BookOpen}
          title="Selecione um projeto"
          description="Documentação 100% automática: técnica completa, resumo executivo, análise exploratória ou perfil do dataset. Exportável em PDF e Markdown."
        />
      )}
    </div>
  );
}