(function () {
  'use strict';

  let tgBackHandler = null;

  function injectStyles() {
    if (document.getElementById('fintex-quick-add-style')) return;
    const style = document.createElement('style');
    style.id = 'fintex-quick-add-style';
    style.textContent = `
      .ftx-plus-fab {
        width: 40px;
        height: 40px;
        border-radius: 15px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.22s ease;
      }
      .ftx-plus-fab:active {
        transform: scale(0.92);
      }
      .ftx-plus-fab.is-open {
        box-shadow: 0 0 0 4px rgba(0, 214, 195, 0.22), 0 10px 24px -6px rgba(0, 214, 195, 0.55);
      }
      @keyframes ftxHubSheetIn {
        0% { opacity: 0; transform: translate3d(0, 26px, 0); }
        100% { opacity: 1; transform: translate3d(0, 0, 0); }
      }
      #modal-smart-hub:not(.hidden) .modal-sheet {
        animation: ftxHubSheetIn 0.26s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .ftx-hub-row {
        transition: transform 0.14s ease, border-color 0.18s ease, background-color 0.18s ease;
      }
      .ftx-hub-row:active {
        transform: scale(0.985);
      }
    `;
    document.head.appendChild(style);
  }

  function bindBackButton() {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb || tgBackHandler) return;
    tgBackHandler = () => closeQuickAddSheet();
    try {
      bb.show();
      bb.onClick(tgBackHandler);
    } catch (_) {}
  }

  function unbindBackButton() {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb || !tgBackHandler) return;
    try {
      bb.offClick(tgBackHandler);
      bb.hide();
    } catch (_) {}
    tgBackHandler = null;
  }

  function setPlusState(isOpen) {
    const btn = document.getElementById('hdr-plus-btn');
    const icon = document.getElementById('hdr-plus-icon');
    if (btn) {
      btn.classList.toggle('is-open', isOpen);
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }
    if (icon) {
      icon.classList.toggle('is-open', isOpen);
    }
  }

  function openQuickAddSheet() {
    const modal = document.getElementById('modal-smart-hub');
    if (!modal) {
      if (typeof openAddModal === 'function') openAddModal();
      return;
    }
    try { if (typeof vibro === 'function') vibro('light'); } catch (_) {}
    modal.classList.remove('hidden');
    setPlusState(true);
    bindBackButton();
    try { if (window.lucide) lucide.createIcons(); } catch (_) {}
  }

  function closeQuickAddSheet() {
    const modal = document.getElementById('modal-smart-hub');
    if (modal) modal.classList.add('hidden');
    setPlusState(false);
    unbindBackButton();
  }

  function toggleQuickAddSheet() {
    const modal = document.getElementById('modal-smart-hub');
    if (modal && !modal.classList.contains('hidden')) {
      closeQuickAddSheet();
    } else {
      openQuickAddSheet();
    }
  }

  function launchAction(fn) {
    closeQuickAddSheet();
    if (typeof fn === 'function') fn();
  }

  function mountUnifiedHeaderButton() {
    const header = document.getElementById('home-header');
    if (!header) return;

    const oldPlus = document.getElementById('hdr-plus-btn');
    const cluster = oldPlus
      ? oldPlus.parentElement
      : header.querySelector(':scope > div:last-child');

    if (!cluster || cluster.dataset.ftxUnifiedPlus === '1') return;

    cluster.dataset.ftxUnifiedPlus = '1';
    cluster.className = 'flex items-center shrink-0';
    cluster.innerHTML = `
      <button
        type="button"
        id="hdr-plus-btn"
        aria-label="Добавить операцию"
        aria-expanded="false"
        title="Добавить операцию, чек или голос"
        class="ftx-plus-fab btn-turquoise"
      >
        <i id="hdr-plus-icon" data-lucide="plus" class="w-5 h-5 text-[#041311] plus-icon-rot"></i>
      </button>
    `;

    const btn = document.getElementById('hdr-plus-btn');
    if (btn) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleQuickAddSheet();
      });
    }
  }

  function unloadHomeScreenHubCard() {
    const hubCard = document.getElementById('smart-input-hub-card');
    if (hubCard) {
      hubCard.classList.add('hidden');
    }
  }

  function upgradeSmartHubSheet() {
    const modal = document.getElementById('modal-smart-hub');
    if (!modal || modal.dataset.ftxUnifiedSheet === '1') return;
    modal.dataset.ftxUnifiedSheet = '1';

    const sheet = modal.querySelector('.modal-sheet');
    if (!sheet) return;

    sheet.innerHTML = `
      <div class="sheet-handle"></div>
      <div class="flex items-center justify-between">
        <div>
          <span class="text-base font-extrabold text-main">Новая операция</span>
          <p class="text-[11px] text-sub">Ручной ввод, сканер чеков и голосовой ввод</p>
        </div>
        <button type="button" data-qact="close" class="w-8 h-8 rounded-full input-surface flex items-center justify-center text-sub tap" aria-label="Закрыть">
          <i data-lucide="x" class="w-4 h-4"></i>
        </button>
      </div>

      <div class="space-y-2">
        <div class="ftx-hub-row w-full p-3.5 rounded-2xl border border-[#00D6C3]/35 bg-[#00D6C3]/10 flex items-center justify-between gap-2">
          <button type="button" data-qact="manual-expense" class="flex items-center gap-3 text-left flex-1 min-w-0">
            <div class="w-10 h-10 rounded-xl btn-turquoise flex items-center justify-center shrink-0">
              <i data-lucide="pen-line" class="w-5 h-5 text-[#041311]"></i>
            </div>
            <div class="min-w-0">
              <div class="text-xs font-extrabold text-main">Ручной ввод</div>
              <div class="text-[10px] text-sub truncate">Быстрая запись расхода или пополнения</div>
            </div>
          </button>
          <button type="button" data-qact="manual-income" class="px-2.5 py-1.5 rounded-xl bg-emerald-400/15 border border-emerald-400/35 text-[10px] font-bold text-emerald-300 shrink-0 tap">
            + Доход
          </button>
        </div>

        <button type="button" data-qact="scan" class="ftx-hub-row w-full p-3.5 rounded-2xl input-surface border border-white/10 flex items-center justify-between text-left">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#00D6C3]/15 text-brand flex items-center justify-center shrink-0">
              <i data-lucide="scan-line" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold text-main">Сканер чеков и PDF</div>
              <div class="text-[10px] text-sub truncate">Камера, фото из галереи или электронный чек</div>
            </div>
          </div>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-[#00D6C3]/15 text-brand shrink-0">OCR+QR</span>
        </button>

        <button type="button" data-qact="voice" class="ftx-hub-row w-full p-3.5 rounded-2xl input-surface border border-white/10 flex items-center justify-between text-left">
          <div class="flex items-center gap-3 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-[#F2C65D]/15 text-gold flex items-center justify-center shrink-0">
              <i data-lucide="mic" class="w-5 h-5"></i>
            </div>
            <div class="min-w-0">
              <div class="text-xs font-bold text-main">Голосовой ввод</div>
              <div class="text-[10px] text-sub truncate">Продиктуйте одну или несколько покупок вслух</div>
            </div>
          </div>
          <span class="text-[9px] font-bold px-2 py-0.5 rounded bg-[#F2C65D]/15 text-gold shrink-0">Голос</span>
        </button>

        <div class="grid grid-cols-3 gap-2 pt-1">
          <button type="button" data-qact="balance-ocr" class="ftx-hub-row p-2.5 rounded-2xl input-surface border border-white/10 text-left space-y-1">
            <div class="w-7 h-7 rounded-lg bg-[#20C997]/15 text-mint flex items-center justify-center">
              <i data-lucide="smartphone-charging" class="w-3.5 h-3.5"></i>
            </div>
            <div class="text-[11px] font-bold text-main leading-tight">Скрин счёта</div>
            <div class="text-[9px] text-sub leading-tight">Сверка банка</div>
          </button>

          <button type="button" data-qact="clipboard" class="ftx-hub-row p-2.5 rounded-2xl input-surface border border-white/10 text-left space-y-1">
            <div class="w-7 h-7 rounded-lg bg-[#38BDF8]/15 text-[#38BDF8] flex items-center justify-center">
              <i data-lucide="clipboard-paste" class="w-3.5 h-3.5"></i>
            </div>
            <div class="text-[11px] font-bold text-main leading-tight">Из буфера</div>
            <div class="text-[9px] text-sub leading-tight">СМС или QR</div>
          </button>

          <button type="button" data-qact="can-buy" class="ftx-hub-row p-2.5 rounded-2xl input-surface border border-[#F2C65D]/20 text-left space-y-1">
            <div class="w-7 h-7 rounded-lg bg-[#F2C65D]/15 text-gold flex items-center justify-center">
              <i data-lucide="shield-question" class="w-3.5 h-3.5"></i>
            </div>
            <div class="text-[11px] font-bold text-main leading-tight">Можно купить?</div>
            <div class="text-[9px] text-sub leading-tight">Оценка риска</div>
          </button>
        </div>
      </div>
    `;

    sheet.querySelector('[data-qact="close"]')?.addEventListener('click', closeQuickAddSheet);
    sheet.querySelector('[data-qact="manual-expense"]')?.addEventListener('click', () => {
      launchAction(() => {
        if (typeof openAddModal === 'function') openAddModal();
        if (typeof switchAddMode === 'function') switchAddMode('expense');
      });
    });
    sheet.querySelector('[data-qact="manual-income"]')?.addEventListener('click', () => {
      launchAction(() => {
        if (typeof openAddModal === 'function') openAddModal();
        if (typeof switchAddMode === 'function') switchAddMode('income');
      });
    });
    sheet.querySelector('[data-qact="scan"]')?.addEventListener('click', () => {
      launchAction(() => {
        if (typeof openScanModal === 'function') openScanModal();
      });
    });
    sheet.querySelector('[data-qact="voice"]')?.addEventListener('click', () => {
      launchAction(() => {
        if (typeof openVoiceModal === 'function') openVoiceModal();
      });
    });
    sheet.querySelector('[data-qact="balance-ocr"]')?.addEventListener('click', () => {
      launchAction(() => {
        if (typeof openBalanceModal === 'function') openBalanceModal(true);
      });
    });
    sheet.querySelector('[data-qact="clipboard"]')?.addEventListener('click', () => {
      launchAction(() => {
        if (typeof readClipboardNow === 'function') readClipboardNow(true);
      });
    });
    sheet.querySelector('[data-qact="can-buy"]')?.addEventListener('click', () => {
      launchAction(() => {
        if (typeof openCanIBuyModal === 'function') openCanIBuyModal();
      });
    });
  }

  function patchGlobalHooks() {
    window.openSmartHubModal = openQuickAddSheet;

    if (typeof window.closeModals === 'function' && !window.closeModals.__ftxQuickAddWrapped) {
      const origCloseModals = window.closeModals;
      const wrappedClose = function (...args) {
        unbindBackButton();
        setPlusState(false);
        return origCloseModals.apply(this, args);
      };
      wrappedClose.__ftxQuickAddWrapped = true;
      window.closeModals = wrappedClose;
    }
  }

  function init() {
    injectStyles();
    mountUnifiedHeaderButton();
    unloadHomeScreenHubCard();
    upgradeSmartHubSheet();
    patchGlobalHooks();
    try { if (window.lucide) lucide.createIcons(); } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.FintexQuickAdd = {
    open: openQuickAddSheet,
    close: closeQuickAddSheet,
    toggle: toggleQuickAddSheet,
    refresh: init
  };
})();
