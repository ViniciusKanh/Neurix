import { describe, expect, it } from 'vitest';
import { detectTargetLeakage } from '../src/index.js';
import { deepFreeze, lcg } from './helpers.js';

describe('detectTargetLeakage (heurístico)', () => {
  const rnd = lcg(5);
  const ci = [
    { name: 'renda', type: 'number' },
    { name: 'copia', type: 'int' },
    { name: 'quase', type: 'number' },
    { name: 'regiao_leak', type: 'string' },
    { name: 'regiao', type: 'string' },
    { name: 'alvo', type: 'int' },
  ];
  const rows = deepFreeze(
    Array.from({ length: 200 }, (_, i) => {
      const y = i % 2;
      return {
        renda: 1000 + rnd() * 9000,
        copia: y,
        quase: y === 1 ? 100 + rnd() : rnd(),
        regiao_leak: y === 1 ? 'SIM' : 'NAO',
        regiao: ['N', 'S', 'L'][i % 3],
        alvo: y,
      };
    }),
  );

  it('classificação: cópia, separador por limiar e pureza categórica', () => {
    const r = detectTargetLeakage(rows, 'alvo', ci, 'classification');
    const by = Object.fromEntries(r.leaks.map((l) => [l.feature, l.signal]));
    expect(by).toEqual({ copia: 'near_copy', quase: 'threshold_separation', regiao_leak: 'category_purity' });
    expect(r.has_suspects).toBe(true);
    expect(r.heuristic).toBe(true);
    expect(r.disclaimer).toMatch(/não comprovam/);
    expect(r.target_kind).toBe('categorical');
    r.leaks.forEach((l) => {
      expect(l.reason.length).toBeGreaterThan(0);
      expect(Object.keys(l.metrics).length).toBeGreaterThan(0);
    });
  });

  it('regressão: correlação alta e associação categórica (η²)', () => {
    const rr = Array.from({ length: 120 }, (_, i) => ({
      x: rnd() * 10,
      alvo: i * 2,
      quase: i * 6 + 1,
      grupo: i < 60 ? 'baixo' : 'alto',
      faixa: `f${Math.floor(i / 10)}`, // 12 categorias que determinam o alvo quase totalmente
    }));
    const r = detectTargetLeakage(rr, 'alvo', [
      { name: 'x', type: 'number' },
      { name: 'quase', type: 'number' },
      { name: 'grupo', type: 'string' },
      { name: 'faixa', type: 'string' },
      { name: 'alvo', type: 'number' },
    ], 'regression');
    const feats = r.leaks.map((l) => l.feature);
    expect(feats).toContain('quase');
    expect(feats).toContain('faixa');
    expect(feats).not.toContain('x');
    expect(feats).not.toContain('grupo'); // η² = 0.75 < 0.96
    expect(r.leaks.find((l) => l.feature === 'faixa')!.metrics.eta_squared).toBeGreaterThan(0.96);
  });

  it('identificadores não são sinalizados por pureza', () => {
    const rr = Array.from({ length: 50 }, (_, i) => ({ id: `u${i}`, alvo: i % 2 }));
    expect(detectTargetLeakage(rr, 'alvo', [{ name: 'id', type: 'string' }, { name: 'alvo', type: 'int' }], 'classification').leaks).toEqual([]);
  });

  it('entradas vazias', () => {
    const r = detectTargetLeakage([], 'alvo', ci);
    expect(r).toMatchObject({ has_leak: false, leaks: [], analyzed_rows: 0 });
    expect(detectTargetLeakage(rows, '', ci).leaks).toEqual([]);
  });

  it('é determinístico', () => {
    const a = detectTargetLeakage(rows, 'alvo', ci, 'classification');
    const b = detectTargetLeakage(rows, 'alvo', ci, 'classification');
    expect(a).toEqual(b);
  });
});
