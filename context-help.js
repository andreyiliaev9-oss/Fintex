/* One short, non-modal hint at the point of use. Only help preferences are saved. */
(() => {
  'use strict';
  const KEY = 'fp_help_v1';
  const topics = {
    calendar:{root:'#view-calendar',text:'Нажмите на день — увидите его траты и платежи.'},
    analytics:{root:'#view-analytics',text:'Выберите период, чтобы сравнить доходы и расходы.'},
    goals:{root:'#savings-goals',text:'Добавьте цель, затем пополняйте её.'}
  };
  const seen = new Set();
  try { const saved=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(saved))saved.forEach(k=>{if(Object.hasOwn(topics,k))seen.add(k);}); } catch (_) {}
  let frame;
  const visible = el => el && el.getClientRects().length && getComputedStyle(el).visibility!=='hidden';
  const blocked = () => document.hidden || document.documentElement.classList.contains('fintex-tour-open') || !!document.querySelector('dialog[open], [id^="modal-"]:not(.hidden), #onboarding-screen:not(.hidden), #returning-splash:not(.hidden)');
  function remember(key){seen.add(key);try{localStorage.setItem(KEY,JSON.stringify([...seen]));}catch(_){} }
  function clear(){document.querySelectorAll('[data-context-help]').forEach(el=>el.remove());}
  function show(key){
    if(!topics[key]||seen.has(key)||blocked())return;
    const mount=document.querySelector(topics[key].root);
    if(!visible(mount))return;
    const card=document.createElement('aside');card.className='context-help';card.dataset.contextHelp=key;card.setAttribute('aria-label','Подсказка');
    const text=document.createElement('p');text.textContent=topics[key].text;
    const close=document.createElement('button');close.type='button';close.textContent='Понятно';
    close.addEventListener('click',()=>{
      // Do not drop keyboard focus onto body when removing its focused button.
      const next=[...mount.querySelectorAll('button,input,select,summary,[tabindex="0"]')].find(el=>!card.contains(el)&&visible(el));
      const focused=card.contains(document.activeElement);card.remove();if(focused)next?.focus({preventScroll:true});
    });
    card.append(text,close);mount.prepend(card);remember(key);
  }
  function checkGoals(){
    if(blocked()||document.querySelector('.nav-tab[aria-current="page"]')?.dataset.nav!=='home')return;
    const mount=document.querySelector(topics.goals.root);if(!visible(mount))return;
    const r=mount.getBoundingClientRect(),dock=document.getElementById('fintex-navigation')?.getBoundingClientRect().top||innerHeight;
    if(r.top>=0&&r.top<dock-70)show('goals');
  }
  function scheduleGoals(){if(frame)return;frame=requestAnimationFrame(()=>{frame=null;checkGoals();});}
  function boot(){
    window.addEventListener('fintex:tabchange',event=>{
      clear();const name=event.detail.name;
      if(name==='home')scheduleGoals();else requestAnimationFrame(()=>show(name));
    });
    window.addEventListener('fintex:tour-started',clear);
    window.addEventListener('fintex:tour-finished',event=>{
      for(const id of event.detail.topics||[])if(Object.hasOwn(topics,id))remember(id);
      clear();
    });
    // Only observe the goals section itself; no global DOM polling/observer loop.
    const goals=document.querySelector(topics.goals.root);
    if(goals&&window.IntersectionObserver)new IntersectionObserver(scheduleGoals,{threshold:[0,.2]}).observe(goals);
    window.addEventListener('scroll',scheduleGoals,{passive:true});
    window.addEventListener('pagehide',()=>{cancelAnimationFrame(frame);frame=null;clear();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
