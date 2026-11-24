/* Independent visual style and light/dark mode. Loaded in <head> to avoid a
 * forest flash for returning users. No financial state is touched. */
(function () {
  'use strict';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const modes = ['dark', 'light', 'auto'];
  const styles = ['forest', 'sapphire', 'growth'];
  const backgrounds = {
    forest: {dark: '#061C12', light: '#F4F5E8'},
    sapphire: {dark: '#153073', light: '#F6F6F6'},
    growth: {dark: '#1C252B', light: '#FAF5ED'}
  };
  const read = (key, fallback, allowed) => {
    try { const value = localStorage.getItem(key); return allowed.includes(value) ? value : (key === 'fp_visual_style' && value === 'lagoon' ? 'sapphire' : fallback); }
    catch (_) { return fallback; }
  };
  let mode = read('fp_theme', 'dark', modes);
  let style = read('fp_visual_style', 'forest', styles);
  let storageError = false;
  function save(key, value) {
    try { localStorage.setItem(key, value); storageError = false; }
    catch (_) { storageError = true; }
  }
  function isDark() {
    if (mode !== 'auto') return mode === 'dark';
    const telegram = window.Telegram?.WebApp;
    // A browser-loaded Telegram SDK can exist outside an actual Telegram app.
    if (telegram?.initData && ['dark','light'].includes(telegram.colorScheme)) return telegram.colorScheme === 'dark';
    return system.matches;
  }
  function apply() {
    const dark = isDark();
    root.dataset.visualStyle = style;
    root.classList.toggle('dark', dark);
    root.style.colorScheme = dark ? 'dark' : 'light';
    const background = backgrounds[style][dark ? 'dark' : 'light'];
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', background);
    const telegram = window.Telegram?.WebApp;
    try { telegram?.setBackgroundColor?.(background); telegram?.setHeaderColor?.(background); } catch (_) {}
    document.querySelectorAll('[data-visual-style-choice]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.visualStyleChoice === style));
    });
    const index = modes.indexOf(mode);
    const thumb = document.getElementById('theme-thumb');
    if (thumb) thumb.style.transform = `translateX(${index * 100}%)`;
    document.querySelectorAll('#theme-seg .seg-item').forEach((button, i) => {
      button.className = `seg-item py-1 ${i === index ? 'text-[#041311] font-bold' : 'text-sub'}`;
      button.setAttribute('aria-pressed', String(i === index));
    });
    const status = document.getElementById('appearance-status');
    if (status) status.textContent = storageError ? 'Стиль применён, но сохранить выбор не удалось. Проверьте доступ к хранилищу.' : '';
  }
  function setMode(value) {
    if (value !== undefined && modes.includes(value)) { mode = value; save('fp_theme', mode); }
    apply();
  }
  function setStyle(value) {
    // Keep legacy links/integrations working while replacing the old style.
    if (value === 'lagoon') value = 'sapphire';
    if (!styles.includes(value)) return;
    style = value; save('fp_visual_style', style); apply();
  }
  window.FintexAppearance = {setMode, setStyle, refresh: apply};
  apply();
  document.addEventListener('DOMContentLoaded', apply, {once:true});
  system.addEventListener?.('change', () => { if (mode === 'auto') apply(); });
  window.Telegram?.WebApp?.onEvent?.('themeChanged', () => { if (mode === 'auto') apply(); });
  window.addEventListener('storage', event => {
    if (event.key !== null && !['fp_theme','fp_visual_style'].includes(event.key)) return;
    mode = read('fp_theme', 'dark', modes); style = read('fp_visual_style', 'forest', styles);
    storageError = false; apply();
  });
})();
