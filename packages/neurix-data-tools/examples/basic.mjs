// Exemplo básico (JavaScript, ESM). Execute após `npm run build`:
//   node examples/basic.mjs
import {
  analyzeQuality,
  imputeNulls,
  dropDuplicates,
  correlationMatrix,
  buildProfile,
} from '@viniciuskanh/neurix-data-tools';

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

// Analisa a qualidade do conjunto de dados.
const qualidade = analyzeQuality(dados, colunas);

// Preenche valores ausentes pela mediana (numéricas) ou moda (categóricas).
const resultado = imputeNulls(dados, colunas, 'median');

console.log('total_nulls:', qualidade.total_nulls, '| issues:', qualidade.issues);
console.log(resultado.rows);
console.log('duplicatas removidas:', dropDuplicates([...dados, dados[0]], colunas).removed);
console.log('r(idade, renda):', correlationMatrix(resultado.rows, colunas).matrix[0][1]);
console.log('perfil:', buildProfile(dados, colunas).columns.map((c) => `${c.name}:${c.type}`).join(', '));
