const {test,expect}=require('@playwright/test');
async function open(page){
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(()=>{Object.entries({fp_onboarded:'1',fp_name:'Анна',fp_motion:'0',fp_visual_style:'forest',fp_theme:'light',fp_balance:'75420.51',fp_local_tx:'[]'}).forEach(([k,v])=>localStorage.setItem(k,v));});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexAnalyticsPro&&!!window.FilelyFinancialTree);await page.evaluate(()=>dismissReturningSplash());
  await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});
}
const financial=p=>p.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,goal:state.goal,storedTx:localStorage.getItem('fp_local_tx')}));
async function style(page,name){await page.evaluate(name=>setVisualStyle(name),name);await expect(page.locator('html')).toHaveAttribute('data-visual-style',name);}
async function pauseScene(page){await page.evaluate(()=>document.getAnimations().forEach(a=>{a.pause();a.currentTime=3700;}));}
test('each theme has its own weather, with a fixed decorative budget and live switching without ledger writes',async({page})=>{
  await open(page);const before=await financial(page);const layer=page.locator('#theme-atmosphere'),particle=layer.locator('i').first();
  await expect(layer).toHaveAttribute('aria-hidden','true');await expect(layer).toHaveCSS('pointer-events','none');expect(await layer.evaluate(el=>el.inert)).toBe(true);await expect(layer.locator('i')).toHaveCount(14);await expect(layer).toHaveCSS('visibility','visible');
  await layer.evaluate(el=>{window.originalWeather=el;window.originalParticle=el.firstElementChild;});
  for(let i=0;i<3;i++)for(const [name,animation,season]of [['sapphire','themeSnow','winter'],['growth','themePetal','blossom'],['forest','themeLeaf','leaf']]){
    await style(page,name);await expect(particle).toHaveCSS('animation-name',animation);await expect(particle).toHaveCSS('animation-play-state','running');await expect(page.locator('#filely-financial-tree')).toHaveAttribute('data-season',season);expect(await layer.evaluate(el=>el===window.originalWeather&&el.firstElementChild===window.originalParticle)).toBe(true);
  }
  expect(await financial(page)).toBe(before);await expect(page.locator('#theme-atmosphere')).toHaveCount(1);
});
test('Lagoon shows snow on all five actual species; switching season preserves species and financial meaning',async({page})=>{
  await open(page);await style(page,'sapphire');const tree=page.locator('#filely-financial-tree');
  for(const [amount,variant]of [[null,'sapling'],[11000,'birch'],[9500,'spruce'],[8000,'maple'],[5000,'oak']]){
    await page.evaluate(amount=>{state.transactions=amount===null?[]:[{id:'winter-income',type:'income',amount:10000,date:TODAY},{id:'winter-expense',type:'expense',amount,date:TODAY}];persistAll();},amount);
    await expect(tree).toHaveAttribute('data-tree-variant',variant);await expect(tree.locator('.ft-img')).toHaveAttribute('src',`./assets/trees/winter/${variant}.svg?v=62`);await expect.poll(()=>tree.locator('.ft-img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    const snow=await page.request.get(`/assets/trees/winter/${variant}.svg?v=62`);expect(snow.ok()).toBe(true);expect(await snow.text()).toContain('id="winter-snow"');const before=await financial(page);
    for(const name of ['forest','growth']){await style(page,name);await expect(tree.locator('.ft-img')).toHaveAttribute('src',`./assets/trees/${variant}.svg?v=33`);await expect(tree).toHaveAttribute('data-tree-variant',variant);expect(await financial(page)).toBe(before);}
    await style(page,'sapphire');await expect(tree.locator('.ft-img')).toHaveAttribute('src',`./assets/trees/winter/${variant}.svg?v=62`);
  }
});
test('snow and petals stop for motion preferences, backgrounding, splash and dialogs; static snowy branches remain',async({page})=>{
  await open(page);await style(page,'sapphire');const weather=page.locator('#theme-atmosphere'),particle=weather.locator('i').first(),tree=page.locator('#filely-financial-tree');await tree.scrollIntoViewIfNeeded();
  await expect(tree.locator('.ft-falling-leaf').first()).toHaveCSS('animation-name','themeSnow');await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();});await expect(weather).toBeHidden();await expect(particle).toHaveCSS('animation-name','none');await expect(tree.locator('.ft-img')).toBeVisible();await expect(tree.locator('.ft-falling-leaves')).toBeHidden();
  await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});await page.emulateMedia({reducedMotion:'reduce'});await expect(weather).toBeHidden();await expect(particle).toHaveCSS('animation-name','none');await expect(tree.locator('.ft-img')).toBeVisible();
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(weather).toBeVisible();await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(particle).toHaveCSS('animation-play-state','paused');
  await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));replayMotionSplash();});await expect(weather).toBeHidden();await expect(particle).toHaveCSS('animation-play-state','paused');await page.evaluate(()=>FintexEntrance.dismiss(true));await expect(weather).toBeVisible();
  await page.evaluate(()=>openGoalDetailsModal());await expect(weather).toBeHidden();await expect(particle).toHaveCSS('animation-play-state','paused');await page.evaluate(()=>closeModals());await expect(weather).toBeVisible();
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(particle).toHaveCSS('animation-play-state','paused');await page.evaluate(()=>window.dispatchEvent(new Event('pageshow')));await expect(particle).toHaveCSS('animation-play-state','running');
});
test('seasonal entrance stays finite and skippable, with frost only in Lagoon',async({page})=>{
  await open(page);await page.clock.install();
  for(const [name,animation]of [['sapphire','sproutSnow'],['growth','sproutPetal'],['forest','sproutMote']]){
    await style(page,name);await page.evaluate(()=>replayMotionSplash());await expect(page.locator('.sprout-mote').first()).toHaveCSS('animation-name',animation);if(name==='sapphire')await expect(page.locator('.sprout-season-snow')).toBeVisible();else await expect(page.locator('.sprout-season-snow')).toBeHidden();
    expect(await page.locator('#returning-splash').evaluate(el=>el.getAnimations({subtree:true}).every(a=>{const t=a.effect.getTiming();return t.iterations===1&&t.duration+t.delay<=4600;}))).toBe(true);
    await page.clock.runFor(5100);await expect(page.locator('#returning-splash')).toBeHidden();await expect(page.locator('.sprout-handoff')).toHaveCount(0);
  }
});
test('weather cannot catch taps or overflow narrow screens; six palettes get matching tree and entrance previews',async({page})=>{
  await open(page);const before=await financial(page);
  for(const width of [320,390]){await page.setViewportSize({width,height:844});for(const name of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({name,mode})=>{setVisualStyle(name);setTheme(mode);}, {name,mode});await expect(page.locator('#filely-financial-tree')).toHaveAttribute('data-season',name==='sapphire'?'winter':name==='growth'?'blossom':'leaf');expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    await page.locator('[data-nav="settings"]').click();await expect(page.locator('#view-settings')).toBeVisible();await page.locator('[data-nav="home"]').click();
    if(width===390){await page.locator('#filely-financial-tree').scrollIntoViewIfNeeded();await page.locator('.ft-img').evaluate(el=>el.decode());await pauseScene(page);await page.locator('#filely-financial-tree').screenshot({path:`.cache/v62-tree-${name}-${mode}.png`,style:'body > nav, #capture-fab { visibility: hidden !important; }'});await page.evaluate(()=>{scrollTo({top:0,behavior:'instant'});replayMotionSplash();});await pauseScene(page);await page.screenshot({path:`.cache/v62-entrance-${name}-${mode}.png`});await page.evaluate(()=>FintexEntrance.dismiss(true));}
  }}expect(await financial(page)).toBe(before);
});
test('winter asset failures retain a themed local fallback and can recover on season switch',async({page})=>{
  await open(page);await page.route('**/assets/trees/winter/*.svg*',r=>r.abort());await style(page,'sapphire');await expect(page.locator('.ft-img')).toBeHidden();await expect(page.locator('.ft-svg-art')).toBeVisible();await expect(page.locator('.ft-fallback-snow')).toBeVisible();await style(page,'forest');await expect(page.locator('.ft-img')).toBeVisible();await expect(page.locator('.ft-svg-art')).toHaveCount(0);
});
