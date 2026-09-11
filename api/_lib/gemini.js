import { queryOne, run } from './db.js';

// Gemini config lives in the `settings` table under key 'gemini' as JSON:
// { enabled, api_key, model }. The api_key never leaves the server.
const KEY = 'gemini';
export const DEFAULT_MODEL = 'gemini-3.6-flash';
// Convenience suggestions for the UI. The admin may also type any other model.
export const GEMINI_MODELS = ['gemini-3.6-flash', 'gemini-3.6-pro'];
// Models Google has retired — auto-upgraded to the current default on use.
const DEPRECATED = new Set(['gemini-2.0-flash', 'gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-1.0-pro', 'gemini-pro']);

// Keep any admin-typed model, but replace retired ones (and blanks) with the default.
export function normalizeModel(m) {
  const s = (m || '').trim();
  if (!s || DEPRECATED.has(s)) return DEFAULT_MODEL;
  return s;
}

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
    model: normalizeModel(cfg.model),
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
  if (!cfg) return { enabled: false, model: DEFAULT_MODEL, configured: false, api_key: '' };
  return { enabled: !!cfg.enabled, model: normalizeModel(cfg.model), configured: !!cfg.api_key, api_key: cfg.api_key ? '••••••••' : '' };
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

  return `Você é um cientista de dados sênior, especialista em mineração de dados, pré-processamento e engenharia de atributos. Seja concreto, técnico e específico para ESTE dataset — nada de conselhos genéricos.

DATASET
- Linhas: ${profile.rows}
- Coluna-alvo sugerida pelo usuário: ${profile.target || 'não informada — sugira a melhor'}
- Tarefa pretendida: ${profile.task || 'não informada — recomende a melhor'}

COLUNAS (nome (tipo[, papel]) · nulos% · únicos · stats):
${cols}

AMOSTRA (até 12 linhas): ${sample}

O QUE PRODUZIR (pense como se fosse preparar estes dados para modelagem):
1) dataset_summary: 2-4 frases descrevendo o que o dataset parece representar, sua qualidade geral e o potencial analítico.
2) possible_actions: 3-6 coisas concretas que dá para FAZER com estes dados. Para cada uma: "type" ∈ ["análise","modelo","negócio"], "action" (o que fazer) e "how" (como/por quê, citando colunas reais).
3) quality_issues: problemas reais (nulos altos, cardinalidade, outliers prováveis, colunas constantes/redundantes, possível vazamento de alvo, tipos inconsistentes). Cada um com "severity" ∈ ["alto","médio","baixo"] e "action" objetiva.
4) recommended_tasks: tarefas de ML adequadas (classificação/regressão/clustering/associação) com "target" (coluna real ou "") e "reason".
5) preprocessing_steps: lista ORDENADA (strings) do pipeline recomendado antes de treinar (tratamento de nulos, encoding, escala, remoção de vazamento, etc.).
6) suggested_features: 4-10 NOVAS features realmente úteis para modelagem (razões, interações, agregações, indicadores, discretizações, transformações). Priorize ganho preditivo e interpretabilidade.

REGRAS ESTRITAS das features (o app aplica automaticamente):
- Use SOMENTE nomes de colunas existentes acima. Não invente colunas nem valores.
- "transform" ∈ [${SUPPORTED_TRANSFORMS}].
- transform="formula": "formula" usando APENAS + - * / % ^ ( ) e funções log, ln, sqrt, abs, exp, min, max, com nomes de colunas. Use para razões/interações/polinômios. Ex.: "renda / (idade + 1)".
- demais transforms: "source_column" = coluna de origem. binning → params {"bins":N,"method":"width|freq"} (use para variáveis contínuas com relação não-linear); scale → params {"method":"zscore|minmax"} (para modelos sensíveis a escala); log → para variáveis muito assimétricas/positivas; onehot → categóricas de baixa cardinalidade; label → categóricas ordinais/alta cardinalidade.
- Cada feature: "name" (snake_case), "rationale" (por que ajuda) e "expected_benefit".

Responda APENAS com um JSON (sem markdown) exatamente neste formato:
{"dataset_summary":"","possible_actions":[{"type":"","action":"","how":""}],"quality_issues":[{"issue":"","severity":"","action":""}],"recommended_tasks":[{"task":"","target":"","reason":""}],"preprocessing_steps":[""],"suggested_features":[{"name":"","transform":"","formula":"","source_column":"","params":{"bins":0,"method":""},"rationale":"","expected_benefit":""}]}
Escreva tudo em português do Brasil.`;
}

// Calls Gemini generateContent with JSON output (no strict schema — more robust
// across models and lets the model return richer content).
export async function callGeminiAnalyze(profile) {
  const cfg = await requireCfg();
  const text = await generate(cfg, buildPrompt(profile), 8192);
  const parsed = parseJson(text);
  if (!parsed) throw new Error('Resposta do Gemini não pôde ser interpretada como JSON. Tente novamente ou troque o modelo.');
  return { model: cfg.model, ...parsed };
}

// AI narrative interpretation of a completed ML analysis.
export async function callGeminiInterpret(ctx) {
  const cfg = await requireCfg();
  const text = await generate(cfg, buildInterpretPrompt(ctx), 2048);
  const parsed = parseJson(text) || { interpretation: text, recommendations: [] };
  return { model: cfg.model, ...parsed };
}

function buildInterpretPrompt(ctx) {
  return `Você é um cientista de dados explicando o resultado de um modelo para um público técnico, de forma clara e acionável.

Projeto: ${ctx.project || '-'}
Tarefa: ${ctx.task || '-'} · Coluna-alvo: ${ctx.target || '-'}
Melhor modelo: ${ctx.best_model || '-'}
${ctx.class_labels ? `Classes: ${ctx.class_labels.join(', ')}\n` : ''}Métricas: ${JSON.stringify(ctx.metrics || {})}
${ctx.cross_validation ? `Validação cruzada: ${JSON.stringify(ctx.cross_validation)}\n` : ''}${ctx.feature_importance?.length ? `Features mais importantes: ${ctx.feature_importance.slice(0, 8).map((f) => f.feature).join(', ')}\n` : ''}${ctx.class_balance ? `Balanceamento: ${JSON.stringify(ctx.class_balance)}\n` : ''}
Produza:
- interpretation: 1 a 3 parágrafos em markdown explicando o que as métricas significam na prática, se o modelo está bom, riscos (overfitting, desbalanceamento, vazamento) e o que as features importantes indicam.
- recommendations: 3 a 5 próximos passos concretos (melhorar dados, features, modelo, validação ou uso em produção).

Responda APENAS com JSON: {"interpretation":"","recommendations":[""]}. Em português do Brasil, sem inventar números além dos fornecidos.`;
}

// ---- shared helpers ----
async function requireCfg() {
  const cfg = await getGeminiConfig();
  if (!cfg || !cfg.api_key) { const e = new Error('Gemini não configurado. Um administrador deve cadastrar a chave em Configurações → IA.'); e.code = 'NO_KEY'; throw e; }
  if (!cfg.enabled) { const e = new Error('A integração com o Gemini está desativada. Ative em Configurações → IA.'); e.code = 'DISABLED'; throw e; }
  return { ...cfg, model: normalizeModel(cfg.model) };
}

async function generate(cfg, prompt, maxOutputTokens = 3072) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.api_key)}`;
  const payload = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.4, responseMimeType: 'application/json', maxOutputTokens },
  };
  const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!resp.ok) {
    let msg = `HTTP ${resp.status}`;
    try { const j = await resp.json(); msg = j?.error?.message || msg; } catch { /* ignore */ }
    const e = new Error(`Falha na API do Gemini: ${msg}`); e.status = resp.status; throw e;
  }
  const data = await resp.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
}

// Minimal ping to validate a candidate key/model (used by the test button).
export async function pingGemini(apiKey, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${normalizeModel(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
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
