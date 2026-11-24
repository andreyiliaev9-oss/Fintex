const { test, expect } = require('@playwright/test');

async function localOnly(page) {
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
  });
}
async function openApp(page, seeded = false) {
  await localOnly(page);
  await page.addInitScript(seeded => {
    localStorage.setItem('fp_onboarded', '1');
    localStorage.setItem('fp_name', 'Андрей');
    localStorage.setItem('fp_motion', '0');
    if (seeded) {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      localStorage.setItem('fp_local_tx', JSON.stringify([
        { id: 'test-expense', merchant: 'Кофейня', amount: 350, category: 'cafe', type: 'expense', source: 'Вручную', date, items: [] },
        { id: 'test-income', merchant: 'Зарплата', amount: 60000, category: 'other', type: 'income', source: 'Вручную', date, items: [] },
      ]));
    }
  }, seeded);
  await page.goto('/');
  await page.waitForFunction(() => !!window.FintexAnalyticsPro && !!window.FINTEX_SIM?.ui);
  await page.evaluate(() => dismissReturningSplash());
  await expect(page.locator('#returning-splash')).toBeHidden();
}

test('all tabs fit 320, 390 and 448px in both themes, including late-loaded modules', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openApp(page, true);
  for (const width of [320, 390, 448]) {
    await page.setViewportSize({ width, height: 844 });
    for (const theme of ['dark', 'light']) {
      await page.evaluate(theme => setTheme(theme), theme);
      for (const tab of ['home', 'calendar', 'analytics', 'settings']) {
        await page.locator(`[data-nav="${tab}"]`).click();
        await expect(page.locator(`#view-${tab}`)).toBeVisible();
        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
        expect(dimensions.content, `${tab}/${theme}/${width}`).toBeLessThanOrEqual(dimensions.viewport);
      }
      const colours = await page.evaluate(() => {
        const bg = selector => getComputedStyle(document.querySelector(selector)).backgroundColor;
        return [bg('#hero-balance-card'), bg('#view-settings .card-surface'), bg('#filely-financial-tree'), bg('.ftx-ap-card')];
      });
      expect(new Set(colours).size, `Surfaces diverge in ${theme}: ${colours}`).toBe(1);
    }
  }
  expect(errors).toEqual([]);
});

test('quick add, balance, reserve and simulator still open; privacy still hides amounts', async ({ page }) => {
  await openApp(page, true);
  await page.locator('#hdr-plus-btn').click();
  await expect(page.locator('#modal-smart-hub')).toBeVisible();
  await page.locator('[data-qact="manual-expense"]').click();
  await expect(page.locator('#modal-add')).toBeVisible();
  await page.evaluate(() => closeModals());
  await page.locator('.balance-total').click();
  await expect(page.locator('#modal-balance')).toBeVisible();
  await page.evaluate(() => closeModals());
  await page.locator('.balance-detail').first().click();
  await expect(page.locator('#modal-goal-detail')).toBeVisible();
  await page.evaluate(() => { closeModals(); togglePrivacy(); });
  await expect(page.locator('body')).toHaveClass(/stealth-mode/);
  await expect(page.locator('#hero-balance')).toHaveCSS('filter', 'blur(7.5px)');
  await page.evaluate(() => { togglePrivacy(); goTab('analytics'); });
  await page.locator('[data-act="sim"]').click();
  await expect(page.locator('#modal-life-sim')).toBeVisible();
  await expect(page.locator('#sim-results-box')).not.toBeEmpty();
});

test('analytics tabs, periods and stories render with real operations', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await openApp(page, true);
  await page.locator('[data-nav="analytics"]').click();
  for (const period of ['week', 'month', 'quarter', 'year']) {
    await page.locator(`[data-period="${period}"]`).click();
    await expect(page.locator(`[data-period="${period}"]`)).toHaveClass(/active/);
  }
  for (const tab of ['categories', 'rhythm', 'overview']) {
    await page.locator(`[data-subtab="${tab}"]`).click();
    await expect(page.locator('.ftx-ap')).not.toBeEmpty();
  }
  await page.locator('[data-act="stories"]').click();
  await expect(page.locator('.ftx-story-overlay')).toBeVisible();
  expect(errors).toEqual([]);
});

test('first-visit onboarding and empty-state UI remain usable without remote UI dependencies', async ({ page }) => {
  await localOnly(page);
  await page.goto('/');
  await expect(page.locator('#onboarding-screen')).toBeVisible();
  await page.locator('#ob-skip-btn').click();
  await expect(page.locator('#setup-name')).toBeVisible();
  await page.locator('#setup-name').fill('Мария');
  await page.locator('#setup-balance').fill('25000');
  await page.locator('#ob-next-btn').click();
  await expect(page.locator('#onboarding-screen')).toBeHidden();
  await expect(page.locator('#hero-balance')).toHaveAttribute('data-val', '25000');
  await expect(page.locator('#hero-balance')).toHaveAttribute('aria-label', '25 000 ₽');
  await expect(page.locator('#tx-feed')).toContainText('Операций пока нет');
  await expect(page.locator('#hdr-plus-btn svg')).toBeVisible();
});

test('balance card distinguishes exhausted budget, forecast deficit and unusual expenses', async ({ page }) => {
  await openApp(page, true);
  const base = { dailyCap: 1000, todaySpent: 200, freePool: 5000, pct: 20, hasData: true, forecastBalance: 2500 };
  await page.evaluate(m => renderBalanceCardFeedback(m, false), base);
  await expect(page.locator('#status-badge')).toHaveAttribute('data-tone', 'calm');
  await expect(page.locator('#hero-notice')).toBeHidden();
  await expect(page.locator('#hero-balance-card #feed-select-mode-btn')).toHaveCount(0);
  await expect(page.locator('#feed-select-mode-btn')).toHaveCount(1);
  await expect(page.locator('#hero-forecast-text')).toHaveText('+2 500 ₽');
  await expect(page.locator('#hero-budget-progress')).toHaveAttribute('aria-valuenow', '20');

  await page.evaluate(m => renderBalanceCardFeedback({ ...m, forecastBalance: -923660 }, false), base);
  await expect(page.locator('#hero-forecast-row')).toHaveAttribute('data-tone', 'risk');
  await expect(page.locator('#hero-forecast-text')).toHaveText('−923 660 ₽');
  await expect(page.locator('#status-badge')).toHaveAttribute('data-tone', 'risk');
  await expect(page.locator('#hero-notice')).toBeHidden();

  await page.evaluate(m => renderBalanceCardFeedback({ ...m, todaySpent: 1200, pct: 100 }, false), base);
  await expect(page.locator('#hero-notice')).toBeVisible();
  await expect(page.locator('#hero-notice-title')).toHaveText('Бюджет на сегодня исчерпан');
  await page.locator('#hero-notice').click();
  await expect(page.locator('#modal-today')).toBeVisible();
  await page.evaluate(() => closeModals());

  await page.evaluate(m => renderBalanceCardFeedback(m, true), base);
  await expect(page.locator('#status-badge')).toHaveAttribute('data-tone', 'caution');
  await expect(page.locator('#hero-notice-title')).toHaveText('Проверьте последние расходы');

  await page.evaluate(m => renderBalanceCardFeedback({ ...m, hasData: false, forecastBalance: null }, false), base);
  await expect(page.locator('#hero-forecast-text')).toHaveText('—');
  await expect(page.locator('#hero-forecast-note')).toContainText('после первых расходов');
  await expect(page.locator('#hero-notice')).toBeHidden();
});

test('balance card handles a long account name and large amounts at 320px', async ({ page }) => {
  await openApp(page);
  await page.setViewportSize({ width: 320, height: 844 });
  await page.evaluate(() => {
    state.bank = 'Очень длинное название основного банковского счёта';
    state.balance = 999999999;
    state.goal.saved = 888888888;
    renderAll(false);
  });
  const size = await page.locator('#hero-balance-card').evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
  expect(size.content).toBeLessThanOrEqual(size.width);
  await page.locator('#hero-forecast-row').click();
  await expect(page.locator('#modal-forecast-info')).toBeVisible();
});

test('nature theme stays forest green and keeps the tree in full colour', async ({ page }) => {
  await openApp(page);
  const palette = await page.evaluate(() => {
    const rgb = selector => getComputedStyle(document.querySelector(selector)).backgroundColor.match(/[\d.]+/g).slice(0,3).map(Number);
    return {
      canvas: rgb('body'),
      balance: rgb('#hero-balance-card'),
      tree: rgb('#filely-financial-tree'),
      filter: getComputedStyle(document.querySelector('#filely-financial-tree .ft-img')).filter,
      botanical: getComputedStyle(document.querySelector('#hero-balance-card'), '::before').backgroundImage,
    };
  });
  for (const colour of [palette.canvas, palette.balance, palette.tree]) {
    expect(colour[1]).toBeGreaterThan(colour[0] * 1.5);
    expect(colour[1]).toBeGreaterThan(colour[2] * 1.3);
  }
  expect(palette.filter).not.toMatch(/saturate\(0\./);
  expect(palette.botanical).toContain('forest-leaves.svg');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#061C12');
  await page.evaluate(() => setTheme('light'));
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#F4F5E8');
});

async function seedCalendar(page) {
  await page.evaluate(() => {
    state.calYear = 2026; state.calMonth = 10; state.calSelected = '2026-11-24'; state.calFilter = 'all';
    state.payday = '2026-11-29';
    state.transactions = [
      {id:'cal-e1',date:'2026-11-24',time:'13:00',merchant:'Кофейня',amount:350,type:'expense',category:'cafe',items:[]},
      {id:'cal-e2',date:'2026-11-24',time:'10:00',merchant:'Продукты',amount:1250,type:'expense',category:'food',items:[]},
      {id:'cal-i1',date:'2026-11-24',time:'09:00',merchant:'Доход',amount:100000,type:'income',category:'other',items:[]},
      {id:'cal-big',date:'2026-11-22',merchant:'Машина',amount:300000,type:'expense',category:'other',items:[]}
    ];
    state.bills = [{id:'cal-b1',due_date:'2026-11-24',title:'Подписка',amount:399,is_paid:false}];
    goTab('calendar');
  });
}

test('calendar keeps expenses coral, income green, shows both on mixed days and filters planned bills', async ({page}) => {
  await openApp(page); await seedCalendar(page);
  const cell = page.locator('[data-cal-date="2026-11-24"]');
  await expect(cell.locator('.cal-expense')).toHaveText('−1.6к');
  await expect(cell.locator('.cal-income')).toHaveText('+100к');
  await expect(cell).toHaveAttribute('aria-pressed','true');
  const colours = await cell.evaluate(el => ({expense:getComputedStyle(el.querySelector('.cal-expense')).color, income:getComputedStyle(el.querySelector('.cal-income')).color}));
  expect(colours.expense).not.toBe(colours.income);
  expect(await page.locator('#cal-day-txs [data-operation-type="expense"]').count()).toBe(2);
  await expect(page.locator('[data-cal-date="2026-11-23"] .cal-day-amounts')).toBeEmpty();
  await page.locator('[data-cal-filter="expense"]').click();
  await expect(page.locator('#cal-day-txs [data-operation-type="income"]')).toHaveCount(0);
  await expect(page.locator('#cal-day-bills')).toBeEmpty();
  await expect(cell.locator('.cal-income')).toHaveCount(0);
  await page.locator('[data-cal-filter="bills"]').click();
  await expect(page.locator('#cal-day-bills')).toContainText('Подписка');
  await expect(page.locator('#cal-day-txs [data-operation-row]')).toHaveCount(0);
  await page.locator('[data-cal-filter="all"]').click();
  await page.locator('#cal-day-txs [data-operation-row="cal-e1"]').click();
  await expect(page.locator('#modal-tx')).toBeVisible();
});

test('calendar selection, month boundaries and semantic colours work in both themes at 320px', async ({page}) => {
  await openApp(page); await seedCalendar(page);
  await page.setViewportSize({width:320,height:844});
  for (const theme of ['dark','light']) {
    await page.evaluate(theme => setTheme(theme), theme);
    const expense = await page.locator('[data-cal-date="2026-11-22"] .cal-expense').evaluate(el=>getComputedStyle(el).color.match(/\d+/g).map(Number));
    expect(expense[0]).toBeGreaterThan(expense[1]);
    await expect(page.locator('[data-cal-date="2026-11-29"]')).toHaveClass(/has-planned/);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
  }
  await page.evaluate(()=>{state.calYear=2026;state.calMonth=0;state.calSelected='2026-01-31';shiftCalMonth(1);});
  await expect(page.locator('[data-cal-date="2026-02-28"]')).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>{state.calYear=2026;state.calMonth=0;state.calSelected='2026-01-31';shiftCalMonth(-1);});
  await expect(page.locator('[data-cal-date="2025-12-31"]')).toHaveAttribute('aria-pressed','true');
});

test('operation reveal is staggered, only new rows replay on sync, and reduced motion disables it', async ({page}) => {
  await openApp(page);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});
  await seedCalendar(page);
  await page.evaluate(() => renderCalendar()); // Sync before the offscreen rows enter view.
  await page.locator('#cal-day-txs').scrollIntoViewIfNeeded();
  await expect.poll(() => page.locator('#cal-day-txs').evaluate(el => el.getAnimations({subtree:true}).filter(a=>a.id==='fintex-operation-reveal').length)).toBe(3);
  const initial = await page.evaluate(()=>Array.from(document.querySelectorAll('#cal-day-txs [data-operation-row]')).map(row=>{
    const animation=row.getAnimations().find(a=>a.id==='fintex-operation-reveal');
    animation?.pause(); return animation?.effect.getTiming().delay;
  }));
  expect(initial).toEqual([0,65,130]);
  const fresh = await page.evaluate(()=>{
    state.transactions.push({id:'cal-new',date:'2026-11-24',merchant:'Новый расход',amount:99,type:'expense',category:'other',items:[]});
    renderCalendar();
    return [...document.querySelectorAll('#cal-day-txs [data-operation-row]')].filter(el=>el.getAnimations().some(a=>a.id==='fintex-operation-reveal')).map(el=>el.dataset.operationRow);
  });
  expect(fresh).toEqual(['cal-new']);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>renderCalendar());
  expect(await page.locator('#cal-day-txs').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.id==='fintex-operation-reveal').length)).toBe(0);
  await expect(page.locator('#cal-day-txs [data-operation-row="cal-new"]')).toHaveCSS('opacity','1');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();pickCalDay('2026-11-22');});
  expect(await page.locator('#cal-day-txs').evaluate(el=>el.getAnimations({subtree:true}).filter(a=>a.id==='fintex-operation-reveal').length)).toBe(0);
});

test('home operation arrivals share the animation without replaying existing rows', async ({page}) => {
  await openApp(page, true);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#tx-feed').scrollIntoViewIfNeeded();
  const appeared = await page.evaluate(()=>{
    localStorage.setItem('fp_motion','1'); applyMotionPref();
    state.transactions.unshift({id:'home-new',date:TODAY,merchant:'Новая покупка',amount:85,type:'expense',category:'food',items:[]});
    renderHome();
    return [...document.querySelectorAll('#tx-feed [data-operation-row]')].filter(el=>el.getAnimations().some(a=>a.id==='fintex-operation-reveal')).map(el=>el.dataset.operationRow);
  });
  expect(appeared).toEqual(['home-new']);
  await expect(page.locator('#tx-feed [data-operation-row="home-new"] .money-val')).toHaveClass(/operation-expense/);
});

async function enableSprout(page) {
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});
}

test('sprout grows for five seconds, is private, modal and restores interaction after exit', async ({page}) => {
  await openApp(page, true); await enableSprout(page);
  await page.clock.install();
  await page.locator('#hdr-plus-btn').focus();
  await page.evaluate(()=>replayMotionSplash());
  const stage = page.locator('#returning-splash');
  await expect(stage).toBeVisible();
  await expect(stage).toHaveAttribute('role','dialog');
  await expect(page.locator('#sprout-skip')).toBeFocused();
  expect(await page.locator('main').evaluate(el=>el.inert)).toBe(true);
  await expect(stage).not.toContainText(/₽|Банк|резерв|Андрей|загруз/i);
  await page.keyboard.press('Tab');
  await expect(page.locator('#sprout-skip')).toBeFocused();
  await page.clock.runFor(4400);
  await expect(stage).toBeVisible();
  await expect(stage).not.toHaveClass(/is-leaving/);
  await page.clock.runFor(700);
  await expect(stage).toBeHidden();
  expect(await page.locator('main').evaluate(el=>el.inert)).toBe(false);
  await expect(page.locator('#hdr-plus-btn')).toBeFocused();
  await expect(page.locator('body')).not.toHaveCSS('overflow','hidden');
});

test('sprout skip, touch area, Escape and repeat launches clear old timers', async ({page}) => {
  await openApp(page); await enableSprout(page); await page.clock.install();
  for (const action of ['button','background','escape']) {
    await page.evaluate(()=>replayMotionSplash());
    if (action === 'button') await page.locator('#sprout-skip').click();
    if (action === 'background') await page.locator('#sprout-tagline').click({force:true});
    if (action === 'escape') await page.keyboard.press('Escape');
    await page.clock.runFor(450);
    await expect(page.locator('#returning-splash')).toBeHidden();
  }
  await page.evaluate(()=>replayMotionSplash());
  await page.clock.runFor(3000);
  await page.evaluate(()=>replayMotionSplash());
  await page.clock.runFor(2200);
  await expect(page.locator('#returning-splash')).toBeVisible();
  await page.clock.runFor(3000);
  await expect(page.locator('#returning-splash')).toBeHidden();
});

test('sprout skips when motion is disabled and exits immediately on preference changes', async ({page}) => {
  await openApp(page);
  await page.evaluate(()=>replayMotionSplash());
  await expect(page.locator('#returning-splash')).toBeHidden();
  await enableSprout(page);
  await page.evaluate(()=>replayMotionSplash());
  await expect(page.locator('#returning-splash')).toBeVisible();
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(page.locator('#returning-splash')).toBeHidden();
  await page.evaluate(()=>replayMotionSplash());
  await expect(page.locator('#returning-splash')).toBeHidden();
  await enableSprout(page);
  await page.evaluate(()=>{replayMotionSplash();localStorage.setItem('fp_motion','0');applyMotionPref();});
  await expect(page.locator('#returning-splash')).toBeHidden();
  expect(await page.locator('main').evaluate(el=>el.inert)).toBe(false);
});

test('returning users see sprout on entry; first-time users keep onboarding', async ({page}) => {
  await localOnly(page);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.addInitScript(()=>{localStorage.setItem('fp_onboarded','1');localStorage.setItem('fp_name','Андрей');localStorage.setItem('fp_motion','1');});
  await page.goto('/');
  await expect(page.locator('#returning-splash')).toBeVisible();
  await page.locator('#sprout-skip').click();
  await expect(page.locator('#returning-splash')).toBeHidden();
  await page.evaluate(()=>{localStorage.removeItem('fp_onboarded');localStorage.removeItem('fp_name');});
  // Remove the seed init script by using a separate page in a fresh context.
  const fresh = await page.context().browser().newContext();
  const first = await fresh.newPage(); await localOnly(first); await first.goto('http://127.0.0.1:3100/');
  await expect(first.locator('#onboarding-screen')).toBeVisible();
  await expect(first.locator('#returning-splash')).toBeHidden();
  await fresh.close();
});

test('sprout artwork actually resolves to visible leaves and type in both themes and small viewports', async ({page}) => {
  await openApp(page); await enableSprout(page);
  for (const [width,height] of [[320,568],[390,844],[448,844]]) {
    await page.setViewportSize({width,height});
    for (const theme of ['dark','light']) {
      await page.evaluate(theme=>{setTheme(theme);replayMotionSplash();},theme);
      await page.locator('#returning-splash').evaluate(stage=>{
        stage.getAnimations({subtree:true}).forEach(animation=>{animation.pause();animation.currentTime=4100;});
      });
      for (const selector of ['.sprout-left','.sprout-right','#sprout-title','#sprout-tagline']) {
        await expect(page.locator(selector)).toHaveCSS('opacity','1');
      }
      const bounds=await page.locator('#sprout-title').boundingBox();
      expect(bounds.y).toBeGreaterThan(0); expect(bounds.y+bounds.height).toBeLessThan(height);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
      await page.evaluate(()=>FintexEntrance.dismiss(true));
    }
  }
});
