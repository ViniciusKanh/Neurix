/**
 * sequentialMining.js — frequent sequential pattern mining.
 * Groups rows into sequences by an id column (optionally ordered by another
 * column), then counts frequent ordered pairs/triples across sequences.
 * Pure JS, browser-side.
 */

// Build ordered sequences: { [group]: [item, item, ...] }
function buildSequences(rows, idCol, itemCol, orderCol) {
  const seqs = {};
  const withIdx = rows.map((r, i) => ({ r, i }));
  if (orderCol) withIdx.sort((a, b) => {
    const x = a.r[orderCol], y = b.r[orderCol];
    const nx = parseFloat(x), ny = parseFloat(y);
    if (!isNaN(nx) && !isNaN(ny)) return nx - ny;
    return String(x ?? '').localeCompare(String(y ?? ''));
  });
  withIdx.forEach(({ r }) => {
    const g = String(r[idCol] ?? ''); const item = String(r[itemCol] ?? '');
    if (g === '' || item === '') return;
    (seqs[g] = seqs[g] || []).push(item);
  });
  return seqs;
}

// Mine frequent sequential patterns (length 2 and 3) by sequence support.
export function mineSequences(rows, idCol, itemCol, orderCol, { minSupport = 0.05, maxPatterns = 40 } = {}) {
  const seqObj = buildSequences(rows, idCol, itemCol, orderCol);
  const sequences = Object.values(seqObj).filter((s) => s.length >= 2);
  const nSeq = sequences.length;
  if (nSeq < 3) return { error: true, message: 'São necessárias ≥ 3 sequências (grupos com ≥ 2 itens).' };

  const minCount = Math.max(2, Math.ceil(minSupport * nSeq));

  // ordered pairs a->b (dedup per sequence: count each pattern once per sequence)
  const pairCount = {}, tripleCount = {};
  sequences.forEach((seq) => {
    const seenP = new Set(), seenT = new Set();
    for (let i = 0; i < seq.length - 1; i++) {
      for (let j = i + 1; j < seq.length; j++) {
        const key = seq[i] + ' → ' + seq[j];
        if (!seenP.has(key)) { pairCount[key] = (pairCount[key] || 0) + 1; seenP.add(key); }
        for (let k = j + 1; k < seq.length; k++) {
          const t = seq[i] + ' → ' + seq[j] + ' → ' + seq[k];
          if (!seenT.has(t)) { tripleCount[t] = (tripleCount[t] || 0) + 1; seenT.add(t); }
        }
      }
    }
  });

  const toList = (obj, size) => Object.entries(obj).filter(([, c]) => c >= minCount)
    .map(([pattern, count]) => ({ pattern, size, count, support: Number((count / nSeq).toFixed(4)) }))
    .sort((a, b) => b.count - a.count);

  const pairs = toList(pairCount, 2);
  const triples = toList(tripleCount, 3);
  const patterns = [...pairs, ...triples].sort((a, b) => b.support - a.support).slice(0, maxPatterns);

  const lens = sequences.map((s) => s.length);
  return {
    sequences: nSeq,
    avg_length: Number((lens.reduce((s, v) => s + v, 0) / nSeq).toFixed(2)),
    min_support: minSupport,
    min_count: minCount,
    patterns,
    top_pairs: pairs.slice(0, 15),
  };
}
