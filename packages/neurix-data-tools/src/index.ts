/**
 * @viniciuskanh/neurix-data-tools
 *
 * Qualidade de dados, imputação, engenharia de atributos, correlação e
 * perfilamento estatístico — extraídos do Neurix. Puro TypeScript, sem
 * dependências de runtime, sem rede, sem React. Funciona em Node.js ≥ 18 e
 * em navegadores via bundler.
 */

// Tipos públicos
export type * from './types/index.js';

// Utilitários de valores e erros
export { NeurixDataError, isMissing, isNumericType, parseNumber } from './internal/values.js';

// Qualidade
export { analyzeQuality, type QualityOptions } from './quality/analyzeQuality.js';
export { dropDuplicates, findDuplicates, countDuplicates } from './quality/duplicates.js';
export { detectTargetLeakage } from './quality/leakage.js';

// Pré-processamento
export { coerceTypes } from './preprocessing/coerceTypes.js';
export { Imputer, imputeNulls } from './preprocessing/imputer.js';
export { trainTestSplit, type SplitOptions, type SplitResult } from './preprocessing/split.js';

// Engenharia de atributos
export { compileFormula, type CompiledFormula, type CompileFormulaOptions } from './features/formula.js';
export {
  Scaler,
  Binner,
  OneHotEncoder,
  LabelEncoder,
  type ScalerOptions,
  type BinnerOptions,
  type OneHotOptions,
  type LabelEncoderOptions,
} from './features/transformers.js';
export { deriveColumn, binningColumn, oneHotColumn, labelEncodeColumn, scaleColumn, logColumn } from './features/transforms.js';

// Perfilamento
export { buildProfile, sampleRows } from './profiling/buildProfile.js';
export { inferColumns, type InferredColumn, type InferColumnsOptions } from './profiling/inferColumns.js';

// Estatística
export { correlationMatrix, pearson } from './statistics/correlation.js';
export { sum, mean, median, quantile, variance, std, min, max, mode, frequencies } from './statistics/descriptive.js';
