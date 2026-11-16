import { describe, expect, it } from 'vitest';
import {
  analyzeQuality,
  coerceTypes,
  countDuplicates,
  dropDuplicates,
  findDuplicates,
  isMissing,
  NeurixDataError,
  parseNumber,
  type ColumnInfo,
} from '../src/index.js';
import { deepFreeze } from './helpers.js';

const CI: ColumnInfo[] = [
  { name: 'a', type: 'number' },
  { name: 'b', type: 'string' },
  { name: 'c', type: 'number' },
];

describe('isMissing / parseNumber', () => {
  it('política de ausência documentada', () => {
    for (const v of [undefined, null, '', '   ', NaN]) expect(isMissing(v)).toBe(true);
    for (const v of [0, 'x', false, Infinity, '0']) expect(isMissing(v)).toBe(false);
  });

  it('aceita inteiros, decimais, sinal e expoente', () => {
    expect(parseNumber('42')).toEqual({ status: 'valid', value: 42 });
    expect(parseNumber(' -3.5 ')).toEqual({ status: 'valid', value: -3.5 });
    expect(parseNumber('.5')).toEqual({ status: 'valid', value: 0.5 });
    expect(parseNumber('1e3')).toEqual({ status: 'valid', value: 1000 });
    expect(parseNumber(7)).toEqual({ status: 'valid', value: 7 });
  });

  it('rejeita strings parcialmente numéricas e não finitos', () => {
    for (const v of ['12abc', '1.2.3', 'abc', '1 000', 'Infinity', '0x10', Infinity, -Infinity, true]) {
      expect(parseNumber(v).status).toBe('invalid');
    }
  });

  it('separador decimal: auto, vírgula e ponto', () => {
    expect(parseNumber('3,5')).toEqual({ status: 'valid', value: 3.5 });
    expect(parseNumber('1.234,56').status).toBe('invalid'); // milhar não suportado
    expect(parseNumber('1,2,3').status).toBe('invalid');
    expect(parseNumber('3,5', { decimalSeparator: '.' }).status).toBe('invalid');
    expect(parseNumber('3.5', { decimalSeparator: ',' }).status).toBe('invalid');
    expect(parseNumber('3,5', { decimalSeparator: ',' })).toEqual({ status: 'valid', value: 3.5 });
  });
});

describe('analyzeQuality', () => {
  const rows = deepFreeze([
    { a: 1, b: 'x', c: 10 },
    { a: 2, b: 'y', c: 20 },
    { a: '', b: 'x', c: 30 },
    { a: 2, b: 'y', c: 20 },
    { a: 4, b: '', c: 'abc' },
  ]);

  it('conta ausentes, duplicatas, erros de tipo e cardinalidade', () => {
    const q = analyzeQuality(rows, CI);
    expect(q.rows).toBe(5);
    expect(q.columns_count).toBe(3);
    expect(q.duplicates).toBe(1);
    expect(q.total_nulls).toBe(2);
    const a = q.columns.find((c) => c.name === 'a')!;
    expect(a.nulls).toBe(1);
    expect(a.null_pct).toBe(20);
    expect(a.unique).toBe(3);
    const c = q.columns.find((c) => c.name === 'c')!;
    expect(c.type_mismatch).toBe(1);
    expect(q.issues).toBe(3 + 1);
    expect(q.issue_list.map((i) => i.code)).toEqual(expect.arrayContaining(['missing_values', 'type_mismatch', 'duplicate_rows']));
    expect(JSON.parse(JSON.stringify(q))).toEqual(q); // serializável
  });

  it('dataset vazio não gera NaN', () => {
    const q = analyzeQuality([], CI);
    expect(q.rows).toBe(0);
    expect(q.columns.every((c) => c.null_pct === 0 && c.cardinality_ratio === 0)).toBe(true);
    expect(q.duplicates).toBe(0);
  });

  it('coluna totalmente ausente e coluna constante', () => {
    const q = analyzeQuality([{ a: null, b: 'k' }, { a: '', b: 'k' }], [{ name: 'a', type: 'number' }, { name: 'b' }]);
    expect(q.columns[0]!.all_missing).toBe(true);
    expect(q.columns[1]!.constant).toBe(true);
    expect(q.issue_list.map((i) => i.code)).toEqual(expect.arrayContaining(['all_missing', 'constant_column']));
  });

  it('sem columnInfo infere colunas (antes: toda linha virava duplicata)', () => {
    const q = analyzeQuality([{ x: 1 }, { x: 2 }, { x: 3 }]);
    expect(q.duplicates).toBe(0);
    expect(q.columns[0]!.numeric).toBe(true);
  });

  it('valida a entrada', () => {
    expect(() => analyzeQuality('x' as never, CI)).toThrow(NeurixDataError);
    expect(() => analyzeQuality([1 as never], CI)).toThrow(/não é um objeto/);
  });
});

describe('duplicatas — chave estruturada', () => {
  it('não colide ao concatenar valores (bug da versão original)', () => {
    const rows = [{ a: 'ab', b: 'c' }, { a: 'a', b: 'bc' }];
    expect(countDuplicates(rows)).toBe(0);
  });

  it('preserva tipo: 1 ≠ "1", true ≠ "true"; 0 = -0', () => {
    expect(countDuplicates([{ v: 1 }, { v: '1' }])).toBe(0);
    expect(countDuplicates([{ v: true }, { v: 'true' }])).toBe(0);
    expect(countDuplicates([{ v: 0 }, { v: -0 }])).toBe(1);
  });

  it('ordem das propriedades não importa', () => {
    expect(countDuplicates([{ a: 1, b: 2 }, { b: 2, a: 1 }])).toBe(1);
  });

  it('ausentes iguais por padrão; distintos com treatMissingAsEqual=false', () => {
    const rows = [{ v: null }, { v: undefined }, { v: '' }, { v: NaN }, {}];
    expect(countDuplicates(rows)).toBe(4);
    expect(countDuplicates(rows, undefined, { treatMissingAsEqual: false })).toBe(1); // {v: undefined} ≡ {}
  });

  it('Infinity, -Infinity e NaN são distintos', () => {
    expect(countDuplicates([{ v: Infinity }, { v: -Infinity }, { v: NaN }], undefined, { treatMissingAsEqual: false })).toBe(0);
  });

  it('dropDuplicates mantém a primeira ocorrência e não modifica a entrada', () => {
    const rows = deepFreeze([{ a: 1 }, { a: 2 }, { a: 1 }, { a: 2 }, { a: 3 }]);
    const r = dropDuplicates(rows, [{ name: 'a' }]);
    expect(r.rows).toEqual([{ a: 1 }, { a: 2 }, { a: 3 }]);
    expect(r.removed).toBe(2);
    expect(r.removed_indices).toEqual([2, 3]);
    expect(findDuplicates(rows)).toEqual([2, 3]);
    expect(rows.length).toBe(5);
  });

  it('compara apenas as colunas informadas', () => {
    expect(countDuplicates([{ a: 1, b: 1 }, { a: 1, b: 2 }], [{ name: 'a' }])).toBe(1);
  });
});

describe('coerceTypes', () => {
  it('converte strings numéricas válidas e não aceita "12abc"', () => {
    const rows = deepFreeze([{ a: '3', b: 'z', c: '5,5' }, { a: '12abc', b: 'w', c: 7 }]);
    const r = coerceTypes(rows, CI);
    expect(r.rows[0]).toEqual({ a: 3, b: 'z', c: 5.5 });
    expect(r.rows[1]!.a).toBe('12abc'); // mantido, não vira 12 nem 0
    expect(r.coerced).toBe(2);
    expect(r.invalid).toBe(1);
    expect(r.invalid_by_column).toEqual({ a: 1 });
    expect(r.invalid_samples).toEqual({ a: ['12abc'] });
  });

  it('onInvalid=null substitui inválidos por null (nunca zero)', () => {
    const r = coerceTypes([{ a: 'xyz' }, { a: Infinity }], [{ name: 'a', type: 'number' }], { onInvalid: 'null' });
    expect(r.rows.map((x) => x.a)).toEqual([null, null]);
  });

  it('ausentes permanecem inalterados', () => {
    const r = coerceTypes([{ a: '' }, { a: null }], [{ name: 'a', type: 'number' }]);
    expect(r.rows).toEqual([{ a: '' }, { a: null }]);
    expect(r.coerced + r.invalid).toBe(0);
  });
});
