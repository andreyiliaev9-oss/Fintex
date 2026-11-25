/* My tree: recorded 30-day cash flow selects a species, savings remain a
 * separate goal. Artwork sways in a stronger breeze while visible; no animation loop
 * rewrites the DOM, and motion preferences always win. */
(() => {
  'use strict';
  if (window.__FILELY_TREE_V4__) return;
  window.__FILELY_TREE_V4__ = true;
  const ROOT_ID='filely-financial-tree', MOUNT_ID='filely-financial-tree-mount';
  const model=window.FintexTreeModel;
  if (!model) return;
  let scheduled=false, detailsOpen=false, card=null, observer=null, inView=true;
  let midnightTimer;
  const money=v=>`${Math.max(0,Number(v)||0).toLocaleString('ru-RU',{maximumFractionDigits:0})} ₽`;
  const read=(key,fallback)=>{try {const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw);}catch(_){return fallback;}};
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  function hidden(el) { return el && (el.classList.contains('hidden') || el.hidden || el.style.display==='none'); }
  function pauseMotion() {
    if (!card) return;
    const paused=document.hidden || !inView || hidden(document.getElementById('view-home'));
    card.dataset.animationPaused=String(paused);
  }
  function mountCard() {
    const home=document.getElementById('view-home');
    if (!home) return false;
    let mount=document.getElementById(MOUNT_ID);
    if (!mount) {
      mount=document.createElement('div'); mount.id=MOUNT_ID; mount.dataset.ftxKeep='1';
      const hero=home.querySelector('#hero-card-stage');
      if (hero?.parentNode===home) hero.after(mount); else home.prepend(mount);
    }
    if (!home.contains(mount)) home.append(mount);
    mount.classList.remove('hidden'); mount.hidden=false;
    if (mount.style.display==='none') mount.style.removeProperty('display');
    if (!card || !mount.contains(card)) {
      observer?.disconnect();
      document.getElementById(ROOT_ID)?.remove();
      card=document.createElement('section');card.id=ROOT_ID;card.setAttribute('aria-labelledby','ft-title');
      card.innerHTML=`<div class="ft-head"><div><div class="ft-kicker">Ваш финансовый ритм</div><h3 id="ft-title" class="ft-title">Моё дерево</h3></div><span class="ft-stage" role="status" aria-live="polite"></span></div>
        <div class="ft-body"><div><div class="ft-label">Накоплено</div><div class="ft-saved"></div><div class="ft-sub"></div><div class="ft-bar"><span></span></div></div>
        <button type="button" class="ft-art-wrap" aria-label="Открыть финансовую подушку"><span class="ft-aura" aria-hidden="true"></span><span class="ft-art-motion"><img class="ft-img" width="280" height="280" alt="" /></span><span class="ft-wind-leaves" aria-hidden="true"><i class="ft-wind-leaf"></i><i class="ft-wind-leaf"></i><i class="ft-wind-leaf"></i></span></button></div>
        <div class="ft-foot"><div class="ft-note"></div><div class="ft-actions"><button type="button" class="ft-topup">+ Пополнить</button><button type="button" class="ft-more" aria-controls="ft-details">Подробнее</button></div></div>
        <div id="ft-details" class="ft-details" hidden><p class="ft-flow"></p><p>Вид зависит от записанных доходов и расходов за последние 30 календарных дней, включая сегодня. Переводы, снятие наличных, возвраты и операции без корректной даты не участвуют. Считаем только рубли.</p><p>Молодое дерево — пока нет обеих сторон учёта. Берёза — расходы выше доходов; ель — больше 90% и до 100%; клён — больше 70% и до 90%; дуб — до 70% включительно.</p><p>Это условный образ, не оценка вашего достатка и не прогноз. Крупная покупка или неполный учёт могут изменить вид. Накопления и прогресс цели показаны отдельно.</p></div>`;
      mount.append(card);
      const openGoal=()=>window.openGoalDetailsModal?.();
      card.querySelector('.ft-art-wrap').addEventListener('click',openGoal);
      card.querySelector('.ft-topup').addEventListener('click',openGoal);
      card.querySelector('.ft-more').addEventListener('click',()=>{detailsOpen=!detailsOpen;updateDetails();});
      card.querySelector('.ft-img').addEventListener('error',event=>{
        // Inline, local fallback remains visible even if asset loading fails.
        const img=event.currentTarget;
        img.hidden=true;
        const wrap=card.querySelector('.ft-art-motion');
        if (!wrap.querySelector('svg')) wrap.insertAdjacentHTML('beforeend','<svg class="ft-svg-art" viewBox="0 0 160 180" role="img" aria-label="Молодое дерево, резервная иллюстрация"><ellipse cx="80" cy="164" rx="48" ry="9" fill="#6c9450" opacity=".3"/><path d="M80 162Q86 110 78 52M81 120L49 84M80 97L111 57" stroke="#967045" stroke-width="7" fill="none" stroke-linecap="round"/><g fill="#75a750"><ellipse cx="45" cy="72" rx="22" ry="30" transform="rotate(-35 45 72)"/><ellipse cx="116" cy="50" rx="23" ry="30" transform="rotate(30 116 50)"/><ellipse cx="76" cy="35" rx="22" ry="30"/></g></svg>');
      });
      if ('IntersectionObserver' in window) {
        observer=new IntersectionObserver(entries=>{inView=entries[0].isIntersecting;pauseMotion();},{rootMargin:'40px'});
        observer.observe(card);
      }
    }
    card.classList.remove('hidden');card.hidden=false;
    if (card.style.display==='none') card.style.removeProperty('display');
    return true;
  }
  function updateDetails() {
    card.querySelector('.ft-details').hidden=!detailsOpen;
    const button=card.querySelector('.ft-more');
    button.setAttribute('aria-expanded',String(detailsOpen));
    button.textContent=detailsOpen?'Свернуть':'Подробнее';
  }
  function render() {
    if (!mountCard()) return;
    const flow=model.summarize(read('fp_local_tx',[]));
    const goal=read('fp_goal',{}) || {};
    const saved=Math.max(0,Number(goal.saved ?? goal.current ?? goal.amount)||0);
    const target=Math.max(0,Number(goal.target ?? goal.goal)||0);
    const pct=target>0?Math.min(100,Math.round(saved/target*100)):0;
    const privacy=read('fp_privacy',0)===1;
    const text=(selector,value)=>{const el=card.querySelector(selector);if(el.textContent!==value)el.textContent=value;};
    text('.ft-stage',flow.name);
    text('.ft-saved',privacy?'•••••• ₽':money(saved));
    text('.ft-sub',privacy?'Суммы скрыты режимом «Стелс»':target?`${pct}% от цели · ${money(target)}`:'Добавьте цель, чтобы отслеживать прогресс');
    const bar=card.querySelector('.ft-bar');bar.hidden=!target;bar.querySelector('span').style.width=`${pct}%`;
    text('.ft-note',privacy?'Вид дерева отражает соотношение записанных доходов и расходов за 30 дней.':flow.note);
    text('.ft-flow',privacy?'Суммы и доля расходов скрыты режимом «Стелс».':`Период: ${flow.from} — ${flow.to}. Доходы: ${money(flow.income)}. Расходы: ${money(flow.expenses)}.${flow.ratio===null?' Для сравнения нужны и доходы, и расходы.':` Доля расходов: ${(flow.ratio*100).toLocaleString('ru-RU',{maximumFractionDigits:1})}%.`}`);
    if (card.dataset.treeVariant!==flow.variant) {
      card.dataset.treeVariant=flow.variant;
      const img=card.querySelector('.ft-img');
      img.hidden=false;card.querySelector('.ft-svg-art')?.remove();
      img.alt=`${flow.name} — ваше финансовое дерево`;
      img.src=`./assets/trees/${flow.variant}.svg?v=33`;
    }
    updateDetails();pauseMotion();
  }
  function scheduleRender() {
    if (scheduled) return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;render();});
  }
  function scheduleMidnight() {
    clearTimeout(midnightTimer);
    const now=new Date(),next=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1);
    midnightTimer=setTimeout(()=>{scheduleRender();scheduleMidnight();},next-now+100);
  }
  function boot() {
    // Existing app writes go through persistAll; this also covers direct local
    // goal/privacy writes and integrations, without polling or storage writes.
    const original=Storage.prototype.setItem;
    try { Storage.prototype.setItem=function(key,value) {
      const result=original.apply(this,arguments);
      if (this===window.localStorage && /^(fp_goal|fp_local_tx|fp_privacy)$/.test(String(key))) scheduleRender();
      return result;
    }; } catch (_) {}
    render();scheduleMidnight();
    new MutationObserver(()=>{
      const mount=document.getElementById(MOUNT_ID);
      if (!mount || !card?.isConnected || hidden(mount) || hidden(card)) scheduleRender();
      else pauseMotion();
    }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','hidden','style']});
    window.addEventListener('filely:financial-data-updated',scheduleRender);
    window.addEventListener('storage',event=>{if(event.key===null || ['fp_local_tx','fp_goal','fp_privacy'].includes(event.key))scheduleRender();});
    document.addEventListener('visibilitychange',()=>{pauseMotion();if(!document.hidden){scheduleRender();scheduleMidnight();}});
    window.addEventListener('fintex:motionchange',pauseMotion);
    motion.addEventListener?.('change',pauseMotion);
    window.FilelyFinancialTree={refresh:scheduleRender};
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
