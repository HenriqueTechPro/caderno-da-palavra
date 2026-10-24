/** Manual-update UI for the offline-first Caderno da Palavra PWA. */
export const APP_VERSION = '1.1.0';

export function createUpdateManager({ browser, site, notify, persistDraft, changed, reload }) {
  let registration = null;
  let status = 'initial';
  let checkedAt = null;
  let applying = false;

  const updateUI = () => { if (typeof changed === 'function') changed(); };
  function state() { return { status, checkedAt, version: APP_VERSION }; }
  function panel() {
    const messages = {
      initial: 'Preparando verificação de atualizações...',
      checking: 'Verificando se existe uma nova versão...',
      current: 'Você está usando a versão mais recente disponível.',
      available: 'Há uma atualização disponível para instalação.',
      offline: 'Conecte-se à internet para verificar atualizações.',
      unsupported: 'Atualização automática indisponível neste navegador.',
      error: 'Não foi possível verificar atualizações. Tente novamente.',
      installing: 'Instalando atualização e preparando reinicialização...'
    };
    const stamp = checkedAt ? `<small class="muted">Última verificação: ${new Date(checkedAt).toLocaleString('pt-BR')}</small>` : '';
    return `<section class="panel stack" id="app-update-panel" aria-label="Atualizações do aplicativo">
      <div class="row-between"><h2 style="margin:0">↻ Atualizações do aplicativo</h2><span class="pill">v${APP_VERSION}</span></div>
      <p class="muted subtitle" id="app-update-status" role="status">${messages[status]}</p>
      ${stamp}
      <div class="actions">
        <button class="secondary" id="check-app-update" ${status === 'checking' || status === 'installing' ? 'disabled' : ''}>Verificar atualizações</button>
        ${status === 'available' ? '<button class="primary" id="install-app-update">Atualizar agora</button>' : ''}
      </div>
      <p class="muted subtitle">Seus cultos, versículos e anotações continuam salvos neste dispositivo. As atualizações não apagam o IndexedDB. Faça backups regularmente.</p>
    </section>`;
  }

  function watchInstalling(worker) {
    if (!worker) return;
    worker.addEventListener('statechange', () => {
      if (worker.state === 'installed' && browser.serviceWorker.controller) {
        status = 'available'; updateUI(); notify?.('Nova versão disponível em Ajustes.');
      }
    });
  }

  async function start() {
    if (!browser?.serviceWorker || site.protocol === 'file:') { status = 'unsupported'; updateUI(); return; }
    try {
      browser.serviceWorker.addEventListener('controllerchange', () => {
        if (applying) reload();
      });
      registration = await browser.serviceWorker.register('./sw.js', { updateViaCache: 'none' });
      registration.addEventListener('updatefound', () => watchInstalling(registration.installing));
      if (registration.installing) watchInstalling(registration.installing);
      status = registration.waiting && browser.serviceWorker.controller ? 'available' : 'current';
      updateUI();
      if (browser.onLine) await check(false);
    } catch { status = 'error'; updateUI(); }
  }

  async function check(manual = true) {
    if (!browser?.serviceWorker || site.protocol === 'file:') { status = 'unsupported'; updateUI(); return; }
    if (!browser.onLine) { status = 'offline'; updateUI(); if (manual) notify?.('Sem conexão à internet.'); return; }
    status = 'checking'; updateUI();
    try {
      if (!registration) registration = await browser.serviceWorker.getRegistration('./');
      if (!registration) { status = 'error'; updateUI(); return; }
      await registration.update();
      checkedAt = Date.now();
      status = registration.waiting && browser.serviceWorker.controller ? 'available' : 'current';
      updateUI();
      if (manual) notify?.(status === 'available' ? 'Atualização pronta para instalar.' : 'Verificação concluída.');
    } catch { status = 'error'; updateUI(); if (manual) notify?.('Não foi possível verificar atualizações.'); }
  }

  async function install() {
    if (!registration?.waiting || !browser.serviceWorker.controller) { await check(true); return; }
    try {
      await persistDraft();
      applying = true;
      status = 'installing'; updateUI();
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      applying = false;
      status = 'available'; updateUI();
      notify?.('Não foi possível salvar as alterações antes de atualizar.');
    }
  }

  return { state, panel, start, check, install };
}