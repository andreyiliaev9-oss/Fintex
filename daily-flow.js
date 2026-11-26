/* One deliberate create/edit/repeat flow. Financial writes happen only on submit. */
(() => {
  'use strict';
  const M=FintexMath,D=FintexDailyModel;
  let dialog,reconcile,editing=null,signature='',kind='expense',priorFocus=null,returnPoint=null,busy=false,reconcileBalance=null;
  const $=id=>document.getElementById(id);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid=()=>`tx_${crypto.randomUUID?crypto.randomUUID():Date.now()+'_'+Math.random().toString(36).slice(2)}`;
  const current=()=>editing?state.transactions.find(tx=>tx.id===editing):null;
  const say=text=>{$('flow-status').textContent=text;};
  const recent=()=>state.transactions.filter(tx=>['expense','income'].includes(tx.type)&&!tx.goal_withdrawal&&!tx.bill_id).slice().sort((a,b)=>`${b.date} ${b.time||''}`.localeCompare(`${a.date} ${a.time||''}`)).slice(0,12);
  function saveLocal(result){
    const keys=['fp_local_tx','fp_balance','fp_sync_queue','fp_ledger_offset'],before=keys.map(k=>localStorage.getItem(k));
    // The append-only cloud retains the original row. Local corrections are an overlay,
    // not a second transaction and never a silent rewrite of another device's history.
    const queue=state.syncQueue.slice(),old=state.transactions.find(tx=>tx.id===result.tx.id);
    const offset=M.add(state.ledgerOffset,result.tx.local_only?D.effect(result.tx)-D.effect(old):0);
    try{
      localStorage.setItem(keys[0],JSON.stringify(result.transactions));localStorage.setItem(keys[1],String(result.balance));localStorage.setItem(keys[2],JSON.stringify(queue));localStorage.setItem(keys[3],String(offset));
    }catch(error){
      keys.forEach((k,i)=>{try{if(before[i]===null)localStorage.removeItem(k);else localStorage.setItem(k,before[i]);}catch(_){}});
      throw Error('Не удалось сохранить. Проверьте свободное место и повторите.');
    }
    state.transactions=result.transactions;state.balance=result.balance;state.syncQueue=queue;state.ledgerOffset=offset;
    window.dispatchEvent(new Event('filely:financial-data-updated'));
    renderAll(false);updateSyncQueueUI();
    if(result.tx.local_only&&window.FintexSync?.active())window.FintexSync.sync();
    if(!result.tx.local_only)Promise.resolve(pushTransactionsToBackend([result.tx])).catch(()=>toast('Запись сохранена на устройстве. Облако пока недоступно.'));
  }
  function close(){if(dialog.open)dialog.close();if(reconcile.open)reconcile.close();}
  function setKind(value){
    kind=value;
    dialog.querySelectorAll('[data-flow-kind]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.flowKind===value)));
    $('flow-category-row').hidden=value!=='expense';$('flow-transfer').hidden=value!=='transfer';
    $('flow-name').placeholder=value==='income'?'Например, зарплата':value==='transfer'?'Например, на свою карту':'Например, кофе';
    $('flow-type-note').textContent=value==='transfer'?'Оба счёта уже должны входить в общий остаток. Это только запись, не банковский перевод.':editing?'Состав чека остаётся исходным. Статус сохранения — у операции.':'';
    $('flow-recent').hidden=!!editing||value==='transfer';say('');preview();
  }
  function preview(){
    const amount=M.parse($('flow-amount').value),old=current(),next=M.add(state.balance,-D.effect(old),kind==='income'?(amount||0):kind==='expense'?-(amount||0):0);
    const out=$('flow-after');out.hidden=amount===null||amount<=0||old?.type==='adjustment';
    if(!out.hidden)FintexNumerals.render($('flow-after-value'),next);
  }
  function templates(){
    const list=recent().filter((tx,i,rows)=>rows.findIndex(t=>t.type===tx.type&&t.merchant===tx.merchant&&t.category===tx.category)===i).slice(0,3);$('flow-recent').replaceChildren();
    if(!list.length)return;
    const label=document.createElement('p');label.textContent='Недавние';$('flow-recent').append(label);
    const row=document.createElement('div');row.className='flow-recent-row';
    list.forEach(tx=>{
      const b=document.createElement('button');b.type='button';const name=document.createElement('span');name.textContent=tx.merchant;const amount=document.createElement('span');FintexNumerals.render(amount,tx.amount);b.append(name,amount);
      b.addEventListener('click',()=>{setKind(tx.type);$('flow-amount').value=tx.amount;$('flow-name').value=tx.merchant;$('flow-category').value=CATS[tx.category]?tx.category:'other';preview();$('flow-amount').focus();$('flow-amount').select();});row.append(b);
    });$('flow-recent').append(row);
  }
  function open({id=null,repeat=null,date=TODAY}={}){
    const tx=id?state.transactions.find(tx=>tx.id===id):repeat?state.transactions.find(tx=>tx.id===repeat):null;
    if((id||repeat)&&!tx)return;
    if(tx?.type==='adjustment'){toast('Корректировку можно удалить через историю и выполнить сверку заново.');return;}
    priorFocus=document.activeElement;returnPoint=window.FintexSheets?.returnPoint()||window.FintexFormViewport?.remember(priorFocus);closeModals();editing=id;signature=id?JSON.stringify(tx):'';busy=false;
    $('flow-form').reset();$('flow-title').textContent=id?'Изменить операцию':repeat?'Повторить операцию':'Добавить операцию';$('flow-save').textContent=id?'Сохранить изменения':'Записать';
    $('flow-date').value=id?tx.date:date;$('flow-date').max=TODAY;$('flow-amount').value=tx?tx.amount:'';$('flow-name').value=tx?.merchant||'';
    $('flow-category').querySelectorAll('[data-custom-category]').forEach(o=>o.remove());
    if(tx?.category&&!CATS[tx.category]){const option=document.createElement('option');option.value=tx.category;option.textContent=tx.category;option.dataset.customCategory='1';$('flow-category').append(option);}
    $('flow-category').value=tx?.category||recent().find(t=>t.type==='expense')?.category||'other';
    if(!$('flow-category').value)$('flow-category').value='other';
    $('flow-from').value=tx?.transfer_from||'';$('flow-to').value=tx?.transfer_to||'';
    $('flow-covered').checked=!!(id&&tx?.type==='transfer');
    const protectedTx=!!(id&&D.locked(tx));
    $('flow-amount').disabled=protectedTx;$('flow-date').disabled=protectedTx;dialog.querySelectorAll('[data-flow-kind]').forEach(b=>b.disabled=protectedTx);
    $('flow-lock-note').hidden=!protectedTx;
    templates();setKind(tx?.type||'expense');dialog.showModal();
    (protectedTx?$('flow-name'):$('flow-amount')).focus({preventScroll:true});
  }
  function submit(event){
    event.preventDefault();if(busy)return;
    const old=current();if(editing&&JSON.stringify(old)!==signature){say('Запись изменилась. Откройте её заново, чтобы не потерять изменения.');return;}
    const draft={type:kind,amount:$('flow-amount').value,date:$('flow-date').value,merchant:$('flow-name').value.trim()||(kind==='income'?'Доход':kind==='transfer'?'Между своими счетами':CATS[$('flow-category').value]?.name||'Покупка'),category:$('flow-category').value,from:$('flow-from').value,to:$('flow-to').value,covered:$('flow-covered').checked};
    const result=D.change(state.balance,state.transactions,draft,TODAY,editing,uid());
    if(result.error){say(result.error);return;}
    if(Math.abs(result.balance)>1e12){say('Итоговый остаток слишком велик. Проверьте сумму.');return;}
    busy=true;try{saveLocal(result);dialog.close();toast(editing?'Изменения сохранены':'Операция записана');}catch(error){say(error.message);}finally{busy=false;}
  }
  function moneyRow(label,value,id='') {return `<div class="flow-equation-row"><span>${label}</span><strong class="money-val" ${id?`id="${id}"`:''} data-flow-money="${value}"></strong></div>`;}
  function reconcilePreview(){
    reconcileBalance=state.balance;
    const actual=M.parse($('flow-actual').value),delta=actual===null?null:M.add(actual,-state.balance);
    $('flow-confirm').checked=false;$('reconcile-status').textContent='';
    $('flow-difference').hidden=delta===null;
    if(delta!==null){FintexNumerals.render($('flow-difference-value'),Math.abs(delta),delta>0?'+':delta<0?'−':'');$('flow-difference-title').textContent=delta===0?'Остатки совпадают':'Разница с приложением';}
    $('flow-confirm-row').hidden=delta===null||delta===0;$('reconcile-save').disabled=delta===null||delta===0;
  }
  function openReconcile(){
    priorFocus=document.activeElement;returnPoint=window.FintexSheets?.returnPoint()||window.FintexFormViewport?.remember(priorFocus);closeModals();busy=false;
    const r=D.reconciliation(state.balance,state.transactions);
    $('flow-equation').innerHTML=moneyRow('Начало по текущей истории',r.opening)+moneyRow('+ Доходы',r.income)+moneyRow('− Расходы',r.expense)+moneyRow('± Корректировки',r.adjustments)+moneyRow('= В приложении',r.balance);
    $('flow-equation').querySelectorAll('[data-flow-money]').forEach(el=>FintexNumerals.render(el,Number(el.dataset.flowMoney)));
    $('reconcile-form').reset();reconcilePreview();reconcile.showModal();$('flow-actual').focus({preventScroll:true});
  }
  function reconcileSubmit(event){
    event.preventDefault();if(busy)return;
    if(reconcileBalance!==state.balance){reconcilePreview();$('reconcile-status').textContent='Остаток изменился. Проверьте новую разницу и подтвердите снова.';return;}
    if(!$('flow-confirm').checked){$('reconcile-status').textContent='Подтвердите запись разницы отдельной корректировкой.';return;}
    const result=D.adjust(state.balance,state.transactions,$('flow-actual').value,TODAY,uid(),$('flow-reason').value);
    if(result.error){$('reconcile-status').textContent=result.error;return;}if(result.unchanged){reconcile.close();return;}
    if(result.tx.amount>1e12){$('reconcile-status').textContent='Разница слишком велика. Проверьте остаток.';return;}
    busy=true;try{saveLocal(result);reconcile.close();toast('Корректировка записана. Старые операции не изменены.');}catch(error){$('reconcile-status').textContent=error.message;}finally{busy=false;}
  }
  function boot(){
    dialog=document.createElement('dialog');dialog.id='daily-flow';dialog.className='daily-dialog';dialog.setAttribute('aria-labelledby','flow-title');dialog.setAttribute('aria-modal','true');
    dialog.innerHTML=`<header class="flow-header"><h2 id="flow-title">Добавить операцию</h2><button type="button" data-flow-close aria-label="Закрыть">×</button></header><form id="flow-form" novalidate><div class="flow-types" aria-label="Вид операции">${[['expense','Расход'],['income','Доход'],['transfer','Перевод']].map(([id,name])=>`<button type="button" data-flow-kind="${id}" aria-pressed="false">${name}</button>`).join('')}</div><label class="flow-field flow-amount-field" for="flow-amount">Сумма, ₽<input id="flow-amount" inputmode="decimal" autocomplete="off" maxlength="20" placeholder="0"/></label><section id="flow-recent"></section><label class="flow-field" for="flow-name">Где или за что<input id="flow-name" maxlength="100" autocomplete="off"/></label><div class="flow-field-grid"><label class="flow-field" id="flow-category-row" for="flow-category">Категория<select id="flow-category">${Object.values(CATS).map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label><label class="flow-field" for="flow-date">Дата<input id="flow-date" type="date"/></label></div><div id="flow-transfer" hidden><div class="flow-field-grid"><label class="flow-field" for="flow-from">Откуда<input id="flow-from" maxlength="60" placeholder="Своя карта"/></label><label class="flow-field" for="flow-to">Куда<input id="flow-to" maxlength="60" placeholder="Свои наличные"/></label></div><label class="flow-check"><input type="checkbox" id="flow-covered"/>Оба счёта уже входят в общий остаток</label></div><p id="flow-lock-note" class="flow-note" hidden>Запись связана с платежом или целью. Сумму, дату и вид меняйте через соответствующий раздел.</p><p id="flow-type-note" class="flow-note"></p><p id="flow-after" class="flow-after" hidden>После записи <strong id="flow-after-value" class="money-val"></strong></p><p id="flow-status" class="flow-status" role="status" aria-live="polite"></p><button id="flow-save" class="flow-primary" type="submit">Записать</button><button type="button" id="flow-tools" class="flow-secondary">Чек или голос</button></form>`;
    reconcile=document.createElement('dialog');reconcile.id='daily-reconcile';reconcile.className='daily-dialog';reconcile.setAttribute('aria-labelledby','reconcile-title');reconcile.setAttribute('aria-modal','true');
    reconcile.innerHTML=`<header class="flow-header"><h2 id="reconcile-title">Сверить остаток</h2><button type="button" data-flow-close aria-label="Закрыть">×</button></header><div id="flow-equation"></div><p class="flow-note">Начальная сумма восстановлена из текущих записей, а не получена из банка. Сравнивайте общий остаток по тем же счетам.</p><form id="reconcile-form" novalidate><label class="flow-field" for="flow-actual">Фактически на всех учтённых счетах, ₽<input id="flow-actual" inputmode="decimal" autocomplete="off" maxlength="20" placeholder="Введите сумму из банка"/></label><div id="flow-difference" class="flow-after" hidden><span id="flow-difference-title"></span><strong id="flow-difference-value" class="money-val"></strong></div><label class="flow-field" for="flow-reason">Комментарий<input id="flow-reason" maxlength="100" placeholder="Например, неучтённая комиссия"/></label><label class="flow-check" id="flow-confirm-row" hidden><input type="checkbox" id="flow-confirm"/>Записать разницу отдельной корректировкой</label><p class="flow-note">Корректировка не считается доходом или расходом. Сначала сохраняется на устройстве; отправка зависит от подключения облака.</p><p id="reconcile-status" class="flow-status" role="status" aria-live="polite"></p><button id="reconcile-save" class="flow-primary" type="submit" disabled>Записать корректировку</button><button id="flow-bank-screen" class="flow-secondary" type="button">Выбрать скриншот банка</button></form>`;
    document.body.append(dialog,reconcile);
    [dialog,reconcile].forEach(el=>{
      el.querySelector('[data-flow-close]').addEventListener('click',()=>el.close());
      el.addEventListener('close',()=>{if(window.FintexFormViewport)window.FintexFormViewport.restore(returnPoint,$('hdr-plus-btn'));else priorFocus?.focus({preventScroll:true});});
    });
    dialog.querySelectorAll('[data-flow-kind]').forEach(b=>b.addEventListener('click',()=>setKind(b.dataset.flowKind)));
    $('flow-form').addEventListener('submit',submit);$('flow-form').addEventListener('input',preview);
    $('flow-tools').addEventListener('click',()=>{dialog.close();openSmartHubModal();});
    $('flow-bank-screen').addEventListener('click',()=>{reconcile.close();legacyBalance(true);});
    $('flow-actual').addEventListener('input',reconcilePreview);$('reconcile-form').addEventListener('submit',reconcileSubmit);
    const legacyBalance=window.openBalanceModal,legacyTx=window.openTxModal,legacyClose=window.closeModals;
    window.closeModals=function(){close();return legacyClose.apply(this,arguments);};
    window.openAddModal=()=>open();window.openAddModalForDate=date=>open({date});
    window.repeatTxById=id=>open({repeat:id});
    window.openBalanceModal=auto=>auto?legacyBalance(true):openReconcile();
    window.openTxModal=function(id){
      legacyTx(id);const tx=state.transactions.find(t=>t.id===id);if(!tx)return;
      $('mtx-cats').hidden=true;$('mtx-cats').style.display='none';
      if(tx.local_only)$('mtx-meta').append(' · На этом устройстве');
      if(tx.type==='transfer')$('mtx-meta').append(` · ${tx.transfer_from||''} → ${tx.transfer_to||''}`);
      if(window.FintexSync)$('mtx-meta').append(' · '+FintexSync.label(tx));
      const repeatButton=document.querySelector('#modal-tx [onclick="repeatSelectedTx()"]');if(repeatButton)repeatButton.hidden=tx.type==='adjustment';
      if(['transfer','adjustment'].includes(tx.type))$('mtx-meta').textContent=`${fmtR(tx.amount,tx.type==='transfer'?'↔':D.effect(tx)>0?'+':'−')} · ${tx.date} · ${tx.type==='transfer'?'Между своими счетами':'Корректировка остатка'}`;
      let edit=$('tx-edit-action');if(!edit){edit=document.createElement('button');edit.type='button';edit.id='tx-edit-action';edit.className='flow-primary';edit.textContent='Изменить операцию';$('mtx-cats').after(edit);}
      edit.hidden=tx.type==='adjustment';edit.onclick=()=>open({id});
      let note=$('tx-local-note');if(!note){note=document.createElement('p');note.id='tx-local-note';note.className='flow-note';note.textContent='Сначала сохраняется на устройстве. Статус облака указан у операции. При разных версиях потребуется сравнение.';edit.after(note);}
    };
    document.addEventListener('click',event=>{if(event.target.closest?.('#hdr-plus-btn')){event.preventDefault();event.stopImmediatePropagation();open();}},true);
    let link=$('balance-check-action');if(!link){link=document.createElement('button');link.type='button';link.id='balance-check-action';link.className='balance-check-action';link.textContent='Сверить остаток';link.addEventListener('click',openReconcile);$('hero-balance-card').append(link);}
    window.FintexDaily={open,reconcile:openReconcile,setKind,reconcileWithValue(value){openReconcile();$('flow-actual').value=String(value);reconcilePreview();}};
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
