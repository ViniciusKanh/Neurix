import { describe, it, expect } from 'vitest';
import { tokenize, analyzeText } from '../src/lib/textMining.js';
import { mineSequences } from '../src/lib/sequentialMining.js';
import { concatDatasets, joinDatasets } from '../src/lib/blend.js';

describe('textMining', () => {
  it('tokenize drops stopwords and short tokens', () => {
    const t = tokenize('O produto é muito bom e rápido');
    expect(t).toContain('produto'); expect(t).toContain('rápido');
    expect(t).not.toContain('é'); expect(t).not.toContain('muito');
  });
  it('analyzeText computes top terms, tfidf and sentiment', () => {
    const docs = [
      { t: 'produto excelente adorei recomendo muito bom' },
      { t: 'péssimo horrível odiei o produto lento' },
      { t: 'produto bom rápido e eficiente gostei' },
      { t: 'entrega lenta mas produto ok' },
      { t: 'excelente atendimento recomendo demais' },
    ];
    const r = analyzeText(docs, 't', { topN: 10 });
    expect(r.error).toBeFalsy();
    expect(r.documents).toBe(5);
    expect(r.top_terms[0].term).toBe('produto');
    expect(r.cloud.length).toBeGreaterThan(0);
    expect(r.sentiment.positive).toBeGreaterThan(r.sentiment.negative);
  });
  it('requires at least 2 documents', () => {
    expect(analyzeText([{ t: 'só um' }], 't').error).toBe(true);
  });
});

describe('sequentialMining', () => {
  const rows = [];
  const journeys = { c1: ['home', 'busca', 'produto', 'carrinho', 'compra'], c2: ['home', 'produto', 'carrinho', 'compra'], c3: ['home', 'busca', 'produto', 'sair'], c4: ['home', 'produto', 'carrinho', 'compra'] };
  Object.entries(journeys).forEach(([id, items]) => items.forEach((it, i) => rows.push({ cliente: id, ordem: i, pagina: it })));
  it('finds frequent ordered patterns with support', () => {
    const r = mineSequences(rows, 'cliente', 'pagina', 'ordem', { minSupport: 0.5 });
    expect(r.error).toBeFalsy();
    expect(r.sequences).toBe(4);
    const homeProduto = r.patterns.find((p) => p.pattern === 'home → produto');
    expect(homeProduto).toBeTruthy();
    expect(homeProduto.support).toBe(1);
  });
  it('needs at least 3 sequences', () => {
    const r = mineSequences([{ g: 'a', i: 'x' }, { g: 'a', i: 'y' }], 'g', 'i', null);
    expect(r.error).toBe(true);
  });
});

describe('blend', () => {
  const A = [{ id: 1, nome: 'a' }, { id: 2, nome: 'b' }, { id: 3, nome: 'c' }];
  const B = [{ id: 1, score: 10 }, { id: 2, score: 20 }];
  it('concatenates with column union', () => {
    const r = concatDatasets(A, B);
    expect(r.rows.length).toBe(5);
    expect(r.columns).toEqual(expect.arrayContaining(['id', 'nome', 'score']));
  });
  it('left join keeps all A rows, filling misses', () => {
    const r = joinDatasets(A, B, 'id', 'id', 'left');
    expect(r.rows.length).toBe(3); expect(r.matched).toBe(2);
    expect(r.rows[2].score).toBe('');
  });
  it('inner join keeps only matches', () => {
    const r = joinDatasets(A, B, 'id', 'id', 'inner');
    expect(r.rows.length).toBe(2);
  });
  it('renames colliding columns with _b', () => {
    const r = joinDatasets([{ id: 1, v: 'x' }], [{ id: 1, v: 'y' }], 'id', 'id', 'left');
    expect(r.columns).toContain('v_b'); expect(r.rows[0].v).toBe('x'); expect(r.rows[0].v_b).toBe('y');
  });
});
