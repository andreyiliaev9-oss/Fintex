/* ============================================================================
 * FINTEX Cosmic Motion Entrance (cosmic_intro.js)
 * Кинематографическая космическая заставка входа: звёздное поле, туманность,
 * многослойный орбитальный реактор FINTEX, телеметрия и плавный монтаж перехода.
 * ============================================================================ */

(function initFintexCosmicIntro() {
  const CSS_ID = 'fintex-cosmic-intro-styles';
  if (!document.getElementById(CSS_ID)) {
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
      @keyframes cosmicNebulaDrift {
        0%   { transform: translate(-50%, -50%) scale(0.92) rotate(0deg); opacity: 0.72; }
        50%  { transform: translate(-48%, -52%) scale(1.08) rotate(180deg); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(0.92) rotate(360deg); }
      }
      @keyframes cosmicOrbitCw {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
      @keyframes cosmicOrbitCcw {
        from { transform: rotate(360deg); }
        to   { transform: rotate(0deg); }
      }
      @keyframes cosmicCoreBreath {
        0%, 100% {
          transform: scale(1);
          box-shadow: 0 0 32px rgba(0, 214, 195, 0.45), inset 0 0 18px rgba(0, 214, 195, 0.25);
        }
        50% {
          transform: scale(1.045);
          box-shadow: 0 0 54px rgba(0, 214, 195, 0.8), 0 0 90px rgba(242, 198, 93, 0.22), inset 0 0 24px rgba(0, 214, 195, 0.45);
        }
      }
      @keyframes cosmicStrokeDraw {
        0%   { stroke-dashoffset: 160; opacity: 0; }
        25%  { opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 1; }
      }
      @keyframes cosmicCinemaRise {
        0%   { opacity: 0; transform: translateY(22px) scale(0.96); filter: blur(6px); }
        100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0px); }
      }
      @keyframes cosmicScanBeam {
        0%   { top: -10%; opacity: 0; }
        20%  { opacity: 0.55; }
        80%  { opacity: 0.55; }
        100% { top: 110%; opacity: 0; }
      }
      @keyframes cosmicWarpExit {
        0%   { opacity: 1; transform: scale(1); filter: blur(0px) brightness(1); }
        45%  { opacity: 0.92; transform: scale(1.03); filter: blur(2px) brightness(1.18); }
        100% { opacity: 0; transform: scale(1.14); filter: blur(16px) brightness(1.35); }
      }
      @keyframes cosmicTelemetryFill {
        0%   { width: 0%; }
        100% { width: 100%; }
      }

      #returning-splash.cosmic-stage {
        background: radial-gradient(ellipse at 50% 38%, #081F1C 0%, #040B0A 52%, #020505 100%) !important;
      }
      .cosmic-nebula-ring {
        position: absolute;
        top: 42%; left: 50%;
        width: 420px; height: 420px;
        border-radius: 9999px;
        background: conic-gradient(
          from 0deg,
          rgba(0, 214, 195, 0.20),
          rgba(56, 189, 248, 0.08),
          rgba(242, 198, 93, 0.16),
          rgba(0, 214, 195, 0.04),
          rgba(0, 214, 195, 0.20)
        );
        filter: blur(42px);
        animation: cosmicNebulaDrift 18s linear infinite;
        pointer-events: none;
      }
      .cosmic-scanline {
        position: absolute;
        left: 0; right: 0; height: 1px;
        background: linear-gradient(90deg, transparent, rgba(0, 214, 195, 0.45), rgba(242, 198, 93, 0.35), transparent);
        box-shadow: 0 0 18px rgba(0, 214, 195, 0.5);
        animation: cosmicScanBeam 4.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        pointer-events: none;
      }
      .cosmic-orbit-1 { animation: cosmicOrbitCw 16s linear infinite; }
      .cosmic-orbit-2 { animation: cosmicOrbitCcw 22s linear infinite; }
      .cosmic-orbit-3 { animation: cosmicOrbitCw 30s linear infinite; }
      .cosmic-core-box { animation: cosmicCoreBreath 3.6s ease-in-out infinite; }
      .cosmic-logo-path {
        stroke-dasharray: 160;
        stroke-dashoffset: 160;
        animation: cosmicStrokeDraw 1.5s cubic-bezier(0.22, 1, 0.36, 1) 0.25s forwards;
      }
      .cosmic-seq-1 { opacity: 0; animation: cosmicCinemaRise 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards; }
      .cosmic-seq-2 { opacity: 0; animation: cosmicCinemaRise 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.65s forwards; }
      .cosmic-seq-3 { opacity: 0; animation: cosmicCinemaRise 0.85s cubic-bezier(0.16, 1, 0.3, 1) 0.95s forwards; }
      .cosmic-seq-4 { opacity: 0; animation: cosmicCinemaRise 0.85s cubic-bezier(0.16, 1, 0.3, 1) 1.25s forwards; }

      .cosmic-progress-fill {
        animation: cosmicTelemetryFill 3.4s cubic-bezier(0.25, 0.8, 0.25, 1) forwards;
      }
      #returning-splash.cosmic-warp-exit {
        animation: cosmicWarpExit 0.78s cubic-bezier(0.22, 1, 0.36, 1) forwards !important;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  let autoTimer = null;
  let statusInterval = null;
  let starAnimId = null;

  function startStarfield(canvas) {
    if (!canvas) return;
    if (starAnimId) cancelAnimationFrame(starAnimId);
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = (canvas.width = window.innerWidth * dpr);
    const h = (canvas.height = window.innerHeight * dpr);
    const cx = w / 2;
    const cy = h * 0.42;

    const stars = Array.from({ length: 68 }, () => ({
      angle: Math.random() * Math.PI * 2,
      radius: 18 + Math.random() * Math.max(w, h) * 0.52,
      speed: 0.0006 + Math.random() * 0.0014,
      size: (0.7 + Math.random() * 1.6) * dpr,
      alpha: 0.25 + Math.random() * 0.65,
      gold: Math.random() > 0.78
    }));

    function renderFrame() {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        s.angle += s.speed;
        const x = cx + Math.cos(s.angle) * s.radius;
        const y = cy + Math.sin(s.angle) * s.radius * 0.72;
        ctx.beginPath();
        ctx.arc(x, y, s.size, 0, Math.PI * 2);
        ctx.fillStyle = s.gold
          ? `rgba(242, 198, 93, ${s.alpha})`
          : `rgba(0, 214, 195, ${s.alpha})`;
        ctx.fill();
      }
      starAnimId = requestAnimationFrame(renderFrame);
    }
    renderFrame();
  }

  function stopStarfield() {
    if (starAnimId) {
      cancelAnimationFrame(starAnimId);
      starAnimId = null;
    }
  }

  function buildCosmicSplashDOM(splash, userName, bankName, dailyText) {
    splash.className = 'fixed inset-0 z-50 cosmic-stage flex flex-col items-center justify-between px-6 py-9 text-center text-white cursor-pointer overflow-hidden';
    splash.innerHTML = `
      <canvas id="cosmic-starfield-canvas" class="absolute inset-0 w-full h-full pointer-events-none"></canvas>
      <div class="cosmic-nebula-ring"></div>
      <div class="cosmic-scanline"></div>

      <!-- Верхняя космическая телеметрия -->
      <div class="w-full flex items-center justify-between relative z-10 cosmic-seq-1">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-[#00D6C3] animate-pulse"></span>
          <span class="text-[10px] font-extrabold tracking-[0.28em] text-brand">FINTEX COSMOS</span>
        </div>
        <span class="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-white/[0.05] border border-[#00D6C3]/25 text-sub backdrop-blur-md">
          ${bankName}
        </span>
      </div>

      <!-- Центральный орбитальный реактор -->
      <div class="my-auto flex flex-col items-center relative z-10">
        <div class="relative w-44 h-44 flex items-center justify-center mb-6">
          <!-- Внешняя орбита с космическими спутниками -->
          <div class="absolute inset-0 rounded-full border border-dashed border-[#00D6C3]/35 cosmic-orbit-1">
            <span class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#00D6C3] shadow-[0_0_12px_#00D6C3]"></span>
          </div>
          <!-- Средняя золотая орбита -->
          <div class="absolute inset-4 rounded-full border border-[#F2C65D]/30 cosmic-orbit-2">
            <span class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-[#F2C65D] shadow-[0_0_12px_#F2C65D]"></span>
          </div>
          <!-- Внутренний энергетический контур -->
          <div class="absolute inset-8 rounded-full border border-dotted border-white/20 cosmic-orbit-3"></div>
          <div class="absolute inset-9 rounded-full bg-[#00D6C3]/15 blur-xl"></div>

          <!-- Ядро FINTEX -->
          <div class="cosmic-core-box relative w-20 h-20 rounded-3xl bg-[#061614]/90 border border-[#00D6C3]/65 flex items-center justify-center backdrop-blur-md">
            <svg class="w-11 h-11" viewBox="0 0 40 40" fill="none">
              <path d="M12 10H29M12 10V30M12 20H24" stroke="#00D6C3" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" class="cosmic-logo-path" />
              <circle cx="29" cy="20" r="2.7" fill="#F2C65D" />
            </svg>
          </div>
        </div>

        <div class="text-2xl font-extrabold tracking-tight text-white cosmic-seq-2">
          ${userName}
        </div>
        <div class="text-xs font-medium text-brand tracking-[0.14em] uppercase mt-1.5 cosmic-seq-3">
          Орбита финансового контроля
        </div>

        <!-- Капсула доступного бюджета -->
        <div class="mt-6 px-5 py-2.5 rounded-2xl bg-white/[0.04] border border-[#00D6C3]/30 backdrop-blur-md flex items-center gap-2.5 cosmic-seq-4 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
          <span class="w-2 h-2 rounded-full bg-[#00D6C3] animate-ping"></span>
          <span class="text-[11px] text-sub">Доступно сегодня:</span>
          <span class="text-sm font-extrabold text-white tabular-nums">${dailyText}</span>
        </div>
      </div>

      <!-- Нижний индикатор синхронизации монтажа -->
      <div class="w-full max-w-[240px] space-y-2 relative z-10 cosmic-seq-4">
        <div id="cosmic-phase-label" class="text-[10px] font-medium text-brand/90 tracking-wider">
          Калибровка финансовых потоков...
        </div>
        <div class="w-full h-1 rounded-full bg-white/10 overflow-hidden">
          <div class="h-full rounded-full bg-gradient-to-r from-[#00D6C3] via-[#38BDF8] to-[#F2C65D] cosmic-progress-fill"></div>
        </div>
        <div class="text-[9px] text-sub/55 uppercase tracking-[0.2em] pt-0.5">
          Коснитесь экрана для входа
        </div>
      </div>
    `;
  }

  function launchCosmicEntrance(durationMs = 3500) {
    const splash = document.getElementById('returning-splash');
    if (!splash) return;

    clearTimeout(autoTimer);
    clearInterval(statusInterval);

    const s = window.state || {};
    const m = typeof calcMetrics === 'function' ? calcMetrics() : { dailyLeft: 0 };
    const greet = typeof greetingWord === 'function' ? greetingWord() : 'С возвращением';
    const userTitle = s.name ? `${greet}, ${s.name}!` : 'FINTEX';
    const bankName = s.bank || 'Т-Банк';
    const dailyText = typeof fmtR === 'function' ? fmtR(m.dailyLeft) : `${m.dailyLeft} ₽`;

    buildCosmicSplashDOM(splash, userTitle, bankName, dailyText);
    startStarfield(document.getElementById('cosmic-starfield-canvas'));

    const phases = [
      'Калибровка финансовых потоков...',
      'Синхронизация резервов и целей...',
      'Система готова к работе'
    ];
    let phaseIdx = 0;
    statusInterval = setInterval(() => {
      phaseIdx++;
      const lbl = document.getElementById('cosmic-phase-label');
      if (lbl && phases[phaseIdx]) lbl.textContent = phases[phaseIdx];
    }, Math.floor(durationMs / 3));

    autoTimer = setTimeout(() => {
      window.dismissReturningSplash();
    }, durationMs);
  }

  // Переопределяем стандартные функции входа на космический кинематографичный монтаж
  window.dismissReturningSplash = function () {
    const splash = document.getElementById('returning-splash');
    if (!splash || splash.classList.contains('hidden') || splash.classList.contains('cosmic-warp-exit')) return;

    clearTimeout(autoTimer);
    clearInterval(statusInterval);
    try { if (typeof vibro === 'function') vibro('light'); } catch (e) {}

    splash.classList.add('cosmic-warp-exit');
    try { if (typeof renderAll === 'function') renderAll(true); } catch (e) {}

    setTimeout(() => {
      stopStarfield();
      splash.classList.add('hidden');
      splash.classList.remove('cosmic-warp-exit');
    }, 760);
  };

  window.replayMotionSplash = function () {
    launchCosmicEntrance(3600);
  };

  // Если заставка уже открыта при старте (возвращающийся пользователь) — сразу запускаем космический монтаж
  const splashEl = document.getElementById('returning-splash');
  if (splashEl && !splashEl.classList.contains('hidden')) {
    launchCosmicEntrance(3500);
  }
})();
