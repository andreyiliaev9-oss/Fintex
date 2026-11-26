/* Focus ownership for legacy sheets. Native dialogs keep their own lifecycle. */
(() => {
  'use strict';
  const roots=[...document.querySelectorAll('[id^="modal-"]')].filter(el=>el.querySelector('.modal-sheet'));
  const stack=[],records=new WeakMap(),inertBefore=new Map();let lastOutside=document.activeElement;
  const visible=el=>el?.isConnected&&!el.classList.contains('hidden')&&!!el.getClientRects().length;
  const nativeOpen=()=>document.querySelector('dialog[open]');
  const top=()=>stack.at(-1);
  const focusable=root=>[...root.querySelectorAll('button,input,textarea,select,a[href],[tabindex]')].filter(el=>!el.disabled&&el.tabIndex>=0&&!el.closest('[inert],[hidden]')&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  function focusStart(root){
    if(!root||nativeOpen()||root.contains(document.activeElement))return;
    const sheet=root.querySelector('.modal-sheet');sheet.tabIndex=-1;sheet.focus({preventScroll:true});
  }
  function lock(){
    document.documentElement.classList.toggle('fintex-modal-open',!!stack.length);
    if(stack.length){for(const el of document.querySelectorAll('body > main,body > header,body > nav,#capture-fab')){if(!inertBefore.has(el))inertBefore.set(el,el.inert);el.inert=true;}}
    else {for(const [el,value]of inertBefore)el.inert=value;inertBefore.clear();}
  }
  function restore(record){
    if(nativeOpen())return;
    if(top()){focusStart(top());return;}
    let target=record?.trigger;
    if(!target?.isConnected&&record?.txId)target=[...document.querySelectorAll('[data-tx-open]')].find(el=>el.dataset.txOpen===record.txId);
    if(!target?.isConnected||!target.getClientRects().length)target=document.querySelector('.nav-tab[aria-current="page"]');
    target?.focus({preventScroll:true});
    window.FintexFormViewport?.restore(record?.position,target);
  }
  function sync(){
    let closed;
    // Close before opening to retain the original launcher across same-turn sheet changes.
    for(const root of [...stack])if(!visible(root)){closed=records.get(root);stack.splice(stack.indexOf(root),1);root.removeAttribute('aria-modal');root.setAttribute('aria-hidden','true');root.style.removeProperty('z-index');}
    for(const root of roots)if(visible(root)&&!stack.includes(root)){
      const active=document.activeElement,trigger=root.contains(active)?lastOutside:active;
      records.set(root,{trigger,txId:trigger?.dataset?.txOpen,position:closed?.position||window.FintexFormViewport?.remember(trigger)});stack.push(root);
      root.setAttribute('aria-modal','true');root.removeAttribute('aria-hidden');
    }
    stack.forEach((root,i)=>root.style.zIndex=String(50+i*2));lock();
    if(top())focusStart(top());else if(closed)restore(closed);
  }
  roots.forEach((root,i)=>{
    root.setAttribute('role','dialog');
    const sheet=root.querySelector('.modal-sheet'),heading=sheet.querySelector('h1,h2,h3,.text-base.font-bold,.text-sm.font-bold');
    if(heading){if(!heading.id)heading.id=`sheet-title-${i}`;root.setAttribute('aria-labelledby',heading.id);}else root.setAttribute('aria-label','Окно Fintex');
    const close=sheet.querySelector('button[onclick*="closeModals"]');if(close&&!close.hasAttribute('aria-label')&&!close.textContent.trim())close.setAttribute('aria-label','Закрыть окно');
    if(!visible(root))root.setAttribute('aria-hidden','true');
  });
  const observer=new MutationObserver(sync);roots.forEach(root=>observer.observe(root,{attributes:true,attributeFilter:['class']}));
  document.addEventListener('focusin',event=>{if(nativeOpen())return;const root=top();if(root&&!root.contains(event.target)){focusStart(root);}else if(!root)lastOutside=event.target;});
  document.addEventListener('keydown',event=>{
    if(nativeOpen())return;const root=top();if(!root)return;
    if(event.key==='Escape'){
      event.preventDefault();event.stopPropagation();
      // Invoke the real close control: e.g. voice sheets must stop recognition too.
      const close=root.querySelector('.modal-sheet button[onclick*="closeModals"]');if(close)close.click();else window.closeModals?.();
    }else if(event.key==='Tab'){
      const list=focusable(root),first=list[0],last=list.at(-1);
      if(!first){event.preventDefault();root.querySelector('.modal-sheet').focus({preventScroll:true});return;}
      if(event.shiftKey&&(document.activeElement===first||!list.includes(document.activeElement))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(document.activeElement===last||!list.includes(document.activeElement))){event.preventDefault();first.focus();}
    }
  });
  window.FintexSheets={returnPoint:()=>records.get(stack[0])?.position};
  sync();
})();
