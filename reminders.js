/* Telegram reminders: settings are authoritative on the server, never a fake local switch. */
(function(){
  'use strict';
  const root=document.getElementById('fintex-reminders');if(!root)return;
  const zones=['UTC','Europe/Warsaw','Europe/Moscow','Europe/Kaliningrad','Europe/Berlin','Europe/London','Europe/Istanbul','Asia/Yekaterinburg','Asia/Novosibirsk','Asia/Almaty','Asia/Tbilisi','Asia/Dubai','Asia/Vladivostok','Asia/Bangkok','Asia/Tokyo','America/New_York','America/Los_Angeles'];
  let timezone;try{timezone=Intl.DateTimeFormat().resolvedOptions().timeZone;}catch(_){}if(!zones.includes(timezone))timezone='UTC';
  let saved=null,busy=false,timer,lastActivity=0,lastContextSignature='',loaded=false;
  root.innerHTML=`<h3>FINTEX · Напоминания в Telegram</h3><p>Бот сможет писать, даже когда Mini App закрыт. Только после вашего согласия. Не больше одного сообщения в день, без ночных отправок.</p><form id="reminder-form" novalidate><label class="reminder-master"><span>Получать сообщения от бота</span><input type="checkbox" name="enabled"></label><fieldset><legend>Что напоминать</legend>${[['receipts','Загрузить чеки',true,'receipt'],['expenses','Проверить учёт операций',true,'credit-card'],['bills','Предстоящие платежи',true,'calendar-days'],['reports','Финансовые итоги',true,'chart-column'],['goals','Вернуться к цели накоплений',false,'target']].map(([id,label,checked,icon])=>`<label><span><i data-lucide="${icon}" aria-hidden="true"></i>${label}</span><input type="checkbox" name="${id}" ${checked?'checked':''}></label>`).join('')}</fieldset><label class="reminder-field">Время напоминаний<input type="time" name="time" min="09:00" max="21:59" value="20:30" required></label><label class="reminder-field">Финансовый итог<select name="reportFrequency"><option value="weekly">По воскресеньям</option><option value="daily">Ежедневно</option></select></label><label class="reminder-field">Время итога<input type="time" name="reportTime" min="09:00" max="21:59" value="19:00" required></label><label class="reminder-field">Часовой пояс<select name="timezone">${zones.map(z=>`<option ${z===timezone?'selected':''}>${z}</option>`).join('')}</select></label><label><span>Показывать суммы в отчёте бота<small>Они будут видны в переписке и, возможно, на экране блокировки. Только записи облачного журнала.</small></span><input type="checkbox" name="includeAmounts"></label><button type="submit" id="reminder-save">Сохранить на сервере</button></form><button type="button" id="reminder-refresh">Проверить подключение</button><button type="button" id="reminder-bot" hidden>Открыть бота</button><p id="reminder-status" role="status" aria-live="polite"></p><p id="reminder-server-state"></p><details><summary>Как это работает</summary><p>Чеки и проверка учёта чередуются и не повторяются чаще раза в 3 дня. Если за сегодня есть записанные расходы, проверка учёта пропускается. Платежи — за 0–2 дня; цель — по средам; итог — по вашему расписанию. При совпадении сначала итог, затем платёж, остальные — по давности отправки. Мы не знаем о покупках вне добавленных данных.</p><p>Для чеков, платежей и целей используется последний снимок из приложения. Спустя 7 дней без обновления эти подсказки прекращаются; запланированные отчёты остаются. Банковского фонового доступа нет.</p><p>Время примерное: сервер проверяет очередь раз в 15 минут. Максимум одно сообщение за местный день и не чаще чем раз в 20 часов. После 22:00 и до 09:00 не отправляем. Пропущенные окна не догоняем ночью.</p><p>Сервер хранит ваши настройки, даты активности, даты чеков/расходов, идентификаторы и сроки до 50 неоплаченных платежей, наличие активной цели и журнал попыток доставки. Чеки, названия покупок и суммы подушки для напоминаний не загружаются. Суммы отчёта — только с отдельной галочкой.</p><p>Если сервер ещё не обновлён: владельцу нужно заменить код Apps Script готовым <a href="./downloads/Fintex-Code.txt" download>серверным файлом</a>, один раз запустить setupFintexReminders и обновить текущее развёртывание. <a href="./docs/reminders.md" target="_blank" rel="noopener">Подробная инструкция</a>. До этого переключатели не запускают отправку.</p></details>`;
  window.lucide?.createIcons();
  const form=root.querySelector('form'),status=root.querySelector('#reminder-status'),serverState=root.querySelector('#reminder-server-state');
  const field=name=>form.elements.namedItem(name);
  function say(text){status.textContent=text;}
  function lock(value){busy=value;root.querySelectorAll('button').forEach(b=>b.disabled=value);form.querySelectorAll('input,select').forEach(e=>e.disabled=value);}
  function canConnect(){return !!window.FintexCloud?.canSync();}
  function context(){
    const today=FintexMath.key(new Date()),tx=FintexMath.transactions(state.transactions,null,today);
    const latest=list=>list.map(t=>t.date).sort().at(-1)||'';
    return {lastReceipt:latest((state.scanHistory||[]).filter(s=>s.confirmed&&s.confirmed_at).map(s=>({date:FintexMath.txKey({timestamp:s.confirmed_at})})).filter(s=>s.date&&s.date<=today)),lastExpense:latest(tx.filter(t=>t.type==='expense'&&!/transfer|refund|atm/i.test(t.op_kind||''))),goalActive:Number(state.goal?.target)>Number(state.goal?.saved),bills:(state.bills||[]).filter(b=>!b.is_paid).map(b=>({id:String(b.id),due:b.due_date})).slice(0,50)};
  }
  function apply(data){
    if(!data.settings||typeof data.settings.enabled!=='boolean')throw new Error('Сервер пока не поддерживает настройки напоминаний. Обновите Apps Script.');
    saved=data.settings;loaded=true;
    for(const [key,value] of Object.entries(saved)){const e=field(key);if(!e)continue;if(e.type==='checkbox')e.checked=value===true;else e.value=key==='timezone'&&data.configured===false?timezone:value;}
    serverState.textContent=(data.schedulerReady?'Серверное расписание подключено.':'Серверное расписание ещё не установлено владельцем.')+' '+(saved.enabled?'Напоминания разрешены в настройках.':'Отправка выключена.')+(data.contextUpdated?` Снимок активности: ${data.contextUpdated}.`:'');
    const delivery={skipped:'Последняя отправка пропущена: допустимое окно закончилось до обращения к Telegram. Ночью сообщения не отправляются.',sent:'Последнее сообщение принято Telegram (это не подтверждение прочтения).',pending:'Последняя попытка зарезервирована; результат ещё не подтверждён.',unknown:'Результат последней доставки неизвестен. Повтор в этот день не отправляется.',blocked:'Бот недоступен, не запущен или доступ отозван. Отправка остановлена; откройте бота и разрешите её заново.',failed:'Последнее сообщение не доставлено. Повтор в этот день не отправляется.',limited:'Telegram ограничил отправку. Сервер соблюдает паузу.'};
    if(delivery[data.delivery?.status])serverState.textContent+=' '+delivery[data.delivery.status];
    const bot=root.querySelector('#reminder-bot');bot.hidden=!/^[A-Za-z0-9_]{5,32}$/.test(data.botUsername||'');bot.dataset.username=data.botUsername||'';
  }
  function errorMessage(error){if(error instanceof TypeError)return 'Не удалось связаться с сервером. Сохранение не подтверждено — нажмите «Проверить подключение».';return /UNKNOWN_ACTION|Неизвестная команда/.test(error.message)?'Сервер пока не поддерживает напоминания. Нужны обновление Apps Script и установка расписания владельцем. Локальные переключатели не включают бота.':error.name==='AbortError'?'Сервер не ответил. Состояние не подтверждено — нажмите «Проверить подключение».':error.message||'Не удалось связаться с сервером. Настройки не подтверждены.';}
  async function refresh(){
    if(busy)return;if(!canConnect()){say('Откройте FINTEX через Telegram, чтобы подтвердить учётную запись. В обычном браузере сообщения включить нельзя.');return;}
    lock(true);say('Проверяем сервер…');try{const data=await FintexCloud.request('reminders_get');apply(data);say('Настройки загружены с сервера.');if(saved.enabled)activity(true);}catch(e){say(errorMessage(e));}finally{lock(false);}
  }
  function permission(){return new Promise(resolve=>{const tg=window.Telegram?.WebApp;if(!tg?.requestWriteAccess||tg.isVersionAtLeast&&!tg.isVersionAtLeast('6.9')){resolve(false);return;}let done=false;const finish=ok=>{if(done)return;done=true;clearTimeout(timeout);resolve(ok===true);};const timeout=setTimeout(()=>finish(false),60000);try{tg.requestWriteAccess(finish);}catch(_){finish(false);}});}
  form.addEventListener('change',()=>{if(loaded&&!busy)say('Изменения ещё не сохранены. На сервере отправка '+(saved.enabled?'включена.':'выключена.'));});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;if(!canConnect()){say('Включение доступно только из Telegram. Откройте Mini App через своего бота.');return;}if(!loaded){say('Сначала нажмите «Проверить подключение»: нужно загрузить действующие настройки.');return;}
    if(field('enabled').checked&&!form.reportValidity())return;
    const settings={};for(const name of ['enabled','receipts','expenses','bills','reports','goals','includeAmounts'])settings[name]=field(name).checked;
    for(const name of ['time','reportTime','reportFrequency','timezone'])settings[name]=field(name).value;
    if(!settings.enabled)Object.assign(settings,saved,{enabled:false});
    if(settings.enabled&&!['receipts','expenses','bills','reports','goals'].some(k=>settings[k])){say('Выберите хотя бы один тип напоминаний.');return;}
    lock(true);say('Подтверждаем настройки…');try{
      if(settings.enabled&&!saved?.enabled&&!(await permission())){say('Разрешение на сообщения не получено. Настройки на сервере не изменены. Откройте бота или обновите Telegram и повторите.');return;}
      const data=await FintexCloud.request('reminders_save',{settings,consent:settings.enabled,context:settings.enabled?context():{}});apply(data);say(settings.enabled?'Настройки сохранены на сервере. Расписание и статус доставки показаны ниже.':'Отправка выключена на сервере. Уже принятые Telegram сообщения отозвать нельзя.');
    }catch(e){say(errorMessage(e));}finally{lock(false);}
  });
  async function sendContext(){
    if(!saved?.enabled||!canConnect()||busy)return;
    const snapshot=context();
    try{const data=await FintexCloud.request('reminders_context',{context:snapshot});lastActivity=Date.now();lastContextSignature=JSON.stringify(snapshot);if(data.skipped===true||data.settings?.enabled===false)serverState.textContent='На сервере отправка остановлена. Нажмите «Проверить подключение», чтобы загрузить актуальные настройки.';}catch(_){serverState.textContent='Не удалось обновить снимок активности. Сервер использует последнюю сохранённую копию; откройте настройки для проверки.';}
  }
  function activity(force=false){if(!saved?.enabled||!canConnect()||(!force&&Date.now()-lastActivity<300000&&JSON.stringify(context())===lastContextSignature))return;clearTimeout(timer);timer=setTimeout(sendContext,3000);}
  root.querySelector('#reminder-refresh').addEventListener('click',refresh);
  root.querySelector('#reminder-bot').addEventListener('click',event=>{const user=event.currentTarget.dataset.username;if(/^[A-Za-z0-9_]{5,32}$/.test(user))window.Telegram?.WebApp?.openTelegramLink?.('https://t.me/'+user);});
  document.getElementById('settings-notifications')?.addEventListener('toggle',event=>{if(event.target.open&&!loaded)refresh();});
  window.addEventListener('filely:financial-data-updated',()=>activity());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)activity();});
  window.FintexReminders={refresh,activity};
  if(canConnect())refresh();else say('Сообщения выключены по умолчанию. Для подключения откройте FINTEX в Telegram.');
})();
