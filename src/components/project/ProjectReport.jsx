import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import GlowCard from '@/components/ui/GlowCard';
import { FileText, Download, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function buildMarkdown(project, analyses) {
  const date = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  let md = `# Relatório de Análise — ${project.name}\n`;
  md += `**Gerado em:** ${date}\n\n---\n\n`;

  // Dataset info
  md += `## 📁 Dataset\n`;
  md += `- **Arquivo:** ${project.dataset_filename || '—'}\n`;
  md += `- **Linhas:** ${project.dataset_size?.toLocaleString('pt-BR') || '—'}\n`;
  md += `- **Colunas:** ${project.dataset_columns || '—'}\n`;
  if (project.description) md += `- **Descrição:** ${project.description}\n`;
  md += '\n';

  // Column structure
  if (project.column_info?.length > 0) {
    md += `## 🗂️ Estrutura das Colunas\n\n`;
    md += `| Coluna | Tipo | Únicos | Nulos (%) | Exemplos |\n`;
    md += `|--------|------|--------|-----------|----------|\n`;
    for (const col of project.column_info) {
      const samples = (col.sample_values || []).slice(0, 3).join(', ');
      md += `| ${col.name} | ${col.type || '—'} | ${col.unique_count ?? '—'} | ${col.null_percent ?? 0}% | ${samples} |\n`;
    }
    md += '\n';
  }

  // Stats summary
  if (project.column_info?.length > 0) {
    const numCols = project.column_info.filter(c =>
      ['number', 'numeric', 'float', 'int', 'integer', 'float64', 'int64'].includes((c.type || '').toLowerCase())
    );
    const catCols = project.column_info.filter(c =>
      ['string', 'object', 'category', 'text', 'varchar'].includes((c.type || '').toLowerCase())
    );
    const avgNulls = project.column_info.reduce((s, c) => s + (c.null_percent || 0), 0) / project.column_info.length;

    md += `## 📊 Resumo Estatístico\n\n`;
    md += `- **Colunas numéricas:** ${numCols.length}\n`;
    md += `- **Colunas categóricas:** ${catCols.length}\n`;
    md += `- **Outros tipos:** ${project.column_info.length - numCols.length - catCols.length}\n`;
    md += `- **Taxa média de nulos:** ${avgNulls.toFixed(1)}%\n\n`;
  }

  // Prep steps
  if (project.prep_steps?.length > 0) {
    md += `## 🔧 Pré-processamento Aplicado\n\n`;
    project.prep_steps.forEach((step, i) => {
      md += `**${i + 1}. ${step.label}**\n`;
      if (step.summary) md += `> ${step.summary}\n`;
      md += `- Linhas afetadas: ${step.affected_rows?.toLocaleString('pt-BR') || '—'}\n`;
      md += `- Colunas: ${step.affected_columns?.join(', ') || '—'}\n\n`;
    });
  }

  // Computed data diagnosis (no AI) — deterministic template
  if (project.column_info?.length > 0) {
    const cols = project.column_info;
    const isCat = (c) => ['string', 'object', 'category', 'text', 'varchar', 'boolean', 'bool'].includes((c.type || '').toLowerCase());
    const numCols = cols.filter((c) => !isCat(c));
    const catCols = cols.filter(isCat);
    const highNull = cols.filter((c) => (c.null_percent || 0) > 20);
    const highCard = catCols.filter((c) => (c.unique_count || 0) > 50);
    const lowCardCat = catCols.filter((c) => (c.unique_count || 0) >= 2 && (c.unique_count || 0) <= 20);

    md += `## 🔎 Diagnóstico dos Dados (calculado)\n\n`;
    md += `- Qualidade geral: ${highNull.length === 0 ? '**boa** (poucos nulos)' : `**atenção** — ${highNull.length} coluna(s) com >20% de nulos`}\n`;
    if (highNull.length > 0) md += `- Colunas com muitos nulos: ${highNull.map((c) => `\`${c.name}\``).join(', ')}\n`;
    if (highCard.length > 0) md += `- Alta cardinalidade (>50 valores): ${highCard.map((c) => `\`${c.name}\``).join(', ')} — considere agrupar categorias\n`;

    md += `\n### 🎯 Tarefas de ML recomendadas (heurística)\n`;
    if (lowCardCat.length > 0) md += `- **Classificação**: alvos candidatos → ${lowCardCat.slice(0, 3).map((c) => `\`${c.name}\``).join(', ')}\n`;
    if (numCols.length > 0) md += `- **Regressão**: alvos numéricos → ${numCols.slice(0, 3).map((c) => `\`${c.name}\``).join(', ')}\n`;
    if (catCols.length >= 2) md += `- **Regras de associação**: ${catCols.length} colunas categóricas disponíveis\n`;
    if (numCols.length >= 3) md += `- **Agrupamento (clustering)**: ${numCols.length} colunas numéricas para segmentação\n`;
    md += '\n';
  }

  // Analyses
  if (analyses?.length > 0) {
    const completed = analyses.filter(a => a.status === 'completed');
    if (completed.length > 0) {
      md += `## 🧪 Análises Realizadas\n\n`;
      for (const a of completed) {
        md += `### ${a.name}\n`;
        if (a.results?.metrics) {
          md += `**Métricas:**\n`;
          for (const [k, v] of Object.entries(a.results.metrics)) {
            md += `- ${k.replace(/_/g, ' ')}: ${typeof v === 'number' ? v.toFixed(4) : v}\n`;
          }
        }
        if (a.config?.target_column) md += `**Coluna-alvo:** ${a.config.target_column}\n`;
        if (a.created_date) md += `**Data:** ${format(new Date(a.created_date), "dd/MM/yyyy HH:mm", { locale: ptBR })}\n`;
        if (a.results?.method) md += `**Método de seleção:** ${a.results.method.category_label} — ${a.results.method.filter_name}\n`;
        if (a.ai_interpretation) md += `\n**Interpretação:**\n${a.ai_interpretation}\n`;
        md += '\n';
      }
    }
  }

  return md;
}

export default function ProjectReport({ project, analyses }) {
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadMarkdown = () => {
    const md = buildMarkdown(project, analyses);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio_${project.name.replace(/\s+/g, '_')}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Relatório Markdown baixado!');
  };

  const downloadPDF = async () => {
    setIsGenerating(true);
    try {
      const md = buildMarkdown(project, analyses);
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const pageW = doc.internal.pageSize.getWidth();
      const margin = 15;
      const maxW = pageW - margin * 2;
      let y = 20;

      const addPage = () => { doc.addPage(); y = 20; };
      const checkY = (needed = 10) => { if (y + needed > 280) addPage(); };

      const lines = md.split('\n');
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) { y += 3; continue; }

        if (line.startsWith('# ')) {
          checkY(12);
          doc.setFontSize(16); doc.setTextColor(30, 184, 196); doc.setFont(undefined, 'bold');
          doc.text(line.replace('# ', ''), margin, y); y += 9;
        } else if (line.startsWith('## ')) {
          checkY(10);
          doc.setFontSize(13); doc.setTextColor(50, 150, 180); doc.setFont(undefined, 'bold');
          doc.text(line.replace('## ', ''), margin, y); y += 7;
        } else if (line.startsWith('### ')) {
          checkY(8);
          doc.setFontSize(11); doc.setTextColor(80, 180, 120); doc.setFont(undefined, 'bold');
          doc.text(line.replace('### ', ''), margin, y); y += 6;
        } else if (line.startsWith('**') && line.endsWith('**')) {
          checkY(6);
          doc.setFontSize(9); doc.setTextColor(200, 200, 200); doc.setFont(undefined, 'bold');
          const clean = line.replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(clean, maxW);
          doc.text(wrapped, margin, y); y += wrapped.length * 5;
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          checkY(5);
          doc.setFontSize(8.5); doc.setTextColor(170, 170, 170); doc.setFont(undefined, 'normal');
          const clean = line.replace(/^[-*] /, '• ').replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(clean, maxW - 4);
          doc.text(wrapped, margin + 2, y); y += wrapped.length * 4.5;
        } else if (line.startsWith('> ')) {
          checkY(5);
          doc.setFontSize(8); doc.setTextColor(140, 140, 160); doc.setFont(undefined, 'italic');
          const clean = line.replace(/^> /, '').replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(clean, maxW - 6);
          doc.text(wrapped, margin + 4, y); y += wrapped.length * 4.5;
        } else if (line.startsWith('---')) {
          checkY(4);
          doc.setDrawColor(60, 60, 80);
          doc.line(margin, y, pageW - margin, y); y += 4;
        } else if (line.startsWith('|')) {
          // skip table lines in PDF (complex), just skip
        } else {
          checkY(5);
          doc.setFontSize(9); doc.setTextColor(200, 200, 200); doc.setFont(undefined, 'normal');
          const clean = line.replace(/\*\*/g, '');
          const wrapped = doc.splitTextToSize(clean, maxW);
          doc.text(wrapped, margin, y); y += wrapped.length * 5;
        }
      }

      doc.save(`relatorio_${project.name.replace(/\s+/g, '_')}.pdf`);
      toast.success('PDF baixado com sucesso!');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyMarkdown = () => {
    navigator.clipboard.writeText(buildMarkdown(project, analyses));
    toast.success('Copiado para a área de transferência!');
  };

  return (
    <GlowCard>
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground">Relatório do Projeto</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Gere um relatório completo com diagnóstico calculado dos dados, estrutura de colunas, resumo estatístico, pipeline e resultados das análises.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          onClick={downloadPDF}
          disabled={isGenerating}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isGenerating
            ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" /> Gerando PDF...</>
            : <><Download className="w-3 h-3 mr-1.5" /> Baixar PDF</>
          }
        </Button>
        <Button onClick={downloadMarkdown} size="sm" variant="outline">
          <Download className="w-3 h-3 mr-1.5" /> Baixar Markdown
        </Button>
        <Button onClick={copyMarkdown} size="sm" variant="ghost">
          <Copy className="w-3 h-3 mr-1.5" /> Copiar Markdown
        </Button>
      </div>
    </GlowCard>
  );
}