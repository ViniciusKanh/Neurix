// One-off cleanup: removes the raw dataset blobs from the `files` table.
// The app no longer stores raw files in Turso (it keeps parsed metadata +
// a bounded sample instead), so clearing these frees space and fixes the
// "SQLITE_NOMEM / out of memory" errors caused by very large cells.
//
// Run with:  npm run db:clean-files
import { config } from 'dotenv';
config();
import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) { console.error('❌ TURSO_DATABASE_URL não configurada no .env'); process.exit(1); }

const db = createClient({ url, authToken });

async function main() {
  try {
    const before = await db.execute('SELECT COUNT(*) AS n FROM files');
    console.log(`→ Registros em files: ${before.rows[0].n}`);
  } catch {
    console.log('Tabela files ainda não existe — nada a limpar.');
    process.exit(0);
  }
  await db.execute('DELETE FROM files');
  try { await db.execute('VACUUM'); } catch { /* VACUUM pode não ser suportado em réplicas */ }
  console.log('✅ Arquivos brutos removidos. O banco está leve novamente.');
  process.exit(0);
}
main().catch((e) => { console.error('❌ Erro:', e.message); process.exit(1); });
