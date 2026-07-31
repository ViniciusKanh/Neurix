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

function addPDFText(doc, text, x, y, options = {}) {
  const { fontSize = 9, color = [150, 160, 180], bold = false, maxWidth = 170 } = options;
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  if (bold) doc.setFont('helvetica', 'bold');
  else doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * (fontSize * 0.4 + 1.2);
}

function newPage(doc, title, pageNum) {
  doc.addPage();
  doc.setFillColor(10, 15, 30);
  doc.rect(0, 0, 210, 297, 'F');
  doc.setFontSize(8);
  doc.setTextColor(80, 100, 120);
  doc.text(title, 15, 287);
  doc.text(`Pág. ${pageNum}`, 195, 287, { align: 'right' });
  doc.setDrawColor(30, 50, 70);
  doc.line(15, 285, 195, 285);
  return 20;
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

    // Generate AI content first
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Você é um cientista de dados sênior. Gere o conteúdo completo para um relatório PDF de ${reportType === 'eda' ? 'EDA' : reportType === 'drift' ? 'Monitoramento de Drift' : reportType === 'model' ? 'Modelagem' : 'Completo'}.

Projeto: ${project.name}
Dataset: ${project.dataset_filename || 'N/A'}
Linhas: ${project.dataset_size || 0} | Colunas: ${project.dataset_columns || 0}
Diagnóstico: ${project.ai_diagnosis || 'N/A'}
Colunas: ${JSON.stringify((project.column_info || []).slice(0, 15))}
Análises: ${JSON.stringify(analyses.slice(0, 5).map(a => ({ tipo: a.type, métricas: a.results?.metrics, melhor_modelo: a.results?.best_model })))}
Passos: ${(project.prep_steps || []).map(s => s.label).join('; ')}

Gere um objeto JSON com seções do relatório. Cada seção deve ter texto rico, específico e técnico baseado nos dados reais.
Seções habilitadas: ${activeSections.filter(s => enabledSections[s.id]).map(s => s.id).join(', ')}`,
      response_json_schema: {
        type: 'object',
        properties: {
          executive_summary: { type: 'string' },
          dataset_overview: { type: 'string' },
          data_quality: { type: 'string' },
          distributions: { type: 'string' },
          correlations: { type: 'string' },
          outliers: { type: 'string' },
          drift_summary: { type: 'string' },
          drift_columns: { type: 'string' },
          performance_impact: { type: 'string' },
          models_comparison: { type: 'string' },
          best_model: { type: 'string' },
          recommendations: { type: 'string' },
          conclusions: { type: 'string' },
        }
      }
    });

    setAiContent(res);

    // Build PDF
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const docTitle = `${project.name} — Relatório ${reportType.toUpperCase()}`;
    let pageNum = 1;

    // Cover page
    doc.setFillColor(10, 15, 30);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setFillColor(20, 40, 80);
    doc.rect(0, 0, 210, 8, 'F');
    doc.setFillColor(0, 180, 220, 0.3);

    // Header accent bar
    doc.setFillColor(0, 180, 220);
    doc.rect(15, 80, 180, 2, 'F');

    doc.setFontSize(28);
    doc.setTextColor(0, 180, 220);
    doc.setFont('helvetica', 'bold');
    doc.text('ML Model Studio', 105, 65, { align: 'center' });

    doc.setFontSize(18);
    doc.setTextColor(220, 230, 240);
    doc.text(project.name, 105, 95, { align: 'center' });

    doc.setFontSize(13);
    doc.setTextColor(100, 150, 200);
    const typeLabel = REPORT_TYPES.find(r => r.value === reportType)?.label || reportType;
    doc.text(typeLabel, 105, 108, { align: 'center' });

    doc.setFontSize(9);
    doc.setTextColor(80, 100, 130);
    doc.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 105, 140, { align: 'center' });
    if (project.dataset_filename) doc.text(`Dataset: ${project.dataset_filename}`, 105, 148, { align: 'center' });
    doc.text(`${project.dataset_size?.toLocaleString('pt-BR') || 0} linhas × ${project.dataset_columns || 0} colunas`, 105, 156, { align: 'center' });

    doc.setFontSize(8);
    doc.setTextColor(50, 70, 90);
    doc.text('CONFIDENCIAL — Uso Interno', 105, 285, { align: 'center' });

    // Sections
    const sections = activeSections.filter(s => enabledSections[s.id]);
    for (const section of sections) {
      pageNum++;
      let y = newPage(doc, docTitle, pageNum);

      // Section title
      doc.setFillColor(0, 50, 80);
      doc.rect(10, y - 4, 190, 10, 'F');
      doc.setFontSize(12);
      doc.setTextColor(0, 180, 220);
      doc.setFont('helvetica', 'bold');
      doc.text(section.label, 15, y + 3);
      y += 12;

      // Content mapping
      const contentMap = {
        overview: res.dataset_overview,
        quality: res.data_quality,
        distributions: res.distributions,
        correlations: res.correlations,
        outliers: res.outliers,
        bivariate: res.distributions,
        ai_insights: res.recommendations,
        drift_summary: res.drift_summary,
        timeline: res.drift_summary,
        column_drift: res.drift_columns,
        performance: res.performance_impact,
        alerts: res.recommendations,
        ai_analysis: res.drift_summary,
        models_list: res.models_comparison,
        metrics_table: res.models_comparison,
        best_model: res.best_model,
        feature_importance: res.best_model,
        interpretation: res.best_model,
        recommendations: res.recommendations,
      };

      const content = contentMap[section.id] || `Dados sobre: ${section.label}`;
      y = addPDFText(doc, content || 'Conteúdo não disponível', 15, y, { fontSize: 9, color: [160, 170, 190], maxWidth: 180 });

      // Stats blocks for relevant sections
      if (section.id === 'overview' && project.column_info) {
        y += 4;
        const stats = [
          { label: 'Total de Linhas', value: project.dataset_size?.toLocaleString('pt-BR') || '—' },
          { label: 'Total de Colunas', value: project.dataset_columns || '—' },
          { label: 'Colunas Numéricas', value: project.column_info.filter(c => ['float64','int64','number','float','int'].includes(c.type?.toLowerCase())).length },
          { label: 'Passos de Prep', value: project.prep_steps?.length || 0 },
        ];
        stats.forEach((s, i) => {
          const x = 15 + (i % 2) * 90;
          if (i % 2 === 0 && y + 14 > 280) { pageNum++; y = newPage(doc, docTitle, pageNum); }
          doc.setFillColor(15, 25, 45);
          doc.rect(x, y, 85, 12, 'F');
          doc.setFontSize(16);
          doc.setTextColor(0, 180, 220);
          doc.setFont('helvetica', 'bold');
          doc.text(String(s.value), x + 5, y + 8);
          doc.setFontSize(7);
          doc.setTextColor(100, 130, 160);
          doc.text(s.label, x + 5, y + 11.5);
          if (i % 2 === 1) y += 16;
        });
        y += 16;
      }

      if (section.id === 'models_list' && analyses.length > 0) {
        y += 4;
        analyses.slice(0, 6).forEach(a => {
          if (y + 16 > 280) { pageNum++; y = newPage(doc, docTitle, pageNum); }
          doc.setFillColor(15, 25, 45);
          doc.rect(15, y, 180, 14, 'F');
          doc.setFontSize(9);
          doc.setTextColor(0, 180, 220);
          doc.setFont('helvetica', 'bold');
          doc.text(a.name, 18, y + 6);
          doc.setFontSize(8);
          doc.setTextColor(120, 140, 160);
          doc.setFont('helvetica', 'normal');
          const metricsStr = Object.entries(a.results?.metrics || {}).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`).join('  |  ');
          doc.text(metricsStr || a.type, 18, y + 11);
          y += 17;
        });
      }
    }

    // Last page: conclusions
    pageNum++;
    let y = newPage(doc, docTitle, pageNum);
    doc.setFillColor(0, 50, 80);
    doc.rect(10, y - 4, 190, 10, 'F');
    doc.setFontSize(12);
    doc.setTextColor(0, 180, 220);
    doc.setFont('helvetica', 'bold');
    doc.text('Conclusões e Recomendações Finais', 15, y + 3);
    y += 12;
    y = addPDFText(doc, res.conclusions || 'Relatório gerado automaticamente pelo ML Model Studio.', 15, y, { fontSize: 9, color: [160, 170, 190], maxWidth: 180 });

    doc.save(`${project.name.replace(/\s+/g, '_')}_${reportType}_report.pdf`);
    setIsGenerating(false);
    toast.success(`PDF exportado com ${pageNum} páginas!`);
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