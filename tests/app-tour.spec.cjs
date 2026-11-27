const {test,expect}=require('@playwright/test');
const tour=p=>p.locator('#fintex-tour');
async function open(page,{fresh=false,pending=false}={}){
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(({fresh,pending})=>{if(sessionStorage.getItem('tour_fixture'))return;sessionStorage.setItem('tour_fixture','1');localStorage.setItem('fp_motion','0');if(!fresh)Object.entries({fp_name:'Анна',fp_onboarded:'1',fp_balance:'75420.51',fp_goal:JSON.stringify({title:'Подушка',saved:1000,target:10000}),fp_local_tx:JSON.stringify([{id:'tour-real',date:'2026-11-18',merchant:'Магазин',type:'expense',amount:350,category:'food'}])}).forEach(([k,v])=>localStorage.setItem(k,v));if(pending)localStorage.setItem('fp_tour_v1','pending');},{fresh,pending});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexTour&&!!window.FintexAnalyticsPro&&!!window.FilelyFinancialTree);
}
const snapshot=p=>p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k])=>!['fp_tour_v1','fp_tour_step_v1','fp_tour_step_v2','fp_help_v1'].includes(k)).sort(([a],[b])=>a.localeCompare(b)))));
async function ready(page,index){await expect(tour(page)).toBeVisible();await expect(tour(page)).toHaveAttribute('data-step',String(index));await expect(tour(page)).toHaveAttribute('data-ready','true');await page.evaluate(async()=>{await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);});}
async function next(page,index){await page.locator('#tour-next').click();await ready(page,index);}
async function replay(page){await page.locator('[data-nav=settings]').click();await page.locator('#tour-replay').click();await ready(page,0);}
test('new user gets a safe automatic tour only after successful first setup, and completion is remembered',async({page})=>{
  await open(page,{fresh:true});await expect(tour(page)).toBeHidden();await page.locator('#ob-skip-btn').click();await page.locator('#ob-next-btn').click();await expect(tour(page)).toBeHidden();await page.locator('#setup-name').fill('Мария');await page.locator('#setup-balance').fill('25000');await page.locator('#ob-next-btn').click();await ready(page,0);await expect(page.locator('#onboarding-screen')).toBeHidden();expect(await page.evaluate(()=>localStorage.getItem('fp_tour_v1'))).toBe('pending');
  const before=await snapshot(page);for(let i=1;i<24;i++)await next(page,i);await page.locator('#tour-next').click();await expect(tour(page)).toBeHidden();expect(await snapshot(page)).toBe(before);expect(await page.evaluate(()=>localStorage.getItem('fp_tour_v1'))).toBe('complete');await expect(page.locator('.nav-tab[aria-current=page]')).toHaveAttribute('data-nav','home');await expect(page.locator('#hdr-plus-btn')).toBeFocused();await page.reload();await page.waitForFunction(()=>!!window.FintexTour);await expect(tour(page)).toBeHidden();
});
test('existing users are not interrupted by an upgrade and can replay from a visible settings card without setup',async({page})=>{
  await open(page);await expect(tour(page)).toBeHidden();expect(await page.evaluate(()=>localStorage.getItem('fp_tour_v1'))).toBeNull();const before=await snapshot(page);await replay(page);await expect(page.locator('#setup-name')).toBeHidden();await page.locator('#tour-next').click();await ready(page,1);await page.locator('#tour-skip').click();await expect(tour(page)).toBeHidden();await expect(page.locator('.nav-tab[aria-current=page]')).toHaveAttribute('data-nav','settings');await expect(page.locator('#tour-replay')).toBeFocused();expect(await snapshot(page)).toBe(before);expect(await page.evaluate(()=>localStorage.getItem('fp_tour_v1'))).toBe('skipped');await page.locator('#tour-replay').click();await ready(page,0);
});
test('route switches actual sections, highlights non-overlapping targets, supports Back and never opens financial actions',async({page})=>{
  await open(page);await replay(page);const before=await snapshot(page);let rings=0;
  const tabs=['home','home','home','calendar','analytics','home','home','settings'];
  for(let i=0;i<8;i++){
    await ready(page,i);await expect(page.locator('.nav-tab[aria-current=page]')).toHaveAttribute('data-nav',tabs[i]);await expect(page.locator('.tour-progress')).toHaveAttribute('aria-valuenow',String(i+1));
    if(await tour(page).getAttribute('data-spotlight')==='true'){
      rings++;const a=await page.locator('.tour-focus').boundingBox(),b=await page.locator('.tour-panel').boundingBox();expect(a.y+a.height<=b.y-2||b.y+b.height<=a.y-2).toBe(true);expect(a.x).toBeGreaterThanOrEqual(0);expect(a.x+a.width).toBeLessThanOrEqual(390);
      await page.mouse.click(a.x+a.width/2,a.y+a.height/2);await expect(page.locator('dialog[open]')).toHaveCount(1);
    }
    if(i<7)await next(page,i+1);
  }
  expect(rings).toBeGreaterThanOrEqual(5);await page.locator('#tour-back').click();await ready(page,6);await page.locator('#tour-skip').click();expect(await snapshot(page)).toBe(before);await expect(page.locator('.modal-overlay:visible')).toHaveCount(0);
});
test('native modal keeps focus inside, Arrow keys navigate and Escape restores scroll, focus and original overflow',async({page})=>{
  await open(page);await page.locator('[data-nav=settings]').click();await page.locator('#tour-replay').scrollIntoViewIfNeeded();const original=await page.evaluate(()=>({scroll:scrollY,overflow:document.body.style.overflow}));await page.locator('#tour-replay').click();await ready(page,0);await expect(page.locator('#tour-title')).toBeFocused();
  for(let i=0;i<8;i++){await page.keyboard.press(i%2?'Shift+Tab':'Tab');expect(await tour(page).evaluate(el=>el.contains(document.activeElement))).toBe(true);}
  await page.keyboard.press('ArrowRight');await ready(page,1);await page.keyboard.press('ArrowLeft');await ready(page,0);await page.keyboard.press('Escape');await expect(tour(page)).toBeHidden();await expect(page.locator('#tour-replay')).toBeFocused();expect(await page.evaluate(()=>({scroll:scrollY,overflow:document.body.style.overflow}))).toEqual(original);
});
test('skipped tours stay skipped; pending new-user tours resume after reload and pagehide cleans up the modal',async({page})=>{
  await open(page,{pending:true});await ready(page,0);await page.locator('#tour-skip').click();await page.reload();await page.waitForFunction(()=>!!window.FintexTour);await expect(tour(page)).toBeHidden();await replay(page);await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));await expect(tour(page)).toBeHidden();expect(await page.evaluate(()=>document.documentElement.classList.contains('fintex-tour-open'))).toBe(false);expect(await page.evaluate(()=>document.body.style.overflow)).toBe('');
});
test('guide works in all palettes and short/narrow viewports, with a readable centered fallback when spotlight cannot fit',async({page})=>{
  test.setTimeout(90000); // 180 real steps across 18 viewport/palette combinations.
  await open(page);for(const [width,height]of [[320,568],[390,844],[600,360]]){await page.setViewportSize({width,height});for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});await replay(page);for(const i of [0,1,2,3,4,5,6,7]){
      await ready(page,i);const b=await page.locator('.tour-panel').boundingBox();expect(b.x).toBeGreaterThanOrEqual(0);expect(b.y).toBeGreaterThanOrEqual(0);expect(b.x+b.width).toBeLessThanOrEqual(width);expect(b.y+b.height).toBeLessThanOrEqual(height+1);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);expect(await page.locator('.tour-panel').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);if(i<7)await next(page,i+1);
    }await page.locator('#tour-skip').click();await expect(tour(page)).toBeHidden();
  }}
});
test('motion preference changes cancel the finite guide reveal, and blocked storage never prevents replay/skip',async({page})=>{
  await open(page);await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});await replay(page);expect(await tour(page).evaluate(el=>el.getAnimations({subtree:true}).every(a=>a.effect.getTiming().iterations===1))).toBe(true);await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>tour(page).evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);await next(page,1);expect(await tour(page).evaluate(el=>el.getAnimations({subtree:true}).length)).toBe(0);
  await page.evaluate(()=>{const real=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fp_tour_v1')throw Error('quota');return real.call(this,k,v);};});await page.locator('#tour-skip').click();await expect(tour(page)).toBeHidden();await page.locator('#tour-replay').click();await ready(page,0);await page.keyboard.press('Escape');await expect(tour(page)).toBeHidden();
});
test('missing late-loaded targets degrade gracefully and restarting an open guide does not duplicate dialogs',async({page})=>{
  await open(page);await replay(page);await page.evaluate(()=>{document.querySelector('#capture-fab')?.remove();document.querySelector('#hdr-plus-btn')?.remove();FintexTour.start();FintexTour.start();});await ready(page,0);await expect(tour(page)).toHaveCount(1);await next(page,1);await next(page,2);await expect(page.locator('#tour-title')).toHaveText('История операций');await page.keyboard.press('Escape');await expect(tour(page)).toBeHidden();
});
test('review previews show nearby hints on real sections',async({page})=>{
  await open(page);await page.evaluate(()=>setTheme('light'));await replay(page);await page.screenshot({path:'.cache/v71-tour-balance-light.png',animations:'disabled'});for(let i=1;i<=6;i++)await next(page,i);await page.evaluate(()=>setTheme('dark'));await page.screenshot({path:'.cache/v71-tour-tree-dark.png',animations:'disabled'});await page.locator('#tour-skip').click();
});

test('chapter map jumps directly to real sections and marks only visited chapters; Escape returns to the guide before closing it',async({page})=>{
  await open(page);const before=await snapshot(page);await replay(page);await page.locator('#tour-map-toggle').click();await expect(page.locator('#tour-map')).toBeVisible();await expect(page.locator('[data-tour-jump="0"]')).toBeFocused();await page.locator('[data-tour-jump="4"]').click();await ready(page,4);await expect(page.locator('.nav-tab[aria-current=page]')).toHaveAttribute('data-nav','analytics');await expect(page.locator('#tour-map')).toBeHidden();await page.locator('#tour-map-toggle').click();await expect(page.locator('[data-tour-jump][data-visited=true]')).toHaveCount(2);await expect(page.locator('[data-tour-jump="4"]')).toHaveAttribute('aria-current','step');await expect(page.locator('[data-tour-jump="3"]')).toHaveAttribute('data-visited','false');await page.keyboard.press('Escape');await expect(tour(page)).toBeVisible();await expect(page.locator('#tour-map')).toBeHidden();await expect(page.locator('#tour-map-toggle')).toBeFocused();await page.keyboard.press('Escape');await expect(tour(page)).toBeHidden();expect(await snapshot(page)).toBe(before);
});
test('unfinished first-visit tour remembers its exact chapter; skip clears checkpoint and replay starts from welcome',async({page})=>{
  await open(page,{pending:true});await ready(page,0);await page.locator('#tour-map-toggle').click();await page.locator('[data-tour-jump="5"]').click();await ready(page,5);expect(await page.evaluate(()=>localStorage.getItem('fp_tour_step_v2'))).toBe('goals');const before=await snapshot(page);await page.reload();await ready(page,5);await expect(page.locator('#tour-title')).toHaveText('Цели');expect(await snapshot(page)).toBe(before);await page.locator('#tour-skip').click();expect(await page.evaluate(()=>localStorage.getItem('fp_tour_step_v1'))).toBeNull();await replay(page);await ready(page,0);await page.locator('#tour-map-toggle').click();await expect(page.locator('[data-tour-jump][data-visited=true]')).toHaveCount(1);
});
test('invalid checkpoints are ignored and a rejected checkpoint write cannot break navigation',async({page})=>{
  await open(page);for(const value of ['-1','10','0.5','NaN','<script>','999999999','']){await page.evaluate(value=>{localStorage.setItem('fp_tour_v1','pending');localStorage.setItem('fp_tour_step_v1',value);},value);await page.reload();await ready(page,0);await page.locator('#tour-skip').click();}
  await page.evaluate(()=>{localStorage.setItem('fp_tour_v1','pending');localStorage.setItem('fp_tour_step_v2','history');});await page.reload();await ready(page,2);await page.evaluate(()=>{const real=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='fp_tour_step_v2')throw Error('quota');return real.call(this,k,v);};});await next(page,3);await page.keyboard.press('Escape');await expect(tour(page)).toBeHidden();
});
test('overview has concise summaries plus instructions in an adaptive non-overlapping card',async({page})=>{
  await open(page);for(const viewport of [{width:320,height:568},{width:390,height:844},{width:600,height:360}]){
    await page.setViewportSize(viewport);await replay(page);await expect(page.locator('#tour-title')).toHaveText('На сегодня');
    for(let i=0;i<8;i++){
      await ready(page,i);const panel=await page.locator('.tour-panel').boundingBox(),back=await page.locator('#tour-back').boundingBox(),nextButton=await page.locator('#tour-next').boundingBox();
      expect(nextButton.y).toBe(back.y);expect(nextButton.width).toBe(back.width);expect(back.height).toBeGreaterThanOrEqual(44);
      expect((await page.locator('#tour-text').innerText()).length).toBeLessThanOrEqual(85);expect((await page.locator('#tour-title').innerText()).length).toBeLessThanOrEqual(20);
      await expect(page.locator('#tour-instructions li')).toHaveCount(2);await page.locator('#tour-instructions li').last().scrollIntoViewIfNeeded();await expect(page.locator('#tour-next')).toBeInViewport();
      if(await tour(page).getAttribute('data-spotlight')==='true'){const r=await page.locator('.tour-focus').boundingBox();expect(r.y+r.height<=panel.y-2||panel.y+panel.height<=r.y-2).toBe(true);}
      if(i<7)await next(page,i+1);
    }await expect(page.locator('#tour-title')).toHaveText('Настройки');await page.locator('#tour-skip').click();await expect(tour(page)).toBeHidden();
  }
});
test('highlight uses the visible add button and whole goal card without covering the fixed card',async({page})=>{
  await open(page);await replay(page);await next(page,1);await expect(tour(page)).toHaveAttribute('data-spotlight','true');const add=await page.locator('#hdr-plus-btn').boundingBox(),ring=await page.locator('.tour-focus').boundingBox();expect(Math.abs(add.x-ring.x-4)).toBeLessThan(1);expect(Math.abs(add.y-ring.y-4)).toBeLessThan(1);await page.locator('#tour-map-toggle').click();await page.locator('[data-tour-jump="5"]').click();await ready(page,5);await expect(tour(page)).toHaveAttribute('data-spotlight','true');const heading=await page.locator('#savings-goals .sg-card').first().boundingBox(),goalRing=await page.locator('.tour-focus').boundingBox();expect(Math.abs(heading.height+8-goalRing.height)).toBeLessThan(1);
});
test('chapter map remains scrollable, keyboard accessible and contained at narrow and landscape sizes in every palette',async({page})=>{
  test.setTimeout(60000);await open(page);for(const viewport of [{width:320,height:568},{width:600,height:360}]){await page.setViewportSize(viewport);for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});await replay(page);await page.locator('#tour-map-toggle').click();await expect(page.locator('#tour-map')).toBeVisible();await expect(page.locator('.tour-focus')).toBeHidden();await page.locator('[data-tour-jump="7"]').focus();await expect(page.locator('[data-tour-jump="7"]')).toBeInViewport();expect(await tour(page).evaluate(el=>el.contains(document.activeElement))).toBe(true);const b=await page.locator('.tour-panel').boundingBox();expect(b.y+b.height).toBeLessThanOrEqual(viewport.height);expect(await page.locator('.tour-panel').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);await page.keyboard.press('Enter');await ready(page,7);await page.locator('#tour-skip').click();}}
});
test('map preview',async({page})=>{
  await open(page);await page.evaluate(()=>setTheme('dark'));await replay(page);await page.locator('#tour-map-toggle').click();await page.screenshot({path:'.cache/v71-tour-map-dark.png',animations:'disabled'});
});

test('larger text scrolls inside the explanation without moving or hiding the navigation buttons',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:568});await replay(page);await next(page,1);await next(page,2);const before=await page.locator('#tour-next').boundingBox();await page.addStyleTag({content:'#tour-title {font-size:32px!important} #tour-text {font-size:26px!important}'});await expect.poll(()=>page.locator('.tour-content').evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);await page.locator('.tour-content').evaluate(el=>el.scrollTop=el.scrollHeight);await expect(page.locator('#tour-next')).toBeInViewport();expect(await page.locator('#tour-next').boundingBox()).toEqual(before);await next(page,3);expect(await page.locator('.tour-content').evaluate(el=>el.scrollTop)).toBe(0);
});

test('real section dock is always uncovered, and its modal controls navigate safely between actual sections',async({page})=>{
  await open(page);const before=await snapshot(page);await replay(page);
  for(const [tab,step]of [['calendar',3],['analytics',4],['home',0],['settings',7]]){
    const button=page.locator(`[data-tour-tab="${tab}"]`),original=page.locator(`#fintex-navigation [data-nav="${tab}"]`);await expect(button).toBeInViewport();expect(await button.boundingBox()).toEqual(await original.boundingBox());await button.click();await ready(page,step);await expect(original).toHaveAttribute('aria-current','page');await expect(button).toHaveAttribute('aria-current','page');const panel=await page.locator('.tour-panel').boundingBox(),dock=await page.locator('#fintex-navigation > div').boundingBox();expect(panel.y+panel.height).toBeLessThanOrEqual(dock.y-10);
  }
  await page.keyboard.press('Escape');expect(await snapshot(page)).toBe(before);
});
test('narrow calendar can reveal the full grid by folding the hint, without hiding the sections',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:568});await replay(page);await page.locator('[data-tour-tab="calendar"]').click();await ready(page,3);await page.locator('#tour-peek').click();await expect(tour(page)).toHaveAttribute('data-peek','true');await expect(page.locator('#tour-peek')).toHaveAttribute('aria-label','Показать подсказку');await expect(tour(page)).toHaveAttribute('data-spotlight','true');await expect(page.locator('#cal-cells')).toBeInViewport({ratio:1});const ring=await page.locator('.tour-focus').boundingBox(),panel=await page.locator('.tour-panel').boundingBox();expect(ring.y+ring.height).toBeLessThan(panel.y);await expect(page.locator('[data-tour-tab="settings"]')).toBeInViewport();await page.screenshot({path:'.cache/v71-tour-calendar-narrow.png',animations:'disabled'});await page.locator('#tour-peek').click();await expect(page.locator('#tour-text')).toBeVisible();await expect(page.locator('#tour-next')).toBeInViewport();
});
test('dock cutout and precise focus do not drift after viewport changes or palette changes',async({page})=>{
  await open(page);await replay(page);for(const viewport of [{width:320,height:568},{width:390,height:844},{width:600,height:360}]){
    await page.setViewportSize(viewport);await ready(page,0);const dock=await page.locator('#fintex-navigation > div').boundingBox(),panel=await page.locator('.tour-panel').boundingBox();expect(panel.y+panel.height).toBeLessThanOrEqual(dock.y-10);await expect(page.locator('[data-tour-tab]')).toHaveCount(4);const path=await page.locator('.tour-scrim path').getAttribute('d');expect(path.match(/M/g).length).toBeGreaterThanOrEqual(2);
    await page.locator('#tour-peek').click();await expect(tour(page)).toHaveAttribute('data-spotlight','true');const r=await page.locator('#hero-daily-budget').boundingBox(),f=await page.locator('.tour-focus').boundingBox();expect(Math.abs(f.x-r.x+4)).toBeLessThan(1);expect(Math.abs(f.width-r.width-8)).toBeLessThan(1);await page.locator('#tour-peek').click();
  }
});
