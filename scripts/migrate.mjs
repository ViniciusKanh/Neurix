// Creates the Turso schema and seeds the initial admin user.
// Run with:  npm run db:migrate
import { config } from 'dotenv';
config();

import { createClient } from '@libsql/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PAGE_KEYS } from '../api/_lib/pages.js';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;
if (!url) {
  console.error('❌ TURSO_DATABASE_URL não configurada. Preencha o arquivo .env');
  process.exit(1);
}

const db = createClient({ url, authToken });
const now = () => new Date().toISOString();

const ADMIN_EMAIL = 'viniciussouza742@gmail.com';
const ADMIN_PASSWORD = '12345678';

async function main() {
  console.log('→ Criando tabelas...');

  await db.batch([
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      avatar_url TEXT,
      permissions TEXT DEFAULT '[]',
      totp_secret TEXT,
      totp_enabled INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      filename TEXT,
      mime TEXT,
      size INTEGER,
      content TEXT,
      encoding TEXT,
      created_by_id TEXT,
      created_date TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      created_by_id TEXT,
      created_date TEXT NOT NULL,
      updated_date TEXT NOT NULL
    )`,
    `CREATE INDEX IF NOT EXISTS idx_records_type ON records(entity_type)`,
    `CREATE INDEX IF NOT EXISTS idx_records_type_created ON records(entity_type, created_date)`,
  ], 'write');

  console.log('✓ Tabelas prontas: users, files, records');

  // Seed admin ---------------------------------------------------------------
  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [ADMIN_EMAIL],
  });

  if (existing.rows.length === 0) {
    const id = crypto.randomUUID();
    const ts = now();
    const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await db.execute({
      sql: `INSERT INTO users (id, email, full_name, password_hash, role, permissions, totp_enabled, is_active, created_date, updated_date)
            VALUES (?,?,?,?,?,?,0,1,?,?)`,
      args: [id, ADMIN_EMAIL, 'Vinicius Souza', hash, 'admin', JSON.stringify(PAGE_KEYS), ts, ts],
    });
    console.log(`✓ Admin criado: ${ADMIN_EMAIL}  (senha: ${ADMIN_PASSWORD})`);
  } else {
    console.log(`• Admin já existe: ${ADMIN_EMAIL} (não modificado)`);
  }

  console.log('\n✅ Migração concluída com sucesso.\n');
  process.exit(0);
}

main().catch((e) => {
  console.error('❌ Erro na migração:', e.message);
  process.exit(1);
});
