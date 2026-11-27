/* Reorganize existing controls, never duplicate financial routes or write preferences. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 function disclosure(id,label){const el=document.createElement('details');el.id=id;el.className='quiet-details';const summary=document.createElement('summary');summary.textContent=label;el.append(summary);return el;}
 function boot(){
  const capture=$('capture-fab')?.querySelector('span');if(capture)capture.textContent='Чек / скриншот';
  const hero=$('hero-balance-card'),more=disclosure('balance-more','Расчёт и прогноз');
  hero.querySelector('.balance-total').after(more);
  for(const id of ['hero-limit-explain','hero-forecast-row','balance-check-action'])if($(id))more.append($(id));
  // Keep reservations, the actual storage status and warnings visible outside this disclosure.
  hero.querySelector('.balance-breakdown').after(more);
  const tools=disclosure('journal-more','Ещё');tools.querySelector('summary').id='journal-more-label';
  $('journal-search-toggle').after(tools);
  const menu=document.createElement('div');menu.className='journal-more-actions';tools.append(menu);
  for(const id of ['feed-select-mode-btn','feed-today-btn','history-replay'])if($(id))menu.append($(id));
  tools.addEventListener('click',event=>{const button=event.target.closest('button');if(!button)return;tools.open=false;if(button.id==='feed-select-mode-btn')document.querySelector('#tx-feed .tx-row-open')?.focus({preventScroll:true});});
  document.addEventListener('click',event=>{if(tools.open&&!tools.contains(event.target))tools.open=false;});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&tools.open&&!document.querySelector('dialog[open],[id^="modal-"]:not(.hidden) .modal-sheet')){tools.open=false;tools.querySelector('summary').focus({preventScroll:true});event.preventDefault();}});
  const settings=$('view-settings'),profile=$('st-name').closest('.card-surface');profile.id='settings-profile';
  // Group actual existing elements: all IDs, listeners and restore safeguards survive.
  settings.querySelectorAll(':scope > .section-caption').forEach(el=>el.remove());
  for(const [id,title,nodes]of [
   ['settings-personal','Под себя',[profile,$('settings-appearance'),$('settings-work-time')]],
   ['settings-storage','Сохранить и перенести',[$('data-care'),$('settings-backup'),$('settings-receipts')]],
   ['settings-connection','Подключение и помощь',[$('settings-sync'),$('settings-data'),$('settings-guide'),$('settings-advanced'),$('settings-about')]]
  ]){const group=document.createElement('section');group.id=id;group.className='settings-task';group.setAttribute('aria-labelledby',id+'-title');const heading=document.createElement('h3');heading.id=id+'-title';heading.textContent=title;group.append(heading);nodes.filter(Boolean).forEach(node=>group.append(node));settings.append(group);}
  const calendar=$('view-calendar'),day=$('cal-day-section'),plan=$('calendar-plan');plan.before(day);
  const totals=disclosure('calendar-month-totals','Итоги месяца');totals.append($('cal-month-cashflow'),$('cal-period-summary'));const note=document.createElement('p');note.className='calendar-purpose';note.textContent='Доходы минус расходы по записям. Это не остаток на счёте.';totals.append(note);day.after(totals);
  const caption=document.createElement('p');caption.className='calendar-purpose';caption.textContent='Платежи и записи по дням';calendar.querySelector('h2').after(caption);
  const exportButton=calendar.querySelector('[onclick="exportToIosCalendar()"]');exportButton.id='calendar-export';plan.querySelector('.section-body').append(exportButton);
 }
 document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
