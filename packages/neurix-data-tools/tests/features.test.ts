import { describe, expect, it } from 'vitest';
import {
  Binner,
  binningColumn,
  compileFormula,
  deriveColumn,
  inferColumns,
  LabelEncoder,
  labelEncodeColumn,
  logColumn,
  NeurixDataError,
  OneHotEncoder,
  oneHotColumn,
  Scaler,
  scaleColumn,
} from '../src/index.js';
import { deepFreeze } from './helpers.js';

const ev = (f: string, row = {}) => compileFormula(f)(row);

describe('compileFormula — precedência, associatividade e unário', () => {
  it.each([
    ['1 + 2 * 3', 7],
    ['(1 + 2) * 3', 9],
    ['8 / 4 / 2', 1], // esquerda
    ['10 - 4 - 3', 3], // esquerda
    ['2 ^ 3 ^ 2', 512], // direita
    ['-2 ^ 2', -4], // unário abaixo de ^
    ['2 ^ -1', 0.5],
    ['--3', 3],
    ['+3 - -2', 5],
    ['7 % 4 * 2', 6],
    ['log(100) + ln(1)', 2],
    ['min(3, 1, 2) + max(4, 9)', 10],
    ['sqrt(16) * abs(-2)', 8],
    ['1.5e2 / 3', 50],
  ])('%s = %d', (f, expected) => {
    expect(ev(f)).toBeCloseTo(expected as number, 12);
  });

  it('colunas, nomes com espaços, acentos e colchetes', () => {
    const row = { a: 10, b: '2', 'renda mensal': 3000, idade_média: 30, 'cat=x': 1, 'valor (R$)': 5 };
    expect(ev('a / b', row)).toBe(5);
    expect(ev('renda mensal / 1000', row)).toBe(3);
    expect(ev('idade_média * 2', row)).toBe(60);
    expect(ev('[cat=x] + [valor (R$)]', row)).toBe(6);
    expect(compileFormula('a * b + [cat=x]').columns).toEqual(['a', 'b', 'cat=x']);
  });

  it('divisão por zero, ausentes e domínio inválido → null (não 0)', () => {
    expect(ev('a / b', { a: 1, b: 0 })).toBeNull();
    expect(ev('a % b', { a: 1, b: 0 })).toBeNull();
    expect(ev('a + 1', { a: null })).toBeNull();
    expect(ev('a + 1', {})).toBeNull();
    expect(ev('a + 1', { a: '12abc' })).toBeNull();
    expect(ev('log(a)', { a: 0 })).toBeNull();
    expect(ev('sqrt(a)', { a: -1 })).toBeNull();
  });

  it.each([
    ['', /vazia/],
    ['1 +', /incompleta/],
    ['(1 + 2', /Esperado "\)"/],
    ['1 + 2)', /inesperado/],
    ['foo(1)', /desconhecida/],
    ['sqrt(1, 2)', /argumento/],
    ['max()', /argumento/],
    ['1.2.3', /Número inválido/],
    ['2x', /Número inválido/],
    ['a & b', /Caractere inválido/],
    ['[abc', /Colchete/],
  ])('rejeita expressão inválida: %s', (f, re) => {
    expect(() => compileFormula(f)).toThrow(re);
  });

  it('valida colunas conhecidas quando informadas', () => {
    expect(() => compileFormula('a + zz', { knownColumns: ['a'] })).toThrow(/zz/);
  });

  it('não usa eval/new Function (expressões maliciosas são erro de sintaxe)', () => {
    expect(() => compileFormula('constructor.constructor("return 1")()')).toThrow(NeurixDataError);
    expect(() => compileFormula('process.exit(1)')).toThrow(NeurixDataError);
  });
});

describe('transformações funcionais compatíveis', () => {
  const rows = deepFreeze([
    { a: 10, b: 2, cat: 'x' },
    { a: 20, b: 4, cat: 'y' },
    { a: 30, b: 5, cat: 'x' },
  ]);

  it('deriveColumn', () => {
    const r = deriveColumn(rows, 'razao', 'a / b');
    expect(r.rows.map((x) => x.razao)).toEqual([5, 5, 6]);
    expect(r.added).toEqual(['razao']);
    expect(() => deriveColumn(rows, ' ', 'a')).toThrow();
  });

  it('oneHotColumn / labelEncodeColumn', () => {
    const oh = oneHotColumn(rows, 'cat');
    expect(oh.added).toEqual(['cat=x', 'cat=y']);
    expect(oh.rows[1]).toMatchObject({ 'cat=x': 0, 'cat=y': 1 });
    const le = labelEncodeColumn(rows, 'cat');
    expect(le.rows.map((x) => x.cat_cod)).toEqual([0, 1, 0]);
  });

  it('scaleColumn z-score (populacional) e min-max', () => {
    const z = scaleColumn(rows, 'a', 'zscore').rows.map((x) => x.a_norm as number);
    // média 20, σ populacional = sqrt(200/3)
    expect(z[0]).toBeCloseTo(-10 / Math.sqrt(200 / 3), 12);
    const mm = scaleColumn(rows, 'a', 'minmax').rows.map((x) => x.a_norm);
    expect(mm).toEqual([0, 0.5, 1]);
    expect(scaleColumn([{ a: 'x' }], 'a').added).toEqual([]);
  });

  it('logColumn: log1p, negativos → null', () => {
    const r = logColumn([{ a: 0 }, { a: Math.E - 1 }, { a: -1 }, { a: null }], 'a');
    expect(r.rows.map((x) => x.a_log)).toEqual([0, 1, null, null]);
  });

  it('binningColumn mantém nomes compatíveis', () => {
    const r = binningColumn(rows, 'a', 3, 'width');
    expect(r.added).toEqual(['a_faixa']);
    expect(r.rows.map((x) => x.a_faixa)).toEqual(['faixa_1', 'faixa_2', 'faixa_3']);
  });

  it('inferColumns usa a regra estrita', () => {
    const c = inferColumns([{ n: '1', s: '12abc', v: null }, { n: 2.5, s: 3, v: '' }]);
    expect(c).toEqual([
      { name: 'n', type: 'number', numeric: true },
      { name: 's', type: 'string', numeric: false },
      { name: 'v', type: 'string', numeric: false },
    ]);
  });
});

describe('Scaler', () => {
  it('ajuste no treino, aplicação no teste (sem reajuste, sem corte)', () => {
    const s = new Scaler({ column: 'x', method: 'minmax' }).fit([{ x: 0 }, { x: 10 }]);
    expect(s.transform([{ x: 20 }, { x: -10 }, { x: null }]).map((r) => r.x_norm)).toEqual([2, -1, null]);
    expect(s.getParams()).toMatchObject({ min: 0, max: 10, constant: false });
  });

  it('desvio amostral com ddof=1', () => {
    const s = new Scaler({ column: 'x', ddof: 1 }).fit([{ x: 1 }, { x: 2 }, { x: 3 }]);
    expect(s.getParams().std).toBeCloseTo(1, 12);
  });

  it('coluna constante → 0 e sinalizada', () => {
    const s = new Scaler({ column: 'x' }).fit([{ x: 5 }, { x: 5 }]);
    expect(s.getParams().constant).toBe(true);
    expect(s.transform([{ x: 5 }, { x: 7 }]).map((r) => r.x_norm)).toEqual([0, 0]);
  });

  it('erros: sem valores, método inválido, não ajustado', () => {
    expect(() => new Scaler({ column: 'x' }).fit([{ x: null }])).toThrow(/sem valores/);
    expect(() => new Scaler({ column: 'x', method: 'robust' as never })).toThrow(/inválido/);
    expect(() => new Scaler({ column: 'x' }).transform([])).toThrow(/fit/);
  });

  it('fromParams reproduz', () => {
    const s = new Scaler({ column: 'x' }).fit([{ x: 1 }, { x: 3 }]);
    const s2 = Scaler.fromParams(JSON.parse(JSON.stringify(s.getParams())));
    expect(s2.transform([{ x: 4 }])).toEqual(s.transform([{ x: 4 }]));
  });
});

describe('Binner', () => {
  it('largura igual com faixas fechadas à direita', () => {
    const b = new Binner({ column: 'x', bins: 2 }).fit([{ x: 0 }, { x: 10 }]);
    expect(b.getParams().edges).toEqual([5]);
    expect(b.transform([{ x: 5 }, { x: 5.0001 }]).map((r) => r.x_faixa)).toEqual(['faixa_1', 'faixa_2']);
  });

  it('quantis com valores repetidos removem limites coincidentes', () => {
    const rows = [1, 1, 1, 1, 1, 1, 2, 3].map((x) => ({ x }));
    const p = new Binner({ column: 'x', bins: 4, method: 'quantile' }).fit(rows).getParams();
    expect(p.effective_bins).toBeLessThan(4);
    expect(new Set(p.edges).size).toBe(p.edges.length);
    expect(p.warnings.length).toBe(1);
  });

  it('quantis distribuem frequências aproximadamente iguais', () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ x: i }));
    const out = new Binner({ column: 'x', bins: 4, method: 'freq' }).fitTransform(rows);
    const counts: Record<string, number> = {};
    out.forEach((r) => { counts[r.x_faixa as string] = (counts[r.x_faixa as string] ?? 0) + 1; });
    expect(Object.values(counts)).toEqual([25, 25, 25, 25]);
  });

  it('valores fora do intervalo: clip (padrão) ou null', () => {
    const rows = [{ x: 0 }, { x: 10 }];
    expect(new Binner({ column: 'x', bins: 2 }).fit(rows).transform([{ x: -5 }, { x: 99 }]).map((r) => r.x_faixa)).toEqual(['faixa_1', 'faixa_2']);
    expect(new Binner({ column: 'x', bins: 2, outOfRange: 'null' }).fit(rows).transform([{ x: -5 }]).map((r) => r.x_faixa)).toEqual([null]);
  });

  it('número de faixas inválido e coluna constante', () => {
    for (const k of [0, -1, 2.5, NaN]) expect(() => new Binner({ column: 'x', bins: k })).toThrow(/bins/);
    const p = new Binner({ column: 'x', bins: 3 }).fit([{ x: 4 }, { x: 4 }]).getParams();
    expect(p.effective_bins).toBe(1);
  });
});

describe('OneHotEncoder / LabelEncoder', () => {
  const train = [{ c: 'b' }, { c: 'a' }, { c: 'b' }, { c: 'c' }, { c: 'a' }];

  it('ordem determinística: frequência desc, empate lexicográfico', () => {
    const p = new OneHotEncoder({ column: 'c' }).fit(train).getParams();
    expect(p.categories).toEqual(['a', 'b', 'c']);
    expect(new OneHotEncoder({ column: 'c', topK: 1 }).fit(train).getParams().categories).toEqual(['a']);
  });

  it('categoria desconhecida no teste: zeros (ignore) ou erro; não reajusta', () => {
    const e = new OneHotEncoder({ column: 'c' }).fit(train);
    const out = e.transform([{ c: 'z' }, { c: null }]);
    expect(out[0]).toEqual({ c: 'z', 'c=a': 0, 'c=b': 0, 'c=c': 0 });
    expect(out[1]).toEqual({ c: null, 'c=a': 0, 'c=b': 0, 'c=c': 0 });
    expect(e.getParams().categories).toEqual(['a', 'b', 'c']);
    expect(() => new OneHotEncoder({ column: 'c', handleUnknown: 'error' }).fit(train).transform([{ c: 'z' }])).toThrow(/desconhecida/);
    expect(new OneHotEncoder({ column: 'c', handleMissing: 'null' }).fit(train).transform([{}])[0]!['c=a']).toBeNull();
  });

  it('LabelEncoder preserva o mapeamento e trata desconhecidos', () => {
    const e = new LabelEncoder({ column: 'c' }).fit(train);
    expect(e.getParams().categories).toEqual(['a', 'b', 'c']);
    expect(e.transform([{ c: 'c' }, { c: 'z' }, { c: '' }]).map((r) => r.c_cod)).toEqual([2, null, null]);
    expect(() => new LabelEncoder({ column: 'c', handleUnknown: 'error' }).fit(train).transform([{ c: 'z' }])).toThrow();
    const r = LabelEncoder.fromParams(e.getParams());
    expect(r.transform([{ c: 'b' }])[0]!.c_cod).toBe(1);
  });
});
