/* A read-only explanation of storage, linked to existing trusted workflows. */
(() => {
  'use strict';
  let card;
  const read=key=>{try{return localStorage.getItem(key);}catch(_){return null;}};
  function jump(id,focusId){
    const target=document.getElementById(id);if(!target)return;
    if(target.matches('details'))target.open=true;
    target.scrollIntoView({block:'start',behavior:'instant'});
    (document.getElementById(focusId)||target.querySelector('summary,button'))?.focus({preventScroll:true});
  }
  function refresh(){
    if(!card)return;
    card.querySelector('[data-care-cloud]').textContent=window.FintexSync?.status()||'Подтверждения облака пока нет';
    card.querySelector('[data-care-counts]').textContent=`На устройстве записей: ${state.transactions.length}. Статус каждой записи виден в журнале.`;
    const raw=read('fp_backup_last_export'),date=raw?new Date(raw):null;
    card.querySelector('[data-care-file]').textContent=date&&Number.isFinite(date.getTime())?`Файл подготовлен ${date.toLocaleString('ru-RU')}. Проверьте, что сохранили его в «Файлы» или загрузки.`:'На этом устройстве файл копии ещё не подготавливался.';
  }
  function boot(){
    card=document.createElement('section');card.id='data-care';card.className='data-care card-surface';card.setAttribute('aria-labelledby','data-care-title');
    card.innerHTML='<h3 id="data-care-title">Где мои данные</h3><p>Рабочая копия — в этом браузере. Очистка данных сайта может её удалить.</p><div class="data-care-block"><strong>Операции и облако</strong><p data-care-cloud></p><p data-care-counts></p><button type="button" data-care-sync>Проверить статус операций →</button></div><div class="data-care-block"><strong>Файл копии</strong><p data-care-file></p><div class="data-care-actions"><button type="button" data-care-export>Подготовить копию</button><button type="button" data-care-transfer>Открыть перенос</button></div></div><details class="data-care-details"><summary>Что важно знать</summary><p>Облако синхронизирует операции и остаток, не все настройки. Статус подтверждается ответом сервера, а не наличием интернета.</p><p>В копии — операции, цели и настройки платежей. Оригиналы чеков не входят. Файл не зашифрован; храните его в безопасном месте. Автоматическая копия не создаётся.</p></details>';
    document.getElementById('view-settings').children[0].after(card);
    card.querySelector('[data-care-sync]').addEventListener('click',()=>jump('settings-sync','ledger-sync-retry'));
    card.querySelector('[data-care-export]').addEventListener('click',()=>{jump('settings-backup','backup-export');document.getElementById('backup-export').click();});
    card.querySelector('[data-care-transfer]').addEventListener('click',()=>jump('settings-backup','backup-import'));
    refresh();
  }
  for(const name of ['filely:financial-data-updated','fintex:storage-status','fintex:backup-prepared','fintex:tabchange','storage','focus'])window.addEventListener(name,refresh);
  document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
