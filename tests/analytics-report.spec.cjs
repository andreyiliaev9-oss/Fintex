const {test,expect}=require('@playwright/test');
const M=require('../finance-math.js');
async function open(page,{empty=false}={}){
 await page.clock.install({time:new Date('2026-11-24T12:00:00Z')});
 await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
 const tx=[];if(!empty){for(let i=0;i<60;i++)tx.push({id:'e'+i,date:M.shift('2026-11-24',-i),amount:[540,1320,780,2100,460,920,360][i%7],type:'expense',merchant:['Пятёрочка','Кафе','Метро','Ozon'][i%4],category:['food','cafe','taxi','shop'][i%4]});tx.push({id:'salary',date:'2026-11-05',amount:98000,type:'income',merchant:'Зарплата'},{id:'old-salary',date:'2026-10-06',amount:96000,type:'income',merchant:'Зарплата'});}
 await page.addInitScript(tx=>{Object.entries({fp_onboarded:'1',fp_tour_v1:'complete',fp_help_v1:'["analytics"]',fp_name:'Анна',fp_motion:'0',fp_balance:'74580',fp_visual_style:'forest',fp_theme:'light',fp_local_tx:JSON.stringify(tx)}).forEach(([k,v])=>localStorage.setItem(k,v));},tx);
 await page.goto('/');await page.waitForFunction(()=>!!window.FintexAnalyticsPro);await page.evaluate(()=>{dismissReturningSplash();goTab('analytics');});
}
const ledger=p=>p.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,stored:localStorage.getItem('fp_local_tx')}));
test('report compares real nonoverlapping periods and keeps exact kopecks and signed differences',async({page})=>{
 await open(page,{empty:true});await page.evaluate(()=>{state.transactions=[{id:'a',date:'2026-11-24',type:'expense',amount:100.11,category:'food'},{id:'b',date:'2026-11-23',type:'income',amount:50.01},{id:'c',date:'2026-10-20',type:'expense',amount:10.1},{id:'d',date:'2026-10-19',type:'income',amount:200.01},{id:'ignore',date:'2026-11-24',type:'transfer',amount:999},{id:'future',date:'2026-12-01',type:'expense',amount:999}];FintexAnalyticsPro.render();});
 const before=await ledger(page);
 await expect(page.locator('[data-report-metric=expense] td').first()).toHaveText('100,11 ₽');await expect(page.locator('[data-report-metric=expense] td').last()).toHaveText('10,1 ₽');await expect(page.locator('[data-report-metric=net] td').first()).toHaveText('−50,1 ₽'.replace('−','-'));await expect(page.locator('[data-report-metric=net] td').last()).toHaveText('189,91 ₽');
 await page.locator('.ap-comparison summary').click();await expect(page.locator('.ap-comparison')).toContainText('26 окт 2026 г. — 24 нояб 2026 г.');await expect(page.locator('.ap-comparison')).toContainText('26 сент 2026 г. — 25 окт 2026 г.');
 for(const period of ['week','month','quarter','year']){await page.locator(`[data-period=${period}]`).click();await expect(page.locator('.report-totals tbody tr')).toHaveCount(3);}
 expect(await ledger(page)).toBe(before);
});
test('semantic category table reveals operations with keyboard and preserves focus without truncating amounts',async({page})=>{
 await open(page);const before=await ledger(page);const toggle=page.locator('[data-cat]').first();await toggle.focus();await page.keyboard.press('Enter');await expect(page.locator('[data-cat]').first()).toBeFocused();await expect(page.locator('[data-cat]').first()).toHaveAttribute('aria-expanded','true');const id=await page.locator('[data-cat]').first().getAttribute('aria-controls');await expect(page.locator('#'+id+' .ftx-ap-drill')).toBeVisible();await page.keyboard.press('Space');await expect(page.locator('[data-cat]').first()).toHaveAttribute('aria-expanded','false');await page.locator('[data-goto=categories]').click();await expect(page.locator('.report-categories')).toHaveCount(1);expect(await ledger(page)).toBe(before);
});
test('all report subviews fit 320px in six themes, including long names and large numbers',async({page})=>{
 await open(page);await page.evaluate(()=>{state.transactions.push({id:'big',date:'2026-11-24',type:'expense',amount:9876543210.12,category:'Очень длинная категория для проверки ширины'});FintexAnalyticsPro.render();});const before=await ledger(page);await page.setViewportSize({width:320,height:740});
 for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});for(const subtab of ['categories','rhythm','overview']){await page.locator(`[data-subtab=${subtab}]`).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);expect(await page.locator('.report-table').evaluateAll(tables=>tables.every(el=>el.scrollWidth<=el.clientWidth+1))).toBe(true);}}
 expect(await ledger(page)).toBe(before);
});
test('empty report never invents a percentage base and privacy hides complete tables and charts',async({page})=>{
 await open(page,{empty:true});await expect(page.locator('.report-variance')).toContainText('Нет базы сравнения');await expect(page.locator('.ap-trend-empty')).toBeVisible();await expect(page.locator('.ap-distribution')).toContainText('Добавьте расходы');const before=await ledger(page);await page.evaluate(()=>togglePrivacy());await expect(page.locator('.report-totals')).toBeHidden();await expect(page.locator('.report-variance')).toBeHidden();expect(await ledger(page)).toBe(before);
});
test('review professional report prototype in light and dark',async({page})=>{
 await open(page);await page.setViewportSize({width:390,height:1100});await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:'docs/analytics-report-light-preview.png',animations:'disabled'});await page.evaluate(()=>setTheme('dark'));await page.screenshot({path:'docs/analytics-report-dark-preview.png',animations:'disabled'});await page.evaluate(()=>{setTheme('light');document.querySelector('.ap-distribution').scrollIntoView({block:'start'});});await page.screenshot({path:'docs/analytics-report-categories-preview.png',animations:'disabled'});
});
