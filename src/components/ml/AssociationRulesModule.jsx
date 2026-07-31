import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import GlowCard from '@/components/ui/GlowCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Loader2, Sparkles, Network, CheckCircle2, XCircle, AlertTriangle, TrendingUp, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ScatterChart, Scatter, ZAxis } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';

export default function AssociationRulesModule({ project }) {
  const [minSupport, setMinSupport] = useState('0.05');
  const [minConfidence, setMinConfidence] = useState('0.3');
  const [minLift, setMinLift] = useState('1.0');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState(null);

  if (!project) {
    return (
      <GlowCard className="flex flex-col items-center justify-center py-16 text-center">
        <Network className="w-10 h-10 text-muted-foreground opacity-30 mb-3" />
        <p className="text-sm text-muted-foreground">Selecione um projeto para começar</p>
      </GlowCard>
    );
  }

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setResult(null);

    const columnsInfo = JSON.stringify(project.column_info || []);
    const sampleData = JSON.stringify((project.data_sample || []).slice(0, 20));

    const prompt = `Você é um especialista em mineração de dados e regras de associação. Analise o dataset abaixo e execute uma análise completa de Regras de Associação usando o algoritmo Apriori.

Dataset: ${project.dataset_filename}
Linhas: ${project.dataset_size} | Colunas: ${project.dataset_columns}
Informações das colunas: ${columnsInfo}
Amostra dos dados: ${sampleData}

Parâmetros fornecidos pelo usuário:
- Suporte mínimo: ${minSupport}
- Confiança mínima: ${minConfidence}
- Lift mínimo: ${minLift}

**TAREFA 1 — Diagnóstico de compatibilidade:**
Verifique se este dataset é adequado para mineração de regras de associação. Considere:
- Presença de variáveis categóricas ou transacionais
- Densidade dos dados (sparsidade)
- Volume de registros
- Cardinalidade das colunas categóricas
- Se há uma estrutura transacional implícita (ex: colunas binárias, listas de itens, etc.)
Dê uma nota de compatibilidade de 0 a 100 e explique o raciocínio.

**TAREFA 2 — Pré-processamento e novo DataFrame:**
Com base nos dados, descreva como criar um DataFrame binário/transacional adequado para o Apriori. Liste:
- Quais colunas usar
- Como transformá-las (binarização, pivotamento, etc.)
- Exemplo de como ficaria o DataFrame resultante (3-5 linhas de exemplo)

**TAREFA 3 — Regras de associação:**
Gere as top 15 regras de associação mais relevantes com:
- antecedent (antecedente): o conjunto de itens "se..."
- consequent (consequente): o item resultante "...então"
- support (suporte): frequência do conjunto no dataset
- confidence (confiança): probabilidade condicional
- lift: força da regra (>1 indica correlação positiva)
- conviction: medida de implicação direcional

**TAREFA 4 — Interpretação:**
Forneça uma interpretação em português, em markdown, com:
- Principais descobertas
- Regras mais importantes e seu significado de negócio
- Limitações e cuidados

Responda em português.`;

    const response = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          compatibility_score: { type: "number", description: "Score de 0 a 100" },
          compatibility_verdict: { type: "string", enum: ["excelente", "bom", "moderado", "ruim", "incompatível"] },
          compatibility_explanation: { type: "string" },
          preprocessing_steps: { type: "array", items: { type: "string" } },
          dataframe_columns: { type: "array", items: { type: "string" } },
          dataframe_example: { type: "array", items: { type: "object" } },
          rules: {
            type: "array",
            items: {
              type: "object",
              properties: {
                antecedent: { type: "string" },
                consequent: { type: "string" },
                support: { type: "number" },
                confidence: { type: "number" },
                lift: { type: "number" },
                conviction: { type: "number" }
              }
            }
          },
          top_itemsets: { type: "array", items: { type: "object", properties: { itemset: { type: "string" }, support: { type: "number" } } } },
          interpretation: { type: "string" },
          recommendations: { type: "array", items: { type: "string" } }
        }
      }
    });

    setResult(response);
    setIsAnalyzing(false);
    toast.success('Análise de regras de associação concluída!');
  };

  const exportRulesCSV = () => {
    if (!result?.rules?.length) return;
    const header = 'Antecedente,Consequente,Suporte,Confiança,Lift,Convicção';
    const rows = result.rules.map(r =>
      `"${r.antecedent}","${r.consequent}",${r.support?.toFixed(4)},${r.confidence?.toFixed(4)},${r.lift?.toFixed(4)},${r.conviction?.toFixed(4)}`
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `regras_associacao_${project.name?.replace(/\s+/g, '_')}.csv`;
    a.click();
    toast.success('Regras exportadas em CSV!');
  };

  const compatibilityColor = (score) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-primary';
    if (score >= 40) return 'text-amber-400';
    return 'text-destructive';
  };

  const verdictIcon = (verdict) => {
    if (['excelente', 'bom'].includes(verdict)) return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
    if (verdict === 'moderado') return <AlertTriangle className="w-5 h-5 text-amber-400" />;
    return <XCircle className="w-5 h-5 text-destructive" />;
  };

  return (
    <div className="space-y-6">
      {/* Config Panel */}
      <GlowCard>
        <div className="flex items-center gap-2 mb-5">
          <Network className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-foreground">Configuração — Regras de Associação (Apriori)</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
          <div>
            <Label className="text-xs text-muted-foreground">Suporte Mínimo</Label>
            <Input
              className="mt-1.5 bg-secondary/50 font-mono"
              value={minSupport}
              onChange={e => setMinSupport(e.target.value)}
              placeholder="0.05"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Frequência mínima do itemset (0–1)</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Confiança Mínima</Label>
            <Input
              className="mt-1.5 bg-secondary/50 font-mono"
              value={minConfidence}
              onChange={e => setMinConfidence(e.target.value)}
              placeholder="0.3"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Probabilidade condicional mínima (0–1)</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Lift Mínimo</Label>
            <Input
              className="mt-1.5 bg-secondary/50 font-mono"
              value={minLift}
              onChange={e => setMinLift(e.target.value)}
              placeholder="1.0"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Força mínima da regra (&gt;1 = positiva)</p>
          </div>
        </div>
        <Button
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
        >
          {isAnalyzing
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Analisando com IA...</>
            : <><Sparkles className="w-4 h-4 mr-2" /> Executar Análise de Associação</>
          }
        </Button>
      </GlowCard>

      {isAnalyzing && <LoadingSpinner text="Minerando regras de associação com IA..." />}

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

            {/* Compatibility Card */}
            <GlowCard glowColor={result.compatibility_score >= 60 ? 'success' : 'none'}>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">{verdictIcon(result.compatibility_verdict)}</div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-foreground">Diagnóstico de Compatibilidade</h3>
                    <span className={`text-2xl font-bold font-mono ${compatibilityColor(result.compatibility_score)}`}>
                      {result.compatibility_score}/100
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 mb-3">
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{
                        width: `${result.compatibility_score}%`,
                        background: result.compatibility_score >= 80
                          ? 'hsl(152, 68%, 50%)'
                          : result.compatibility_score >= 60
                            ? 'hsl(187, 92%, 55%)'
                            : result.compatibility_score >= 40
                              ? 'hsl(35, 92%, 60%)'
                              : 'hsl(0, 72%, 55%)'
                      }}
                    />
                  </div>
                  <span className="inline-block text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-secondary mb-2 text-muted-foreground">
                    {result.compatibility_verdict}
                  </span>
                  <p className="text-sm text-muted-foreground">{result.compatibility_explanation}</p>
                </div>
              </div>
            </GlowCard>

            {/* DataFrame Transformation */}
            {result.preprocessing_steps?.length > 0 && (
              <GlowCard>
                <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-accent" /> Pré-processamento — Novo DataFrame Transacional
                </h3>
                <div className="space-y-2 mb-4">
                  {result.preprocessing_steps.map((step, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="w-5 h-5 flex-shrink-0 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                      <p className="text-sm text-muted-foreground">{step}</p>
                    </div>
                  ))}
                </div>
                {result.dataframe_example?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Exemplo do DataFrame Resultante</p>
                    <div className="overflow-x-auto rounded-lg border border-border/40">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-secondary/60">
                            {(result.dataframe_columns || Object.keys(result.dataframe_example[0])).map(col => (
                              <th key={col} className="text-left p-2 font-mono text-primary border-b border-border/40 whitespace-nowrap">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {result.dataframe_example.slice(0, 5).map((row, i) => (
                            <tr key={i} className={i % 2 === 0 ? 'bg-secondary/20' : ''}>
                              {(result.dataframe_columns || Object.keys(row)).map(col => (
                                <td key={col} className="p-2 text-muted-foreground border-b border-border/20 whitespace-nowrap">
                                  {String(row[col] ?? '—')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </GlowCard>
            )}

            {/* Rules Table */}
            {result.rules?.length > 0 && (
              <GlowCard>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Network className="w-4 h-4 text-primary" /> Regras de Associação ({result.rules.length} regras)
                  </h3>
                  <Button variant="outline" size="sm" onClick={exportRulesCSV} className="border-primary/30 text-primary hover:bg-primary/10">
                    <Download className="w-3 h-3 mr-1.5" /> Exportar CSV
                  </Button>
                </div>

                {/* Lift Chart */}
                <div className="mb-5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Lift por Regra</p>
                  <div className="h-40">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={result.rules.slice(0, 12).map((r, i) => ({ name: `R${i + 1}`, lift: parseFloat(r.lift?.toFixed(3)) ?? 0, confiança: parseFloat(r.confidence?.toFixed(3)) ?? 0 }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 25%, 16%)" />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'hsl(215, 20%, 55%)' }} />
                        <YAxis tick={{ fontSize: 9, fill: 'hsl(215, 20%, 55%)' }} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(222, 40%, 9%)', border: '1px solid hsl(222, 25%, 16%)', borderRadius: '8px', color: '#fff', fontSize: '11px' }}
                          formatter={(v, n) => [v, n]}
                        />
                        <Bar dataKey="lift" fill="hsl(187, 92%, 55%)" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="confiança" fill="hsl(265, 70%, 60%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Rules Table */}
                <div className="overflow-x-auto rounded-lg border border-border/40">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-secondary/60">
                        <th className="text-left p-2.5 text-muted-foreground font-semibold border-b border-border/40">#</th>
                        <th className="text-left p-2.5 text-muted-foreground font-semibold border-b border-border/40">SE (Antecedente)</th>
                        <th className="text-left p-2.5 text-muted-foreground font-semibold border-b border-border/40">ENTÃO (Consequente)</th>
                        <th className="text-right p-2.5 text-muted-foreground font-semibold border-b border-border/40">Suporte</th>
                        <th className="text-right p-2.5 text-muted-foreground font-semibold border-b border-border/40">Confiança</th>
                        <th className="text-right p-2.5 text-muted-foreground font-semibold border-b border-border/40">Lift</th>
                        <th className="text-right p-2.5 text-muted-foreground font-semibold border-b border-border/40">Convicção</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.rules.map((rule, i) => (
                        <tr key={i} className={`${i % 2 === 0 ? 'bg-secondary/20' : ''} hover:bg-secondary/40 transition-colors`}>
                          <td className="p-2.5 text-muted-foreground border-b border-border/20">{i + 1}</td>
                          <td className="p-2.5 border-b border-border/20">
                            <span className="font-mono text-primary">{rule.antecedent}</span>
                          </td>
                          <td className="p-2.5 border-b border-border/20">
                            <span className="font-mono text-accent">{rule.consequent}</span>
                          </td>
                          <td className="p-2.5 text-right text-muted-foreground border-b border-border/20 font-mono">
                            {rule.support?.toFixed(4)}
                          </td>
                          <td className="p-2.5 text-right border-b border-border/20">
                            <span className={`font-mono font-semibold ${rule.confidence >= 0.7 ? 'text-emerald-400' : rule.confidence >= 0.5 ? 'text-primary' : 'text-muted-foreground'}`}>
                              {(rule.confidence * 100)?.toFixed(1)}%
                            </span>
                          </td>
                          <td className="p-2.5 text-right border-b border-border/20">
                            <span className={`font-mono font-semibold ${rule.lift >= 2 ? 'text-emerald-400' : rule.lift >= 1.5 ? 'text-primary' : rule.lift >= 1 ? 'text-amber-400' : 'text-destructive'}`}>
                              {rule.lift?.toFixed(3)}
                            </span>
                          </td>
                          <td className="p-2.5 text-right text-muted-foreground border-b border-border/20 font-mono">
                            {rule.conviction?.toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </GlowCard>
            )}

            {/* Interpretation */}
            {result.interpretation && (
              <GlowCard glowColor="accent">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-accent" />
                  <h3 className="font-semibold text-foreground">Interpretação da IA</h3>
                </div>
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="text-sm text-muted-foreground mb-2 leading-relaxed">{children}</p>,
                      h2: ({ children }) => <h2 className="text-sm font-bold text-foreground mt-4 mb-1">{children}</h2>,
                      h3: ({ children }) => <h3 className="text-xs font-bold text-primary mt-3 mb-1">{children}</h3>,
                      strong: ({ children }) => <strong className="text-foreground">{children}</strong>,
                      ul: ({ children }) => <ul className="list-disc ml-4 space-y-1">{children}</ul>,
                      li: ({ children }) => <li className="text-sm text-muted-foreground">{children}</li>,
                    }}
                  >
                    {result.interpretation}
                  </ReactMarkdown>
                </div>
              </GlowCard>
            )}

            {/* Recommendations */}
            {result.recommendations?.length > 0 && (
              <GlowCard>
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" /> Recomendações
                </h3>
                <div className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30">
                      <span className="w-5 h-5 flex-shrink-0 rounded-full bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold">{i + 1}</span>
                      <p className="text-sm text-muted-foreground">{rec}</p>
                    </div>
                  ))}
                </div>
              </GlowCard>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}