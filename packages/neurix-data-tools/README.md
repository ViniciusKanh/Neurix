<div align="center">

# ⬡ Neurix Data Tools — Data Quality, Feature Engineering & Statistical Profiling

**`@viniciuskanh/neurix-data-tools`**

*A matriz neural onde dados se transformam em conhecimento — agora como biblioteca.*

[![version](https://img.shields.io/badge/version-0.1.0-00F0FF?style=flat-square)](https://github.com/ViniciusKanh/Neurix/pkgs/npm/neurix-data-tools)
[![license](https://img.shields.io/badge/license-MIT-00E57A?style=flat-square)](./LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A518-070B12?style=flat-square&logo=node.js)](https://nodejs.org)
[![typescript](https://img.shields.io/badge/types-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](./dist/index.d.ts)
[![CI](https://github.com/ViniciusKanh/Neurix/actions/workflows/publish-neurix-data-tools.yml/badge.svg)](https://github.com/ViniciusKanh/Neurix/actions/workflows/publish-neurix-data-tools.yml)

</div>

---

## 1. Identidade

Biblioteca de preparação e análise de dados extraída do **[Neurix](https://github.com/ViniciusKanh/Neurix)**, a workbench analítica de Machine Learning que roda 100% no navegador. É o mesmo código que alimenta o Explorador de Dados, o Perfilamento, o Feature Lab e o ML Studio do Neurix — revisado, tipado e testado para uso independente.

- **Zero dependências de runtime.** TypeScript puro, sem React, sem backend.
- **Local.** Nenhum dado sai do processo: sem rede, sem telemetria, sem IA externa.
- **Científica.** `fit`/`transform` separados, parâmetros serializáveis, resultados determinísticos.

## 2. Descrição e objetivos

Oferecer ferramentas reutilizáveis e auditáveis para o ciclo **dados brutos → dataset pronto para modelagem**:

1. diagnosticar qualidade (ausentes, tipos, duplicatas, cardinalidade);
2. tratar dados sem decisões silenciosas (nada vira 0 por acidente);
3. construir atributos com fórmulas seguras, codificação, escalonamento e discretização;
4. perfilar e correlacionar variáveis com tratamento explícito de casos indefinidos;
5. sinalizar possíveis vazamentos de alvo como **heurística**, com justificativa;
6. preparar treino/teste de forma **reprodutível e sem vazamento estatístico**.

## 3. Principais funcionalidades

| Área | Funções / classes |
|---|---|
| Qualidade | `analyzeQuality`, `findDuplicates`, `countDuplicates`, `dropDuplicates` |
| Conversão | `parseNumber`, `coerceTypes`, `isMissing` |
| Imputação | `Imputer` (fit/transform), `imputeNulls` |
| Divisão | `trainTestSplit` (semente, estratificação) |
| Atributos | `compileFormula`, `deriveColumn`, `Scaler`, `Binner`, `OneHotEncoder`, `LabelEncoder`, `scaleColumn`, `binningColumn`, `oneHotColumn`, `labelEncodeColumn`, `logColumn` |
| Perfilamento | `buildProfile`, `sampleRows`, `inferColumns` |
| Estatística | `correlationMatrix`, `pearson`, `mean`, `median`, `quantile`, `variance`, `std`, `min`, `max`, `mode`, `frequencies`, `sum` |
| Vazamento | `detectTargetLeakage` |

## 4. Arquitetura dos módulos

```
src/
├── index.ts            # ponto de entrada público único
├── types/              # contratos públicos (Row, ColumnInfo, relatórios, params)
├── internal/values.ts  # ausência, conversão numérica estrita, chaves, PRNG, erros
├── quality/            # analyzeQuality, duplicatas, detectTargetLeakage
├── preprocessing/      # coerceTypes, Imputer/imputeNulls, trainTestSplit
├── features/           # fórmula segura, transformadores fit/transform, atalhos
├── profiling/          # buildProfile, sampleRows, inferColumns
└── statistics/         # descritiva e correlação de Pearson
```

Importe sempre de `@viniciuskanh/neurix-data-tools` — o campo `exports` bloqueia importações profundas.

**Modelo de dados.** Um dataset é um array de objetos (`Row = Record<string, unknown>`). As colunas são descritas por `ColumnInfo = { name, type? }`; os tipos `number`, `int`, `integer`, `float`, `numeric`, `double`, `float64` e `int64` são numéricos, qualquer outro é categórico.

## 5. Requisitos

- Node.js **≥ 18** (ESM) ou qualquer bundler moderno (Vite, webpack 5, esbuild, Rollup).
- TypeScript ≥ 5 (opcional) — declarações `.d.ts` incluídas.
- O pacote é **ESM-only**. Em CommonJS, use `await import('@viniciuskanh/neurix-data-tools')` (ou `require()` em Node ≥ 20.19/22, que suportam `require` de ESM).

## 6. Instalação

```bash
npm install @viniciuskanh/neurix-data-tools
```

## 7. Autenticação no GitHub Packages

O GitHub Packages exige autenticação **mesmo para instalar**. No projeto consumidor, crie um `.npmrc`:

```ini
@viniciuskanh:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

e exporte um token clássico com escopo **`read:packages`** (nunca o grave no repositório):

```bash
export NODE_AUTH_TOKEN=ghp_xxx   # Windows PowerShell: $env:NODE_AUTH_TOKEN="ghp_xxx"
npm install @viniciuskanh/neurix-data-tools
```

Em GitHub Actions do mesmo dono, use `actions/setup-node` com `registry-url: https://npm.pkg.github.com` e `NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}` (permissão `packages: read`).

## 8. Exemplo em JavaScript

```js
import { analyzeQuality, imputeNulls, dropDuplicates, correlationMatrix, buildProfile } from '@viniciuskanh/neurix-data-tools';

// Dataset demonstrativo para análise local.
const dados = [
  { idade: 25, renda: 3200, setor: 'TI' },
  { idade: null, renda: 4100, setor: 'Saúde' },
  { idade: 31, renda: null, setor: 'TI' },
];

// Descreve as colunas analisadas.
const colunas = [
  { name: 'idade', type: 'number' },
  { name: 'renda', type: 'number' },
  { name: 'setor', type: 'string' },
];

const qualidade = analyzeQuality(dados, colunas);          // qualidade.total_nulls === 2
const resultado = imputeNulls(dados, colunas, 'median');   // mediana / moda
console.log(resultado.rows);
// [
//   { idade: 25, renda: 3200, setor: 'TI' },
//   { idade: 28, renda: 4100, setor: 'Saúde' },
//   { idade: 31, renda: 3650, setor: 'TI' }
// ]
correlationMatrix(resultado.rows, colunas).matrix[0][1];   // 0.5
```

Executável em [`examples/basic.mjs`](./examples/basic.mjs).

## 9. Exemplo em TypeScript (treino/teste sem vazamento)

```ts
import { trainTestSplit, Imputer, Scaler, OneHotEncoder, type ColumnInfo, type Row } from '@viniciuskanh/neurix-data-tools';

const columns: ColumnInfo[] = [{ name: 'renda', type: 'number' }, { name: 'setor', type: 'string' }];
const { train, test } = trainTestSplit(rows, { testSize: 0.3, seed: 42 });

// 1) Ajusta SOMENTE no treino.
const imputer = new Imputer({ columns, numericStrategy: 'median' }).fit(train);
const scaler = new Scaler({ column: 'renda', method: 'zscore' });
const onehot = new OneHotEncoder({ column: 'setor', handleUnknown: 'ignore' });
const trainReady = onehot.fitTransform(scaler.fitTransform(imputer.transform(train).rows));

// 2) Aplica os MESMOS parâmetros ao teste (nada é reajustado).
const testReady = onehot.transform(scaler.transform(imputer.transform(test).rows));

// 3) Persiste os parâmetros (JSON) para reproduzir/auditar.
const params = { imputer: imputer.getParams(), scaler: scaler.getParams(), onehot: onehot.getParams() };
const restored = Imputer.fromParams(params.imputer);
```

Executável em [`examples/train-test.ts`](./examples/train-test.ts).

## 10. Análise de qualidade

```ts
const q = analyzeQuality(rows, columns);
```

Retorna `{ rows, columns_count, columns[], duplicates, total_nulls, issues, issue_list[] }`. Por coluna: `nulls`, `null_pct`, `unique` (cardinalidade), `type_mismatch`, `cardinality_ratio`, `constant`, `all_missing`. `issue_list` traz códigos estáveis: `missing_values`, `all_missing`, `type_mismatch`, `constant_column`, `high_cardinality`, `duplicate_rows`.

**Ausente** = `undefined`, `null`, `''`, string só com espaços ou `NaN`. `Infinity` **não** é ausente: é um número inválido.

**Duplicatas** usam uma chave estruturada que preserva tipo e limites de coluna:

| Caso | Resultado |
|---|---|
| `{a:'ab', b:'c'}` × `{a:'a', b:'bc'}` | distintas (a versão original colidia) |
| `1` × `'1'`, `true` × `'true'` | distintas |
| `0` × `-0` | iguais |
| `{a:1, b:2}` × `{b:2, a:1}` | iguais (ordem das propriedades irrelevante) |
| `null` × `undefined` × `''` × `NaN` | iguais por padrão; distintos com `{ treatMissingAsEqual: false }` |
| `Infinity` × `-Infinity` × `NaN` | distintos (com `treatMissingAsEqual: false`) |

**Conversão numérica estrita** (`parseNumber`, `coerceTypes`):

| Entrada | `decimalSeparator: 'auto'` (padrão) |
|---|---|
| `'42'`, `' -3.5 '`, `'.5'`, `'1e3'` | válidos |
| `'3,5'` | 3.5 (uma vírgula e nenhum ponto) |
| `'12abc'`, `'1.2.3'`, `'1 000'`, `'0x10'` | inválidos |
| `'1.234,56'` | inválido (separador de milhar não suportado) |
| `Infinity`, `'Infinity'`, `true` | inválidos |

`coerceTypes` mantém inválidos como estão (`onInvalid: 'keep'`) ou troca por `null` (`'null'`) — **nunca por zero** — e informa `invalid_by_column` e `invalid_samples`.

## 11. Imputação

| Estratégia | Numérica | Categórica |
|---|---|---|
| `mean` / `median` | ✓ | ✗ (erro `INCOMPATIBLE_STRATEGY`) |
| `mode` | ✓ | ✓ |
| `constant` (`fillValue`) | ✓ | ✓ |
| `keep` (não imputa) | ✓ | ✓ |

- Só valores **ausentes** são preenchidos; inválidos (`'12abc'`, `Infinity`) ficam intactos e não entram no ajuste.
- Coluna sem valores observados: ausentes mantidos + aviso (`onEmptyColumn: 'keep'`) ou erro (`'error'`).
- Coluna inexistente: erro (`onMissingColumn: 'error'`, padrão da classe) ou ignorada (`'skip'`, padrão de `imputeNulls`).
- Valores imputados **não são arredondados**. Moda: maior frequência; empate → valor que aparece primeiro.
- `imputeNulls(rows, columns, 'median' | 'mean' | 'mode')` ajusta e aplica no mesmo conjunto — use `Imputer` quando houver treino/teste.

## 12. Preparação de datasets

```ts
const { train, test, train_indices, test_indices } = trainTestSplit(rows, { testSize: 0.2, seed: 42, stratify: 'alvo' });
const clean = coerceTypes(train, columns, { onInvalid: 'null' }).rows;
const dedup = dropDuplicates(clean, columns).rows;
```

Ordem recomendada: **dividir → ajustar no treino → aplicar no teste**. Calcular estatísticas no dataset completo antes da divisão vaza informação do teste para o treino.

## 13. Engenharia de atributos

**Fórmulas seguras** (sem `eval`/`new Function`; parser descendente recursivo):

```ts
const f = compileFormula('[renda mensal] / (idade + 1) + log(100)');
f({ 'renda mensal': 3000, idade: 29 }); // 102
f.columns;                               // ['idade', 'renda mensal']
deriveColumn(rows, 'razao', 'a / b');    // { rows, added: ['razao'], report }
```

- Precedência: `^` > unário `-`/`+` > `* / %` > `+ -`. `^` associa à direita (`2^3^2 = 512`), demais à esquerda (`8/4/2 = 1`), `-2^2 = -4`.
- Colunas: identificadores Unicode com `_` e espaços internos (`renda mensal`, `idade_média`) ou entre colchetes para qualquer nome (`[cat=x]`, `[valor (R$)]`).
- Funções: `log` (base 10), `ln`, `log2`, `sqrt`, `abs`, `exp`, `round`, `floor`, `ceil` (1 argumento), `min`, `max` (1+).
- Divisão por zero, ausentes, valores não numéricos e domínio inválido (`log(0)`, `sqrt(-1)`) → `null` (a versão original devolvia 0).
- Erros de sintaxe, função desconhecida, aridade e coluna inexistente (`knownColumns`) lançam `NeurixDataError`.

**Transformadores** (`fit` / `transform` / `fitTransform` / `getParams` / `fromParams`):

| Classe | Saída | Comportamento definido |
|---|---|---|
| `Scaler({ column, method: 'zscore' \| 'minmax', ddof })` | `${col}_norm` | z-score usa desvio **populacional** (ddof 0, como scikit-learn) por padrão; `ddof: 1` = amostral. Coluna constante → 0 (`constant: true`). Ausente → `null`. Min-Max não corta valores fora do intervalo do treino. |
| `Binner({ column, bins, method: 'width' \| 'quantile', outOfRange })` | `${col}_faixa` | Faixas fechadas à direita `(−∞,e1], …, (e_{k−1},+∞)`. Quantis tipo 7; limites coincidentes removidos (`effective_bins`, `warnings`). Fora do intervalo: faixa extrema (`clip`) ou `null`. `bins` inteiro ≥ 1. |
| `OneHotEncoder({ column, topK, handleUnknown, handleMissing })` | `${col}=${cat}` | Ordem: frequência desc, empate lexicográfico. Desconhecida → zeros (`ignore`) ou erro. Ausente → zeros ou `null`. |
| `LabelEncoder({ column, handleUnknown })` | `${col}_cod` | Ordem lexicográfica (independente de locale). Desconhecida → `null` ou erro. **Códigos nominais**: não implicam ordem — prefira one-hot em modelos lineares/de distância. |

Atalhos compatíveis com o Neurix (`scaleColumn`, `binningColumn`, `oneHotColumn`, `labelEncodeColumn`, `logColumn`) retornam `{ rows, added, report }` e ajustam no próprio conjunto recebido. `logColumn` aplica `ln(1+x)` para `x ≥ 0` (negativos → `null`).

## 14. Perfilamento estatístico

```ts
const profile = buildProfile(rows, columns, {
  statCap: 5000, sampling: 'systematic', seed: 42,
  sampleN: 0, topN: 5, includeDuplicates: true, precision: 4,
});
```

- Geral: `rows`, `columns_count`, `rows_analyzed`, `sampled`, `sampling`, `duplicates` (opcional), `warnings`.
- Numéricas: `min`, `max`, `mean`, `median`, `std` (**amostral, n−1**; `null` com < 2 valores), `valid`, `invalid`, `missing`, `null_pct`, `unique`.
- Categóricas: `top` (frequências), `mode`, `unique`, `missing`.
- **Privacidade:** `sampleN` é **0** por padrão — linhas reais só entram no relatório se pedido, truncadas em `maxStringLength` e restritas às colunas informadas.
- Dataset vazio não gera `NaN`: as estatísticas ficam ausentes e há aviso.

## 15. Correlações

```ts
const c = correlationMatrix(rows, columns, 0.8);
// { method: 'pearson', missing: 'pairwise', columns, matrix, n_matrix, high_pairs, undefined_pairs, threshold }
```

- Exclusão **par a par** de ausentes/inválidos; `n_matrix` informa quantos pares sustentam cada r.
- Correlação **indefinida é `null`**, nunca 0: coluna constante (`reason: 'constant'`) ou menos de `minObservations` pares (padrão 3, `'insufficient_observations'`). A diagonal de uma coluna constante também é `null`.
- `r` arredondado a 3 casas por padrão (compatível com o Neurix); `{ precision: null }` mantém precisão total.
- Menos de duas colunas numéricas → `{ error: true, message }`.

## 16. Alertas de possível vazamento

```ts
const report = detectTargetLeakage(rows, 'alvo', columns, 'classification');
// { has_suspects, leaks: [{ feature, signal, reason, severity, metrics }], heuristic: true, disclaimer, ... }
```

| Sinal | Quando |
|---|---|
| `near_copy` | ≥ 99% dos valores idênticos ao alvo |
| `high_correlation` | alvo e atributo numéricos, \|r\| ≥ 0,98 |
| `categorical_association` | alvo numérico × atributo categórico, η² ≥ 0,96 |
| `category_purity` | alvo categórico × atributo categórico, pureza ≥ 99% |
| `threshold_separation` | alvo binário × atributo numérico, um limiar separa ≥ 99% |

> ⚠️ **É um diagnóstico heurístico.** Associação forte não comprova vazamento — um atributo legítimo e muito informativo produz os mesmos sinais. A confirmação depende do contexto temporal (o atributo existe no momento da predição?), causal e do processo de coleta. Atributos com cara de identificador (categorias ≥ 50% das linhas) não são sinalizados por pureza/η². Limiares configuráveis em `options`.

## 17. API pública

| Assinatura | Retorno |
|---|---|
| `analyzeQuality(rows, columnInfo?, options?)` | `QualityReport` |
| `findDuplicates(rows, columnInfo?, { treatMissingAsEqual? })` | `number[]` |
| `countDuplicates(rows, columnInfo?, options?)` | `number` |
| `dropDuplicates(rows, columnInfo?, options?)` | `{ rows, removed, removed_indices }` |
| `parseNumber(value, { decimalSeparator? })` | `{ status: 'valid', value } \| { status: 'missing' } \| { status: 'invalid', raw, reason }` |
| `isMissing(value)` / `isNumericType(type)` | `boolean` |
| `coerceTypes(rows, columnInfo, { decimalSeparator?, onInvalid? })` | `CoerceResult` |
| `new Imputer(options).fit(rows).transform(rows)` | `ImputeResult` |
| `imputeNulls(rows, columnInfo?, strategy?, options?)` | `ImputeResult` |
| `trainTestSplit(rows, { testSize?, seed?, stratify? })` | `SplitResult` |
| `compileFormula(formula, { knownColumns?, decimalSeparator? })` | `CompiledFormula` |
| `deriveColumn(rows, newName, formula, options?)` | `FeatureResult` |
| `new Scaler / Binner / OneHotEncoder / LabelEncoder(options)` | transformador |
| `scaleColumn(rows, col, 'zscore' \| 'minmax')` | `FeatureResult` |
| `binningColumn(rows, col, k?, 'width' \| 'freq' \| 'quantile')` | `FeatureResult` |
| `oneHotColumn(rows, col, topK?)` / `labelEncodeColumn(rows, col)` / `logColumn(rows, col)` | `FeatureResult` |
| `buildProfile(rows, columnInfo?, options?)` | `DatasetProfile` |
| `sampleRows(rows, cap, strategy?, seed?)` | `Row[]` |
| `inferColumns(rows, { sampleSize?, decimalSeparator? })` | `InferredColumn[]` |
| `correlationMatrix(rows, columnInfo, threshold?, options?)` | `CorrelationResult \| CorrelationError` |
| `pearson(x, y, minObservations?)` | `{ r, n, reason? }` |
| `mean / median / min / max / sum / variance(v, ddof) / std(v, ddof) / quantile(v, p) / mode / frequencies` | estatísticas (`null` para vazio) |
| `detectTargetLeakage(rows, target, columnInfo, task?, options?)` | `LeakageReport` |

Erros de entrada lançam `NeurixDataError` com `code` estável (`INVALID_ROWS`, `INVALID_COLUMNS`, `NOT_FITTED`, `EMPTY_COLUMN`, `COLUMN_NOT_FOUND`, `INCOMPATIBLE_STRATEGY`, `UNKNOWN_CATEGORY`, `FORMULA_SYNTAX`, `FORMULA_UNKNOWN_FUNCTION`, `FORMULA_ARITY`, `FORMULA_UNKNOWN_COLUMN`, …). Todos os tipos (`Row`, `ColumnInfo`, `QualityReport`, `ImputerParams`, `ScalerParams`, `BinnerParams`, `DatasetProfile`, `CorrelationResult`, `LeakageReport`, …) são exportados.

**Imutabilidade:** nenhuma função modifica as linhas recebidas; as transformações retornam novas linhas (cópias rasas).

## 18. Limitações estatísticas

- Correlação apenas de **Pearson** (linear); relações monotônicas não lineares podem passar despercebidas. Sem p-valores.
- Estatísticas por **amostragem** são estimativas (mín./máx. podem não ser globais; cardinalidade subestimada; categorias raras podem sumir). Verifique `sampled` e `rows_analyzed`.
- `detectTargetLeakage` analisa até 3000 linhas (amostragem sistemática) e só detecta padrões univariados.
- Separadores de milhar e formatos locais de data não são interpretados.
- Ausentes no one-hot viram zeros por padrão — indistinguíveis de “outra categoria”, a menos que se use `handleMissing: 'null'`.
- Processamento em memória, single-thread; adequado a datasets que cabem na memória do navegador/processo.

## 19. Testes e reprodutibilidade

```bash
cd packages/neurix-data-tools
npm ci
npm run typecheck      # TypeScript strict
npm test               # Vitest: unidade, estatística com valores de referência, imutabilidade
npm run build          # dist/ (ESM + .d.ts)
npm run test:consumer  # npm pack → instala num projeto temporário → importa (JS) e checa tipos (TS)
```

Os testes usam datasets sintéticos com geradores determinísticos e comparam resultados com valores de referência independentes (ex.: σ populacional de `[2,4,4,4,5,5,7,9]` = 2; `quantile(1..10, 0.25)` = 3,25 como NumPy/R; `corrcoef([1..5],[2,1,4,3,5])` = 0,8). Toda aleatoriedade (amostragem, divisão) usa semente explícita.

## 20. Desenvolvimento e contribuição

O pacote vive em `packages/neurix-data-tools/` no repositório do Neurix. A aplicação consome o **código-fonte** do pacote por meio de `src/lib/dataQuality.js`, `src/lib/featureEng.js` e `src/lib/datasetProfile.js` (reexportações), garantindo uma única implementação. Ao contribuir:

1. crie uma branch e altere `src/` + testes em `tests/`;
2. rode `npm run typecheck && npm test && npm run build && npm run test:consumer`;
3. na raiz, rode `npx vitest run` para garantir que o Neurix não regrediu;
4. comente código novo em português do Brasil; não adicione dependências de runtime sem necessidade.

## 21. Versionamento

[SemVer](https://semver.org/lang/pt-BR/). Enquanto em `0.x`, mudanças incompatíveis incrementam o *minor*. Histórico em [CHANGELOG.md](./CHANGELOG.md). Publicação: tag `neurix-data-tools-vX.Y.Z` → workflow `publish-neurix-data-tools.yml` → GitHub Packages.

## 22. Licença

[MIT](./LICENSE) © 2026 Vinicius Santos — a mesma licença do Neurix.

## 23. Autor

**Vinicius Santos** — [@ViniciusKanh](https://github.com/ViniciusKanh) · Criador do Neurix.
