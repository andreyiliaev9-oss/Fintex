/* Password sessions are memory-only. This gate is not local-disk encryption.
 * The server verifies Telegram initData and owns all password/reset decisions.
 */
(function () {
  'use strict';
  const DEFAULT_ENDPOINT = 'https://script.google.com/macros/s/AKfycbyzfhzExalPbmThOsQ24Sq3-qOq_7aLSPQ69dShDbRawnawVIyR5L3hLlN1PSkCHFIM/exec';
  // Only known retired Fintex deployments migrate; custom server URLs remain intact.
  const RETIRED_ENDPOINTS = [
    'https://script.google.com/macros/s/AKfycbxXANSbGhKg-owDC4NFctMJ0mUW5H9XuXwXTohc0n0/exec',
    'https://script.google.com/macros/s/AKfycby5QwCkVgVNt8tzrm7_BTw24Ogl05pZHcSNOE6u6LpXxf6iw5oedtJSnGgsvmV0c9-3/exec',
    'https://script.google.com/macros/s/AKfycbw2Q0L7sKq0QrOQtffRS3oRpq22nrWZ8b9ErM8aWSuF4I9qMLz4f_N7mVu_F6m8-6j6/exec',
    'https://script.google.com/macros/s/AKfycbz_gCZDuLK2Ghkoapf_arMFYu63_9VK7wC8GZUoYn-J3WPqmg7TFRvfKgjJ9KqNXq3F/exec'
  ];
  const read = key => { try { return localStorage.getItem(key); } catch (_) { return null; } };
  const write = (key,value) => { try { localStorage.setItem(key,value); } catch (_) {} };
  const inTelegram = () => !!window.Telegram?.WebApp?.initData;
  let required = inTelegram() || read('fp_auth_required') === '1';
  let verifiedUid = '';
  let session = '', expiresAt = 0, view = 'checking', busy = false, resetReady = false, resendAt = 0;
  let gate, blocked = new Map(), expiryTimer, priorFocus, lastActivity = Date.now(), epoch = 0;
  if (required) document.documentElement.dataset.authLocked = '1';
  function endpoint() {
    const saved=read('fp_api_url');
    const value=String(saved||'').trim().replace(/\/dev$/, '/exec');
    if(!value || RETIRED_ENDPOINTS.includes(value)) {
      if(saved)write('fp_api_url',DEFAULT_ENDPOINT);
      return DEFAULT_ENDPOINT;
    }
    return value;
  }
  function validEndpoint(url) { return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url); }
  function canSync() { return !!session && Date.now() < expiresAt && !document.documentElement.hasAttribute('data-auth-locked'); }
  async function call(action, fields = {}) {
    const url = endpoint();
    if (!validEndpoint(url)) throw new Error('Проверьте адрес Google Apps Script в разделе «Подключение».');
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 45000);
    try {
      const response = await fetch(url, {method:'POST', headers:{'Content-Type':'text/plain;charset=utf-8'}, signal:controller.signal,
        body:JSON.stringify({...fields, action, ...(session ? {session} : {}), ...(action.startsWith('auth_') ? {init_data:window.Telegram?.WebApp?.initData || ''} : {})})});
      if (!response.ok) throw new Error('Сервер недоступен. Повторите позже.');
      let data; try {data=await response.json();} catch (_) {throw new Error('Обновите развёртывание сервера: нужен Fintex Cloud v5.');}
      if (!data || data.ok !== true) {
        if (data?.code === 'AUTH_REQUIRED' && !action.startsWith('auth_')) lock('Сеанс завершён. Введите пароль снова.');
        throw new Error(data?.error || 'Не удалось выполнить запрос.');
      }
      return data;
    } catch(error) {
      if(error.name==='AbortError') throw new Error('Сервер не ответил вовремя. Проверьте подключение и повторите.');
      if(error instanceof TypeError) throw new Error('Нет связи с сервером. Данные не удалены; попробуйте ещё раз.');
      throw error;
    } finally {clearTimeout(timeout);}
  }
  async function request(action, fields) {
    if(!canSync()) throw new Error('Для синхронизации войдите в Fintex через Telegram.');
    const original=session,data=await call(action,fields);
    if(session!==original || !canSync())throw new Error('Сеанс изменился. Повторите действие после входа.');
    return data;
  }
  function isolate() {
    if(!gate)return;
    for(const el of document.body.children) {
      if(el===gate || ['SCRIPT','STYLE','LINK'].includes(el.tagName))continue;
      if(!blocked.has(el))blocked.set(el,el.inert);
      el.inert=true;
    }
  }
  function show(mode) {
    priorFocus = priorFocus || document.activeElement;
    view=mode; document.documentElement.dataset.authLocked='1';
    window.FintexEntrance?.dismiss(true);
    document.querySelectorAll('dialog[open]').forEach(d=>d.close());
    gate.hidden=false; isolate(); render();
  }
  function release() {
    delete document.documentElement.dataset.authLocked;
    gate.hidden=true; gate.replaceChildren();
    blocked.forEach((value,el)=>{if(el.isConnected)el.inert=value;});blocked.clear();
    (priorFocus?.isConnected && !priorFocus.closest('#fintex-auth') ? priorFocus : document.getElementById('hdr-plus-btn'))?.focus({preventScroll:true});priorFocus=null;
  }
  function settings() {
    const note=document.getElementById('auth-settings-status');
    if(note)note.textContent=canSync()?'Пароль включён · блокировка при уходе в фон':'Вход с паролем и сбросом доступен через Telegram.';
    const change=document.getElementById('auth-change');
    if(change)change.textContent=canSync()?'Сменить пароль':'Настроить вход';
    const logout=document.getElementById('auth-logout');if(logout)logout.hidden=!canSync();
  }
  function lock(message) {
    if(!required && !session)return;
    epoch++;session='';expiresAt=0;clearTimeout(expiryTimer);busy=false;
    show(inTelegram()?'login':'outside');settings();if(message)status(message);
    window.dispatchEvent(new Event('fintex:auth-locked'));
  }
  function accept(data) {
    if(typeof data.session!=='string' || !Number.isFinite(data.expires_in) || data.expires_in<=0)throw new Error('Сервер не поддерживает защищённый вход. Обновите все три .gs файла.');
    if(document.hidden)throw new Error('Повторите вход, когда приложение открыто.');
    session=data.session;expiresAt=Date.now()+Math.min(data.expires_in,1800)*1000;required=true;
    write('fp_auth_required','1');write('fp_auth_uid',verifiedUid);
    if(data.webhook_token){write('fp_api_token',data.webhook_token);if(window.state)window.state.apiToken=data.webhook_token;}
    clearTimeout(expiryTimer);expiryTimer=setTimeout(()=>lock('Сеанс истёк. Введите пароль снова.'),expiresAt-Date.now());
    lastActivity=Date.now();resetReady=false;resendAt=0;release();settings();
    window.dispatchEvent(new Event('fintex:auth-ready'));
  }
  function status(message) { const el=document.getElementById('auth-status');if(el)el.textContent=message; }
  const field=(id,label,autocomplete='current-password',extra='')=>`<label class="auth-label" for="${id}">${label}</label><div class="auth-input-wrap"><input id="${id}" name="${id}" type="password" autocomplete="${autocomplete}" maxlength="128" ${extra} required><button class="auth-eye" type="button" data-reveal="${id}" aria-label="Показать: ${label}" aria-pressed="false">Показать</button></div>`;
  function render() {
    const titles={checking:'Минуточку…',setup:'Защитим ваш Fintex',login:'С возвращением',reset:'Вернём доступ',change:'Новый пароль — спокойно',unavailable:'Не удалось подключиться',outside:'Откройте Fintex в Telegram'};
    const copy={checking:'Проверяем защищённое подключение.',setup:'Придумайте пароль. Для восстановления отправим код в личные сообщения вашего бота.',login:'Ваши планы и накопления подождут здесь. Введите пароль, чтобы продолжить.',reset:'Нажмите «Получить код» — бот отправит 6 цифр в личный чат. Код действует 10 минут.',change:'Введите текущий пароль и задайте новый. Другие сеансы будут завершены.',unavailable:'Вход закрыт, пока сервер недоступен или не обновлён. Ваши локальные записи не удалены.',outside:'Пароль привязан к вашей учётной записи Telegram. Откройте мини-приложение из того же бота.'};
    let content='';
    if(view==='login')content=`${field('auth-password','Пароль')}<button class="auth-primary" type="submit">Войти <span aria-hidden="true">↗</span></button><button class="auth-link" type="button" data-action="reset">Забыли пароль?</button>`;
    if(view==='setup'||view==='change')content=`${view==='change'?field('auth-current','Текущий пароль'):''}${field('auth-new','Новый пароль','new-password','minlength="10"')}${field('auth-confirm','Повторите пароль','new-password','minlength="10"')}<p class="auth-hint">От 10 до 128 символов. Можно использовать пробелы и вставку из менеджера паролей.</p><button class="auth-primary" type="submit">${view==='setup'?'Создать пароль и войти':'Сохранить новый пароль'} <span aria-hidden="true">↗</span></button>${view==='change'?'<button class="auth-link" type="button" data-action="cancel">Отмена</button>':''}`;
    if(view==='reset')content=`<button class="auth-secondary" type="button" id="auth-send" data-action="send">${resetReady?'Отправить код ещё раз':'Получить код в Telegram'}</button><p id="auth-resend" class="auth-hint" aria-live="polite"></p><label class="auth-label" for="auth-code">Код из сообщения</label><input id="auth-code" class="auth-code" name="code" type="text" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" minlength="6" maxlength="6" required>${field('auth-new','Новый пароль','new-password','minlength="10"')}${field('auth-confirm','Повторите пароль','new-password','minlength="10"')}<button class="auth-primary" type="submit">Обновить пароль и войти <span aria-hidden="true">↗</span></button><button class="auth-link" type="button" data-action="login">Вернуться ко входу</button>`;
    if(view==='unavailable')content='<button type="button" class="auth-primary" data-action="retry">Повторить подключение ↗</button>';
    if(view==='outside'&&!required)content='<button type="button" class="auth-secondary" data-action="cancel">Вернуться в локальный режим</button>';
    gate.innerHTML=`<div class="auth-scene" aria-hidden="true"><span></span><span></span><span></span></div><div class="auth-content"><a class="auth-brand" href="#" tabindex="-1" aria-label="Fintex">F<span>✦</span></a><div class="auth-kicker">Личное пространство</div><div class="auth-emblem" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none"><path d="M32 47V29m0 6C14 37 12 20 12 16c14-1 22 7 20 19Zm0-6c-1-11 7-17 20-17 0 13-8 20-20 17Z" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 48h20" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg></div><h1 id="auth-title">${titles[view]}</h1><p class="auth-copy">${copy[view]}</p><form id="auth-form" aria-busy="${busy}">${content}<p id="auth-status" class="auth-status" role="status" aria-live="polite"></p></form><p class="auth-footnote">${view==='reset'?'Никому не сообщайте код. После сброса выйдем из других сеансов и обновим ключ iOS-автоматизации.':'Защита входа и облака. Локальные данные в браузере не зашифрованы.'}</p>${['unavailable','outside'].includes(view)?'<details class="auth-connection"><summary>Подключение к серверу</summary><label for="auth-endpoint">Адрес вашего развёртывания Google Apps Script</label><input id="auth-endpoint" type="url" autocomplete="off"><button class="auth-secondary" type="button" data-action="endpoint">Сохранить и проверить</button><p>Не вводите пароль, если не доверяете владельцу этого адреса.</p></details>':''}</div>`;
    const url=document.getElementById('auth-endpoint');if(url)url.value=endpoint();
    updateCountdown();
    (gate.querySelector('input:not([type=url])') || gate.querySelector('button') || gate).focus({preventScroll:true});
  }
  function updateCountdown() {
    const button=document.getElementById('auth-send'),label=document.getElementById('auth-resend');
    const seconds=Math.max(0,Math.ceil((resendAt-Date.now())/1000));
    if(button)button.disabled=busy||seconds>0;
    if(label)label.textContent=seconds?`Повторная отправка через ${seconds} сек.`:'';
  }
  function pending(value) {
    busy=value;gate.querySelector('form')?.setAttribute('aria-busy',String(value));
    gate.querySelectorAll('button,input').forEach(el=>{el.disabled=value;});updateCountdown();
  }
  async function submit(event) {
    event.preventDefault();if(busy)return;
    const current=gate.querySelector('#auth-current')?.value || gate.querySelector('#auth-password')?.value;
    const next=gate.querySelector('#auth-new')?.value, confirm=gate.querySelector('#auth-confirm')?.value;
    if(next!==undefined && (next.length<10||next.length>128||next!==confirm)){status('Пароли должны совпадать и содержать от 10 до 128 символов.');return;}
    const code=gate.querySelector('#auth-code')?.value;
    if(view==='reset'&&!/^\d{6}$/.test(code||'')){status('Введите 6 цифр из сообщения бота.');return;}
    const mode=view, id=epoch;pending(true);status(mode==='login'?'Проверяем пароль…':'Сохраняем защищённый пароль…');
    try {
      const action={login:'auth_login',setup:'auth_setup',change:'auth_change',reset:'auth_reset'}[mode];
      if(!action)return;
      const data=await call(action,{password:mode==='setup'?next:current,new_password:next,code});
      if(id===epoch){if(mode==='change'||mode==='reset')write('fp_auth_lock_event',String(Date.now())+'_'+Math.random());accept(data);}
    } catch(error) {if(id===epoch)status(error.message);}
    finally {if(id===epoch){gate.querySelectorAll('#auth-current,#auth-password,#auth-new,#auth-confirm,#auth-code').forEach(el=>{el.value='';});pending(false);}}
  }
  async function connect() {
    const id=++epoch;busy=false;session='';expiresAt=0;clearTimeout(expiryTimer);
    if(!inTelegram()){show('outside');settings();return;}
    show('checking');
    try {
      const data=await call('auth_status');
      if(id!==epoch)return;
      if(typeof data.password_set!=='boolean')throw new Error('Обновите сервер до Fintex Cloud v5: старый API не поддерживает пароли.');
      if(!/^\d+$/.test(String(data.uid||'')))throw new Error('Сервер не подтвердил учётную запись Telegram.');
      verifiedUid=String(data.uid);
      if(read('fp_auth_uid') && read('fp_auth_uid')!==verifiedUid)throw new Error('В этом браузере сохранены данные другой учётной записи Telegram. Откройте прежнюю учётную запись или используйте отдельный профиль браузера. Ничего не удалено.');
      required=true;write('fp_auth_required','1');show(data.password_set?'login':'setup');
    } catch(error) {if(id===epoch){show('unavailable');status(error.message);}}
  }
  async function action(event) {
    const reveal=event.target.closest('[data-reveal]');
    if(reveal){const input=document.getElementById(reveal.dataset.reveal),on=input.type==='password';input.type=on?'text':'password';reveal.textContent=on?'Скрыть':'Показать';reveal.setAttribute('aria-pressed',String(on));return;}
    const button=event.target.closest('[data-action]');if(!button||busy)return;
    const act=button.dataset.action;
    if(act==='cancel'){if((session&&Date.now()<expiresAt)||!required)release();settings();return;}
    if(act==='reset'){show('reset');return;}
    if(act==='login'){show('login');return;}
    if(act==='retry'){await connect();return;}
    if(act==='endpoint'){
      const value=document.getElementById('auth-endpoint').value.trim();
      if(!validEndpoint(value)){status('Нужен HTTPS-адрес script.google.com/macros/s/…/exec.');return;}
      write('fp_api_url',value);if(window.state)window.state.gasUrl=value;await connect();return;
    }
    if(act==='send'){
      if(Date.now()<resendAt)return;
      const id=epoch;pending(true);status('Отправляем код в личный чат…');
      try {const data=await call('auth_reset_request');if(id!==epoch)return;resetReady=true;resendAt=Date.now()+(data.retry_after||60)*1000;render();status('Код отправлен. Проверьте личные сообщения бота.');}
      catch(error){if(id===epoch)status(error.message);}
      finally{if(id===epoch)pending(false);}
    }
  }
  function mount() {
    gate=document.getElementById('fintex-auth');gate.addEventListener('submit',submit);gate.addEventListener('click',action);
    gate.addEventListener('keydown',event=>{
      if(event.key==='Escape'){if(session&&view==='change'){release();settings();}return;}
      if(event.key!=='Tab')return;
      const controls=[...gate.querySelectorAll('input,button,summary')].filter(el=>!el.disabled&&el.getClientRects().length);
      if(!controls.length){event.preventDefault();return;}
      if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}
      else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();}
    });
    document.getElementById('auth-change').addEventListener('click',()=>session?show('change'):connect());
    document.getElementById('auth-logout').addEventListener('click',async()=>{try{await call('auth_logout');}catch(_){/* Local exit must still happen. */}write('fp_auth_lock_event',String(Date.now())+'_'+Math.random());lock('Вы вышли. Если сети не было, другие сеансы завершатся по сроку действия.');});
    document.getElementById('auth-rotate-webhook').addEventListener('click',async()=>{
      const note=document.getElementById('auth-settings-status');
      if(!canSync()){note.textContent='Сначала войдите через Telegram.';return;}
      try {const data=await request('auth_rotate_webhook');if(data.webhook_token){write('fp_api_token',data.webhook_token);if(window.state)window.state.apiToken=data.webhook_token;note.textContent='Ключ обновлён. Замените ссылку в команде iOS.';}}
      catch(error){note.textContent=error.message;}
    });
    new MutationObserver(()=>{if(document.documentElement.hasAttribute('data-auth-locked'))isolate();}).observe(document.body,{childList:true});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&session)lock('Приложение было скрыто. Введите пароль снова.');});
    window.addEventListener('storage',event=>{if(event.key==='fp_auth_lock_event'&&session)lock('Пароль или сеанс изменён в другом окне. Войдите снова.');});
    window.addEventListener('pagehide',()=>{if(session)lock();});
    document.addEventListener('pointerdown',()=>{if(session)lastActivity=Date.now();},{passive:true});
    document.addEventListener('keydown',()=>{if(session)lastActivity=Date.now();});
    setInterval(()=>{updateCountdown();if(session&&Date.now()-lastActivity>5*60*1000)lock('Пять минут без действий. Введите пароль снова.');},1000);
    settings();if(required)connect();
  }
  window.FintexAuth={request,canSync,lock,defaultEndpoint:DEFAULT_ENDPOINT,getEndpoint:endpoint,open:()=>connect()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})();
