/* ============================================================================
 * FINTEX Life Simulator — Дерево будущего (sim_charts.js)
 * Визуализация в виде живого светящегося дерева:
 * Корень (Сегодня) -> Ствол до события -> 3 ветки будущего (Лучший / Базовый / Риск)
 * ============================================================================ */

(function initFintexDecisionTree() {
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

    fmtShort(n) {
      const val = Math.round(Number(n) || 0);
      const abs = Math.abs(val);
      const sign = val < 0 ? '−' : '';
      if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1).replace('.0', '')}M ₽`;
      if (abs >= 10000) return `${sign}${Math.round(abs / 1000)}к ₽`;
      return `${sign}${abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} ₽`;
    },

    fmtFull(n) {
      if (typeof fmtR === 'function') return fmtR(n);
      return `${Math.round(Number(n) || 0)} ₽`;
    },

    buildVerdictBanner(cur, activeMode) {
      const modeName = activeMode === 'optimistic'
        ? 'При благоприятном раскладе'
        : activeMode === 'pessimistic'
          ? 'Если появятся лишние траты'
          : 'По базовому прогнозу';

      if (cur.cashGapDay !== null) {
        return {
          tone: 'danger',
          badge: 'Нужна корректировка',
          title: `${modeName} денег не хватит на ${cur.cashGapDay}-й день`,
          subtitle: `Просадка до ${this.fmtFull(cur.minCash)}. Попробуйте уменьшить сумму или оформить рассрочку/кредит.`
        };
      }
      if (cur.cushionMonths < 1.5) {
        return {
          tone: 'warn',
          badge: 'На грани резерва',
          title: `${modeName} покупка реальна, но подушка станет тонкой`,
          subtitle: `Останется ${this.fmtFull(cur.endCash)}, а резерва хватит на ${cur.cushionMonths} мес. без дохода.`
        };
      }
      return {
        tone: 'safe',
        badge: 'Безопасное решение',
        title: `${modeName} сценарий проходит спокойно`,
        subtitle: `Через ${cur.horizonDays} дн. на руках останется ${this.fmtFull(cur.endCash)}, подушка — ${cur.cushionMonths} мес.`
      };
    },

    renderVisualSlot(draft, allRes, activeMode) {
      const slot = document.getElementById('sim-visual-slot');
      if (!slot || !allRes || !allRes.base) return;

      const base = allRes.base;
      const opt = allRes.optimistic;
      const pess = allRes.pessimistic;
      const cur = allRes[activeMode] || base;
      const snap = base.snapshot;
      const events = Array.isArray(draft.events) ? draft.events : [];
      const firstEv = events[0];

      // Вычисляем толщину веток (2.2px — 5.5px) пропорционально итоговому объёму капитала
      const refCap = Math.max(20000, snap.balance + snap.cushionSaved, Math.abs(opt.endNetWorth));
      const strokeFor = (resObj, isSelected) => {
        const ratio = Math.max(0.15, Math.min(1, Math.max(0, resObj.endCash + snap.cushionSaved) / refCap));
        const baseW = 2.0 + ratio * 3.2;
        return (isSelected ? baseW + 1.4 : baseW * 0.78).toFixed(1);
      };

      // Координаты узлов дерева в viewBox 340 x 216
      const rootX = 34, rootY = 114;
      const forkX = 132, forkY = 114;
      const leafX = 258;
      const optY = 38;
      const baseY = 114;
      const pessY = 186;

      // Метка центрального узла события
      const nodeTitle = firstEv
        ? (firstEv.title.length > 16 ? firstEv.title.slice(0, 15) + '…' : firstEv.title)
        : 'Без событий';
      const nodeSub = events.length > 1
        ? `${events.length} событ. · день ${firstEv.dayOffset}`
        : firstEv
          ? (firstEv.dayOffset === 0 ? 'Сегодня' : `Через ${firstEv.dayOffset} дн.`)
          : 'Текущий курс';

      const verdict = this.buildVerdictBanner(cur, activeMode);
      const bannerStyle = verdict.tone === 'danger'
        ? 'bg-red-500/12 border-red-400/35 text-red-200'
        : verdict.tone === 'warn'
          ? 'bg-[#F2C65D]/12 border-[#F2C65D]/35 text-gold'
          : 'bg-[#00D6C3]/12 border-[#00D6C3]/35 text-brand';

      const pessHasGap = pess.cashGapDay !== null;

      slot.innerHTML = `
        <div class="card-surface p-3.5 space-y-3 border border-[#00D6C3]/25">
          <!-- Понятный человеческий вердикт сверху -->
          <div class="p-3 rounded-2xl border ${bannerStyle} space-y-1">
            <div class="flex items-center justify-between gap-2">
              <span class="text-[10px] font-extrabold uppercase tracking-wider">${verdict.badge}</span>
              <span class="text-[10px] opacity-80">Нажмите на ветку дерева</span>
            </div>
            <div class="text-xs font-bold text-main leading-snug">${this.esc(verdict.title)}</div>
            <div class="text-[11px] text-sub leading-snug">${this.esc(verdict.subtitle)}</div>
          </div>

          <!-- Интерактивное Дерево будущего (SVG) -->
          <div class="rounded-2xl bg-[#06110F] border border-white/10 p-2 relative overflow-hidden">
            <svg viewBox="0 0 340 216" class="w-full h-52 block select-none">
              <defs>
                <filter id="treeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#00D6C3" />
                  <stop offset="100%" stop-color="#F2C65D" />
                </linearGradient>
                <linearGradient id="optGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#F2C65D" />
                  <stop offset="100%" stop-color="#20C997" />
                </linearGradient>
                <linearGradient id="baseGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#F2C65D" />
                  <stop offset="100%" stop-color="#00D6C3" />
                </linearGradient>
                <linearGradient id="pessGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#F2C65D" />
                  <stop offset="100%" stop-color="#FB7185" />
                </linearGradient>
              </defs>

              <!-- Фоновые направляющие орбиты -->
              <circle cx="${forkX}" cy="${forkY}" r="54" fill="none" stroke="rgba(0,214,195,0.07)" stroke-dasharray="3 3" />
              <circle cx="${forkX}" cy="${forkY}" r="96" fill="none" stroke="rgba(242,198,93,0.05)" stroke-dasharray="2 4" />

              <!-- 1. СТВОЛ: Реальное состояние (Сегодня -> Узел решения) -->
              <path d="M ${rootX} ${rootY} C ${rootX + 42} ${rootY}, ${forkX - 42} ${forkY}, ${forkX} ${forkY}"
                    fill="none" stroke="url(#trunkGrad)" stroke-width="5" stroke-linecap="round" filter="url(#treeGlow)" />

              <!-- 2. ВЕТКА 1: Оптимистичный сценарий (верхняя) -->
              <g onclick="FINTEX_SIM.ui.setMode('optimistic')" class="cursor-pointer">
                <path d="M ${forkX} ${forkY} C ${forkX + 48} ${forkY}, ${leafX - 54} ${optY}, ${leafX} ${optY}"
                      fill="none" stroke="url(#optGrad)"
                      stroke-width="${strokeFor(opt, activeMode === 'optimistic')}"
                      stroke-opacity="${activeMode === 'optimistic' ? '1' : '0.45'}"
                      stroke-linecap="round"
                      ${activeMode === 'optimistic' ? 'filter="url(#treeGlow)"' : ''} />
                <circle cx="${leafX}" cy="${optY}" r="${activeMode === 'optimistic' ? '8' : '5.5'}"
                        fill="#20C997" stroke="#06110F" stroke-width="2" />
                <text x="${leafX + 12}" y="${optY - 4}" fill="#20C997" font-size="9.5" font-weight="700">Лучший</text>
                <text x="${leafX + 12}" y="${optY + 8}" fill="#F5F7F6" font-size="10.5" font-weight="800">${this.fmtShort(opt.endCash)}</text>
              </g>

              <!-- 3. ВЕТКА 2: Базовый сценарий (центральная) -->
              <g onclick="FINTEX_SIM.ui.setMode('base')" class="cursor-pointer">
                <path d="M ${forkX} ${forkY} C ${forkX + 45} ${forkY}, ${leafX - 45} ${baseY}, ${leafX} ${baseY}"
                      fill="none" stroke="url(#baseGrad)"
                      stroke-width="${strokeFor(base, activeMode === 'base')}"
                      stroke-opacity="${activeMode === 'base' ? '1' : '0.48'}"
                      stroke-linecap="round"
                      ${activeMode === 'base' ? 'filter="url(#treeGlow)"' : ''} />
                <circle cx="${leafX}" cy="${baseY}" r="${activeMode === 'base' ? '8.5' : '6'}"
                        fill="#00D6C3" stroke="#06110F" stroke-width="2" />
                <text x="${leafX + 12}" y="${baseY - 4}" fill="#00D6C3" font-size="9.5" font-weight="700">Базовый</text>
                <text x="${leafX + 12}" y="${baseY + 8}" fill="#F5F7F6" font-size="10.5" font-weight="800">${this.fmtShort(base.endCash)}</text>
              </g>

              <!-- 4. ВЕТКА 3: Негативный / Риск-сценарий (нижняя) -->
              <g onclick="FINTEX_SIM.ui.setMode('pessimistic')" class="cursor-pointer">
                <path d="M ${forkX} ${forkY} C ${forkX + 48} ${forkY}, ${leafX - 54} ${pessY}, ${leafX} ${pessY}"
                      fill="none" stroke="url(#pessGrad)"
                      stroke-width="${strokeFor(pess, activeMode === 'pessimistic')}"
                      stroke-opacity="${activeMode === 'pessimistic' ? '1' : '0.45'}"
                      stroke-dasharray="${pessHasGap ? '5 3' : 'none'}"
                      stroke-linecap="round"
                      ${activeMode === 'pessimistic' ? 'filter="url(#treeGlow)"' : ''} />
                <circle cx="${leafX}" cy="${pessY}" r="${activeMode === 'pessimistic' ? '8' : '5.5'}"
                        fill="#FB7185" stroke="#06110F" stroke-width="2" />
                <text x="${leafX + 12}" y="${pessY - 4}" fill="#FB7185" font-size="9.5" font-weight="700">${pessHasGap ? 'Риск разрыва' : 'Сложный'}</text>
                <text x="${leafX + 12}" y="${pessY + 8}" fill="#F5F7F6" font-size="10.5" font-weight="800">${this.fmtShort(pess.endCash)}</text>
              </g>

              <!-- КОРЕНЬ: Точка «Сегодня» -->
              <circle cx="${rootX}" cy="${rootY}" r="9" fill="#00D6C3" fill-opacity="0.22" />
              <circle cx="${rootX}" cy="${rootY}" r="5.5" fill="#00D6C3" stroke="#06110F" stroke-width="1.5" />
              <text x="${rootX}" y="${rootY - 15}" text-anchor="middle" fill="#8B9C97" font-size="9" font-weight="600">Сегодня</text>
              <text x="${rootX}" y="${rootY + 21}" text-anchor="middle" fill="#F5F7F6" font-size="10" font-weight="800">${this.fmtShort(snap.balance)}</text>

              <!-- УЗЕЛ ВЫБОРА: Точка жизненного события -->
              <circle cx="${forkX}" cy="${forkY}" r="13" fill="#F2C65D" fill-opacity="0.20" />
              <circle cx="${forkX}" cy="${forkY}" r="7.5" fill="#F2C65D" stroke="#06110F" stroke-width="2" filter="url(#treeGlow)" />
              <text x="${forkX}" y="${forkY - 19}" text-anchor="middle" fill="#F2C65D" font-size="9.5" font-weight="800">${this.esc(nodeTitle)}</text>
              <text x="${forkX}" y="${forkY + 24}" text-anchor="middle" fill="#8B9C97" font-size="8.5">${this.esc(nodeSub)}</text>
            </svg>
          </div>

          <!-- Слот для сравнения вариантов и умных советов -->
          <div id="sim-pro-slot"></div>
        </div>
      `;

      try { SIM.pro?.renderProSlot?.(draft, allRes, activeMode); } catch (e) {}
    }
  };

  if (document.getElementById('modal-life-sim') && !document.getElementById('modal-life-sim').classList.contains('hidden')) {
    SIM.ui?.render?.();
  }
})();
