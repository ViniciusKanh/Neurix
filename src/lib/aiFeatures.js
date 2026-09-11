/**
 * aiFeatures.js — turns an AI-suggested feature into a real transform using the
 * featureEng engine. Validates against the dataset before applying. Pure JS.
 */
import { deriveColumn, binningColumn, oneHotColumn, labelEncodeColumn, scaleColumn, logColumn, compileFormula } from './featureEng';

const TRANSFORM_LABELS = {
  formula: 'Fórmula', binning: 'Discretização', onehot: 'One-Hot', label: 'Label Encoding', scale: 'Normalização', log: 'Log',
};
export const transformLabel = (t) => TRANSFORM_LABELS[t] || t;

// Checks whether a suggestion can be applied to the current columns.
export function validateSuggestion(sug, columnNames) {
  const cols = new Set(columnNames);
  if (sug.transform === 'formula') {
    if (!sug.formula) return 'Sem fórmula.';
    try { compileFormula(sug.formula); } catch (e) { return `Fórmula inválida: ${e.message}`; }
    // referenced identifiers must exist
    const ids = (sug.formula.match(/[a-zA-Z_][a-zA-Z0-9_ ]*/g) || []).map((s) => s.trim()).filter((s) => !['log', 'ln', 'sqrt', 'abs', 'exp', 'min', 'max'].includes(s.toLowerCase()));
    const missing = ids.filter((id) => !cols.has(id));
    if (missing.length) return `Colunas não encontradas: ${[...new Set(missing)].join(', ')}`;
    return null;
  }
  if (!sug.source_column) return 'Sem coluna de origem.';
  if (!cols.has(sug.source_column)) return `Coluna "${sug.source_column}" não existe.`;
  return null;
}

// Applies a validated suggestion, returning the featureEng result { rows, added, report }.
export function applySuggestion(rows, sug) {
  const name = (sug.name || 'nova_feature').trim().replace(/\s+/g, '_');
  switch (sug.transform) {
    case 'formula': return deriveColumn(rows, name, sug.formula);
    case 'binning': return binningColumn(rows, sug.source_column, Number(sug.params?.bins) || 4, sug.params?.method === 'freq' ? 'freq' : 'width');
    case 'onehot': return oneHotColumn(rows, sug.source_column);
    case 'label': return labelEncodeColumn(rows, sug.source_column);
    case 'scale': return scaleColumn(rows, sug.source_column, sug.params?.method === 'minmax' ? 'minmax' : 'zscore');
    case 'log': return logColumn(rows, sug.source_column);
    default: return { rows, added: [], report: 'Transformação desconhecida.' };
  }
}
