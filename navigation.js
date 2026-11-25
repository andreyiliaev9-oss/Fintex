/* One-touch tab navigation. No ledger/storage access and no gesture interception
 * inside charts, forms, horizontal scrollers, dialogs or OS back-gesture edges. */
(() => {
  'use strict';
  const order = ['home', 'calendar', 'analytics', 'settings'];
  const current = () => document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav;
  const visible = el => !!el?.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const blocked = () => [...document.querySelectorAll('[id^="modal-"], [role="dialog"], dialog[open], #onboarding-screen, #returning-splash, #ftx-stories-overlay')].some(visible);
  let gesture = null, ghost = null;
  function protectedTarget(target, view) {
    if (!(target instanceof Element) || target.closest('a,input,select,textarea,summary,[contenteditable="true"],[role="slider"],[role="button"],svg,canvas,.ap-trend,[data-no-tab-swipe]')) return true;
    const button = target.closest('button');
    if (button && !button.matches('.cal-day')) return true;
    if (document.activeElement?.matches('input,textarea,select,[contenteditable="true"]') || String(window.getSelection()).length) return true;
    for (let el = target; el && el !== view; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 1 && /auto|scroll/.test(getComputedStyle(el).overflowX)) return true;
    }
    return false;
  }
  document.addEventListener('touchstart', event => {
    gesture = null;
    if (event.touches.length !== 1 || blocked()) return;
    const tab = current(), view = document.getElementById(`view-${tab}`), target = event.target;
    if (!view?.contains(target) || protectedTarget(target, view)) return;
    const touch = event.touches[0];
    if (touch.clientX < 24 || touch.clientX > innerWidth - 24) return;
    gesture = { id: touch.identifier, x: touch.clientX, y: touch.clientY, tab, time: performance.now(), axis: null };
  }, { passive: true });
  document.addEventListener('touchmove', event => {
    if (!gesture) return;
    if (event.touches.length !== 1 || blocked()) { gesture = null; return; }
    const touch = event.touches[0], dx = touch.clientX - gesture.x, dy = touch.clientY - gesture.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 12) return;
    if (!gesture.axis) gesture.axis = Math.abs(dx) > Math.abs(dy) * 1.6 ? 'horizontal' : 'vertical';
    if (gesture.axis === 'vertical') { gesture = null; return; }
    if (event.cancelable) event.preventDefault();
  }, { passive: false });
  document.addEventListener('touchend', event => {
    const start = gesture; gesture = null;
    if (!start || event.touches.length || blocked() || current() !== start.tab || performance.now() - start.time > 900) return;
    const touch = [...event.changedTouches].find(t => t.identifier === start.id);
    if (!touch) return;
    const dx = touch.clientX - start.x, dy = touch.clientY - start.y;
    if (Math.abs(dx) < Math.max(54, Math.min(80, innerWidth * .18)) || Math.abs(dx) <= Math.abs(dy) * 1.6 || start.axis === 'vertical') return;
    const next = order[order.indexOf(start.tab) + (dx < 0 ? 1 : -1)];
    if (!next || typeof window.goTab !== 'function') return;
    window.goTab(next);
    window.scrollTo({top:0,behavior:'instant'});
    ghost = { x: touch.clientX, y: touch.clientY, time: performance.now() };
  }, { passive: true });
  document.addEventListener('touchcancel', () => { gesture = null; }, { passive: true });
  document.addEventListener('click', event => {
    if (event.detail && ghost && performance.now() - ghost.time < 350 && Math.hypot(event.clientX - ghost.x, event.clientY - ghost.y) < 24) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
})();
