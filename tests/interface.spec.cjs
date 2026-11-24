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
