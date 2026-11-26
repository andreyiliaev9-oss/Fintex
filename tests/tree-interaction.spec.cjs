const {test,expect}=require('@playwright/test');
test.use({hasTouch:true});
async function open(page,style='forest'){
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(style=>{Object.entries({fp_onboarded:'1',fp_name:'Анна',fp_motion:'0',fp_visual_style:style,fp_theme:'light',fp_balance:'75420.51',fp_local_tx:'[]'}).forEach(([k,v])=>localStorage.setItem(k,v));},style);
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexAnalyticsPro&&!!window.FilelyFinancialTree);await page.evaluate(()=>dismissReturningSplash());
  await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});
  await page.locator('#filely-financial-tree').scrollIntoViewIfNeeded();await expect(page.locator('#filely-financial-tree')).toHaveAttribute('data-animation-paused','false');await page.clock.install();
}
const tree=p=>p.locator('#filely-financial-tree');
const button=p=>tree(p).locator('.ft-art-wrap');
async function combo(page){for(let i=0;i<4;i++)await button(page).tap();await expect(tree(page)).toHaveAttribute('data-tree-reaction','storm');}
const financial=p=>p.evaluate(()=>JSON.stringify({tx:localStorage.getItem('fp_local_tx'),balance:localStorage.getItem('fp_balance'),goal:localStorage.getItem('fp_goal'),state:{tx:state.transactions,goal:state.goal,balance:state.balance}}));
async function gone(page){await expect(page.locator('.ft-storm-layer,.ft-burst-layer,.ft-shed-art')).toHaveCount(0);await expect(tree(page)).not.toHaveAttribute('data-tree-reaction');await expect(tree(page)).not.toHaveAttribute('data-tap-charge');}
test('a real touch rustles instead of opening savings; four fast taps make one bounded storm and shed real branch snow',async({page})=>{
  await open(page,'sapphire');const before=await financial(page);await button(page).tap();await expect(tree(page)).toHaveAttribute('data-tap-charge','1');await expect(tree(page)).toHaveAttribute('data-tree-reaction','tap');await expect(page.locator('.ft-burst-particle')).toHaveCount(12);await expect(page.locator('#modal-goal-detail')).toBeHidden();await expect(page.locator('.ft-storm-layer')).toHaveCount(0);
  for(let i=0;i<3;i++)await button(page).tap();await expect(page.locator('.ft-burst-particle')).toHaveCount(36);await expect(page.locator('.ft-storm-particle')).toHaveCount(56);await expect(tree(page)).toHaveAttribute('data-snow-shed','true');await expect(page.locator('.ft-shed-art')).toHaveCount(1);await expect(page.locator('.ft-shed-art')).toHaveAttribute('src',/winter-bare\/sapling.svg\?v=64/);await expect(tree(page).locator('.ft-img')).toHaveCSS('opacity','0');await expect(tree(page).locator('.ft-reaction-status')).toContainText('Вьюга');
  const all=await page.locator('.ft-storm-layer,.ft-burst-layer').evaluateAll(els=>els.map(el=>({inert:el.inert,aria:el.getAttribute('aria-hidden'),pointer:getComputedStyle(el).pointerEvents})));expect(all.every(x=>x.inert&&x.aria==='true'&&x.pointer==='none')).toBe(true);
  expect(await page.locator('.ft-storm-particle').first().evaluate(el=>el.getAnimations()[0].effect.getTiming().iterations)).toBe(1);
  await page.clock.runFor(12500);await gone(page);await expect(tree(page).locator('.ft-img')).toHaveCSS('opacity','1');await expect(button(page)).toBeFocused();expect(await financial(page)).toBe(before);
  await tree(page).locator('.ft-topup').click();await expect(page.locator('#modal-goal-detail')).toBeVisible();
});
test('extra taps during a storm cannot stack particles, restart its timer, or write any finance data',async({page})=>{
  await open(page);const before=await financial(page);await combo(page);await page.locator('.ft-storm-layer').evaluate(el=>window.stormNode=el);await page.clock.runFor(1000);
  await page.evaluate(()=>{for(let i=0;i<200;i++)document.querySelector('.ft-art-wrap').click();});await expect(page.locator('.ft-storm-layer')).toHaveCount(1);await expect(page.locator('.ft-storm-particle')).toHaveCount(56);await expect(page.locator('.ft-burst-particle')).toHaveCount(36);expect(await page.locator('.ft-storm-layer').evaluate(el=>el===window.stormNode)).toBe(true);
  await page.clock.runFor(2100);await gone(page);expect(await financial(page)).toBe(before);await button(page).tap();await expect(tree(page)).toHaveAttribute('data-tap-charge','1');
});
test('slow taps and too-long series never accumulate into a storm; keyboard buttons work without held-key charging',async({page})=>{
  await open(page);await button(page).focus();await page.keyboard.press('Enter');await expect(tree(page)).toHaveAttribute('data-tap-charge','1');await button(page).dispatchEvent('keydown',{key:'Enter',repeat:true});await expect(tree(page)).toHaveAttribute('data-tap-charge','1');await page.clock.runFor(800);await expect(tree(page)).not.toHaveAttribute('data-tap-charge');await page.keyboard.press('Space');await expect(tree(page)).toHaveAttribute('data-tap-charge','1');
  await page.clock.runFor(800);await page.keyboard.press('Enter');for(let i=0;i<3;i++){await page.clock.runFor(700);await page.keyboard.press('Enter');}await expect(tree(page)).toHaveAttribute('data-tap-charge','1');await expect(page.locator('.ft-storm-layer')).toHaveCount(0);await page.clock.runFor(1700);await gone(page);
});
test('scroll/cancel gestures do not shake the tree or accidentally open a financial action',async({page})=>{
  await open(page);await button(page).dispatchEvent('pointerdown',{pointerId:4,clientX:200,clientY:300});await button(page).dispatchEvent('pointermove',{pointerId:4,clientX:200,clientY:340});await button(page).dispatchEvent('click',{detail:1});await gone(page);
  await button(page).dispatchEvent('pointerdown',{pointerId:5,clientX:200,clientY:300});await button(page).dispatchEvent('pointercancel',{pointerId:5});await button(page).dispatchEvent('click',{detail:1});await gone(page);await expect(page.locator('#modal-goal-detail')).toBeHidden();
});
test('active reactions are cancelled immediately by theme, tab, motion, modal, background, resize and pagehide',async({page})=>{
  await open(page);
  const changes=[
    ()=>page.evaluate(()=>setVisualStyle('growth')),
    async()=>{await page.evaluate(()=>goTab('calendar'));await expect(tree(page)).toHaveAttribute('data-animation-paused','true');},
    ()=>page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();}),
    ()=>page.emulateMedia({reducedMotion:'reduce'}),
    ()=>page.evaluate(()=>openGoalDetailsModal()),
    ()=>page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));}),
    ()=>page.setViewportSize({width:360,height:780}),
    ()=>page.evaluate(()=>window.dispatchEvent(new Event('pagehide')))
  ];
  for(const change of changes){
    await page.evaluate(()=>{delete document.hidden;closeModals();setVisualStyle('sapphire');goTab('home');localStorage.setItem('fp_motion','1');applyMotionPref();});await page.emulateMedia({reducedMotion:'no-preference'});await tree(page).scrollIntoViewIfNeeded();await expect(tree(page)).toHaveAttribute('data-animation-paused','false');await combo(page);await change();await gone(page);await page.clock.runFor(3500);await gone(page);
  }
});
test('disabled/reduced motion taps do nothing, but the explicit savings button remains available',async({page})=>{
  await open(page);
  for(const mode of ['off','reduced']){
    await page.evaluate(mode=>{localStorage.setItem('fp_motion',mode==='off'?'0':'1');applyMotionPref();},mode);await page.emulateMedia({reducedMotion:mode==='reduced'?'reduce':'no-preference'});for(let i=0;i<5;i++)await button(page).tap();await gone(page);await expect(tree(page).locator('.ft-play-hint')).toContainText('Движение отключено');await expect(page.locator('#modal-goal-detail')).toBeHidden();
  }
  await tree(page).locator('.ft-topup').focus();await page.keyboard.press('Enter');await expect(page.locator('#modal-goal-detail')).toBeVisible();
});
test('all five winter species have bare branches during shedding; the model species and savings never change',async({page})=>{
  await open(page,'sapphire');
  for(const [amount,variant]of [[null,'sapling'],[11000,'birch'],[9500,'spruce'],[8000,'maple'],[5000,'oak']]){
    await page.evaluate(amount=>{state.transactions=amount===null?[]:[{id:'tap-income',type:'income',amount:10000,date:TODAY},{id:'tap-expense',type:'expense',amount,date:TODAY}];persistAll();},amount);await expect(tree(page)).toHaveAttribute('data-tree-variant',variant);const before=await financial(page);await combo(page);await expect(page.locator('.ft-shed-art')).toHaveAttribute('src',new RegExp(`winter-bare/${variant}.svg`));await expect(tree(page)).toHaveAttribute('data-tree-variant',variant);const response=await page.request.get(`/assets/trees/winter-bare/${variant}.svg?v=64`);expect(response.ok()).toBe(true);expect(await response.text()).not.toContain('id="winter-snow"');await page.clock.runFor(12500);await gone(page);expect(await financial(page)).toBe(before);
  }
});
test('all three thematic storms fit 320px in light/dark modes, keep taps pass-through and produce review previews',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:740});
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});await tree(page).scrollIntoViewIfNeeded();await combo(page);await expect(page.locator('.ft-storm-layer')).toHaveAttribute('data-season',style==='sapphire'?'snow':style==='growth'?'petal':'leaf');
    if(style==='sapphire')await expect(page.locator('.ft-shed-art')).toHaveCount(1);
    await page.evaluate(()=>document.getAnimations().filter(a=>a.id==='fintex-tree-reaction'||['ftTapFall','ftTapSnow'].includes(a.animationName)).forEach(a=>{a.pause();a.currentTime=800;}));expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
    expect(await page.locator('.ft-storm-layer').evaluate(el=>el.getBoundingClientRect().width)).toBe(320);await page.screenshot({path:`.cache/v64-storm-${style}-${mode}.png`});
    await page.locator('[data-nav="settings"]').tap();await expect(page.locator('#view-settings')).toBeVisible();await gone(page);await page.locator('[data-nav="home"]').tap();
  }
});
test('failed bare-snow artwork retains the original tree and still cleans up the blizzard',async({page})=>{
  await open(page,'sapphire');await page.route('**/assets/trees/winter-bare/*.svg*',r=>r.abort());await combo(page);await expect(page.locator('.ft-storm-particle')).toHaveCount(56);await expect(tree(page).locator('.ft-img')).toHaveCSS('opacity','1');await expect(tree(page).locator('.ft-img')).toBeVisible();await page.clock.runFor(12500);await gone(page);
});

test('scrolling the tree away and changing its cashflow species cancel the old reaction without delayed revival',async({page})=>{
  await open(page,'sapphire');await page.setViewportSize({width:390,height:400});await tree(page).scrollIntoViewIfNeeded();await expect(tree(page)).toHaveAttribute('data-animation-paused','false');await combo(page);await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await expect(tree(page)).toHaveAttribute('data-animation-paused','true');await gone(page);
  await tree(page).scrollIntoViewIfNeeded();await expect(tree(page)).toHaveAttribute('data-animation-paused','false');await combo(page);await page.evaluate(()=>{state.transactions=[{id:'new-income',type:'income',amount:10000,date:TODAY},{id:'new-expense',type:'expense',amount:5000,date:TODAY}];persistAll();});await expect(tree(page)).toHaveAttribute('data-tree-variant','oak');await gone(page);await page.clock.runFor(3500);await gone(page);await expect(tree(page).locator('.ft-img')).toHaveAttribute('src','./assets/trees/winter/oak.svg?v=62');
});
test('late bare-art decode after a theme switch cannot hide the new tree or revive a cancelled storm',async({page})=>{
  await open(page,'sapphire');let pending;await page.route('**/assets/trees/winter-bare/*.svg*',r=>{pending=r;});await combo(page);await expect.poll(()=>!!pending).toBe(true);await page.evaluate(()=>setVisualStyle('growth'));await gone(page);
  await pending.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280"><path d="M140 250V50" stroke="brown"/></svg>'});await page.clock.runFor(3500);await gone(page);await expect(tree(page).locator('.ft-img')).toHaveAttribute('src','./assets/trees/sapling.svg?v=33');await expect(tree(page).locator('.ft-img')).toHaveCSS('opacity','1');
});
