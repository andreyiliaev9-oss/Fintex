/* v86: bounded motion choreography. Presentation only; never waits before an action or invents money values. */
(() => {
  'use strict';
  const media=matchMedia('(prefers-reduced-motion: reduce)'),seen=new WeakSet(),running=new Set(),channels=new WeakMap();
  const curve='cubic-bezier(.16,1,.3,1)',MAX_EFFECTS=48;
  const onScreen=el=>!!el?.getClientRects().length&&el.getBoundingClientRect().bottom>0&&el.getBoundingClientRect().top<innerHeight;
  const available=()=>enabled()&&!document.documentElement.classList.contains('fintex-tour-open');
  const enabled=()=>!media.matches&&!document.documentElement.classList.contains('no-motion')&&!document.hidden;
  let observer=null,frame=0;
  function play(el,frames,options){
    if(!available()||!el?.isConnected||!el.getClientRects().length)return;
    const {channel='reveal',...timing}=options||{};
    let slots=channels.get(el);if(!slots){slots=new Map();channels.set(el,slots);}slots.get(channel)?.cancel();
    // No unbounded queue on rapid taps, repeated renders or long histories.
    if(running.size>=MAX_EFFECTS){const oldest=running.values().next().value;oldest.cancel();running.delete(oldest);}
    const a=el.animate(frames,{duration:340,easing:curve,...timing});a.id='fintex-interface-motion';slots.set(channel,a);running.add(a);
    a.finished.catch(()=>{}).finally(()=>{running.delete(a);if(slots.get(channel)===a)slots.delete(channel);});return a;
  }
  function stop(){observer?.disconnect();cancelAnimationFrame(frame);frame=0;running.forEach(a=>a.cancel());running.clear();}
  function refresh(){
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      frame=0;observer?.disconnect();if(!available()||!window.IntersectionObserver)return;
      const tab=document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav,view=document.getElementById(`view-${tab}`);if(!view)return;
      const targets=[...view.querySelectorAll('.ap-period-panel,.ap-expense-hero,.ap-distribution,.ap-period-information,.behavior-heading,.behavior-planner,#calendar-plan,.ap-donut,.ap-plot-surface,#hero-balance-card,#filely-financial-tree,.section-group,.sg-card,.sg-heading,.ap-cashflow,.ap-category-row,.data-care,.tour-settings-card,.settings-task > h3,#calendar-month-totals,#cal-day-section,.inv-entry,.context-help,.balance-warning')].slice(0,120);
      observer=new IntersectionObserver(entries=>{
        if(!available()||view.classList.contains('hidden'))return;
        let i=0;for(const entry of entries){if(!entry.isIntersecting)continue;observer.unobserve(entry.target);if(seen.has(entry.target))continue;seen.add(entry.target);
          if(entry.target.matches('.ap-plot-surface')){
            const bars=[...entry.target.querySelectorAll('.ap-day-bar:not(.ap-day-unrecorded)')];
            if(bars.length<=40)bars.forEach((bar,index)=>play(bar,[{transform:'scaleY(.05)'},{transform:'scaleY(1)'}],{duration:480,delay:Math.min(index*12,160)}));
            else play(entry.target.querySelector('svg'),[{opacity:.3,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:420});
          }
          else if(entry.target.matches('.ap-cashflow')){
            play(entry.target,[{opacity:.4,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}]);
            entry.target.querySelectorAll('.ap-cashflow-track > span').forEach((el,index)=>play(el,[{transform:'scaleX(.02)'},{transform:'scaleX(1)'}],{duration:650,delay:index*90}));
          }
          else if(entry.target.matches('.ap-category-row')){play(entry.target,[{opacity:.3,transform:'translateX(-8px)'},{opacity:1,transform:'translateX(0)'}],{delay:Math.min(i++*40,160)});play(entry.target.querySelector('.ap-category-rail > span'),[{transform:'scaleX(.05)'},{transform:'scaleX(1)'}],{duration:550});}
          else if(entry.target.matches('.ap-donut'))play(entry.target,[{transform:'scale(.92)',opacity:.35},{transform:'scale(1)',opacity:1}],{duration:460});
          else play(entry.target,[{transform:'translateY(12px)',opacity:.35},{transform:'translateY(0)',opacity:1}],{duration:420,delay:Math.min(i++*35,140)});
        }
      },{threshold:.12});targets.forEach(el=>{if(!seen.has(el))observer.observe(el);});
    });
  }
  window.addEventListener('fintex:tabchange',event=>{
    stop();
    const {name,previous}=event.detail;
    if(name!==previous){
      // Swipe navigation owns the view transform; this layer only fades it.
      play(document.getElementById('view-'+name),[{opacity:.55},{opacity:1}],{duration:240,channel:'section'});
      const icon=document.querySelector('.nav-tab[aria-current="page"] .nav-icon');
      play(icon,[{transform:'translateY(0) scale(.86)'},{transform:'translateY(-3px) scale(1.09)',offset:.6},{transform:'translateY(-1px) scale(1)'}],{duration:380});
    }
    refresh();
  });
  document.addEventListener('toggle',event=>{
    if(!event.target.matches('details'))return;
    if(!event.target.open){event.target.getAnimations({subtree:true}).filter(a=>a.id==='fintex-interface-motion').forEach(a=>a.cancel());return;}
    if(!available())return;
    [...event.target.children].filter(el=>!el.matches('summary')).slice(0,5).forEach((el,i)=>play(el,[{opacity:.3,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,delay:i*28}));
    refresh();
  },true);
  window.addEventListener('fintex:motionchange',()=>{stop();refresh();});media.addEventListener?.('change',()=>{stop();refresh();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();else refresh();});
  function reveal(root){
    if(!root||!available())return;
    [...root.children].filter(el=>!el.matches('header,style,script')&&!el.contains(document.activeElement)).slice(0,8).forEach((el,i)=>play(el,[{opacity:.3,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:360,delay:Math.min(i*24,140)}));
  }
  function goalPulse(root,completed){
    play(root.querySelector('.sg-detail-art img'),[{transform:'scale(1.07)'},{transform:'scale(1)'}],{duration:650});
    play(root.querySelector('.sg-track > span'),[{transform:'scaleX(.5)'},{transform:'scaleX(1)'}],{duration:650});
    play(root.querySelector('.sg-badge'),[{transform:'scale(.85)'},{transform:'scale(1.12)',offset:.6},{transform:'scale(1)'}],{duration:480});
    if(!available()||!completed)return;
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
      if(open&&!modalState.get(el)){play(el.querySelector('.modal-sheet'),[{transform:'translateY(22px)',opacity:.35},{transform:'translateY(0)',opacity:1}],{duration:380});reveal(el.querySelector('.modal-sheet'));}
      if(!open)el.getAnimations({subtree:true}).filter(a=>a.id==='fintex-interface-motion').forEach(a=>a.cancel());
      modalState.set(el,open);
    }
  });
  function registerModal(el,initial=false){
    if(modalState.has(el)||!el.querySelector('.modal-sheet'))return;
    const open=!el.classList.contains('hidden');modalState.set(el,open);modalObserver.observe(el,{attributes:true,attributeFilter:['class']});
    if(open&&!initial){play(el.querySelector('.modal-sheet'),[{transform:'translateY(22px)',opacity:.35},{transform:'translateY(0)',opacity:1}],{duration:380});reveal(el.querySelector('.modal-sheet'));}
  }
  document.querySelectorAll('[id^="modal-"]').forEach(el=>registerModal(el,true));
  // Native dialogs use opacity only: preserve keyboard viewport positioning.
  const nativeObserver=new MutationObserver(entries=>{
    for(const el of new Set(entries.map(entry=>entry.target))){
      if(el.matches('dialog:not(#fintex-tour)')){
        if(el.open){play(el,[{opacity:.25},{opacity:1}],{duration:300});play(el.querySelector('header'),[{opacity:.45,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:360});}
        else el.getAnimations({subtree:true}).filter(a=>a.id==='fintex-interface-motion').forEach(a=>a.cancel());
      }
      if(el.hidden)el.getAnimations({subtree:true}).filter(a=>a.id==='fintex-interface-motion').forEach(a=>a.cancel());
      if(el.matches('[data-capture-stage],#flow-transfer,#flow-draft-note')&&!el.hidden){
        play(el,[{opacity:.3},{opacity:1}],{duration:260});
        if(el.matches('[data-capture-stage="done"]'))play(el.querySelector('.capture-success'),[{scale:'.8',opacity:.4},{scale:'1.1',opacity:1,offset:.65},{scale:'1',opacity:1}],{duration:480});
      }
      if(el.matches('[aria-invalid="true"]'))play(el,[{translate:'0'},{translate:'-3px',offset:.25},{translate:'3px',offset:.5},{translate:'-1px',offset:.75},{translate:'0'}],{duration:240,channel:'feedback'});
    }
  });
  nativeObserver.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open','hidden','aria-invalid']});
  document.addEventListener('click',event=>{
    if(!event.target.closest('[data-cal-date]'))return;
    play(document.querySelector('#cal-cells .is-selected'),[{transform:'scale(.9)'},{transform:'scale(1)'}],{duration:290});
    play(document.getElementById('cal-day-section'),[{opacity:.45,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],{duration:300});
  });
  const contentObserver=new MutationObserver(entries=>{
    const roots=new Set();
    for(const entry of entries){
      if(entry.target.matches?.('#inv-content,.ftx-story-stage'))roots.add(entry.target);
      for(const node of entry.addedNodes){
        if(node.nodeType!==1)continue;
        // Lazy modules (including simulation) may mount their sheet after boot.
        if(node.matches('[id^="modal-"]'))registerModal(node);
        if(node.matches('.modal-sheet')){const owner=node.closest('[id^="modal-"]');if(owner)registerModal(owner);}
        if(node.querySelector('.modal-sheet'))node.querySelectorAll('[id^="modal-"]').forEach(el=>registerModal(el));
      }
    }
    for(const root of roots)if(onScreen(root))reveal(root);
    // Removed/replaced targets must not keep compositor effects alive.
    for(const a of running)if(!a.effect?.target?.isConnected){a.cancel();running.delete(a);}
  });
  contentObserver.observe(document.body,{subtree:true,childList:true});
  document.addEventListener('click',event=>{
    const button=event.target.closest?.('button,summary');
    if(!event.isTrusted||!button||button.disabled||button.closest('#fintex-tour,#returning-splash')||button.matches('.nav-tab,.tx-row-open,[data-cal-date]'))return;
    // Independent scale leaves swipe transforms, save bars and positioning untouched.
    play(button,[{scale:'1'},{scale:'.97',offset:.3},{scale:'1'}],{duration:230,channel:'press'});
  });
  const toast=document.getElementById('toast');
  if(toast)new MutationObserver(()=>{if(!toast.classList.contains('opacity-0'))play(toast,[{translate:'0 8px',opacity:.2},{translate:'0 0',opacity:1}],{duration:320,channel:'toast'});}).observe(toast,{attributes:true,attributeFilter:['class']});
  window.addEventListener('fintex:tour-started',stop);window.addEventListener('fintex:tour-finished',refresh);
  window.addEventListener('filely:financial-data-updated',refresh);
  window.addEventListener('pagehide',stop);
  window.FintexMotion={refresh,reveal,goalPulse};refresh();
})();
