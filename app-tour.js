/* Read-only guided tour. All selectors/copy are local constants; the only saved
 * values are tour status and an unfinished first-visit checkpoint. No demo ledger entries or financial actions. */
(() => {
  'use strict';
  if (window.FintexTour) return;
  const KEY = 'fp_tour_v1', CHECKPOINT = 'fp_tour_step_v2';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const steps = [
    {id:'budget',tab:'home',compact:'#hero-daily-budget .daily-budget-header, .daily-budget-label',target:'#hero-daily-budget',chapter:'На сегодня',title:'На сегодня',text:'Столько можно потратить сегодня, чтобы денег хватило до зарплаты.'},
    {id:'add',tab:'home',target:'#hdr-plus-btn, #capture-fab',chapter:'Добавить',title:'Добавить операцию',text:'Нажмите «+», чтобы записать доход, расход или добавить чек.'},
    {id:'history',tab:'home',target:'.tx-feed-header',chapter:'История',title:'История операций',text:'Здесь все доходы и расходы. Нажмите на запись, чтобы открыть детали.'},
    {id:'calendar',tab:'calendar',compact:'#cal-cells .is-selected, #cal-cells .is-today, #view-calendar h2',target:'#cal-cells',chapter:'Календарь',title:'Календарь',text:'Выберите день, чтобы посмотреть траты и платежи.'},
    {id:'analytics',tab:'analytics',compact:'.ap-cashflow-heading, #view-analytics h2',target:'.ap-cashflow',chapter:'Аналитика',title:'Аналитика',text:'Здесь видно, на что уходят деньги и как меняются расходы.'},
    {id:'goals',tab:'home',compact:'#savings-goals .sg-heading',target:'#savings-goals .sg-card, #savings-goals .sg-heading, #savings-goals',chapter:'Цели',title:'Цели',text:'Создайте цель и откладывайте на неё деньги.'},
    {id:'tree',tab:'home',compact:'#filely-financial-tree h2, .ft-art-wrap',target:'.ft-art-wrap',chapter:'Дерево',title:'Дерево',text:'Дерево меняется от доходов и расходов. Его можно потрясти.'},
    {id:'settings',tab:'settings',compact:'#tour-replay, #tour-settings-title',target:'#settings-guide',chapter:'Настройки',title:'Настройки',text:'Здесь можно сменить тему и снова открыть экскурсию.'},
  ];
  let dialog, panel, focusBox, scrim, index = 0, active = false, epoch = 0, mapOpen = false, peeking = false;
  const visited = new Set();
  let origin, overflow, effect, frame, observer, automatic = false;
  const read = () => { try { return localStorage.getItem(KEY); } catch (_) { return null; } };
  const save = value => { try { localStorage.setItem(KEY,value); } catch (_) { /* Tour still works without storage. */ } };
  function checkpoint(clear = false) {
    try {
      if (clear) { localStorage.removeItem(CHECKPOINT); localStorage.removeItem('fp_tour_step_v1'); }
      else if (automatic) localStorage.setItem(CHECKPOINT,steps[index].id);
    } catch (_) { /* Navigation never depends on writable storage. */ }
  }
  function savedStep() {
    try {
      const id = localStorage.getItem(CHECKPOINT);
      if (id !== null) return Math.max(0,steps.findIndex(step=>step.id===id));
      // v70 used ten numeric positions, including intro/outro. Migrate only
      // unfinished routes; existing complete/skipped users are not interrupted.
      const legacy = localStorage.getItem('fp_tour_step_v1');
      return /^[0-9]$/.test(legacy || '') ? Math.max(0,Math.min(7,Number(legacy)-1)) : 0;
    } catch (_) { return 0; }
  }
  const moves = () => !media.matches && !root.classList.contains('no-motion');
  const visible = el => el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  function targetFor(step, maximum = Infinity) {
    // Comma-separated selectors are ordered fallbacks, not document order:
    // Prefer the + in the header and the compact goal heading.
    for (const selector of [step.target,step.compact].filter(Boolean).join(',').split(',').filter(Boolean)) {
      const target = [...document.querySelectorAll(selector.trim())].find(el=>visible(el)&&el.getBoundingClientRect().height<=maximum);
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
    if(open)setPeek(false,false);
    const toggle = dialog.querySelector('#tour-map-toggle');
    toggle.setAttribute('aria-expanded',String(open));
    toggle.querySelector('span').textContent = open ? 'Назад' : 'Темы';
    stopEffect();
    layout(!open);
    panel.scrollTop = 0;
    if (focus) (open ? dialog.querySelector('[data-tour-jump][aria-current="step"]') : toggle)?.focus({preventScroll:true});
  }
  function stopEffect() { effect?.cancel(); effect = null; }
  function rounded(rect, radius = 16) {
    const {x,y,width:w,height:h} = rect, r = Math.max(0,Math.min(radius,w/2,h/2));
    return `M${x+r},${y}h${w-2*r}a${r},${r} 0 0 1 ${r},${r}v${h-2*r}a${r},${r} 0 0 1 ${-r},${r}h${-w+2*r}a${r},${r} 0 0 1 ${-r},${-r}v${-h+2*r}a${r},${r} 0 0 1 ${r},${-r}z`;
  }
  function setPeek(open, position = true) {
    peeking = open;
    dialog.dataset.peek = String(open);
    const button = dialog.querySelector('#tour-peek');
    button.setAttribute('aria-expanded',String(!open));
    button.setAttribute('aria-label',open?'Показать подсказку':'Свернуть подсказку');
    button.textContent = open ? '+' : '−';
    button.title = open ? 'Показать подсказку' : 'Свернуть подсказку';
    dialog.querySelector('.tour-counter').textContent = open ? steps[index].chapter : `${index+1} из ${steps.length}`;
    dialog.querySelector('.tour-content').hidden = open || mapOpen;
    dialog.querySelector('.tour-actions').hidden = open || mapOpen;
    dialog.querySelector('.tour-progress').hidden = open;
    if(position)layout(true);
  }
  function layout(scroll = false) {
    if (!active) return;
    const step = steps[index];
    const vw = document.documentElement.clientWidth, vh = innerHeight;
    const nav = document.querySelector('#fintex-navigation > div');
    const dock = visible(nav) ? nav.getBoundingClientRect() : null;
    const bottom = dock ? dock.top-12 : vh-14;
    const width = Math.min(360,vw-24);
    panel.style.width = `${width}px`;
    panel.style.maxHeight = `${Math.max(64,bottom-12)}px`;
    const height = panel.offsetHeight;
    let top = Math.max(12,bottom-height), placement = 'bottom';
    const target = mapOpen ? null : targetFor(step,Math.max(24,bottom-height-24));
    let rect = target?.getBoundingClientRect();
    let fixed = false;
    for (let el = target; el; el = el.parentElement) if (getComputedStyle(el).position === 'fixed') { fixed = true; break; }
    if (scroll && target && !fixed) {
      const desired = Math.max(12,(bottom-height-rect.height-12)/2);
      window.scrollTo({top:Math.max(0,scrollY+rect.top-desired),behavior:'instant'});
      rect = target.getBoundingClientRect();
    }
    // Prefer a nearby card, above or below the element, with no overlap.
    if(rect && !mapOpen){
      if(rect.bottom+12>=12&&rect.bottom+12+height<=bottom){top=rect.bottom+12;placement='below';}
      else if(rect.top-height-12>=12){top=rect.top-height-12;placement='above';}
    }
    panel.style.left = `${(vw-width)/2}px`;
    top = Math.max(12,Math.min(bottom-height,top));
    panel.style.top = `${top}px`;
    dialog.dataset.placement = placement;
    const separated = rect && (rect.bottom+8<=top || top+height+8<=rect.top);
    // Separate cutouts keep both the real target AND the real section dock clear.
    let path = `M0,0H${vw}V${vh}H0z`;
    if(dock) path += rounded({x:dock.left-2,y:dock.top-2,width:dock.width+4,height:dock.height+4},28);
    const ring = !!(rect && rect.width > 0 && rect.height > 0 && rect.top >= 8 && rect.bottom <= bottom-4 && separated && rect.left >= 4 && rect.right <= vw-4);
    if (ring) {
      const pad = 4, radius = Math.min(24,parseFloat(getComputedStyle(target).borderTopLeftRadius)||8)+pad;
      const box = {x:rect.left-pad,y:rect.top-pad,width:rect.width+pad*2,height:rect.height+pad*2};
      Object.assign(focusBox.style,{left:`${box.x}px`,top:`${box.y}px`,width:`${box.width}px`,height:`${box.height}px`,borderRadius:`${radius}px`});
      path += rounded(box,radius);
    }
    focusBox.hidden = !ring;
    panel.style.setProperty('--tour-pointer-x',`${rect?Math.max(18,Math.min(width-24,(rect.left+rect.right)/2-(vw-width)/2)):width/2}px`);
    scrim.setAttribute('d',path);
    dialog.dataset.spotlight = String(ring);
    dialog.querySelectorAll('[data-tour-tab]').forEach(button=>{
      const real = document.querySelector(`#fintex-navigation [data-nav="${button.dataset.tourTab}"]`);
      button.hidden = !visible(real);
      if(button.hidden)return;
      const r = real.getBoundingClientRect();
      Object.assign(button.style,{left:`${r.left}px`,top:`${r.top}px`,width:`${r.width}px`,height:`${r.height}px`});
      if(step.tab===button.dataset.tourTab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
    });
  }
  function scheduleLayout() {
    if (!active || frame) return;
    frame = requestAnimationFrame(() => { frame = null; layout(); });
  }
  async function go(next) {
    if (!active) return;
    const ticket = ++epoch;
    if (mapOpen) toggleMap(false,false);
    setPeek(false,false);
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
    dialog.querySelector('#tour-next').textContent = index === steps.length-1 ? 'Готово' : 'Далее';
    focusBox.hidden = true;
    if (document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav !== step.tab) window.goTab(step.tab);
    // Wait for real section/module layout, not a fake loading timer.
    await new Promise(requestAnimationFrame);
    if (!active || ticket !== epoch) return;
    observer?.disconnect();
    observer?.observe(panel);
    const dock = document.querySelector('#fintex-navigation > div');
    if(dock)observer?.observe(dock);
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
    const topics = [...visited].map(i=>steps[i].id);
    dialog.close(); focusBox.hidden = true;
    root.classList.remove('fintex-tour-open');
    document.body.style.overflow = overflow;
    if (persist) window.dispatchEvent(new CustomEvent('fintex:tour-finished',{detail:{topics}}));
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
    window.dispatchEvent(new Event('fintex:tour-started'));
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
    dialog.innerHTML = `<svg class="tour-scrim" aria-hidden="true" width="100%" height="100%"><path fill-rule="evenodd" /></svg><div class="tour-focus" hidden aria-hidden="true"></div>
      <nav class="tour-sections" aria-label="Разделы приложения">${[['home','Главная'],['calendar','Календарь'],['analytics','Аналитика'],['settings','Настройки']].map(([tab,name])=>`<button type="button" data-tour-tab="${tab}" aria-label="${name} — показать раздел"></button>`).join('')}</nav>
      <section class="tour-panel"><header class="tour-top"><span class="tour-counter"></span><div class="tour-tools"><button type="button" id="tour-map-toggle" aria-controls="tour-map" aria-expanded="false"><span>Темы</span></button><button type="button" id="tour-peek" aria-label="Свернуть подсказку" aria-expanded="true" aria-controls="tour-body">−</button><button type="button" id="tour-skip" aria-label="Закрыть экскурсию">×</button></div></header>
      <div class="tour-progress" role="progressbar" aria-label="Ход экскурсии" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="1">${steps.map(()=>'<i aria-hidden="true"></i>').join('')}</div>
      <nav id="tour-map" aria-labelledby="tour-map-title" hidden><h3 id="tour-map-title">Темы</h3><div class="tour-map-grid">${steps.map((step,i)=>`<button type="button" data-tour-jump="${i}"><span class="tour-map-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><strong>${step.chapter}</strong><small class="tour-map-state" aria-hidden="true"></small></button>`).join('')}</div></nav>
      <div class="tour-content" id="tour-body"><h2 id="tour-title" tabindex="-1"></h2><p id="tour-text"></p></div>
      <footer class="tour-actions"><button type="button" id="tour-back">Назад</button><button type="button" id="tour-next">Начать</button></footer></section>`;
    document.body.append(dialog); panel=dialog.querySelector('.tour-panel'); focusBox=dialog.querySelector('.tour-focus'); scrim=dialog.querySelector('.tour-scrim path');
    dialog.querySelector('#tour-peek').addEventListener('click',()=>{if(mapOpen)toggleMap(false,false);setPeek(!peeking);});
    dialog.querySelector('.tour-sections').addEventListener('click',event=>{
      const button = event.target.closest('[data-tour-tab]');
      if(button)go({home:0,calendar:3,analytics:4,settings:7}[button.dataset.tourTab]);
    });
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
