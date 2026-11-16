# Changelog — @viniciuskanh/neurix-data-tools

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] — não publicado

Primeira versão, extraída de `src/lib/dataQuality.js`, `src/lib/featureEng.js` e `src/lib/datasetProfile.js` do Neurix.

### Adicionado
- API pública única tipada (TypeScript, ESM, `.d.ts`), sem dependências de runtime.
- `Imputer`, `Scaler`, `Binner`, `OneHotEncoder`, `LabelEncoder` com `fit`/`transform`/`fitTransform`, `getParams()` serializável e `fromParams()`.
- `trainTestSplit` com semente e estratificação.
- `parseNumber`, `isMissing`, `findDuplicates`, `countDuplicates`, `sampleRows`, `pearson` e funções de estatística descritiva.
- `analyzeQuality`: `columns_count`, `cardinality_ratio`, `constant`, `all_missing`, `issue_list` com códigos.
- `buildProfile`: mediana, desvio-padrão amostral, válidos/inválidos, moda, estratégias de amostragem (`systematic`, `random` com semente, `head`), duplicatas opcionais, `warnings`.
- `correlationMatrix`: `n_matrix`, `undefined_pairs`, `minObservations`, `precision`.
- `detectTargetLeakage`: `signal`, `metrics`, `disclaimer`, `has_suspects` e sinal `categorical_association` (η²) para alvos numéricos.
- `NeurixDataError` com códigos estáveis.

### Corrigido (em relação ao código original do Neurix)
- Duplicatas: a chave concatenava valores sem separador (`'ab'+'c'` ≡ `'a'+'bc'`) e ignorava tipos; agora é estruturada e independe da ordem das propriedades.
- `analyzeQuality` sem `columnInfo` contava todas as linhas como duplicadas; agora infere as colunas.
- Conversão numérica: `parseFloat('12abc')` virava 12; agora é inválido. `Infinity` deixa de ser aceito.
- Imputação de coluna vazia preenchia com 0; agora mantém ausentes e avisa.
- Fórmulas: divisão por zero e valores ausentes viravam 0 silenciosamente (agora `null`); `1.2.3` era aceito; identificadores acentuados eram rejeitados; aridade de funções não era validada.
- Correlação indefinida (coluna constante / sem pares) era reportada como 0; agora `null` com motivo.
- Perfil de dataset vazio produzia `NaN`; `Math.min(...arr)` estourava a pilha em colunas grandes.
- Quantis com valores repetidos geravam limites duplicados (faixas vazias); agora são removidos e reportados.
- Ordem de one-hot em empates dependia da ordem de inserção; agora é lexicográfica.

### Alterado
- Valores derivados/escalonados/imputados não são mais arredondados (antes 4–6 casas). `buildProfile` não inclui linhas reais por padrão (`sampleN: 0`); o Neurix mantém seus padrões históricos via `src/lib/datasetProfile.js`.
