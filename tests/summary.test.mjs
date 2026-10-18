import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { normalizeMeeting, verifyAccess, extractText } from '../api/summary.mjs';

const env = { GEMINI_API_KEY: 'fake-key-only-for-tests', AI_ACCESS_TOKEN: 'a-secure-test-code-with-32-chars' };
const valid = { title: 'Culto de domingo', theme: 'Fé', date: '2026-10-18', notes: 'Deus nos acompanha.', references: [{ label: 'João 3:16', note: 'Amor e salvação' }] };
function mockResponse() {
  return { statusCode: 200, headers: {}, body: null,
    setHeader(key, value) { this.headers[key] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}
async function request(options = {}) {
  const oldApi = process.env.GEMINI_API_KEY;
  const oldToken = process.env.AI_ACCESS_TOKEN;
  const oldFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = options.missingKey ? '' : env.GEMINI_API_KEY;
  process.env.AI_ACCESS_TOKEN = options.missingToken ? '' : env.AI_ACCESS_TOKEN;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return optionsFakeResponse();
  };
  function optionsFakeResponse() {
    const status = options.upstreamStatus ?? 200;
    return { status, ok: status === 200, async json() { return options.upstreamBody ?? { candidates: [{ content: { parts: [{ text: 'Tema central: Fé' }] } }] }; } };
  }
  const req = { method: options.method ?? 'POST', body: options.body ?? valid, headers: { host: 'caderno-da-palavra.vercel.app', origin: 'https://caderno-da-palavra.vercel.app', 'content-type': 'application/json', 'x-caderno-access': options.token ?? env.AI_ACCESS_TOKEN, ...options.headers } };
  const res = mockResponse();
  try { await handler(req, res); return { res, calls }; }
  finally {
    if (oldApi === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldApi;
    if (oldToken === undefined) delete process.env.AI_ACCESS_TOKEN; else process.env.AI_ACCESS_TOKEN = oldToken;
    globalThis.fetch = oldFetch;
  }
}

test('normalização mantém só campos esperados', () => {
  const data = normalizeMeeting({ ...valid, unexpected: 'ignore-me' });
  assert.deepEqual(Object.keys(data), ['title', 'date', 'theme', 'speaker', 'notes', 'references']);
  assert.deepEqual(data.references, [{ reference: 'João 3:16', note: 'Amor e salvação' }]);
});
test('normalização rejeita referências inválidas e cultos vazios', () => {
  assert.equal(normalizeMeeting({ ...valid, references: [{ label: '' }] }), null);
  assert.equal(normalizeMeeting({ ...valid, references: [], notes: ' ' }), null);
});
test('código de acesso requer comprimento e correspondência', () => {
  assert.equal(verifyAccess('correct-password-1234567890', 'correct-password-1234567890'), true);
  assert.equal(verifyAccess('incorrect-password-1234', 'correct-password-1234567890'), false);
  assert.equal(verifyAccess('short', 'short'), false);
});
test('extrai conteúdo do Gemini', () => {
  assert.equal(extractText({ candidates: [{ content: { parts: [{ text: 'Parte um' }, { text: 'Parte dois' }] } }] }), 'Parte um\nParte dois');
});
test('gera resumo sem enviar segredo ao cliente', async () => {
  const { res, calls } = await request();
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.summary, 'Tema central: Fé');
  assert.equal(res.body.model, 'gemini-3.5-flash-lite');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /gemini-3\.5-flash-lite:generateContent$/);
  assert.equal(calls[0].options.headers['x-goog-api-key'], 'fake-key-only-for-tests');
  assert.ok(!JSON.stringify(res.body).includes('fake-key'));
});
test('nega acesso sem token correto', async () => {
  const { res, calls } = await request({ token: 'senha-invalida-123456789' });
  assert.equal(res.statusCode, 401); assert.equal(calls.length, 0);
});
test('bloqueia IA sem configuração de segurança', async () => {
  const { res, calls } = await request({ missingToken: true });
  assert.equal(res.statusCode, 503); assert.equal(calls.length, 0);
});
test('bloqueia origem diferente', async () => {
  const { res, calls } = await request({ headers: { origin: 'https://outro-site.example' } });
  assert.equal(res.statusCode, 403); assert.equal(calls.length, 0);
});
test('não aceita chamadas GET', async () => {
  const { res, calls } = await request({ method: 'GET' });
  assert.equal(res.statusCode, 405); assert.equal(calls.length, 0);
});
test('rejeita corpo acima do limite', async () => {
  const { res, calls } = await request({ headers: { 'content-length': '30000' } });
  assert.equal(res.statusCode, 413); assert.equal(calls.length, 0);
});
test('trata corretamente cotas do Gemini', async () => {
  const { res } = await request({ upstreamStatus: 429 });
  assert.equal(res.statusCode, 429); assert.match(res.body.error, /Limite gratuito/);
});
test('trata resposta inesperada do Gemini', async () => {
  const { res } = await request({ upstreamBody: { candidates: [] } });
  assert.equal(res.statusCode, 502);
});