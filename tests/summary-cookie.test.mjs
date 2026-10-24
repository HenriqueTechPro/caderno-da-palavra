import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/summary.mjs';
import { createSession } from '../lib/ai-auth.mjs';

const key = 'test-only-gemini-key';
const secret = 'test-only-private-access-token-1234';
const notes = { title: 'Culto de teste', date: '2026-10-24', notes: 'Anotações sobre fé', references: [{ label: 'João 3:16', note: 'Amor' }] };
const response = () => ({
  statusCode: 200, body: null, headers: {},
  setHeader(k, v) { this.headers[k] = v; return this; },
  status(n) { this.statusCode = n; return this; },
  json(data) { this.body = data; return this; }
});

test('o resumo aceita cookie assinado, sem enviar código no frontend', async () => {
  const oldKey = process.env.GEMINI_API_KEY, oldSecret = process.env.AI_ACCESS_TOKEN, oldFetch = globalThis.fetch;
  process.env.GEMINI_API_KEY = key; process.env.AI_ACCESS_TOKEN = secret;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return {ok:true, status:200, async json(){return { candidates:[{content:{parts:[{text:'Resumo da pregação'}]}}]}}}; };
  try {
    const req = {method:'POST', headers:{ origin:'https://caderno-da-palavra.vercel.app', host:'caderno-da-palavra.vercel.app', cookie:`caderno_ai_session=${createSession(secret)}`, 'content-type':'application/json'}, body:notes};
    const res = response(); await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body?.summary, 'Resumo da pregação');
    assert.equal(calls, 1);
  } finally {
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = oldKey;
    if (oldSecret === undefined) delete process.env.AI_ACCESS_TOKEN; else process.env.AI_ACCESS_TOKEN = oldSecret;
    globalThis.fetch = oldFetch;
  }
});

test('o resumo rejeita cookie falsificado', async () => {
  const oldKey=process.env.GEMINI_API_KEY,oldSecret=process.env.AI_ACCESS_TOKEN;
  process.env.GEMINI_API_KEY=key; process.env.AI_ACCESS_TOKEN=secret;
  try {
    const req={method:'POST', headers:{origin:'https://caderno-da-palavra.vercel.app',host:'caderno-da-palavra.vercel.app',cookie:'caderno_ai_session=invalid-token','content-type':'application/json'},body:notes};
    const res=response(); await handler(req,res); assert.equal(res.statusCode,401);
  } finally {
    if(oldKey===undefined)delete process.env.GEMINI_API_KEY;else process.env.GEMINI_API_KEY=oldKey;
    if(oldSecret===undefined)delete process.env.AI_ACCESS_TOKEN;else process.env.AI_ACCESS_TOKEN=oldSecret;
  }
});