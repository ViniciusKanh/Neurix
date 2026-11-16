// Preparação reprodutível SEM vazamento (TypeScript).
// Os parâmetros são aprendidos apenas no treino e aplicados ao teste.
import {
  trainTestSplit,
  Imputer,
  Scaler,
  OneHotEncoder,
  type ColumnInfo,
  type Row,
} from '@viniciuskanh/neurix-data-tools';

const rows: Row[] = Array.from({ length: 10 }, (_, i) => ({
  renda: i % 4 === 0 ? null : 1000 + i * 500,
  setor: ['TI', 'Saúde'][i % 2],
}));
const columns: ColumnInfo[] = [
  { name: 'renda', type: 'number' },
  { name: 'setor', type: 'string' },
];

const { train, test } = trainTestSplit(rows, { testSize: 0.3, seed: 42 });

const imputer = new Imputer({ columns, numericStrategy: 'median' }).fit(train);
const scaler = new Scaler({ column: 'renda', method: 'zscore' });
const onehot = new OneHotEncoder({ column: 'setor', handleUnknown: 'ignore' });

const trainReady = onehot.fitTransform(scaler.fitTransform(imputer.transform(train).rows));
const testReady = onehot.transform(scaler.transform(imputer.transform(test).rows));

// Parâmetros serializáveis para reprodutibilidade/auditoria.
const params = { imputer: imputer.getParams(), scaler: scaler.getParams(), onehot: onehot.getParams() };
console.log(JSON.stringify(params.imputer.columns[0]));
console.log(trainReady.length, testReady.length, testReady[0]);
