/* Read-only guided tour. All selectors/copy are local constants; the only saved
 * value is tour completion. No demo ledger entries or financial actions. */
(() => {
  'use strict';
  if (window.FintexTour) return;
  const KEY = 'fp_tour_v1';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const steps = [
    {tab:'home',icon:'✦',chapter:'Знакомство',title:'Ваш маршрут по Fintex',text:'За минуту покажем, где управлять деньгами. Мы будем переходить между настоящими разделами и подсвечивать нужное.',tip:'Это безопасный просмотр: без пробных операций, списаний и изменений баланса.'},
    {tab:'home',target:'#hero-daily-budget',icon:'◷',chapter:'Главная',title:'Сколько доступно сегодня',text:'На карточке сверху — остаток на счёте, резерв и свободные деньги. Дневной бюджет помогает распределить свободные средства до зарплаты.',tip:'«Доступно сегодня» — ориентир по вашим данным, а не новый баланс и не банковский лимит.'},
    {tab:'home',target:'#capture-fab, #hdr-plus-btn',icon:'＋',chapter:'Добавление',title:'Запишите покупку удобным способом',text:'Зелёная кнопка сканирования принимает фото чека или скриншот. Через «+» в шапке можно внести операцию вручную.',tip:'Распознанные данные можно проверить перед сохранением. Сейчас камера и выбор файлов не откроются.'},
    {tab:'home',target:'.tx-feed-header',icon:'≡',chapter:'Операции',title:'Вся история — в одном месте',text:'Здесь доходы и расходы сгруппированы по дням. Поиск найдёт магазин, категорию или сумму. Нажмите на запись, чтобы посмотреть детали.',tip:'Кнопка «⋯» рядом с суммой открывает действия. Удаление не происходит от обычного касания строки.'},
    {tab:'calendar',target:'#cal-cells',icon:'▦',chapter:'Календарь',title:'Деньги на карте месяца',text:'Выбирайте дату, чтобы увидеть сводку этого дня. Здесь же удобно следить за плановыми платежами и датой зарплаты.',tip:'Из сводки дня можно перейти к операциям выбранной даты. Календарь не создаёт их повторно.'},
    {tab:'analytics',target:'.ap-cashflow-heading, #view-analytics h2',icon:'↗',chapter:'Аналитика',title:'Поймите, куда уходят деньги',text:'Сравнивайте доходы и расходы за период, изучайте категории и динамику трат. Сначала запишите несколько операций — графики станут полезнее.',tip:'Разница доходов и расходов — результат за период, а не остаток на банковском счёте.'},
    {tab:'home',target:'#savings-goals .sg-heading, #savings-goals',icon:'◎',chapter:'Цели',title:'У каждой мечты — своя цель',text:'Создавайте несколько целей, добавляйте обложки и пополняйте их отдельно. Плановый взнос помогает оценить срок накопления.',tip:'Отложенные деньги входят в ваш баланс, но исключены из доступных для трат. Автоматических списаний нет.'},
    {tab:'home',target:'.ft-art-wrap',icon:'❧',chapter:'Моё дерево',title:'Маленький живой ориентир',text:'Вид дерева отражает соотношение записанных доходов и расходов за 30 дней. Тапы осыпают снег, листья или лепестки, четыре быстрых тапа создают вихрь.',tip:'После экскурсии попробуйте провести по дереву вбок. Это только анимация: расходы не «наказывают» дерево.'},
    {tab:'settings',target:'#settings-guide',icon:'⚙',chapter:'Настройки',title:'Все настройки — здесь',text:'Выбирайте тему, светлый или тёмный режим, управляйте движением, импортом и подключением. Карточка «Что где в Fintex» запускает этот маршрут заново.',tip:'Не нужно повторно вводить имя, баланс или настраивать приложение, чтобы вернуться к подсказкам.'},
    {tab:'settings',icon:'✓',chapter:'Готово',title:'Теперь вы знаете дорогу',text:'Главная — деньги и история. Календарь — даты и платежи. Аналитика — картина за период. Настройки — оформление и помощь.',tip:'Можно начать с одной покупки или создать первую цель. Если что-то забудете, экскурсия всегда под рукой в настройках.'}
  ];
  const names = {home:'Главная',calendar:'Календарь',analytics:'Аналитика',settings:'Настройки'};
  let dialog, panel, focusBox, shade, index = 0, active = false, epoch = 0;
  let origin, overflow, effect, frame, observer, automatic = false;
  const read = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
  const save = value => { try { localStorage.setItem(KEY,value); } catch (_) { /* Tour still works without storage. */ } };
  const moves = () => !media.matches && !root.classList.contains('no-motion');
  const visible = el => el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  function targetFor(step) {
    return step.target ? [...document.querySelectorAll(step.target)].find(visible) : null;
  }
  function stopEffect() { effect?.cancel(); effect = null; }
  function layout(scroll = false) {
    if (!active) return;
    const step = steps[index], target = targetFor(step);
    const vw = document.documentElement.clientWidth, vh = innerHeight;
    const width = Math.min(360,vw-28);
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${Math.max(100,vh-28)}px`;
    const height = panel.offsetHeight;
    let rect = target?.getBoundingClientRect();
    // Fixed controls (Capture/header) must not scroll the underlying document.
    if (scroll && target && getComputedStyle(target).position !== 'fixed') {
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
    dialog.dataset.ready = 'false';
    index = Math.max(0,Math.min(steps.length-1,next));
    const step = steps[index];
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
    [...progress.children].forEach((dot,i) => { dot.dataset.done=String(i<=index); });
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
    if (persist) save(status);
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
    automatic = auto;
    origin = {tab:document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav || 'home',scroll:scrollY,focus:document.activeElement};
    overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root.classList.add('fintex-tour-open');
    active = true; dialog.showModal(); go(0);
    return true;
  }
  function boot() {
    dialog = document.createElement('dialog'); dialog.id='fintex-tour';
    dialog.setAttribute('aria-modal','true');
    dialog.setAttribute('aria-labelledby','tour-title'); dialog.setAttribute('aria-describedby','tour-text');
    dialog.innerHTML = `<div class="tour-shade" aria-hidden="true"></div><div class="tour-focus" hidden aria-hidden="true"></div>
      <section class="tour-panel"><header class="tour-top"><span class="tour-brand"><img src="./assets/brand/fintex-logo.webp?v=49" width="25" height="25" alt=""/>Гид по Fintex</span><button type="button" id="tour-skip" aria-label="Пропустить экскурсию">Пропустить <span aria-hidden="true">×</span></button></header>
      <div class="tour-progress" role="progressbar" aria-label="Ход экскурсии" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="1">${steps.map(()=>'<i aria-hidden="true"></i>').join('')}</div>
      <div class="tour-route"><span class="tour-chapter"></span><span class="tour-counter"></span></div>
      <div class="tour-heading"><span class="tour-symbol" aria-hidden="true"></span><h2 id="tour-title" tabindex="-1"></h2></div>
      <p class="tour-location"></p><p id="tour-text"></p><p id="tour-tip"></p>
      <footer class="tour-actions"><button type="button" id="tour-back">← Назад</button><button type="button" id="tour-next">Покажите мне →</button></footer></section>`;
    document.body.append(dialog); panel=dialog.querySelector('.tour-panel'); focusBox=dialog.querySelector('.tour-focus'); shade=dialog.querySelector('.tour-shade');
    dialog.querySelector('#tour-skip').addEventListener('click',()=>finish());
    dialog.querySelector('#tour-back').addEventListener('click',()=>go(index-1));
    dialog.querySelector('#tour-next').addEventListener('click',()=>index===steps.length-1?finish('complete'):go(index+1));
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
    dialog.addEventListener('close',()=>{if(active)finish();});
    dialog.addEventListener('keydown',event=>{
      if(event.altKey||event.ctrlKey||event.metaKey)return;
      if(event.key==='ArrowRight'&&index<steps.length-1){event.preventDefault();go(index+1);}
      if(event.key==='ArrowLeft'&&index>0){event.preventDefault();go(index-1);}
    });
    if (window.ResizeObserver) observer = new ResizeObserver(scheduleLayout);
    document.fonts?.ready.then(scheduleLayout);
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
