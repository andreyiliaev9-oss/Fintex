/* Visible keyboard viewport and return position; never writes financial state. */
(() => {
  'use strict';
  const root=document.documentElement;
  let frame=0,focusTimer=0;
  const paneObserver=window.ResizeObserver?new ResizeObserver(()=>update()):null;
  const editable=el=>el?.matches?.('input:not([type=checkbox]):not([type=range]),textarea,select');
  function reveal(){
    const active=document.activeElement;
    if(!editable(active))return;
    const pane=active.closest('[data-form-scroll],dialog[open],.modal-sheet');if(!pane)return;
    const viewport=window.visualViewport,rect=active.getBoundingClientRect(),bounds=pane.getBoundingClientRect();
    const top=Math.max(bounds.top,viewport?.offsetTop||0)+16;
    const bottom=Math.min(bounds.bottom,(viewport?.offsetTop||0)+(viewport?.height||innerHeight))-24;
    // Scroll only the form, not the journal behind it. No animation while typing.
    if(rect.bottom>bottom)pane.scrollTop+=rect.bottom-bottom;
    else if(rect.top<top)pane.scrollTop-=top-rect.top;
  }
  function update(){
    cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const viewport=window.visualViewport,height=viewport?.height||innerHeight,offset=viewport?.offsetTop||0;
      root.style.setProperty('--form-viewport-height',`${Math.round(height)}px`);
      root.style.setProperty('--form-viewport-top',`${Math.max(0,Math.round(offset))}px`);
      root.dataset.formCompact=String(height<520);
      root.style.setProperty('--form-viewport-bottom',`${Math.max(0,Math.round(innerHeight-height-offset))}px`);
      reveal();
    });
  }
  document.addEventListener('focusin',e=>{paneObserver?.disconnect();if(editable(e.target)){const pane=e.target.closest('[data-form-scroll],dialog[open],.modal-sheet');if(pane)paneObserver?.observe(pane);update();clearTimeout(focusTimer);focusTimer=setTimeout(reveal,300);}});
  document.fonts?.ready.then(update);
  window.addEventListener('pagehide',()=>{paneObserver?.disconnect();cancelAnimationFrame(frame);clearTimeout(focusTimer);});
  window.addEventListener('resize',update,{passive:true});
  window.visualViewport?.addEventListener('resize',update,{passive:true});
  window.visualViewport?.addEventListener('scroll',update,{passive:true});
  function remember(trigger=document.activeElement){return {x:scrollX,y:scrollY,trigger,txId:trigger?.closest?.('[data-tx-open]')?.dataset.txOpen};}
  function restore(point,fallback){
    if(!point||document.querySelector('dialog[open],[id^="modal-"]:not(.hidden) .modal-sheet'))return;
    let target=point.trigger;
    if(!target?.isConnected||!target.getClientRects().length)target=point.txId?[...document.querySelectorAll('[data-tx-open]')].find(el=>el.dataset.txOpen===point.txId):null;
    if(!target?.getClientRects().length)target=fallback;
    target?.focus({preventScroll:true});
    window.scrollTo({left:point.x,top:point.y,behavior:'instant'});
  }
  window.FintexFormViewport={remember,restore};update();
})();
