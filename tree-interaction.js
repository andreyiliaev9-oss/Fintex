/* A small decorative interaction, never a savings action. Native button clicks
 * cover touch, mouse, Enter and Space. No per-frame JS or financial writes. */
(() => {
  'use strict';
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const root = document.documentElement;
  const STORM_MS = 2800, COMBO_GAP = 750, COMBO_WINDOW = 1900;
  let card, combo = 0, started = 0, lastTap = -Infinity, storm = false;
  let comboTimer, finishTimer, token = 0, pointer, artwork;
  let animations = [], localLayer, stormLayer, bare;
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
    const normal = season() === 'snow' ? 'Коснитесь дерева · 4 быстрых касания — вьюга' : season() === 'petal' ? 'Коснитесь дерева · 4 быстрых касания — вихрь лепестков' : 'Коснитесь дерева · 4 быстрых касания — листопад';
    if (target) target.textContent = message || (allowed() ? normal : 'Движение отключено · накопления — кнопка «+ Пополнить»');
  }
  function announce(message) {
    const status = card?.querySelector('.ft-reaction-status');
    if (status) status.textContent = message;
  }
  function clearVisuals() {
    token++;
    clearTimeout(finishTimer);
    animations.forEach(animation => animation.cancel()); animations = [];
    localLayer?.remove(); stormLayer?.remove(); bare?.remove();
    localLayer = stormLayer = bare = null;
    if (card) { delete card.dataset.treeReaction; delete card.dataset.snowShed; }
  }
  function reset() {
    clearTimeout(comboTimer); clearVisuals();
    combo = 0; lastTap = -Infinity; storm = false; pointer = null;
    if (card) { delete card.dataset.tapCharge; hint(); announce(''); }
  }
  function animate(element, frames, options) {
    const animation = element.animate(frames, options);
    animation.id = 'fintex-tree-reaction';
    animations.push(animation);
    return animation;
  }
  function particles(layer, count, global, intense) {
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const node = document.createElement('i');
      node.className = global ? 'ft-storm-particle' : 'ft-burst-particle';
      const x = (i * 37 + 11) % 100;
      const dx = ((i * 53) % 120 - 60) * (global ? 2.6 : intense ? 1.4 : .75);
      node.style.cssText = `--sx:${global ? x : 28 + x * .45}%;--sy:${global ? -10 - i % 5 * 14 : 15 + i % 4 * 11}px;--dx:${dx}px;--dy:${global ? 110 : 130 + i % 4 * 14}${global ? 'dvh' : 'px'};--turn:${(i % 2 ? -1 : 1) * (season() === 'snow' ? 55 : 260 + i % 4 * 45)}deg;--size:${season() === 'snow' ? (global ? 3 : 5) + i % 5 : 7 + i % 6}px;--delay:${i % 7 * (global ? 65 : 22)}ms;--life:${global ? 1850 + i % 4 * 120 : intense ? 1450 : 1000}ms`;
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
  function shedSnow(currentToken) {
    const fallbackSnow = card.querySelector('.ft-fallback-snow');
    if (fallbackSnow) {
      animate(fallbackSnow, [{opacity: 0}, {opacity: 0, offset: .6}, {opacity: 1}], {duration: STORM_MS, easing: 'ease-in-out'});
      card.dataset.snowShed = 'true';
      return;
    }
    const original = card.querySelector('.ft-img');
    if (!original || original.hidden || !original.getAttribute('src')?.includes('/winter/')) return;
    const image = new Image(); image.className = 'ft-shed-art'; image.alt = ''; image.setAttribute('aria-hidden', 'true');
    bare = image;
    image.src = original.src.replace('/winter/', '/winter-bare/').replace('v=62', 'v=64');
    image.decode().then(() => {
      if (token !== currentToken || !storm || !playable()) return;
      const remaining = Math.max(0, STORM_MS - (performance.now() - lastTap));
      if (remaining < 800) return;
      card.querySelector('.ft-art-motion').append(image);
      card.dataset.snowShed = 'true';
      image.style.transform = getComputedStyle(original).transform;
      const timing = {duration: remaining, easing: 'ease-in-out'};
      animate(original, [{opacity: 0}, {opacity: 0, offset: .6}, {opacity: 1}], timing);
      animate(image, [{opacity: 1}, {opacity: 1, offset: .6}, {opacity: 0}], timing);
    }).catch(() => { /* Keep the original snowy artwork on load/decode failure. */ });
  }
  function react(intense, charge) {
    clearVisuals();
    const currentToken = token;
    const button = card.querySelector('.ft-art-wrap');
    const wrapper = card.querySelector('.ft-tap-motion');
    card.dataset.treeReaction = intense ? 'storm' : 'tap';
    artwork = card.dataset.artwork;
    localLayer = makeLayer('ft-burst-layer', button);
    particles(localLayer, intense ? 36 : 8 + charge * 4, false, intense);
    const tilt = intense ? 10 : 2 + charge * 1.5;
    animate(wrapper, [{transform: 'rotate(0)'}, {transform: `rotate(${-tilt}deg) translateX(-2px)`, offset: .16}, {transform: `rotate(${tilt}deg) translateX(2px)`, offset: .36}, {transform: `rotate(${-tilt * .6}deg)`, offset: .58}, {transform: `rotate(${tilt * .3}deg)`, offset: .78}, {transform: 'rotate(0)'}], {duration: intense ? 1050 : 520, easing: 'ease-in-out'});
    if (intense) {
      stormLayer = makeLayer('ft-storm-layer', document.body);
      particles(stormLayer, 56, true, true);
      if (season() === 'snow') shedSnow(currentToken);
      const label = season() === 'snow' ? 'Вьюга! Снег осыпался с веток' : season() === 'petal' ? 'Вихрь лепестков!' : 'Листопад! Листья закружились на ветру';
      hint(label); announce(label);
    }
    finishTimer = setTimeout(() => {
      clearVisuals();
      if (intense) { storm = false; combo = 0; lastTap = -Infinity; delete card.dataset.tapCharge; hint(); }
    }, intense ? STORM_MS : 1500);
  }
  function tap() {
    card = tree();
    if (!playable()) { reset(); return; }
    if (storm) return; // A single bounded storm; extra taps never extend it.
    const now = performance.now();
    if (now - lastTap > COMBO_GAP || now - started > COMBO_WINDOW) { combo = 0; started = now; }
    lastTap = now; combo++;
    clearTimeout(comboTimer);
    card.dataset.tapCharge = String(combo);
    if (combo >= 4) { storm = true; react(true, combo); }
    else {
      hint(`Ещё ${4 - combo} ${combo === 3 ? 'касание' : 'касания'} — ${season() === 'snow' ? 'вьюга' : season() === 'petal' ? 'вихрь лепестков' : 'листопад'}`);
      react(false, combo);
      comboTimer = setTimeout(() => { combo = 0; lastTap = -Infinity; delete card.dataset.tapCharge; hint(); }, COMBO_GAP);
    }
  }
  function boot() {
    card = tree(); hint();
    document.addEventListener('pointerdown', event => {
      if (event.target.closest('.ft-art-wrap')) pointer = {id: event.pointerId, x: event.clientX, y: event.clientY, moved: false};
    }, {passive: true});
    document.addEventListener('pointermove', event => {
      if (pointer?.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 12) pointer.moved = true;
    }, {passive: true});
    document.addEventListener('pointercancel', () => { if (pointer) pointer.moved = true; }, {passive: true});
    document.addEventListener('click', event => {
      if (!event.target.closest('.ft-art-wrap')) return;
      const moved = pointer?.moved; pointer = null;
      if (event.detail > 0 && moved) return;
      tap();
    });
    document.addEventListener('keydown', event => {
      if (event.repeat && ['Enter', ' '].includes(event.key) && event.target.closest('.ft-art-wrap')) event.preventDefault();
    });
    const cancel = () => { reset(); card = tree(); hint(); };
    window.addEventListener('fintex:appearancechange', cancel);
    window.addEventListener('fintex:motionchange', cancel);
    media.addEventListener?.('change', cancel);
    window.addEventListener('pagehide', cancel);
    window.addEventListener('resize', cancel);
    document.addEventListener('visibilitychange', cancel);
    const observer = new MutationObserver(() => {
      if ((combo || localLayer || storm) && (!playable() || card.dataset.artwork !== artwork)) cancel();
      if (card !== tree()) { reset(); card = tree(); hint(); }
    });
    observer.observe(root, {attributes: true, attributeFilter: ['class']});
    observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'data-animation-paused', 'data-artwork']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
})();
