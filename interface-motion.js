/* Short, finite interface motion. No counters, timers, balance edits or endless effects. */
(() => {
  'use strict';
  const media=matchMedia('(prefers-reduced-motion: reduce)'),seen=new WeakSet(),running=new Set();
  const enabled=()=>!media.matches&&!document.documentElement.classList.contains('no-motion')&&!document.hidden;
  let observer=null,frame=0;
  function play(el,frames,options){
    if(!enabled()||!el.isConnected)return;
    const a=el.animate(frames,{duration:340,easing:'cubic-bezier(.2,.8,.2,1)',...options});a.id='fintex-interface-motion';running.add(a);a.finished.catch(()=>{}).finally(()=>running.delete(a));
  }
  function stop(){observer?.disconnect();cancelAnimationFrame(frame);frame=0;running.forEach(a=>a.cancel());running.clear();}
  function refresh(){
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      frame=0;observer?.disconnect();if(!enabled())return;
      const tab=document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav,view=document.getElementById(`view-${tab}`);if(!view)return;
      const targets=[...view.querySelectorAll('.ap-period-panel,.ap-expense-hero,.ap-distribution,.ap-period-information,.behavior-heading,.behavior-planner,#calendar-plan,.ap-donut,.ap-plot-surface,#hero-balance-card,#filely-financial-tree,.section-group')];
      observer=new IntersectionObserver(entries=>{
        if(!enabled()||view.classList.contains('hidden'))return;
        let i=0;for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);if(seen.has(entry.target))continue;seen.add(entry.target);
          if(entry.target.matches('.ap-plot-surface')){
            const bars=[...entry.target.querySelectorAll('.ap-day-bar:not(.ap-day-unrecorded)')];
            if(bars.length<=40)bars.forEach((bar,index)=>play(bar,[{transform:'scaleY(.05)'},{transform:'scaleY(1)'}],{duration:420,delay:Math.min(index*9,160)}));
            else play(entry.target.querySelector('svg'),[{opacity:.3,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:380});
          }
          else if(entry.target.matches('.ap-donut'))play(entry.target,[{transform:'scale(.92)',opacity:.35},{transform:'scale(1)',opacity:1}],{duration:460});
          else play(entry.target,[{transform:'translateY(9px)',opacity:.4},{transform:'translateY(0)',opacity:1}],{delay:Math.min(i++*35,140)});
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
  window.FintexMotion={refresh};refresh();
})();
