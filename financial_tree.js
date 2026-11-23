/* Filely — финансовое дерево на главном экране.
 * Самодостаточный модуль: не зависит от Tailwind, конкретных ключей хранилища
 * или наличия финансовых данных. Не изменяет баланс и историю операций.
 */
(() => {
  'use strict';
  if (window.__FILELY_TREE_V2__) return;
  window.__FILELY_TREE_V2__ = true;

  const ROOT_ID = 'filely-financial-tree';
  const MOUNT_ID = 'filely-financial-tree-mount';
  const STYLE_ID = 'filely-financial-tree-v2-style';
  let scheduled = false;

  const safeJSON = (key, fallback) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) { return fallback; }
  };
  const money = (v) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.max(0, Number(v) || 0)) + ' ₽';

  function metrics() {
    const goal = safeJSON('fp_goal', {});
    const txs = safeJSON('fp_local_tx', []);
    const saved = Math.max(0, Number(goal && (goal.saved ?? goal.current ?? goal.amount)) || 0);
    const target = Math.max(0, Number(goal && (goal.target ?? goal.goal)) || 0);
    const progress = target > 0 ? Math.min(1, saved / target) : 0;
    let income = 0, expenses = 0, count = 0;
    const from = new Date(); from.setDate(from.getDate() - 29); from.setHours(0,0,0,0);
    if (Array.isArray(txs)) txs.forEach(tx => {
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
    let level = 0;
    if (saved > 0 || count > 0) level = 1;
    if (progress >= .2) level = 2;
    if (progress >= .5) level = 3;
    if (target > 0 && progress >= 1) level = 4;
    if (count >= 5 && income >= expenses && level < 4) level++;
    const privacy = (() => { try { return localStorage.getItem('fp_privacy') === '1'; } catch (_) { return false; } })();
    return { saved, target, progress, level, income, expenses, count, privacy };
  }

  function addStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{box-sizing:border-box;position:relative;display:block;width:100%;min-height:250px;margin:14px 0 16px;padding:17px 17px 14px;overflow:hidden;border:1px solid rgba(77,226,171,.25);border-radius:25px;background:radial-gradient(ellipse at 78% 22%,rgba(22,177,125,.22),transparent 48%),linear-gradient(145deg,#10241f 0%,#091512 62%,#07100e 100%);color:#f5fff9;box-shadow:0 16px 42px rgba(0,0,0,.2),inset 0 1px 0 rgba(255,255,255,.07);font-family:Inter,system-ui,-apple-system,sans-serif;}
      #${ROOT_ID} *{box-sizing:border-box} #${ROOT_ID} .ft-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}
      #${ROOT_ID} .ft-kicker{font-size:10px;letter-spacing:.17em;text-transform:uppercase;color:#9ed9bd;font-weight:750}
      #${ROOT_ID} .ft-title{font-size:19px;line-height:1.2;font-weight:800;margin-top:4px;letter-spacing:-.03em}
      #${ROOT_ID} .ft-stage{font-size:10px;font-weight:700;color:#b6f4d4;border:1px solid rgba(105,238,177,.25);background:rgba(67,208,145,.1);border-radius:999px;padding:6px 9px;white-space:nowrap}
      #${ROOT_ID} .ft-body{display:grid;grid-template-columns:minmax(0,1fr) minmax(130px,48%);align-items:center;gap:4px;margin-top:6px}
      #${ROOT_ID} .ft-label{font-size:10px;color:rgba(236,255,245,.58);letter-spacing:.12em;text-transform:uppercase}
      #${ROOT_ID} .ft-saved{font-size:23px;font-weight:800;letter-spacing:-.04em;margin-top:5px;font-variant-numeric:tabular-nums}
      #${ROOT_ID} .ft-sub{font-size:10px;color:rgba(236,255,245,.58);margin-top:5px;line-height:1.4}
      #${ROOT_ID} .ft-art{width:100%;height:190px;display:block;object-fit:contain;object-position:center bottom;filter:drop-shadow(0 5px 18px rgba(35,220,145,.2));mix-blend-mode:screen;animation:ftTreeRise .7s ease-out both}
      #${ROOT_ID} .ft-bar{height:5px;border-radius:99px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:11px}
      #${ROOT_ID} .ft-bar>span{height:100%;display:block;border-radius:99px;background:linear-gradient(90deg,#0b9b70,#6af0ae);transition:width .6s ease}
      #${ROOT_ID} .ft-foot{display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid rgba(255,255,255,.1);padding-top:11px;margin-top:5px}
      #${ROOT_ID} .ft-note{font-size:10px;line-height:1.45;color:rgba(236,255,245,.65);flex:1}
      #${ROOT_ID} .ft-more{border:1px solid rgba(105,238,177,.28);border-radius:11px;padding:8px 11px;background:rgba(67,208,145,.1);color:#b6f4d4;font-size:10px;font-weight:750;cursor:pointer}
      #${ROOT_ID} .ft-details{font-size:10px;line-height:1.5;color:rgba(236,255,245,.65);border-top:1px solid rgba(255,255,255,.1);padding-top:10px;margin-top:10px}
      #${ROOT_ID} .ft-details[hidden]{display:none}
      @keyframes ftTreeRise{from{opacity:.3;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
      @media(prefers-reduced-motion:reduce){#${ROOT_ID} .ft-art{animation:none}#${ROOT_ID} .ft-bar>span{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function treeArt(level) {
    const stages = ['Первые ростки', 'Молодое дерево', 'Укрепляется', 'Пышная крона', 'Дерево цели'];
    const brightness = [0.58, 0.72, 0.84, 0.94, 1][level] || 1;
    return `<div class="ft-art-wrap" style="position:relative;width:100%;height:190px;display:flex;align-items:flex-end;justify-content:center;overflow:hidden"><img class="ft-art" src="./financial_tree_art.png?v=1" alt="${stages[level]}" style="opacity:${brightness};" loading="eager" decoding="async"></div>`;
  }

  function ensureMount(home) {
    let mount = document.getElementById(MOUNT_ID);
    if (mount && home.contains(mount)) return mount;
    mount = document.createElement('div');
    mount.id = MOUNT_ID;
    mount.setAttribute('aria-live','polite');
    const hero = home.querySelector('#hero-card-stage');
    if (hero && hero.parentNode) hero.insertAdjacentElement('afterend', mount);
    else home.insertBefore(mount, home.firstChild);
    return mount;
  }

  function render() {
    const home = document.getElementById('view-home');
    if (!home) return false;
    addStyles();
    const mount = ensureMount(home);
    let card = document.getElementById(ROOT_ID);
    if (!card) { card = document.createElement('section'); card.id = ROOT_ID; }
    if (card.parentElement !== mount) mount.appendChild(card);
    const m = metrics();
    const pct = m.target ? Math.round(m.progress*100) : 0;
    const labels = ['Начало пути','Первые ростки','Молодое дерево','Крепкие ветви','Пышная крона'];
    const notes = ['Посадите семя: начните фиксировать накопления.','Первые финансовые привычки уже дают рост.','Ваши накопления формируют устойчивую основу.','Последовательность помогает укреплять финансовую опору.','Вы достигли поставленной цели накоплений!'];
    const safeSaved = m.privacy ? '•••••• ₽' : money(m.saved);
    const goalLine = m.privacy ? 'Суммы скрыты режимом конфиденциальности' : m.target ? `${pct}% от цели · ${money(m.target)}` : 'Добавьте финансовую цель, чтобы отслеживать прогресс';
    card.innerHTML = `<div class="ft-head"><div><div class="ft-kicker">Ваш финансовый рост</div><div class="ft-title">Моё дерево</div></div><span class="ft-stage">${labels[m.level]}</span></div><div class="ft-body"><div><div class="ft-label">Накоплено</div><div class="ft-saved">${safeSaved}</div><div class="ft-sub">${goalLine}</div>${m.target?`<div class="ft-bar"><span style="width:${pct}%"></span></div>`:''}</div><div>${treeArt(m.level)}</div></div><div class="ft-foot"><div class="ft-note">${notes[m.level]}</div><button type="button" class="ft-more" aria-expanded="false">Подробнее</button></div><div class="ft-details" hidden>${m.privacy?'Финансовые суммы скрыты. ':''}Дерево меняется по мере того, как вы добавляете накопления и операции в Filely. Это визуальный мотиватор, а не финансовая оценка.</div>`;
    const btn = card.querySelector('.ft-more');
    const details = card.querySelector('.ft-details');
    btn.addEventListener('click', () => { details.hidden = !details.hidden; btn.setAttribute('aria-expanded', String(!details.hidden)); btn.textContent = details.hidden ? 'Подробнее' : 'Свернуть'; });
    return true;
  }

  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  }

  function boot() {
    render();
    const observer = new MutationObserver(() => {
      // Повторно монтируем карточку, только если приложение удалило её из DOM.
      if (!document.getElementById(ROOT_ID)) scheduleRender();
    });
    observer.observe(document.body, { childList:true, subtree:true });
    window.addEventListener('filely:financial-data-updated', scheduleRender);
    window.addEventListener('storage', scheduleRender);
    window.FilelyFinancialTree = { refresh: scheduleRender };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();
})();
