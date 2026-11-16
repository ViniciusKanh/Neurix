import type { Row } from '../src/index.js';

/** Congela profundamente — qualquer mutação lança TypeError em strict mode. */
export function deepFreeze<T>(o: T): T {
  if (o && typeof o === 'object') {
    Object.freeze(o);
    for (const v of Object.values(o as object)) deepFreeze(v);
  }
  return o;
}

/** Gerador congruencial linear determinístico (independente da biblioteca). */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Dataset sintético determinístico com ausentes e categorias. */
export function syntheticRows(n = 200, seed = 7): Row[] {
  const rnd = lcg(seed);
  const rows: Row[] = [];
  for (let i = 0; i < n; i++) {
    const idade = 18 + Math.floor(rnd() * 50);
    const renda = Math.round(1000 + rnd() * 9000);
    rows.push({
      id: i,
      idade: rnd() < 0.1 ? null : idade,
      renda: rnd() < 0.1 ? '' : renda,
      setor: ['TI', 'Saúde', 'Educação'][i % 3],
      alvo: renda > 5000 ? 1 : 0,
    });
  }
  return rows;
}
