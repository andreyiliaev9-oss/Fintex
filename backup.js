/* Explicit file export/preview/replace. File content is never rendered as HTML. */
(() => {
  'use strict';
  const B=FintexBackupModel,M=FintexMath,$=id=>document.getElementById(id);
  let selected=null,baseline='',safetySnapshot='',epoch=0,busy=false,focusBefore=null;
  const dialog=document.createElement('dialog');dialog.id='backup-dialog';dialog.className='daily-dialog';dialog.setAttribute('aria-labelledby','backup-title');dialog.setAttribute('aria-modal','true');
  dialog.innerHTML='<header class="flow-header"><h2 id="backup-title">Проверка копии</h2><button type="button" id="backup-close" aria-label="Закрыть">×</button></header><div id="backup-preview"></div><p id="backup-dialog-status" class="flow-status" role="status" aria-live="polite"></p><div id="backup-restore-controls"><p id="backup-replace-note" class="flow-note">Будут заменены текущие финансовые данные, без объединения и пересчёта операций. Сначала сохраните их отдельным файлом.</p><button type="button" id="backup-safety-export" class="flow-secondary">1. Скачать текущие данные</button><label class="flow-check"><input type="checkbox" id="backup-confirm"/><span id="backup-confirm-copy">Текущую копию сохранил. Понимаю, что данные будут заменены.</span></label><p class="flow-note">Вход, оформление и оригиналы чеков на этом устройстве останутся. Очередь облака будет очищена, синхронизация — на паузе. Копия не загрузится на сервер автоматически.</p><button type="button" id="backup-replace" class="flow-primary" disabled>2. Заменить данные из копии</button></div><div id="backup-resume-controls" hidden><p class="flow-note">Облако сможет добавить свои операции и обновить остаток. Локальные исправления остаются только здесь. Это не загрузка копии в облако.</p><label class="flow-check"><input type="checkbox" id="backup-resume-confirm"/>Это та же учётная запись Telegram. Разрешаю синхронизацию.</label><button type="button" id="backup-resume-apply" class="flow-primary">Продолжить синхронизацию</button></div>';
  document.body.append(dialog);
  const status=text=>{$('backup-status').textContent=text;$('backup-onboarding-status').textContent=text;};
  const fresh=()=>localStorage.getItem('fp_onboarded')!=='1'&&!state.name&&!state.transactions.length;
  const dialogStatus=text=>{$('backup-dialog-status').textContent=text;};
  const snapshot=()=>B.snapshot(state,localStorage);
  const fingerprint=()=>JSON.stringify(snapshot());
  const date=value=>{const d=new Date(value);return Number.isFinite(+d)?d.toLocaleString('ru-RU',{dateStyle:'medium',timeStyle:'short'}):'—';};
  async function sha(file){if(!crypto.subtle)throw Error('Для проверки копии откройте Fintex по защищённому адресу HTTPS.');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(B.payload(file))))].map(n=>n.toString(16).padStart(2,'0')).join('');}
  function refresh(){
    const saved=localStorage.getItem('fp_backup_last_export');$('backup-last-file').textContent=saved?'Последний подготовленный файл: '+date(saved)+'. Проверьте, что он есть в «Файлах» или загрузках.':'Файл копии ещё не создавался на этом устройстве.';
    $('backup-cloud-pause').hidden=localStorage.getItem('fp_cloud_paused_restore')!=='1';
    if(window.FintexBackupRecovered)status('Незавершённое восстановление отменено. Прежние данные возвращены.');
  }
  async function download(){
    const data=snapshot();B.validateData(data,TODAY);
    const file={format:'FintexBackup',version:1,createdAt:new Date().toISOString(),currency:'RUB',cloudOwner:typeof USER_ID==='string'?USER_ID:null,data};file.sha256=await sha(file);
    const text=JSON.stringify(file,null,2),blob=new Blob([text],{type:'application/json'});
    if(blob.size>B.MAX_BYTES)throw Error('Копия больше 12 МБ. Данные не изменены; файл не создан.');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`Fintex-${TODAY}-${file.createdAt.slice(11,19).replaceAll(':','-')}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    try{localStorage.setItem('fp_backup_last_export',file.createdAt);}catch(_){/* The file was prepared even if the timestamp cannot be saved. */}
    refresh();status('Файл передан в загрузки. Если он открылся, выберите «Поделиться» → «Сохранить в Файлы». Само приложение не может проверить сохранение файла.');
    return JSON.stringify(data);
  }
  function row(label,text,money=false){const r=document.createElement('div');r.className='flow-equation-row';const a=document.createElement('span');a.textContent=label;const b=document.createElement('strong');if(money)FintexNumerals.render(b,text);else b.textContent=String(text);r.append(a,b);return r;}
  function preview(file){
    const box=$('backup-preview');box.replaceChildren(row('Дата копии',date(file.createdAt)),row('Профиль',file.data.name),row('Остаток в копии',file.data.balance,true),row('Сейчас на устройстве',state.balance,true),row('Операции',`${state.transactions.length} → ${file.data.transactions.length}`),row('Цели',`${1+(state.goal?.pockets?.length||0)} → ${1+(file.data.goal.pockets?.length||0)}`),row('Платежи',`${state.bills.length} → ${file.data.bills.length}`));
  }
  async function choose(file){
    const ticket=++epoch;selected=null;safetySnapshot='';$('backup-confirm').checked=false;$('backup-replace').disabled=true;status('Проверяем копию…');
    if(!file)return;
    try{
      if(file.size>B.MAX_BYTES)throw Error('Выберите копию Fintex до 12 МБ.');
      const checked=B.parse(await file.text(),TODAY);if(await sha(checked)!==checked.sha256)throw Error('Контрольная сумма не совпала. Файл изменён или повреждён. Данные не заменены.');
      if(ticket!==epoch)return;
      selected=checked;baseline=fingerprint();focusBefore=fresh()?$('backup-onboarding-import'):$('backup-import');closeModals();$('backup-title').textContent='Восстановить копию';$('backup-restore-controls').hidden=false;$('backup-resume-controls').hidden=true;preview(checked);$('backup-safety-export').hidden=fresh();$('backup-replace-note').textContent=fresh()?'На этом устройстве ещё нет ваших записей. Данные из копии заполнят приложение без повторной настройки.':'Будут заменены текущие финансовые данные, без объединения и пересчёта операций. Сначала сохраните их отдельным файлом.';$('backup-confirm-copy').textContent=fresh()?'Хочу восстановить данные из этой копии.':'Текущую копию сохранил. Понимаю, что данные будут заменены.';dialogStatus('Файл проверен. Пока ничего не изменено.');status('Копия проверена. Замена ещё не выполнена.');dialog.showModal();
    }catch(error){if(ticket===epoch)status(error.message||'Не удалось прочитать файл. Данные не изменены.');}
  }
  function controls(){
    let same=false;try{same=fresh()||safetySnapshot!==''&&safetySnapshot===fingerprint();}catch(_){}
    $('backup-replace').disabled=!selected||!$('backup-confirm').checked||!same||busy;
  }
  async function safety(){
    if(busy)return;busy=true;controls();
    try{safetySnapshot=await download();if(selected){baseline=safetySnapshot;preview(selected);}dialogStatus('Файл текущих данных передан в загрузки. Сохраните его и подтвердите замену.');}
    catch(error){dialogStatus(error.message);}finally{busy=false;controls();}
  }
  function restore(){
    if(busy||!selected)return;
    try{
      if(fingerprint()!==baseline||!fresh()&&fingerprint()!==safetySnapshot){baseline=fingerprint();safetySnapshot='';$('backup-confirm').checked=false;preview(selected);dialogStatus('Текущие данные изменились. Скачайте их свежую копию и подтвердите замену заново.');controls();return;}
      if(!$('backup-confirm').checked)throw Error('Подтвердите замену текущих данных.');
      busy=true;controls();B.validateData(selected.data,TODAY);B.replace(localStorage,selected.data,new Date().toISOString(),selected.cloudOwner);
      selected=null;location.reload();
    }catch(error){busy=false;dialogStatus(error.message||'Не удалось восстановить копию.');controls();}
  }
  function resume(){
    focusBefore=$('backup-resume');closeModals();$('backup-title').textContent='Вернуться к облаку';$('backup-preview').replaceChildren();$('backup-restore-controls').hidden=true;$('backup-resume-controls').hidden=false;$('backup-resume-confirm').checked=false;
    const owner=localStorage.getItem('fp_backup_cloud_owner'),uid=String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'');
    const same=!!window.Telegram?.WebApp?.initData&&!!owner&&owner===uid;
    $('backup-resume-apply').disabled=!same;dialogStatus(same?'Проверьте, что хотите продолжить с облаком.':'Откройте Fintex в той же учётной записи Telegram, где создана копия. Пока данные остаются локальными.');dialog.showModal();
  }
  $('backup-export').addEventListener('click',async()=>{if(busy)return;busy=true;$('backup-export').disabled=true;try{await download();}catch(e){status(e.message||'Не удалось создать копию.');}finally{busy=false;$('backup-export').disabled=false;}});
  $('backup-import').addEventListener('click',()=>{$('backup-file').value='';$('backup-file').click();});
  $('backup-onboarding-import').addEventListener('click',()=>{$('backup-file').value='';$('backup-file').click();});
  $('backup-file').addEventListener('change',e=>{if(e.target.files?.[0])choose(e.target.files[0]);});
  $('backup-close').addEventListener('click',()=>dialog.close());dialog.addEventListener('close',()=>{epoch++;selected=null;safetySnapshot='';focusBefore?.focus({preventScroll:true});});
  $('backup-confirm').addEventListener('change',controls);$('backup-safety-export').addEventListener('click',safety);$('backup-replace').addEventListener('click',restore);$('backup-resume').addEventListener('click',resume);
  $('backup-resume-apply').addEventListener('click',()=>{
    const owner=localStorage.getItem('fp_backup_cloud_owner'),uid=String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||'');
    if(!$('backup-resume-confirm').checked||!window.Telegram?.WebApp?.initData||!owner||owner!==uid){dialogStatus('Нужна та же учётная запись Telegram и подтверждение.');return;}
    try{localStorage.removeItem('fp_cloud_paused_restore');dialog.close();refresh();renderAll(false);syncWithBackend(true);}catch(_){dialogStatus('Не удалось сохранить настройку подключения.');}
  });
  window.addEventListener('filely:financial-data-updated',()=>{if(dialog.open&&selected){$('backup-confirm').checked=false;controls();}});
  window.FintexBackup={download,choose,sha,refresh};refresh();
  if(localStorage.getItem('fp_backup_restore_notice')==='1'){status('Копия восстановлена. Облако на паузе; данные доступны на этом устройстве.');localStorage.removeItem('fp_backup_restore_notice');}
  if(window.FintexBackupRecoveryError){status('Не удалось вернуть данные после прерванного восстановления. Освободите место для сайта и перезагрузите страницу. Не очищайте данные браузера.');}
})();
