const {test,expect}=require('@playwright/test');
async function open(page){
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(()=>{Object.entries({fp_onboarded:'1',fp_name:'Анна',fp_motion:'0',fp_visual_style:'forest',fp_theme:'light',fp_balance:'75420.51',fp_local_tx:'[]'}).forEach(([k,v])=>localStorage.setItem(k,v));});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexAnalyticsPro&&!!window.FintexGoals);await page.evaluate(()=>dismissReturningSplash());await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});
  await page.clock.install();
}
async function frame(page,time){await page.locator('#returning-splash').evaluate((el,t)=>{el.getAnimations({subtree:true}).forEach(a=>{a.pause();a.currentTime=t;});},time);}
const snapshot=p=>p.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,goal:state.goal}));
test('botanical sequence has bounded finite layers, readable branding and no fabricated loading',async({page})=>{
  await open(page);const before=await snapshot(page);await page.evaluate(()=>replayMotionSplash());await frame(page,150);
  await expect(page.locator('.sprout-brand')).toHaveCSS('opacity','0');await expect(page.locator('.sprout-left')).toHaveCSS('opacity','0');
  await frame(page,3600);await expect(page.locator('.sprout-brand')).toHaveCSS('opacity','1');await expect(page.locator('.sprout-name')).toHaveText('Fintex');await expect(page.locator('#sprout-title')).toHaveAttribute('aria-label','Fintex');await expect(page.locator('#sprout-tagline')).toHaveCSS('opacity','1');await expect(page.locator('.sprout-logo')).toBeVisible();
  await expect(page.locator('.sprout-mote')).toHaveCount(6);const timing=await page.locator('#returning-splash').evaluate(el=>el.getAnimations({subtree:true}).map(a=>a.effect.getTiming()));expect(timing.length).toBeGreaterThan(18);expect(timing.every(t=>t.iterations===1&&t.duration+t.delay<=4600)).toBe(true);
  await expect(page.locator('#returning-splash')).not.toContainText(/₽|Анна|загруз|процент/i);expect(await snapshot(page)).toBe(before);
});
test('late exit hands the actual brand mark to the header and always cleans up within the existing exit budget',async({page})=>{
  await open(page);await page.evaluate(()=>replayMotionSplash());await frame(page,3600);await page.evaluate(()=>FintexEntrance.dismiss());await expect(page.locator('.sprout-handoff')).toHaveCount(1);await expect(page.locator('.sprout-handoff')).toHaveAttribute('aria-hidden','true');
  const flight=await page.locator('.sprout-handoff').evaluate(el=>{const a=el.getAnimations()[0];return {id:a.id,duration:a.effect.getTiming().duration,iterations:a.effect.getTiming().iterations};});expect(flight).toEqual({id:'fintex-entrance-handoff',duration:380,iterations:1});
  await page.locator('.sprout-handoff').evaluate(el=>{const a=el.getAnimations()[0];a.pause();a.currentTime=380;});const end=await page.locator('.sprout-handoff').boundingBox(),target=await page.locator('#home-header .fintex-brand-logo').boundingBox();expect(end.x).toBeCloseTo(target.x,1);expect(end.y).toBeCloseTo(target.y,1);expect(end.width).toBeCloseTo(target.width,1);
  await page.clock.runFor(410);await expect(page.locator('#returning-splash')).toBeHidden();await expect(page.locator('.sprout-handoff')).toHaveCount(0);await expect(page.locator('#hdr-plus-btn')).toBeFocused();
});
test('early skip, settings replay and offscreen header use a clean fade instead of flying to a hidden target',async({page})=>{
  await open(page);await page.evaluate(()=>replayMotionSplash());await frame(page,250);await page.locator('#sprout-skip').click();await expect(page.locator('.sprout-handoff')).toHaveCount(0);await page.clock.runFor(410);
  await page.evaluate(()=>{goTab('settings');replayMotionSplash();});await frame(page,3600);await page.keyboard.press('Escape');await expect(page.locator('.sprout-handoff')).toHaveCount(0);await page.clock.runFor(410);await expect(page.locator('#returning-splash')).toBeHidden();
  await page.evaluate(()=>{goTab('home');scrollTo({top:500,behavior:'instant'});replayMotionSplash();});await frame(page,3600);await page.evaluate(()=>FintexEntrance.dismiss());await expect(page.locator('.sprout-handoff')).toHaveCount(0);await page.clock.runFor(410);
});
test('preference changes and relaunch during handoff cancel all transient elements and preserve prior inert state',async({page})=>{
  await open(page);await page.evaluate(()=>{document.querySelector('main').inert=true;replayMotionSplash();});await frame(page,3600);await page.evaluate(()=>FintexEntrance.dismiss());await expect(page.locator('.sprout-handoff')).toHaveCount(1);
  await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();});await expect(page.locator('#returning-splash')).toBeHidden();await expect(page.locator('.sprout-handoff')).toHaveCount(0);expect(await page.locator('main').evaluate(el=>el.inert)).toBe(true);
  await page.evaluate(()=>{document.querySelector('main').inert=false;localStorage.setItem('fp_motion','1');applyMotionPref();replayMotionSplash();});await frame(page,3600);await page.evaluate(()=>{FintexEntrance.dismiss();replayMotionSplash();});await expect(page.locator('.sprout-handoff')).toHaveCount(0);await page.clock.runFor(450);await expect(page.locator('#returning-splash')).toBeVisible();await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('#returning-splash')).toBeHidden();
});
test('stage fits short screens and all complementary palettes; final brand sequence has reviewed previews',async({page})=>{
  await open(page);
  for(const [width,height]of [[320,568],[390,844],[600,360]]){
    await page.setViewportSize({width,height});for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
      await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);replayMotionSplash();},{style,mode});await frame(page,3700);const title=await page.locator('#sprout-title').boundingBox(),skip=await page.locator('#sprout-skip').boundingBox();expect(title.y).toBeGreaterThan(skip.y+skip.height);expect(title.y+title.height).toBeLessThan(height-35);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await page.evaluate(()=>FintexEntrance.dismiss(true));
    }
  }
  await page.setViewportSize({width:390,height:844});for(const mode of ['light','dark']){
    await page.evaluate(mode=>{setVisualStyle('forest');setTheme(mode);replayMotionSplash();},mode);await frame(page,3700);await page.locator('.sprout-logo').evaluate(el=>el.decode());await page.screenshot({path:`docs/entrance-${mode}-preview.png`});await page.evaluate(()=>FintexEntrance.dismiss(true));
  }
});
