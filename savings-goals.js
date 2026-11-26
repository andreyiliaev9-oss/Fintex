/* Local savings envelopes. The original goal stays primary; pockets reserve money too. */
(() => {
  'use strict';
  const M=FintexMath, model=FintexGoalsModel,dialog=document.getElementById('savings-goals-dialog'),body=document.getElementById('sg-dialog-body'),mount=document.getElementById('savings-goals');
  const covers={reserve:'Подушка',travel:'Путешествие',home:'Дом',tech:'Техника'};
  let selected='primary',mode='list',draftCover='reserve',draftPhoto='',busy=false,focusBefore=null,photoEpoch=0;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const items=()=>[{...state.goal,id:'primary'},...(Array.isArray(state.goal?.pockets)?state.goal.pockets:[])];
  const get=id=>id==='primary'?state.goal:items().find(g=>g.id===id);
  const image=g=>/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(g?.photo||'')?g.photo:`assets/goals/${Object.hasOwn(covers,g?.cover)?g.cover:'reserve'}.svg`;
  const percent=g=>{const saved=Math.max(0,M.money(g.saved)),target=Math.max(.01,M.money(g.target)||10000);return saved>=target?100:Math.min(99,Math.round(saved/target*100));};
  function prediction(g){const f=model.forecast({...g,target:M.money(g.target)||10000},TODAY);return !f.remaining?'Цель достигнута':!f.months?'Укажите взнос — рассчитаем срок':f.date?`Ориентир · ${new Date(f.date+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}`:'Горизонт больше 100 лет';}
  function card(g){return `<button type="button" class="sg-card" data-sg-open="${esc(g.id)}"><span class="sg-cover"><img src="${image(g)}" alt="" loading="lazy"/><span class="sg-badge">${percent(g)}%${percent(g)>=100?' · ✓':''}</span></span><span class="sg-card-body">${g.id==='primary'?'<span class="sg-priority">Основная цель</span>':''}<strong>${esc(g.title||'Финансовая подушка')}</strong><span class="sg-card-amount"><small>Накоплено</small><b>${fmtR(g.saved||0)}</b><small>из ${fmtR(g.target||10000)}</small></span><span class="sg-card-remaining">Осталось <b>${fmtR(Math.max(0,M.add(M.money(g.target)||10000,-M.money(g.saved))))}</b></span><span class="sg-track" role="progressbar" aria-label="Прогресс цели" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent(g)}"><span style="width:${percent(g)}%"></span></span><span class="sg-estimate">${prediction(g)}</span></span></button>`;}
  function render(){
    const list=items();mount.innerHTML=`<div class="sg-heading"><div><span class="sg-eyebrow">От желания к плану</span><h2 id="savings-goals-title">Мои цели<span class="sg-count">${list.length}</span></h2></div><button type="button" class="sg-text-button" data-sg-list>Все цели ↗</button></div><div class="sg-summary"><strong>${fmtR(M.goalSavings(state.goal))}</strong><span>отложено · уже исключено из свободных денег</span></div><div class="sg-grid">${list.slice(0,2).map(card).join('')}${list.length===1?'<button type="button" class="sg-new-tile" data-sg-add><span aria-hidden="true">+</span><strong>Следующая мечта</strong><small>Отпуск, дом или техника</small></button>':''}</div>${list.length>1?'<button type="button" class="sg-add" data-sg-add><span aria-hidden="true">+</span> Новая цель</button>':''}`;
    window.FintexMotion?.refresh();
  }
  function header(title,back=true){return `<header class="sg-dialog-header"><div><span class="sg-eyebrow">Мои цели</span><h2 id="sg-dialog-title" tabindex="-1">${esc(title)}</h2></div><button type="button" class="sg-close" data-sg-close aria-label="Закрыть цели">×</button></header>${back?'<button type="button" class="sg-back" data-sg-back>← Все цели</button>':''}`;}
  function status(text){const el=body.querySelector('[data-sg-status]');if(el)el.textContent=text;else toast(text);}
  function commit(next){
    try{localStorage.setItem('fp_goal',JSON.stringify(next));}catch(_){status('Не удалось сохранить: хранилище заполнено. Уменьшите фото или удалите обложку.');return false;}
    state.goal=next;window.dispatchEvent(new Event('filely:financial-data-updated'));renderAll(false);return true;
  }
  function update(next,id,fn){const g=id==='primary'?next:next.pockets?.find(g=>g.id===id);if(g)fn(g);return next;}
  const clone=()=>JSON.parse(JSON.stringify(state.goal));
  function show(nextMode='list',id='primary'){
    mode=nextMode;selected=id;photoEpoch++;
    if(mode==='list')body.innerHTML=header('У каждого желания — свой путь',false)+`<p class="sg-note">Резервируйте деньги на важное. Это части вашего баланса, а не отдельные банковские счета.</p><div class="sg-grid">${items().map(card).join('')}</div><button type="button" class="sg-add" data-sg-add>+ Новая цель</button><p class="sg-note">Цели и фото хранятся только в этом браузере. Не очищайте данные сайта.</p>`;
    else if(mode==='detail'){
      const g=get(id);if(!g)return show();
      const f=model.forecast({...g,target:M.money(g.target)||10000},TODAY);
      body.innerHTML=header(g.title||'Финансовая подушка')+`<div class="sg-detail-art sg-cover"><img src="${image(g)}" alt=""/><span class="sg-badge">${percent(g)>=100?'Цель достигнута ✓':percent(g)+'% пути'}</span></div><section class="sg-detail-progress"><span class="sg-eyebrow">Уже отложено</span><strong>${fmtR(g.saved||0)} <small>из ${fmtR(g.target||10000)}</small></strong><div class="sg-track" role="progressbar" aria-label="Прогресс цели" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent(g)}"><span style="width:${percent(g)}%"></span></div><p>${f.remaining?'Осталось '+fmtR(f.remaining):'Получилось! Можно выбрать следующее желание.'}</p></section><section class="sg-forecast"><span aria-hidden="true">◷</span><div><strong>${prediction(g)}</strong><p>${M.money(g.monthly)>0?`При взносе ${fmtR(g.monthly)} в месяц. Первый — через месяц. Без процентов и инфляции; это сценарий, не гарантия.`:'Добавьте плановый взнос в настройках цели. Автоматических списаний не будет.'}</p></div></section><form id="sg-transfer-form" class="sg-transfer"><label for="sg-amount">Сумма, ₽</label><input id="sg-amount" type="text" inputmode="decimal" autocomplete="off" placeholder="Например, 1 000" maxlength="20" required/><div class="sg-quick">${[500,1000,5000].map(n=>`<button type="button" data-sg-amount="${n}">${fmtR(n)}</button>`).join('')}</div><small>Свободно для пополнения: ${fmtR(calcMetrics().freePool)}</small><div class="sg-actions"><button class="sg-primary" type="submit">Отложить</button><button type="button" class="sg-secondary" data-sg-release>В доступные</button></div><p class="sg-note">Баланс карты не меняется. Возврат в доступные снимает резерв, но не создаёт доход.</p><p role="status" aria-live="polite" data-sg-status></p></form><button type="button" class="sg-add" data-sg-edit>Обложка и настройки цели <span aria-hidden="true">↗</span></button>`;
    }else{
      const g=id==='new'?{title:'',target:'',monthly:'',cover:'travel'}:get(id);if(!g)return show();
      draftCover=Object.hasOwn(covers,g.cover)?g.cover:'reserve';draftPhoto=g.photo||'';busy=false;
      body.innerHTML=header(id==='new'?'Что хочется осуществить?':'Настроить цель')+`<form id="sg-edit-form"><div class="sg-detail-art sg-cover"><img id="sg-cover-preview" src="${image(g)}" alt="Обложка цели"/></div><fieldset class="sg-cover-choices"><legend>Выберите настроение</legend>${Object.entries(covers).map(([key,label])=>`<button type="button" data-sg-cover="${key}" aria-pressed="${!draftPhoto&&draftCover===key}"><img src="assets/goals/${key}.svg" alt=""/>${label}</button>`).join('')}</fieldset><div class="sg-photo-actions"><label class="sg-text-button" for="sg-photo">Загрузить своё фото<input type="file" accept="image/jpeg,image/png,image/webp" id="sg-photo"/></label><button type="button" class="sg-text-button" data-sg-clear-photo>Убрать фото</button></div><p class="sg-note">До 8 МБ. Фото сжимается на устройстве, никуда не отправляется.</p><label class="sg-field" for="sg-goal-name">Название<input id="sg-goal-name" value="${esc(g.title)}" maxlength="60" required placeholder="Например, отпуск у моря"/></label><label class="sg-field" for="sg-target">Сумма цели, ₽<input id="sg-target" type="text" inputmode="decimal" value="${esc(g.target)}" maxlength="20" required placeholder="120 000"/></label><label class="sg-field" for="sg-monthly">Плановый взнос в месяц, ₽<input id="sg-monthly" type="text" inputmode="decimal" value="${esc(g.monthly||'')}" maxlength="20" placeholder="Необязательно"/></label><p id="sg-live-forecast" class="sg-forecast-line" aria-live="polite"></p><p class="sg-note">План не списывает деньги автоматически. Дату считаем от сегодняшнего дня, первый взнос — через месяц.</p><p role="status" aria-live="polite" data-sg-status></p><button type="submit" class="sg-primary sg-full">${id==='new'?'Создать цель':'Сохранить изменения'}</button></form>${id!=='new'&&id!=='primary'?'<details class="sg-delete"><summary>Удалить цель</summary><p>Накопления этой цели вернутся в доступные деньги. Баланс карты и операции не изменятся.</p><button type="button" class="sg-danger" data-sg-delete>Удалить и освободить резерв</button></details>':''}`;
      liveForecast();
    }
    if(dialog.open){body.querySelector('h2')?.focus({preventScroll:true});dialog.scrollTop=0;window.FintexMotion?.reveal(body);}
  }
  function liveForecast(){const out=body.querySelector('#sg-live-forecast');if(!out)return;const target=M.parse(body.querySelector('#sg-target').value),monthly=M.parse(body.querySelector('#sg-monthly').value||'0');out.textContent=target>0&&monthly!==null&&monthly>=0?prediction({target,monthly,saved:selected==='new'?0:get(selected)?.saved||0}):'Введите положительную сумму цели и неотрицательный взнос, до двух знаков после запятой.';}
  function open(id){focusBefore=document.activeElement;closeModals();show(id?'detail':'list',id||'primary');dialog.showModal();body.querySelector('h2')?.focus({preventScroll:true});window.FintexMotion?.reveal(body);}
  function transfer(release=false){
    const input=body.querySelector('#sg-amount'),amount=M.parse(input.value),g=get(selected);
    if(amount===null||amount<=0){status('Введите положительную сумму с точностью до копейки.');return;}
    if(!g)return;
    if(amount>(release?M.money(g.saved):calcMetrics().freePool)){status(release?'В этой цели недостаточно накоплений.':'Недостаточно свободных денег с учётом платежей и других целей.');return;}
    const previous=M.money(g.saved),next=update(clone(),selected,item=>item.saved=M.add(item.saved,release?-amount:amount));
    if(!commit(next))return;
    window.FintexBehavior?.recordSaving(release?-amount:amount);show('detail',selected);
    const completed=!release&&previous<M.money(g.target)&&M.add(previous,amount)>=M.money(g.target);
    if(!release)window.dispatchEvent(new CustomEvent('fintex:goal-funded',{detail:{completed}}));
    status(completed?'Цель достигнута! Отличная работа.':release?`${fmtR(amount)} снова доступны.`:`Отложено ${fmtR(amount)}. Ещё шаг к цели!`);
    window.FintexMotion?.goalPulse(body,completed);body.querySelector('#sg-amount')?.focus({preventScroll:true});
  }
  function save(event){
    event.preventDefault();if(busy){status('Подождите, фото ещё обрабатывается.');return;}
    const title=body.querySelector('#sg-goal-name').value.trim(),target=M.parse(body.querySelector('#sg-target').value),monthly=M.parse(body.querySelector('#sg-monthly').value||'0');
    if(!title||target===null||target<=0||monthly===null||monthly<0){status('Проверьте название и суммы. Цель должна быть больше нуля, взнос — неотрицательным, до двух знаков после запятой.');return;}
    const next=clone();let id=selected;
    if(id==='new'){
      if(items().length>=12){status('Можно создать до 12 целей. Завершите или удалите ненужную.');return;}
      id='goal-'+crypto.randomUUID();next.pockets=[...(Array.isArray(next.pockets)?next.pockets:[]),{id,title,target,monthly,saved:0,cover:draftCover,photo:draftPhoto}];
    }else update(next,id,g=>Object.assign(g,{title,target,monthly,cover:draftCover,photo:draftPhoto}));
    if(commit(next)){show('detail',id);status('Цель сохранена.');window.FintexMotion?.goalPulse(body,false);}
  }
  async function photo(file){
    if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024){status('Выберите JPG, PNG или WebP до 8 МБ.');return;}
    busy=true;const ticket=++photoEpoch,form=body.querySelector('#sg-edit-form'),button=form.querySelector('[type=submit]');button.disabled=true;
    const url=URL.createObjectURL(file);
    try{
      const img=new Image();img.src=url;await img.decode();if(!form.isConnected||ticket!==photoEpoch)return;
      const ratio=Math.min(1,800/Math.max(img.width,img.height)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*ratio));canvas.height=Math.max(1,Math.round(img.height*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#f6f2e8';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);const data=canvas.toDataURL('image/jpeg',.78);
      if(data.length>450000)throw new Error('large');draftPhoto=data;body.querySelector('#sg-cover-preview').src=data;body.querySelectorAll('[data-sg-cover]').forEach(el=>el.setAttribute('aria-pressed','false'));status('Фото готово. Нажмите «Сохранить», чтобы применить.');
    }catch(_){if(form.isConnected&&ticket===photoEpoch)status('Не удалось обработать фото. Попробуйте другое изображение.');}
    finally{URL.revokeObjectURL(url);if(form.isConnected&&ticket===photoEpoch){busy=false;button.disabled=false;}}
  }
  function click(event){
    const el=event.target.closest('button');if(!el)return;
    if(el.hasAttribute('data-sg-close'))dialog.close();
    else if(el.hasAttribute('data-sg-list'))open();
    else if(el.hasAttribute('data-sg-add')){if(!dialog.open)open();show('edit','new');}
    else if(el.hasAttribute('data-sg-open')){if(dialog.open)show('detail',el.dataset.sgOpen);else open(el.dataset.sgOpen);}
    else if(el.hasAttribute('data-sg-back'))show();
    else if(el.hasAttribute('data-sg-edit'))show('edit',selected);
    else if(el.hasAttribute('data-sg-amount')){body.querySelector('#sg-amount').value=el.dataset.sgAmount;}
    else if(el.hasAttribute('data-sg-release'))transfer(true);
    else if(el.hasAttribute('data-sg-cover')||el.hasAttribute('data-sg-clear-photo')){photoEpoch++;busy=false;body.querySelector('#sg-edit-form [type=submit]').disabled=false;draftPhoto='';draftCover=el.dataset.sgCover||draftCover;const photoInput=body.querySelector('#sg-photo');photoInput.value='';body.querySelector('#sg-cover-preview').src=`assets/goals/${draftCover}.svg`;body.querySelectorAll('[data-sg-cover]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sgCover===draftCover)));}
    else if(el.hasAttribute('data-sg-delete')&&selected!=='primary'){
      const g=get(selected),next=clone();next.pockets=next.pockets.filter(g=>g.id!==selected);if(commit(next)){if(g?.saved)window.FintexBehavior?.recordSaving(-g.saved);show();toast('Цель удалена. Её резерв снова доступен.');}
    }
  }
  mount.addEventListener('click',click);body.addEventListener('click',click);
  body.addEventListener('submit',event=>{if(event.target.id==='sg-edit-form')save(event);else if(event.target.id==='sg-transfer-form'){event.preventDefault();transfer();}});
  body.addEventListener('input',event=>{if(['sg-target','sg-monthly'].includes(event.target.id))liveForecast();});body.addEventListener('change',event=>{if(event.target.id==='sg-photo')photo(event.target.files?.[0]);});
  dialog.addEventListener('close',()=>{const target=focusBefore?.isConnected&&focusBefore.getClientRects().length?focusBefore:mount.querySelector('[data-sg-list]');target?.focus({preventScroll:true});});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();});
  window.FintexGoals={open,render};render();
})();
