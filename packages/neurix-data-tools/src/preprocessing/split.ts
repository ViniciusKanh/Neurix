/**
 * Divisão treino/teste reprodutível (com semente), opcionalmente estratificada.
 * Use-a ANTES de ajustar imputadores, escalonadores e codificadores.
 */
import type { Row } from '../types/index.js';
import { assertRows, compareStrings, mulberry32, NeurixDataError } from '../internal/values.js';

export interface SplitOptions {
  /** Fração de teste em (0, 1). Padrão 0,2. */
  testSize?: number;
  /** Semente do embaralhamento. Padrão 42. */
  seed?: number;
  /** Coluna para estratificação (mantém proporções por classe). */
  stratify?: string;
}

export interface SplitResult {
  train: Row[];
  test: Row[];
  train_indices: number[];
  test_indices: number[];
  seed: number;
}

function shuffle(idx: number[], rnd: () => number): number[] {
  const a = [...idx];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Divide as linhas em treino e teste de forma determinística. */
export function trainTestSplit(rows: Row[], options: SplitOptions = {}): SplitResult {
  assertRows(rows, 'trainTestSplit');
  const testSize = options.testSize ?? 0.2;
  const seed = options.seed ?? 42;
  if (!(testSize > 0 && testSize < 1)) throw new NeurixDataError('INVALID_TEST_SIZE', 'trainTestSplit: testSize deve estar em (0, 1).');
  const rnd = mulberry32(seed);
  const groups = new Map<string, number[]>();
  rows.forEach((r, i) => {
    const k = options.stratify ? String(r[options.stratify]) : '';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(i);
  });
  const test: number[] = [];
  const train: number[] = [];
  // Ordem dos estratos fixa (lexicográfica) para reprodutibilidade.
  for (const k of [...groups.keys()].sort(compareStrings)) {
    const idx = shuffle(groups.get(k)!, rnd);
    const nTest = Math.round(idx.length * testSize);
    test.push(...idx.slice(0, nTest));
    train.push(...idx.slice(nTest));
  }
  train.sort((a, b) => a - b);
  test.sort((a, b) => a - b);
  return { train: train.map((i) => rows[i]!), test: test.map((i) => rows[i]!), train_indices: train, test_indices: test, seed };
}
