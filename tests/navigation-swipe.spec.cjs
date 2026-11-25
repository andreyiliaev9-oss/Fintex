const {test,expect}=require('@playwright/test');
async function open(page){
  await page.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
  await page.addInitScript(()=>{for(const [k,v]of Object.entries({fp_name:'Анна',fp_onboarded:'1',fp_motion:'0',fp_visual_style:'forest',fp_theme:'light',fp_local_tx:'[]'}))localStorage.setItem(k,v);});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexAnalyticsPro&&!!window.FINTEX_SIM?.ui);await page.evaluate(()=>dismissReturningSplash());
}
async function gesture(page,{dx=-150,dy=0,x=220,target,multi=false,cancel=false}={}){
  await page.evaluate(({dx,dy,x,target,multi,cancel})=>{
    const tab=document.querySelector('.nav-tab[aria-current="page"]').dataset.nav;
    const el=target?document.querySelector(target):document.getElementById('view-'+tab);
    const touch=(x,y,id=1)=>new Touch({identifier:id,target:el,clientX:x,clientY:y});
    const start=touch(x,250);el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:multi?[start,touch(x+15,250,2)]:[start],changedTouches:[start]}));
    const end=touch(x+dx,250+dy);el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[end],changedTouches:[end]}));
    el.dispatchEvent(new TouchEvent(cancel?'touchcancel':'touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[end]}));
  },{dx,dy,x,target,multi,cancel});
}
const active=page=>page.locator('.nav-tab[aria-current="page"]');
test('swipes traverse the four real sections without wrapping or financial mutations',async({page})=>{
  await open(page);const before=await page.evaluate(()=>JSON.stringify({transactions:state.transactions,balance:state.balance,goal:state.goal}));
  await gesture(page,{dx:140});await expect(active(page)).toHaveAttribute('data-nav','home');
  for(const tab of ['calendar','analytics','settings']){await gesture(page);await expect(active(page)).toHaveAttribute('data-nav',tab);await expect(page.locator('#view-'+tab)).toBeVisible();expect(await page.evaluate(()=>scrollY)).toBe(0);}
  await gesture(page);await expect(active(page)).toHaveAttribute('data-nav','settings');
  for(const tab of ['analytics','calendar','home']){await gesture(page,{dx:140,x:90});await expect(active(page)).toHaveAttribute('data-nav',tab);}
  expect(await page.evaluate(()=>JSON.stringify({transactions:state.transactions,balance:state.balance,goal:state.goal}))).toBe(before);
});
test('vertical, short, diagonal, OS-edge, multi-touch and cancelled gestures do not navigate',async({page})=>{
  await open(page);
  for(const input of [{dx:0,dy:160},{dx:-30},{dx:-90,dy:100},{dx:140,x:5},{dx:-150,x:380},{multi:true},{cancel:true}]){await gesture(page,input);await expect(active(page)).toHaveAttribute('data-nav','home');}
});
test('forms, chart controls, horizontal scrollers and visible dialogs keep their own gestures',async({page})=>{
  await open(page);await page.evaluate(()=>{const view=document.getElementById('view-home');view.insertAdjacentHTML('beforeend','<input id="swipe-input"><div id="swipe-chart" role="slider">График</div><div id="swipe-scroll" style="width:100px;overflow-x:auto"><div id="swipe-inner" style="width:1000px">Лента</div></div>');});
  for(const target of ['#swipe-input','#swipe-chart','#swipe-inner']){await gesture(page,{target});await expect(active(page)).toHaveAttribute('data-nav','home');}
  await page.locator('#swipe-input').focus();await gesture(page);await expect(active(page)).toHaveAttribute('data-nav','home');await page.locator('#swipe-input').evaluate(el=>el.blur());
  await page.evaluate(()=>openSmartHubModal());await gesture(page);await expect(active(page)).toHaveAttribute('data-nav','home');await page.evaluate(()=>closeModals());await gesture(page);await expect(active(page)).toHaveAttribute('data-nav','calendar');
});
test.describe('real touchscreen gestures',()=>{
  test.use({hasTouch:true,isMobile:true});
  test('a physical horizontal touch drag changes section; vertical drag keeps the section',async({page})=>{
    await open(page);await motionOn(page);await page.evaluate(()=>document.getElementById('view-home').insertAdjacentHTML('afterbegin','<div id="physical-swipe-surface" style="height:120px">Область раздела</div>'));await page.locator('#physical-swipe-surface').scrollIntoViewIfNeeded();const box=await page.locator('#physical-swipe-surface').boundingBox();
    const session=await page.context().newCDPSession(page);const y=box.y+box.height/2;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:260,y}]});
    for(const x of [230,190,150,110,75])await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
    expect(await page.locator('#view-home').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41)).toBeLessThan(-80);
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(active(page)).toHaveAttribute('data-nav','calendar');await expect(page.locator('#view-calendar')).not.toHaveClass(/tab-is-dragging/);
  });
});
test('calendar cells support a tab swipe without selecting a different date; horizontal drag does not refresh',async({page})=>{
  await open(page);await page.evaluate(()=>{window.__swipeSync=0;runAnimatedBankSync=async()=>{window.__swipeSync++;};});
  await gesture(page,{dx:-160,dy:78});await expect(active(page)).toHaveAttribute('data-nav','calendar');expect(await page.evaluate(()=>window.__swipeSync)).toBe(0);
  const selected=await page.evaluate(()=>state.calSelected);await gesture(page,{target:'#cal-cells .cal-day',dx:-150});await expect(active(page)).toHaveAttribute('data-nav','analytics');expect(await page.evaluate(()=>state.calSelected)).toBe(selected);
});
async function motionOn(page){await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>{localStorage.setItem('fp_motion','1');applyMotionPref();});}
async function startDrag(page,{dx=-100,target='#view-home'}={}){
  await page.evaluate(({dx,target})=>{const el=document.querySelector(target),touch=x=>new Touch({identifier:42,target:el,clientX:x,clientY:250});const start=touch(220);el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[start],changedTouches:[start]}));const end=touch(220+dx);el.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[end],changedTouches:[end]}));}, {dx,target});
}
async function endDrag(page,{dx=-100,cancel=false,target='#view-home'}={}){
  await page.evaluate(({dx,cancel,target})=>{const el=document.querySelector(target),t=new Touch({identifier:42,target:el,clientX:220+dx,clientY:250});el.dispatchEvent(new TouchEvent(cancel?'touchcancel':'touchend',{bubbles:true,cancelable:true,touches:[],changedTouches:[t]}));},{dx,cancel,target});
}
test('screen follows the finger, cancels elastically and cleans up before a later commit',async({page})=>{
  await open(page);await motionOn(page);await startDrag(page,{dx:-30});
  expect(await page.locator('#view-home').evaluate(el=>new DOMMatrix(getComputedStyle(el).transform).m41)).toBeLessThan(-20);await expect(page.locator('#tab-swipe-hint')).toContainText('Календарь');
  await endDrag(page,{dx:-30});await expect(page.locator('#view-home')).not.toHaveClass(/tab-is-dragging/);await expect(active(page)).toHaveAttribute('data-nav','home');
  await startDrag(page);await endDrag(page,{cancel:true});await expect(page.locator('#view-home')).not.toHaveClass(/tab-is-dragging/);await expect(active(page)).toHaveAttribute('data-nav','home');
  await startDrag(page,{dx:-160});await endDrag(page,{dx:-160});await expect(active(page)).toHaveAttribute('data-nav','calendar');await expect(page.locator('#view-calendar')).not.toHaveClass(/tab-is-dragging/);await expect(page.locator('#tab-swipe-hint')).toBeHidden();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
});
test('tap-only action surfaces can swipe; open dialogs and manual tab changes abort the drag safely',async({page})=>{
  await open(page);await motionOn(page);await page.evaluate(()=>document.getElementById('view-home').insertAdjacentHTML('afterbegin','<button id="swipe-action" onclick="window.__accidentalAction=true">Действие</button>'));
  await startDrag(page,{target:'#swipe-action',dx:-140});await endDrag(page,{target:'#swipe-action',dx:-140});await page.evaluate(()=>document.getElementById('swipe-action').dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1,clientX:80,clientY:250})));await expect(active(page)).toHaveAttribute('data-nav','calendar');expect(await page.evaluate(()=>window.__accidentalAction)).toBeUndefined();
  await expect(page.locator('#view-calendar')).not.toHaveClass(/tab-is-dragging/);await page.evaluate(()=>goTab('home'));await startDrag(page);await page.evaluate(()=>openSmartHubModal());await endDrag(page);await expect(active(page)).toHaveAttribute('data-nav','home');await expect(page.locator('#view-home')).not.toHaveClass(/tab-is-dragging/);
  await page.evaluate(()=>closeModals());await startDrag(page);await page.evaluate(()=>goTab('settings'));await endDrag(page);await expect(active(page)).toHaveAttribute('data-nav','settings');await expect(page.locator('.tab-is-dragging')).toHaveCount(0);
});
test('motion off/reduced cancels feedback and effects, while switching and saved scroll still work',async({page})=>{
  await open(page);await motionOn(page);await startDrag(page);await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();});await expect(page.locator('.tab-is-dragging')).toHaveCount(0);await expect(page.locator('#tab-swipe-hint')).toBeHidden();await endDrag(page);await expect(active(page)).toHaveAttribute('data-nav','home');
  await page.evaluate(()=>{window.scrollTo({top:200,behavior:'instant'});goTab('calendar');});await gesture(page,{dx:150,x:90});await expect(active(page)).toHaveAttribute('data-nav','home');expect(await page.evaluate(()=>scrollY)).toBe(200);
  await motionOn(page);await startDrag(page);await page.emulateMedia({reducedMotion:'reduce'});await expect(page.locator('.tab-is-dragging')).toHaveCount(0);expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.id.startsWith('fintex-tab')||a.id==='fintex-interface-motion').length)).toBe(0);
});
test('finite chart and disclosure effects do not alter data and respect reduced motion',async({page})=>{
  await open(page);await motionOn(page);const before=await page.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,goal:state.goal}));
  await page.evaluate(()=>{goTab('analytics');document.querySelector('.behavior-planner').open=true;});await page.locator('.behavior-planner').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(a=>a.id==='fintex-interface-motion').length)).toBeGreaterThan(0);
  await page.emulateMedia({reducedMotion:'reduce'});await expect.poll(()=>page.evaluate(()=>document.getAnimations().filter(a=>a.id==='fintex-interface-motion').length)).toBe(0);expect(await page.evaluate(()=>JSON.stringify({balance:state.balance,transactions:state.transactions,goal:state.goal}))).toBe(before);
});
test('chart growth is finite and disabling motion cancels all pending interface effects',async({page})=>{
  await open(page);await motionOn(page);await page.evaluate(()=>{window.__barEffects=[];const originalAnimate=Element.prototype.animate;Element.prototype.animate=function(...args){const a=originalAnimate.apply(this,args);if(this.matches('.ap-day-bar'))window.__barEffects.push(a);return a;};state.transactions=Array.from({length:8},(_,i)=>({id:'motion'+i,type:'expense',amount:100+i*20,category:'food',merchant:'Покупка',date:FintexMath.shift(TODAY,-i)}));goTab('analytics');});await page.locator('.ap-plot-surface').scrollIntoViewIfNeeded();
  await expect.poll(()=>page.evaluate(()=>window.__barEffects.filter(a=>a.id==='fintex-interface-motion').length)).toBeGreaterThan(0);
  const timings=await page.evaluate(()=>window.__barEffects.map(a=>a.effect.getTiming()));for(const t of timings){expect(t.iterations).toBe(1);expect(t.duration).toBeLessThanOrEqual(500);}
  await page.evaluate(()=>{localStorage.setItem('fp_motion','0');applyMotionPref();});expect(await page.evaluate(()=>document.getAnimations().filter(a=>a.id==='fintex-interface-motion').length)).toBe(0);
});
