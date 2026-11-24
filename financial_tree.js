/* Filely — финансовое дерево на главном экране.
 * Самодостаточный модуль: устойчив к перестройке DOM и скрытию контейнеров,
 * использует financial_tree_art.png (с авто-прозрачностью и SVG-резервом),
 * реагирует на изменение накоплений, операций и режима «Стелс» в реальном времени.
 */
(() => {
  'use strict';
  if (window.__FILELY_TREE_V3__) return;
  window.__FILELY_TREE_V3__ = true;

  const ROOT_ID = 'filely-financial-tree';
  const MOUNT_ID = 'filely-financial-tree-mount';
  const STYLE_ID = 'filely-financial-tree-v3-style';
  const ART_SRC = './financial_tree_art.png?v=3';

  let scheduled = false;
  let detailsOpen = false;
  let processedArtUrl = null;
  let artLoadFailed = false;

  const safeJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  };

  const money = (v) =>
    new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.max(0, Number(v) || 0)) + ' ₽';

  function metrics() {
    const goal = safeJSON('fp_goal', {});
    const txs = safeJSON('fp_local_tx', []);
    const saved = Math.max(0, Number(goal && (goal.saved ?? goal.current ?? goal.amount)) || 0);
    const target = Math.max(0, Number(goal && (goal.target ?? goal.goal)) || 0);
    const goalTitle = (goal && goal.title) ? String(goal.title).trim() : 'Финансовая подушка';
    const progress = target > 0 ? Math.min(1, saved / target) : 0;

    let income = 0;
    let expenses = 0;
    let count = 0;
    const from = new Date();
    from.setDate(from.getDate() - 29);
    from.setHours(0, 0, 0, 0);

    if (Array.isArray(txs)) {
      txs.forEach((tx) => {
        if (!tx) return;
        const rawDate = tx.date || tx.createdAt || tx.timestamp;
        const date = rawDate ? new Date(rawDate) : null;
        if (date && !Number.isNaN(date.getTime()) && date < from) return;
        const amount = Math.abs(Number(tx.amount ?? tx.sum ?? tx.value) || 0);
        const type = String(tx.type || tx.kind || '').toLowerCase();
        if (type.includes('income') || type.includes('доход')) income += amount;
        else if (type.includes('expense') || type.includes('расход')) expenses += amount;
        else return;
        count++;
      });
    }

    let level = 0;
    if (saved > 0 || count > 0) level = 1;
    if (progress >= 0.2) level = 2;
    if (progress >= 0.5) level = 3;
    if (target > 0 && progress >= 1) level = 4;
    if (count >= 5 && income >= expenses && level < 4) level++;

    const privacy = (() => {
      try {
        return localStorage.getItem('fp_privacy') === '1';
      } catch (_) {
        return false;
      }
    })();

    return { saved, target, goalTitle, progress, level, income, expenses, count, privacy };
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${MOUNT_ID}{display:block !important;visibility:visible !important;opacity:1 !important;width:100%}
      #${ROOT_ID}{box-sizing:border-box;position:relative;display:block !important;visibility:visible !important;opacity:1 !important;width:100%;min-height:244px;margin:2px 0;padding:18px 17px 15px;overflow:hidden;border:1px solid rgba(77,226,171,.28);border-radius:26px;background:radial-gradient(ellipse at 78% 28%,rgba(0,214,195,.20),transparent 52%),radial-gradient(ellipse at 18% 88%,rgba(242,198,93,.09),transparent 48%),linear-gradient(150deg,#0f231e 0%,#081411 62%,#060f0d 100%);color:#f5fff9;box-shadow:0 18px 42px rgba(0,0,0,.34),inset 0 1px 0 rgba(255,255,255,.09);font-family:Inter,system-ui,-apple-system,sans-serif;}
      #${ROOT_ID} *{box-sizing:border-box}
      #${ROOT_ID} .ft-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;position:relative;z-index:2}
      #${ROOT_ID} .ft-kicker{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#8adbc1;font-weight:700}
      #${ROOT_ID} .ft-title{font-size:18px;line-height:1.2;font-weight:800;margin-top:3px;letter-spacing:-.02em;color:#ffffff}
      #${ROOT_ID} .ft-stage{font-size:10px;font-weight:700;color:#b6f4d4;border:1px solid rgba(105,238,177,.28);background:rgba(0,214,195,.12);border-radius:999px;padding:5px 10px;white-space:nowrap}
      #${ROOT_ID} .ft-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(136px,47%);align-items:center;gap:8px;margin-top:8px;position:relative;z-index:2}
      #${ROOT_ID} .ft-label{font-size:10px;color:rgba(236,255,245,.58);letter-spacing:.12em;text-transform:uppercase}
      #${ROOT_ID} .ft-saved{font-size:24px;font-weight:800;letter-spacing:-.03em;margin-top:4px;font-variant-numeric:tabular-nums;color:#ffffff}
      #${ROOT_ID} .ft-sub{font-size:11px;color:rgba(236,255,245,.68);margin-top:5px;line-height:1.4}
      #${ROOT_ID} .ft-bar{height:6px;border-radius:99px;background:rgba(255,255,255,.11);overflow:hidden;margin-top:11px}
      #${ROOT_ID} .ft-bar>span{height:100%;display:block;border-radius:99px;background:linear-gradient(90deg,#00D6C3 0%,#6af0ae 60%,#F2C65D 100%);transition:width .6s cubic-bezier(.22,1,.36,1)}
      #${ROOT_ID} .ft-art-wrap{position:relative;width:100%;height:164px;display:flex;align-items:flex-end;justify-content:center;cursor:pointer}
      #${ROOT_ID} .ft-aura{position:absolute;bottom:14px;width:132px;height:132px;border-radius:50%;background:radial-gradient(circle,rgba(0,214,195,.32) 0%,rgba(242,198,93,.12) 45%,transparent 72%);filter:blur(10px);pointer-events:none;transition:transform .5s ease,opacity .5s ease}
      #${ROOT_ID} .ft-img{position:relative;z-index:2;width:100%;max-width:176px;height:160px;object-fit:contain;object-position:bottom center;transform-origin:bottom center;transition:transform .55s cubic-bezier(.22,1,.36,1),filter .55s ease;animation:ftTreeRise .65s ease-out both;user-select:none;-webkit-user-drag:none}
      #${ROOT_ID} .ft-svg-art{position:relative;z-index:2;width:100%;height:160px;display:block;filter:drop-shadow(0 6px 16px rgba(35,220,145,.18));animation:ftTreeRise .65s ease-out both}
      #${ROOT_ID} .ft-foot{display:flex;justify-content:space-between;align-items:center;gap:8px;border-top:1px solid rgba(255,255,255,.09);padding-top:11px;margin-top:8px;position:relative;z-index:2}
      #${ROOT_ID} .ft-note{font-size:11px;line-height:1.4;color:rgba(236,255,245,.68);flex:1;min-width:0}
      #${ROOT_ID} .ft-actions{display:flex;align-items:center;gap:6px;shrink:0}
      #${ROOT_ID} .ft-topup{border:1px solid rgba(242,198,93,.35);border-radius:11px;padding:7px 10px;background:rgba(242,198,93,.14);color:#F2C65D;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}
      #${ROOT_ID} .ft-more{border:1px solid rgba(105,238,177,.28);border-radius:11px;padding:7px 10px;background:rgba(0,214,195,.12);color:#b6f4d4;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap}
      #${ROOT_ID} .ft-details{font-size:11px;line-height:1.5;color:rgba(236,255,245,.68);border-top:1px solid rgba(255,255,255,.09);padding-top:10px;margin-top:10px;position:relative;z-index:2}
      #${ROOT_ID} .ft-details[hidden]{display:none !important}
      @keyframes ftTreeRise{from{opacity:.35;transform:translateY(8px) scale(.94)}to{opacity:1}}
      @media(prefers-reduced-motion:reduce){#${ROOT_ID} .ft-img,#${ROOT_ID} .ft-svg-art{animation:none}#${ROOT_ID} .ft-bar>span{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function treeFallbackSvg(level) {
    const leafPoints = [
      [91, 67], [113, 49], [139, 35], [164, 49], [188, 68],
      [102, 91], [128, 78], [151, 78], [177, 92], [119, 111],
      [157, 111], [139, 16], [77, 83], [201, 83], [139, 128]
    ];
    const count = [2, 5, 8, 12, 15][level] || 2;
    const leaves = leafPoints
      .map(
        (p, i) =>
          `<ellipse cx="${p[0]}" cy="${p[1]}" rx="${i < count ? 7 : 4}" ry="${i < count ? 11 : 6}" transform="rotate(${
            i % 2 ? 32 : -32
          } ${p[0]} ${p[1]})" fill="${i < count ? 'url(#ftLeaf)' : '#2d7657'}" opacity="${i < count ? '.98' : '.18'}"/>`
      )
      .join('');
    return `<svg class="ft-svg-art" viewBox="0 0 280 190" role="img" aria-label="Финансовое дерево, стадия ${level + 1} из 5"><defs><linearGradient id="ftLeaf" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#c6ffdf"/><stop offset=".55" stop-color="#48d995"/><stop offset="1" stop-color="#087653"/></linearGradient><linearGradient id="ftBark"><stop stop-color="#805b3b"/><stop offset=".5" stop-color="#d5aa72"/><stop offset="1" stop-color="#68452e"/></linearGradient><radialGradient id="ftHalo"><stop stop-color="#28e39b" stop-opacity=".28"/><stop offset="1" stop-color="#28e39b" stop-opacity="0"/></radialGradient></defs><ellipse cx="140" cy="166" rx="104" ry="21" fill="url(#ftHalo)"/><path d="M140 166 C132 139 143 111 139 82 C137 61 140 43 140 26" fill="none" stroke="url(#ftBark)" stroke-width="10" stroke-linecap="round"/><path d="M140 137 C119 119 104 98 91 74 M140 121 C161 104 177 85 189 62 M139 105 C124 85 119 68 116 53 M142 96 C158 77 164 61 165 49" fill="none" stroke="#b98b5b" stroke-width="4" stroke-linecap="round" opacity="${level === 0 ? '.35' : '.95'}"/>${leaves}<path d="M140 162 C121 172 108 172 94 173 M140 162 C159 172 173 172 187 173" stroke="#a47a50" stroke-width="2.5" fill="none" stroke-linecap="round"/></svg>`;
  }

  function stripWhiteBackgroundIfNeeded(imgEl) {
    if (!imgEl || processedArtUrl || imgEl.dataset.ftChecked === '1') return;
    imgEl.dataset.ftChecked = '1';
    try {
      const w = imgEl.naturalWidth;
      const h = imgEl.naturalHeight;
      if (!w || !h) return;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(imgEl, 0, 0);
      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      // Проверяем углы: если PNG уже прозрачный (alpha < 20), повторная обработка не нужна
      const corners = [0, (w - 1) * 4, ((h - 1) * w) * 4, ((h - 1) * w + (w - 1)) * 4];
      const hasOpaqueWhiteCorners = corners.some((idx) => d[idx + 3] > 220 && d[idx] > 235 && d[idx + 1] > 235 && d[idx + 2] > 235);
      if (!hasOpaqueWhiteCorners) {
        processedArtUrl = imgEl.src;
        return;
      }

      // Удаляем сплошной белый фон от краёв изображения
      const visited = new Uint8Array(w * h);
      const stack = [0, w - 1, (h - 1) * w, h * w - 1];
      while (stack.length) {
        const pos = stack.pop();
        if (visited[pos]) continue;
        visited[pos] = 1;
        const p4 = pos * 4;
        if (d[p4] > 234 && d[p4 + 1] > 234 && d[p4 + 2] > 234) {
          d[p4 + 3] = 0;
          const x = pos % w;
          const y = (pos - x) / w;
          if (x > 0) stack.push(pos - 1);
          if (x + 1 < w) stack.push(pos + 1);
          if (y > 0) stack.push(pos - w);
          if (y + 1 < h) stack.push(pos + w);
        }
      }
      ctx.putImageData(imgData, 0, 0);
      processedArtUrl = canvas.toDataURL('image/png');
      imgEl.src = processedArtUrl;
    } catch (_) {
      // Если canvas недоступен (например, file://), оставляем исходный src
    }
  }

  function treeVisual(level) {
    if (artLoadFailed) return treeFallbackSvg(level);
    const scales = [0.74, 0.82, 0.90, 0.96, 1.02];
    const glows = [
      'drop-shadow(0 6px 14px rgba(0, 214, 195, 0.22)) brightness(0.92)',
      'drop-shadow(0 8px 18px rgba(0, 214, 195, 0.30)) brightness(0.98)',
      'drop-shadow(0 10px 22px rgba(0, 214, 195, 0.38)) brightness(1.03)',
      'drop-shadow(0 12px 26px rgba(72, 217, 149, 0.45)) brightness(1.06)',
      'drop-shadow(0 14px 30px rgba(242, 198, 93, 0.48)) brightness(1.10)'
    ];
    const auraScales = [0.72, 0.84, 0.96, 1.08, 1.2];
    const src = processedArtUrl || ART_SRC;
    return `
      <div class="ft-aura" style="transform:scale(${auraScales[level] || 0.85});opacity:${0.55 + level * 0.1};"></div>
      <img
        class="ft-img"
        src="${src}"
        alt="Финансовое дерево, стадия ${level + 1} из 5"
        style="transform:scale(${scales[level] || 0.85});filter:${glows[level] || glows[1]};"
      />
    `;
  }

  function isHiddenEl(el) {
    if (!el) return false;
    return el.classList.contains('hidden') || el.hasAttribute('hidden') || el.style.display === 'none';
  }

  function unhideElement(el) {
    if (!el) return;
    el.classList.remove('hidden');
    el.removeAttribute('hidden');
    el.style.setProperty('display', 'block', 'important');
    el.style.setProperty('visibility', 'visible', 'important');
    el.style.setProperty('opacity', '1', 'important');
  }

  function ensureMount(home) {
    let mount = document.getElementById(MOUNT_ID);
    if (!mount) {
      mount = document.createElement('div');
      mount.id = MOUNT_ID;
      mount.setAttribute('aria-live', 'polite');
    }
    mount.dataset.ftxKeep = '1';
    if (!home.contains(mount)) {
      const hero = home.querySelector('#hero-card-stage');
      if (hero && hero.parentNode === home) {
        hero.insertAdjacentElement('afterend', mount);
      } else {
        home.insertBefore(mount, home.firstChild);
      }
    }
    unhideElement(mount);
    return mount;
  }

  function render() {
    const home = document.getElementById('view-home');
    if (!home) return false;
    addStyles();
    const mount = ensureMount(home);
    let card = document.getElementById(ROOT_ID);
    if (!card) {
      card = document.createElement('section');
      card.id = ROOT_ID;
    }
    if (card.parentElement !== mount) {
      mount.appendChild(card);
    }
    unhideElement(card);

    const m = metrics();
    const pct = m.target ? Math.round(m.progress * 100) : 0;
    const labels = ['Начало пути', 'Первые ростки', 'Молодое дерево', 'Крепкие ветви', 'Пышная крона'];
    const notes = [
      'Посадите семя: начните фиксировать накопления.',
      'Первые финансовые привычки уже дают рост.',
      'Ваши накопления формируют устойчивую основу.',
      'Последовательность помогает укреплять опору.',
      'Цель достигнута! Финансовое дерево в расцвете.'
    ];
    const safeSaved = m.privacy ? '•••••• ₽' : money(m.saved);
    const goalLine = m.privacy
      ? 'Суммы скрыты режимом «Стелс»'
      : m.target
      ? `${pct}% от цели · ${money(m.target)}`
      : 'Добавьте цель, чтобы отслеживать прогресс';

    card.innerHTML = `
      <div class="ft-head">
        <div>
          <div class="ft-kicker">Ваш финансовый рост</div>
          <div class="ft-title">Моё дерево</div>
        </div>
        <span class="ft-stage">${labels[m.level]}</span>
      </div>
      <div class="ft-body">
        <div>
          <div class="ft-label">Накоплено</div>
          <div class="ft-saved">${safeSaved}</div>
          <div class="ft-sub">${goalLine}</div>
          ${m.target ? `<div class="ft-bar"><span style="width:${pct}%"></span></div>` : ''}
        </div>
        <div class="ft-art-wrap" role="button" tabindex="0" title="Открыть финансовую подушку">
          ${treeVisual(m.level)}
        </div>
      </div>
      <div class="ft-foot">
        <div class="ft-note">${notes[m.level]}</div>
        <div class="ft-actions">
          <button type="button" class="ft-topup">+ Пополнить</button>
          <button type="button" class="ft-more" aria-expanded="${detailsOpen}">${detailsOpen ? 'Свернуть' : 'Подробнее'}</button>
        </div>
      </div>
      <div class="ft-details" ${detailsOpen ? '' : 'hidden'}>
        ${m.privacy ? 'Финансовые суммы скрыты. ' : ''}Дерево растёт по мере того, как вы пополняете финансовую подушку и ведёте учёт операций в FINTEX. Это визуальный ориентир прогресса.
      </div>
    `;

    const imgEl = card.querySelector('.ft-img');
    if (imgEl) {
      if (imgEl.complete && imgEl.naturalWidth > 0) {
        stripWhiteBackgroundIfNeeded(imgEl);
      } else {
        imgEl.addEventListener('load', () => stripWhiteBackgroundIfNeeded(imgEl), { once: true });
        imgEl.addEventListener(
          'error',
          () => {
            artLoadFailed = true;
            const wrap = card.querySelector('.ft-art-wrap');
            if (wrap) wrap.innerHTML = treeFallbackSvg(m.level);
          },
          { once: true }
        );
      }
    }

    const openGoal = () => {
      if (typeof window.openGoalDetailsModal === 'function') {
        window.openGoalDetailsModal();
      }
    };
    card.querySelector('.ft-art-wrap')?.addEventListener('click', openGoal);
    card.querySelector('.ft-topup')?.addEventListener('click', openGoal);

    const moreBtn = card.querySelector('.ft-more');
    const detailsEl = card.querySelector('.ft-details');
    moreBtn?.addEventListener('click', () => {
      detailsOpen = !detailsOpen;
      if (detailsEl) detailsEl.hidden = !detailsOpen;
      moreBtn.setAttribute('aria-expanded', String(detailsOpen));
      moreBtn.textContent = detailsOpen ? 'Свернуть' : 'Подробнее';
    });

    return true;
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      render();
    });
  }

  function hookLocalStorage() {
    if (window.__FILELY_TREE_LS_HOOKED__) return;
    window.__FILELY_TREE_LS_HOOKED__ = true;
    try {
      const origSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        origSetItem.apply(this, arguments);
        if (this === window.localStorage && /^(fp_goal|fp_local_tx|fp_balance|fp_privacy)$/.test(String(key))) {
          scheduleRender();
        }
      };
    } catch (_) {}
  }

  function boot() {
    hookLocalStorage();
    render();

    const observer = new MutationObserver(() => {
      const mount = document.getElementById(MOUNT_ID);
      const card = document.getElementById(ROOT_ID);
      if (!mount || !card) {
        scheduleRender();
        return;
      }
      if (isHiddenEl(mount)) unhideElement(mount);
      if (isHiddenEl(card)) unhideElement(card);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'hidden']
    });

    window.addEventListener('filely:financial-data-updated', scheduleRender);
    window.addEventListener('storage', scheduleRender);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') scheduleRender();
    });
    window.FilelyFinancialTree = { refresh: scheduleRender };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
