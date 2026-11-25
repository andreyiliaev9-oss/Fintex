const {test,expect}=require('@playwright/test');
async function open(page,{first=false}={}){
  await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
  await page.addInitScript(first=>{
    localStorage.setItem('fp_name','Андрей');if(!first)localStorage.setItem('fp_onboarded','1');
    localStorage.setItem('fp_motion','0');localStorage.setItem('fp_visual_style','forest');localStorage.setItem('fp_theme','light');
    localStorage.setItem('fp_balance','82540.75');localStorage.setItem('fp_local_tx','[]');
  },first);
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexAnalyticsPro&&!!window.FINTEX_SIM?.ui);
  if(!first)await page.evaluate(()=>dismissReturningSplash());
}
const contrast=(a,b)=>{const lum=rgb=>rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
test('provided logo loads locally in header, home button, onboarding and browser icons',async({page})=>{
  await open(page);const logo=page.locator('#fintex-ai-orb img');await expect(logo).toBeVisible();
  for(const img of await page.locator('#fintex-ai-orb img,#fintex-navigation img').all())expect(await img.evaluate(img=>img.complete&&img.naturalWidth===512)).toBe(true);
  expect(await logo.evaluate(el=>getComputedStyle(el.parentElement,'::before').content)).toBe('none');
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href',/fintex-icon-32.png/);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href',/fintex-touch-icon.png/);
  await page.evaluate(()=>{state.balance=0;persistAll();renderAll(false);});await expect(logo).toBeVisible();
  await expect(page.locator('#fintex-ai-orb')).toHaveAttribute('title',/Нужен контроль/);
});
test('navigation buttons work by keyboard, keep exactly one current destination and align the selected pill',async({page})=>{
  await open(page);const before=await page.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,goal:state.goal}));
  const nav=page.locator('#fintex-navigation');
  for(const tab of ['calendar','analytics','settings','home']){
    const button=nav.locator(`[data-nav="${tab}"]`);await button.focus();await page.keyboard.press('Enter');
    await expect(button).toBeFocused();await expect(button).toHaveAttribute('aria-current','page');await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);await expect(page.locator('#view-'+tab)).toBeVisible();
    const bounds=await button.boundingBox(),pill=await nav.locator('#nav-active-pill').boundingBox();expect(Math.abs(bounds.x-pill.x)).toBeLessThanOrEqual(1.5);expect(Math.abs(bounds.width-pill.width)).toBeLessThanOrEqual(1.5);
  }
  expect(await page.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,goal:state.goal}))).toBe(before);
  await page.locator('#hdr-plus-btn').click();await expect(page.locator('#modal-smart-hub')).toBeVisible();
});
test('panel fits narrow screens and preserves label/icon contrast in all complementary palettes',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:740});const nav=page.locator('#fintex-navigation');
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});
    for(const tab of ['home','calendar','analytics','settings']){
      await nav.locator(`[data-nav="${tab}"]`).click();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(320);
      const metrics=await nav.evaluate(el=>{
        const rgb=s=>s.match(/\d+(?:\.\d+)?/g).slice(0,3).map(Number),selected=el.querySelector('[aria-current="page"]'),icon=selected.querySelector('.nav-icon'),pill=el.querySelector('#nav-active-pill');
        return {text:rgb(getComputedStyle(selected).color),bg:rgb(getComputedStyle(pill).backgroundColor),icon:rgb(getComputedStyle(icon).color),iconBg:rgb(getComputedStyle(icon).backgroundColor),buttons:[...el.querySelectorAll('button')].map(b=>({w:b.clientWidth,h:b.clientHeight,overflow:b.scrollWidth>b.clientWidth}))};
      });
      expect(contrast(metrics.text,metrics.bg),`${style}/${mode}/${tab} text`).toBeGreaterThanOrEqual(4.5);
      if(tab!=='home')expect(contrast(metrics.icon,metrics.iconBg),`${style}/${mode}/${tab} icon`).toBeGreaterThanOrEqual(4.5);
      for(const b of metrics.buttons){expect(b.w).toBeGreaterThanOrEqual(44);expect(b.h).toBeGreaterThanOrEqual(44);expect(b.overflow).toBe(false);}
    }
  }
  await page.evaluate(()=>{setVisualStyle('forest');setTheme('light');goTab('home');});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'docs/brand-navigation-preview.png'});
});
test('onboarding uses the same logo; reduced motion leaves panel selection instant',async({page})=>{
  await open(page,{first:true});await expect(page.locator('#onboarding-screen')).toBeVisible();const logo=page.locator('.fintex-onboarding-logo');await expect(logo).toBeVisible();expect(await logo.evaluate(el=>el.complete&&el.naturalWidth>0)).toBe(true);
  await expect(page.locator('#nav-active-pill')).toHaveCSS('transition-duration','0s');
});

test('each panel button has a separated outline, with a stronger current outline in every theme',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:740});
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});
    for(const tab of ['calendar','analytics','settings','home']){
      await page.locator(`#fintex-navigation [data-nav="${tab}"]`).click();
      const outlines=await page.locator('#fintex-navigation .nav-tab').evaluateAll(buttons=>buttons.map(button=>{
        const s=getComputedStyle(button,'::after');return {current:button.getAttribute('aria-current')==='page',width:s.borderTopWidth,style:s.borderTopStyle,color:s.borderTopColor,inset:s.top,pointer:s.pointerEvents,transition:s.transitionDuration};
      }));
      for(const o of outlines){expect(o.width).toBe(o.current?'2px':'1px');expect(o.style).toBe('solid');expect(o.color).not.toBe('rgba(0, 0, 0, 0)');expect(o.inset).toBe('3px');expect(o.pointer).toBe('none');expect(o.transition).toBe('0s');}
    }
  }
});
test('each destination has a distinct coloured icon tile even when inactive',async({page})=>{
  await open(page);
  for(const style of ['forest','sapphire','growth'])for(const mode of ['light','dark']){
    await page.evaluate(({style,mode})=>{setVisualStyle(style);setTheme(mode);},{style,mode});
    const colours=await page.locator('#fintex-navigation .nav-icon').evaluateAll(els=>els.map(el=>getComputedStyle(el).backgroundColor));expect(new Set(colours).size).toBe(4);
    for(const tab of ['calendar','analytics','settings']){const icon=page.locator(`[data-nav="${tab}"] .nav-icon`);const c=await icon.evaluate(el=>{const rgb=s=>s.match(/\d+/g).slice(0,3).map(Number),style=getComputedStyle(el);return {fg:rgb(style.color),bg:rgb(style.backgroundColor)};});expect(contrast(c.fg,c.bg)).toBeGreaterThanOrEqual(4.5);}
  }
});
