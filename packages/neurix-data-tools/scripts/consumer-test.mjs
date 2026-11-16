#!/usr/bin/env node
/**
 * Teste de integração do pacote publicado:
 * 1. `npm pack` gera o tarball a partir de `dist/` (rode `npm run build` antes);
 * 2. cria um projeto consumidor temporário FORA do repositório;
 * 3. instala o tarball (sem acesso ao código-fonte do Neurix);
 * 4. executa um script ESM que usa a API pública;
 * 5. verifica as declarações TypeScript com `tsc` (NodeNext e Bundler).
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'inherit'], encoding: 'utf8', shell: process.platform === 'win32' });

if (!existsSync(join(pkgDir, 'dist', 'index.js'))) {
  console.error('dist/ não encontrado — execute "npm run build" antes.');
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), 'neurix-consumer-'));
try {
  const packOut = JSON.parse(run(npm, ['pack', '--json', '--pack-destination', work], pkgDir));
  const tarball = join(work, packOut[0].filename);
  console.log(`tarball: ${packOut[0].filename} (${packOut[0].files.length} arquivos)`);

  const app = join(work, 'app');
  execFileSync(process.execPath, ['-e', `require('fs').mkdirSync(${JSON.stringify(app)})`]);
  writeFileSync(join(app, 'package.json'), JSON.stringify({ name: 'consumer', private: true, type: 'module' }, null, 2));
  run(npm, ['install', '--no-audit', '--no-fund', '--no-package-lock', tarball], app);

  // 4) Uso em JavaScript (ESM) apenas pela API pública.
  writeFileSync(
    join(app, 'index.mjs'),
    `import * as ndt from '@viniciuskanh/neurix-data-tools';
import { analyzeQuality, imputeNulls, dropDuplicates, correlationMatrix, buildProfile, Imputer, Scaler, compileFormula } from '@viniciuskanh/neurix-data-tools';
import assert from 'node:assert/strict';

const dados = [
  { idade: 25, renda: 3200, setor: 'TI' },
  { idade: null, renda: 4100, setor: 'Saúde' },
  { idade: 31, renda: null, setor: 'TI' },
];
const colunas = [
  { name: 'idade', type: 'number' },
  { name: 'renda', type: 'number' },
  { name: 'setor', type: 'string' },
];
const q = analyzeQuality(dados, colunas);
assert.equal(q.total_nulls, 2);
const r = imputeNulls(dados, colunas, 'median');
assert.equal(r.rows[1].idade, 28);
assert.equal(r.rows[2].renda, 3650);
assert.equal(dropDuplicates([{ a: 1 }, { a: 1 }]).removed, 1);
assert.equal(correlationMatrix([{ a: 1, b: 2 }, { a: 2, b: 4 }, { a: 3, b: 7 }], [{ name: 'a', type: 'number' }, { name: 'b', type: 'number' }]).columns.length, 2);
assert.equal(buildProfile(dados, colunas).columns.length, 3);
assert.equal(new Imputer({ columns: colunas }).fit(dados).getParams().kind, 'imputer');
assert.equal(new Scaler({ column: 'renda', method: 'minmax' }).fitTransform([{ renda: 0 }, { renda: 10 }])[1].renda_norm, 1);
assert.equal(compileFormula('2 ^ 3 ^ 2')({}), 512);
console.log('ESM OK —', Object.keys(ndt).length, 'exports');
`,
  );
  console.log(run(process.execPath, ['index.mjs'], app).trim());

  // 5) Declarações TypeScript consumíveis.
  writeFileSync(
    join(app, 'index.ts'),
    `import { analyzeQuality, Imputer, buildProfile, type Row, type ColumnInfo, type QualityReport, type ImputerParams } from '@viniciuskanh/neurix-data-tools';
const rows: Row[] = [{ x: 1 }, { x: null }];
const cols: ColumnInfo[] = [{ name: 'x', type: 'number' }];
const q: QualityReport = analyzeQuality(rows, cols);
const p: ImputerParams = new Imputer({ columns: cols, numericStrategy: 'mean' }).fit(rows).getParams();
const n: number = buildProfile(rows, cols).rows;
// @ts-expect-error estratégia inválida deve ser rejeitada pelo tipo
new Imputer({ numericStrategy: 'banana' });
export { q, p, n };
`,
  );
  const tsc = join(pkgDir, 'node_modules', 'typescript', 'bin', 'tsc');
  for (const [module, resolution] of [['NodeNext', 'NodeNext'], ['ESNext', 'Bundler']]) {
    run(process.execPath, [tsc, '--noEmit', '--strict', '--skipLibCheck', 'false', '--module', module, '--moduleResolution', resolution, '--target', 'ES2020', 'index.ts'], app);
    console.log(`TypeScript OK (${resolution})`);
  }
  console.log('Consumer test: SUCESSO');
} finally {
  rmSync(work, { recursive: true, force: true });
}
