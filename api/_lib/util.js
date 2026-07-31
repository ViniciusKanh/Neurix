import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import otplib from 'otplib';
import QRCode from 'qrcode';

const { authenticator } = otplib;

export const JWT_SECRET = () => process.env.JWT_SECRET || 'neurix-dev-secret-change-me';
export const TOTP_ISSUER = () => process.env.TOTP_ISSUER || 'Neurix';

export function newId() {
  return crypto.randomUUID();
}

export function nowISO() {
  return new Date().toISOString();
}

export async function hashPassword(pw) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw, hash) {
  if (!hash) return false;
  return bcrypt.compare(pw, hash);
}

export function signToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET(), { expiresIn });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET());
  } catch {
    return null;
  }
}

// ---- TOTP (authenticator app) --------------------------------------------
export function newTotpSecret() {
  return authenticator.generateSecret();
}

export function totpUri(email, secret) {
  return authenticator.keyuri(email, TOTP_ISSUER(), secret);
}

export function verifyTotp(secret, code) {
  if (!secret || !code) return false;
  try {
    return authenticator.verify({ token: String(code).replace(/\s/g, ''), secret });
  } catch {
    return false;
  }
}

export async function totpQrDataUrl(otpauthUri) {
  return QRCode.toDataURL(otpauthUri);
}

// ---- HTTP helpers ---------------------------------------------------------
export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

export function getBearer(req) {
  const h = req.headers?.authorization || req.headers?.Authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}
