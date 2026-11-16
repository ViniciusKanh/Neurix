import { describe, expect, it } from 'vitest';
import { Imputer, imputeNulls, NeurixDataError, trainTestSplit, type ColumnInfo } from '../src/index.js';
import { deepFreeze, syntheticRows } from './helpers.js';

const CI: ColumnInfo[] = [
  { name: 'x', type: 'number' },
  { name: 'cat', type: 'string' },
];

describe('imputeNulls (atalho compatível)', () => {
  const rows = deepFreeze([
    { x: 1, cat: 'a' },
    { x: 2, cat: 'b' },
    { x: 10, cat: 'b' },
    { x: null, cat: '' },
    { x: '4', cat: 'a' },
  ]);

  it('mediana para numéricas (strings numéricas contam) e moda para categóricas', () => {
    const r = imputeNulls(rows, CI, 'median');
    // valores observados: 1, 2, 10, 4 → mediana 3
    expect(r.rows[3]).toEqual({ x: 3, cat: 'a' }); // empate a/b → primeira ocorrência ('a')
    expect(r.filled).toBe(2);
    expect(r.filled_by_column).toEqual({ x: 1, cat: 1 });
    expect(r.strategy).toBe('median');
  });

  it('média sem arredondamento', () => {
    const r = imputeNulls([{ x: 1 }, { x: 2 }, { x: 2 }, { x: null }], [{ name: 'x', type: 'number' }], 'mean');
    expect(r.rows[3]!.x).toBeCloseTo(5 / 3, 12);
  });

  it('não altera a entrada', () => {
    imputeNulls(rows, CI);
    expect(rows[3]!.x).toBeNull();
  });

  it('coluna totalmente vazia: mantém ausentes (não usa 0) e informa', () => {
    const r = imputeNulls([{ x: null }, { x: '' }], [{ name: 'x', type: 'number' }]);
    expect(r.rows.map((o) => o.x)).toEqual([null, '']);
    expect(r.skipped).toEqual([{ column: 'x', reason: 'empty_column' }]);
    expect(r.params.warnings[0]).toMatch(/sem valores observados/);
  });

  it('dataset vazio', () => {
    const r = imputeNulls([], CI);
    expect(r.rows).toEqual([]);
    expect(r.filled).toBe(0);
  });

  it('NaN é ausente; Infinity e "12abc" não são preenchidos nem usados no ajuste', () => {
    const r = imputeNulls([{ x: NaN }, { x: Infinity }, { x: '12abc' }, { x: 4 }, { x: 6 }], [{ name: 'x', type: 'number' }]);
    expect(r.rows.map((o) => o.x)).toEqual([5, Infinity, '12abc', 4, 6]);
  });

  it('coluna inexistente é ignorada no atalho', () => {
    const r = imputeNulls([{ x: 1 }], [{ name: 'nao_existe', type: 'number' }]);
    expect(r.skipped[0]).toEqual({ column: 'nao_existe', reason: 'missing_column' });
  });
});

describe('Imputer (fit/transform)', () => {
  it('valida estratégias', () => {
    expect(() => new Imputer({ numericStrategy: 'foo' as never })).toThrow(NeurixDataError);
    expect(() =>
      new Imputer({ columns: CI, perColumn: { cat: { strategy: 'mean' } } }).fit([{ x: 1, cat: 'a' }]),
    ).toThrow(/incompatível/);
    expect(() => new Imputer({ columns: CI, numericStrategy: 'constant' }).fit([{ x: 1, cat: 'a' }])).toThrow(/fillValue/);
  });

  it('erro em coluna inexistente (padrão) e em coluna vazia quando configurado', () => {
    expect(() => new Imputer({ columns: [{ name: 'z', type: 'number' }] }).fit([{ x: 1 }])).toThrow(/não existe/);
    expect(() => new Imputer({ columns: [{ name: 'x', type: 'number' }], onEmptyColumn: 'error' }).fit([{ x: null }])).toThrow(/não tem valores observados/);
  });

  it('transform antes de fit lança NOT_FITTED', () => {
    try {
      new Imputer().transform([]);
      throw new Error('não lançou');
    } catch (e) {
      expect((e as NeurixDataError).code).toBe('NOT_FITTED');
    }
  });

  it('constante e keep por coluna', () => {
    const imp = new Imputer({
      columns: CI,
      perColumn: { x: { strategy: 'constant', fillValue: -1 }, cat: { strategy: 'keep' } },
    });
    const r = imp.fitTransform([{ x: null, cat: null }]);
    expect(r.rows[0]).toEqual({ x: -1, cat: null });
  });

  it('SEM vazamento: estatística aprendida só no treino é aplicada no teste', () => {
    const train = [{ x: 1 }, { x: 2 }, { x: 3 }, { x: null }];
    const test = [{ x: 1000 }, { x: 2000 }, { x: null }];
    const imp = new Imputer({ columns: [{ name: 'x', type: 'number' }], numericStrategy: 'mean' }).fit(train);
    const before = imp.getParams();
    const out = imp.transform(test).rows;
    expect(out[2]!.x).toBe(2); // média do TREINO, não do teste (1500)
    expect(imp.getParams()).toEqual(before); // transform não reajusta
  });

  it('parâmetros persistidos reproduzem o mesmo resultado', () => {
    const rows = syntheticRows(150);
    const { train, test } = trainTestSplit(rows, { seed: 1 });
    const cols: ColumnInfo[] = [{ name: 'idade', type: 'int' }, { name: 'renda', type: 'number' }, { name: 'setor', type: 'string' }];
    const imp = new Imputer({ columns: cols }).fit(train);
    const json = JSON.stringify(imp.getParams());
    const restored = Imputer.fromParams(JSON.parse(json));
    expect(restored.transform(test).rows).toEqual(imp.transform(test).rows);
    expect(() => Imputer.fromParams({ kind: 'x' } as never)).toThrow(/inválidos/);
  });
});

describe('trainTestSplit', () => {
  const rows = syntheticRows(100);
  it('é reprodutível com a mesma semente e disjunto', () => {
    const a = trainTestSplit(rows, { seed: 3, testSize: 0.25 });
    const b = trainTestSplit(rows, { seed: 3, testSize: 0.25 });
    expect(a.test_indices).toEqual(b.test_indices);
    expect(a.test.length).toBe(25);
    expect(new Set([...a.train_indices, ...a.test_indices]).size).toBe(100);
    expect(trainTestSplit(rows, { seed: 4 }).test_indices).not.toEqual(a.test_indices);
  });
  it('estratificação preserva proporções', () => {
    const r = trainTestSplit(rows, { seed: 1, stratify: 'setor', testSize: 0.3 });
    const prop = (rs: typeof rows, s: string) => rs.filter((x) => x.setor === s).length / rs.length;
    expect(Math.abs(prop(r.test, 'TI') - prop(rows, 'TI'))).toBeLessThan(0.05);
  });
  it('valida testSize', () => {
    expect(() => trainTestSplit(rows, { testSize: 1 })).toThrow(NeurixDataError);
  });
});
