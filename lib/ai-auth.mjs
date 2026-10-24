import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'caderno_ai_session';
const COOKIE_DAYS = 30;
const MAX_AGE = COOKIE_DAYS * 24 * 60 * 60;

export function verifyAccess(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || expected.length < 16 || provided.length > 256) return false;
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createSession(secret, now = Date.now()) {
  if (typeof secret !== 'string' || secret.length < 16) throw new Error('Access secret not configured');
  const expires = Math.floor(now / 1000) + MAX_AGE;
  const payload = `v1.${expires}.${randomBytes(16).toString('base64url')}`;
  return `${payload}.${signature(payload, secret)}`;
}

export function checkSession(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 512 || typeof secret !== 'string' || secret.length < 16) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !/^\d{10,}$/.test(parts[1]) || !/^[A-Za-z0-9_-]{20,}$/.test(parts[2])) return false;
  const expires = Number(parts[1]);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(now / 1000) || expires > Math.floor(now / 1000) + MAX_AGE) return false;
  const actual = Buffer.from(parts[3], 'base64url');
  const wanted = Buffer.from(signature(parts.slice(0, 3).join('.'), secret), 'base64url');
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}

export function getSession(req) {
  const cookie = typeof req.headers?.cookie === 'string' ? req.headers.cookie : '';
  const pair = cookie.split(';').map(s => s.trim()).find(s => s.startsWith(`${COOKIE_NAME}=`));
  if (!pair) return '';
  const value = pair.slice(COOKIE_NAME.length + 1);
  return value.length <= 512 ? value : '';
}

export function isAuthorized(req, secret) {
  return checkSession(getSession(req), secret) || verifyAccess(req.headers?.['x-caderno-access'], secret);
}

export function sessionCookie(token) {
  return `${COOKIE_NAME}=${token}; Max-Age=${MAX_AGE}; Path=/api; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie() {
  return `${COOKIE_NAME}=; Max-Age=0; Path=/api; HttpOnly; Secure; SameSite=Lax`;
}

export function isSameOrigin(req) {
  const origin = req.headers?.origin;
  if (!origin) return true;
  try { const url = new URL(origin); return url.protocol === 'https:' && url.host === req.headers.host; }
  catch { return false; }
}