import test from 'node:test';
import assert from 'node:assert/strict';
import accessHandler from '../api/access.mjs';
import { createSession, checkSession, getSession, verifyAccess, isSameOrigin } from '../lib/ai-auth.mjs';
const secret = 'a-32-character-test-secret-not-real';
const req = (method, code, headers={}) => ({method,headers:{host:'caderno-da-palavra.vercel.app',origin:'https://caderno-da-palavra.vercel.app','content-type':'application/json',...headers},body:{code}});
function res(){return { statusCode:200, headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this}, status(x){this.statusCode=x;return this},json(x){this.body=x;return this}};}
async function call(request){const old=process.env.AI_ACCESS_TOKEN;process.env.AI_ACCESS_TOKEN=secret;try{const r=res();await accessHandler(request,r);return r;}finally{if(old===undefined)delete process.env.AI_ACCESS_TOKEN;else process.env.AI_ACCESS_TOKEN=old;}}

test('creates verifiable signed cookie with expiry',()=>{const s=createSession(secret);assert.equal(checkSession(s,secret),true);assert.equal(checkSession(s,'changed-secret-that-is-not-valid'),false);assert.equal(checkSession(s,secret,Date.now()+31*86400000),false);});
test('rejects tampering',()=>{const s=createSession(secret);assert.equal(checkSession(s.slice(0,-2)+'zz',secret),false);});
test('accepts correct code and returns secure HttpOnly cookie',async()=>{const r=await call(req('POST',secret));assert.equal(r.statusCode,200);assert.equal(r.body.authorized,true);assert.match(r.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Lax/);});
test('cookie survives new requests and can be revoked',async()=>{const auth=await call(req('POST',secret));const cookie=auth.headers['Set-Cookie'].split(';')[0];const status=await call(req('GET',undefined,{cookie}));assert.deepEqual(status.body,{authorized:true});const rev=await call(req('DELETE',undefined,{cookie}));assert.equal(rev.statusCode,200);assert.match(rev.headers['Set-Cookie'],/Max-Age=0/);});
test('no access by default',async()=>{const r=await call(req('GET'));assert.deepEqual(r.body,{authorized:false});});
test('rejects incorrect access code',async()=>{const r=await call(req('POST','wrong-but-long-code-12345'));assert.equal(r.statusCode,401);assert.equal(r.headers['Set-Cookie'],undefined);});
test('rejects foreign origins',async()=>{const r=await call(req('POST',secret,{origin:'https://evil.example'}));assert.equal(r.statusCode,403);});
test('recognizes legacy token and secure cookie',()=>{assert.equal(verifyAccess(secret,secret),true);assert.equal(isSameOrigin(req('GET')),true);const s=createSession(secret);assert.equal(getSession(req('GET',undefined,{cookie:`other=x; caderno_ai_session=${s}`})),s);});