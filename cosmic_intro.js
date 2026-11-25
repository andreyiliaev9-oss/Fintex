/* Living Forest / Sprout entrance.
 * The historical filename is kept for cached clients. No canvas, network calls,
 * fake loading stages or financial data; all drawing is local, decorative SVG.
 */
(function initSproutEntrance() {
  'use strict';
  const splash = document.getElementById('returning-splash');
  if (!splash) return;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  const HOLD_MS = 4600;
  const EXIT_MS = 400; // Five seconds from first frame to dashboard.
  let autoTimer, exitTimer, previousFocus, previousOverflow, handoff, flight;
  let blocked = [];
  let active = false;
  let closing = false;
  const allowed = () => !media.matches && localStorage.getItem('fp_motion') !== '0';

  function clearTimers() {
    clearTimeout(autoTimer);
    clearTimeout(exitTimer);
  }

  function clearHandoff() {
    flight?.cancel();flight=null;handoff?.remove();handoff=null;splash.classList.remove('has-brand-handoff');
  }
  function startHandoff() {
    const source=splash.querySelector('.sprout-logo'),brand=splash.querySelector('.sprout-brand');
    const target=document.querySelector('#home-header .fintex-brand-logo');
    if(!source||!brand||!target||getComputedStyle(brand).opacity<.9||document.querySelector('dialog[open]')||document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav!=='home')return;
    const from=source.getBoundingClientRect(),to=target.getBoundingClientRect();
    if(!to.width||!from.width||to.top<0||to.bottom>innerHeight||to.left<0||to.right>innerWidth)return;
    handoff=source.cloneNode(false);handoff.className='sprout-handoff';handoff.alt='';handoff.setAttribute('aria-hidden','true');
    Object.assign(handoff.style,{left:`${from.left}px`,top:`${from.top}px`,width:`${from.width}px`,height:`${from.height}px`});
    document.body.append(handoff);splash.classList.add('has-brand-handoff');
    flight=handoff.animate([{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${to.width/from.width},${to.height/from.height})`,opacity:1}],{duration:EXIT_MS-20,easing:'cubic-bezier(.65,0,.2,1)',fill:'forwards'});
    flight.id='fintex-entrance-handoff';flight.finished.catch(()=>{});
  }
  function finish() {
    clearTimers();clearHandoff();
    if (!active) return;
    splash.classList.add('hidden');
    splash.classList.remove('is-growing', 'is-leaving');
    blocked.forEach(element => { element.inert = false; });
    blocked = [];
    document.body.style.overflow = previousOverflow;
    active = closing = false;
    if (previousFocus?.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
    else document.getElementById('hdr-plus-btn')?.focus({ preventScroll: true });
  }

  function dismiss(immediate = false) {
    if (!active) return;
    clearTimeout(autoTimer);
    if (immediate || !allowed()) { finish(); return; }
    if (closing) return;
    closing = true;
    startHandoff();
    splash.classList.add('is-leaving');
    exitTimer = setTimeout(finish, EXIT_MS);
  }

  function launch() {
    if (active) finish();
    clearTimers();
    // Motion disabled means no forced wait on every app open.
    if (!allowed() || document.hidden) return;
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    blocked = Array.from(document.body.children).filter(element =>
      element instanceof HTMLElement && element !== splash && !element.inert &&
      !['SCRIPT', 'STYLE', 'LINK'].includes(element.tagName));
    blocked.forEach(element => { element.inert = true; });
    document.body.style.overflow = 'hidden';
    active = true;
    closing = false;
    splash.classList.remove('hidden', 'is-growing', 'is-leaving', 'has-brand-handoff');
    void splash.offsetWidth; // Restart CSS once, including on Settings replay.
    splash.classList.add('is-growing');
    splash.querySelector('#sprout-skip').focus({ preventScroll: true });
    autoTimer = setTimeout(() => dismiss(), HOLD_MS);
  }

  splash.addEventListener('click', () => dismiss());
  splash.addEventListener('keydown', event => {
    if (event.key === 'Escape' || (event.key === 'Enter' && event.target === splash)) {
      event.preventDefault(); dismiss();
    }
    // The only control is Skip. Keep keyboard navigation inside this modal.
    if (event.key === 'Tab') {
      event.preventDefault(); splash.querySelector('#sprout-skip').focus();
    }
  });
  const motionChanged = () => { if (!allowed()) dismiss(true); };
  media.addEventListener?.('change', motionChanged);
  window.addEventListener('fintex:motionchange', motionChanged);
  window.addEventListener('pagehide', finish);
  window.addEventListener('resize', () => { if (closing) finish(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  window.FintexEntrance = { launch, dismiss };
  window.launchSproutEntrance = launch;
  window.launchLuxuryEntrance = launch; // Compatibility with older callers.
})();
