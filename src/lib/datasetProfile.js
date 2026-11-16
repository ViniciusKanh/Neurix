/**
 * datasetProfile.js — ponto de entrada de compatibilidade.
 *
 * O perfilamento vive em @viniciuskanh/neurix-data-tools. O pacote não inclui
 * linhas reais por padrão (sampleN = 0, privacidade); aqui mantemos os padrões
 * históricos do Neurix (12 linhas de amostra, estatísticas com 2 casas), que
 * podem ser sobrescritos pelas opções recebidas.
 */
import { buildProfile as buildProfileCore } from '../../packages/neurix-data-tools/src/index.ts';

export function buildProfile(rows, columnInfo, options = {}) {
  return buildProfileCore(rows, columnInfo, { sampleN: 12, precision: 2, statCap: 5000, ...options });
}
