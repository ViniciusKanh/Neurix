/**
 * Data quality & cleaning — ponto de entrada de compatibilidade.
 *
 * A implementação vive no pacote @viniciuskanh/neurix-data-tools
 * (packages/neurix-data-tools), importado diretamente do código-fonte para
 * que exista UMA única implementação. Usado pelo Data Explorer, Data
 * Profiling, ML Studio e AI Advisor. Sem IA; tudo roda localmente.
 */
export {
  analyzeQuality,
  imputeNulls,
  dropDuplicates,
  coerceTypes,
  detectTargetLeakage,
  correlationMatrix,
} from '../../packages/neurix-data-tools/src/index.ts';
