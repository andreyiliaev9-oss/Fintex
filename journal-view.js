/* Journal controls are an in-memory view, not financial writes or saved preferences. */
(() => {
 'use strict';
 const M=FintexJournalModel,$=id=>document.getElementById(id);
 let panel,dirty=false,selectionNotice='';
 const typeNames={all:'Все операции',income:'Доходы',expense:'Расходы',transfer:'Между своими счетами',adjustment:'Корректировки'};
 const formatDate=d=>new Date(d+'T12:00:00').toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'});
 function fill(){
  const v=M.effective(state.journalView,state.journalDay);
  for(const key of ['type','category','period','from','to'])$('journal-'+key).value=v[key];
  custom();dirty=false;$('journal-filter-dirty').hidden=true;$('journal-filter-error').textContent='';
 }
 function custom(){
  $('journal-range').hidden=$('journal-period').value!=='custom';
  $('journal-category').disabled=$('journal-type').value!=='expense';
  $('journal-from').max=$('journal-to').max=TODAY;
 }
 function focusSummary(){$('journal-results').focus({preventScroll:true});}
 function reset(){state.journalView=M.defaults();state.journalDay=null;state.homeShowAllTx=false;dirty=false;fill();renderHome();panel.open=false;focusSummary();}
 function boot(){
  panel=document.createElement('details');panel.id='journal-filters';panel.className='journal-filters';
  panel.innerHTML='<summary>Фильтры <span id="journal-filter-label">Все операции · всё время</span></summary><form id="journal-filter-form" novalidate><label for="journal-type">Вид операции<select id="journal-type"></select></label><label for="journal-category">Категория расходов<select id="journal-category"><option value="all">Все категории</option></select></label><label for="journal-period">Период<select id="journal-period"><option value="all">Всё время</option><option value="today">Сегодня</option><option value="7d">Последние 7 дней</option><option value="month">Этот месяц по сегодня</option><option value="custom">Свои даты</option></select></label><div id="journal-range" hidden><label for="journal-from">С даты<input type="date" id="journal-from"></label><label for="journal-to">По дату включительно<input type="date" id="journal-to"></label></div><p id="journal-filter-error" role="status"></p><p id="journal-filter-dirty" role="status" hidden>Изменения ещё не применены.</p><div class="journal-filter-actions"><button type="submit">Применить</button><button type="button" id="journal-filter-reset">Сбросить фильтры</button></div><p class="journal-filter-note">Фильтры не меняют записи или бюджет. Поиск применяется вместе с ними. Сумма в поиске — точная, с копейками.</p></form>';
  $('search-bar-wrap').before(panel);
  for(const [value,label]of Object.entries(typeNames))$('journal-type').append(new Option(label,value));
  for(const [value,cat]of Object.entries(CATS))$('journal-category').append(new Option(cat.name,value));
  const results=document.createElement('section');results.id='journal-results';results.tabIndex=-1;results.setAttribute('aria-label','Результаты журнала');results.innerHTML='<p id="journal-result-count" role="status" aria-live="polite" aria-atomic="true"></p><p id="journal-selection-notice" role="status"></p><div id="journal-result-totals" hidden><p>По всем найденным записям</p><div><span>Доходы <strong id="journal-result-income"></strong></span><span>Расходы <strong id="journal-result-expense"></strong></span></div><p id="journal-result-neutral"></p></div><button type="button" id="journal-reset-active" hidden>Сбросить фильтры</button>';
  $('tx-feed').before(results);
  $('journal-filter-form').addEventListener('input',()=>{dirty=true;$('journal-filter-dirty').hidden=false;});
  $('journal-filter-form').addEventListener('change',event=>{dirty=true;$('journal-filter-dirty').hidden=false;if(event.target.id==='journal-type')$('journal-category').value='all';custom();});
  $('journal-filter-form').addEventListener('submit',event=>{
   event.preventDefault();const input=Object.fromEntries(['type','category','period','from','to'].map(k=>[k,$('journal-'+k).value]));const result=M.validate(input,TODAY);
   if(result.error){$('journal-filter-error').textContent=result.error;return;}
   state.journalView=result.value;state.journalDay=null;state.homeShowAllTx=false;dirty=false;renderHome();panel.open=false;focusSummary();
  });
  $('journal-filter-reset').onclick=reset;$('journal-reset-active').onclick=reset;
  // Fill before the native opening action; a delayed toggle event must not erase fast input.
  panel.querySelector('summary').addEventListener('click',()=>{if(!panel.open)fill();});
  fill();renderHome();
 }
 function scopeSelection(rows){
  const visible=new Set(rows.map(t=>t.id)),before=Array.isArray(state.selectedTxIds)?state.selectedTxIds:[];
  const next=before.filter(id=>visible.has(id));
  if(next.length<before.length)selectionNotice='Выбор обновлён: скрытые записи сняты с выбора.';
  else if(!state.txSelectMode)selectionNotice='';
  state.selectedTxIds=next;
 }
 function render(result,shown){
  if(!panel)return;
  const categories=new Set([...$('journal-category').options].map(o=>o.value));
  for(const tx of state.transactions)if(tx.type==='expense'&&tx.category&&!categories.has(tx.category)){categories.add(tx.category);$('journal-category').append(new Option(String(tx.category),tx.category));}
  const v=result.view;let period={all:'всё время',today:'сегодня','7d':'последние 7 дней',month:'этот месяц по сегодня'}[v.period];
  if(v.period==='custom')period=v.from===v.to?formatDate(v.from):formatDate(v.from)+' — '+formatDate(v.to);
  $('journal-filter-label').textContent=typeNames[v.type]+(v.category!=='all'?' · '+(CATS[v.category]?.name||v.category):'')+' · '+period;
  $('journal-result-count').textContent=`Показано ${shown} из ${result.rows.length}${result.active||$('search-input').value.trim()?' найденных записей':' записей'}`;
  $('journal-selection-notice').textContent=selectionNotice;
  const active=result.active||!!$('search-input').value.trim();$('journal-result-totals').hidden=!active;
  if(active){FintexNumerals.renderJournal($('journal-result-income'),result.income,'+');FintexNumerals.renderJournal($('journal-result-expense'),result.expense,'−');$('journal-result-neutral').textContent=result.neutral?`Переводы и корректировки: ${result.neutral}. В доходы и расходы выше не входят.`:'';}
  $('journal-reset-active').hidden=!result.active;
  if(!dirty&&!panel.open)fill();
 }
 window.FintexJournalUI={scopeSelection,render};
 document.addEventListener('DOMContentLoaded',boot,{once:true});
})();
