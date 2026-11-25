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
    await open(page);await page.evaluate(()=>document.getElementById('view-home').insertAdjacentHTML('afterbegin','<div id="physical-swipe-surface" style="height:120px">Область раздела</div>'));await page.locator('#physical-swipe-surface').scrollIntoViewIfNeeded();const box=await page.locator('#physical-swipe-surface').boundingBox();
    const session=await page.context().newCDPSession(page);const y=box.y+box.height/2;
    await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:260,y}]});
    for(const x of [230,190,150,110,75])await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y}]});
    await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await expect(active(page)).toHaveAttribute('data-nav','calendar');
  });
});
test('calendar cells support a tab swipe without selecting a different date; horizontal drag does not refresh',async({page})=>{
  await open(page);await page.evaluate(()=>{window.__swipeSync=0;runAnimatedBankSync=async()=>{window.__swipeSync++;};});
  await gesture(page,{dx:-160,dy:78});await expect(active(page)).toHaveAttribute('data-nav','calendar');expect(await page.evaluate(()=>window.__swipeSync)).toBe(0);
  const selected=await page.evaluate(()=>state.calSelected);await gesture(page,{target:'#cal-cells .cal-day',dx:-150});await expect(active(page)).toHaveAttribute('data-nav','analytics');expect(await page.evaluate(()=>state.calSelected)).toBe(selected);
});
