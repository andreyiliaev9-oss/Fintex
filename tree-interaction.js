/* A small decorative interaction, never a savings action. Native button clicks
 * cover touch, mouse, Enter and Space. No per-frame JS or financial writes. */
(() => {
  'use strict';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const STORM_MS = 2800, COMBO_GAP = 750, COMBO_WINDOW = 1900;
  let card, combo = 0, started = 0, lastTap = -Infinity, storm = false;
  let comboTimer, finishTimer, pointer, artwork;
  let animations = [], localLayer, stormLayer, bare;
  let snowAnimations = [], snowTimer, snowToken = 0, snowStarted = 0;
  let crown, sceneSource, sceneToken = 0, flowers, fundingLayer, fundingTimer, pendingFunding;
  let fundingAnimations = [], suppressClickUntil = 0;
  const RECOVER_MS = 12000;
  const centre = {x: 50, y: 42, dir: -1, gust: false};
  const tree = () => document.getElementById('filely-financial-tree');
  const season = () => root.dataset.visualStyle === 'sapphire' ? 'snow' : root.dataset.visualStyle === 'growth' ? 'petal' : 'leaf';
  const activeModal = () => root.classList.contains('fintex-modal-open') || document.querySelector('dialog[open]') || !document.getElementById('returning-splash')?.classList.contains('hidden');
  const allowed = () => !media.matches && !root.classList.contains('no-motion') && !document.hidden;
  function playable() {
    return allowed() && card?.isConnected && card.dataset.animationPaused !== 'true' &&
      !document.getElementById('view-home')?.classList.contains('hidden') && !activeModal();
  }
  function hint(message) {
    const target = card?.querySelector('.ft-play-hint');
    const normal = season() === 'snow' ? '4 тапа — вьюга · проведите по дереву для ветра' : season() === 'petal' ? '4 тапа — вихрь лепестков · проведите для ветра' : '4 тапа — листопад · проведите для ветра';
    if (target) target.textContent = message || (allowed() ? normal : 'Движение отключено · накопления — кнопка «+ Пополнить»');
  }
  function announce(message) {
    const status = card?.querySelector('.ft-reaction-status');
    if (status) status.textContent = message;
  }
  function clearVisuals() {
    clearTimeout(finishTimer);
    animations.forEach(animation => animation.cancel()); animations = [];
    localLayer?.remove(); stormLayer?.remove();
    localLayer = stormLayer = null;
    if (card) { delete card.dataset.treeReaction; delete card.dataset.tapOrigin; delete card.dataset.windDirection; }
  }
  function reset() {
    clearTimeout(comboTimer); clearVisuals(); clearSnow(); clearFunding();
    combo = 0; lastTap = -Infinity; storm = false; pointer = null; artwork = undefined;
    if (card) { delete card.dataset.tapCharge; hint(); announce(''); }
  }
  function animate(element, frames, options) {
    const animation = element.animate(frames, options);
    animation.id = 'fintex-tree-reaction';
    animations.push(animation);
    return animation;
  }
  function particles(layer, count, global, intense, point = centre) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const node = document.createElement('i');
      node.className = global ? 'ft-storm-particle' : 'ft-burst-particle';
      const x = (i * 37 + 11) % 100;
      const dx = ((i * 53) % 120 - 60) * (global ? 2.6 : intense ? 1.4 : .75) + (point.gust ? point.dir * (global ? 100 : 55) : point.dir * 12);
      node.dataset.depth = i % 4 === 0 ? 'near' : i % 3 === 0 ? 'far' : 'middle';
      node.style.cssText = `--sx:${global ? x : intense ? 28 + x * .45 : Math.max(8,Math.min(90,point.x - 8 + x * .16))}%;--sy:${global ? -10 - i % 5 * 14 : intense ? 15 + i % 4 * 11 : Math.max(8,point.y - 5 + i % 4 * 3)}px;--dx:${dx}px;--dy:${global ? 110 : 130 + i % 4 * 14}${global ? 'dvh' : 'px'};--turn:${(i % 2 ? -1 : 1) * (season() === 'snow' ? 55 : 260 + i % 4 * 45)}deg;--size:${season() === 'snow' ? (global ? 3 : 5) + i % 5 : 7 + i % 6}px;--delay:${(season() === 'snow' ? 0 : 160) + i % 7 * (global ? 65 : 22)}ms;--life:${global ? 1850 + i % 4 * 120 : intense ? 1450 : 1000}ms`;
      fragment.append(node);
    }
    layer.append(fragment);
  }
  function makeLayer(className, parent) {
    const layer = document.createElement('span');
    layer.className = className; layer.dataset.season = season();
    layer.setAttribute('aria-hidden', 'true'); layer.inert = true;
    parent.append(layer);
    return layer;
  }
  function clearSnow() {
    snowToken++; clearTimeout(snowTimer);
    snowAnimations.forEach(a => a.cancel()); snowAnimations = [];
    bare?.remove(); bare = null;
    if (card) delete card.dataset.snowShed;
  }
  function snowFade(element, frames, duration) {
    const a = element.animate(frames, {duration, easing: 'linear'});
    a.id = 'fintex-snow-recovery'; snowAnimations.push(a);
  }
  function shedSnow() {
    clearSnow();
    const currentToken = snowToken;
    snowStarted = performance.now();
    const frames = [{opacity: 0}, {opacity: 0, offset: .28}, {opacity: .22, offset: .5}, {opacity: .65, offset: .78}, {opacity: 1}];
    const fallbackSnow = card.querySelector('.ft-fallback-snow');
    if (fallbackSnow) { snowFade(fallbackSnow, frames, RECOVER_MS); card.dataset.snowShed = 'true'; }
    else {
      const original = card.querySelector('.ft-img');
      if (!original || original.hidden || !original.getAttribute('src')?.includes('/winter/')) return;
      const image = new Image(); image.className = 'ft-shed-art'; image.alt = ''; image.setAttribute('aria-hidden', 'true');
      bare = image;
      image.src = original.src.replace('/winter/', '/winter-bare/').replace('v=62', 'v=64');
      image.decode().then(() => {
        if (snowToken !== currentToken || !playable()) return;
        const remaining = RECOVER_MS - (performance.now() - snowStarted);
        if (remaining < 3000) return;
        card.querySelector('.ft-art-motion').append(image); card.dataset.snowShed = 'true';
        image.style.transform = getComputedStyle(original).transform;
        snowFade(original, frames, remaining);
        if (crown) snowFade(crown, frames, remaining);
        snowFade(image, frames.map(f => ({...f, opacity: 1-f.opacity})), remaining);
      }).catch(() => { /* Retain snowy artwork if the local bare asset fails. */ });
    }
    snowTimer = setTimeout(() => { clearSnow(); setupScene(); }, RECOVER_MS);
  }
  function react(intense, charge, point = centre) {
    clearVisuals();
    const button = card.querySelector('.ft-art-wrap');
    const wrapper = card.querySelector('.ft-tap-motion');
    card.dataset.treeReaction = intense ? 'storm' : point.gust ? 'gust' : 'tap';
    card.dataset.windDirection = String(point.dir);
    card.dataset.tapOrigin = `${Math.round(point.x)},${Math.round(point.y)}`;
    artwork = card.dataset.artwork;
    localLayer = makeLayer('ft-burst-layer', button);
    particles(localLayer, intense ? 36 : 8 + charge * 4, false, intense, point);
    const tilt = (intense ? 10 : 2 + charge * 1.5) * -point.dir;
    animate(wrapper, [{transform: 'rotate(0)'}, {transform: `rotate(${-tilt}deg) translateX(-2px)`, offset: .16}, {transform: `rotate(${tilt}deg) translateX(2px)`, offset: .36}, {transform: `rotate(${-tilt * .6}deg)`, offset: .58}, {transform: `rotate(${tilt * .3}deg)`, offset: .78}, {transform: 'rotate(0)'}], {duration: intense ? 1050 : 520, easing: 'ease-in-out'});
    if (crown) animate(crown, [{transform:'rotate(0)'},{transform:`rotate(${-tilt * 1.45}deg)`,offset:.24},{transform:`rotate(${tilt * .8}deg)`,offset:.52},{transform:'rotate(0)'}], {duration: intense ? 1250 : 720, easing:'ease-in-out'});
    if (season() === 'petal') bloom(false);
    if (point.gust && !intense) {
      stormLayer = makeLayer('ft-storm-layer', document.body);
      particles(stormLayer, 24, true, false, point);
      hint(point.dir > 0 ? 'Порыв ветра вправо' : 'Порыв ветра влево');
    }
    if (intense) {
      stormLayer = makeLayer('ft-storm-layer', document.body);
      particles(stormLayer, 56, true, true, point);
      if (season() === 'snow') shedSnow();
      const label = season() === 'snow' ? 'Вьюга! Снег осыпался с веток' : season() === 'petal' ? 'Вихрь лепестков!' : 'Листопад! Листья закружились на ветру';
      hint(label); announce(label);
    }
    finishTimer = setTimeout(() => {
      clearVisuals();
      if (intense || point.gust) { storm = false; combo = 0; lastTap = -Infinity; delete card.dataset.tapCharge; hint(); }
    }, intense ? STORM_MS : point.gust ? 2400 : 1500);
  }
  function tap(point = centre) {
    card = tree();
    if (!playable()) { reset(); return; }
    if (storm) return; // A single bounded storm; extra taps never extend it.
    const now = performance.now();
    if (now - lastTap > COMBO_GAP || now - started > COMBO_WINDOW) { combo = 0; started = now; }
    lastTap = now; combo++;
    clearTimeout(comboTimer);
    card.dataset.tapCharge = String(combo);
    if (combo >= 4) { storm = true; react(true, combo, point); }
    else {
      hint(`Ещё ${4 - combo} ${combo === 3 ? 'касание' : 'касания'} — ${season() === 'snow' ? 'вьюга' : season() === 'petal' ? 'вихрь лепестков' : 'листопад'}`);
      react(false, combo, point);
      comboTimer = setTimeout(() => { combo = 0; lastTap = -Infinity; delete card.dataset.tapCharge; hint(); }, COMBO_GAP);
    }
  }
  function position(button,x,y) {
    const rect=button.getBoundingClientRect();
    const px=Math.max(8,Math.min(92,(x-rect.left)/rect.width*100));
    return {x:px,y:Math.max(8,Math.min(112,y-rect.top)),dir:px<50?1:-1,gust:false};
  }
  function removeScene() {
    sceneToken++;crown?.remove();flowers?.remove();crown=flowers=null;
    card?.querySelector('.ft-art-motion')?.removeAttribute('data-depth-ready');sceneSource=null;
  }
  function setupScene() {
    if(!card?.isConnected)return;
    const original=card.querySelector('.ft-img');
    const src=original?.getAttribute('src');
    if(!src||original.hidden)return;
    if(sceneSource===src){
      if(season()==='petal'&&crown)ensureFlowers(false);
      else if(season()!=='petal'&&flowers&&!flowers.dataset.temporary){flowers.remove();flowers=null;}
      return;
    }
    removeScene();sceneSource=src;const ticket=sceneToken;
    const layer=document.createElement('span');layer.className='ft-crown-motion';layer.setAttribute('aria-hidden','true');layer.inert=true;
    const img=new Image();img.className='ft-crown-art';img.alt='';img.src=src;layer.append(img);
    img.decode().then(()=>{
      if(ticket!==sceneToken||!card?.isConnected||original.getAttribute('src')!==src)return;
      if(bare){sceneSource=null;return;}
      crown=layer;const art=card.querySelector('.ft-art-motion');art.append(layer);art.dataset.depthReady='true';
      if(season()==='petal')ensureFlowers(false);
    }).catch(()=>{});
  }
  function ensureFlowers(temporary) {
    if(flowers)return;
    flowers=makeLayer('ft-blossoms',card.querySelector('.ft-art-motion'));
    if(temporary)flowers.dataset.temporary='true';
    const spots=[[38,30],[59,23],[69,39],[44,48],[61,53],[32,43]];
    for(const [x,y] of spots){
      const flower=document.createElement('span');flower.className='ft-flower';flower.style.cssText=`left:${x}%;top:${y}%;`;
      flower.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><ellipse cx="12" cy="7" rx="3.5" ry="5"/><ellipse cx="12" cy="7" rx="3.5" ry="5" transform="rotate(72 12 12)"/><ellipse cx="12" cy="7" rx="3.5" ry="5" transform="rotate(144 12 12)"/><ellipse cx="12" cy="7" rx="3.5" ry="5" transform="rotate(216 12 12)"/><ellipse cx="12" cy="7" rx="3.5" ry="5" transform="rotate(288 12 12)"/><circle cx="12" cy="12" r="2.5" fill="#d6ad55"/></svg>';
      flowers.append(flower);
    }
  }
  function bloom(completed) {
    ensureFlowers(season()!=='petal');
    [...flowers.children].forEach((flower,i)=>{
      const a=flower.animate([{transform:'scale(.35) rotate(-20deg)'},{transform:`scale(${completed?1.4:1.05}) rotate(8deg)`,offset:.32},{transform:'scale(.45) rotate(0)'}],{duration:completed?2600:1100,delay:i*65,easing:'ease-in-out'});
      a.id='fintex-tree-bloom';
      if(completed)fundingAnimations.push(a);else animations.push(a);
    });
  }
  function clearFunding() {
    clearTimeout(fundingTimer);fundingAnimations.forEach(a=>a.cancel());fundingAnimations=[];
    fundingLayer?.remove();fundingLayer=null;
    if(flowers?.dataset.temporary){flowers.remove();flowers=null;}
    if(card)delete card.dataset.fundingReaction;
  }
  function maybeCelebrate() {
    if(!pendingFunding||!card)return;
    if(performance.now()>pendingFunding.until||!allowed()){pendingFunding=null;return;}
    if(!playable()||storm||localLayer)return;
    const completed=pendingFunding.completed;pendingFunding=null;clearFunding();
    card.dataset.fundingReaction=completed?'complete':'topup';
    fundingLayer=makeLayer('ft-root-light',card.querySelector('.ft-art-wrap'));
    for(let i=0;i<7;i++){const ray=document.createElement('i');ray.style.cssText=`--ray-x:${32+i*6}%;--ray-delay:${i*90}ms`;fundingLayer.append(ray);}
    if(completed)bloom(true);
    const glow=card.querySelector('.ft-aura');
    const a=glow.animate([{opacity:.4,transform:'scale(.9)'},{opacity:1,transform:'scale(1.2)',offset:.45},{opacity:.4,transform:'scale(1)'}],{duration:completed?2800:1800,easing:'ease-in-out'});a.id='fintex-tree-funding';fundingAnimations.push(a);
    announce(completed?'Цель достигнута — дерево расцветает':'Пополнение сохранено — свет поднимается от корней');
    fundingTimer=setTimeout(clearFunding,completed?3100:2200);
  }
  function boot() {
    card = tree(); hint(); setupScene();
    document.addEventListener('pointerdown', event => {
      const button = event.target.closest('.ft-art-wrap');
      if (!button || event.isPrimary === false || event.button > 0) { pointer = null; return; }
      pointer = {id:event.pointerId,x:event.clientX,y:event.clientY,dx:0,axis:null,moved:false,button};
    }, {passive:true});
    document.addEventListener('pointermove', event => {
      if (pointer?.id !== event.pointerId) return;
      const dx = event.clientX-pointer.x, dy = event.clientY-pointer.y;
      if (Math.hypot(dx,dy) < 12) return;
      pointer.moved = true; pointer.dx = dx;
      if (!pointer.axis) pointer.axis = Math.abs(dx)>Math.abs(dy)*1.6 ? 'horizontal' : 'vertical';
      if (pointer.axis === 'horizontal' && event.cancelable) event.preventDefault();
    }, {passive:false});
    document.addEventListener('pointerup', event => {
      if (pointer?.id !== event.pointerId) return;
      if (pointer.axis === 'horizontal' && Math.abs(pointer.dx) >= 34) {
        suppressClickUntil = performance.now()+600;
        card = tree();
        if (playable() && !storm) {
          clearTimeout(comboTimer);combo=0;lastTap=-Infinity;delete card.dataset.tapCharge;
          react(false,3,{...position(pointer.button,pointer.x,pointer.y),dir:Math.sign(pointer.dx),gust:true});
        }
        pointer = null;
      }
    }, {passive:true});
    document.addEventListener('pointercancel', () => { if (pointer) { pointer.moved=true;pointer.axis='cancelled'; } }, {passive:true});
    document.addEventListener('click', event => {
      const button=event.target.closest('.ft-art-wrap');if(!button)return;
      const moved=pointer?.moved;pointer=null;
      if(event.detail>0&&(moved||performance.now()<suppressClickUntil))return;
      tap(event.detail>0?position(button,event.clientX,event.clientY):centre);
    });
    document.addEventListener('keydown', event => {
      if (event.repeat && ['Enter', ' '].includes(event.key) && event.target.closest('.ft-art-wrap')) event.preventDefault();
    });
    const cancel = () => { reset(); card = tree(); hint(); requestAnimationFrame(setupScene); };
    window.addEventListener('fintex:appearancechange', cancel);
    window.addEventListener('fintex:motionchange', cancel);
    media.addEventListener?.('change', cancel);
    window.addEventListener('fintex:goal-funded',event=>{
      if(!allowed())return;
      pendingFunding={completed:!!event.detail?.completed||!!pendingFunding?.completed,until:performance.now()+15000};
      maybeCelebrate();
    });
    window.addEventListener('pagehide',()=>{pendingFunding=null;cancel();});
    window.addEventListener('resize', cancel);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)pendingFunding=null;cancel();});
    const observer = new MutationObserver(() => {
      if ((combo || localLayer || storm || bare || fundingLayer) && (!playable() || (artwork && card.dataset.artwork !== artwork))) cancel();
      if (card !== tree()) { reset(); removeScene(); card = tree(); hint(); setupScene(); }
      const source=card?.querySelector('.ft-img');
      if(source?.getAttribute('src')!==sceneSource)setupScene();
      maybeCelebrate();
    });
    observer.observe(root, {attributes: true, attributeFilter: ['class']});
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'data-animation-paused', 'data-artwork', 'src']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
})();
