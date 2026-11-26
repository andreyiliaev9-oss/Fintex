/* Read-only guided tour. All selectors/copy are local constants; the only saved
 * values are tour status and an unfinished first-visit checkpoint. No demo ledger entries or financial actions. */
(() => {
  'use strict';
  if (window.FintexTour) return;
  const KEY = 'fp_tour_v1', CHECKPOINT = 'fp_tour_step_v1';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const steps = [
    {tab:'home',icon:'✦',chapter:'Знакомство',title:'Ваш маршрут по Fintex',text:'Короткий маршрут по вашим деньгам. Покажем нужное прямо в приложении — или выберите тему на карте.',tip:'Это безопасный просмотр: без пробных операций, списаний и изменений баланса.'},
    {tab:'home',target:'#hero-daily-budget',icon:'◷',chapter:'Главная',title:'Сколько доступно сегодня',text:'Это ваш ориентир на день: сколько можно потратить, распределив свободные деньги до зарплаты.',tip:'«Доступно сегодня» — ориентир по вашим данным, а не новый баланс и не банковский лимит.'},
    {tab:'home',target:'#capture-fab, #hdr-plus-btn',icon:'＋',chapter:'Добавление',title:'Запишите покупку удобным способом',text:'Capture читает фото чека или скриншот. А «+» в шапке — быстрый способ записать доход или расход вручную.',tip:'Распознанные данные можно проверить перед сохранением. Сейчас камера и выбор файлов не откроются.'},
    {tab:'home',target:'.tx-feed-header',icon:'≡',chapter:'Операции',title:'Вся история — в одном месте',text:'Доходы и расходы собраны по дням. Ищите по магазину, категории или сумме; касание записи открывает детали.',tip:'Кнопка «⋯» рядом с суммой открывает действия. Удаление не происходит от обычного касания строки.'},
    {tab:'calendar',target:'#cal-cells',icon:'▦',chapter:'Календарь',title:'Деньги на карте месяца',text:'Коснитесь даты, чтобы увидеть сводку дня. Здесь же — плановые платежи и дата зарплаты.',tip:'Из сводки дня можно перейти к операциям выбранной даты. Календарь не создаёт их повторно.'},
    {tab:'analytics',target:'.ap-cashflow-heading, #view-analytics h2',icon:'↗',chapter:'Аналитика',title:'Поймите, куда уходят деньги',text:'Сравнивайте доходы и расходы, категории и динамику. Чем больше записанных операций, тем полезнее картина.',tip:'Разница доходов и расходов — результат за период, а не остаток на банковском счёте.'},
    {tab:'home',target:'#savings-goals .sg-heading, #savings-goals',icon:'◎',chapter:'Цели',title:'У каждой мечты — своя цель',text:'У каждой цели — своя обложка, прогресс и пополнения. Плановый взнос поможет оценить, когда мечта станет ближе.',tip:'Отложенные деньги входят в ваш баланс, но исключены из доступных для трат. Автоматических списаний нет.'},
    {tab:'home',target:'.ft-art-wrap',icon:'❧',chapter:'Моё дерево',title:'Маленький живой ориентир',text:'Дерево отражает соотношение доходов и расходов за 30 дней. После экскурсии потрясите крону: четыре быстрых тапа вызывают вихрь.',tip:'Один тап осыпает листья, снег или лепестки; жест вбок создаёт ветер. Это только игра: расходы не «наказывают» дерево.'},
    {tab:'settings',target:'#settings-guide',icon:'⚙',chapter:'Настройки',title:'Все настройки — здесь',text:'Темы, светлый и тёмный режим, движение и данные — всё здесь. А эта карточка в любой момент вернёт к экскурсии.',tip:'Не нужно повторно вводить имя, баланс или настраивать приложение, чтобы вернуться к подсказкам.'},
    {tab:'settings',icon:'✓',chapter:'Готово',title:'Теперь вы знаете дорогу',text:'Начните с одной покупки или первой цели. Не нужно помнить всё сразу: карта экскурсии поможет вернуться к любой теме.',tip:'Можно начать с одной покупки или создать первую цель. Если что-то забудете, экскурсия всегда под рукой в настройках.'}
  ];
  const names = {home:'Главная',calendar:'Календарь',analytics:'Аналитика',settings:'Настройки'};
  let dialog, panel, focusBox, shade, index = 0, active = false, epoch = 0, mapOpen = false;
  const visited = new Set();
  let origin, overflow, effect, frame, observer, automatic = false;
  const read = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
  const save = value => { try { localStorage.setItem(KEY,value); } catch (_) { /* Tour still works without storage. */ } };
  function checkpoint(clear = false) {
    try {
      if (clear) localStorage.removeItem(CHECKPOINT);
      else if (automatic) localStorage.setItem(CHECKPOINT,String(index));
    } catch (_) { /* Navigation never depends on writable storage. */ }
  }
  function savedStep() {
    try {
      const raw = localStorage.getItem(CHECKPOINT);
      return /^(?:[0-9])$/.test(raw || '') ? Number(raw) : 0;
    } catch (_) { return 0; }
  }
  const moves = () => !media.matches && !root.classList.contains('no-motion');
  const visible = el => el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  function targetFor(step) {
    // Comma-separated selectors are ordered fallbacks, not document order:
    // Capture before the header +, goal heading before the whole goal block.
    for (const selector of (step.target || '').split(',').filter(Boolean)) {
      const target = [...document.querySelectorAll(selector.trim())].find(visible);
      if (target) return target;
    }
    return null;
  }
  function toggleMap(open, focus = true) {
    mapOpen = open;
    dialog.dataset.map = String(open);
    dialog.setAttribute('aria-describedby',open?'tour-map-intro':'tour-text');
    dialog.querySelector('#tour-map').hidden = !open;
    dialog.querySelector('.tour-content').hidden = open;
    dialog.querySelector('.tour-actions').hidden = open;
    const toggle = dialog.querySelector('#tour-map-toggle');
    toggle.setAttribute('aria-expanded',String(open));
    toggle.querySelector('span').textContent = open ? 'К подсказке' : 'Карта маршрута';
    stopEffect();
    layout(!open);
    panel.scrollTop = 0;
    if (focus) (open ? dialog.querySelector('[data-tour-jump][aria-current="step"]') : toggle)?.focus({preventScroll:true});
  }
  function stopEffect() { effect?.cancel(); effect = null; }
  function layout(scroll = false) {
    if (!active) return;
    const step = steps[index], target = mapOpen ? null : targetFor(step);
    const vw = document.documentElement.clientWidth, vh = innerHeight;
    const width = Math.min(360,vw-28);
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${Math.max(100,vh-28)}px`;
    const height = panel.offsetHeight;
    let rect = target?.getBoundingClientRect();
    // Fixed controls (Capture/header) must not scroll the underlying document.
    let fixed = false;
    for (let el = target; el; el = el.parentElement) if (getComputedStyle(el).position === 'fixed') { fixed = true; break; }
    if (scroll && target && !fixed) {
      const desired = Math.max(20,(vh-height-rect.height-32)/2);
      window.scrollTo({top:Math.max(0,scrollY+rect.top-desired),behavior:'instant'});
      rect = target.getBoundingClientRect();
    }
    let top = Math.max(14,(vh-height)/2), ring = false;
    if (rect && rect.width > 0 && rect.height > 0 && rect.top >= 12 && rect.bottom <= vh-12) {
      const below = vh-rect.bottom-24, above = rect.top-24;
      if (below >= height || above >= height) {
        top = below >= height ? rect.bottom+18 : rect.top-height-18;
        const left = Math.max(10,rect.left-6), y = Math.max(10,rect.top-6);
        Object.assign(focusBox.style,{left:`${left}px`,top:`${y}px`,width:`${Math.min(vw-10,rect.right+6)-left}px`,height:`${Math.min(vh-10,rect.bottom+6)-y}px`});
        ring = true;
      }
    }
    focusBox.hidden = !ring; shade.hidden = ring;
    panel.style.left = `${(vw-width)/2}px`;
    panel.style.top = `${Math.max(14,Math.min(vh-height-14,top))}px`;
    dialog.dataset.spotlight = String(ring);
  }
  function scheduleLayout() {
    if (!active || frame) return;
    frame = requestAnimationFrame(() => { frame = null; layout(); });
  }
  async function go(next) {
    if (!active) return;
    const ticket = ++epoch;
    if (mapOpen) toggleMap(false,false);
    dialog.dataset.ready = 'false';
    index = Math.max(0,Math.min(steps.length-1,next));
    const step = steps[index];
    visited.add(index); checkpoint();
    dialog.querySelector('#tour-more').open = false;
    stopEffect();
    dialog.dataset.step = String(index);
    dialog.querySelector('#tour-title').textContent = step.title;
    dialog.querySelector('#tour-text').textContent = step.text;
    dialog.querySelector('#tour-tip').textContent = step.tip;
    dialog.querySelector('.tour-symbol').textContent = step.icon;
    dialog.querySelector('.tour-chapter').textContent = `${String(index+1).padStart(2,'0')} · ${step.chapter}`;
    dialog.querySelector('.tour-counter').textContent = `${index+1} из ${steps.length}`;
    dialog.querySelector('.tour-location').textContent = `Раздел: ${names[step.tab]}`;
    const progress = dialog.querySelector('.tour-progress');
    progress.setAttribute('aria-valuenow',String(index+1));
    progress.setAttribute('aria-valuetext',`Шаг ${index+1} из ${steps.length}: ${step.chapter}`);
    [...progress.children].forEach((dot,i) => { dot.dataset.done=String(visited.has(i)); dot.dataset.current=String(i===index); });
    dialog.querySelectorAll('[data-tour-jump]').forEach((button,i)=>{
      button.dataset.visited=String(visited.has(i));
      if(i===index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
      button.querySelector('.tour-map-state').textContent=i===index?'Вы здесь':visited.has(i)?'Просмотрено':'Посмотреть';
    });
    dialog.querySelector('.tour-up-next').textContent = index < steps.length-1 ? `Далее · ${steps[index+1].chapter}` : 'Экскурсия всегда доступна в настройках';
    dialog.querySelector('.tour-overview').hidden = index !== 0 && index !== steps.length-1;
    dialog.querySelector('#tour-back').disabled = index === 0;
    dialog.querySelector('#tour-next').textContent = index === steps.length-1 ? (automatic?'Начать пользоваться':'Готово') : index === 0 ? 'Покажите мне →' : 'Дальше →';
    focusBox.hidden = true; shade.hidden = false;
    if (document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav !== step.tab) window.goTab(step.tab);
    // Wait for real section/module layout, not a fake loading timer.
    await new Promise(requestAnimationFrame);
    if (!active || ticket !== epoch) return;
    observer?.disconnect();
    observer?.observe(panel);
    const target = targetFor(step);
    if (target) observer?.observe(target);
    layout(true);
    dialog.dataset.ready = 'true';
    panel.scrollTop = 0;
    dialog.querySelector('#tour-title').focus({preventScroll:true});
    if (moves()) {
      effect = panel.animate([{opacity:.4,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'ease-out'});
      effect.id = 'fintex-tour-step';
    }
  }
  function finish(status = 'skipped', persist = true, restore = true) {
    if (!active) return;
    active = false; epoch++; observer?.disconnect();
    cancelAnimationFrame(frame); frame = null; stopEffect();
    if (persist) { save(status); checkpoint(true); }
    dialog.close(); focusBox.hidden = true;
    root.classList.remove('fintex-tour-open');
    document.body.style.overflow = overflow;
    if (!restore) return;
    const tab = automatic ? 'home' : origin.tab;
    window.goTab(tab);
    window.scrollTo({top:automatic?0:origin.scroll,behavior:'instant'});
    const focus = !automatic && origin.focus?.isConnected ? origin.focus : document.getElementById('hdr-plus-btn');
    if (visible(focus)) focus.focus({preventScroll:true});
    else document.querySelector(`.nav-tab[data-nav="${tab}"]`)?.focus({preventScroll:true});
  }
  function start(auto = false) {
    if (active) { go(0); return true; }
    if (!document.getElementById('onboarding-screen')?.classList.contains('hidden') || document.querySelector('dialog[open]') || root.classList.contains('fintex-modal-open')) return false;
    window.FintexEntrance?.dismiss(true);
    window.cancelTxSwipe?.(); window.cancelGoalHold?.();
    automatic = auto; visited.clear();
    origin = {tab:document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav || 'home',scroll:scrollY,focus:document.activeElement};
    overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.classList.add('fintex-tour-open');
    active = true; dialog.showModal(); go(auto ? savedStep() : 0);
    return true;
  }
  function boot() {
    dialog = document.createElement('dialog'); dialog.id='fintex-tour';
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-labelledby','tour-title'); dialog.setAttribute('aria-describedby','tour-text');
    dialog.innerHTML = `<div class="tour-shade" aria-hidden="true"></div><div class="tour-focus" hidden aria-hidden="true"></div>
      <section class="tour-panel"><header class="tour-top"><span class="tour-brand"><img src="./assets/brand/fintex-logo.webp?v=49" width="25" height="25" alt=""/>Гид по Fintex</span><button type="button" id="tour-skip" aria-label="Пропустить экскурсию">Пропустить <span aria-hidden="true">×</span></button></header>
      <div class="tour-progress" role="progressbar" aria-label="Ход экскурсии" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="1">${steps.map(()=>'<i aria-hidden="true"></i>').join('')}</div>
      <div class="tour-route"><div><span class="tour-chapter"></span><span class="tour-counter"></span></div><button type="button" id="tour-map-toggle" aria-controls="tour-map" aria-expanded="false"><span>Карта маршрута</span><b aria-hidden="true">↗</b></button></div>
      <nav id="tour-map" aria-label="Темы экскурсии" hidden><h3>Что хотите найти?</h3><p id="tour-map-intro">Можно идти по порядку или выбрать тему.</p><div class="tour-map-grid">${steps.map((step,i)=>`<button type="button" data-tour-jump="${i}"><span class="tour-map-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><span><strong>${step.chapter}</strong><small class="tour-map-state">Посмотреть</small></span></button>`).join('')}</div></nav>
      <div class="tour-content"><div class="tour-heading"><span class="tour-symbol" aria-hidden="true"></span><h2 id="tour-title" tabindex="-1"></h2></div>
      <p class="tour-location"></p><p id="tour-text"></p>
      <div class="tour-overview" aria-label="Разделы приложения"><span>Главная</span><span>Календарь</span><span>Аналитика</span><span>Настройки</span></div>
      <details id="tour-more"><summary>Полезно знать <span aria-hidden="true">+</span></summary><p id="tour-tip"></p></details>
      <p class="tour-up-next"></p></div>
      <footer class="tour-actions"><button type="button" id="tour-back">← Назад</button><button type="button" id="tour-next">Покажите мне →</button></footer></section>`;
    document.body.append(dialog); panel=dialog.querySelector('.tour-panel'); focusBox=dialog.querySelector('.tour-focus'); shade=dialog.querySelector('.tour-shade');
    dialog.querySelector('#tour-map-toggle').addEventListener('click',()=>toggleMap(!mapOpen));
    dialog.querySelector('#tour-map').addEventListener('click',event=>{
      const button = event.target.closest('[data-tour-jump]');
      if (button) go(Number(button.dataset.tourJump));
    });
    dialog.querySelector('#tour-more').addEventListener('toggle',()=>{if(active&&!mapOpen)layout(true);});
    dialog.querySelector('#tour-skip').addEventListener('click',()=>finish());
    dialog.querySelector('#tour-back').addEventListener('click',()=>go(index-1));
    dialog.querySelector('#tour-next').addEventListener('click',()=>index===steps.length-1?finish('complete'):go(index+1));
    dialog.addEventListener('cancel',event=>{event.preventDefault();if(mapOpen)toggleMap(false);else finish();});
    dialog.addEventListener('close',()=>{if(active)finish();});
    dialog.addEventListener('keydown',event=>{
      if(event.key==='Escape'&&mapOpen){event.preventDefault();event.stopPropagation();toggleMap(false);return;}
      if(event.altKey||event.ctrlKey||event.metaKey||mapOpen)return;
      if(event.key==='ArrowRight'&&index<steps.length-1){event.preventDefault();go(index+1);}
      if(event.key==='ArrowLeft'&&index>0){event.preventDefault();go(index-1);}
    });
    if (window.ResizeObserver) observer = new ResizeObserver(scheduleLayout);
    document.fonts?.ready.then(scheduleLayout);
    window.addEventListener('fintex:appearancechange',scheduleLayout);
    window.addEventListener('resize',scheduleLayout);window.addEventListener('scroll',scheduleLayout,{passive:true});
    window.visualViewport?.addEventListener('resize',scheduleLayout);
    media.addEventListener?.('change',()=>{if(!moves())stopEffect();scheduleLayout();});
    window.addEventListener('fintex:motionchange',()=>{if(!moves())stopEffect();});
    window.addEventListener('pagehide',()=>finish('skipped',false,false));
    window.FintexTour = {start:()=>start(false)};
    window.addEventListener('fintex:first-setup-complete',()=>start(true));
    // Existing users without a tour marker are never interrupted by an upgrade.
    if(read()==='pending'&&localStorage.getItem('fp_onboarded')==='1'&&localStorage.getItem('fp_name'))start(true);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
