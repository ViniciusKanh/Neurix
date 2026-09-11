import { queryOne, run } from './db.js';

// Gemini config lives in the `settings` table under key 'gemini' as JSON:
// { enabled, api_key, model }. The api_key never leaves the server.
const KEY = 'gemini';
export const GEMINI_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro'];

export async function getGeminiConfig() {
  const row = await queryOne('SELECT value FROM settings WHERE key = ?', [KEY]);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

export async function saveGeminiConfig(cfg) {
  const existing = await getGeminiConfig();
  let apiKey = (cfg.api_key || '').trim();
  // keep stored key if the client sent the masked placeholder or blank
  if ((!apiKey || apiKey === '••••••••') && existing?.api_key) apiKey = existing.api_key;
  const clean = {
    enabled: !!cfg.enabled,
    model: GEMINI_MODELS.includes(cfg.model) ? cfg.model : 'gemini-2.0-flash',
    api_key: apiKey,
  };
  await run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [KEY, JSON.stringify(clean)]
  );
  return clean;
}

// Config safe to send to the client (key masked, never the real value).
export function maskGeminiConfig(cfg) {
  if (!cfg) return { enabled: false, model: 'gemini-2.0-flash', configured: false, api_key: '' };
  return { enabled: !!cfg.enabled, model: cfg.model || 'gemini-2.0-flash', configured: !!cfg.api_key, api_key: cfg.api_key ? '••••••••' : '' };
}

const SUPPORTED_TRANSFORMS = 'formula | binning | onehot | label | scale | log';

function buildPrompt(profile) {
  const cols = (profile.columns || []).map((c) => {
    const parts = [`- ${c.name} (${c.type}${c.role ? `, ${c.role}` : ''})`, `nulos ${c.null_pct}%`, `únicos ${c.unique}`];
    if (c.numeric) parts.push(`min ${c.min}`, `max ${c.max}`, `média ${c.mean}`);
    else if (c.top) parts.push(`top: ${c.top.map((t) => `${t.value}(${t.count})`).join(', ')}`);
    return parts.join(' · ');
  }).join('\n');
  const sample = JSON.stringify((profile.sample || []).slice(0, 12));

  return `Você é um especialista em mineração de dados e engenharia de atributos (feature engineering).
Analise o dataset descrito abaixo e proponha melhorias de PRÉ-PROCESSAMENTO e NOVAS FEATURES.

Contexto do dataset:
- Linhas: ${profile.rows}
- Coluna-alvo sugerida pelo usuário: ${profile.target || 'não informada'}
- Tarefa pretendida: ${profile.task || 'não informada'}

Colunas:
${cols}

Amostra (até 12 linhas): ${sample}

Regras OBRIGATÓRIAS para as features sugeridas:
- Use SOMENTE os nomes de colunas existentes acima.
- "transform" deve ser um de: ${SUPPORTED_TRANSFORMS}.
- Para transform="formula": preencha "formula" usando APENAS os operadores + - * / % ^ ( ) e as funções log, ln, sqrt, abs, exp, min, max, com nomes de colunas. Ex.: "renda / (idade + 1)".
- Para transform diferente de formula: preencha "source_column" com a coluna de origem. Em "binning" use params {"bins": N, "method": "width|freq"}; em "scale" use params {"method": "zscore|minmax"}.
- Proponha de 3 a 8 features realmente úteis, cada uma com justificativa curta e benefício esperado.
- Escreva tudo em português do Brasil. Não invente colunas nem valores.`;
}

const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    dataset_summary: { type: 'string' },
    quality_issues: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, severity: { type: 'string', enum: ['alto', 'médio', 'baixo'] }, action: { type: 'string' } }, required: ['issue', 'action'] } },
    recommended_tasks: { type: 'array', items: { type: 'object', properties: { task: { type: 'string' }, target: { type: 'string' }, reason: { type: 'string' } }, required: ['task', 'reason'] } },
    suggested_features: { type: 'array', items: { type: 'object', properties: {
      name: { type: 'string' }, rationale: { type: 'string' }, expected_benefit: { type: 'string' },
      transform: { type: 'string', enum: ['formula', 'binning', 'onehot', 'label', 'scale', 'log'] },
      formula: { type: 'string' }, source_column: { type: 'string' },
      params: { type: 'object', properties: { bins: { type: 'integer' }, method: { type: 'string' } } },
    }, required: ['name', 'transform', 'rationale'] } },
  },
  required: ['dataset_summary', 'suggested_features'],
};

// Calls Gemini generateContent with structured JSON output.
export async function callGeminiAnalyze(profile) {
  const cfg = await getGeminiConfig();
  if (!cfg || !cfg.api_key) { const e = new Error('Gemini não configurado. Um administrador deve cadastrar a chave em Configurações → IA.'); e.code = 'NO_KEY'; throw e; }
  if (!cfg.enabled) { const e = new Error('A integração com o Gemini está desativada. Ative em Configurações → IA.'); e.code = 'DISABLED'; throw e; }

  const model = cfg.model || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cfg.api_key)}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: buildPrompt(profile) }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  };
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { const j = await resp.json(); msg = j?.error?.message || msg; } catch { /* ignore */ }
    const e = new Error(`Falha na API do Gemini: ${msg}`); e.status = resp.status; throw e;
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const parsed = parseJson(text);
  if (!parsed) throw new Error('Resposta do Gemini não pôde ser interpretada como JSON.');
  return { model, ...parsed };
}

// Minimal ping to validate a candidate key/model (used by the test button).
export async function pingGemini(apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-2.0-flash'}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'ping' }] }], generationConfig: { maxOutputTokens: 5 } }) });
  if (!resp.ok) { let msg = `HTTP ${resp.status}`; try { const j = await resp.json(); msg = j?.error?.message || msg; } catch { /* */ } throw new Error(msg); }
  return true;
}

function parseJson(text) {
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* try to strip markdown fences */ }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch { /* */ } }
  return null;
}
