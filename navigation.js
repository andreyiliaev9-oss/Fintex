/* Finger-follow tab navigation; gestures never write financial data. */
(() => {
  'use strict';
  const order = ['home','calendar','map','analytics','settings'];
  const labels = {home:'Главная',calendar:'Календарь',map:'Карта',analytics:'Аналитика',settings:'Настройки'};
  const current = () => document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav;
  const visible = el => !!el?.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const blocked = () => [...document.querySelectorAll('[id^="modal-"],[role="dialog"],dialog[open],#onboarding-screen,#returning-splash,#ftx-stories-overlay')].some(visible);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const moves = () => !document.documentElement.classList.contains('no-motion') && !reduce.matches;
  const positions = new Map(), effects = new Set();
  let gesture=null, ghost=null, dragged=null, epoch=0, ownCommit=false, settling=false;
  const hint=document.createElement('div');hint.id='tab-swipe-hint';hint.setAttribute('aria-hidden','true');hint.hidden=true;document.body.append(hint);
  function cleanView(el){el?.classList.remove('tab-is-dragging');el?.style.removeProperty('transform');}
  function reset(){epoch++;gesture=null;settling=false;effects.forEach(a=>a.cancel());effects.clear();cleanView(dragged);dragged=null;hint.hidden=true;}
  function animate(el,frames,duration){
    if(!moves())return Promise.resolve();
    const a=el.animate(frames,{duration,easing:'cubic-bezier(.2,.8,.2,1)',fill:'forwards'});a.id='fintex-tab-settle';effects.add(a);
    return a.finished.catch(()=>{}).finally(()=>{effects.delete(a);a.cancel();});
  }
  function protectedTarget(target,view){
    if(!(target instanceof Element)||target.closest('a,input,select,textarea,summary,[contenteditable="true"],[role="slider"],canvas,.ap-trend,[data-no-tab-swipe]'))return true;
    if(target.closest('svg')&&!target.closest('button,[role="button"]'))return true;
    if(document.activeElement?.matches('input,textarea,select,[contenteditable="true"]')||String(getSelection()).length)return true;
    for(let el=target;el&&el!==view;el=el.parentElement)if(el.scrollWidth>el.clientWidth+1&&/auto|scroll/.test(getComputedStyle(el).overflowX))return true;
    return false;
  }
  function track(dx){
    if(!gesture)return;
    const {view,tab}=gesture, next=order[order.indexOf(tab)+(dx<0?1:-1)];
    const shift=next?Math.sign(dx)*Math.min(Math.abs(dx)*.82,innerWidth*.88):Math.sign(dx)*Math.min(30,Math.abs(dx)*.16);
    gesture.shift=shift;
    if(!moves())return;
    dragged=view;view.classList.add('tab-is-dragging');view.style.transform=`translate3d(${shift}px,0,0)`;
    hint.textContent=next?`${dx<0?'← ':''}${labels[next]}${dx>0?' →':''}`:'Крайний раздел';
    hint.style.left=dx<0?'auto':'16px';hint.style.right=dx<0?'16px':'auto';hint.hidden=false;
  }
  async function finish(start,next){
    const ticket=++epoch, shift=start.shift||0;settling=true;hint.hidden=true;
    if(next&&moves())await animate(start.view,[{transform:`translate3d(${shift}px,0,0)`},{transform:`translate3d(${Math.sign(shift||-1)*innerWidth}px,0,0)`}],150);
    else if(moves()&&shift)await animate(start.view,[{transform:`translate3d(${shift}px,0,0)`},{transform:'translate3d(0,0,0)'}],230);
    if(ticket!==epoch)return;
    cleanView(start.view);dragged=null;
    if(next){
      ownCommit=true;try{window.goTab(next);}finally{ownCommit=false;}
      const incoming=document.getElementById(`view-${next}`);incoming.classList.add('tab-is-dragging');dragged=incoming;
      const sign=order.indexOf(next)>order.indexOf(start.tab)?1:-1;
      await animate(incoming,[{transform:`translate3d(${sign*42}px,0,0)`,opacity:.65},{transform:'translate3d(0,0,0)',opacity:1}],240);
      if(ticket!==epoch)return;
      cleanView(incoming);dragged=null;
    }
    settling=false;
  }
  document.addEventListener('touchstart',event=>{
    if(settling)return;
    if(gesture)reset();
    if(event.touches.length!==1||blocked())return;
    const tab=current(),view=document.getElementById(`view-${tab}`),target=event.target;
    if(!view?.contains(target)||protectedTarget(target,view))return;
    const t=event.touches[0];if(t.clientX<24||t.clientX>innerWidth-24)return;
    gesture={id:t.identifier,x:t.clientX,y:t.clientY,tab,view,time:performance.now(),axis:null,shift:0};
  },{passive:true});
  document.addEventListener('touchmove',event=>{
    if(!gesture)return;
    if(event.touches.length!==1||blocked()){reset();return;}
    const t=event.touches[0],dx=t.clientX-gesture.x,dy=t.clientY-gesture.y;
    if(Math.max(Math.abs(dx),Math.abs(dy))<12)return;
    if(!gesture.axis)gesture.axis=Math.abs(dx)>Math.abs(dy)*1.35?'horizontal':'vertical';
    if(gesture.axis==='vertical'){reset();return;}
    if(event.cancelable)event.preventDefault();track(dx);
  },{passive:false});
  document.addEventListener('touchend',event=>{
    const start=gesture;gesture=null;if(!start)return;
    if(event.touches.length||blocked()||current()!==start.tab){reset();return;}
    const t=[...event.changedTouches].find(t=>t.identifier===start.id);if(!t){reset();return;}
    const dx=t.clientX-start.x,dy=t.clientY-start.y,elapsed=Math.max(1,performance.now()-start.time);
    const deliberate=Math.abs(dx)>=Math.max(64,Math.min(100,innerWidth*.22));
    const flick=Math.abs(dx)>=40&&Math.abs(dx)/elapsed>.45;
    const accepted=start.axis==='horizontal'&&(deliberate||flick)&&Math.abs(dx)>Math.abs(dy)*1.35;
    const next=accepted?order[order.indexOf(start.tab)+(dx<0?1:-1)]:null;
    if(start.axis==='horizontal')ghost={x:t.clientX,y:t.clientY,time:performance.now()};
    finish(start,next);
  },{passive:true});
  document.addEventListener('touchcancel',()=>{const start=gesture;gesture=null;if(start)finish(start,null);},{passive:true});
  document.addEventListener('click',event=>{
    if(event.detail&&ghost&&performance.now()-ghost.time<450&&Math.hypot(event.clientX-ghost.x,event.clientY-ghost.y)<28){event.preventDefault();event.stopImmediatePropagation();}
  },true);
  window.addEventListener('fintex:tabchange',event=>{
    const {name,previous,scroll}=event.detail;if(name===previous)return;
    positions.set(previous,scroll);
    if(!ownCommit)reset();
    window.scrollTo({top:positions.get(name)||0,behavior:'instant'});
  });
  window.addEventListener('fintex:motionchange',()=>{if(!moves())reset();});reduce.addEventListener?.('change',reset);
  window.addEventListener('resize',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
})();
