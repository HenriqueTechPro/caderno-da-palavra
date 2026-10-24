import test from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateManager, APP_VERSION } from '../pwa-updates.js';

function mocks({ online = true, waiting = false } = {}) {
  const events = {};
  const messages = [];
  let saved = 0;
  let reloaded = 0;
  let updates = 0;
  const worker = { postMessage: v => messages.push(v), addEventListener(event, handler) { events['worker:' + event] = handler; } };
  const reg = { waiting: waiting ? worker : null, installing: null, addEventListener(event, handler) { events['reg:' + event] = handler; }, async update() { updates++; } };
  const serviceWorker = { controller: {}, async register() { return reg; }, async getRegistration() { return reg; }, addEventListener(event, handler) { events['sw:' + event] = handler; } };
  const manager = createUpdateManager({ browser: { serviceWorker, onLine: online }, site: { protocol: 'https:' }, notify() {}, async persistDraft() { saved++; }, changed() {}, reload() { reloaded++; } });
  return { manager, events, messages, reg, worker, get values() { return { saved, reloaded, updates }; } };
}

test('exibe versão e controle em Ajustes', () => {
  const { manager } = mocks();
  assert.match(manager.panel(), /Atualizações do aplicativo/);
  assert.match(manager.panel(), new RegExp(APP_VERSION.replaceAll('.', '\\.')));
  assert.match(manager.panel(), /Verificar atualizações/);
});
test('verifica versão sem instalar automaticamente', async () => {
  const v = mocks();
  await v.manager.start();
  assert.equal(v.manager.state().status, 'current');
  assert.equal(v.values.updates, 1);
  assert.equal(v.messages.length, 0);
});
test('detecta atualização aguardando instalação', async () => {
  const v = mocks({ waiting: true });
  await v.manager.start();
  assert.equal(v.manager.state().status, 'available');
  assert.match(v.manager.panel(), /Atualizar agora/);
});
test('salva rascunho antes de ativar nova versão', async () => {
  const v = mocks({ waiting: true });
  await v.manager.start();
  await v.manager.install();
  assert.equal(v.values.saved, 1);
  assert.deepEqual(v.messages[0], { type: 'SKIP_WAITING' });
  assert.equal(v.values.reloaded, 0);
  v.events['sw:controllerchange']();
  assert.equal(v.values.reloaded, 1);
});
test('avisa quando está offline sem substituir estado por atualização disponível', async () => {
  const v = mocks({online: false});
  await v.manager.start();
  await v.manager.check(true);
  assert.equal(v.manager.state().status, 'offline');
  assert.equal(v.values.updates, 0);
});
test('evita reinicialização quando o navegador ativa o primeiro SW', async () => {
  const v = mocks();
  await v.manager.start();
  v.events['sw:controllerchange']();
  assert.equal(v.values.reloaded, 0);
});