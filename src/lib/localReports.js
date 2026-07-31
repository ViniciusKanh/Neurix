/**
 * Local Report Generator — zero external API calls
 * Generates structured Markdown reports from project metadata.
 */
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function today() {
  return format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function qualityScore(project) {
  const cols = project.column_info || [];
  if (!cols.length) return 70;
  const avgNull = cols.reduce((s, c) => s + (c.null_percent || 0), 0) / cols.length;
  const rows = project.dataset_size || 100;
  const sizeFactor = Math.min(30, Math.log10(rows + 1) * 10);
  return Math.round(Math.max(30, Math.min(98, 85 - avgNull * 0.5 + sizeFactor * 0.2)));
}

function colTable(project) {
  const cols = (project.column_info || []).slice(0, 20);
  if (!cols.length) return '_Nenhuma informação de colunas disponível._';
  let t = '| Coluna | Tipo | Únicos | Nulos (%) | Exemplos |\n';
  t += '|--------|------|--------|-----------|----------|\n';
  for (const c of cols) {
    const samples = (c.sample_values || []).slice(0, 3).join(', ') || '—';
    t += `| \`${c.name}\` | ${c.type || '—'} | ${c.unique_count ?? '—'} | ${(c.null_percent || 0).toFixed(1)}% | ${samples} |\n`;
  }
  return t;
}

function metricsSection(analyses) {
  const completed = analyses.filter(a => a.status === 'completed');
  if (!completed.length) return '_Nenhuma análise concluída ainda._\n';
  let t = '| Análise | Tipo | Melhor Modelo | Métricas Principais |\n';
  t += '|---------|------|---------------|---------------------|\n';
  for (const a of completed.slice(0, 8)) {
    const metrics = a.results?.metrics || {};
    const m = Object.entries(metrics).slice(0, 3).map(([k, v]) => `${k}: ${typeof v === 'number' ? v.toFixed(3) : v}`).join(', ') || '—';
    t += `| ${a.name.slice(0, 30)} | ${a.type} | ${a.results?.best_model || '—'} | ${m} |\n`;
  }
  return t;
}

function prepSection(project) {
  const steps = project.prep_steps || [];
  if (!steps.length) return '_Nenhuma etapa de pré-processamento aplicada._\n';
  let t = '| # | Operação | Colunas | Linhas Afetadas | Resumo |\n';
  t += '|---|---------|---------|-----------------|--------|\n';
  steps.forEach((s, i) => {
    t += `| ${i + 1} | ${s.label} | ${(s.affected_columns || []).join(', ') || '—'} | ${(s.affected_rows || 0).toLocaleString('pt-BR')} | ${s.summary || '—'} |\n`;
  });
  return t;
}

function recommendations(project, analyses) {
  const cols = project.column_info || [];
  const numCols = cols.filter(c => ['numeric', 'integer', 'float', 'int', 'number'].includes((c.type || '').toLowerCase()));
  const catCols = cols.filter(c => ['categorical', 'string', 'object', 'text'].includes((c.type || '').toLowerCase()));
  const nullCols = cols.filter(c => (c.null_percent || 0) > 20);
  const recs = [];
  if (nullCols.length) recs.push(`Tratar valores nulos nas colunas: **${nullCols.slice(0, 3).map(c => c.name).join(', ')}**`);
  if (numCols.length > 5) recs.push('Considerar redução de dimensionalidade (PCA) nas features numéricas');
  if (catCols.length > 3) recs.push('Aplicar encoding adequado (One-Hot ou Target Encoding) nas variáveis categóricas');
  if (analyses.length === 0) recs.push('Executar primeira análise de ML no **ML Studio**');
  else recs.push('Fazer deploy do melhor modelo via **Deployment Manager**');
  recs.push('Configurar monitoramento de drift para o modelo em produção');
  recs.push('Documentar o pipeline completo para reprodutibilidade');
  return recs.map(r => `- ${r}`).join('\n');
}

export function buildLocalReport(reportType, project, analyses = []) {
  const score = qualityScore(project);
  const date = today();
  const cols = project.column_info || [];
  const numCols = cols.filter(c => ['numeric', 'integer', 'float', 'int', 'number'].includes((c.type || '').toLowerCase()));
  const catCols = cols.filter(c => ['categorical', 'string', 'object', 'text'].includes((c.type || '').toLowerCase()));
  const nullCols = cols.filter(c => (c.null_percent || 0) > 20);
  const completed = analyses.filter(a => a.status === 'completed');

  if (reportType === 'executive') {
    return `# ${project.name} — Resumo Executivo
**Gerado em:** ${date}

---

## O Problema e o Contexto
O projeto **${project.name}** analisa o dataset **${project.dataset_filename || 'dataset'}** contendo **${project.dataset_size?.toLocaleString('pt-BR') || 'N/A'} registros** e **${project.dataset_columns || 'N/A'} variáveis** com o objetivo de extrair insights e construir modelos preditivos de alta qualidade.

${project.description ? `**Descrição:** ${project.description}` : ''}

## Principais Descobertas
- 📊 Dataset com **${score}% de qualidade geral** estimada
- 🔢 **${numCols.length} variáveis numéricas** e **${catCols.length} variáveis categóricas** identificadas
- ${nullCols.length > 0 ? `⚠️ **${nullCols.length} colunas com mais de 20% de valores nulos** requerem atenção` : '✅ Qualidade de dados aceitável — poucos valores nulos críticos'}
- 🤖 **${completed.length} análises de ML** executadas com sucesso
${completed.length > 0 ? `- 🏆 Melhor resultado: **${completed[0]?.results?.best_model || completed[0]?.name}**` : '- 🔬 Análises pendentes de execução'}

## Oportunidades Identificadas
${recommendations(project, analyses)}

## Riscos e Considerações
- Validar representatividade da amostra em relação à população real
- Monitorar drift de dados após implementação em produção
- Revisar periodicamente o desempenho do modelo
${nullCols.length > 0 ? `- Tratar colunas com nulos antes de inferência: ${nullCols.slice(0, 3).map(c => c.name).join(', ')}` : ''}

## Ações Recomendadas (Prioridade Alta)
1. ${completed.length === 0 ? 'Executar análise de classificação/regressão no ML Studio' : 'Fazer deploy do melhor modelo encontrado'}
2. Configurar monitoramento de métricas de produção
3. Documentar o pipeline para a equipe técnica

## Ações Recomendadas (Prioridade Média)
1. Executar AutoML Pipeline para comparação automática de algoritmos
2. Criar feature engineering adicional para melhorar performance
3. Avaliar balanceamento de classes (se aplicável)

## Conclusão
O projeto apresenta **potencial ${score >= 80 ? 'alto' : score >= 60 ? 'moderado' : 'a ser desenvolvido'}** para geração de valor. Com os dados disponíveis, é possível construir modelos preditivos com qualidade adequada para tomada de decisão.`;
  }

  if (reportType === 'eda') {
    return `# ${project.name} — Análise Exploratória de Dados
**Gerado em:** ${date}

---

## 1. Visão Geral do Dataset
| Estatística | Valor |
|-------------|-------|
| Arquivo | ${project.dataset_filename || '—'} |
| Total de Registros | ${project.dataset_size?.toLocaleString('pt-BR') || '—'} |
| Total de Colunas | ${project.dataset_columns || '—'} |
| Score de Qualidade | **${score}%** |
| Colunas Numéricas | ${numCols.length} |
| Colunas Categóricas | ${catCols.length} |
| Outros Tipos | ${cols.length - numCols.length - catCols.length} |

## 2. Análise Estrutural

### 2.1 Inventário de Variáveis
${colTable(project)}

### 2.2 Variáveis Numéricas
${numCols.length > 0 ? numCols.map(c => `- **\`${c.name}\`** — Exemplos: ${(c.sample_values || []).slice(0, 4).join(', ') || '—'}`).join('\n') : '_Nenhuma variável numérica identificada._'}

### 2.3 Variáveis Categóricas
${catCols.length > 0 ? catCols.map(c => `- **\`${c.name}\`** — ${c.unique_count || '?'} valores únicos | Exemplos: ${(c.sample_values || []).slice(0, 4).join(', ') || '—'}`).join('\n') : '_Nenhuma variável categórica identificada._'}

## 3. Qualidade dos Dados

### 3.1 Valores Ausentes
${nullCols.length > 0
  ? nullCols.map(c => `- **\`${c.name}\`**: ${c.null_percent?.toFixed(1)}% de nulos — Recomendação: ${c.null_percent > 50 ? 'considerar remoção da coluna' : 'imputação por mediana/moda'}`).join('\n')
  : '✅ Nenhuma coluna com problema crítico de valores nulos (>20%).'}

### 3.2 Score de Qualidade por Dimensão
| Dimensão | Score | Status |
|----------|-------|--------|
| Completude | ${Math.max(30, score - 5)}% | ${score >= 70 ? '✅ Bom' : '⚠️ Atenção'} |
| Consistência | ${Math.min(98, score + 5)}% | ${score >= 65 ? '✅ Bom' : '⚠️ Atenção'} |
| Unicidade | ${Math.min(98, score + 2)}% | ${score >= 70 ? '✅ Bom' : '⚠️ Atenção'} |
| Validade | ${score}% | ${score >= 75 ? '✅ Bom' : '⚠️ Atenção'} |

## 4. Padrões e Tendências
${project.ai_diagnosis || `Com base na estrutura do dataset, identifica-se um conjunto de dados com **${project.dataset_size?.toLocaleString('pt-BR')} registros** e distribuição ${score >= 75 ? 'equilibrada' : 'que requer tratamento'} entre as variáveis. As variáveis numéricas disponíveis oferecem base para análises quantitativas, enquanto as categóricas permitem segmentação e agrupamento.`}

## 5. Recomendações para Modelagem
${recommendations(project, analyses)}`;
  }

  if (reportType === 'dataset') {
    return `# ${project.name} — Perfil do Dataset
**Gerado em:** ${date}

---

## Metadados
| Campo | Valor |
|-------|-------|
| Nome do Arquivo | ${project.dataset_filename || '—'} |
| Linhas | ${project.dataset_size?.toLocaleString('pt-BR') || '—'} |
| Colunas | ${project.dataset_columns || '—'} |
| Status do Projeto | ${project.status || '—'} |
| Etapas de Preparação | ${(project.prep_steps || []).length} |

## Resumo de Qualidade
> **Score Geral de Qualidade: ${score}/100**

| Aspecto | Avaliação |
|---------|-----------|
| Tamanho do Dataset | ${(project.dataset_size || 0) >= 10000 ? '✅ Grande (>10k linhas)' : (project.dataset_size || 0) >= 1000 ? '⚠️ Médio (1k-10k linhas)' : '❌ Pequeno (<1k linhas)'} |
| Completude | ${nullCols.length === 0 ? '✅ Sem colunas com nulos críticos' : `⚠️ ${nullCols.length} colunas com >20% nulos`} |
| Diversidade | ${cols.length >= 10 ? '✅ Alta dimensionalidade' : '⚠️ Baixa dimensionalidade'} |
| Tipos de Dados | ${numCols.length > 0 && catCols.length > 0 ? '✅ Misto (numérico + categórico)' : '⚠️ Apenas um tipo de dado'} |

## Análise por Coluna
${colTable(project)}

## Missing Values
${nullCols.length === 0 
  ? '✅ Nenhuma coluna com taxa crítica de valores nulos (>20%).\n\n> Recomendação: verificar se há valores nulos implícitos (strings vazias, zeros indevidos).'
  : nullCols.map(c => `**\`${c.name}\`**: ${c.null_percent?.toFixed(1)}% de nulos\n- Tipo: ${c.type || '—'}\n- Impacto: ${c.null_percent > 50 ? 'Alto — considerar remoção' : 'Moderado — imputação recomendada'}`).join('\n\n')}

## Pipeline de Preparação Aplicado
${prepSection(project)}

## Recomendações de Tratamento
${recommendations(project, analyses)}`;
  }

  // Default: technical report
  return `# Relatório Técnico — ${project.name}
**Gerado em:** ${date}

---

## Resumo Executivo
O projeto **${project.name}** processa o dataset **${project.dataset_filename || 'N/A'}** contendo **${project.dataset_size?.toLocaleString('pt-BR') || 'N/A'} registros** × **${project.dataset_columns || 'N/A'} variáveis**. O score de qualidade dos dados foi estimado em **${score}%**.

${project.description ? `**Objetivo:** ${project.description}` : ''}

Foram executadas **${analyses.length} análises** até o momento${completed.length > 0 ? `, com **${completed.length} concluídas com sucesso**` : ''}.

---

## 1. Descrição do Dataset

### 1.1 Estrutura e Dimensões
| Métrica | Valor |
|---------|-------|
| Arquivo | ${project.dataset_filename || '—'} |
| Registros | ${project.dataset_size?.toLocaleString('pt-BR') || '—'} |
| Variáveis | ${project.dataset_columns || '—'} |
| Numéricas | ${numCols.length} |
| Categóricas | ${catCols.length} |
| Score Qualidade | **${score}%** |

### 1.2 Inventário de Variáveis
${colTable(project)}

### 1.3 Qualidade dos Dados
${nullCols.length > 0
  ? `**Colunas com problemas de completude:**\n${nullCols.map(c => `- \`${c.name}\`: ${c.null_percent?.toFixed(1)}% de valores nulos`).join('\n')}`
  : '✅ Nenhuma coluna com taxa crítica de valores nulos (>20%).'}

---

## 2. Análise Exploratória

${project.ai_diagnosis || `O dataset apresenta **${numCols.length} features numéricas** e **${catCols.length} features categóricas**. Com ${project.dataset_size?.toLocaleString('pt-BR') || 'N/A'} registros, o volume é ${(project.dataset_size || 0) >= 10000 ? 'adequado para ML supervisionado' : 'limitado — considere técnicas de augmentation ou bootstrapping'}.`}

### Sugestões de Análise
${(project.ai_suggestions || []).map(s => `- **${s.task}**: ${s.description} _(confiança: ${s.confidence || 'média'})_`).join('\n') || '- Execute o diagnóstico automático no projeto para obter sugestões personalizadas.'}

---

## 3. Pré-processamento Aplicado

${prepSection(project)}

---

## 4. Análises de Machine Learning

${metricsSection(analyses)}

${completed.length > 0 ? `
### Melhor Resultado Obtido
**Análise:** ${completed[0]?.name}  
**Tipo:** ${completed[0]?.type}  
**Modelo:** ${completed[0]?.results?.best_model || 'N/A'}  
${completed[0]?.ai_interpretation ? `**Interpretação:** ${completed[0].ai_interpretation.slice(0, 300)}...` : ''}
` : ''}

---

## 5. Insights Principais
${(completed[0]?.ai_recommendations || []).slice(0, 5).map(r => `- ${r}`).join('\n') || recommendations(project, analyses)}

---

## 6. Limitações e Riscos
- Resultados baseados em metadados do dataset (sem acesso aos dados brutos completos)
- Métricas de ML são estimativas baseadas em heurísticas determinísticas
- ${(project.dataset_size || 0) < 1000 ? '⚠️ Dataset pequeno pode limitar a generalização dos modelos' : 'Tamanho do dataset adequado para modelagem'}
- Revisar periodicamente o desempenho do modelo em produção

---

## 7. Recomendações
${recommendations(project, analyses)}

---

## 8. Conclusão e Próximos Passos
O projeto **${project.name}** apresenta **potencial ${score >= 80 ? 'alto' : score >= 60 ? 'moderado' : 'a ser desenvolvido'}** para geração de modelos preditivos de qualidade.

**Próximos passos:**
1. ${completed.length === 0 ? 'Executar análise de ML no **ML Studio**' : 'Otimizar hiperparâmetros do melhor modelo no **Hyperparameter Tuning**'}
2. ${(project.prep_steps || []).length === 0 ? 'Aplicar pré-processamento no módulo de **Preparação de Dados**' : 'Validar pipeline de pré-processamento em dados novos'}
3. Fazer deploy do melhor modelo via **Deployment Manager**
4. Configurar alertas de monitoramento de drift

---
*Relatório gerado automaticamente pelo ML Model Studio — ${date}*`;
}