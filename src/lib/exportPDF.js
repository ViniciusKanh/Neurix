import jsPDF from 'jspdf';

/**
 * Exports the current report and project data to a styled PDF document.
 * @param {object} project - The project object
 * @param {Array} analyses - Array of analyses
 * @param {string} reportMarkdown - The markdown report text
 * @param {string} reportTypeLabel - Human-readable report type
 */
export async function exportReportToPDF({ project, analyses, reportMarkdown, reportTypeLabel }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;

  let y = margin;

  // ---- Helpers ----
  const checkPageBreak = (needed = 10) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  const drawSectionHeader = (text) => {
    checkPageBreak(14);
    doc.setFillColor(10, 180, 220);
    doc.rect(margin, y, 3, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 200, 230);
    doc.text(text, margin + 6, y + 5.5);
    y += 12;
  };

  const drawBodyText = (text, size = 9, color = [180, 200, 220]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, contentW);
    lines.forEach(line => {
      checkPageBreak(6);
      doc.text(line, margin, y);
      y += 5.5;
    });
  };

  const drawKVRow = (key, value) => {
    checkPageBreak(7);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 180, 210);
    doc.text(`${key}:`, margin, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(180, 200, 220);
    const val = String(value ?? 'N/A');
    const lines = doc.splitTextToSize(val, contentW - 38);
    doc.text(lines[0], margin + 38, y);
    y += 6;
    for (let i = 1; i < lines.length; i++) {
      checkPageBreak(6);
      doc.text(lines[i], margin + 38, y);
      y += 5.5;
    }
  };

  // ---- Cover / Header ----
  doc.setFillColor(12, 18, 35);
  doc.rect(0, 0, pageW, pageH, 'F');

  // Top accent bar
  doc.setFillColor(10, 180, 220);
  doc.rect(0, 0, pageW, 2.5, 'F');

  // Logo text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(10, 180, 220);
  doc.text('ML MODEL STUDIO AI', margin, 14);

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(220, 240, 255);
  doc.text(reportTypeLabel, margin, 32);

  // Project name
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(100, 180, 210);
  doc.text(project.name, margin, 41);

  // Date
  doc.setFontSize(8);
  doc.setTextColor(80, 110, 140);
  doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`, margin, 49);

  // Divider
  doc.setDrawColor(30, 60, 90);
  doc.setLineWidth(0.4);
  doc.line(margin, 54, pageW - margin, 54);

  y = 62;

  // ---- Project Overview ----
  drawSectionHeader('Visão Geral do Projeto');
  drawKVRow('Nome', project.name);
  drawKVRow('Descrição', project.description || 'N/A');
  drawKVRow('Arquivo', project.dataset_filename || 'N/A');
  drawKVRow('Linhas', project.dataset_size?.toLocaleString('pt-BR') || 'N/A');
  drawKVRow('Colunas', project.dataset_columns || 'N/A');
  y += 3;

  // ---- Column Info ----
  if (project.column_info?.length) {
    drawSectionHeader('Informações das Colunas');

    const colHeaders = ['Coluna', 'Tipo', 'Únicos', '% Nulos'];
    const colWidths = [60, 35, 30, 30];
    const rowH = 7;

    // Header row
    checkPageBreak(rowH + 2);
    doc.setFillColor(20, 45, 70);
    doc.rect(margin, y, contentW, rowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(10, 180, 220);
    let cx = margin + 2;
    colHeaders.forEach((h, i) => { doc.text(h, cx, y + 5); cx += colWidths[i]; });
    y += rowH;

    project.column_info.forEach((col, idx) => {
      checkPageBreak(rowH);
      if (idx % 2 === 0) {
        doc.setFillColor(18, 30, 50);
        doc.rect(margin, y, contentW, rowH, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(160, 190, 215);
      const vals = [col.name, col.type || '—', col.unique_count ?? '—', col.null_percent != null ? `${col.null_percent.toFixed(1)}%` : '—'];
      let cx2 = margin + 2;
      vals.forEach((v, i) => {
        const truncated = String(v).length > 28 ? String(v).slice(0, 26) + '…' : String(v);
        doc.text(truncated, cx2, y + 5);
        cx2 += colWidths[i];
      });
      y += rowH;
    });
    y += 4;
  }

  // ---- AI Diagnosis ----
  if (project.ai_diagnosis) {
    drawSectionHeader('Diagnóstico da IA');
    // Strip markdown for plain text
    const plainDiag = project.ai_diagnosis
      .replace(/#{1,6}\s?/g, '')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .trim();
    drawBodyText(plainDiag);
    y += 3;
  }

  // ---- AI Suggestions ----
  if (project.ai_suggestions?.length) {
    drawSectionHeader('Sugestões de Tarefas ML');
    project.ai_suggestions.forEach((s, i) => {
      checkPageBreak(16);
      doc.setFillColor(18, 35, 55);
      doc.rect(margin, y, contentW, 12, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(10, 180, 220);
      doc.text(`${i + 1}. ${s.task}`, margin + 3, y + 5);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(140, 170, 200);
      const descLines = doc.splitTextToSize(s.description || '', contentW - 6);
      doc.text(descLines[0] || '', margin + 3, y + 10);
      // confidence badge
      doc.setFontSize(7);
      doc.setTextColor(s.confidence === 'high' ? 50 : s.confidence === 'medium' ? 200 : 150,
        s.confidence === 'high' ? 200 : s.confidence === 'medium' ? 170 : 150,
        s.confidence === 'high' ? 100 : 80);
      doc.text(`Confiança: ${s.confidence || 'N/A'}`, pageW - margin - 28, y + 5);
      y += 15;
    });
    y += 3;
  }

  // ---- Analyses ----
  if (analyses?.length) {
    drawSectionHeader('Análises Realizadas');
    analyses.forEach((a) => {
      checkPageBreak(20);
      // Analysis card
      doc.setDrawColor(30, 70, 110);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, y, contentW, 4, 1, 1, 'S');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(200, 230, 255);
      doc.text(`${a.name} (${a.type})`, margin + 3, y + 3);
      // status
      const statusColor = a.status === 'completed' ? [50, 200, 130] : a.status === 'failed' ? [230, 80, 80] : [200, 160, 50];
      doc.setTextColor(...statusColor);
      doc.setFontSize(7.5);
      doc.text(a.status?.toUpperCase() || '', pageW - margin - 22, y + 3);
      y += 7;

      // Metrics
      if (a.results?.metrics) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(10, 180, 220);
        doc.text('Métricas:', margin + 3, y);
        y += 5;
        Object.entries(a.results.metrics).slice(0, 6).forEach(([k, v]) => {
          checkPageBreak(5);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(140, 170, 200);
          doc.text(`  ${k}: ${typeof v === 'number' ? v.toFixed(4) : v}`, margin + 3, y);
          y += 5;
        });
      }

      // AI Interpretation
      if (a.ai_interpretation) {
        checkPageBreak(8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(180, 100, 240);
        doc.text('Interpretação da IA:', margin + 3, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(160, 180, 210);
        const lines = doc.splitTextToSize(
          a.ai_interpretation.replace(/#{1,6}\s?/g, '').replace(/\*\*?(.+?)\*\*?/g, '$1').trim(),
          contentW - 6
        );
        lines.slice(0, 10).forEach(line => {
          checkPageBreak(5);
          doc.text(line, margin + 3, y);
          y += 5;
        });
      }

      // Recommendations
      if (a.ai_recommendations?.length) {
        checkPageBreak(8);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(10, 200, 150);
        doc.text('Recomendações:', margin + 3, y);
        y += 5;
        a.ai_recommendations.slice(0, 5).forEach((rec, ri) => {
          checkPageBreak(5);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(140, 180, 200);
          const lines = doc.splitTextToSize(`${ri + 1}. ${rec}`, contentW - 8);
          lines.forEach(l => {
            checkPageBreak(5);
            doc.text(l, margin + 3, y);
            y += 5;
          });
        });
      }

      y += 5;
    });
  }

  // ---- Main Report Content ----
  if (reportMarkdown) {
    drawSectionHeader('Relatório Completo');
    const plain = reportMarkdown
      .replace(/#{1,6}\s(.+)/g, (_, t) => `\n${t.toUpperCase()}\n`)
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/`(.+?)`/g, '$1')
      .replace(/\|.+\|/g, '') // remove tables
      .replace(/---+/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    const paragraphs = plain.split('\n\n');
    paragraphs.forEach(para => {
      if (!para.trim()) return;
      const isTitle = para.length < 60 && para === para.toUpperCase();
      if (isTitle) {
        checkPageBreak(10);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(10, 180, 220);
        doc.text(para.trim(), margin, y);
        y += 7;
      } else {
        drawBodyText(para.trim());
        y += 2;
      }
    });
  }

  // ---- Footer on all pages ----
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFillColor(12, 18, 35);
    doc.rect(0, pageH - 10, pageW, 10, 'F');
    doc.setDrawColor(30, 60, 90);
    doc.setLineWidth(0.3);
    doc.line(margin, pageH - 10, pageW - margin, pageH - 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(60, 90, 120);
    doc.text('ML Model Studio AI — Relatório Gerado Automaticamente', margin, pageH - 4);
    doc.text(`${i} / ${totalPages}`, pageW - margin - 8, pageH - 4);
  }

  const safeName = (project.name || 'relatorio').replace(/[^a-z0-9]/gi, '_').toLowerCase();
  doc.save(`${safeName}_${reportTypeLabel.replace(/\s/g, '_').toLowerCase()}.pdf`);
}