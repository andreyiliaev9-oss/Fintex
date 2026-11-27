/* Quick Capture setup only. No demo records, uploads or automatic financial writes.
 * The one-time pairing key lives only in a masked input, never browser storage/URLs.
 */
(() => {
 'use strict';
 const apple=url=>typeof url==='string'&&/^https:\/\/www\.icloud\.com\/shortcuts\/[a-f0-9]{32}$/i.test(url);
 let checked=null,busy=false,section,viewEpoch=0;
 const $=id=>section.querySelector('#'+id);
 const binding=()=>[window.FintexCloud?.getEndpoint(),String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||''),localStorage.getItem('fp_backup_last_restore')||''].join('|');
 const allowed=()=>!!window.FintexCloud?.canSync();
 function clearKey(){if(section){$('qc-config').value='';$('qc-secret').hidden=true;$('qc-config').type='password';$('qc-reveal').textContent='Показать';}}
 function render(){
  const valid=checked?.binding===binding()&&allowed();
  $('qc-check').disabled=busy||!allowed();$('qc-pair').disabled=busy||!valid;$('qc-revoke').disabled=busy||!valid||!checked.paired;
  const link=valid&&apple(checked.shortcut_url)?checked.shortcut_url:'';
  $('qc-install').hidden=!link;$('qc-install').href=link||'#';$('qc-no-installer').hidden=!!link;
  if(!allowed())$('qc-status').textContent='Для привязки откройте FINTEX через Telegram с доступным облаком. Локальные операции останутся на устройстве.';
 }
 async function call(action){
  if(busy||!allowed())return;
  const start=binding(),epoch=viewEpoch;busy=true;clearKey();render();$('qc-status').textContent='Проверяем защищённое подключение…';
  try{
   const data=await FintexCloud.request(action);
   if(start!==binding()||epoch!==viewEpoch||!allowed())throw Error('Подключение изменилось. Проверьте настройку заново.');
   if(data.quick_capture_protocol!==1||String(data.uid)!==String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id||''))throw Error('Сервер не подтвердил Quick Capture для вашей учётной записи.');
   checked={binding:start,paired:action==='quick_capture_pair'||!!data.paired,shortcut_url:apple(data.shortcut_url)?data.shortcut_url:''};
   if(action==='quick_capture_pair'){
    if(!/^[a-f0-9]{64}$/.test(data.token||''))throw Error('Сервер не выдал допустимый ключ.');
    $('qc-config').value=JSON.stringify({protocol:1,endpoint:FintexCloud.getEndpoint(),uid:String(data.uid),token:data.token});$('qc-secret').hidden=false;
   }
   $('qc-status').textContent=action==='quick_capture_revoke'?'Ключ отозван. Старая команда больше не сможет отправлять операции.':checked.paired?'Сервер Quick Capture подключён. Операции появятся после синхронизации FINTEX с этим облаком.':'Сервер поддерживает Quick Capture. Создайте отдельный ключ для команды.';
  }catch(error){checked=null;clearKey();$('qc-status').textContent=error.code==='UNKNOWN_ACTION'?'На сервере ещё нет Quick Capture. Администратору нужно обновить существующее развёртывание Apps Script.':'Не удалось подключить Quick Capture: '+(error.message||'проверьте сеть и сервер.');}
  finally{busy=false;render();}
 }
 function boot(){
  section=document.createElement('details');section.id='settings-quick-capture';section.className='section-group card-surface';
  section.innerHTML='<summary><span class="section-icon" aria-hidden="true">↗</span><span><strong>Quick Capture · iPhone</strong><small>Расход из скриншота через «Поделиться»</small></span></summary><div class="section-body qc-body"><p>Скриншот → Поделиться → Добавить в FINTEX. Команда предлагает поля, вы проверяете и подтверждаете сохранение. Основное приложение открывать не нужно.</p><p class="qc-note">Нужны команда Apple и обновлённый облачный сервер. Скриншот не загружается: текст распознаёт iPhone. Распознанный текст отправляется вашему серверу для разбора, но не хранится в журнале. Поддерживаются рубли, доходы и расходы; переводы между своими счетами добавляйте в FINTEX.</p><p id="qc-status" role="status" aria-live="polite">Подключение ещё не проверено. Записи не отправляются автоматически.</p><button type="button" id="qc-check" class="section-action">1. Проверить подключение</button><p id="qc-no-installer" class="qc-note">Установка команды пока недоступна. После проверки сервера здесь появится настоящая iCloud-ссылка, если администратор её опубликовал.</p><a id="qc-install" class="section-action" target="_blank" rel="noopener noreferrer" hidden>Установить команду для iPhone ↗</a><button type="button" id="qc-pair" class="section-action" disabled>2. Создать / заменить ключ команды</button><div id="qc-secret" hidden><label for="qc-config">Настройка команды — показывается только сейчас</label><input id="qc-config" type="password" readonly autocomplete="off" spellcheck="false" aria-describedby="qc-key-warning"><p id="qc-key-warning" class="qc-note">Этот ключ разрешает добавлять операции. Не пересылайте его другим и не вставляйте в адрес сайта. Скопируйте JSON в личную настройку команды. После скрытия новый ключ можно получить только заменой.</p><div class="qc-actions"><button type="button" id="qc-copy">Копировать настройку</button><button type="button" id="qc-reveal">Показать</button><button type="button" id="qc-hide">Скрыть ключ</button></div></div><button type="button" id="qc-revoke" class="section-action" disabled>Отозвать ключ Quick Capture</button><p class="qc-note">Отзыв не удаляет операции и не меняет ключ старой СМС-автоматизации. Без сети команда не сохраняет операцию в облако: повторите отправку того же скриншота с теми же полями. Повтор подтверждённого запроса не создаст второй расход.</p><a class="section-action" href="./docs/quick-capture.html" target="_blank" rel="noopener noreferrer">Как установить и пользоваться →</a><a class="section-action" href="./docs/QUICK-CAPTURE-SETUP.md" target="_blank" rel="noopener noreferrer">Для администратора: подготовить сервер и команду →</a></div>';
  document.getElementById('settings-guide').after(section);
  $('qc-check').onclick=()=>call('quick_capture_status');
  $('qc-pair').onclick=()=>{if(confirm('Создать отдельный ключ Quick Capture? Если ключ уже есть, прежняя команда перестанет работать. Старый ключ СМС-автоматизации не меняется.'))call('quick_capture_pair');};
  $('qc-revoke').onclick=()=>{if(confirm('Отозвать доступ команды к добавлению операций? Сохранённые операции останутся.'))call('quick_capture_revoke');};
  $('qc-reveal').onclick=()=>{const show=$('qc-config').type==='password';$('qc-config').type=show?'text':'password';$('qc-reveal').textContent=show?'Спрятать':'Показать';};
  $('qc-hide').onclick=clearKey;
  $('qc-copy').onclick=async()=>{const text=$('qc-config').value;if(!text||checked?.binding!==binding())return clearKey();try{await navigator.clipboard.writeText(text);$('qc-status').textContent='Настройка скопирована. Вставьте её только в свою команду. Ключ остаётся в буфере обмена до замены.';}catch(_){$('qc-status').textContent='Буфер обмена недоступен. Можно показать ключ и скопировать настройку вручную.';}};
  window.addEventListener('fintex:tabchange',()=>{viewEpoch++;clearKey();if(checked?.binding!==binding())checked=null;render();});
  window.addEventListener('pagehide',()=>{viewEpoch++;clearKey();});document.addEventListener('visibilitychange',()=>{if(document.hidden){viewEpoch++;clearKey();}});
  window.addEventListener('storage',event=>{if(['fp_backup_last_restore','fp_api_url','fp_auth_uid'].includes(event.key)){checked=null;clearKey();render();}});
  render();
 }
 document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
