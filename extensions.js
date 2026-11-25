/* ============================================================================
 * FINTEX — Модульный загрузчик расширений и защита стилей (extensions.js)
 * Подключается после scanner.js и app.js.
 * Автоматически применяет стили FINTEX и подгружает микро-модули Life Simulator.
 * ============================================================================ */

(function injectFintexStylesFallback() {
  const externalStylesheet = document.querySelector('link[rel="stylesheet"][href*="styles.css"]');
  if (document.getElementById('fintex-embedded-styles') || (externalStylesheet && externalStylesheet.sheet)) return;
  const cssText = ":root {\n  --bg-canvas: #F2F6F5;\n  --surface-1: #FFFFFF;\n  --surface-2: #E6EFEA;\n  --border-subtle: rgba(13, 23, 21, 0.08);\n  --border-active: rgba(0, 214, 195, 0.40);\n  --text-primary: #071311;\n  --text-secondary: #526661;\n  --text-muted: #829691;\n  --accent: #00A899;\n  --accent-2: #20C997;\n  --gold: #C99722;\n  --tabbar-bg: rgba(242, 246, 245, 0.92);\n}\n\nhtml.dark {\n  --bg-canvas: #050A09;\n  --surface-1: #0D1715;\n  --surface-2: #13221F;\n  --border-subtle: rgba(139, 156, 151, 0.11);\n  --border-active: rgba(0, 214, 195, 0.36);\n  --text-primary: #F5F7F6;\n  --text-secondary: #8B9C97;\n  --text-muted: #52635E;\n  --accent: #00D6C3;\n  --accent-2: #20C997;\n  --gold: #F2C65D;\n  --tabbar-bg: rgba(5, 10, 9, 0.90);\n}\n\n* {\n  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif;\n  -webkit-tap-highlight-color: transparent;\n  box-sizing: border-box;\n}\n\nbutton { touch-action: manipulation; cursor: pointer; }\n\nbody {\n  background-color: var(--bg-canvas);\n  color: var(--text-primary);\n  margin: 0;\n  padding-bottom: calc(92px + env(safe-area-inset-bottom));\n  overflow-x: hidden;\n  -webkit-font-smoothing: antialiased;\n  transition: background-color 0.25s ease, color 0.25s ease;\n}\n\n.tabular-nums { font-variant-numeric: tabular-nums; }\n\n/* ==================== FINTEX MOTION SYSTEM ==================== */\n@keyframes turquoiseFlow {\n  0% { background-position: 0% 50%; }\n  50% { background-position: 100% 50%; }\n  100% { background-position: 0% 50%; }\n}\n\n@keyframes prismSweep {\n  0% { transform: translateX(-140%) skewX(-24deg); }\n  45%, 100% { transform: translateX(260%) skewX(-24deg); }\n}\n\n@keyframes slideUpFade {\n  0% { opacity: 0; transform: translateY(16px) scale(0.97); }\n  100% { opacity: 1; transform: translateY(0) scale(1); }\n}\n.onboard-card-anim { animation: slideUpFade 0.36s cubic-bezier(0.22, 1, 0.36, 1) both; }\n\n@keyframes cardPopIn {\n  0% { opacity: 0; transform: scale(0.96) translateY(8px); }\n  100% { opacity: 1; transform: scale(1) translateY(0); }\n}\n.card-enter { animation: cardPopIn 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }\n\n@keyframes balanceFlash {\n  0% { box-shadow: 0 20px 44px -16px rgba(0, 214, 195, 0.24), 0 0 0 0 rgba(0, 214, 195, 0.55); }\n  50% { box-shadow: 0 20px 48px -12px rgba(0, 214, 195, 0.48), 0 0 0 4px rgba(0, 214, 195, 0.22); }\n  100% { box-shadow: 0 20px 44px -16px rgba(0, 214, 195, 0.24), 0 0 0 0 rgba(0, 214, 195, 0); }\n}\n.hero-pulse-update { animation: balanceFlash 0.65s ease-out; }\n\n@keyframes aiOrbCalm {\n  0%, 100% { transform: scale(1); box-shadow: 0 0 14px rgba(0, 214, 195, 0.45), inset 0 0 8px rgba(255, 255, 255, 0.35); }\n  50% { transform: scale(1.07); box-shadow: 0 0 22px rgba(0, 214, 195, 0.75), inset 0 0 10px rgba(255, 255, 255, 0.5); }\n}\n@keyframes aiOrbAmber {\n  0%, 100% { transform: scale(1); box-shadow: 0 0 14px rgba(242, 198, 93, 0.5); }\n  50% { transform: scale(1.1); box-shadow: 0 0 24px rgba(242, 198, 93, 0.85); }\n}\n@keyframes aiOrbAlert {\n  0%, 100% { transform: scale(1); box-shadow: 0 0 14px rgba(251, 113, 133, 0.55); }\n  50% { transform: scale(1.12); box-shadow: 0 0 26px rgba(251, 113, 133, 0.9); }\n}\n\n.ai-orb {\n  width: 28px; height: 28px; border-radius: 9999px; position: relative;\n  display: flex; align-items: center; justify-content: center;\n}\n.ai-orb::after {\n  content: ''; position: absolute; inset: -4px; border-radius: 9999px;\n  border: 1px solid currentColor; opacity: 0.35;\n}\n.ai-orb-calm {\n  background: radial-gradient(circle at 35% 35%, #A7FFF6, #00D6C3 60%, #007A70 100%);\n  color: #00D6C3; animation: aiOrbCalm 3.2s ease-in-out infinite;\n}\n.ai-orb-amber {\n  background: radial-gradient(circle at 35% 35%, #FFF2CC, #F2C65D 65%, #B88314 100%);\n  color: #F2C65D; animation: aiOrbAmber 1.8s ease-in-out infinite;\n}\n.ai-orb-alert {\n  background: radial-gradient(circle at 35% 35%, #FFE4E6, #FB7185 65%, #BE123C 100%);\n  color: #FB7185; animation: aiOrbAlert 1.2s ease-in-out infinite;\n}\n\n@keyframes receiptLaserSweep {\n  0% { top: 4%; opacity: 0.95; }\n  50% { top: 92%; opacity: 1; }\n  100% { top: 4%; opacity: 0.95; }\n}\n.scan-laser-line {\n  position: absolute; left: 0; right: 0; height: 2px;\n  background: linear-gradient(90deg, transparent, #00D6C3 20%, #FFFFFF 50%, #00D6C3 80%, transparent);\n  box-shadow: 0 0 14px 3px rgba(0, 214, 195, 0.75);\n  animation: receiptLaserSweep 1.6s ease-in-out infinite;\n  z-index: 10;\n}\n\n@keyframes spinRing { to { transform: rotate(360deg); } }\n@keyframes dataPulseTravel {\n  0% { left: 0%; opacity: 0; }\n  25% { opacity: 1; }\n  75% { opacity: 1; }\n  100% { left: 92%; opacity: 0; }\n}\n.sync-ring-spin { animation: spinRing 0.95s linear infinite; }\n.sync-pulse-dot {\n  position: absolute; top: -2px; width: 14px; height: 5px; border-radius: 999px;\n  background: #00D6C3; box-shadow: 0 0 10px #00D6C3;\n  animation: dataPulseTravel 1.1s ease-in-out infinite;\n}\n\n@keyframes drawChartLine {\n  from { stroke-dashoffset: 420; }\n  to { stroke-dashoffset: 0; }\n}\n.chart-path-anim {\n  stroke-dasharray: 420;\n  stroke-dashoffset: 0;\n  animation: drawChartLine 0.85s cubic-bezier(0.22, 1, 0.36, 1) forwards;\n}\n\n@keyframes goalRingBurst {\n  0% { transform: scale(0.8); opacity: 0.9; }\n  100% { transform: scale(1.8); opacity: 0; }\n}\n.goal-celebrate-ring { animation: goalRingBurst 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards; }\n\nhtml.no-motion *, html.no-motion *::before, html.no-motion *::after {\n  animation: none !important;\n  transition-duration: 0.01ms !important;\n}\n\n.fintex-hero {\n  background:\n    radial-gradient(110% 90% at 95% 5%, rgba(242, 198, 93, 0.12) 0%, transparent 52%),\n    linear-gradient(125deg, #071916 0%, #0C3832 32%, #09211E 60%, #104B43 85%, #071916 100%);\n  background-size: 260% 260%;\n  animation: turquoiseFlow 9s ease-in-out infinite;\n  border: 1px solid rgba(0, 214, 195, 0.30);\n  box-shadow: 0 20px 44px -16px rgba(0, 214, 195, 0.24), inset 0 1px 0 rgba(0, 214, 195, 0.22);\n  position: relative;\n  overflow: hidden;\n}\n\n.fintex-hero::after {\n  content: ''; position: absolute; top: 0; bottom: 0; width: 44%;\n  background: linear-gradient(90deg, transparent 0%, rgba(0, 214, 195, 0.08) 35%, rgba(255, 255, 255, 0.16) 50%, transparent 100%);\n  animation: prismSweep 7s ease-in-out infinite;\n  pointer-events: none;\n}\n\n\n/* ==================== 1. ЖИВАЯ 3D-КАРТА СЧЁТА (ГИРОСКОП + БЛИК) ==================== */\n.hero-stage-3d {\n  perspective: 950px;\n}\n.fintex-hero-3d {\n  transform-style: preserve-3d;\n  transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease;\n  will-change: transform;\n}\n.hero-glare {\n  position: absolute;\n  inset: 0;\n  pointer-events: none;\n  border-radius: inherit;\n  background: radial-gradient(circle at var(--gx, 75%) var(--gy, 25%), rgba(0, 214, 195, 0.26) 0%, rgba(242, 198, 93, 0.10) 28%, transparent 64%);\n  opacity: var(--go, 0.45);\n  transition: opacity 0.25s ease;\n  z-index: 2;\n}\n\n/* ==================== 2. РЕЖИМ «СТЕЛС» (BLUR-ЗАЩИТА СУММ) ==================== */\n.money-val {\n  transition: filter 0.26s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.26s ease;\n}\nbody.stealth-mode .money-val {\n  filter: blur(7.5px);\n  user-select: none;\n  pointer-events: none;\n}\n\n/* ==================== 3. ГОЛОСОВОЙ ВВОД (ЗВУКОВАЯ ВОЛНА) ==================== */\n@keyframes voiceWave {\n  0%, 100% { transform: scaleY(0.35); }\n  50% { transform: scaleY(1); }\n}\n.voice-bar {\n  width: 3.5px;\n  height: 22px;\n  border-radius: 999px;\n  background: #00D6C3;\n  animation: voiceWave 0.75s ease-in-out infinite;\n}\n.voice-bar:nth-child(2) { animation-delay: 0.12s; }\n.voice-bar:nth-child(3) { animation-delay: 0.24s; }\n.voice-bar:nth-child(4) { animation-delay: 0.36s; }\n.voice-bar:nth-child(5) { animation-delay: 0.18s; }\n\n\n/* ==================== FINTEX MOTION ENTRANCE (СВЕРХ-МОУШЕН ПРИ ВХОДЕ) ==================== */\n@keyframes orbitSpinSlow {\n  from { transform: rotate(0deg); }\n  to { transform: rotate(360deg); }\n}\n@keyframes orbitSpinRev {\n  from { transform: rotate(360deg); }\n  to { transform: rotate(0deg); }\n}\n@keyframes drawMonogramStroke {\n  0% { stroke-dashoffset: 240; opacity: 0.2; }\n  60% { opacity: 1; }\n  100% { stroke-dashoffset: 0; opacity: 1; }\n}\n@keyframes emblemScalePop {\n  0% { transform: scale(0.72); opacity: 0; }\n  65% { transform: scale(1.06); opacity: 1; }\n  100% { transform: scale(1); opacity: 1; }\n}\n@keyframes splashExitZoom {\n  0% { opacity: 1; transform: scale(1); filter: blur(0px); }\n  100% { opacity: 0; transform: scale(1.07); filter: blur(10px); }\n}\n.splash-orbit-cw { animation: orbitSpinSlow 9s linear infinite; }\n.splash-orbit-ccw { animation: orbitSpinRev 13s linear infinite; }\n.splash-emblem-pop { animation: emblemScalePop 0.65s cubic-bezier(0.22, 1, 0.36, 1) both; }\n.splash-stroke-draw {\n  stroke-dasharray: 240;\n  stroke-dashoffset: 0;\n  animation: drawMonogramStroke 0.85s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both;\n}\n.splash-exit-active {\n  animation: splashExitZoom 0.42s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;\n  pointer-events: none;\n}\n\n/* ==================== БАРАБАННЫЙ СЧЁТЧИК ЦИФР (ODOMETER ROLL) ==================== */\n.odo-wrap {\n  display: inline-flex;\n  align-items: baseline;\n  line-height: 1;\n}\n.odo-col {\n  display: inline-block;\n  height: 1.05em;\n  overflow: hidden;\n  vertical-align: bottom;\n}\n.odo-reel {\n  display: flex;\n  flex-direction: column;\n  line-height: 1.05em;\n  transition: transform 0.64s cubic-bezier(0.16, 1, 0.3, 1);\n  will-change: transform;\n}\n.odo-reel > span {\n  height: 1.05em;\n  display: flex;\n  align-items: center;\n  justify-content: center;\n}\n\n/* ==================== ТАКТИЛЬНЫЙ ПОРОГ ШТОРОК ==================== */\n.sheet-handle {\n  width: 36px;\n  height: 4px;\n  border-radius: 999px;\n  background: rgba(255, 255, 255, 0.18);\n  margin: -4px auto 0 auto;\n  transition: width 0.18s cubic-bezier(0.34, 1.56, 0.64, 1), background-color 0.18s ease, box-shadow 0.18s ease;\n}\n.sheet-handle.is-ready {\n  width: 54px;\n  background: #00D6C3;\n  box-shadow: 0 0 14px rgba(0, 214, 195, 0.85);\n}\n\n/* ==================== ЖИВОЙ ОТКЛИК ПРИ ВВОДЕ (SPRING POP) ==================== */\n@keyframes springPillPop {\n  0% { opacity: 0; transform: scale(0.76) translateY(6px); }\n  70% { opacity: 1; transform: scale(1.04) translateY(-1px); }\n  100% { opacity: 1; transform: scale(1) translateY(0); }\n}\n.live-brand-pill {\n  animation: springPillPop 0.28s cubic-bezier(0.34, 1.56, 0.64, 1) both;\n}\n\n/* ==================== ТАКТИЧЕСКИЙ ИМПУЛЬС ПРИ СЛИЯНИИ ДУБЛЕЙ ==================== */\n@keyframes mergeGoldFlash {\n  0% { background-color: rgba(242, 198, 93, 0.28); }\n  100% { background-color: transparent; }\n}\n.tx-merge-flash {\n  animation: mergeGoldFlash 1.1s ease-out;\n}\n\n\n/* ==================== ИНТЕРАКТИВНАЯ ТЕПЛОВАЯ КАРТА ТРАТ (12 НЕДЕЛЬ) ==================== */\n.hm-cell {\n  aspect-ratio: 1 / 1;\n  border-radius: 5px;\n  transition: transform 0.14s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.15s ease, background-color 0.2s ease;\n  cursor: pointer;\n}\n.hm-cell.is-selected {\n  transform: scale(1.24);\n  box-shadow: 0 0 0 2px #FFFFFF, 0 4px 12px rgba(0, 214, 195, 0.55);\n  z-index: 10;\n  position: relative;\n}\n.hm-lvl-0 { background-color: rgba(139, 156, 151, 0.14); }\n.hm-lvl-1 { background-color: rgba(0, 214, 195, 0.28); }\n.hm-lvl-2 { background-color: rgba(0, 214, 195, 0.56); }\n.hm-lvl-3 { background-color: #00D6C3; }\n.hm-lvl-4 {\n  background-color: #F2C65D;\n  box-shadow: 0 0 9px rgba(242, 198, 93, 0.42);\n}\n\n\n/* ==================== FINTEX ULTRA DESIGN & LIQUID MOTION ==================== */\nbody::before {\n  content: '';\n  position: fixed;\n  top: -120px;\n  left: 50%;\n  transform: translateX(-50%);\n  width: 440px;\n  height: 340px;\n  background: radial-gradient(circle, rgba(0, 214, 195, 0.13) 0%, rgba(242, 198, 93, 0.05) 45%, transparent 72%);\n  pointer-events: none;\n  z-index: 0;\n}\nhtml:not(.dark) body::before {\n  background: radial-gradient(circle, rgba(0, 168, 153, 0.10) 0%, rgba(201, 151, 34, 0.04) 45%, transparent 72%);\n}\n\n@keyframes liquidShimmer {\n  0% { transform: translateX(-100%); }\n  100% { transform: translateX(220%); }\n}\n\n@keyframes tabPanelReveal {\n  0% { opacity: 0; transform: translateY(10px) scale(0.985); }\n  100% { opacity: 1; transform: translateY(0) scale(1); }\n}\n.tab-panel-anim {\n  animation: tabPanelReveal 0.34s cubic-bezier(0.22, 1, 0.36, 1) both;\n}\n\n@keyframes hmCellPop {\n  0% { opacity: 0; transform: scale(0.45); }\n  75% { opacity: 1; transform: scale(1.08); }\n  100% { opacity: 1; transform: scale(1); }\n}\n.hm-cell-anim {\n  animation: hmCellPop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1) both;\n}\n\n.liquid-bar-fill {\n  position: relative;\n  overflow: hidden;\n  transition: width 0.62s cubic-bezier(0.22, 1, 0.36, 1);\n}\n.liquid-bar-fill::after {\n  content: '';\n  position: absolute;\n  top: 0; bottom: 0; left: 0;\n  width: 45%;\n  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.42), transparent);\n  animation: liquidShimmer 2.8s ease-in-out infinite;\n}\n\n/* Поверхность карточек с внутренним световым кантом и интерактивным бликом */\nhtml.dark .card-surface {\n  background: linear-gradient(165deg, rgba(17, 31, 28, 0.94) 0%, rgba(11, 21, 19, 0.98) 100%);\n  border: 1px solid rgba(0, 214, 195, 0.12);\n  box-shadow: 0 10px 28px -14px rgba(0, 0, 0, 0.72), inset 0 1px 0 rgba(255, 255, 255, 0.06);\n  position: relative;\n}\nhtml:not(.dark) .card-surface {\n  box-shadow: 0 8px 24px -12px rgba(7, 19, 17, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.9);\n  position: relative;\n}\n.card-surface::before {\n  content: '';\n  position: absolute;\n  inset: 0;\n  border-radius: inherit;\n  pointer-events: none;\n  background: radial-gradient(240px circle at var(--mx, 50%) var(--my, 0%), rgba(0, 214, 195, 0.11), transparent 70%);\n  opacity: var(--mo, 0);\n  transition: opacity 0.25s ease;\n}\n\n/* Плавающий индикатор активной вкладки в нижней навигации */\n.nav-pill-slider {\n  position: absolute;\n  top: 6px;\n  bottom: calc(6px + env(safe-area-inset-bottom));\n  left: 12px;\n  width: calc((100% - 24px) / 4);\n  border-radius: 14px;\n  background: linear-gradient(180deg, rgba(0, 214, 195, 0.16) 0%, rgba(0, 214, 195, 0.05) 100%);\n  border: 1px solid rgba(0, 214, 195, 0.28);\n  box-shadow: 0 0 18px rgba(0, 214, 195, 0.14);\n  transition: transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1);\n  pointer-events: none;\n  z-index: 0;\n}\n.nav-tab { position: relative; z-index: 1; }\n\n.hero-amount-glow { text-shadow: 0 0 26px rgba(0, 214, 195, 0.34); }\n\n.btn-turquoise {\n  background: linear-gradient(120deg, #009E90 0%, #00D6C3 50%, #20C997 100%);\n  background-size: 220% 220%;\n  animation: turquoiseFlow 5s ease-in-out infinite;\n  color: #041311;\n  font-weight: 700;\n  border: 1px solid rgba(255, 255, 255, 0.28);\n  box-shadow: 0 8px 22px -6px rgba(0, 214, 195, 0.42);\n  transition: transform 0.14s ease;\n}\n.btn-turquoise:active { transform: scale(0.96); }\n\n.btn-teal-soft {\n  background-color: rgba(0, 214, 195, 0.11);\n  border: 1px solid rgba(0, 214, 195, 0.24);\n  color: var(--accent);\n  transition: transform 0.14s ease, background-color 0.15s ease;\n}\n.btn-teal-soft:active { transform: scale(0.96); background-color: rgba(0, 214, 195, 0.18); }\n\n.btn-gold-soft {\n  background-color: rgba(242, 198, 93, 0.13);\n  border: 1px solid rgba(242, 198, 93, 0.34);\n  color: var(--gold);\n  transition: transform 0.14s ease;\n}\n.btn-gold-soft:active { transform: scale(0.96); }\n\n.gold-payday-cell {\n  background: rgba(242, 198, 93, 0.12);\n  border: 1px solid rgba(242, 198, 93, 0.52);\n  color: var(--gold);\n}\n\n.card-surface {\n  background-color: var(--surface-1);\n  border: 1px solid var(--border-subtle);\n  border-radius: 20px;\n  transition: background-color 0.2s ease, border-color 0.2s ease;\n}\n\n.input-surface {\n  background-color: var(--surface-2);\n  border: 1px solid var(--border-subtle);\n  color: var(--text-primary);\n  border-radius: 13px;\n  transition: border-color 0.15s ease;\n}\n.input-surface:focus { outline: none; border-color: var(--accent); }\n\n.field-uncertain {\n  border: 1px solid rgba(242, 198, 93, 0.80) !important;\n  background-color: rgba(242, 198, 93, 0.10) !important;\n}\n\n.tap { transition: transform 0.14s ease, opacity 0.14s ease; }\n.tap:active { transform: scale(0.96); }\n\n.text-main { color: var(--text-primary); }\n.text-sub { color: var(--text-secondary); }\n.text-dim { color: var(--text-muted); }\n.text-brand { color: var(--accent); }\n.text-mint { color: var(--accent-2); }\n.text-gold { color: var(--gold); }\n.divider-line { border-color: var(--border-subtle); }\n\n.seg-track {\n  background-color: var(--surface-2);\n  border: 1px solid var(--border-subtle);\n  border-radius: 11px;\n  padding: 2.5px;\n  display: grid;\n  position: relative;\n}\n.seg-thumb {\n  position: absolute;\n  top: 2.5px; bottom: 2.5px; left: 2.5px;\n  background: linear-gradient(125deg, #00A899 0%, #00D6C3 100%);\n  border-radius: 8.5px;\n  box-shadow: 0 2px 10px rgba(0, 214, 195, 0.30);\n  transition: transform 0.24s cubic-bezier(0.25, 1, 0.5, 1);\n  z-index: 1;\n}\n.seg-item { position: relative; z-index: 2; transition: color 0.15s ease; }\n\n.nav-active-glow { filter: drop-shadow(0 0 8px rgba(0, 214, 195, 0.45)); }\n.nav-tab svg {\n  transition: transform 0.34s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.25s ease;\n}\n.nav-tab.is-active-tab svg {\n  transform: scale(1.18) translateY(-1.5px);\n}\n\n/* ==================== LIVING PROGRESS (ВОЛНА НА ГРАНИЦЕ ЗАПОЛНЕНИЯ) ==================== */\n@keyframes livingWaveEdge {\n  0%, 100% { transform: translateY(-50%) scaleY(0.85) scaleX(0.95); opacity: 0.78; }\n  50% { transform: translateY(-50%) scaleY(1.32) scaleX(1.12); opacity: 1; }\n}\n.living-progress-bar {\n  position: relative;\n  overflow: visible !important;\n  transition: width 0.78s cubic-bezier(0.22, 1, 0.36, 1);\n}\n.living-progress-bar::before {\n  content: '';\n  position: absolute;\n  inset: 0;\n  border-radius: inherit;\n  overflow: hidden;\n  background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.34) 50%, transparent 100%);\n  animation: liquidShimmer 2.6s ease-in-out infinite;\n}\n.living-progress-bar::after {\n  content: '';\n  position: absolute;\n  right: -3px;\n  top: 50%;\n  width: 9px;\n  height: 130%;\n  border-radius: 999px;\n  background: radial-gradient(circle, #FFFFFF 0%, #00D6C3 55%, transparent 100%);\n  box-shadow: 0 0 12px 2px rgba(0, 214, 195, 0.85);\n  animation: livingWaveEdge 1.75s ease-in-out infinite;\n  pointer-events: none;\n}\n\n/* ==================== STAGGERED REVEAL (КАСКАДНОЕ ПОЯВЛЕНИЕ ОПЕРАЦИЙ) ==================== */\n@keyframes staggerItemIn {\n  0% { opacity: 0; transform: translateY(11px) scale(0.985); }\n  100% { opacity: 1; transform: translateY(0) scale(1); }\n}\n.stagger-item {\n  opacity: 0;\n  animation: staggerItemIn 0.34s cubic-bezier(0.22, 1, 0.36, 1) forwards;\n}\n\n/* ==================== PULL-CORD ФИЗИКА ДЛЯ ГОЛОСОВОГО ВВОДА ==================== */\n.voice-cord-stage {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  align-items: center;\n  touch-action: none;\n  user-select: none;\n}\n.voice-cord-svg {\n  width: 120px;\n  height: 44px;\n  overflow: visible;\n  pointer-events: none;\n  margin-bottom: -6px;\n}\n.voice-orb-pull {\n  will-change: transform;\n  position: relative;\n  z-index: 2;\n}\n.voice-orb-pull.is-listening {\n  box-shadow: 0 0 0 8px rgba(0, 214, 195, 0.16), 0 0 28px rgba(0, 214, 195, 0.65);\n}\n\n/* ==================== СВЯЗАННЫЕ УЗЛЫ КАТЕГОРИЙ (KNOWLEDGE GRAPH) ==================== */\n.cat-node-btn {\n  transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s ease, background-color 0.2s ease;\n}\n.cat-node-btn.is-selected {\n  transform: scale(1.05);\n  border-color: #00D6C3 !important;\n  background-color: rgba(0, 214, 195, 0.14) !important;\n  box-shadow: 0 6px 18px -6px rgba(0, 214, 195, 0.45);\n}\n.plus-icon-rot { transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1); }\n.plus-icon-rot.is-open { transform: rotate(45deg); }\n\n.tx-swipe-wrap { position: relative; overflow: hidden; background-color: var(--surface-1); }\n.tx-swipe-actions { position: absolute; top: 0; right: 0; bottom: 0; width: 128px; display: grid; grid-template-columns: 1fr 1fr; }\n.tx-swipe-content { position: relative; z-index: 2; background-color: var(--surface-1); transition: transform 0.22s cubic-bezier(0.22, 1, 0.36, 1); }\n\n.tabbar-glass {\n  background-color: var(--tabbar-bg);\n  backdrop-filter: blur(22px);\n  -webkit-backdrop-filter: blur(22px);\n  border-top: 1px solid var(--border-subtle);\n  padding-bottom: env(safe-area-inset-bottom);\n}\n\n.modal-overlay { background: rgba(2, 7, 6, 0.82); backdrop-filter: blur(5px); -webkit-backdrop-filter: blur(5px); }\n.modal-sheet {\n  background-color: var(--surface-1);\n  border-top: 1px solid var(--border-active);\n  border-radius: 24px 24px 0 0;\n  padding-bottom: calc(24px + env(safe-area-inset-bottom));\n  transition: transform 0.24s cubic-bezier(0.22, 1, 0.36, 1);\n}\n\n.no-scrollbar::-webkit-scrollbar { display: none; }\n.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }\n";
  const styleEl = document.createElement('style');
  styleEl.id = 'fintex-embedded-styles';
  styleEl.textContent = cssText;
  
  const extraCss = `
    /* ==================== УМНАЯ ЛЕНТА ОПЕРАЦИЙ — МИРОВОЙ УРОВЕНЬ ==================== */
    @keyframes feedChipMount {
      0%   { opacity: 0; transform: translate3d(12px, 0, 0) scale(0.92); }
      100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    }
    .feed-chip-mount {
      opacity: 0;
      animation: feedChipMount 0.42s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .puzzle-chip-in {
      transition: transform 0.16s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.22s ease, border-color 0.22s ease, color 0.22s ease, box-shadow 0.22s ease;
    }

    @keyframes txCascadeRise {
      0%   { opacity: 0; transform: translate3d(0, 14px, 0) scale(0.985); }
      100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    }
    .tx-cascade-row {
      opacity: 0;
      animation: txCascadeRise 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      will-change: transform, opacity;
    }
    .puzzle-row-left,
    .puzzle-row-right {
      opacity: 0;
      animation: txCascadeRise 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .tx-swipe-wrap {
      position: relative;
      overflow: hidden;
      background-color: var(--surface-1);
      transition: max-height 0.26s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease, transform 0.26s cubic-bezier(0.16, 1, 0.3, 1);
      max-height: 260px;
    }
    .tx-swipe-wrap.tx-row-collapsing {
      max-height: 0px !important;
      opacity: 0 !important;
      transform: translate3d(-24px, 0, 0) scale(0.96) !important;
      border-bottom-width: 0 !important;
      pointer-events: none;
    }

    .tx-swipe-content {
      position: relative;
      z-index: 2;
      background-color: var(--surface-1);
      transition: transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.18s ease;
      will-change: transform;
    }
    .tx-swipe-content:active {
      background-color: rgba(0, 214, 195, 0.045);
    }

    .tx-swipe-actions button {
      transition: transform 0.18s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.18s ease;
    }

    /* Плавный аккордеон позиций чека прямо в ленте */
    .tx-receipt-drawer {
      display: grid;
      grid-template-rows: 0fr;
      transition: grid-template-rows 0.30s cubic-bezier(0.16, 1, 0.3, 1);
      background: rgba(0, 0, 0, 0.22);
    }
    html:not(.dark) .tx-receipt-drawer {
      background: rgba(7, 19, 17, 0.03);
    }
    .tx-receipt-drawer.is-open {
      grid-template-rows: 1fr;
    }
    .tx-receipt-drawer-inner {
      overflow: hidden;
    }
    .tx-chevron-rot {
      display: inline-block;
      transition: transform 0.26s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .tx-chevron-rot.is-open {
      transform: rotate(180deg);
    }

    /* Направленная хореография слайдов онбординга */
    @keyframes obSlideNextIn {
      0%   { opacity: 0; transform: translate3d(28px, 0, 0) scale(0.975); }
      100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
    }
    .ob-slide-next {
      animation: obSlideNextIn 0.42s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    input[type="range"].fintex-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 28px;
      background: transparent;
      touch-action: pan-y;
      cursor: pointer;
    }
    input[type="range"].fintex-slider::-webkit-slider-runnable-track {
      height: 6px;
      border-radius: 999px;
      background: linear-gradient(90deg, #00D6C3 var(--fill-pct, 30%), rgba(255, 255, 255, 0.14) var(--fill-pct, 30%));
    }
    input[type="range"].fintex-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 24px;
      height: 24px;
      border-radius: 9999px;
      background: #FFFFFF;
      border: 3px solid #00D6C3;
      box-shadow: 0 3px 12px rgba(0, 214, 195, 0.55);
      margin-top: -9px;
    }
  `;

  styleEl.textContent += extraCss;
  (document.head || document.documentElement).appendChild(styleEl);
})();

if (typeof state !== 'undefined' && !window.state) {
  window.state = state;
}

window.FINTEX_EXT = {
  version: '2.1',
  modules: ['quick_add.js', 'analytics_pro.js', 'cosmic_intro.js', 'stories_recap.js'],

  loadModule(src) {
    if (
      document.querySelector(`script[data-fintex-mod="${src}"]`) ||
      document.querySelector(`script[src*="${src}"]`)
    ) {
      return;
    }
    const s = document.createElement('script');
    s.src = `./${src}?v=${src==='analytics_pro.js'?51:34}`;
    s.dataset.fintexMod = src;
    s.async = false;
    s.onload = () => {
      try {
        if (src === 'analytics_pro.js' && typeof renderAnalytics === 'function') {
          renderAnalytics();
        }
        window.FINTEX_SIM?.onModuleReady?.(src);
      } catch (e) {}
    };
    document.body.appendChild(s);
  },

  init() {
    try {
      if (typeof state !== 'undefined' && !window.state) window.state = state;
      if (typeof setTheme === 'function') setTheme();
      if (typeof renderAll === 'function') renderAll(false);
    } catch (e) {}
    this.modules.forEach((m) => this.loadModule(m));
  },

  onAfterRender() {
    try {
      if (typeof state !== 'undefined' && !window.state) window.state = state;
      window.FINTEX_SIM?.onAfterRender?.();
    } catch (e) {}
  },

  onTransactionsAdded(newTxs) {
    try { window.FINTEX_SIM?.onTransactionsAdded?.(newTxs); } catch (e) {}
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    try { window.FINTEX_EXT.init(); } catch (e) {}
  });
} else {
  try { window.FINTEX_EXT.init(); } catch (e) {}
}


/* ============================================================================
 * FINTEX Batch Selection, Swipe-to-Delete & Undo Engine
 * ============================================================================ */
(function initFintexBatchSelectEngine() {
  const STYLE_ID = 'fintex-batch-select-styles';
  if (!document.getElementById(STYLE_ID)) {
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = `
      .tx-select-check {
        width: 20px;
        height: 20px;
        border-radius: 7px;
        border: 1.5px solid rgba(0, 214, 195, 0.45);
        background: rgba(5, 14, 12, 0.8);
        display: inline-flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        transition: all 0.18s cubic-bezier(0.22, 1, 0.36, 1);
      }
      .tx-select-check.is-checked {
        background: #00D6C3;
        border-color: #00D6C3;
        box-shadow: 0 0 12px rgba(0, 214, 195, 0.45);
        transform: scale(1.06);
      }
      .tx-row-selected .tx-swipe-content {
        background: rgba(0, 214, 195, 0.11) !important;
      }
      @keyframes batchDockSlideUp {
        0%   { opacity: 0; transform: translate3d(0, 18px, 0) scale(0.97); }
        100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
      }
      .batch-dock-anim {
        animation: batchDockSlideUp 0.24s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }
    `;
    document.head.appendChild(st);
  }

  let visibleRowIdsCache = [];
  let undoBannerTimer = null;

  function ensureSelectHeaderButton() {
    const todayBtn = document.getElementById('feed-today-btn');
    if (!todayBtn || !todayBtn.parentElement) return;
    let btn = document.getElementById('feed-select-mode-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'feed-select-mode-btn';
      btn.type = 'button';
      btn.onclick = () => window.toggleTxSelectMode();
      todayBtn.parentElement.insertBefore(btn, todayBtn);
    }
    const st = typeof state !== 'undefined' ? state : window.state;
    const active = Boolean(st && st.txSelectMode);
    btn.className = active
      ? 'px-2 py-0.5 rounded-md bg-[#00D6C3]/20 border border-[#00D6C3]/45 text-[11px] font-bold text-brand tap'
      : 'text-[11px] font-semibold text-sub hover:text-brand tap';
    btn.textContent = active ? 'Готово' : 'Выбрать';
  }

  window.toggleTxSelectMode = function (forceVal, initialTxId) {
    if (!window.state) return;
    const next = typeof forceVal === 'boolean' ? forceVal : !window.state.txSelectMode;
    window.state.txSelectMode = next;
    if (!Array.isArray(window.state.selectedTxIds)) window.state.selectedTxIds = [];
    if (!next) {
      window.state.selectedTxIds = [];
    } else if (initialTxId && !window.state.selectedTxIds.includes(initialTxId)) {
      window.state.selectedTxIds.push(initialTxId);
    }
    try { if (typeof vibro === 'function') vibro('selection'); } catch (e) {}
    if (typeof renderHome === 'function') renderHome();
    else window.renderBatchActionDock();
  };

  window.toggleTxSelection = function (id) {
    if (!window.state) return;
    if (!Array.isArray(window.state.selectedTxIds)) window.state.selectedTxIds = [];
    const idx = window.state.selectedTxIds.indexOf(id);
    if (idx >= 0) window.state.selectedTxIds.splice(idx, 1);
    else window.state.selectedTxIds.push(id);
    try { if (typeof vibro === 'function') vibro('light'); } catch (e) {}
    if (typeof renderHome === 'function') renderHome();
    else window.renderBatchActionDock();
  };

  window.selectAllVisibleTxs = function () {
    if (!window.state) return;
    const current = new Set(window.state.selectedTxIds || []);
    const allSelected = visibleRowIdsCache.length > 0 && visibleRowIdsCache.every(id => current.has(id));
    if (allSelected) {
      window.state.selectedTxIds = [];
    } else {
      window.state.selectedTxIds = Array.from(new Set([...current, ...visibleRowIdsCache]));
    }
    try { if (typeof vibro === 'function') vibro('selection'); } catch (e) {}
    if (typeof renderHome === 'function') renderHome();
    else window.renderBatchActionDock();
  };

  window.deleteSelectedTxs = function () {
    if (!window.state || !Array.isArray(window.state.selectedTxIds) || !window.state.selectedTxIds.length) return;
    const toDelete = [...window.state.selectedTxIds];
    window.state.txSelectMode = false;
    window.state.selectedTxIds = [];
    if (typeof deleteTxsBatch === 'function') {
      deleteTxsBatch(toDelete);
    }
  };

  window.showUndoDeleteToast = function (count) {
    let banner = document.getElementById('fintex-undo-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'fintex-undo-banner';
      banner.className = 'fixed bottom-20 left-3.5 right-3.5 max-w-md mx-auto z-[65] rounded-2xl border border-[#00D6C3]/40 bg-[#081714]/95 backdrop-blur-xl px-4 py-3 shadow-[0_16px_38px_rgba(0,0,0,0.72)] flex items-center justify-between gap-3 batch-dock-anim';
      document.body.appendChild(banner);
    }
    const label = count > 1 ? `Удалено операций: ${count}` : 'Операция удалена';
    banner.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <span class="w-2 h-2 rounded-full bg-rose-400 shrink-0"></span>
        <span class="text-xs font-semibold text-white truncate">${label}</span>
      </div>
      <button type="button" onclick="dismissUndoBanner(); undoLastTxDelete();" class="px-3 py-1.5 rounded-xl btn-turquoise text-xs font-extrabold shrink-0 tap">
        Отменить
      </button>
    `;
    banner.classList.remove('hidden');
    if (undoBannerTimer) clearTimeout(undoBannerTimer);
    undoBannerTimer = setTimeout(() => {
      window.dismissUndoBanner();
    }, 4500);
  };

  window.dismissUndoBanner = function () {
    const banner = document.getElementById('fintex-undo-banner');
    if (banner) banner.classList.add('hidden');
    if (undoBannerTimer) { clearTimeout(undoBannerTimer); undoBannerTimer = null; }
  };

  window.renderBatchActionDock = function (visibleRows) {
    ensureSelectHeaderButton();
    if (Array.isArray(visibleRows)) {
      visibleRowIdsCache = visibleRows.map(r => r.id);
    }
    let dock = document.getElementById('tx-batch-dock');
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'tx-batch-dock';
      document.body.appendChild(dock);
    }
    const isSelect = Boolean(window.state && window.state.txSelectMode);
    const selectedIds = Array.isArray(window.state?.selectedTxIds) ? window.state.selectedTxIds : [];
    const homeView = document.getElementById('view-home');
    const isHomeVisible = homeView && !homeView.classList.contains('hidden');

    if (!isSelect || !isHomeVisible) {
      dock.className = 'hidden';
      dock.innerHTML = '';
      return;
    }

    const count = selectedIds.length;
    const allChecked = visibleRowIdsCache.length > 0 && visibleRowIdsCache.every(id => selectedIds.includes(id));

    dock.className = 'fixed bottom-[76px] left-3.5 right-3.5 max-w-md mx-auto z-40 rounded-2xl border border-[#00D6C3]/40 bg-[#071513]/95 backdrop-blur-2xl p-2.5 shadow-[0_18px_42px_rgba(0,0,0,0.78)] flex items-center justify-between gap-2 batch-dock-anim';
    dock.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <button type="button" onclick="selectAllVisibleTxs()" class="px-2.5 py-2 rounded-xl input-surface border border-white/10 text-[11px] font-bold text-main shrink-0 tap">
          ${allChecked ? 'Снять все' : `Все (${visibleRowIdsCache.length})`}
        </button>
        <span class="text-xs font-extrabold text-brand tabular-nums truncate">
          Выбрано: ${count}
        </span>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button type="button" onclick="toggleTxSelectMode(false)" class="px-2.5 py-2 rounded-xl input-surface text-[11px] font-semibold text-sub tap">
          Отмена
        </button>
        <button type="button" ${count === 0 ? 'disabled' : ''} onclick="deleteSelectedTxs()"
          class="px-3 py-2 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-all tap ${
            count > 0
              ? 'bg-rose-500 text-white shadow-[0_6px_18px_rgba(244,63,94,0.4)]'
              : 'bg-white/5 text-sub/50 cursor-not-allowed'
          }">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          <span>Удалить${count > 0 ? ` (${count})` : ''}</span>
        </button>
      </div>
    `;
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
  };
})();
