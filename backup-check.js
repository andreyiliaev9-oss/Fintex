/* Separate read-only file check: cannot invoke restoration or cloud synchronization. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id),B=FintexBackupModel;
 let checked=null,epoch=0,trigger=null,externalChange=false;
 const dialog=document.createElement('dialog');dialog.id='backup-check-dialog';dialog.className='daily-dialog';dialog.setAttribute('aria-labelledby','backup-check-title');
 dialog.innerHTML='<header class="flow-header"><h2 id="backup-check-title">Проверка файла</h2><button type="button" id="backup-check-close" aria-label="Закрыть">×</button></header><p class="flow-note">Проверка ничего не восстанавливает, не объединяет и не отправляет в облако.</p><p id="backup-check-status" role="status" aria-live="polite" class="flow-status"></p><div id="backup-check-report" hidden></div><button type="button" id="backup-check-current" class="flow-secondary" hidden>Сравнить с устройством ещё раз</button><p class="flow-note">Контрольная сумма помогает обнаружить повреждение, но не доказывает, кто создал файл. Проверяйте только свою копию. Файл не зашифрован. Оригиналы чеков, оформление и данные входа в эту проверку не входят.</p>';
 document.body.append(dialog);
 const status=text=>{$('backup-check-status').textContent=text;};
 const date=value=>new Date(value).toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'});
 function row(label,value,money=false){const box=document.createElement('div');box.className='flow-equation-row';const a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;if(money)FintexNumerals.render(b,value);else b.textContent=String(value);box.append(a,b);return box;}
 function compare(){
  if(!checked||!dialog.open)return;
  const expanded=$('backup-check-details')?.open,restoreFocus=document.activeElement===$('backup-check-details')?.querySelector('summary');
  const report=$('backup-check-report');report.replaceChildren();report.hidden=false;$('backup-check-current').hidden=false;
  report.append(row('Дата файла',date(checked.createdAt)),row('Профиль в файле',checked.data.name),row('Операций в файле',checked.data.transactions.length),row('Остаток в файле',checked.data.balance,true));
  try{
   if(externalChange)throw Error('stale tab');
   const device=B.snapshot(state,localStorage),comparison=FintexBackupCheckModel.compare(device,checked.data),tx=comparison.transactions;
   const heading=document.createElement('h3');heading.id='backup-check-result';heading.textContent=comparison.same?'Данные копии совпадают с устройством':'Файл исправен, но данные отличаются';report.append(heading);
   const note=document.createElement('p');note.className='flow-note';note.textContent='Сравнение выполнено '+new Date().toLocaleTimeString('ru-RU')+'. Совпадение относится только к разделам финансовой копии, не к облаку или всему хранилищу браузера.';report.append(note);
   report.append(row('Сейчас операций на устройстве',device.transactions.length),row('Сейчас остаток на устройстве',device.balance,true));
   const list=document.createElement('ul');list.id='backup-check-sections';
   for(const section of comparison.sections){const item=document.createElement('li');item.textContent=section.label+': '+(section.equal?'совпадает':'отличается');list.append(item);}const details=document.createElement('details');details.id='backup-check-details';const summary=document.createElement('summary');summary.textContent=`Проверенные разделы: ${comparison.sections.length} · отличаются: ${comparison.sections.filter(s=>!s.equal).length}`;details.open=!!expanded;details.append(summary,list);report.append(details);if(restoreFocus)summary.focus({preventScroll:true});
   const counts=document.createElement('p');counts.id='backup-check-tx-diff';counts.className='flow-note';counts.textContent=`По ID операций: только на устройстве — ${tx.onlyDevice}; только в файле — ${tx.onlyFile}; одинаковый ID, разные поля — ${tx.changed}. Переводы и корректировки тоже учитываются. Порядок записей не считается изменением.`;report.append(counts);
   const next=document.createElement('p');next.className='flow-note';next.textContent=comparison.same?'Вы выбрали читаемый файл с совпадающими данными. Это не гарантия, что файл останется доступен после удаления или потери устройства. Храните отдельную копию в надёжном месте.':'Отличия не означают повреждение или потерю денег: файл может быть старее или относиться к другому профилю. Здесь ничего не заменено. Если нужны текущие данные, закройте проверку и подготовьте новый файл.';report.append(next);
   status('Формат, структура и контрольная сумма файла проверены. Данные не изменены.');
  }catch(_){status(externalChange?'Файл проверен, но данные изменились в другой вкладке. Перезагрузите приложение перед сравнением и выберите файл заново. Ничего не заменено.':'Файл проверен, но сравнить с текущими данными не удалось. Не очищайте данные браузера. Ничего не заменено.');}
 }
 async function choose(file){
  if(!file)return;const ticket=++epoch;checked=null;$('backup-check-report').replaceChildren();$('backup-check-report').hidden=true;$('backup-check-current').hidden=true;
  status('Читаем выбранный файл. Ничего не записываем.');dialog.setAttribute('aria-busy','true');if(!dialog.open){closeModals();dialog.showModal();}
  try{
   if(file.size>B.MAX_BYTES)throw Error('Выберите копию Fintex до 12 МБ.');
   const parsed=B.parse(await file.text(),TODAY);if(await FintexBackup.sha(parsed)!==parsed.sha256)throw Error('Контрольная сумма не совпала. Файл изменён или повреждён.');
   if(ticket!==epoch)return;checked=parsed;compare();
  }catch(e){if(ticket===epoch)status((e.message||'Не удалось прочитать копию.')+' Текущие данные не изменены.');}
  finally{if(ticket===epoch)dialog.setAttribute('aria-busy','false');}
 }
 function pick(source=$('backup-check-open')){trigger=source;$('backup-check-file').value='';$('backup-check-file').click();}
 $('backup-check-open').addEventListener('click',event=>pick(event.currentTarget));
 $('backup-check-file').addEventListener('change',event=>{if(event.target.files?.[0]){trigger=trigger||$('backup-check-open');choose(event.target.files[0]);}});
 $('backup-check-close').onclick=()=>dialog.close();$('backup-check-current').onclick=compare;
 dialog.addEventListener('close',()=>{if(dialog.open)return;epoch++;checked=null;dialog.setAttribute('aria-busy','false');$('backup-check-report').replaceChildren();$('backup-check-current').hidden=true;const source=trigger;trigger=null;source?.focus({preventScroll:true});});
 window.addEventListener('storage',event=>{if(event.key===null||Object.values(B.fields).includes(event.key)){externalChange=true;if(checked&&dialog.open)compare();}});
 for(const event of ['filely:financial-data-updated','focus'])window.addEventListener(event,()=>{if(checked&&dialog.open)compare();});
 window.FintexBackupCheck={pick,choose};
})();
