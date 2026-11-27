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
      expect(new Set(colours.slice(0,3)).size, `Home/settings/tree surfaces diverge in ${theme}: ${colours}`).toBe(1);
      expect(colours[3], 'Analytics has an intentionally contrasting report hero').not.toBe(colours[0]);
    }
  }
  expect(errors).toEqual([]);
});

test('quick add, balance, reserve and simulator still open; privacy still hides amounts', async ({ page }) => {
  await openApp(page, true);
  await page.locator('#hdr-plus-btn').click();
  await expect(page.locator('#daily-flow')).toBeVisible();
  await expect(page.locator('#flow-amount')).toBeFocused();
  await page.locator('#flow-tools').click();
  await expect(page.locator('#modal-smart-hub')).toBeVisible();
  await page.locator('[data-qact="manual-expense"]').click();
  await expect(page.locator('#daily-flow')).toBeVisible();
  await page.evaluate(() => closeModals());
  await page.locator('.balance-total').click();
  await expect(page.locator('#daily-reconcile')).toBeVisible();
  await page.evaluate(() => closeModals());
  await page.locator('.balance-detail').first().click();
  await expect(page.locator('#modal-goal-detail')).toBeVisible();
  await page.evaluate(() => { closeModals(); togglePrivacy(); });
  await expect(page.locator('body')).toHaveClass(/stealth-mode/);
  await expect(page.locator('#hero-balance')).toHaveCSS('filter', 'blur(7.5px)');
  await page.evaluate(() => { togglePrivacy(); goTab('analytics'); });
  await page.locator('#analytics-tools > summary').click();
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
  await page.locator('#analytics-tools > summary').click();
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
  await expect(page.locator('#hero-notice-title')).toHaveText('Есть похожие записи');

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
  await page.locator('#balance-more > summary').click();await page.locator('#hero-forecast-row').click();
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
  await expect(page.locator('#cal-day-txs [data-operation-row]')).toHaveCount(0);
  await expect(page.locator('#cal-day-count')).toContainText('Операции: 3');
  await expect(page.locator('[data-cal-date="2026-11-23"] .cal-day-amounts')).toBeEmpty();
  await page.locator('[data-cal-filter="expense"]').click();
  await expect(page.locator('#cal-day-txs [data-operation-type="income"]')).toHaveCount(0);
  await expect(page.locator('#cal-day-bills')).toBeEmpty();
  await expect(cell.locator('.cal-income')).toHaveCount(0);
  await page.locator('[data-cal-filter="bills"]').click();
  await expect(page.locator('#cal-day-bills')).toContainText('Подписка');
  await expect(page.locator('#cal-day-txs [data-operation-row]')).toHaveCount(0);
  await page.locator('[data-cal-filter="all"]').click();
  await page.locator('#cal-open-journal').click();
  await expect(page.locator('#view-home')).toBeVisible();
  await page.locator('#tx-feed [data-operation-row="cal-e1"]').click();
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

test('calendar links to a single dated journal without duplicating records or hiding the active filter',async({page})=>{
  await openApp(page);await seedCalendar(page);const before=await page.evaluate(()=>JSON.stringify(state.transactions));
  await page.locator('[data-cal-filter="expense"]').click();await page.locator('#cal-open-journal').click();
  await expect(page.locator('#journal-day-filter')).toContainText('Расходы');await expect(page.locator('#tx-feed [data-operation-row]')).toHaveCount(2);await expect(page.locator('#cal-day-txs [data-operation-row]')).toHaveCount(0);
  await page.locator('#journal-day-filter button').click();await expect(page.locator('#journal-day-filter')).toBeHidden();await expect(page.locator('#tx-feed [data-operation-row]')).toHaveCount(4);
  await page.evaluate(()=>{goTab('calendar');pickCalDay('2026-11-23');});await page.locator('#cal-open-journal').click();await expect(page.locator('#tx-feed')).toContainText('За выбранный день операций нет');await expect(page.locator('#journal-day-filter')).toBeVisible();
  expect(await page.evaluate(()=>JSON.stringify(state.transactions))).toBe(before);
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

async function openInvestments(page) {
  await page.locator('[data-nav="analytics"]').click();
  await page.locator('#analytics-tools > summary').click();await page.locator('#view-analytics [data-invest-open]').click();
  await expect(page.locator('#invest-learning')).toBeVisible();
}

test('free learning account is reachable, has no fake quotes or trades and fits both themes', async({page})=>{
  await openApp(page,true); await openInvestments(page);
  await expect(page.locator('#invest-learning')).toContainText('Демо · Только виртуальные деньги');
  await expect(page.locator('.inv-cash')).toHaveText('100 000 ₽');
  await expect(page.getByRole('button',{name:'Купить',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Продать',exact:true})).toBeDisabled();
  await expect(page.locator('#invest-learning')).toContainText('Котировки не подключены');
  for(const width of [320,390,448]) {
    await page.setViewportSize({width,height:844});
    for(const theme of ['dark','light']) {
      await page.evaluate(theme=>setTheme(theme),theme);
      for(const name of ['Счёт','Акции','Уроки','Дневник','Правила']) {
        await page.getByRole('button',{name,exact:true}).click();
        const bounds=await page.locator('#invest-learning').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
        expect(bounds.scroll).toBeLessThanOrEqual(bounds.width);
      }
    }
  }
  await page.keyboard.press('Escape');await expect(page.locator('#invest-learning')).toBeHidden();
  await expect(page.locator('#view-analytics [data-invest-open]')).toBeFocused();
});

test('lessons require a correct answer and persist progress without affecting personal finances',async({page})=>{
  await openApp(page,true);
  const before=await page.evaluate(()=>({balance:state.balance,transactions:JSON.stringify(state.transactions),metrics:JSON.stringify(calcMetrics())}));
  await openInvestments(page);
  await page.getByRole('button',{name:'Уроки',exact:true}).click();
  await page.locator('[data-lesson="ownership"]').click();
  await page.locator('input[name="answer"][value="0"]').check();
  await page.getByRole('button',{name:'Проверить ответ'}).click();
  await expect(page.locator('#inv-feedback')).toContainText('Попробуйте ещё раз');
  expect(await page.evaluate(()=>localStorage.getItem('fp_invest_learning_v1'))).toBeNull();
  await page.locator('input[name="answer"][value="1"]').check();
  await page.getByRole('button',{name:'Проверить ответ'}).click();
  await expect(page.locator('#inv-feedback')).toContainText('Верно.');
  await page.getByRole('button',{name:'Проверить ответ'}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('fp_invest_learning_v1')).completed)).toEqual(['ownership']);
  expect(await page.evaluate(()=>({balance:state.balance,transactions:JSON.stringify(state.transactions),metrics:JSON.stringify(calcMetrics())}))).toEqual(before);
  await page.reload();await page.waitForFunction(()=>!!window.FintexAnalyticsPro);await openInvestments(page);
  await page.getByRole('button',{name:'Уроки',exact:true}).click();
  await expect(page.locator('[data-lesson="ownership"]')).toContainText('Пройдено');
});

test('investment diary escapes user text, survives reload, preserves drafts and reset is scoped and confirmed',async({page})=>{
  await openApp(page,true); await openInvestments(page);
  const real=await page.evaluate(()=>({balance:state.balance,tx:JSON.stringify(state.transactions)}));
  await page.getByRole('button',{name:'Дневник',exact:true}).click();
  await page.locator('[name="company"]').fill('<img src=x onerror="window.badInvestment=true">');
  await page.locator('[name="thesis"]').fill('Изучаю риски, не отправляю заявку.');
  await page.getByRole('button',{name:'Счёт',exact:true}).click();
  await page.getByRole('button',{name:'Дневник',exact:true}).click();
  await expect(page.locator('[name="thesis"]')).toHaveValue('Изучаю риски, не отправляю заявку.');
  await page.getByRole('button',{name:'Сохранить запись'}).click();
  await expect(page.locator('.inv-note')).toContainText('<img src=x');
  await expect(page.locator('.inv-note img')).toHaveCount(0);
  expect(await page.evaluate(()=>window.badInvestment)).toBeUndefined();
  await page.reload(); await page.waitForFunction(()=>!!window.FintexAnalyticsPro);await openInvestments(page);
  await page.getByRole('button',{name:'Дневник',exact:true}).click();await expect(page.locator('.inv-note')).toHaveCount(1);
  await page.getByRole('button',{name:'Правила',exact:true}).click();
  await page.getByRole('button',{name:'Сбросить только обучение'}).click();
  await page.getByRole('button',{name:'Отмена',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('fp_invest_learning_v1')).journal.length)).toBe(1);
  await page.getByRole('button',{name:'Сбросить только обучение'}).click();
  await page.getByRole('button',{name:'Удалить учебные данные'}).click();
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fp_invest_learning_v1')).journal.length)).toBe(0);
  expect(await page.evaluate(()=>({balance:state.balance,tx:JSON.stringify(state.transactions)}))).toEqual(real);
});

test('corrupt learning data is not overwritten; storage failure never reports a successful diary save',async({page})=>{
  await openApp(page);
  await page.evaluate(()=>localStorage.setItem('fp_invest_learning_v1','{broken'));
  await openInvestments(page);await expect(page.locator('#inv-message')).toContainText('не перезаписана');
  await page.getByRole('button',{name:'Уроки',exact:true}).click();await page.locator('[data-lesson="fees"]').click();
  await page.locator('input[value="1"]').check();await page.getByRole('button',{name:'Проверить ответ'}).click();
  expect(await page.evaluate(()=>localStorage.getItem('fp_invest_learning_v1'))).toBe('{broken');
  await page.getByRole('button',{name:'Правила',exact:true}).click();
  await page.getByRole('button',{name:'Сбросить только обучение'}).click();await page.getByRole('button',{name:'Удалить учебные данные'}).click();
  await page.getByRole('button',{name:'Дневник',exact:true}).click();
  await page.locator('[name="thesis"]').fill('Не потерять эту заметку');
  await page.evaluate(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fp_invest_learning_v1')throw new Error('quota');return original.call(this,k,v);};});
  await page.getByRole('button',{name:'Сохранить запись'}).click();
  await expect(page.locator('#inv-message')).toContainText('Не удалось сохранить');
  await expect(page.locator('[name="thesis"]')).toHaveValue('Не потерять эту заметку');
  await expect(page.locator('.inv-note')).toHaveCount(0);
});

async function openStock(page,symbol) {
  await page.getByRole('button',{name:'Акции',exact:true}).click();
  await page.locator('#inv-stock-search').fill(symbol);
  await page.locator('#inv-stock-list [data-stock]').click();
}
async function previewExercise(page,price,qty='1') {
  await page.locator('#inv-trade-form [name="price"]').fill(price);
  await page.locator('#inv-trade-form [name="quantity"]').fill(qty);
  await page.getByRole('button',{name:'Посчитать перед подтверждением'}).click();
}
async function confirmExercise(page) {
  await page.locator('[name="manual-ack"]').check();
  await page.getByRole('button',{name:'Подтвердить упражнение',exact:true}).click();
  await expect(page.locator('#inv-message')).toContainText('Упражнение сохранено');
}

test('real share catalogue filters by name and market without inventing prices; lessons use simple examples',async({page})=>{
  await openApp(page);await openInvestments(page);
  await page.getByRole('button',{name:'Акции',exact:true}).click();
  await expect(page.locator('.inv-stock')).toHaveCount(8);
  await page.locator('#inv-market-filter').selectOption('Россия');await expect(page.locator('.inv-stock')).toHaveCount(3);
  await page.locator('#inv-stock-search').fill('Apple');await expect(page.locator('.inv-stock')).toHaveCount(0);
  await page.locator('#inv-market-filter').selectOption('Все');await expect(page.locator('.inv-stock')).toHaveCount(1);
  await page.locator('.inv-stock').click();
  await expect(page.locator('.inv-asset h3')).toHaveText('Apple');
  await expect(page.locator('.inv-asset a')).toHaveAttribute('href','https://investor.apple.com/faq/default.aspx');
  await expect(page.locator('[name="price"]')).toHaveValue('');
  await expect(page.locator('#inv-content')).toContainText('Не рыночная котировка');
  await page.getByRole('button',{name:'Уроки',exact:true}).click();await page.locator('[data-lesson="ownership"]').click();
  await expect(page.locator('.inv-section')).toContainText('пекарню');
  await expect(page.locator('.inv-example')).toBeVisible();
});

test('manual-price share exercises buy and sell with fees, persist holdings and never change the real budget',async({page})=>{
  await openApp(page,true);await openInvestments(page);
  const before=await page.evaluate(()=>({balance:state.balance,tx:JSON.stringify(state.transactions),metrics:JSON.stringify(calcMetrics())}));
  await openStock(page,'SBER');await previewExercise(page,'100','10');
  await expect(page.locator('.inv-review')).toContainText('1 003');
  // No ledger event before the explicit manual-price acknowledgement.
  expect(await page.evaluate(()=>localStorage.getItem('fp_invest_learning_v1'))).toBeNull();
  await confirmExercise(page);
  await expect(page.locator('.inv-asset-wallet')).toContainText('10 шт.');
  await page.locator('[data-trade-side="sell"]').click();await previewExercise(page,'110','2');await confirmExercise(page);
  await expect(page.locator('.inv-asset-wallet')).toContainText('8 шт.');
  await page.getByRole('button',{name:'Счёт',exact:true}).click();
  await expect(page.locator('.inv-cash')).toContainText('99 216,34');
  await expect(page.locator('.inv-position')).toContainText('8 шт.');
  await expect(page.locator('.inv-position')).toContainText('802,4');
  await expect(page.locator('.inv-result-list')).toContainText('18,74');
  expect(await page.evaluate(()=>({balance:state.balance,tx:JSON.stringify(state.transactions),metrics:JSON.stringify(calcMetrics())}))).toEqual(before);
  await page.reload();await page.waitForFunction(()=>!!window.FintexAnalyticsPro);await openInvestments(page);
  await expect(page.locator('.inv-position')).toContainText('8 шт.');
  await expect(page.locator('.inv-note')).toHaveCount(2);
});

test('share exercises reject overspend, invalid decimals and overselling; currency wallets stay separate',async({page})=>{
  await openApp(page);await openInvestments(page);await openStock(page,'AAPL');
  await previewExercise(page,'10000','2');await expect(page.locator('#inv-message')).toContainText('Не хватает');
  await previewExercise(page,'100.123','1');await expect(page.locator('#inv-message')).toContainText('двух знаков');
  await page.locator('[data-trade-side="sell"]').click();await previewExercise(page,'100','1');
  await expect(page.locator('#inv-message')).toContainText('больше акций');
  await page.locator('[data-trade-side="buy"]').click();await previewExercise(page,'100','2');await confirmExercise(page);
  await page.getByRole('button',{name:'Счёт',exact:true}).click();
  await expect(page.locator('.inv-cash')).toHaveText('100 000 ₽');
  await expect(page.locator('.inv-currency-wallets')).toContainText('9 799,4');
});

test('stock detail and confirmation fit 320px in both themes and stale confirmations cannot duplicate a trade',async({page})=>{
  await openApp(page);await openInvestments(page);await openStock(page,'SAP');await previewExercise(page,'100','2');
  await page.setViewportSize({width:320,height:700});
  for(const theme of ['dark','light']) {
    await page.evaluate(theme=>setTheme(theme),theme);
    const dimensions=await page.locator('#invest-learning').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  }
  await confirmExercise(page);
  const count=await page.evaluate(()=>JSON.parse(localStorage.getItem('fp_invest_learning_v1')).practice.trades.length);
  expect(count).toBe(1);
  await previewExercise(page,'100','1');
  // Simulate a second local operation while this confirmation is open.
  await page.evaluate(()=>{
    const key='fp_invest_learning_v1',data=JSON.parse(localStorage.getItem(key)),m=FintexPracticeMarket;
    data.practice=m.execute(data.practice,{id:'other-tab',instrumentId:'XETR:SAP',side:'buy',quantity:1,priceMinor:10000,generation:data.practice.generation,revision:data.practice.trades.length,acknowledged:true});
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.locator('[name="manual-ack"]').check();await page.getByRole('button',{name:'Подтвердить упражнение',exact:true}).click();
  await expect(page.locator('#inv-message')).toContainText('портфель изменился');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('fp_invest_learning_v1')).practice.trades.length)).toBe(2);
});

test('two tabs cannot both execute against the same practice balance revision',async({page})=>{
  await openApp(page);await openInvestments(page);await openStock(page,'SBER');await previewExercise(page,'100','1');
  const second=await page.context().newPage();await localOnly(second);await second.goto('/');
  await second.waitForFunction(()=>!!window.FintexAnalyticsPro);await openInvestments(second);await openStock(second,'SBER');await previewExercise(second,'100','1');
  await page.locator('[name="manual-ack"]').check();await second.locator('[name="manual-ack"]').check();
  await page.evaluate(()=>{navigator.locks.request('fp_invest_learning_v1',async()=>{window.practiceLockHeld=true;await new Promise(resolve=>window.releasePracticeLock=resolve);});});
  await page.waitForFunction(()=>window.practiceLockHeld);
  await Promise.all([page.getByRole('button',{name:'Подтвердить упражнение',exact:true}).click(),second.getByRole('button',{name:'Подтвердить упражнение',exact:true}).click()]);
  await page.evaluate(()=>window.releasePracticeLock());
  await expect.poll(async()=>{const messages=await Promise.all([page.locator('#inv-message').textContent(),second.locator('#inv-message').textContent()]);return messages.filter(m=>m.includes('портфель изменился')).length;}).toBe(1);
  await expect.poll(()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fp_invest_learning_v1')||'{}').practice?.trades.length)).toBe(1);
  const account=await page.evaluate(()=>FintexPracticeMarket.summary(JSON.parse(localStorage.getItem('fp_invest_learning_v1')).practice));
  expect(account.cash.RUB).toBe(9989970);expect(account.positions['MOEX:SBER'].quantity).toBe(1);
  await second.close();
});

test('practice save failure preserves confirmation and reset invalidates outstanding trade requests',async({page})=>{
  await openApp(page);await openInvestments(page);await openStock(page,'SBER');await previewExercise(page,'100','1');
  await page.locator('[name="manual-ack"]').check();
  await page.evaluate(()=>{window.savedSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fp_invest_learning_v1')throw new Error('quota');return window.savedSetItem.call(this,k,v);};});
  await page.getByRole('button',{name:'Подтвердить упражнение',exact:true}).click();
  await expect(page.locator('#inv-message')).toContainText('Упражнение не сохранено');
  await expect(page.locator('.inv-review')).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('fp_invest_learning_v1'))).toBeNull();
  await page.evaluate(()=>{Storage.prototype.setItem=window.savedSetItem;const m=FintexPracticeMarket;localStorage.setItem('fp_invest_learning_v1',JSON.stringify({version:2,cashKopecks:10000000,completed:[],journal:[],practice:m.newPractice()}));});
  await page.getByRole('button',{name:'Подтвердить упражнение',exact:true}).click();
  await expect(page.locator('#inv-message')).toContainText('счёт был сброшен');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('fp_invest_learning_v1')).practice.trades.length)).toBe(0);
});

test('browser without Web Locks does not silently perform unsafe practice writes',async({page})=>{
  await openApp(page);await openInvestments(page);await openStock(page,'SBER');await previewExercise(page,'100','1');
  await page.evaluate(()=>Object.defineProperty(navigator,'locks',{value:undefined,configurable:true}));
  await page.locator('[name="manual-ack"]').check();await page.getByRole('button',{name:'Подтвердить упражнение',exact:true}).click();
  await expect(page.locator('#inv-message')).toContainText('нет защиты от одновременной записи');
  expect(await page.evaluate(()=>localStorage.getItem('fp_invest_learning_v1'))).toBeNull();
});

test('settings groups preferences without duplicate finance or investment entries; keyboard disclosure works',async({page})=>{
  await openApp(page,true);
  await page.locator('#home-header > div[title="Профиль и настройки"]').click();
  await expect(page.locator('#view-settings')).toBeVisible();
  await expect(page.locator('#view-settings [data-invest-open]')).toHaveCount(0);
  await expect(page.locator('#view-settings #st-bills-list')).toHaveCount(0);
  await expect(page.locator('#view-settings .section-group[open]')).toHaveCount(0);
  const appearance=page.locator('#settings-appearance > summary');await appearance.focus();await page.keyboard.press('Enter');
  await expect(page.locator('#theme-seg')).toBeVisible();
  await page.locator('#theme-seg').getByRole('button',{name:'Светлая',exact:true}).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.locator('#settings-advanced > summary').click();
  await expect(page.locator('#settings-advanced')).toContainText('только после подтверждения');
  await expect(page.locator('#auto-delta-toggle')).toHaveCount(0);
});

test('calendar owns salary, goals and all payments, and a payment opens its day',async({page})=>{
  await openApp(page,true);
  await page.evaluate(()=>{state.bills=[{id:'plan-test',title:'Аренда',amount:15000,due_date:TODAY,is_paid:false}];renderAll(false);});
  await page.locator('[data-nav="calendar"]').click();await page.locator('#calendar-plan > summary').click();
  await expect(page.locator('#st-bills-list')).toContainText('Аренда');
  await page.locator('#calendar-plan button[onclick="openPaydayModal()"]' ).click();await expect(page.locator('#modal-payday')).toBeVisible();await page.evaluate(()=>closeModals());
  await page.locator('#calendar-plan button[onclick="openGoalDetailsModal()"]' ).click();await expect(page.locator('#modal-goal-detail')).toBeVisible();await page.evaluate(()=>closeModals());
  await page.locator('#calendar-plan button[onclick="openBillModal()"]' ).click();await expect(page.locator('#modal-bill')).toBeVisible();await page.evaluate(()=>closeModals());
  await page.locator('[data-plan-bill="plan-test"]').click();await expect(page.locator('#calendar-plan')).not.toHaveAttribute('open');
  await expect(page.locator('#cal-day-bills')).toContainText('Аренда');
  await expect(page.locator('#cal-day-heading')).toBeFocused();
  await page.locator('#calendar-plan > summary').click();await page.locator('[data-plan-delete="plan-test"]').click();
  await expect(page.locator('#st-bills-list')).toContainText('Нет запланированных');
});

test('import, automation, cloud and diagnostics open only the requested task',async({page})=>{
  await openApp(page);await page.locator('[data-nav="settings"]').click();await page.locator('#settings-data > summary').click();
  await page.locator('#settings-data').getByRole('button',{name:/Импорт операций/}).click();
  await expect(page.locator('#ap-section-import')).toHaveAttribute('open');
  await expect(page.locator('#modal-autopilot details[open]')).toHaveCount(1);await page.evaluate(()=>closeModals());
  await page.locator('#settings-data').getByRole('button',{name:/Облачная синхронизация/}).click();
  await expect(page.locator('#ap-section-cloud')).toHaveAttribute('open');await expect(page.locator('#gas-url-field')).toBeVisible();
  await expect(page.locator('#gas-token-field')).toHaveAttribute('type','password');await page.evaluate(()=>closeModals());
  await page.locator('#settings-advanced > summary').click();
  for(const [name,id] of [['Автоматизация iPhone','automation'],['Диагностика','logs']]) {
    await page.locator('#settings-advanced').getByRole('button',{name:new RegExp(name)}).click();
    await expect(page.locator(`#ap-section-${id}`)).toHaveAttribute('open');
    await expect(page.locator('#modal-autopilot details[open]')).toHaveCount(1);await page.evaluate(()=>closeModals());
  }
});

test('analytics tools are grouped, remain open across period changes and open their real dialogs',async({page})=>{
  await openApp(page,true);await page.locator('[data-nav="analytics"]').click();
  await expect(page.locator('#view-analytics [data-invest-open]')).toHaveCount(1);
  await expect(page.locator('#analytics-tools')).not.toHaveAttribute('open');
  await page.locator('#analytics-tools > summary').click();await page.locator('[data-period="week"]').click();
  await expect(page.locator('#analytics-tools')).toHaveAttribute('open');
  for(const [tool,modal] of [['purchase','modal-can-buy'],['prices','modal-price-tracker'],['limits','modal-cat-limit']]) {
    await page.locator(`[data-tool="${tool}"]`).click();await expect(page.locator(`#${modal}`)).toBeVisible();await page.evaluate(()=>closeModals());
  }
});

test('expanded settings and integration groups fit 320px in both themes',async({page})=>{
  await openApp(page,true);await page.setViewportSize({width:320,height:844});await page.locator('[data-nav="settings"]').click();
  for(const theme of ['dark','light']) {
    await page.evaluate(theme=>setTheme(theme),theme);
    for(const id of ['settings-appearance','settings-data','settings-receipts','settings-advanced','settings-about']) {
      await page.locator(`#${id}`).evaluate(el=>{el.open=true;});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
    }
    for(const section of ['import','automation','cloud','logs']) {
      await page.evaluate(section=>openAutopilotModal(section),section);
      const size=await page.locator('#modal-autopilot .modal-sheet').evaluate(el=>({width:el.clientWidth,scroll:el.scrollWidth}));
      expect(size.scroll,`${theme}/${section}`).toBeLessThanOrEqual(size.width);
      await page.evaluate(()=>closeModals());
    }
  }
});

test('Sapphire selection is keyboard accessible, independent from mode, and survives reload', async ({ page }) => {
  await openApp(page, true);
  await page.locator('[data-nav="settings"]').click();
  await page.locator('#settings-appearance > summary').click();
  const sapphire = page.locator('[data-visual-style-choice="sapphire"]');
  await sapphire.focus(); await page.keyboard.press('Enter');
  await expect(sapphire).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('html')).toHaveAttribute('data-visual-style','sapphire');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#153073');
  await page.locator('#theme-seg button').nth(1).click();
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#F6F6F6');
  await expect(sapphire).toHaveAttribute('aria-pressed','true');
  const before = await page.evaluate(() => localStorage.getItem('fp_local_tx'));
  await page.reload();
  await page.waitForFunction(() => !!window.FintexAnalyticsPro);
  await expect(page.locator('html')).toHaveAttribute('data-visual-style','sapphire');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => localStorage.getItem('fp_local_tx'))).toBe(before);
  await page.evaluate(() => setVisualStyle('forest'));
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#F4F5E8');
  await expect(page.locator('#theme-seg button').nth(1)).toHaveAttribute('aria-pressed','true');
});

test('Sapphire keeps semantic money colours and fits every tab and appearance controls at 320px', async ({ page }) => {
  await openApp(page, true);
  await page.setViewportSize({width:320,height:844});
  const semantic = () => page.evaluate(() => ['--income','--expense','--planned'].map(p => getComputedStyle(document.documentElement).getPropertyValue(p).trim()));
  for (const mode of ['dark','light']) {
    await page.evaluate(mode => {setTheme(mode);setVisualStyle('forest');},mode);
    const forest = await semantic();
    await page.evaluate(() => setVisualStyle('sapphire'));
    expect(await semantic()).toEqual(forest);
    for (const tab of ['home','calendar','analytics','settings']) {
      await page.locator(`[data-nav="${tab}"]`).click();
      if (tab === 'settings') await page.locator('#settings-appearance').evaluate(el => el.open = true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    }
    const visual = await page.evaluate(() => ({
      bg:getComputedStyle(document.querySelector('#hero-balance-card')).backgroundColor,
      waves:getComputedStyle(document.querySelector('#hero-balance-card'),'::before').backgroundImage,
      filter:getComputedStyle(document.querySelector('.ft-img')).filter
    }));
    expect(visual.bg).toBe(mode === 'dark' ? 'rgb(27, 58, 123)' : 'rgb(255, 255, 255)');
    await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(mode === 'dark' ? 'rgb(21, 48, 115)' : 'rgb(246, 246, 246)');
    expect(visual.waves).toContain('sapphire-bands.svg');
    expect(visual.filter).not.toMatch(/saturate\(0\./);
  }
});

test('auto mode follows device changes without losing selected style', async ({ page }) => {
  await page.emulateMedia({colorScheme:'light'});
  await openApp(page);
  await page.evaluate(() => {setVisualStyle('sapphire');setTheme('auto');});
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.emulateMedia({colorScheme:'dark'});
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#153073');
  await page.evaluate(() => setTheme('light'));
  await page.emulateMedia({colorScheme:'light'});
  await page.emulateMedia({colorScheme:'dark'});
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.locator('html')).toHaveAttribute('data-visual-style','sapphire');
});

test('appearance synchronizes between tabs and rejects unknown saved choices', async ({ page, context }) => {
  await openApp(page);
  const other = await context.newPage(); await localOnly(other); await other.goto('/');
  await page.evaluate(() => {setVisualStyle('sapphire');setTheme('light');});
  await expect(other.locator('html')).toHaveAttribute('data-visual-style','sapphire');
  await expect(other.locator('html')).not.toHaveClass(/dark/);
  await page.evaluate(() => {localStorage.setItem('fp_visual_style','unknown');localStorage.setItem('fp_theme','invalid');});
  await expect(other.locator('html')).toHaveAttribute('data-visual-style','forest');
  await expect(other.locator('html')).toHaveClass(/dark/);
  await other.close();
});

test('Telegram auto mode and header colours follow both appearance settings', async ({ page }) => {
  await page.addInitScript(() => {
    window.telegramThemeEvents = {};
    window.telegramColours = {};
    window.Telegram = {WebApp:{initData:'test',colorScheme:'light',ready(){},expand(){},
      setBackgroundColor(value){window.telegramColours.background=value;},
      setHeaderColor(value){window.telegramColours.header=value;},
      onEvent(name,fn){window.telegramThemeEvents[name]=fn;}}};
  });
  await openApp(page);
  await page.evaluate(() => {setTheme('auto');setVisualStyle('sapphire');});
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  expect(await page.evaluate(() => window.telegramColours)).toEqual({background:'#F6F6F6',header:'#F6F6F6'});
  await page.evaluate(() => {Telegram.WebApp.colorScheme='dark';window.telegramThemeEvents.themeChanged();});
  await expect(page.locator('html')).toHaveClass(/dark/);
  expect(await page.evaluate(() => window.telegramColours)).toEqual({background:'#153073',header:'#153073'});
});

async function openWorkCalculator(page) {
  await page.locator('[data-nav="analytics"]').click();
  await page.locator('#analytics-tools > summary').click();
  await page.locator('[data-work-open="calculator"]').click();
  await expect(page.locator('#life-cost-dialog')).toBeVisible();
}

test('price in working time calculates, saves only the profile and persists it after reload', async ({ page }) => {
  await openApp(page,true);
  const original = await page.evaluate(() => ({balance:state.balance,transactions:JSON.stringify(state.transactions),queue:JSON.stringify(state.syncQueue)}));
  await openWorkCalculator(page);
  await expect(page.locator('#work-income')).toBeFocused();
  await page.getByLabel('Доход на руки за месяц, ₽',{exact:true}).fill('80 000');
  await page.getByLabel('Рабочих часов в месяц',{exact:true}).fill('160');
  await page.getByLabel('Стоимость покупки, ₽',{exact:true}).fill('3 000');
  await expect(page.locator('#work-result')).toHaveText('6 ч');
  await expect(page.locator('#work-explanation')).toContainText('500 ₽ за час');
  await page.locator('#work-save').click();
  await expect(page.locator('#work-status')).toContainText('сохранены на этом устройстве');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fp_work_time_v1')))).toEqual({version:1,monthlyIncome:80000,monthlyHours:160});
  expect(await page.evaluate(() => ({balance:state.balance,transactions:JSON.stringify(state.transactions),queue:JSON.stringify(state.syncQueue)}))).toEqual(original);
  await page.keyboard.press('Escape');
  await expect(page.locator('#life-cost-dialog')).toBeHidden();
  await expect(page.locator('[data-work-open="calculator"]')).toBeFocused();
  await page.reload(); await page.waitForFunction(() => !!window.FintexAnalyticsPro);
  await page.evaluate(() => dismissReturningSplash());
  await openWorkCalculator(page);
  await expect(page.locator('#work-income')).toHaveValue('80000');
  await expect(page.locator('#work-hours')).toHaveValue('160');
  await expect(page.locator('#work-price')).toHaveValue('');
});

test('purchase checker shares saved working time while drafts do not change the saved profile', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => openCanIBuyModal());
  await page.locator('#cb-amount').fill('750');
  await expect(page.locator('#cb-work-time')).toContainText('Сколько это часов');
  await page.locator('[data-work-open="purchase"]').click();
  await expect(page.locator('#work-price')).toHaveValue('750');
  await page.locator('#work-income').fill('80000'); await page.locator('#work-hours').fill('160');
  await page.locator('#work-save').click();
  await expect(page.locator('#work-result')).toHaveText('1 ч 30 мин');
  await page.locator('#work-income').fill('160000');
  await expect(page.locator('#work-result')).toHaveText('45 мин');
  await expect(page.locator('#work-status')).toContainText('пока не сохранены');
  await page.keyboard.press('Escape');
  await expect(page.locator('#cb-work-time')).toHaveText('≈ 1 ч 30 мин работы');
  await expect(page.locator('[data-work-open="purchase"]')).toBeFocused();
  await page.locator('#cb-amount').fill('500');
  await expect(page.locator('#cb-work-time')).toHaveText('≈ 1 ч работы');
  await page.locator('#cb-amount').fill('');
  await expect(page.locator('#cb-work-hint')).toContainText('Введите стоимость');
});

test('work calculator reports invalid input and storage failures without overwriting corrupt data', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => localStorage.setItem('fp_work_time_v1','corrupt'));
  await openWorkCalculator(page);
  await expect(page.locator('#work-status')).toContainText('Исходная запись сохранена');
  await page.locator('#work-income').fill('0');await page.locator('#work-hours').fill('160');await page.locator('#work-price').fill('100');
  await page.locator('#work-save').click();
  await expect(page.locator('#work-status')).toContainText('больше 0');
  expect(await page.evaluate(() => localStorage.getItem('fp_work_time_v1'))).toBe('corrupt');
  await page.locator('#work-income').fill('80000');await page.locator('#work-hours').fill('745');
  await expect(page.locator('#work-explanation')).toContainText('не больше 744');
  await page.locator('#work-hours').fill('160');await page.locator('#work-price').fill('1,25');
  await expect(page.locator('#work-result')).toHaveText('Меньше 1 мин');
  await page.evaluate(() => {const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='fp_work_time_v1')throw Error('quota');return original.call(this,key,value);};});
  await page.locator('#work-save').click();
  await expect(page.locator('#work-status')).toContainText('Не удалось сохранить');
  await expect(page.locator('#work-result')).toHaveText('Меньше 1 мин');
  expect(await page.evaluate(() => localStorage.getItem('fp_work_time_v1'))).toBe('corrupt');
});

test('work calculator fits 320px and short screens in both styles and modes with keyboard focus contained', async ({ page }) => {
  await openApp(page);
  await page.setViewportSize({width:320,height:568});
  await page.locator('[data-nav="settings"]').click();
  await page.locator('#settings-work-time > summary').click();
  await page.locator('[data-work-open="settings"]').click();
  for (const style of ['forest','sapphire']) for (const mode of ['dark','light']) {
    await page.evaluate(({style,mode}) => {setVisualStyle(style);setTheme(mode);}, {style,mode});
    const sizes = await page.locator('#life-cost-dialog').evaluate(el => ({width:el.getBoundingClientRect().width,scroll:el.scrollWidth,client:el.clientWidth,height:el.getBoundingClientRect().height}));
    expect(sizes.width).toBeLessThanOrEqual(320);expect(sizes.scroll).toBeLessThanOrEqual(sizes.client);expect(sizes.height).toBeLessThanOrEqual(568);
    await page.locator('#work-income').fill('80000');await page.locator('#work-hours').fill('160');await page.locator('#work-price').fill('3000');
    await expect(page.locator('#work-result')).toHaveText('6 ч');
    await page.locator('#work-save').click();
    await page.locator('.work-formula > summary').focus();await page.keyboard.press('Enter');
    await expect(page.locator('.work-formula')).toHaveAttribute('open','');
    await page.keyboard.press('Enter');
    for(let i=0;i<10;i++) {await page.keyboard.press('Tab');expect(await page.evaluate(() => document.activeElement.closest('#life-cost-dialog') !== null)).toBe(true);}
  }
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-work-open="settings"]')).toBeFocused();
});

test('forest apricot companion is distinct from semantic financial colours', async ({ page }) => {
  await openApp(page,true);
  for (const mode of ['dark','light']) {
    await page.evaluate(mode=>setTheme(mode),mode);
    const palette = await page.evaluate(() => {
      const css=getComputedStyle(document.documentElement);
      return {companion:css.getPropertyValue('--companion').trim(),expense:css.getPropertyValue('--expense').trim(),income:css.getPropertyValue('--income').trim(),planned:css.getPropertyValue('--planned').trim(),accent:css.getPropertyValue('--accent').trim(),icon:getComputedStyle(document.querySelector('.balance-account-icon')).color};
    });
    expect(palette.companion).toBe(mode==='dark'?'#efb184':'#955029');
    for(const token of ['expense','income','planned','accent']) expect(palette.companion).not.toBe(palette[token]);
    await expect.poll(() => page.locator('.balance-account-icon').evaluate(el => getComputedStyle(el).color)).toBe(mode==='dark'?'rgb(239, 177, 132)':'rgb(149, 80, 41)');
  }
});

test('legacy Lagoon preference opens the winter Lagoon palette without resetting mode or budget', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fp_visual_style','lagoon');
    localStorage.setItem('fp_theme','light');
  });
  await openApp(page,true);
  await expect(page.locator('html')).toHaveAttribute('data-visual-style','sapphire');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#F6F6F6');
  const before = await page.evaluate(() => localStorage.getItem('fp_local_tx'));
  await page.locator('[data-nav="settings"]').click();
  await page.locator('#settings-appearance > summary').click();
  await expect(page.locator('[data-visual-style-choice]')).toHaveCount(3);
  const sapphire = page.locator('[data-visual-style-choice="sapphire"]');
  await expect(sapphire).toContainText('Лагуна');
  await expect(sapphire).toHaveAttribute('aria-pressed','true');
  await expect(sapphire).toContainText('Снег');
  await sapphire.click();
  expect(await page.evaluate(() => localStorage.getItem('fp_visual_style'))).toBe('sapphire');
  expect(await page.evaluate(() => localStorage.getItem('fp_local_tx'))).toBe(before);
});

test('winter Lagoon retains the Sapphire reference colours and readable controls', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => setVisualStyle('sapphire'));
  const contrast = (a,b) => {
    const luminance = rgb => rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
  };
  for(const mode of ['light','dark']) {
    await page.evaluate(mode=>setTheme(mode),mode);
    const palette=await page.evaluate(() => {
      const css=getComputedStyle(document.documentElement),rgb=s=>s.match(/\d+/g).slice(0,3).map(Number);
      const colours = selector => {const s=getComputedStyle(document.querySelector(selector));return {text:rgb(s.color),bg:rgb(s.backgroundColor)};};
      return {canvas:css.getPropertyValue('--bg-canvas').trim(),surface:css.getPropertyValue('--surface-2').trim(),accent:css.getPropertyValue('--accent').trim(),budget:colours('.daily-budget'),nav:colours('.nav-tab.is-active-tab'),navPill:colours('#nav-active-pill'),swatch:getComputedStyle(document.querySelector('.swatch-sapphire')).backgroundImage};
    });
    expect(palette.canvas).toBe(mode==='light'?'#f6f6f6':'#153073');
    expect(palette.surface).toBe(mode==='light'?'#d7e3ef':'#244784');
    expect(palette.accent).toBe(mode==='light'?'#1f57a1':'#d7e3ef');
    expect(contrast(palette.budget.text,palette.budget.bg)).toBeGreaterThan(4.5);
    // Text contrast is measured against the actual theme-aware selected surface.
    expect(contrast(palette.nav.text,palette.navPill.bg)).toBeGreaterThan(4.5);
    expect(palette.swatch).toContain('rgb(246, 246, 246)');
    expect(palette.swatch).toContain('rgb(215, 227, 239)');
    expect(palette.swatch).toContain('rgb(31, 87, 161)');
    expect(palette.swatch).toContain('rgb(21, 48, 115)');
  }
});

test('Sapphire figures are neutral per card surface while financial colours and Forest stay unchanged', async ({ page }) => {
  await openApp(page,true);
  const contrast = (a,b) => {
    const luminance=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
  };
  const colour = selector => page.locator(selector).first().evaluate(el=>getComputedStyle(el).color);
  for(const mode of ['light','dark']) {
    await page.evaluate(mode=>{setTheme(mode);setVisualStyle('forest');},mode);
    await expect.poll(() => colour('#hero-balance')).toBe(mode==='light'?'rgb(24, 60, 36)':'rgb(245, 248, 233)');
    const forest = await colour('#hero-balance');
    const semantics = await page.evaluate(()=>['--income','--expense','--planned','--danger'].map(t=>getComputedStyle(document.documentElement).getPropertyValue(t)));
    await page.evaluate(()=>setVisualStyle('sapphire'));
    const neutral=mode==='light'?'rgb(48, 52, 59)':'rgb(246, 243, 237)';
    for(const selector of ['#hero-balance','#hero-reserved','#hero-free-pool','.ft-saved']) await expect.poll(() => colour(selector),selector).toBe(neutral);
    await expect.poll(() => colour('#hero-daily-left')).toBe(mode==='light'?'rgb(246, 243, 237)':'rgb(48, 52, 59)');
    const budget=await page.locator('.daily-budget').evaluate(el=>getComputedStyle(el).backgroundColor);
    const parse=s=>s.match(/\d+/g).slice(0,3).map(Number);
    expect(contrast(parse(await colour('#hero-daily-left')),parse(budget))).toBeGreaterThan(4.5);
    await expect.poll(()=>colour('.ftx-ap-big')).toBe('rgb(243, 245, 238)');
    const reportSurface=await page.locator('.ap-expense-hero').evaluate(el=>getComputedStyle(el).backgroundColor);
    expect(contrast(parse(await colour('.ftx-ap-big')),parse(reportSurface))).toBeGreaterThan(4.5);
    expect(await page.evaluate(()=>['--income','--expense','--planned','--danger'].map(t=>getComputedStyle(document.documentElement).getPropertyValue(t)))).toEqual(semantics);
    const income=await colour('.operation-income'),expense=await colour('.operation-expense');
    expect(income).not.toBe(neutral);expect(expense).not.toBe(neutral);
    await page.evaluate(()=>{document.getElementById('hero-daily-budget').dataset.exhausted='true';document.getElementById('hero-forecast-row').dataset.tone='risk';});
    await expect.poll(() => colour('#hero-daily-left')).toBe(neutral);
    await expect.poll(() => colour('#hero-forecast-text')).toBe(mode==='light'?'rgb(180, 62, 69)':'rgb(255, 166, 154)');
    await page.evaluate(()=>{document.getElementById('hero-daily-budget').dataset.exhausted='false';setVisualStyle('forest');});
    await expect.poll(() => colour('#hero-balance')).toBe(forest);
  }
});

async function setTreeFlow(page, expense) {
  await page.evaluate(expense=>{
    state.transactions=expense===null?[]:[{id:'tree-income',type:'income',amount:10000,date:TODAY},{id:'tree-expense',type:'expense',amount:expense,date:TODAY}];persistAll();
  },expense);
}

test('My tree changes species, not just scale, and savings remain independent of cash flow', async ({ page }) => {
  await openApp(page);
  const tree=page.locator('#filely-financial-tree');
  await expect(tree).toHaveAttribute('data-tree-variant','sapling');
  await page.evaluate(()=>{state.goal={saved:15000,target:50000,title:'Подушка'};persistAll();});
  for(const [expense,variant,name] of [[11000,'birch','Берёза'],[9500,'spruce','Ель'],[8000,'maple','Клён'],[5000,'oak','Дуб']]) {
    await setTreeFlow(page,expense);
    await expect(tree).toHaveAttribute('data-tree-variant',variant);
    await expect(tree.locator('.ft-stage')).toHaveText(name);
    await expect(tree.locator('.ft-img')).toHaveAttribute('src',`./assets/trees/${variant}.svg?v=33`);
    await expect.poll(()=>tree.locator('.ft-img').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
    await expect(tree.locator('.ft-saved')).toContainText(/15\s*000/);
  }
  await tree.locator('.ft-more').click();
  await expect(tree.locator('.ft-details')).toBeVisible();
  await expect(tree.locator('.ft-flow')).toContainText('50%');
  const before=await page.evaluate(()=>({tx:localStorage.getItem('fp_local_tx'),balance:localStorage.getItem('fp_balance')}));
  await page.evaluate(()=>{state.goal.saved=50000;persistAll();});
  await expect(tree.locator('.ft-sub')).toContainText('100%');
  await expect(tree).toHaveAttribute('data-tree-variant','oak');
  expect(await page.evaluate(()=>({tx:localStorage.getItem('fp_local_tx'),balance:localStorage.getItem('fp_balance')}))).toEqual(before);
  await tree.locator('.ft-topup').focus();await page.keyboard.press('Enter');
  await expect(page.locator('#modal-goal-detail')).toBeVisible();await page.evaluate(()=>closeModals());
});

test('My tree breeze runs indefinitely without restarting on data refresh and respects motion/visibility', async ({ page }) => {
  await openApp(page,true);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});
  const tree=page.locator('#filely-financial-tree');await tree.scrollIntoViewIfNeeded();
  await expect(tree).toHaveAttribute('data-animation-paused','false');
  const breeze=tree.locator('.ft-art-motion');
  await expect.poll(()=>breeze.evaluate(el=>getComputedStyle(el).animationIterationCount)).toBe('infinite');
  await breeze.evaluate(el=>{window.treeAnimation=el.getAnimations()[0];window.treeAnimationTime=window.treeAnimation.currentTime;});
  await expect.poll(()=>page.evaluate(()=>window.treeAnimation.currentTime>window.treeAnimationTime+150)).toBe(true);
  await page.evaluate(()=>{FilelyFinancialTree.refresh();FilelyFinancialTree.refresh();});
  await expect.poll(()=>breeze.evaluate(el=>el.getAnimations()[0]===window.treeAnimation)).toBe(true);
  await page.locator('[data-nav="calendar"]').click();
  await expect(tree).toHaveAttribute('data-animation-paused','true');
  expect(await breeze.evaluate(el=>getComputedStyle(el).animationPlayState)).toBe('paused');
  await page.locator('[data-nav="home"]').click();await tree.scrollIntoViewIfNeeded();
  await expect(tree).toHaveAttribute('data-animation-paused','false');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect.poll(()=>breeze.evaluate(el=>el.getAnimations().length)).toBe(0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();});
  await expect.poll(()=>breeze.evaluate(el=>el.getAnimations().length)).toBe(0);
});

test('My tree keeps details/focus and hides amounts in Stealth; failed SVG has a visible fallback', async ({ page }) => {
  await openApp(page,true);
  const tree=page.locator('#filely-financial-tree');
  await tree.locator('.ft-more').click();
  await page.evaluate(()=>{state.goal={saved:12345,target:50000};persistAll();});
  await expect(tree.locator('.ft-saved')).toContainText(/12\s*345/);
  await expect(tree.locator('.ft-more')).toBeFocused();
  await expect(tree.locator('.ft-details')).toBeVisible();
  await page.evaluate(()=>toggleStealthMode(true));
  await expect(tree.locator('.ft-saved')).toHaveText('•••••• ₽');
  await expect(tree.locator('.ft-flow')).toHaveText('Суммы и доля расходов скрыты режимом «Стелс».');
  await expect(tree.locator('.ft-sub')).toContainText('Суммы скрыты');
  await page.route('**/assets/trees/birch.svg*',route=>route.abort());
  await setTreeFlow(page,11000);
  await expect(tree.locator('.ft-svg-art')).toBeVisible();
  await expect(tree.locator('.ft-img')).toBeHidden();
});

test('My tree fits all species at 320px in both styles/modes and survives DOM remount', async ({ page }) => {
  await openApp(page);
  await page.setViewportSize({width:320,height:700});
  const tree=page.locator('#filely-financial-tree');
  for(const style of ['forest','sapphire']) for(const mode of ['light','dark']) {
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});
    for(const [expense,variant] of [[null,'sapling'],[11000,'birch'],[9500,'spruce'],[8000,'maple'],[5000,'oak']]) {
      await setTreeFlow(page,expense);await expect(tree).toHaveAttribute('data-tree-variant',variant);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
    }
  }
  await page.evaluate(()=>document.getElementById('filely-financial-tree-mount').remove());
  await expect(tree).toBeAttached();
  await expect(tree).toHaveAttribute('data-tree-variant','oak');
  await tree.locator('.ft-topup').click();await expect(page.locator('#modal-goal-detail')).toBeVisible();
});

test('My tree follows another tab and direct storage clearing without changing balances', async ({ page, context }) => {
  await openApp(page,true);
  const other=await context.newPage();await localOnly(other);await other.goto('/');
  await expect(other.locator('#filely-financial-tree')).toHaveAttribute('data-tree-variant','oak');
  await setTreeFlow(page,9500);
  const balance=await page.evaluate(()=>localStorage.getItem('fp_balance'));
  await expect(other.locator('#filely-financial-tree')).toHaveAttribute('data-tree-variant','spruce');
  await page.evaluate(()=>{document.getElementById('filely-financial-tree-mount').style.display='none';});
  await expect(page.locator('#filely-financial-tree-mount')).not.toHaveCSS('display','none');
  await other.evaluate(()=>{localStorage.removeItem('fp_local_tx');FilelyFinancialTree.refresh();});
  await expect(page.locator('#filely-financial-tree')).toHaveAttribute('data-tree-variant','sapling');
  expect(await page.evaluate(()=>localStorage.getItem('fp_balance'))).toBe(balance);
  await other.close();
});

test('Warm Growth is a third persistent choice without changing money or theme mode',async({page})=>{
  await openApp(page,true);
  await page.evaluate(()=>setTheme('light'));
  const before=await page.evaluate(()=>({tx:localStorage.getItem('fp_local_tx'),balance:localStorage.getItem('fp_balance'),mode:localStorage.getItem('fp_theme')}));
  await page.locator('[data-nav="settings"]').click();
  await page.locator('#settings-appearance > summary').click();
  const growth=page.locator('[data-visual-style-choice="growth"]');
  await growth.focus();await page.keyboard.press('Enter');
  await expect(growth).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('[data-visual-style-choice][aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('data-visual-style','growth');
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#FAF5ED');
  expect(await page.evaluate(()=>({tx:localStorage.getItem('fp_local_tx'),balance:localStorage.getItem('fp_balance'),mode:localStorage.getItem('fp_theme')}))).toEqual(before);
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-visual-style','growth');
  await page.evaluate(()=>setTheme('dark'));
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#1C252B');
  await page.evaluate(()=>setVisualStyle('forest'));
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('Warm Growth contrast, semantic colours and responsive screens',async({page})=>{
  await openApp(page,true);
  const contrast=(a,b)=>{
    const lum=hex=>{const rgb=hex.startsWith('#')?hex.slice(1).match(/../g).map(x=>parseInt(x,16)):hex.match(/[\d.]+/g).slice(0,3).map(Number);return rgb.map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;}).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);};
    const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
  };
  for(const mode of ['light','dark']){
    await page.evaluate(mode=>{setVisualStyle('forest');setTheme(mode);},mode);
    const semantics=await page.evaluate(()=>{const c=getComputedStyle(document.documentElement);return ['--income','--expense','--danger'].map(x=>c.getPropertyValue(x).trim());});
    await page.evaluate(()=>setVisualStyle('growth'));
    const tokens=await page.evaluate(()=>{const c=getComputedStyle(document.documentElement);return Object.fromEntries(['--bg-canvas','--surface-1','--text-primary','--text-secondary','--text-muted','--accent','--accent-ink','--budget-bg','--budget-ink','--hero-bg','--hero-ink','--hero-secondary','--sage-bg','--sage-ink','--income','--expense','--danger'].map(x=>[x,c.getPropertyValue(x).trim()]));});
    expect(['--income','--expense','--danger'].map(x=>tokens[x])).toEqual(semantics);
    for(const fg of ['--text-primary','--text-secondary','--text-muted','--accent'])for(const bg of ['--bg-canvas','--surface-1'])expect(contrast(tokens[fg],tokens[bg])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['--accent-ink'],tokens['--accent'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['--budget-ink'],tokens['--budget-bg'])).toBeGreaterThanOrEqual(4.5);
    for(const fg of ['--hero-ink','--hero-secondary'])expect(contrast(tokens[fg],tokens['--hero-bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokens['--sage-ink'],tokens['--sage-bg'])).toBeGreaterThanOrEqual(4.5);
    expect(new Set(['--hero-bg','--budget-bg','--sage-bg'].map(x=>tokens[x])).size).toBe(3);
    const hero=await page.locator('#hero-balance-card').evaluate(el=>{const c=getComputedStyle(el);return {risk:c.getPropertyValue('--danger').trim(),accent:c.getPropertyValue('--accent').trim()};});
    expect(contrast(hero.risk,tokens['--hero-bg'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(hero.accent,tokens['--hero-bg'])).toBeGreaterThanOrEqual(4.5);
    for(const width of [320,390,448]){
      await page.setViewportSize({width,height:844});
      for(const tab of ['home','calendar','analytics','settings']){
        await page.locator(`[data-nav="${tab}"]`).click();
        expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      }
      await page.locator('#settings-appearance > summary').evaluate(el=>{el.parentElement.open=true;});
      await expect(page.locator('[data-visual-style-choice="growth"]')).toBeVisible();
    }
  }
});

test('Warm Growth home preview in both modes',async({page})=>{
  await openApp(page,true);
  await page.evaluate(()=>{setVisualStyle('growth');setTheme('light');});
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(250, 245, 237)');
  await page.screenshot({path:'docs/growth-light-preview.png'});
  await page.evaluate(()=>setTheme('dark'));
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(28, 37, 43)');
  await page.screenshot({path:'docs/growth-dark-preview.png'});
});

test('figure hierarchy retains kopecks, negative signs and complete accessible amounts',async({page})=>{
  await openApp(page);
  await page.evaluate(()=>{state.balance=-12345.67;renderAll(false);});
  const amount=page.locator('#hero-balance');
  await expect(amount).toHaveAttribute('aria-label','-12 345,67 ₽');
  await expect(amount.locator('.number-minor')).toHaveText(',67');
  await expect(amount.locator('.number-currency')).toHaveText('₽');
  const sizes=await amount.evaluate(el=>({major:parseFloat(getComputedStyle(el).fontSize),minor:parseFloat(getComputedStyle(el.querySelector('.number-minor')).fontSize),currency:parseFloat(getComputedStyle(el.querySelector('.number-currency')).fontSize)}));
  expect(sizes.minor).toBeLessThan(sizes.major);expect(sizes.currency).toBeLessThan(sizes.minor);
  await page.evaluate(()=>{state.balance=0;renderAll(false);});
  await expect(amount).toHaveAttribute('aria-label','0 ₽');await expect(amount.locator('.number-minor')).toHaveCount(0);
  await page.evaluate(()=>toggleStealthMode(true));await expect(amount).toHaveCSS('filter','blur(7.5px)');await expect(amount).toHaveAttribute('aria-label','Сумма скрыта');
});

test('large figures fit 320px across all three palettes and both modes',async({page})=>{
  await openApp(page);await page.setViewportSize({width:320,height:844});
  await page.evaluate(()=>document.fonts.ready);
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);state.balance=999999999999.99;state.goal.saved=0;state.bills=[];renderAll(false);},{style,mode});
    await expect(page.locator('#hero-balance')).toHaveAttribute('aria-label','999 999 999 999,99 ₽');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const id of ['hero-balance','hero-daily-left'])expect(await page.locator('#'+id).evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
});

test('local numeral font and preview',async({page})=>{
  await openApp(page,true);
  await page.evaluate(async()=>{setVisualStyle('growth');setTheme('light');state.balance=128450.75;renderAll(false);await document.fonts.load('650 42px "Fintex Figures"');});
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(250, 245, 237)');
  expect(await page.evaluate(()=>document.fonts.check('650 42px "Fintex Figures"'))).toBe(true);
  await page.screenshot({path:'docs/numerals-preview.png'});
});

test('My tree has a visibly stronger layered breeze and all layers obey motion preferences',async({page})=>{
  await openApp(page,true);await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});
  const tree=page.locator('#filely-financial-tree');await tree.scrollIntoViewIfNeeded();
  await expect(tree).toHaveAttribute('data-animation-paused','false');
  await expect(tree.locator('.ft-wind-leaf')).toHaveCount(3);
  const before=await page.evaluate(()=>localStorage.getItem('fp_local_tx'));
  const angles=await tree.locator('.ft-art-motion').evaluate(el=>{
    const animation=el.getAnimations()[0];animation.pause();
    const angle=time=>{animation.currentTime=time;const m=new DOMMatrix(getComputedStyle(el).transform);return Math.atan2(m.b,m.a)*180/Math.PI;};
    const result={start:angle(0),end:angle(2300),duration:animation.effect.getTiming().duration};animation.play();return result;
  });
  expect(angles.end-angles.start).toBeGreaterThan(9);expect(angles.duration).toBe(4600);
  await expect(tree.locator('.ft-img')).toHaveCSS('animation-name','ft-tree-flex');
  await expect(tree.locator('.ft-wind-leaf').first()).toHaveCSS('animation-name','ft-leaf-drift');
  await page.locator('[data-nav="calendar"]').click();
  await expect(tree).toHaveAttribute('data-animation-paused','true');
  for(const selector of ['.ft-art-motion','.ft-img','.ft-aura','.ft-wind-leaf'])for(const el of await tree.locator(selector).all())await expect(el).toHaveCSS('animation-play-state','paused');
  await page.locator('[data-nav="home"]').click();await tree.scrollIntoViewIfNeeded();
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await tree.evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();});
  expect(await tree.evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
  expect(await page.evaluate(()=>localStorage.getItem('fp_local_tx'))).toBe(before);
});

test('My tree stronger wind fits all species at both sway extremes on a narrow screen',async({page})=>{
  await openApp(page,true);await page.setViewportSize({width:320,height:740});await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});
  const tree=page.locator('#filely-financial-tree');
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});
    for(const [expense,variant] of [[null,'sapling'],[11000,'birch'],[9500,'spruce'],[8000,'maple'],[5000,'oak']]){
      await setTreeFlow(page,expense);await expect(tree).toHaveAttribute('data-tree-variant',variant);await tree.scrollIntoViewIfNeeded();
      for(const time of [0,2300]){
        await tree.evaluate((el,time)=>el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=time;}),time);
        expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
      }
    }
  }
  await tree.locator('.ft-topup').click();await expect(page.locator('#modal-goal-detail')).toBeVisible();
});
test('tree leaves fall down with varied timing, remain bounded and obey all animation controls',async({page})=>{
  await openApp(page,true);await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});const tree=page.locator('#filely-financial-tree');await tree.scrollIntoViewIfNeeded();await expect(tree).toHaveAttribute('data-animation-paused','false');
  const before=await page.evaluate(()=>JSON.stringify({transactions:state.transactions,goal:state.goal}));const leaves=tree.locator('.ft-falling-leaf');await expect(leaves).toHaveCount(6);await expect(tree.locator('.ft-falling-leaves')).toHaveAttribute('aria-hidden','true');
  const result=await leaves.first().evaluate(el=>{const a=el.getAnimations()[0];a.pause();a.effect.updateTiming({delay:0});a.currentTime=0;const start=new DOMMatrix(getComputedStyle(el).transform);a.currentTime=a.effect.getTiming().duration*.82;const end=new DOMMatrix(getComputedStyle(el).transform);a.play();return {dy:end.m42-start.m42,opacity:Number(getComputedStyle(el).opacity)};});expect(result.dy).toBeGreaterThan(80);expect(result.opacity).toBeGreaterThan(0);
  expect(new Set(await leaves.evaluateAll(els=>els.map(el=>getComputedStyle(el).animationDuration))).size).toBeGreaterThan(3);
  await page.locator('[data-nav="calendar"]').click();for(const leaf of await leaves.all())await expect(leaf).toHaveCSS('animation-play-state','paused');
  await page.locator('[data-nav="home"]').click();await tree.scrollIntoViewIfNeeded();await page.setViewportSize({width:320,height:740});for(const time of [0,1800,3800,6000]){await tree.evaluate((el,t)=>el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t;}),time);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);}
  await page.emulateMedia({reducedMotion:'reduce'});expect(await tree.evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);await expect(tree.locator('.ft-falling-leaves')).toBeHidden();
  await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();});await expect(tree.locator('.ft-falling-leaves')).toBeHidden();expect(await tree.evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);expect(await page.evaluate(()=>JSON.stringify({transactions:state.transactions,goal:state.goal}))).toBe(before);
});
