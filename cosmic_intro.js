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
  let autoTimer, exitTimer, previousFocus, previousOverflow;
  let blocked = [];
  let active = false;
  let closing = false;
  const allowed = () => !media.matches && localStorage.getItem('fp_motion') !== '0';

  function clearTimers() {
    clearTimeout(autoTimer);
    clearTimeout(exitTimer);
  }

  function finish() {
    clearTimers();
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
    splash.classList.remove('hidden', 'is-growing', 'is-leaving');
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
  document.addEventListener('visibilitychange', () => { if (document.hidden) finish(); });
  window.FintexEntrance = { launch, dismiss };
  window.launchSproutEntrance = launch;
  window.launchLuxuryEntrance = launch; // Compatibility with older callers.
})();
