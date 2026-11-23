/* Filely — isolated entry-point bridge for «Дерево будущего».
 * Keeps the existing simulator engine/UI intact and reliably routes clicks to it.
 */
(function () {
  'use strict';

  if (window.FilelyFutureTreeBridge?.installed) return;

  const ERROR_ID = 'filely-future-tree-error';
  let opening = false;

  function getSimulatorUI() {
    return window.FINTEX_SIM?.ui || window.SIM?.ui || null;
  }

  function showError(message) {
    document.getElementById(ERROR_ID)?.remove();
    const panel = document.createElement('div');
    panel.id = ERROR_ID;
    panel.style.cssText = [
      'position:fixed', 'inset:0', 'z-index:100000', 'display:flex',
      'align-items:center', 'justify-content:center', 'padding:20px',
      'background:rgba(0,0,0,.72)', 'backdrop-filter:blur(8px)'
    ].join(';');
    panel.innerHTML = `
      <div style="width:min(100%,380px);padding:20px;border-radius:20px;background:#10211d;color:#f3f8f5;border:1px solid rgba(0,214,195,.28);font:14px/1.5 system-ui,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.4)">
        <div style="font-size:17px;font-weight:800;margin-bottom:8px">Дерево будущего пока недоступно</div>
        <div style="color:#a9bbb4;margin-bottom:16px">${escapeHtml(message)}</div>
        <div style="display:flex;gap:8px">
          <button type="button" data-ft-retry style="flex:1;padding:11px 14px;border:0;border-radius:12px;background:#00d6c3;color:#041311;font-weight:800">Повторить</button>
          <button type="button" data-ft-close style="padding:11px 14px;border:1px solid rgba(255,255,255,.15);border-radius:12px;background:transparent;color:#f3f8f5">Закрыть</button>
        </div>
      </div>`;
    document.body.appendChild(panel);
    panel.querySelector('[data-ft-retry]')?.addEventListener('click', () => {
      panel.remove();
      open();
    });
    panel.querySelector('[data-ft-close]')?.addEventListener('click', () => panel.remove());
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  function open(attempt = 0) {
    if (opening) return;
    opening = true;

    const ui = getSimulatorUI();
    if (!ui || typeof ui.openModal !== 'function') {
      opening = false;
      if (attempt < 20) {
        window.setTimeout(() => open(attempt + 1), 100);
      } else {
        showError('Не найден метод FINTEX_SIM.ui.openModal(). Проверьте, загрузились ли sim_engine.js и sim_ui.js.');
        console.error('[Filely Future Tree] Simulator UI is unavailable.', {
          simulator: window.FINTEX_SIM || window.SIM || null,
          scripts: Array.from(document.scripts).map((s) => s.src).filter(Boolean)
        });
      }
      return;
    }

    try {
      ui.openModal();
      const modal = document.getElementById('modal-life-sim');
      if (!modal || modal.classList.contains('hidden')) {
        throw new Error('Вызов выполнен, но окно симулятора не появилось.');
      }
      document.getElementById(ERROR_ID)?.remove();
      console.info('[Filely Future Tree] Modal opened successfully.');
    } catch (error) {
      console.error('[Filely Future Tree] Failed to open simulator:', error);
      showError(error?.message || 'Неизвестная ошибка при открытии симулятора.');
    } finally {
      opening = false;
    }
  }

  // Capture phase makes this independent from listeners attached to dynamic cards.
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;
    const trigger = target?.closest('[data-act="sim"], #sim-entry-analytics, [data-open-future-tree]');
    if (!trigger) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    open();
  }, true);

  window.FilelyFutureTreeBridge = {
    installed: true,
    open,
    version: '1.0.0'
  };
})();
