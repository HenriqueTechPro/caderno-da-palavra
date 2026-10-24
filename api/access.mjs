import { clearSessionCookie, createSession, getSession, checkSession, isSameOrigin, sessionCookie, verifyAccess } from '../lib/ai-auth.mjs';

function send(res, status, data) { return res.status(status).json(data); }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const secret = process.env.AI_ACCESS_TOKEN;
  if (!isSameOrigin(req)) return send(res, 403, { error: 'Origem não permitida.' });

  if (req.method === 'GET') {
    const authorized = checkSession(getSession(req), secret);
    return send(res, 200, { authorized });
  }
  if (req.method === 'DELETE') {
    res.setHeader('Set-Cookie', clearSessionCookie());
    return send(res, 200, { authorized: false });
  }
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return send(res, 405, { error: 'Método não permitido.' });
  }
  if (!secret || secret.length < 16) return send(res, 503, { error: 'Código de acesso ainda não configurado na Vercel.' });
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) return send(res, 415, { error: 'Envie um JSON.' });
  if (Number(req.headers['content-length'] || 0) > 1024) return send(res, 413, { error: 'Solicitação muito grande.' });

  let body = req.body;
  try {
    if (typeof body === 'string') body = JSON.parse(body);
    if (Buffer.byteLength(JSON.stringify(body ?? '')) > 1024) return send(res, 413, { error: 'Solicitação muito grande.' });
  } catch { return send(res, 400, { error: 'JSON inválido.' }); }
  if (!verifyAccess(body?.code, secret)) return send(res, 401, { error: 'Código incorreto. Confira o AI_ACCESS_TOKEN na Vercel.' });

  res.setHeader('Set-Cookie', sessionCookie(createSession(secret)));
  return send(res, 200, { authorized: true });
}