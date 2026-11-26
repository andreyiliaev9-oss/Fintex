/* Read-only guided tour. All selectors/copy are local constants; the only saved
 * values are tour status and an unfinished first-visit checkpoint. No demo ledger entries or financial actions. */
(() => {
  'use strict';
  if (window.FintexTour) return;
  const KEY = 'fp_tour_v1', CHECKPOINT = 'fp_tour_step_v1';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const steps = [
    {tab:'home',chapter:'Начало',title:'Покажем, что где',text:'Пройдёмся по основным кнопкам. Ничего не запишем и не изменим.'},
    {tab:'home',target:'#hero-daily-budget',chapter:'На сегодня',title:'На сегодня',text:'Столько можно потратить сегодня, чтобы денег хватило до зарплаты.'},
    {tab:'home',target:'#hdr-plus-btn, #capture-fab',chapter:'Добавить',title:'Добавить операцию',text:'Нажмите «+», чтобы записать доход или расход. Capture — для фото чека.'},
    {tab:'home',target:'.tx-feed-header',chapter:'История',title:'История операций',text:'Здесь все доходы и расходы. Нажмите на запись, чтобы открыть детали.'},
    {tab:'calendar',target:'#cal-cells',chapter:'Календарь',title:'Календарь',text:'Выберите день, чтобы посмотреть траты и платежи.'},
    {tab:'analytics',target:'.ap-cashflow-heading, #view-analytics h2',chapter:'Аналитика',title:'Аналитика',text:'Здесь видно, на что уходят деньги и как меняются расходы.'},
    {tab:'home',target:'#savings-goals .sg-heading, #savings-goals',chapter:'Цели',title:'Цели',text:'Создайте цель и откладывайте на неё деньги.'},
    {tab:'home',target:'.ft-art-wrap',chapter:'Дерево',title:'Дерево',text:'Меняется от доходов и расходов. Тапните — посыплются листья, снег или лепестки.'},
    {tab:'settings',target:'#settings-guide',chapter:'Настройки',title:'Настройки',text:'Здесь можно сменить тему и снова открыть экскурсию.'},
    {tab:'settings',chapter:'Готово',title:'Всё готово',text:'Если что-то забудете, экскурсия есть в настройках.'}
  ];
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
    // Prefer the + in the header and the compact goal heading.
    for (const selector of (step.target || '').split(',').filter(Boolean)) {
      const target = [...document.querySelectorAll(selector.trim())].find(visible);
      if (target) return target;
    }
    return null;
  }
  function toggleMap(open, focus = true) {
    mapOpen = open;
    dialog.dataset.map = String(open);
    dialog.setAttribute('aria-labelledby',open?'tour-map-title':'tour-title');
    if(open)dialog.removeAttribute('aria-describedby');else dialog.setAttribute('aria-describedby','tour-text');
    dialog.querySelector('#tour-map').hidden = !open;
    dialog.querySelector('.tour-content').hidden = open;
    dialog.querySelector('.tour-actions').hidden = open;
    const toggle = dialog.querySelector('#tour-map-toggle');
    toggle.setAttribute('aria-expanded',String(open));
    toggle.querySelector('span').textContent = open ? 'Назад' : 'Темы';
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
    // The card and its controls stay in the same place on every step.
    // Move the real app target into the space above it, never the card itself.
    const top = Math.max(14,vh-height-14);
    let fixed = false;
    for (let el = target; el; el = el.parentElement) if (getComputedStyle(el).position === 'fixed') { fixed = true; break; }
    if (scroll && target && !fixed) {
      const desired = Math.max(20,(top-rect.height)/2);
      window.scrollTo({top:Math.max(0,scrollY+rect.top-desired),behavior:'instant'});
      rect = target.getBoundingClientRect();
    }
    const ring = !!(rect && rect.width > 0 && rect.height > 0 && rect.top >= 12 && rect.bottom <= top-18 && rect.right > 10 && rect.left < vw-10);
    if (ring) {
      const left = Math.max(10,rect.left-6), y = Math.max(10,rect.top-6);
      Object.assign(focusBox.style,{left:`${left}px`,top:`${y}px`,width:`${Math.min(vw-10,rect.right+6)-left}px`,height:`${rect.bottom+6-y}px`});
    }
    focusBox.hidden = !ring; shade.hidden = ring;
    panel.style.left = `${(vw-width)/2}px`;
    panel.style.top = `${top}px`;
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
    stopEffect();
    dialog.dataset.step = String(index);
    dialog.querySelector('#tour-title').textContent = step.title;
    dialog.querySelector('#tour-text').textContent = step.text;
    dialog.querySelector('.tour-counter').textContent = `${index+1} из ${steps.length}`;
    const progress = dialog.querySelector('.tour-progress');
    progress.setAttribute('aria-valuenow',String(index+1));
    progress.setAttribute('aria-valuetext',`Шаг ${index+1} из ${steps.length}: ${step.chapter}`);
    [...progress.children].forEach((dot,i) => { dot.dataset.done=String(visited.has(i)); dot.dataset.current=String(i===index); });
    dialog.querySelectorAll('[data-tour-jump]').forEach((button,i)=>{
      button.dataset.visited=String(visited.has(i));
      if(i===index)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');
      button.querySelector('.tour-map-state').textContent=i===index?'•':visited.has(i)?'✓':'';
    });
    dialog.querySelector('#tour-back').disabled = index === 0;
    dialog.querySelector('#tour-next').textContent = index === steps.length-1 ? 'Готово' : index === 0 ? 'Начать' : 'Далее';
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
    dialog.querySelector('.tour-content').scrollTop = 0;
    dialog.querySelector('#tour-title').focus({preventScroll:true});
    if (moves()) {
      effect = dialog.querySelector('.tour-content').animate([{opacity:.4},{opacity:1}],{duration:200,easing:'ease-out'});
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
      <section class="tour-panel"><header class="tour-top"><span class="tour-counter"></span><div class="tour-tools"><button type="button" id="tour-map-toggle" aria-controls="tour-map" aria-expanded="false"><span>Темы</span></button><button type="button" id="tour-skip" aria-label="Закрыть экскурсию">Закрыть</button></div></header>
      <div class="tour-progress" role="progressbar" aria-label="Ход экскурсии" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="1">${steps.map(()=>'<i aria-hidden="true"></i>').join('')}</div>
      <nav id="tour-map" aria-labelledby="tour-map-title" hidden><h3 id="tour-map-title">Темы</h3><div class="tour-map-grid">${steps.map((step,i)=>`<button type="button" data-tour-jump="${i}"><span class="tour-map-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><strong>${step.chapter}</strong><small class="tour-map-state" aria-hidden="true"></small></button>`).join('')}</div></nav>
      <div class="tour-content"><h2 id="tour-title" tabindex="-1"></h2><p id="tour-text"></p></div>
      <footer class="tour-actions"><button type="button" id="tour-back">Назад</button><button type="button" id="tour-next">Начать</button></footer></section>`;
    document.body.append(dialog); panel=dialog.querySelector('.tour-panel'); focusBox=dialog.querySelector('.tour-focus'); shade=dialog.querySelector('.tour-shade');
    dialog.querySelector('#tour-map-toggle').addEventListener('click',()=>toggleMap(!mapOpen));
    dialog.querySelector('#tour-map').addEventListener('click',event=>{
      const button = event.target.closest('[data-tour-jump]');
      if (button) go(Number(button.dataset.tourJump));
    });
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
