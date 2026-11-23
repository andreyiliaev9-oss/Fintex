/* Filely — живое финансовое дерево на главном экране.
 * Визуальный рост основан только на данных, уже сохранённых в приложении:
 * fp_goal (накопления/цель) и fp_local_tx (операции за последние 30 дней).
 * Модуль не меняет баланс, цели или историю операций.
 */
(function () {
  'use strict';

  const ROOT_ID = 'filely-financial-tree';
  const STYLE_ID = 'filely-financial-tree-style';
  const fmt = (value) => new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 0
  }).format(Math.round(Number(value) || 0)) + ' ₽';

  function readJSON(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function getMetrics() {
    const goal = readJSON('fp_goal', { saved: 0, target: 10000 });
    const transactions = readJSON('fp_local_tx', []);
    const saved = Math.max(0, Number(goal?.saved) || 0);
    const target = Math.max(0, Number(goal?.target) || 0);
    const progress = target > 0 ? Math.min(1, saved / target) : 0;
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
    let income = 0;
    let expenses = 0;
    let count = 0;

    (Array.isArray(transactions) ? transactions : []).forEach((tx) => {
      if (!tx || !tx.date) return;
      const date = new Date(String(tx.date) + 'T12:00:00');
      if (Number.isNaN(date.getTime()) || date < cutoff || date > todayEnd) return;
      const amount = Math.max(0, Number(tx.amount) || 0);
      if (tx.type === 'income') income += amount;
      else if (tx.type === 'expense') expenses += amount;
      else return;
      count++;
    });

    const net = income - expenses;
    const privacy = localStorage.getItem('fp_privacy') === '1';
    let level = 0;
    if (saved > 0 || (count >= 3 && net > 0)) level = 1;
    if (progress >= 0.25) level = 2;
    if (progress >= 0.6) level = 3;
    if (target > 0 && progress >= 1) level = 4;
    if (count >= 5 && net > 0) level = Math.min(4, level + 1);

    const labels = [
      'Семя посажено',
      'Первые ростки',
      'Молодое дерево',
      'Крепкие ветви',
      'Пышная крона'
    ];
    const descriptions = [
      'Начните откладывать — и появятся первые ростки.',
      'Первые накопления уже заложили основу роста.',
      'Ваши накопления превращаются в устойчивую основу.',
      'Вы последовательно укрепляете финансовую опору.',
      'Цель накоплений достигнута. Отличная работа!'
    ];

    return { saved, target, progress, income, expenses, net, count, level, privacy, label: labels[level], description: descriptions[level] };
  }

  function leaf(cx, cy, scale, opacity, rotate) {
    return `<ellipse cx="${cx}" cy="${cy}" rx="${5.5 * scale}" ry="${9 * scale}" transform="rotate(${rotate} ${cx} ${cy})" fill="url(#ft-leaf)" opacity="${opacity}"/>`;
  }

  function treeSVG(level, positiveFlow) {
    const branchOpacity = [0.32, 0.55, 0.72, 0.9, 1][level];
    const leafOpacity = [0.14, 0.38, 0.62, 0.82, 1][level];
    const clusters = [
      [116, 68, 0.8, -28], [137, 53, 0.9, 24], [159, 67, 0.8, 42],
      [94, 91, 0.75, -45], [177, 91, 0.78, 38], [126, 91, 0.95, -12],
      [151, 87, 0.9, 18], [106, 48, 0.72, -12], [168, 48, 0.72, 32],
      [137, 34, 0.75, 8], [83, 72, 0.65, -48], [190, 72, 0.65, 48],
      [116, 112, 0.65, -25], [158, 112, 0.65, 25], [139, 20, 0.55, 0]
    ];
    const activeCount = Math.min(clusters.length, [2, 5, 9, 12, 15][level] + (positiveFlow ? 0 : 0));
    const leaves = clusters.map((p, i) => leaf(p[0], p[1], p[2], i < activeCount ? leafOpacity : 0.08, p[3])).join('');
    const sideBranches = level >= 1
      ? `<path d="M140 177 C120 150 105 131 91 103 M140 160 C160 139 177 120 188 96" stroke="#8A6945" stroke-width="5" fill="none" stroke-linecap="round" opacity="${branchOpacity}"/>`
      : '';
    const upperBranches = level >= 2
      ? `<path d="M126 137 C116 112 111 91 112 72 M151 139 C164 113 169 92 165 70 M138 116 C139 91 139 67 139 45" stroke="#9A744A" stroke-width="3.8" fill="none" stroke-linecap="round" opacity="${branchOpacity}"/>`
      : `<path d="M140 165 C132 143 132 124 139 107" stroke="#9A744A" stroke-width="3.8" fill="none" stroke-linecap="round"/>`;
    return `<svg class="ft-tree-art" viewBox="0 0 280 220" role="img" aria-label="Ваше финансовое дерево: ${['семя','первые ростки','молодое дерево','крепкие ветви','пышная крона'][level]}">
      <defs>
        <linearGradient id="ft-leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B6FFD9"/><stop offset=".48" stop-color="#35D995"/><stop offset="1" stop-color="#087B5C"/></linearGradient>
        <linearGradient id="ft-trunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6C4D32"/><stop offset=".5" stop-color="#D4A66B"/><stop offset="1" stop-color="#68482F"/></linearGradient>
        <radialGradient id="ft-ground"><stop offset="0" stop-color="#00D6A0" stop-opacity=".28"/><stop offset="1" stop-color="#00D6A0" stop-opacity="0"/></radialGradient>
        <filter id="ft-glow"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <ellipse cx="140" cy="194" rx="105" ry="22" fill="url(#ft-ground)"/>
      <path d="M140 190 C135 163 137 138 140 111 C143 83 140 66 140 48" stroke="url(#ft-trunk)" stroke-width="11" fill="none" stroke-linecap="round"/>
      ${sideBranches}${upperBranches}
      <path d="M140 185 C124 194 112 196 99 198 M140 185 C155 194 169 196 183 198 M140 185 L140 202" stroke="#9A744A" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".75"/>
      <g filter="url(#ft-glow)">${leaves}</g>
      <circle cx="140" cy="188" r="3" fill="#D8B47B"/>
    </svg>`;
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${ROOT_ID}{position:relative;overflow:hidden;border:1px solid rgba(65,220,165,.22);border-radius:26px;background:radial-gradient(100% 100% at 85% 10%,rgba(0,214,160,.16),transparent 58%),linear-gradient(145deg,#0B1917 0%,#07100F 72%,#050B0A 100%);box-shadow:0 18px 42px -28px rgba(0,214,160,.42),inset 0 1px 0 rgba(255,255,255,.07)}
      #${ROOT_ID} .ft-tree-art{width:100%;height:174px;display:block;animation:ftTreeAppear .8s cubic-bezier(.2,.8,.2,1) both}
      #${ROOT_ID} .ft-tree-glow{position:absolute;width:190px;height:120px;right:4%;top:12px;background:rgba(0,214,160,.12);filter:blur(42px);pointer-events:none}
      #${ROOT_ID} .ft-tree-progress{height:5px;border-radius:99px;background:rgba(255,255,255,.09);overflow:hidden}
      #${ROOT_ID} .ft-tree-progress>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#087B5C,#48E5A0);transition:width .65s ease}
      #${ROOT_ID} .ft-tree-detail[hidden]{display:none}
      @keyframes ftTreeAppear{from{opacity:.35;transform:translateY(8px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
      @media(prefers-reduced-motion:reduce){#${ROOT_ID} .ft-tree-art{animation:none}#${ROOT_ID} .ft-tree-progress>span{transition:none}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    const home = document.getElementById('view-home');
    const hero = document.getElementById('hero-card-stage');
    const mount = document.getElementById('filely-financial-tree-mount');
    if (!home || !hero) return;
    ensureStyles();
    let card = document.getElementById(ROOT_ID);
    if (!card) {
      card = document.createElement('section');
      card.id = ROOT_ID;
      card.className = 'p-4 card-enter';
    }
    if (mount && card.parentElement !== mount) mount.appendChild(card);
    else if (!mount && card.parentElement !== home) hero.insertAdjacentElement('afterend', card);

    const m = getMetrics();
    const pct = m.target > 0 ? Math.round(m.progress * 100) : 0;
    const hiddenAmount = '•••••• ₽';
    const flowText = m.privacy ? 'Суммы скрыты режимом конфиденциальности' : m.count
      ? (m.net >= 0 ? `Положительный поток за 30 дней: +${fmt(m.net)}` : `Движение за 30 дней: ${fmt(m.net)}`)
      : 'Добавляйте операции, чтобы видеть динамику';
    const goalText = m.privacy ? 'Суммы скрыты' : m.target > 0 ? `${fmt(m.saved)} из ${fmt(m.target)}` : `${fmt(m.saved)} накоплено`;

    card.innerHTML = `
      <div class="ft-tree-glow"></div>
      <div class="relative z-10 flex items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-[10px] font-bold uppercase tracking-[.18em] text-emerald-200/65">Ваш финансовый рост</div>
          <h2 class="text-lg font-extrabold tracking-tight text-white mt-1">Моё дерево</h2>
          <p class="text-[11px] text-white/55 mt-1">Растёт вместе с вашими накоплениями</p>
        </div>
        <span class="shrink-0 px-2.5 py-1 rounded-full border border-emerald-300/20 bg-emerald-300/10 text-[10px] font-bold text-emerald-200">${m.label}</span>
      </div>
      <div class="relative z-10 grid grid-cols-[1fr_1fr] items-center gap-1 mt-1">
        <div class="min-w-0">
          <div class="text-[10px] uppercase tracking-wider text-white/45">Накоплено</div>
          <div class="text-xl font-extrabold text-white tabular-nums mt-1">${m.privacy ? hiddenAmount : fmt(m.saved)}</div>
          <div class="text-[10px] text-white/55 mt-1">${goalText}</div>
          ${m.target > 0 ? `<div class="ft-tree-progress mt-2"><span style="width:${pct}%"></span></div><div class="text-[10px] text-emerald-200/75 mt-1">${m.privacy ? '••% цели' : pct + '% цели'}</div>` : ''}
        </div>
        <div class="relative">${treeSVG(m.level, m.count > 0 && m.net > 0)}</div>
      </div>
      <div class="relative z-10 flex items-center justify-between gap-2 border-t border-white/[.08] pt-3 mt-1">
        <p class="text-[10px] leading-relaxed text-white/60 min-w-0">${m.description}</p>
        <button type="button" class="ft-tree-more shrink-0 text-[10px] font-bold text-emerald-200 px-3 py-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.08]" aria-expanded="false">Подробнее</button>
      </div>
      <div class="ft-tree-detail relative z-10 mt-3 pt-3 border-t border-white/[.08]" hidden>
        <div class="text-[10px] text-white/65">${flowText}</div>
        <div class="text-[10px] text-white/45 mt-1">Дерево отражает только накопления и операции, записанные в Filely. Это визуальная мотивация, а не оценка кредитоспособности или финансового здоровья.</div>
      </div>
    `;
    const more = card.querySelector('.ft-tree-more');
    const detail = card.querySelector('.ft-tree-detail');
    more?.addEventListener('click', () => {
      const opening = detail.hidden;
      detail.hidden = !opening;
      more.setAttribute('aria-expanded', String(opening));
      more.textContent = opening ? 'Свернуть' : 'Подробнее';
    });
  }

  function init() {
    render();
    const home = document.getElementById('view-home');
    if (!home || home.dataset.ftTreeObserver === '1') return;
    home.dataset.ftTreeObserver = '1';
    let queued = false;
    const observer = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => { queued = false; render(); });
    });
    ['hero-balance', 'hero-reserved', 'hero-free-pool', 'tx-feed', 'goal-saved-label', 'goal-target-label'].forEach((id) => {
      const node = document.getElementById(id);
      if (node) observer.observe(node, { childList: true, characterData: true, subtree: true });
    });
    window.addEventListener('filely:financial-data-updated', render);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
  window.FilelyFinancialTree = { refresh: render };
})();
