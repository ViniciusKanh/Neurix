import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import GlowCard from '@/components/ui/GlowCard';
import { FileText, Download, Loader2, Sparkles, Copy, CheckCircle2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const REPORT_TYPES = [
  { value: 'technical', label: 'Relatório Técnico Completo', desc: 'Metodologia, métricas e análise detalhada' },
  { value: 'executive', label: 'Resumo Executivo', desc: 'Insights principais e recomendações de negócio' },
  { value: 'eda', label: 'Relatório de EDA', desc: 'Análise exploratória detalhada do dataset' },
  { value: 'dataset', label: 'Perfil do Dataset', desc: 'Qualidade, estrutura e estatísticas do dado' },
];

const PROMPT_MAP = {
  technical: `Crie um RELATÓRIO TÉCNICO COMPLETO em Markdown profissional. Inclua todas as seções abaixo com conteúdo denso, específico e técnico:

# [Nome do Projeto] — Relatório Técnico

## Resumo Executivo
## 1. Descrição do Dataset
### 1.1 Estrutura e Dimensões
### 1.2 Tipos de Variáveis
### 1.3 Qualidade dos Dados
## 2. Análise Exploratória (EDA)
### 2.1 Estatísticas Descritivas
### 2.2 Distribuições
### 2.3 Correlações e Multicolinearidade
### 2.4 Outliers e Valores Ausentes
## 3. Preparação dos Dados
### 3.1 Etapas de Pré-processamento Aplicadas
### 3.2 Feature Engineering
## 4. Análise de Machine Learning
### 4.1 Modelos Avaliados
### 4.2 Métricas de Desempenho
### 4.3 Modelo Recomendado
### 4.4 Interpretabilidade
## 5. Insights Principais
## 6. Limitações e Riscos
## 7. Recomendações
## 8. Conclusão e Próximos Passos`,

  executive: `Crie um RESUMO EXECUTIVO em Markdown, focado em negócio, conciso e impactante:

# [Nome do Projeto] — Resumo Executivo

## O Problema e o Contexto
## Principais Descobertas
(use bullets com emojis para destacar)
## Oportunidades Identificadas
## Riscos e Considerações
## Ações Recomendadas (Prioridade Alta)
## Ações Recomendadas (Prioridade Média)
## ROI Esperado e Impacto Potencial
## Conclusão`,

  eda: `Crie um RELATÓRIO DE ANÁLISE EXPLORATÓRIA (EDA) completo em Markdown:

# [Nome do Projeto] — Análise Exploratória de Dados

## 1. Visão Geral do Dataset
## 2. Análise Estrutural
### 2.1 Dimensões e Tipos
### 2.2 Variáveis Numéricas (estatísticas descritivas com média, mediana, desvio, skewness, kurtosis)
### 2.3 Variáveis Categóricas (cardinalidade, moda, frequências)
### 2.4 Variáveis Temporais (se houver)
## 3. Qualidade dos Dados
### 3.1 Missing Values (padrão, impacto, recomendação)
### 3.2 Duplicatas
### 3.3 Outliers
### 3.4 Inconsistências
## 4. Análise de Distribuições
## 5. Análise de Correlações
## 6. Padrões e Tendências
## 7. Variáveis Mais Importantes
## 8. Recomendações para Modelagem`,

  dataset: `Crie um PERFIL DO DATASET em Markdown detalhado:

# [Nome do Projeto] — Perfil do Dataset

## Metadados
## Resumo de Qualidade (com score geral)
## Análise por Coluna (tabela detalhada)
## Missing Values (análise completa)
## Duplicatas e Inconsistências
## Distribuições (principais variáveis)
## Correlações Relevantes
## Score Final de Qualidade
## Recomendações de Tratamento`,
};

function buildPrompt(reportType, project, analyses) {
  const template = PROMPT_MAP[reportType] || PROMPT_MAP.technical;
  const prepStepsText = (project.prep_steps || []).map((s, i) => `${i+1}. ${s.label}: ${s.summary}`).join('\n') || 'Nenhuma etapa aplicada';
  const analysesText = analyses.slice(0, 5).map(a => `- ${a.name} (${a.type}): ${a.status === 'completed' ? `Métricas: ${JSON.stringify(a.results?.metrics || {})}` : a.status}`).join('\n');

  return `${template}

---
DADOS DO PROJETO:
Projeto: ${project.name}
Descrição: ${project.description || 'N/A'}
Dataset: ${project.dataset_filename || 'N/A'}
Linhas: ${project.dataset_size?.toLocaleString('pt-BR') || 'N/A'} | Colunas: ${project.dataset_columns || 'N/A'}

COLUNAS (detalhes):
${JSON.stringify((project.column_info || []).slice(0, 25), null, 2)}

DIAGNÓSTICO IA:
${project.ai_diagnosis || 'N/A'}

SUGESTÕES IA:
${JSON.stringify(project.ai_suggestions || [], null, 2)}

PRÉ-PROCESSAMENTO APLICADO:
${prepStepsText}

ANÁLISES REALIZADAS:
${analysesText || 'Nenhuma análise realizada ainda'}

---
INSTRUÇÕES:
- Escreva TUDO em português do Brasil
- Use dados reais fornecidos acima para embasar cada seção
- Não seja genérico — seja específico ao projeto
- Use tabelas Markdown bem formatadas onde apropriado
- Use destaques com **negrito** para métricas e insights importantes
- Use > blockquotes para observações críticas
- O relatório deve parecer profissional e ser útil para tomada de decisão
- Inclua pelo menos 800 palavras de conteúdo real`;
}

export default function Reports() {
  const urlParams = new URLSearchParams(window.location.search);
  const [selectedProjectId, setSelectedProjectId] = useState(urlParams.get('project') || '');
  const [reportType, setReportType] = useState('technical');
  const [report, setReport] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list('-updated_date', 50),
  });

  const { data: analyses = [] } = useQuery({
    queryKey: ['analyses', selectedProjectId],
    queryFn: () => base44.entities.Analysis.filter({ project_id: selectedProjectId }, '-created_date', 20),
    enabled: !!selectedProjectId,
  });

  const project = projects.find(p => p.id === selectedProjectId);

  const generateReport = async () => {
    if (!project) return toast.error('Selecione um projeto');
    setIsGenerating(true);
    setReport(null);
    await new Promise(r => setTimeout(r, 1000));
    // Local report generation — no external API
    const { buildLocalReport } = await import('@/lib/localReports');
    const response = buildLocalReport(reportType, project, analyses);
    setReport(response);
    setIsGenerating(false);
    toast.success('Relatório gerado!');
  };

  const copyReport = () => {
    if (report) {
      navigator.clipboard.writeText(report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('Copiado!');
    }
  };

  const downloadMarkdown = () => {
    if (!report || !project) return;
    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${project.name.replace(/\s+/g, '_')}_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Markdown baixado!');
  };

  const exportPDF = async () => {
    if (!report || !project) return;
    setIsExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = 0;
      let pageNum = 1;

      const addPage = () => {
        // Page number footer
        doc.setFontSize(8); doc.setTextColor(120, 120, 140);
        doc.text(`Página ${pageNum}  ·  ${project.name}  ·  ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`, pageW / 2, pageH - 8, { align: 'center' });
        doc.addPage();
        pageNum++;
        y = 25;
        // Header on new pages
        doc.setFillColor(13, 17, 27);
        doc.rect(0, 0, pageW, 15, 'F');
        doc.setFontSize(7); doc.setTextColor(0, 212, 255);
        doc.text(project.name.toUpperCase(), margin, 10);
        doc.setTextColor(120, 120, 140);
        doc.text(REPORT_TYPES.find(t => t.value === reportType)?.label || 'Relatório', pageW - margin, 10, { align: 'right' });
      };

      const checkY = (needed = 10) => { if (y + needed > pageH - 15) addPage(); };

      // Cover page
      doc.setFillColor(8, 14, 23);
      doc.rect(0, 0, pageW, pageH, 'F');

      // Accent bar
      doc.setFillColor(0, 212, 255);
      doc.rect(0, 0, 4, pageH, 'F');

      // Title area
      doc.setFontSize(9); doc.setTextColor(0, 212, 255);
      doc.text('ML MODEL STUDIO — ANÁLISE COM IA', margin + 6, 60);
      doc.setFontSize(26); doc.setTextColor(220, 230, 240); doc.setFont(undefined, 'bold');
      const titleLines = doc.splitTextToSize(project.name, contentW - 6);
      doc.text(titleLines, margin + 6, 80);

      doc.setFontSize(14); doc.setTextColor(155, 89, 255); doc.setFont(undefined, 'normal');
      doc.text(REPORT_TYPES.find(t => t.value === reportType)?.label || 'Relatório', margin + 6, 80 + titleLines.length * 12 + 8);

      // Meta
      const metaY = 130;
      doc.setFillColor(15, 22, 35);
      doc.roundedRect(margin + 6, metaY, contentW - 6, 50, 3, 3, 'F');
      doc.setFontSize(9); doc.setTextColor(120, 130, 150);
      const metas = [
        ['Dataset', project.dataset_filename || 'N/A'],
        ['Linhas', project.dataset_size?.toLocaleString('pt-BR') || 'N/A'],
        ['Colunas', String(project.dataset_columns || 'N/A')],
        ['Gerado em', format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })],
        ['Análises', String(analyses.length)],
      ];
      metas.forEach(([k, v], i) => {
        const x = margin + 10 + (i % 3) * ((contentW - 10) / 3);
        const my = metaY + 10 + Math.floor(i / 3) * 18;
        doc.setTextColor(0, 212, 255); doc.text(k + ':', x, my);
        doc.setTextColor(200, 210, 220); doc.text(v, x, my + 6);
      });

      // Separator
      doc.setDrawColor(0, 212, 255); doc.setLineWidth(0.3);
      doc.line(margin + 6, 195, pageW - margin, 195);
      doc.setFontSize(8); doc.setTextColor(80, 90, 110);
      doc.text('Gerado automaticamente por ML Model Studio com Inteligência Artificial', pageW / 2, 200, { align: 'center' });

      // Content pages
      doc.addPage();
      pageNum = 1;
      y = 25;

      // Header on first content page
      doc.setFillColor(13, 17, 27);
      doc.rect(0, 0, pageW, 15, 'F');
      doc.setFontSize(7); doc.setTextColor(0, 212, 255);
      doc.text(project.name.toUpperCase(), margin, 10);
      doc.setTextColor(120, 120, 140);
      doc.text(REPORT_TYPES.find(t => t.value === reportType)?.label || 'Relatório', pageW - margin, 10, { align: 'right' });

      // Parse and render markdown lines
      const lines = report.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const raw = lines[i];
        const line = raw.trim();
        if (!line) { y += 2.5; continue; }

        if (line.startsWith('# ')) {
          checkY(18);
          const text = line.replace(/^# /, '');
          // Section header with background
          doc.setFillColor(0, 40, 60);
          doc.rect(margin - 3, y - 6, contentW + 6, 12, 'F');
          doc.setFillColor(0, 212, 255);
          doc.rect(margin - 3, y - 6, 3, 12, 'F');
          doc.setFontSize(14); doc.setTextColor(0, 212, 255); doc.setFont(undefined, 'bold');
          const wrapped = doc.splitTextToSize(text, contentW - 5);
          doc.text(wrapped, margin + 2, y + 1);
          y += wrapped.length * 7 + 5;

        } else if (line.startsWith('## ')) {
          checkY(14);
          const text = line.replace(/^## /, '');
          doc.setDrawColor(0, 212, 255); doc.setLineWidth(0.4);
          doc.line(margin, y + 4, pageW - margin, y + 4);
          doc.setFontSize(11); doc.setTextColor(0, 180, 220); doc.setFont(undefined, 'bold');
          doc.text(text, margin, y);
          y += 10;

        } else if (line.startsWith('### ')) {
          checkY(10);
          doc.setFontSize(9.5); doc.setTextColor(155, 89, 255); doc.setFont(undefined, 'bold');
          const text = line.replace(/^### /, '');
          doc.text(text, margin, y);
          y += 7;

        } else if (line.startsWith('#### ')) {
          checkY(8);
          doc.setFontSize(9); doc.setTextColor(200, 210, 220); doc.setFont(undefined, 'bold');
          doc.text(line.replace(/^#### /, ''), margin, y);
          y += 6;

        } else if (line.startsWith('> ')) {
          checkY(7);
          const text = line.replace(/^> /, '').replace(/\*\*/g, '');
          doc.setFillColor(15, 25, 40);
          const wrapped = doc.splitTextToSize(text, contentW - 8);
          doc.rect(margin - 1, y - 4, contentW + 2, wrapped.length * 5 + 4, 'F');
          doc.setFillColor(155, 89, 255);
          doc.rect(margin - 1, y - 4, 2.5, wrapped.length * 5 + 4, 'F');
          doc.setFontSize(8.5); doc.setTextColor(180, 160, 220); doc.setFont(undefined, 'italic');
          doc.text(wrapped, margin + 4, y);
          y += wrapped.length * 5 + 4;

        } else if (line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\./)) {
          checkY(6);
          doc.setFontSize(8.5); doc.setTextColor(185, 195, 210); doc.setFont(undefined, 'normal');
          const isNum = line.match(/^\d+\./);
          const bullet = isNum ? line.match(/^\d+\./)[0] : '•';
          const text = line.replace(/^[-*] /, '').replace(/^\d+\. /, '').replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(text, contentW - 8);
          doc.setTextColor(0, 212, 255);
          doc.text(bullet, margin + 1, y);
          doc.setTextColor(185, 195, 210);
          doc.text(wrapped, margin + 6, y);
          y += wrapped.length * 5 + 1;

        } else if (line.startsWith('---') || line.startsWith('===')) {
          checkY(5);
          doc.setDrawColor(40, 55, 75); doc.setLineWidth(0.3);
          doc.line(margin, y, pageW - margin, y);
          y += 5;

        } else if (line.startsWith('|')) {
          // Table
          const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim());
          const isSep = cells.every(c => c.replace(/-/g, '').replace(/:/g, '').trim() === '');
          if (isSep) continue;
          checkY(7);
          const colW = Math.min((contentW) / cells.length, 45);
          const isHeader = lines[i + 1]?.trim().startsWith('|') && lines[i + 1]?.trim().includes('---');
          if (isHeader) {
            doc.setFillColor(20, 35, 55);
            doc.rect(margin, y - 4, contentW, 8, 'F');
            doc.setFontSize(7.5); doc.setTextColor(0, 212, 255); doc.setFont(undefined, 'bold');
          } else {
            doc.setFontSize(7.5); doc.setTextColor(170, 180, 195); doc.setFont(undefined, 'normal');
          }
          cells.forEach((cell, ci) => {
            const clean = cell.replace(/\*\*/g, '');
            doc.text(doc.splitTextToSize(clean, colW - 2)[0], margin + ci * colW + 1, y);
          });
          doc.setDrawColor(35, 50, 70); doc.setLineWidth(0.2);
          doc.line(margin, y + 2, pageW - margin, y + 2);
          y += 7;

        } else {
          checkY(6);
          // Detect inline bold
          const clean = line.replace(/\*\*/g, '');
          const hasBold = line.includes('**');
          doc.setFontSize(8.5); doc.setFont(undefined, hasBold ? 'bold' : 'normal');
          doc.setTextColor(185, 195, 210);
          const wrapped = doc.splitTextToSize(clean, contentW);
          doc.text(wrapped, margin, y);
          y += wrapped.length * 5.5;
        }
      }

      // Last page footer
      doc.setFontSize(8); doc.setTextColor(120, 120, 140);
      doc.text(`Página ${pageNum}  ·  ${project.name}  ·  ${format(new Date(), 'dd/MM/yyyy', { locale: ptBR })}`, pageW / 2, pageH - 8, { align: 'center' });

      doc.save(`relatorio_${project.name.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success('PDF exportado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsExporting(false);
    }
  };

  const reportTypeInfo = REPORT_TYPES.find(t => t.value === reportType);

  return (
    <div>
      <PageHeader title="Relatórios" subtitle="Documentação e relatórios profissionais gerados com IA" />

      <GlowCard className="mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Projeto</label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione um projeto" /></SelectTrigger>
              <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo de Relatório</label>
            <Select value={reportType} onValueChange={setReportType}>
              <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                {REPORT_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <div><p className="text-xs">{t.label}</p><p className="text-[10px] text-muted-foreground">{t.desc}</p></div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-end">
            <Button onClick={generateReport} disabled={isGenerating || !selectedProjectId} className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary">
              {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...</> : <><Sparkles className="w-4 h-4 mr-2" /> Gerar Relatório</>}
            </Button>
          </div>
        </div>
        {reportTypeInfo && (
          <p className="text-[10px] text-muted-foreground mt-2">
            <span className="font-medium text-foreground">{reportTypeInfo.label}:</span> {reportTypeInfo.desc}.
            {reportType === 'technical' && ' Gera relatório técnico completo localmente.'}
          </p>
        )}
      </GlowCard>

      {report ? (
        <GlowCard>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">{reportTypeInfo?.label}</h3>
              {project && <span className="text-xs text-muted-foreground">— {project.name}</span>}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="ghost" size="sm" onClick={copyReport} className="h-7 text-xs">
                {copied ? <><CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" /> Copiado</> : <><Copy className="w-3.5 h-3.5 mr-1" /> Copiar</>}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadMarkdown} className="h-7 text-xs border-primary/30 text-primary hover:bg-primary/10">
                <Download className="w-3.5 h-3.5 mr-1" /> Markdown
              </Button>
              <Button size="sm" onClick={exportPDF} disabled={isExporting} className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                {isExporting ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> PDF...</> : <><Download className="w-3.5 h-3.5 mr-1" /> Exportar PDF</>}
              </Button>
            </div>
          </div>

          <div className="border-t border-border/30 pt-5">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{children}</p>,
                h1: ({ children }) => <h1 className="text-2xl font-bold text-foreground mb-4 mt-7 pb-2 border-b border-primary/20">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold text-foreground mb-3 mt-6 pb-1 border-b border-border/40">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold text-accent mb-2 mt-4">{children}</h3>,
                h4: ({ children }) => <h4 className="text-sm font-semibold text-foreground mb-2 mt-3">{children}</h4>,
                ul: ({ children }) => <ul className="list-disc ml-5 space-y-1.5 mb-4">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal ml-5 space-y-1.5 mb-4">{children}</ol>,
                li: ({ children }) => <li className="text-sm text-muted-foreground leading-relaxed">{children}</li>,
                strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                em: ({ children }) => <em className="text-muted-foreground italic">{children}</em>,
                code: ({ inline, children }) => inline
                  ? <code className="text-primary font-mono text-xs bg-primary/10 px-1 py-0.5 rounded">{children}</code>
                  : <pre className="bg-secondary/50 rounded-lg p-4 overflow-x-auto mb-3"><code className="text-xs font-mono text-foreground">{children}</code></pre>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-3 border-accent/50 bg-accent/5 pl-4 pr-3 py-2 my-4 rounded-r-lg">
                    {children}
                  </blockquote>
                ),
                hr: () => <hr className="border-border/40 my-5" />,
                table: ({ children }) => (
                  <div className="overflow-x-auto mb-5 rounded-lg border border-border/40">
                    <table className="w-full text-xs">{children}</table>
                  </div>
                ),
                thead: ({ children }) => <thead className="bg-secondary/60">{children}</thead>,
                th: ({ children }) => <th className="text-left p-3 text-foreground font-semibold border-b border-border/40 whitespace-nowrap">{children}</th>,
                td: ({ children }) => <td className="p-3 border-b border-border/20 text-muted-foreground">{children}</td>,
                tr: ({ children }) => <tr className="hover:bg-secondary/30 transition-colors">{children}</tr>,
              }}
            >
              {report}
            </ReactMarkdown>
          </div>
        </GlowCard>
      ) : (
        <EmptyState icon={FileText} title="Nenhum relatório gerado" description="Selecione um projeto, escolha o tipo de relatório e clique em Gerar" />
      )}
    </div>
  );
}