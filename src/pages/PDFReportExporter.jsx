import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PageHeader from '@/components/ui/PageHeader';
import GlowCard from '@/components/ui/GlowCard';
import EmptyState from '@/components/ui/EmptyState';
import { FileDown, Loader2, CheckSquare, Square, Brain, BarChart3, AlertCircle, TrendingUp, FileText, Cpu } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { jsPDF } from 'jspdf';

const REPORT_TYPES = [
  { value: 'eda', label: '📊 Relatório EDA', description: 'Análise exploratória completa com distribuições, correlações e insights da IA' },
  { value: 'drift', label: '📡 Relatório de Drift', description: 'Monitoramento de drift de dados com timeline e alertas' },
  { value: 'model', label: '🤖 Relatório de Modelagem', description: 'Comparação de modelos, métricas e avaliação completa' },
  { value: 'full', label: '📋 Relatório Completo', description: 'EDA + Modelagem + Deploy + Drift em um único documento' },
];

const EDA_SECTIONS = [
  { id: 'overview', label: 'Visão Geral do Dataset', default: true },
  { id: 'quality', label: 'Qualidade dos Dados', default: true },
  { id: 'distributions', label: 'Distribuições de Variáveis', default: true },
  { id: 'correlations', label: 'Matriz de Correlação', default: true },
  { id: 'outliers', label: 'Análise de Outliers', default: true },
  { id: 'bivariate', label: 'Análise Bivariada', default: false },
  { id: 'ai_insights', label: 'Insights Gerados pela IA', default: true },
];

const DRIFT_SECTIONS = [
  { id: 'drift_summary', label: 'Sumário de Drift', default: true },
  { id: 'timeline', label: 'Timeline de Drift', default: true },
  { id: 'column_drift', label: 'Drift por Coluna', default: true },
  { id: 'performance', label: 'Impacto na Performance', default: true },
  { id: 'alerts', label: 'Alertas e Ações', default: true },
  { id: 'ai_analysis', label: 'Análise IA de Drift', default: true },
];

const MODEL_SECTIONS = [
  { id: 'models_list', label: 'Modelos Treinados', default: true },
  { id: 'metrics_table', label: 'Tabela de Métricas', default: true },
  { id: 'best_model', label: 'Modelo Selecionado', default: true },
  { id: 'feature_importance', label: 'Feature Importance', default: true },
  { id: 'interpretation', label: 'Interpretação da IA', default: true },
  { id: 'recommendations', label: 'Recomendações', default: true },
];

// ---- Light/professional PDF theme ----
const INK = [38, 50, 66], MUTED = [110, 120, 138], CYAN = [4, 116, 148], GREEN = [8, 145, 108];
const BARBG = [230, 245, 248], LINE = [214, 224, 232], ROWALT = [246, 249, 251];

function pdfText(doc, text, x, y, options = {}) {
  const { fontSize = 10, color = INK, bold = false, maxWidth = 180, lh = 1.45 } = options;
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  const lines = doc.splitTextToSize(String(text ?? ''), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * (fontSize * 0.3528 * lh + 0.8);
}

function pageChrome(doc, title, pageNum) {
  // white background
  doc.setFillColor(255, 255, 255);
  doc.rect(0, 0, 210, 297, 'F');
  // top hairline brand
  doc.setFillColor(...CYAN);
  doc.rect(0, 0, 210, 3, 'F');
  doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(...CYAN);
  doc.text('NEURIX', 15, 11);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(...MUTED);
  doc.text(title, 200, 11, { align: 'right' });
  // footer
  doc.setDrawColor(...LINE); doc.line(15, 285, 195, 285);
  doc.setFontSize(8); doc.setTextColor(...MUTED);
  doc.text('Gerado pelo Neurix · Machine Learning 100% local', 15, 290);
  doc.text(`Pág. ${pageNum}`, 195, 290, { align: 'right' });
  return 22;
}

function sectionTitle(doc, label, y) {
  doc.setFillColor(...BARBG);
  doc.roundedRect(15, y - 5, 180, 9, 1.5, 1.5, 'F');
  doc.setFillColor(...CYAN);
  doc.rect(15, y - 5, 2.2, 9, 'F');
  doc.setFontSize(11); doc.setFont('helvetica', 'bold'); doc.setTextColor(...CYAN);
  doc.text(label, 20, y + 1);
  return y + 11;
}

// Simple table renderer (headers + rows), returns new y.
function pdfTable(doc, headers, rows, y, pageNum, title, colW) {
  const x0 = 15;
  const widths = colW || headers.map(() => 180 / headers.length);
  const rowH = 7;
  const draw = (cells, yy, head) => {
    let x = x0;
    if (head) { doc.setFillColor(...CYAN); doc.rect(x0, yy - 5, 180, rowH, 'F'); }
    cells.forEach((c, i) => {
      doc.setFontSize(8.5);
      doc.setTextColor(...(head ? [255, 255, 255] : INK));
      doc.setFont('helvetica', head ? 'bold' : 'normal');
      const t = doc.splitTextToSize(String(c ?? ''), widths[i] - 3)[0] || '';
      doc.text(t, x + 2, yy);
      x += widths[i];
    });
  };
  draw(headers, y, true); y += rowH;
  rows.forEach((r, ri) => {
    if (y > 278) { pageNum.n++; y = pageChrome(doc, title, pageNum.n); draw(headers, y, true); y += rowH; }
    if (ri % 2 === 1) { doc.setFillColor(...ROWALT); doc.rect(x0, y - 5, 180, rowH, 'F'); }
    draw(r, y, false); y += rowH;
  });
  doc.setDrawColor(...LINE); doc.line(x0, y - 5, x0 + 180, y - 5);
  return y + 3;
}

export default function PDFReportExporter() {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [reportType, setReportType] = useState('eda');
  const [enabledSections, setEnabledSections] = useState(() => {
    const defaults = {};
    [...EDA_SECTIONS, ...DRIFT_SECTIONS, ...MODEL_SECTIONS].forEach(s => { defaults[s.id] = s.default; });
    return defaults;
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiContent, setAiContent] = useState(null);

  const { data: projects = [] } = useQuery({ queryKey: ['projects'], queryFn: () => base44.entities.Project.list('-updated_date', 50) });
  const { data: analyses = [] } = useQuery({
    queryKey: ['analyses', selectedProjectId],
    queryFn: () => base44.entities.Analysis.filter({ project_id: selectedProjectId, status: 'completed' }, '-created_date', 20),
    enabled: !!selectedProjectId,
  });
  const { data: deployments = [] } = useQuery({ queryKey: ['deployments'], queryFn: () => base44.entities.ModelDeployment.list('-created_date', 50) });

  const project = projects.find(p => p.id === selectedProjectId);
  const projectDeployments = deployments.filter(d => d.project_id === selectedProjectId);

  const activeSections = reportType === 'eda' ? EDA_SECTIONS : reportType === 'drift' ? DRIFT_SECTIONS : reportType === 'model' ? MODEL_SECTIONS : [...EDA_SECTIONS, ...MODEL_SECTIONS, ...DRIFT_SECTIONS];

  const toggleSection = (id) => setEnabledSections(prev => ({ ...prev, [id]: !prev[id] }));
  const allOn = activeSections.every(s => enabledSections[s.id]);
  const toggleAll = () => {
    const newState = {};
    activeSections.forEach(s => { newState[s.id] = !allOn; });
    setEnabledSections(prev => ({ ...prev, ...newState }));
  };

  const generatePDF = async () => {
    if (!project) return toast.error('Selecione um projeto');
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 250));

    // ---- computed content (no AI) ----
    const cols = project.column_info || [];
    const isCat = (c) => ['string', 'object', 'category', 'categorical', 'text', 'varchar', 'boolean', 'bool'].includes((c.type || '').toLowerCase());
    const numCols = cols.filter((c) => !isCat(c));
    const catCols = cols.filter(isCat);
    const avgNulls = cols.length ? cols.reduce((s, c) => s + (c.null_percent || 0), 0) / cols.length : 0;
    const highNull = cols.filter((c) => (c.null_percent || 0) > 20);
    const highCard = catCols.filter((c) => (c.unique_count || 0) > 50);
    const constants = cols.filter((c) => (c.unique_count || 0) <= 1);
    const lowCardCat = catCols.filter((c) => (c.unique_count || 0) >= 2 && (c.unique_count || 0) <= 20);

    const scored = analyses
      .filter((a) => ['classification', 'regression'].includes(a.type))
      .map((a) => { const m = a.results?.metrics || {}; const s = a.type === 'classification' ? (m.accuracy ?? m.f1 ?? m.f1_score ?? 0) : (m.r2 ?? 0); return { a, s }; })
      .sort((x, y) => y.s - x.s);
    const best = scored[0]?.a;

    const recs = [];
    if (highNull.length) recs.push('Tratar valores ausentes (imputação por média/mediana/moda) nas colunas com nulos.');
    if (numCols.length) recs.push('Padronizar variáveis numéricas (StandardScaler/MinMax) antes do treino.');
    if (catCols.length) recs.push('Aplicar encoding às variáveis categóricas (One-Hot para baixa cardinalidade; target/frequency para alta).');
    if (highCard.length) recs.push('Agrupar categorias raras nas colunas de alta cardinalidade.');
    if (constants.length) recs.push(`Remover colunas constantes: ${constants.map((c) => c.name).join(', ')}.`);
    recs.push('Validar com validação cruzada e usar F1/AUC quando as classes forem desbalanceadas.');

    const contentFor = (id) => {
      switch (id) {
        case 'overview': return `O projeto "${project.name}" utiliza o dataset "${project.dataset_filename || '—'}" com ${(project.dataset_size || 0).toLocaleString('pt-BR')} linhas e ${project.dataset_columns || cols.length} colunas (${numCols.length} numéricas e ${catCols.length} categóricas). Status atual: ${project.status}.${project.description ? ' ' + project.description : ''}`;
        case 'quality': return `Taxa média de valores ausentes: ${avgNulls.toFixed(1)}%. ${highNull.length ? `Colunas com mais de 20% de nulos: ${highNull.map((c) => `${c.name} (${(c.null_percent || 0).toFixed(0)}%)`).join(', ')}.` : 'Nenhuma coluna com excesso de nulos.'} ${constants.length ? `Colunas praticamente constantes (candidatas a remoção): ${constants.map((c) => c.name).join(', ')}.` : ''}`;
        case 'distributions': return `Distribuição por tipo: ${numCols.length} numéricas, ${catCols.length} categóricas. ${highCard.length ? `Alta cardinalidade em: ${highCard.map((c) => c.name).join(', ')}.` : 'Cardinalidade categórica dentro do esperado.'} As distribuições completas podem ser exploradas na aba Distribuições do Explorador de Dados.`;
        case 'correlations': return `Há ${numCols.length} variáveis numéricas elegíveis para a matriz de correlação de Pearson. Recomenda-se identificar pares com |r| ≥ 0,7 (multicolinearidade) e considerar remover uma das variáveis de cada par antes da modelagem.`;
        case 'outliers': return `A análise de outliers é feita por desvio padronizado (z-score) sobre as variáveis numéricas. Colunas com grande amplitude entre os valores de amostra merecem atenção especial. Trate outliers por winsorização ou remoção quando não forem legítimos.`;
        case 'bivariate': return `Recomenda-se avaliar relações par a par (correlação de Pearson e dispersão) entre as variáveis numéricas para orientar a seleção de features e detectar redundância.`;
        case 'ai_insights': case 'alerts': case 'recommendations': return recs.map((r) => `• ${r}`).join('\n');
        case 'drift_summary': case 'ai_analysis': return `Não há histórico de produção suficiente para medir drift automaticamente. Recomenda-se, após o deploy, comparar periodicamente a distribuição das features de entrada com a base de treino (teste KS por coluna) e monitorar a métrica principal do modelo.`;
        case 'timeline': return `Configure verificações periódicas (ex.: diárias/semanais) para registrar a distribuição das features e a performance do modelo ao longo do tempo.`;
        case 'column_drift': return `Monitore, por coluna, mudanças na média/desvio (numéricas) e na frequência das categorias (categóricas). Desvios relevantes indicam necessidade de retreino.`;
        case 'performance': return `Acompanhe a métrica principal (${best ? (best.type === 'classification' ? 'acurácia/F1' : 'R²/RMSE') : 'acurácia/R²'}) em produção. Queda sustentada sugere drift e retreino.`;
        case 'best_model': return best ? `Modelo selecionado: "${best.name}" (${best.type}). Coluna-alvo: ${best.config?.target_column || '—'}. Métricas: ${Object.entries(best.results?.metrics || {}).map(([k, v]) => `${k} ${typeof v === 'number' ? v.toFixed(3) : v}`).join(', ') || '—'}.` : 'Nenhum modelo de classificação/regressão concluído neste projeto.';
        case 'interpretation': return best?.ai_interpretation ? best.ai_interpretation.replace(/[*#>`]/g, '') : 'Interpretação disponível na tela do ML Studio após o treino.';
        case 'feature_importance': {
          const fi = best?.results?.feature_importance || [];
          return fi.length ? `Principais features do modelo "${best.name}":\n` + fi.slice(0, 8).map((f, i) => `${i + 1}. ${f.feature} — ${(f.score ?? 0).toFixed?.(3) ?? f.score}`).join('\n') : 'Sem importância de features disponível para este modelo.';
        }
        default: return '';
      }
    };

    // ---- build document ----
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const typeLabel = REPORT_TYPES.find((r) => r.value === reportType)?.label.replace(/^\S+\s/, '') || reportType;
    const docTitle = `Relatório ${typeLabel}`;
    const pageNum = { n: 1 };

    // ---- cover (white) ----
    doc.setFillColor(255, 255, 255); doc.rect(0, 0, 210, 297, 'F');
    doc.setFillColor(...CYAN); doc.rect(0, 0, 210, 46, 'F');
    // neural hexagon mark
    const cx = 28, cy = 23, r = 11;
    doc.setDrawColor(255, 255, 255); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.5);
    const verts = Array.from({ length: 6 }, (_, i) => { const a = (Math.PI / 180) * (60 * i - 90); return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; });
    verts.forEach((p, i) => { const q = verts[(i + 1) % 6]; doc.line(p[0], p[1], q[0], q[1]); doc.line(cx, cy, p[0], p[1]); doc.circle(p[0], p[1], 0.8, 'F'); });
    doc.circle(cx, cy, 1.6, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(255, 255, 255);
    doc.text('NEURIX', 46, 21);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(230, 250, 252);
    doc.text('ML WORKBENCH', 46, 28);

    doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...INK);
    doc.text(doc.splitTextToSize(project.name, 180), 15, 80);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(13); doc.setTextColor(...CYAN);
    doc.text(docTitle, 15, 92);

    // meta card
    doc.setDrawColor(...LINE); doc.setFillColor(...ROWALT);
    doc.roundedRect(15, 104, 180, 34, 2, 2, 'FD');
    doc.setFontSize(10); doc.setTextColor(...INK);
    const meta = [
      ['Dataset', project.dataset_filename || '—'],
      ['Dimensões', `${(project.dataset_size || 0).toLocaleString('pt-BR')} linhas × ${project.dataset_columns || cols.length} colunas`],
      ['Gerado em', new Date().toLocaleString('pt-BR')],
    ];
    meta.forEach((m, i) => {
      doc.setFont('helvetica', 'bold'); doc.setTextColor(...MUTED); doc.text(m[0], 20, 114 + i * 9);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK); doc.text(String(m[1]), 60, 114 + i * 9);
    });
    doc.setFontSize(8); doc.setTextColor(...MUTED);
    doc.text('Documento gerado automaticamente pelo Neurix · cálculo local, sem IA externa.', 15, 285);

    // ---- sections ----
    const sections = activeSections.filter((s) => enabledSections[s.id]);
    for (const section of sections) {
      pageNum.n++; let y = pageChrome(doc, docTitle, pageNum.n);
      y = sectionTitle(doc, section.label, y);

      const content = contentFor(section.id);
      if (content) y = pdfText(doc, content, 15, y, { fontSize: 10, maxWidth: 180 });
      y += 3;

      if (section.id === 'overview') {
        const rows = cols.slice(0, 22).map((c) => [c.name, isCat(c) ? 'categórica' : 'numérica', String(c.unique_count ?? '—'), `${(c.null_percent || 0).toFixed(0)}%`]);
        if (rows.length) y = pdfTable(doc, ['Coluna', 'Tipo', 'Únicos', 'Nulos'], rows, y + 2, pageNum, docTitle, [80, 40, 30, 30]);
      }
      if ((section.id === 'models_list' || section.id === 'metrics_table') && analyses.length) {
        const rows = analyses.slice(0, 12).map((a) => {
          const m = a.results?.metrics || {};
          const primary = a.type === 'classification' ? (m.accuracy ?? m.f1 ?? m.f1_score) : (m.r2 ?? m.rmse);
          return [a.name, a.type, primary != null ? Number(primary).toFixed(3) : '—', a.created_date ? new Date(a.created_date).toLocaleDateString('pt-BR') : '—'];
        });
        y = pdfTable(doc, ['Análise', 'Tipo', 'Métrica', 'Data'], rows, y + 2, pageNum, docTitle, [78, 34, 34, 34]);
      }
    }

    doc.save(`${project.name.replace(/\s+/g, '_')}_${reportType}_report.pdf`);
    setIsGenerating(false);
    toast.success(`PDF exportado (${pageNum.n} páginas)`);
  };

  return (
    <div>
      <PageHeader title="Exportar Relatórios PDF" subtitle="Gere relatórios customizados de EDA, drift e modelagem com insights da IA" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-4">
          <GlowCard>
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><FileDown className="w-4 h-4 text-primary" /> Configuração</h3>

            <div className="mb-3">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Projeto</label>
              <Select value={selectedProjectId} onValueChange={v => { setSelectedProjectId(v); setAiContent(null); }}>
                <SelectTrigger className="mt-1 bg-secondary/50"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{projects.filter(p => p.dataset_file_url || p.data_sample?.length).map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            <div className="mb-4">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider">Tipo de Relatório</label>
              <div className="space-y-2 mt-1">
                {REPORT_TYPES.map(r => (
                  <button key={r.value} onClick={() => setReportType(r.value)}
                    className={cn('w-full p-2.5 rounded-lg border text-left transition-all',
                      reportType === r.value ? 'border-primary/50 bg-primary/10' : 'border-border/30 hover:border-border/60')}>
                    <p className={cn('text-xs font-medium', reportType === r.value ? 'text-primary' : 'text-foreground')}>{r.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{r.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <Button onClick={generatePDF} disabled={isGenerating || !selectedProjectId} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando PDF...</> : <><FileDown className="w-4 h-4 mr-2" /> Exportar PDF</>}
            </Button>
            {isGenerating && <p className="text-[10px] text-amber-400 mt-1 animate-pulse text-center">Chamando IA para gerar conteúdo...</p>}
          </GlowCard>

          {project && (
            <GlowCard hover={false} className="border-border/20">
              <p className="text-xs font-semibold text-foreground mb-2">{project.name}</p>
              <div className="grid grid-cols-2 gap-1.5 text-center">
                {[
                  { label: 'Linhas', value: project.dataset_size?.toLocaleString('pt-BR') || '—' },
                  { label: 'Análises', value: analyses.length },
                ].map((s, i) => (
                  <div key={i} className="p-1.5 rounded bg-secondary/30">
                    <p className="text-sm font-bold text-primary">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </GlowCard>
          )}
        </div>

        <div className="lg:col-span-2">
          {project ? (
            <GlowCard>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Seções do Relatório</h3>
                <button onClick={toggleAll} className="text-[10px] text-primary hover:underline">{allOn ? 'Desmarcar todas' : 'Marcar todas'}</button>
              </div>
              <div className="space-y-2">
                {activeSections.map(section => (
                  <label key={section.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/20 cursor-pointer hover:border-border/40 hover:bg-secondary/20 transition-all">
                    <div className="flex-shrink-0">
                      {enabledSections[section.id]
                        ? <CheckSquare className="w-4 h-4 text-primary" />
                        : <Square className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    <input type="checkbox" checked={!!enabledSections[section.id]} onChange={() => toggleSection(section.id)} className="sr-only" />
                    <span className={cn('text-xs font-medium', enabledSections[section.id] ? 'text-foreground' : 'text-muted-foreground')}>{section.label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-border/20">
                <p className="text-xs text-muted-foreground">
                  <span className="text-primary font-semibold">{activeSections.filter(s => enabledSections[s.id]).length}</span> seções selecionadas de {activeSections.length}
                </p>
              </div>
            </GlowCard>
          ) : (
            <EmptyState icon={FileDown} title="Configure o relatório" description="Selecione um projeto e as seções desejadas para exportar o PDF" />
          )}
        </div>
      </div>
    </div>
  );
}