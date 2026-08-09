/**
 * textMining.js — lightweight text mining over a text column.
 * Tokenization, PT/EN stopwords, term frequencies, TF-IDF, word-cloud sizing,
 * document stats and a small lexicon sentiment. Pure JS, browser-side.
 */

const STOPWORDS = new Set([
  // Portuguese
  'a', 'o', 'e', 'é', 'de', 'do', 'da', 'dos', 'das', 'em', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'uns', 'umas', 'para', 'por', 'com', 'sem', 'que', 'se', 'os', 'as', 'ao', 'aos', 'à', 'às', 'ou', 'como', 'mas', 'mais', 'menos', 'já', 'não', 'sim', 'ser', 'ter', 'foi', 'são', 'está', 'estão', 'seu', 'sua', 'seus', 'suas', 'meu', 'minha', 'este', 'esta', 'isso', 'isto', 'aquele', 'aquela', 'entre', 'sobre', 'até', 'depois', 'antes', 'quando', 'onde', 'porque', 'muito', 'muita', 'pouco', 'todo', 'toda', 'todos', 'todas', 'me', 'te', 'lhe', 'nós', 'eles', 'elas', 'ele', 'ela', 'eu', 'tu', 'você', 'vocês', 'nem', 'também', 'só', 'pela', 'pelo', 'num', 'numa', 'dele', 'dela',
  // English
  'the', 'a', 'an', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'without', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'this', 'that', 'these', 'those', 'it', 'its', 'as', 'by', 'from', 'up', 'down', 'out', 'so', 'than', 'then', 'too', 'very', 'can', 'will', 'just', 'not', 'no', 'yes', 'i', 'you', 'he', 'she', 'we', 'they', 'them', 'his', 'her', 'their', 'my', 'your', 'our', 'if', 'about', 'into', 'over', 'after', 'before', 'more', 'most', 'some', 'any', 'all', 'each', 'do', 'does', 'did', 'has', 'have', 'had',
]);

const POS = new Set(['bom', 'ótimo', 'otimo', 'excelente', 'maravilhoso', 'adorei', 'gostei', 'recomendo', 'perfeito', 'incrível', 'incrivel', 'satisfeito', 'rápido', 'rapido', 'eficiente', 'positivo', 'feliz', 'good', 'great', 'excellent', 'awesome', 'love', 'happy', 'best', 'wonderful', 'perfect', 'fast', 'nice']);
const NEG = new Set(['ruim', 'péssimo', 'pessimo', 'horrível', 'horrivel', 'odiei', 'detestei', 'lento', 'caro', 'problema', 'defeito', 'insatisfeito', 'negativo', 'triste', 'terrível', 'terrivel', 'bad', 'terrible', 'awful', 'hate', 'worst', 'slow', 'expensive', 'problem', 'broken', 'sad', 'poor']);

export function tokenize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

// Full analysis over all documents in a text column.
export function analyzeText(rows, column, { topN = 40 } = {}) {
  const docs = rows.map((r) => String(r[column] ?? '')).filter((t) => t.trim() !== '');
  if (docs.length < 2) return { error: true, message: 'São necessários ≥ 2 documentos com texto.' };

  const tokenized = docs.map(tokenize);
  const tf = {}; // global term freq
  const df = {}; // document freq
  tokenized.forEach((toks) => {
    const seen = new Set();
    toks.forEach((w) => { tf[w] = (tf[w] || 0) + 1; if (!seen.has(w)) { df[w] = (df[w] || 0) + 1; seen.add(w); } });
  });
  const N = docs.length;
  const vocab = Object.keys(tf);
  // corpus-level TF-IDF weight = tf * idf
  const tfidf = vocab.map((w) => ({ term: w, tf: tf[w], df: df[w], tfidf: Number((tf[w] * Math.log(N / df[w])).toFixed(3)) }));

  const topTerms = [...tfidf].sort((a, b) => b.tf - a.tf).slice(0, topN);
  const topTfidf = [...tfidf].sort((a, b) => b.tfidf - a.tfidf).slice(0, topN);

  // word-cloud sizing (12..44px) from term frequency
  const maxTf = Math.max(...topTerms.map((t) => t.tf), 1);
  const cloud = topTerms.map((t) => ({ term: t.term, tf: t.tf, size: Math.round(12 + (t.tf / maxTf) * 32) }));

  // document length distribution
  const lengths = tokenized.map((t) => t.length);
  const meanLen = lengths.reduce((s, v) => s + v, 0) / lengths.length;

  // lexicon sentiment
  let pos = 0, neg = 0, neu = 0;
  tokenized.forEach((toks) => { let p = 0, n = 0; toks.forEach((w) => { if (POS.has(w)) p++; if (NEG.has(w)) n++; }); if (p > n) pos++; else if (n > p) neg++; else neu++; });

  return {
    documents: N,
    vocabulary: vocab.length,
    total_tokens: Object.values(tf).reduce((s, v) => s + v, 0),
    avg_tokens_per_doc: Number(meanLen.toFixed(1)),
    top_terms: topTerms,
    top_tfidf: topTfidf,
    cloud,
    length_hist: buildHist(lengths, 12),
    sentiment: { positive: pos, negative: neg, neutral: neu, positive_pct: Number(((pos / N) * 100).toFixed(1)), negative_pct: Number(((neg / N) * 100).toFixed(1)) },
  };
}

function buildHist(vals, k) {
  if (!vals.length) return [];
  const mn = Math.min(...vals), mx = Math.max(...vals), step = (mx - mn) / k || 1;
  return Array.from({ length: k }, (_, i) => ({ faixa: Math.round(mn + i * step), n: vals.filter((v) => v >= mn + i * step && v < mn + (i + 1) * step).length }));
}
