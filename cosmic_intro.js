/* ============================================================================
 * FINTEX Flagship Motion Entrance (cosmic_intro.js)
 * Кинематографическая заставка мирового уровня:
 * - 60/120fps Volumetric Aurora & 3D Depth Warp Canvas с параллаксом касания
 * - Сапфирово-титановый squircle-монолит с бегущим плазменным лучом и импульсом
 * - Пружинный одометр доступного дневного бюджета (0 ₽ -> dailyLeft)
 * - Оптическая маска типографики + гиперпространственный переход в дашборд
 * ============================================================================ */

(function initFintexWorldClassIntro() {
  const CSS_ID = 'fintex-worldclass-intro-styles';
  if (!document.getElementById(CSS_ID)) {
    const style = document.createElement('style');
    style.id = CSS_ID;
    style.textContent = `
      @property --fintex-rim-angle {
        syntax: '<angle>';
        initial-value: 0deg;
        inherits: false;
      }

      @keyframes fintexRimSpin {
        0%   { --fintex-rim-angle: 0deg; }
        100% { --fintex-rim-angle: 360deg; }
      }

      @keyframes fintexSquircleBreath {
        0%, 100% {
          transform: translate3d(0, 0, 0) scale(1);
          box-shadow:
            0 24px 60px -12px rgba(0, 0, 0, 0.85),
            0 0 38px rgba(0, 214, 195, 0.28),
            inset 0 1px 1px rgba(255, 255, 255, 0.22);
        }
        50% {
          transform: translate3d(0, -2px, 0) scale(1.025);
          box-shadow:
            0 28px 68px -12px rgba(0, 0, 0, 0.9),
            0 0 58px rgba(0, 214, 195, 0.48),
            0 0 90px rgba(242, 198, 93, 0.16),
            inset 0 1px 1px rgba(255, 255, 255, 0.32);
        }
      }

      @keyframes fintexShockwave {
        0%   { transform: scale(0.82); opacity: 0.85; border-width: 2px; }
        100% { transform: scale(1.85); opacity: 0; border-width: 0.5px; }
      }

      @keyframes fintexMonogramDraw {
        0%   { stroke-dashoffset: 100; opacity: 0.15; }
        20%  { opacity: 1; }
        100% { stroke-dashoffset: 0; opacity: 1; }
      }

      @keyframes fintexGoldDotPop {
        0%   { transform: scale(0); opacity: 0; }
        65%  { transform: scale(1.38); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }

      @keyframes fintexMaskReveal {
        0%   { opacity: 0; transform: translate3d(0, 105%, 0); }
        100% { opacity: 1; transform: translate3d(0, 0%, 0); }
      }

      @keyframes fintexCapsuleRise {
        0%   { opacity: 0; transform: translate3d(0, 18px, 0) scale(0.95); }
        100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
      }

      @keyframes fintexWarpThroughExit {
        0%   { opacity: 1; transform: scale(1); }
        38%  { opacity: 0.96; transform: scale(1.025); }
        100% { opacity: 0; transform: scale(1.09); }
      }

      @keyframes dashCascadeIn {
        0%   { opacity: 0; transform: translate3d(0, 16px, 0) scale(0.985); }
        100% { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
      }

      #returning-splash.fintex-luxury-stage {
        background: radial-gradient(ellipse at 50% 34%, #081D1A 0%, #040B0A 54%, #020505 100%) !important;
        touch-action: pan-up;
        user-select: none;
        -webkit-user-select: none;
      }

      .fintex-squircle-shell {
        position: relative;
        width: 96px;
        height: 96px;
        border-radius: 28px;
        padding: 1.5px;
        background: conic-gradient(
          from var(--fintex-rim-angle, 35deg),
          rgba(0, 214, 195, 0.95) 0deg,
          rgba(255, 255, 255, 0.55) 48deg,
          rgba(242, 198, 93, 0.85) 115deg,
          rgba(0, 214, 195, 0.14) 210deg,
          rgba(56, 189, 248, 0.55) 300deg,
          rgba(0, 214, 195, 0.95) 360deg
        );
        animation: fintexRimSpin 5.5s linear infinite, fintexSquircleBreath 3.8s ease-in-out infinite;
        transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1);
        will-change: transform;
      }

      .fintex-squircle-core {
        width: 100%;
        height: 100%;
        border-radius: 26.5px;
        background:
          radial-gradient(circle at 28% 22%, rgba(0, 214, 195, 0.22) 0%, transparent 56%),
          radial-gradient(circle at 80% 85%, rgba(242, 198, 93, 0.14) 0%, transparent 52%),
          linear-gradient(155deg, rgba(10, 29, 26, 0.96) 0%, rgba(4, 13, 12, 0.99) 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
        overflow: hidden;
      }

      .fintex-squircle-core::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.18) 0%, rgba(255, 255, 255, 0.02) 38%, transparent 62%);
        pointer-events: none;
      }

      .fintex-shockwave-ring {
        position: absolute;
        inset: -6px;
        border-radius: 32px;
        border: 1.5px solid rgba(0, 214, 195, 0.75);
        opacity: 0;
        pointer-events: none;
        animation: fintexShockwave 1.35s cubic-bezier(0.16, 1, 0.3, 1) 0.58s forwards;
      }

      .fintex-shockwave-ring-2 {
        position: absolute;
        inset: -6px;
        border-radius: 32px;
        border: 1px solid rgba(242, 198, 93, 0.55);
        opacity: 0;
        pointer-events: none;
        animation: fintexShockwave 1.55s cubic-bezier(0.16, 1, 0.3, 1) 0.74s forwards;
      }

      .fintex-f-stroke {
        stroke-dasharray: 100;
        stroke-dashoffset: 100;
        animation: fintexMonogramDraw 0.78s cubic-bezier(0.22, 1, 0.36, 1) 0.12s forwards;
      }

      .fintex-gold-node {
        transform-origin: 29px 20px;
        opacity: 0;
        animation: fintexGoldDotPop 0.52s cubic-bezier(0.34, 1.56, 0.64, 1) 0.64s forwards;
      }

      .fintex-mask-box {
        overflow: hidden;
        padding-bottom: 2px;
      }

      .fintex-reveal-1 {
        opacity: 0;
        animation: fintexMaskReveal 0.72s cubic-bezier(0.16, 1, 0.3, 1) 0.22s forwards;
      }
      .fintex-reveal-2 {
        opacity: 0;
        animation: fintexMaskReveal 0.72s cubic-bezier(0.16, 1, 0.3, 1) 0.34s forwards;
      }
      .fintex-capsule-in {
        opacity: 0;
        animation: fintexCapsuleRise 0.76s cubic-bezier(0.16, 1, 0.3, 1) 0.46s forwards;
      }
      .fintex-footer-in {
        opacity: 0;
        animation: fintexCapsuleRise 0.76s cubic-bezier(0.16, 1, 0.3, 1) 0.58s forwards;
      }

      #returning-splash.fintex-warp-exit {
        animation: fintexWarpThroughExit 0.56s cubic-bezier(0.16, 1, 0.3, 1) forwards !important;
        pointer-events: none;
      }

      .dash-cascade-in {
        animation: dashCascadeIn 0.48s cubic-bezier(0.16, 1, 0.3, 1) both;
      }
    `;
    document.head.appendChild(style);
  }

  let autoTimer = null;
  let stepInterval = null;
  let counterRafId = null;
  let canvasRafId = null;
  let warpActive = false;
  let pointerNorm = { x: 0, y: 0, targetX: 0, targetY: 0 };

  function stopAnimations() {
    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (stepInterval) { clearInterval(stepInterval); stepInterval = null; }
    if (counterRafId) { cancelAnimationFrame(counterRafId); counterRafId = null; }
    if (canvasRafId) { cancelAnimationFrame(canvasRafId); canvasRafId = null; }
  }

  function startAuroraWarpCanvas(canvas) {
    if (!canvas) return;
    if (canvasRafId) cancelAnimationFrame(canvasRafId);

    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = (canvas.width = window.innerWidth * dpr);
    let h = (canvas.height = window.innerHeight * dpr);
    let cx = w * 0.5;
    let cy = h * 0.38;

    const particles = Array.from({ length: 84 }, () => ({
      x: (Math.random() - 0.5) * 2.2,
      y: (Math.random() - 0.5) * 2.2,
      z: 0.08 + Math.random() * 0.92,
      pz: 0,
      size: (0.8 + Math.random() * 1.5) * dpr,
      hue: Math.random() > 0.76 ? 'gold' : (Math.random() > 0.45 ? 'teal' : 'cyan'),
      alpha: 0.25 + Math.random() * 0.65
    }));
    particles.forEach(p => { p.pz = p.z; });

    let t = 0;
    function frame() {
      t += 0.014;
      pointerNorm.x += (pointerNorm.targetX - pointerNorm.x) * 0.08;
      pointerNorm.y += (pointerNorm.targetY - pointerNorm.y) * 0.08;

      ctx.clearRect(0, 0, w, h);

      // 1. Volumetric Silk Aurora Ribbons
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const focalX = cx + pointerNorm.x * 26 * dpr;
      const focalY = cy + pointerNorm.y * 22 * dpr;

      const ribbons = [
        { r: 170 * dpr, amp: 24 * dpr, freq: 2.2, phase: t * 0.9, color: 'rgba(0, 214, 195, 0.13)' },
        { r: 225 * dpr, amp: 32 * dpr, freq: 1.7, phase: -t * 0.7 + 1.4, color: 'rgba(56, 189, 248, 0.08)' },
        { r: 135 * dpr, amp: 18 * dpr, freq: 3.0, phase: t * 1.15 + 2.6, color: 'rgba(242, 198, 93, 0.09)' }
      ];

      for (let i = 0; i < ribbons.length; i++) {
        const rb = ribbons[i];
        const gx = focalX + Math.cos(rb.phase) * rb.amp;
        const gy = focalY + Math.sin(rb.phase * 0.85) * rb.amp;
        const grad = ctx.createRadialGradient(gx, gy, rb.r * 0.08, gx, gy, rb.r * 1.35);
        grad.addColorStop(0, rb.color);
        grad.addColorStop(0.55, rb.color.replace(/0\.\d+\)/, '0.03)'));
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(gx, gy, rb.r * 1.35, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 2. 3D Perspective Depth Field (accelerates into warp streaks on exit)
      const speed = warpActive ? 0.052 : 0.0022;
      const spread = Math.min(w, h) * 0.56;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.pz = p.z;
        p.z -= speed;
        if (p.z <= 0.03) {
          p.x = (Math.random() - 0.5) * 2.2;
          p.y = (Math.random() - 0.5) * 2.2;
          p.z = 1.0;
          p.pz = 1.0;
        }

        const sx = focalX + (p.x / p.z) * spread;
        const sy = focalY + (p.y / p.z) * spread;
        const depthAlpha = Math.min(1, (1 - p.z) * 1.35) * p.alpha;

        if (warpActive) {
          const psx = focalX + (p.x / p.pz) * spread;
          const psy = focalY + (p.y / p.pz) * spread;
          ctx.beginPath();
          ctx.moveTo(psx, psy);
          ctx.lineTo(sx, sy);
          ctx.lineWidth = Math.max(1, (1 - p.z) * 2.6 * dpr);
          ctx.strokeStyle = p.hue === 'gold'
            ? `rgba(242, 198, 93, ${depthAlpha})`
            : `rgba(0, 214, 195, ${depthAlpha})`;
          ctx.stroke();
        } else {
          const radius = Math.max(0.6, (1 - p.z * 0.72) * p.size);
          ctx.beginPath();
          ctx.arc(sx, sy, radius, 0, Math.PI * 2);
          if (p.hue === 'gold') ctx.fillStyle = `rgba(242, 198, 93, ${depthAlpha})`;
          else if (p.hue === 'cyan') ctx.fillStyle = `rgba(125, 211, 252, ${depthAlpha * 0.85})`;
          else ctx.fillStyle = `rgba(0, 214, 195, ${depthAlpha})`;
          ctx.fill();
        }
      }

      canvasRafId = requestAnimationFrame(frame);
    }

    frame();
  }

  function animateDailyOdometer(el, targetAmount, durationMs = 1050) {
    if (!el) return;
    if (counterRafId) cancelAnimationFrame(counterRafId);

    const isNeg = targetAmount < 0;
    const absTarget = Math.abs(Math.round(Number(targetAmount) || 0));
    const startTime = performance.now();

    function formatRub(val) {
      const s = Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      return `${isNeg && val > 0 ? '−' : ''}${s} ₽`;
    }

    function tick(now) {
      const elapsed = now - startTime;
      const p = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - p, 4);
      const cur = absTarget * eased;
      el.textContent = formatRub(cur);
      if (p < 1) {
        counterRafId = requestAnimationFrame(tick);
      } else {
        el.textContent = typeof fmtR === 'function' ? fmtR(targetAmount) : formatRub(absTarget);
      }
    }

    counterRafId = requestAnimationFrame(tick);
  }

  function bindInteractiveParallax(splash) {
    if (!splash || splash.dataset.parallaxBound === '1') return;
    splash.dataset.parallaxBound = '1';

    let touchStartY = 0;

    const updateTilt = (clientX, clientY) => {
      const nx = (clientX / window.innerWidth - 0.5) * 2;
      const ny = (clientY / window.innerHeight - 0.5) * 2;
      pointerNorm.targetX = nx;
      pointerNorm.targetY = ny;
      const shell = splash.querySelector('.fintex-squircle-shell');
      if (shell) {
        shell.style.transform = `perspective(600px) rotateY(${(nx * 9).toFixed(2)}deg) rotateX(${(-ny * 9).toFixed(2)}deg)`;
      }
    };

    splash.addEventListener('pointermove', e => updateTilt(e.clientX, e.clientY), { passive: true });
    splash.addEventListener('touchstart', e => {
      if (e.touches?.[0]) {
        touchStartY = e.touches[0].clientY;
        updateTilt(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });

    splash.addEventListener('touchend', e => {
      const endY = e.changedTouches?.[0]?.clientY ?? touchStartY;
      if (touchStartY - endY > 28) {
        window.dismissReturningSplash();
      }
    }, { passive: true });
  }

  function buildLuxurySplashDOM(splash, userTitle, bankName) {
    splash.className = 'fixed inset-0 z-50 fintex-luxury-stage flex flex-col items-center justify-between px-6 py-9 text-center text-white cursor-pointer overflow-hidden';
    splash.innerHTML = `
      <canvas id="fintex-intro-canvas" class="absolute inset-0 w-full h-full pointer-events-none"></canvas>

      <!-- Верхняя статусная строка -->
      <div class="w-full flex items-center justify-between relative z-10 fintex-reveal-1">
        <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md">
          <span class="w-1.5 h-1.5 rounded-full bg-[#00D6C3] shadow-[0_0_8px_#00D6C3]"></span>
          <span class="text-[10px] font-extrabold tracking-[0.26em] text-brand">FINTEX</span>
        </div>
        <span class="text-[10px] font-semibold px-3 py-1 rounded-full bg-white/[0.04] border border-[#00D6C3]/25 text-sub backdrop-blur-md">
          ${bankName}
        </span>
      </div>

      <!-- Центральный сапфировый монолит и типографика -->
      <div class="my-auto flex flex-col items-center relative z-10 w-full max-w-xs">
        <div class="relative mb-7 flex items-center justify-center">
          <div class="fintex-shockwave-ring"></div>
          <div class="fintex-shockwave-ring-2"></div>
          <div class="fintex-squircle-shell">
            <div class="fintex-squircle-core">
              <svg class="w-12 h-12" viewBox="0 0 40 40" fill="none">
                <defs>
                  <linearGradient id="fintexMonogramGrad" x1="10" y1="8" x2="31" y2="32" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#A7FFF6" />
                    <stop offset="50%" stop-color="#00D6C3" />
                    <stop offset="100%" stop-color="#20C997" />
                  </linearGradient>
                </defs>
                <path
                  pathLength="100"
                  d="M12 10H29M12 10V30M12 20H23.5"
                  stroke="url(#fintexMonogramGrad)"
                  stroke-width="3.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="fintex-f-stroke"
                />
                <circle cx="29" cy="20" r="2.8" fill="#F2C65D" class="fintex-gold-node" />
              </svg>
            </div>
          </div>
        </div>

        <div class="fintex-mask-box">
          <h1 class="text-[26px] leading-tight font-extrabold tracking-tight text-white fintex-reveal-1">
            ${userTitle}
          </h1>
        </div>

        <div class="fintex-mask-box mt-1.5">
          <p class="text-xs font-medium text-brand/90 tracking-[0.06em] fintex-reveal-2">
            Персональный финансовый автопилот
          </p>
        </div>

        <!-- Живая стеклянная капсула бюджета -->
        <div class="mt-7 w-full px-5 py-3.5 rounded-2xl bg-white/[0.045] border border-[#00D6C3]/30 backdrop-blur-xl fintex-capsule-in shadow-[0_18px_40px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.12)]">
          <div class="flex items-center justify-between text-[10px] uppercase tracking-[0.16em] text-sub mb-1">
            <span class="inline-flex items-center gap-1.5">
              <span class="w-1.5 h-1.5 rounded-full bg-[#00D6C3] animate-ping"></span>
              <span>Безопасно сегодня</span>
            </span>
            <span class="text-gold font-bold">LIVE</span>
          </div>
          <div id="fintex-intro-odometer" class="text-2xl font-extrabold text-white tabular-nums tracking-tight hero-amount-glow">
            0 ₽
          </div>
        </div>
      </div>

      <!-- Нижняя телеметрия автопилота -->
      <div class="w-full max-w-[260px] space-y-2.5 relative z-10 fintex-footer-in">
        <div class="grid grid-cols-3 gap-1.5">
          <div class="h-1 rounded-full bg-white/10 overflow-hidden">
            <div id="fintex-seg-0" class="h-full bg-[#00D6C3] rounded-full transition-all duration-500" style="width: 0%;"></div>
          </div>
          <div class="h-1 rounded-full bg-white/10 overflow-hidden">
            <div id="fintex-seg-1" class="h-full bg-[#38BDF8] rounded-full transition-all duration-500" style="width: 0%;"></div>
          </div>
          <div class="h-1 rounded-full bg-white/10 overflow-hidden">
            <div id="fintex-seg-2" class="h-full bg-[#F2C65D] rounded-full transition-all duration-500" style="width: 0%;"></div>
          </div>
        </div>
        <div id="fintex-intro-status" class="text-[11px] font-medium text-sub tracking-wide">
          Проверка обязательных резервов...
        </div>
        <div class="text-[9px] text-sub/45 uppercase tracking-[0.22em]">
          Коснитесь или смахните вверх
        </div>
      </div>
    `;
  }

  function triggerHomeCascade() {
    const home = document.getElementById('view-home');
    if (!home || home.classList.contains('hidden')) return;
    const blocks = home.querySelectorAll(':scope > div');
    blocks.forEach((el, idx) => {
      el.classList.remove('dash-cascade-in');
      void el.offsetWidth;
      el.style.animationDelay = `${Math.min(idx * 55, 280)}ms`;
      el.classList.add('dash-cascade-in');
    });
  }

  window.launchLuxuryEntrance = function (durationMs = 2750) {
    const splash = document.getElementById('returning-splash');
    if (!splash) return;

    stopAnimations();
    warpActive = false;
    pointerNorm = { x: 0, y: 0, targetX: 0, targetY: 0 };

    const s = window.state || {};
    const m = typeof calcMetrics === 'function' ? calcMetrics() : { dailyLeft: 0 };
    const greet = typeof greetingWord === 'function' ? greetingWord() : 'С возвращением';
    const userTitle = s.name ? `${greet}, ${s.name}!` : 'Добро пожаловать!';
    const bankName = s.bank || 'Т-Банк';

    buildLuxurySplashDOM(splash, userTitle, bankName);
    bindInteractiveParallax(splash);
    startAuroraWarpCanvas(document.getElementById('fintex-intro-canvas'));

    requestAnimationFrame(() => {
      const seg0 = document.getElementById('fintex-seg-0');
      if (seg0) seg0.style.width = '100%';
      animateDailyOdometer(document.getElementById('fintex-intro-odometer'), m.dailyLeft, 1080);
    });

    const stages = [
      { seg: 'fintex-seg-0', text: 'Резервы и подписки защищены' },
      { seg: 'fintex-seg-1', text: 'Дневной лимит рассчитан' },
      { seg: 'fintex-seg-2', text: 'Финансовый автопилот готов' }
    ];
    let step = 0;
    stepInterval = setInterval(() => {
      step++;
      if (step < stages.length) {
        const segEl = document.getElementById(stages[step].seg);
        const lblEl = document.getElementById('fintex-intro-status');
        if (segEl) segEl.style.width = '100%';
        if (lblEl) lblEl.textContent = stages[step].text;
      }
    }, Math.floor(durationMs / 3.1));

    autoTimer = setTimeout(() => {
      window.dismissReturningSplash();
    }, durationMs);
  };

  window.dismissReturningSplash = function () {
    const splash = document.getElementById('returning-splash');
    if (!splash || splash.classList.contains('hidden') || splash.classList.contains('fintex-warp-exit')) return;

    if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; }
    if (stepInterval) { clearInterval(stepInterval); stepInterval = null; }
    if (counterRafId) { cancelAnimationFrame(counterRafId); counterRafId = null; }

    warpActive = true;
    try { if (typeof vibro === 'function') vibro('light'); } catch (e) {}

    splash.classList.add('fintex-warp-exit');
    try { if (typeof renderAll === 'function') renderAll(true); } catch (e) {}
    triggerHomeCascade();

    setTimeout(() => {
      stopAnimations();
      warpActive = false;
      splash.classList.add('hidden');
      splash.classList.remove('fintex-warp-exit');
    }, 540);
  };

  window.replayMotionSplash = function () {
    window.launchLuxuryEntrance(2850);
  };

  // Если экран входа уже открыт при загрузке — сразу запускаем флагманский монтаж
  const splashEl = document.getElementById('returning-splash');
  if (splashEl && !splashEl.classList.contains('hidden')) {
    window.launchLuxuryEntrance(2750);
  }
})();
