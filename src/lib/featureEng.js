/**
 * featureEng.js — ponto de entrada de compatibilidade.
 *
 * A implementação (avaliador de fórmulas seguro, sem eval, e transformações
 * de atributos) vive em @viniciuskanh/neurix-data-tools
 * (packages/neurix-data-tools). Cada transformação retorna
 * { rows, added, report }, como antes.
 */
export {
  compileFormula,
  deriveColumn,
  binningColumn,
  oneHotColumn,
  labelEncodeColumn,
  scaleColumn,
  logColumn,
  inferColumns,
} from '../../packages/neurix-data-tools/src/index.ts';
