import nodemailer from 'nodemailer';
import { queryOne, run } from './db.js';

// Email/SMTP config is stored in the `settings` table under key 'email' as JSON:
// { enabled, host, port, secure, user, pass, from_name }
const KEY = 'email';

export async function getEmailConfig() {
  const row = await queryOne('SELECT value FROM settings WHERE key = ?', [KEY]);
  if (!row) return null;
  try { return JSON.parse(row.value); } catch { return null; }
}

export async function saveEmailConfig(cfg) {
  const clean = {
    enabled: !!cfg.enabled,
    host: cfg.host || 'smtp.gmail.com',
    port: Number(cfg.port) || 465,
    secure: cfg.secure !== undefined ? !!cfg.secure : (Number(cfg.port) || 465) === 465,
    user: cfg.user || '',
    pass: cfg.pass || '',
    from_name: cfg.from_name || 'Neurix',
  };
  const existing = await getEmailConfig();
  // Keep the stored password if the client sent a blank one (masked field).
  if ((!clean.pass || clean.pass === '••••••••') && existing?.pass) clean.pass = existing.pass;
  await run(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [KEY, JSON.stringify(clean)]
  );
  return clean;
}

// Returns config with the password masked — safe to send to the client.
export function maskEmailConfig(cfg) {
  if (!cfg) return null;
  return { ...cfg, pass: cfg.pass ? '••••••••' : '' };
}

function transporterFrom(cfg) {
  return nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: { user: cfg.user, pass: cfg.pass },
  });
}

export async function sendEmail({ to, subject, html }) {
  const cfg = await getEmailConfig();
  if (!cfg || !cfg.enabled || !cfg.user || !cfg.pass) {
    const err = new Error('E-mail não configurado. Peça ao admin para configurar o SMTP em Configurações → Email.');
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }
  const transporter = transporterFrom(cfg);
  const from = `"${cfg.from_name || 'Neurix'}" <${cfg.user}>`;
  return transporter.sendMail({ from, to, subject, html });
}

export async function sendTestEmail(cfg, to) {
  const transporter = transporterFrom(cfg);
  const from = `"${cfg.from_name || 'Neurix'}" <${cfg.user}>`;
  const { testTemplate } = await import('./emailTemplates.js');
  const t = testTemplate();
  return transporter.sendMail({ from, to, subject: t.subject, html: t.html });
}
