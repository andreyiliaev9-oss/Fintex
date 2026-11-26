/* Theme-specific decorative weather. Fixed node budget, CSS-only frames;
 * never reads or writes financial state and never intercepts input. */
(() => {
  'use strict';
  if (document.getElementById('theme-atmosphere')) return;
  const layer = document.createElement('div');
  layer.id = 'theme-atmosphere';
  layer.setAttribute('aria-hidden', 'true');
  layer.inert = true;
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < 24; i++) {
    const particle = document.createElement('i');
    particle.className = 'theme-particle';
    particle.style.cssText = `--x:${(i * 37 + 5) % 100}%;--duration:${12 + i % 5 * 2}s;--delay:${-i * 2.7}s;--sway:${i % 2 ? -24 : 30}px;--size:${4 + i % 4}px`;
    fragment.append(particle);
  }
  layer.append(fragment);
  document.body.append(layer);
  const sync = () => { layer.dataset.paused = String(document.hidden); };
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { layer.dataset.paused = 'true'; });
  window.addEventListener('pageshow', sync);
  sync();
})();
