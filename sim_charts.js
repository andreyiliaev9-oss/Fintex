/* ============================================================================
 * FINTEX Life Simulator — Шаг 3: Визуализация веток будущего (sim_charts.js)
 * Подключается автоматически через extensions.js поверх sim_engine.js и sim_ui.js.
 * ============================================================================ */

(function initFintexSimulatorCharts() {
  const SIM = window.FINTEX_SIM;
  if (!SIM) return;

  SIM.charts = {
    esc(str) {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    fmt(n, prefix = '') {
      if (typeof fmtR === 'function') return fmtR(n, prefix);
      return `${prefix}${Math.round(Number(n) || 0)} ₽`;
    },

    buildSvgPath(points, mapX, mapY) {
      if (!points || !points.length) return '';
      return points
        .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${mapX(p.day).toFixed(1)} ${mapY(p.cash).toFixed(1)}`)
        .join(' ');
    },

    renderVisualSlot(draft, allRes, activeMode) {
      const slot = document.getElementById('sim-visual-slot');
      if (!slot || !allRes || !allRes.base) return;

      const base = allRes.base;
      const opt = allRes.optimistic;
      const pess = allRes.pessimistic;
      const cur = allRes[activeMode] || base;
      const horizon = Math.max(7, Number(draft.horizonDays) || 90);

      // Собираем все точки по трём веткам для единого масштаба Y
      const allVals = [
        ...base.timeline.map(p => p.cash),
        ...opt.timeline.map(p => p.cash),
        ...pess.timeline.map(p => p.cash),
        0
      ];
      const rawMin = Math.min(...allVals);
      const rawMax = Math.max(...allVals);
      const pad = Math.max(1000, Math.round((rawMax - rawMin) * 0.14));
      const minY = rawMin - pad;
      const maxY = rawMax + pad;
      const spanY = Math.max(1, maxY - minY);

      const W = 320;
      const H = 128;
      const padX = 14;
      const padTop = 14;
      const padBot = 18;
      const plotW = W - padX * 2;
      const plotH = H - padTop - padBot;

      const mapX = (day) => padX + (Math.min(horizon, Math.max(0, day)) / horizon) * plotW;
      const mapY = (val) => padTop + (1 - (val - minY) / spanY) * plotH;

      const zeroY = mapY(0);
      const optPath = this.buildSvgPath(opt.timeline, mapX, mapY);
      const basePath = this.buildSvgPath(base.timeline, mapX, mapY);
      const pessPath = this.buildSvgPath(pess.timeline, mapX, mapY);

      const activeTimeline = cur.timeline || base.timeline;
      const activePath = this.buildSvgPath(activeTimeline, mapX, mapY);
      const lastPt = activeTimeline[activeTimeline.length - 1] || { day: horizon, cash: cur.endCash };
      const firstPt = activeTimeline[0] || { day: 0, cash: cur.snapshot.balance };
      const areaPath = activePath
        ? `${activePath} L ${mapX(lastPt.day).toFixed(1)} ${zeroY.toFixed(1)} L ${mapX(firstPt.day).toFixed(1)} ${zeroY.toFixed(1)} Z`
        : '';

      // Золотые маркеры событий на активной ветке
      const eventPins = (draft.events || [])
        .filter(ev => Number(ev.dayOffset) <= horizon)
        .map(ev => {
          const d = Math.max(0, Number(ev.dayOffset) || 0);
          // Ищем ближайшую точку по дню на активной кривой
          let nearest = activeTimeline[0];
          let bestDiff = Infinity;
          activeTimeline.forEach(pt => {
            const diff = Math.abs(pt.day - d);
            if (diff < bestDiff) { bestDiff = diff; nearest = pt; }
          });
          const cx = mapX(d).toFixed(1);
          const cy = nearest ? mapY(nearest.cash).toFixed(1) : zeroY.toFixed(1);
          return `
            <line x1="${cx}" y1="${padTop}" x2="${cx}" y2="${H - padBot}" stroke="rgba(242,198,93,0.28)" stroke-width="1" stroke-dasharray="2 2" />
            <circle cx="${cx}" cy="${cy}" r="4" fill="#F2C65D" stroke="#071916" stroke-width="1.5" />
          `;
        })
        .join('');

      // Красная зона кассового разрыва (ниже 0 ₽)
      const dangerZone = rawMin < 0
        ? `<rect x="${padX}" y="${zeroY.toFixed(1)}" width="${plotW}" height="${Math.max(0, (H - padBot) - zeroY).toFixed(1)}" fill="rgba(251,113,133,0.12)" />`
        : '';

      const modeMeta = {
        optimistic: { label: 'Оптимистичный (+8% доход, −8% расход)', color: '#20C997' },
        base:       { label: 'Базовый (по текущим данным FINTEX)',    color: '#00D6C3' },
        pessimistic:{ label: 'Негативный (−12% доход, +14% расход)',  color: '#FB7185' }
      };
      const curMeta = modeMeta[activeMode] || modeMeta.base;

      slot.innerHTML = `
        <div class="card-surface p-3 space-y-2.5 border border-[#00D6C3]/20">
          <div class="flex items-center justify-between gap-2">
            <div>
              <div class="text-[11px] font-bold text-main">Ветви будущего · Остаток денег</div>
              <div class="text-[10px]" style="color:${curMeta.color}">${curMeta.label}</div>
            </div>
            <div class="flex items-center gap-2 text-[9px] text-sub shrink-0">
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#20C997]"></span>Опт</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#00D6C3]"></span>База</span>
              <span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#FB7185]"></span>Риск</span>
            </div>
          </div>

          <div class="input-surface p-2 overflow-hidden">
            <svg viewBox="0 0 ${W} ${H}" class="w-full h-32 block overflow-visible">
              <defs>
                <linearGradient id="simBranchArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="${curMeta.color}" stop-opacity="0.28" />
                  <stop offset="100%" stop-color="${curMeta.color}" stop-opacity="0.0" />
                </linearGradient>
              </defs>
              ${dangerZone}
              <!-- Нулевая линия ликвидности -->
              <line x1="${padX}" y1="${zeroY.toFixed(1)}" x2="${W - padX}" y2="${zeroY.toFixed(1)}" stroke="rgba(255,255,255,0.16)" stroke-width="1" stroke-dasharray="3 3" />
              <text x="${padX}" y="${Math.max(10, zeroY - 3).toFixed(1)}" fill="rgba(139,156,151,0.75)" font-size="8">0 ₽</text>

              <!-- Все 3 ветки будущего -->
              <path d="${optPath}" fill="none" stroke="#20C997" stroke-width="${activeMode === 'optimistic' ? '2.6' : '1.2'}" stroke-opacity="${activeMode === 'optimistic' ? '1' : '0.42'}" stroke-dasharray="${activeMode === 'optimistic' ? 'none' : '3 2'}" />
              <path d="${pessPath}" fill="none" stroke="#FB7185" stroke-width="${activeMode === 'pessimistic' ? '2.6' : '1.2'}" stroke-opacity="${activeMode === 'pessimistic' ? '1' : '0.42'}" stroke-dasharray="${activeMode === 'pessimistic' ? 'none' : '3 2'}" />
              <path d="${basePath}" fill="none" stroke="#00D6C3" stroke-width="${activeMode === 'base' ? '2.6' : '1.3'}" stroke-opacity="${activeMode === 'base' ? '1' : '0.5'}" />

              <!-- Заливка активной ветки -->
              ${areaPath ? `<path d="${areaPath}" fill="url(#simBranchArea)" />` : ''}

              <!-- События на временной шкале -->
              ${eventPins}

              <!-- Подписи оси X -->
              <text x="${padX}" y="${H - 4}" fill="#8B9C97" font-size="8">Сегодня</text>
              <text x="${W / 2}" y="${H - 4}" text-anchor="middle" fill="#8B9C97" font-size="8">${Math.round(horizon / 2)} дн.</text>
              <text x="${W - padX}" y="${H - 4}" text-anchor="end" fill="#8B9C97" font-size="8">${horizon} дн.</text>
            </svg>
          </div>

          <!-- Сводка отличий между 3 вариантами будущего -->
          <div class="grid grid-cols-3 gap-1.5 text-[10px]">
            <div onclick="FINTEX_SIM.ui.setMode('optimistic')" class="input-surface p-2 cursor-pointer ${activeMode === 'optimistic' ? 'border border-[#20C997]/60' : ''}">
              <div class="text-sub">Оптимист.</div>
              <div class="font-bold text-mint tabular-nums truncate">${this.fmt(opt.endCash)}</div>
              <div class="text-[9px] text-dim">NW: ${this.fmt(opt.endNetWorth)}</div>
            </div>
            <div onclick="FINTEX_SIM.ui.setMode('base')" class="input-surface p-2 cursor-pointer ${activeMode === 'base' ? 'border border-[#00D6C3]/60' : ''}">
              <div class="text-sub">Базовый</div>
              <div class="font-bold text-brand tabular-nums truncate">${this.fmt(base.endCash)}</div>
              <div class="text-[9px] text-dim">NW: ${this.fmt(base.endNetWorth)}</div>
            </div>
            <div onclick="FINTEX_SIM.ui.setMode('pessimistic')" class="input-surface p-2 cursor-pointer ${activeMode === 'pessimistic' ? 'border border-[#FB7185]/60' : ''}">
              <div class="text-sub">Негативный</div>
              <div class="font-bold ${pess.endCash < 0 ? 'text-red-400' : 'text-gold'} tabular-nums truncate">${this.fmt(pess.endCash)}</div>
              <div class="text-[9px] text-dim">${pess.cashGapDay !== null ? `Разрыв: ${pess.cashGapDay} д.` : `NW: ${this.fmt(pess.endNetWorth)}`}</div>
            </div>
          </div>

          <!-- Слот для Шага 4 (сравнение сценариев и умные рекомендации) -->
          <div id="sim-pro-slot"></div>
        </div>
      `;

      try { SIM.pro?.renderProSlot?.(draft, allRes, activeMode); } catch (e) {}
    }
  };

  // Если окно симулятора уже открыто, сразу перерисуем его с графиком
  if (document.getElementById('modal-life-sim') && !document.getElementById('modal-life-sim').classList.contains('hidden')) {
    SIM.ui?.render?.();
  }
})();
