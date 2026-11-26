/* Short, finite interface motion. No counters, timers, balance edits or endless effects. */
(() => {
  'use strict';
  const media=matchMedia('(prefers-reduced-motion: reduce)'),seen=new WeakSet(),running=new Set();
  const enabled=()=>!media.matches&&!document.documentElement.classList.contains('no-motion')&&!document.hidden;
  let observer=null,frame=0;
  function play(el,frames,options){
    if(!enabled()||!el?.isConnected)return;
    const a=el.animate(frames,{duration:260,easing:'cubic-bezier(.2,.8,.2,1)',...options});a.id='fintex-interface-motion';running.add(a);a.finished.catch(()=>{}).finally(()=>running.delete(a));return a;
  }
  function stop(){observer?.disconnect();cancelAnimationFrame(frame);frame=0;running.forEach(a=>a.cancel());running.clear();}
  function refresh(){
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      frame=0;observer?.disconnect();if(!enabled())return;
      const tab=document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav,view=document.getElementById(`view-${tab}`);if(!view)return;
      const targets=[...view.querySelectorAll('.ap-period-panel,.ap-expense-hero,.ap-distribution,.ap-period-information,.behavior-heading,.behavior-planner,#calendar-plan,.ap-donut,.ap-plot-surface,#hero-balance-card,#filely-financial-tree,.section-group,.sg-card,.sg-heading,.ap-cashflow,.ap-category-row')];
      observer=new IntersectionObserver(entries=>{
        if(!enabled()||view.classList.contains('hidden'))return;
        let i=0;for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);if(seen.has(entry.target))continue;seen.add(entry.target);
          if(entry.target.matches('.ap-plot-surface')){
            const bars=[...entry.target.querySelectorAll('.ap-day-bar:not(.ap-day-unrecorded)')];
            if(bars.length<=40)bars.forEach((bar,index)=>play(bar,[{transform:'scaleY(.05)'},{transform:'scaleY(1)'}],{duration:420,delay:Math.min(index*9,160)}));
            else play(entry.target.querySelector('svg'),[{opacity:.3,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:380});
          }
          else if(entry.target.matches('.ap-cashflow')){
            play(entry.target,[{opacity:.4,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}]);
            entry.target.querySelectorAll('.ap-cashflow-track > span').forEach((el,index)=>play(el,[{transform:'scaleX(.02)'},{transform:'scaleX(1)'}],{duration:650,delay:index*90}));
          }
          else if(entry.target.matches('.ap-category-row')){play(entry.target,[{opacity:.3,transform:'translateX(-8px)'},{opacity:1,transform:'translateX(0)'}],{delay:Math.min(i++*40,160)});play(entry.target.querySelector('.ap-category-rail > span'),[{transform:'scaleX(.05)'},{transform:'scaleX(1)'}],{duration:550});}
          else if(entry.target.matches('.ap-donut'))play(entry.target,[{transform:'scale(.92)',opacity:.35},{transform:'scale(1)',opacity:1}],{duration:460});
          else play(entry.target,[{transform:'translateY(6px)',opacity:.4},{transform:'translateY(0)',opacity:1}],{delay:Math.min(i++*35,140)});
        }
      },{threshold:.12});targets.forEach(el=>{if(!seen.has(el))observer.observe(el);});
    });
  }
  window.addEventListener('fintex:tabchange',()=>{
    running.forEach(a=>a.cancel());running.clear();
    const icon=document.querySelector('.nav-tab[aria-current="page"] .nav-icon');if(icon)play(icon,[{transform:'translateY(0) scale(.88)'},{transform:'translateY(-2px) scale(1.08)',offset:.65},{transform:'translateY(-1px) scale(1)'}],{duration:300});refresh();
  });
  document.addEventListener('toggle',event=>{
    if(!event.target.matches('details[open]')||!enabled())return;
    [...event.target.children].filter(el=>!el.matches('summary')).slice(0,3).forEach((el,i)=>play(el,[{opacity:.3,transform:'translateY(-5px)'},{opacity:1,transform:'translateY(0)'}],{duration:240,delay:i*25}));
  },true);
  window.addEventListener('fintex:motionchange',()=>{stop();refresh();});media.addEventListener?.('change',()=>{stop();refresh();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else refresh();});
  function reveal(root){
    [...root.children].filter(el=>!el.matches('header')).slice(0,7).forEach((el,i)=>play(el,[{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,delay:i*14}));
  }
  function goalPulse(root,completed){
    play(root.querySelector('.sg-detail-art img'),[{transform:'scale(1.07)'},{transform:'scale(1)'}],{duration:650});
    play(root.querySelector('.sg-track > span'),[{transform:'scaleX(.5)'},{transform:'scaleX(1)'}],{duration:650});
    play(root.querySelector('.sg-badge'),[{transform:'scale(.85)'},{transform:'scale(1.12)',offset:.6},{transform:'scale(1)'}],{duration:480});
    if(!enabled()||!completed)return;
    const scene=root.querySelector('.sg-detail-art');if(!scene)return;
    for(let i=0;i<10;i++){
      const leaf=document.createElement('span');leaf.className='sg-spark';leaf.setAttribute('aria-hidden','true');scene.append(leaf);
      const angle=Math.PI*2*i/10,a=play(leaf,[{opacity:1,transform:'translate(0,0) rotate(0deg)'},{opacity:0,transform:`translate(${Math.cos(angle)*130}px,${Math.sin(angle)*100-30}px) rotate(${i*57}deg)`}],{duration:750,delay:i*12});
      if(a)a.finished.catch(()=>{}).finally(()=>leaf.remove());else leaf.remove();
    }
  }
  const modalState=new WeakMap();
  const modalObserver=new MutationObserver(entries=>{
    for(const el of new Set(entries.map(entry=>entry.target))){
      const open=!el.classList.contains('hidden');
      if(open&&!modalState.get(el))play(el.querySelector('.modal-sheet'),[{transform:'translateY(10px)',opacity:.45},{transform:'translateY(0)',opacity:1}],{duration:260});
      if(!open)el.getAnimations({subtree:true}).filter(a=>a.id==='fintex-interface-motion').forEach(a=>a.cancel());
      modalState.set(el,open);
    }
  });
  document.querySelectorAll('[id^="modal-"]').forEach(el=>{modalState.set(el,!el.classList.contains('hidden'));modalObserver.observe(el,{attributes:true,attributeFilter:['class']});});
  // Native dialogs use opacity only: preserve keyboard viewport positioning.
  const nativeObserver=new MutationObserver(entries=>{
    for(const el of new Set(entries.map(entry=>entry.target))){
      if(!el.matches('dialog'))continue;
      if(el.open)play(el,[{opacity:.35},{opacity:1}],{duration:260});
      else el.getAnimations({subtree:true}).filter(a=>a.id==='fintex-interface-motion').forEach(a=>a.cancel());
    }
  });
  nativeObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  document.addEventListener('click',event=>{
    if(!event.target.closest('[data-cal-date]'))return;
    play(document.querySelector('#cal-cells .is-selected'),[{transform:'scale(.9)'},{transform:'scale(1)'}],{duration:290});
    play(document.getElementById('cal-day-section'),[{opacity:.45,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:300});
  });
  window.FintexMotion={refresh,reveal,goalPulse};refresh();
})();
