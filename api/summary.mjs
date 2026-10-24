/**
 * Vercel Node.js Function: POST /api/summary
 * Uses Google Gemini Flash-Lite without exposing the API key to the browser.
 * This PWA has no account system, so a separate owner-only access token is required.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { isAuthorized } from '../lib/ai-auth.mjs';
import { studyInstructions, normalizeMode } from '../study-prompt.mjs';

const MODEL = 'gemini-3.5-flash-lite';
const MAX_REQUEST_BYTES = 24_000;
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;


function cleanText(value, max = 200) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function normalizeMeeting(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  if (!Array.isArray(body.references) || body.references.length > 80) return null;
  const references = [];
  for (const r of body.references) {
    if (!r || typeof r !== 'object' || Array.isArray(r) || typeof r.label !== 'string') return null;
    const label = cleanText(r.label, 120);
    if (!label) return null;
    const entry={reference:label,note:cleanText(r.note,600)};
    const scripture=cleanText(r.text,1600);if(scripture){entry.text=scripture;entry.translation='João Ferreira de Almeida (domínio público)';}
    references.push(entry);
  }
  const data = {
    title: cleanText(body.title),
    date: cleanText(body.date, 15),
    theme: cleanText(body.theme),
    speaker: cleanText(body.speaker),
    notes: cleanText(body.notes, 12_000),
    references,
  };
  if (!data.notes && references.length === 0) return null;
  return data;
}

export function verifyAccess(provided, expected) {
  if (typeof provided !== 'string' || typeof expected !== 'string' || expected.length < 16 || provided.length > 256) return false;
  const actual = createHash('sha256').update(provided).digest();
  const intended = createHash('sha256').update(expected).digest();
  return timingSafeEqual(actual, intended);
}

export function extractText(result) {
  return (result?.candidates?.[0]?.content?.parts || [])
    .filter(part => typeof part?.text === 'string')
    .map(part => part.text).join('\n').trim().slice(0, 40_000);
}

function json(res, code, payload) {
  return res.status(code).json(payload);
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Método não permitido.' });
  }
  // Extra cross-site guard. Not a replacement for the owner access token.
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin) {
    try { if (new URL(origin).host !== host || new URL(origin).protocol !== 'https:') return json(res, 403, { error: 'Origem não permitida.' }); }
    catch { return json(res, 403, { error: 'Origem inválida.' }); }
  }
  const apiKey = process.env.GEMINI_API_KEY;
  const expectedToken = process.env.AI_ACCESS_TOKEN;
  if (!apiKey || !expectedToken || expectedToken.length < 16) {
    return json(res, 503, { error: 'IA ainda não configurada na Vercel.' });
  }
  if (!isAuthorized(req, expectedToken)) {
    return json(res, 401, { error: 'Código de acesso incorreto. Confira Ajustes.' });
  }
  if (!String(req.headers['content-type'] || '').toLowerCase().includes('application/json')) {
    return json(res, 415, { error: 'Envie o conteúdo como JSON.' });
  }
  const declaredBytes = Number(req.headers['content-length'] || 0);
  if (declaredBytes > MAX_REQUEST_BYTES) return json(res, 413, { error: 'Culto muito grande para um único resumo.' });
  let body = req.body;
  try {
    if (typeof body === 'string') body = JSON.parse(body);
    if (Buffer.byteLength(JSON.stringify(body ?? '')) > MAX_REQUEST_BYTES) return json(res, 413, { error: 'Culto muito grande para um único resumo.' });
  } catch { return json(res, 400, { error: 'JSON inválido.' }); }
  const meeting = normalizeMeeting(body);
  if (!meeting) return json(res, 422, { error: 'Registre anotações ou passagens bíblicas antes de gerar o resumo.' });

  try {
    const upstream = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: studyInstructions(normalizeMode(body?.mode)) }] },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify(meeting) }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2500 },
      }),
      signal: AbortSignal.timeout(24_000),
    });
    if (upstream.status === 429) return json(res, 429, { error: 'Limite gratuito do Gemini atingido. Tente novamente mais tarde.' });
    if (!upstream.ok) return json(res, 502, { error: 'Não foi possível consultar o Gemini. Confira se o modelo está disponível no nível gratuito da sua conta.' });
    const result = await upstream.json();
    const summary = extractText(result);
    if (!summary) return json(res, 502, { error: 'O Gemini não retornou um resumo. Tente novamente.' });
    return json(res, 200, { summary, model: MODEL, mode: normalizeMode(body?.mode) });
  } catch {
    return json(res, 502, { error: 'O serviço de IA não respondeu. Tente novamente mais tarde.' });
  }
}