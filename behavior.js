/* Local behavioral observations. No external model, psychological labels or hidden tracking. */
(function(){
  'use strict';
  const KEY='fp_behavior_v1';
  function load(){try{const data=JSON.parse(localStorage.getItem(KEY)||'{}');if(!data||typeof data!=='object'||Array.isArray(data))return {};for(const field of ['feedback','planned']){if(!data[field]||typeof data[field]!=='object'||Array.isArray(data[field]))data[field]={};}for(const key of Object.keys(data.feedback)){if(!data.feedback[key]||typeof data.feedback[key]!=='object')delete data.feedback[key];}return data;}catch(_){return {};}}
  function store(data){try{localStorage.setItem(KEY,JSON.stringify(data));return true;}catch(_){return false;}}
  function today(){return typeof TODAY==='string'?TODAY:FintexMath.key(new Date());}
  function initial(){const data=load();if(!data.observedSince){data.observedSince=today();store(data);}return data;}
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fieldMoney=n=>n===''?'':Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
  const money=n=>`${Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2})} ₽`;
  const date=d=>{if(FintexMath.ordinal(d)===null)return '—';const [y,m,day]=String(d).split('-');return `${day}.${m}.${y}`;};
  const period=(from,to)=>`${date(from)} — ${date(to)}`;
  function evidence(e, key='scenario'){return `<details class="behavior-proof" data-behavior-detail="${esc(key)}"><summary><i data-lucide="scan-text" aria-hidden="true"></i>Основа: ${e.samples} ${esc(e.unit)}<i data-lucide="chevron-down" aria-hidden="true"></i></summary><p class="behavior-evidence">${period(e.from,e.to)}<br>${esc(e.level)}. Это не статистическая гарантия.</p></details>`;}

  function feedback(id,data){
    const f=data.feedback?.[id];return `<div class="behavior-feedback" role="group" aria-label="Оценить подсказку"><button type="button" data-behavior-useful="${esc(id)}" aria-pressed="${!!f?.useful}">${f?.useful?'✓ Полезно':'Полезно'}</button><button type="button" data-behavior-dismiss="${esc(id)}" aria-label="Не актуально — скрыть на 30 дней">Не актуально</button></div>`;
  }
  function profile(result,data){
    const p=result.profile;
    const rows=[
      {key:'unusual',icon:'scan-line',label:'Покупки выше привычного',value:p.unusual?`${p.unusual.count} за последние 30 дней`:'Недостаточно истории',copy:p.unusual?`${period(p.unusual.from,p.unusual.to)} · ${p.unusual.comparable} покупок имеют базу сравнения. Не оценка импульсивности.`:'Нужны 30 расходов, история от 42 дней и сопоставимые покупки в категориях.'},
      {key:'spending',icon:'chart-no-axes-combined',label:'Разброс расходов',value:p.spending?`${p.spending.spread}% между месяцами`:'Пока не оцениваем',copy:p.spending?`${period(p.spending.from,p.spending.to)} · ${p.spending.months} полных месяцев. Описательный показатель расходов на день с записями, не оценка характера.`:'Нужны 3 полных месяца хотя бы с 12 днями расходов в каждом.'},
      {key:'saving',icon:'sprout',label:'Пополнение подушки',value:p.saving?`${p.saving.positive} из ${p.saving.months} месяцев`:'Начинаем наблюдение',copy:p.saving?`${period(p.saving.from,p.saving.to)} · Месяцы с чистым пополнением. Только наблюдаемые действия с подушкой в приложении. Внешние накопления не видны; полнота не подтверждена.`:`Учёт действий ведётся с ${date(data.observedSince||today())}; выводы — после 3 полных месяцев. Текущая сумма подушки не заменяет историю.`}
    ];
    return `<div class="behavior-profile" aria-label="Профиль наблюдений">${rows.map(r=>`<details data-behavior-detail="profile-${r.key}"><summary><span class="behavior-profile-icon" aria-hidden="true"><i data-lucide="${r.icon}"></i></span><span class="behavior-profile-text"><span>${r.label}</span><strong>${r.value}</strong></span><i data-lucide="chevron-down" class="behavior-profile-chevron" aria-hidden="true"></i></summary><p class="behavior-evidence">${r.copy}</p></details>`).join('')}</div>`;
  }

  function planner(result,data){
    const p=result.planning,remaining=data.plan?.remaining??'',monthly=data.plan?.monthly??'';
    let estimate='';
    if(p){
      const months=remaining>0?Math.ceil(remaining/p.monthly):0;
      estimate=`<p class="behavior-copy">Ориентир для сравнения — <strong>${money(p.monthly)} в месяц</strong>, ${remaining>0?`примерно ${months} мес. на указанную оставшуюся сумму`:'срок можно рассчитать после ввода оставшейся суммы'}, без доходности и инфляции.</p><p class="behavior-evidence">Основа: ${p.months} полных месяцев · ${period(p.from,p.to)}. ${p.basis==='saving'?'Нижний квартиль чистых пополнений подушки.':'Половина нижнего квартиля разницы записанных поступлений и расходов в месяцах с доходами. Это не факт накопления и не оценка всех обязательств.'} Это сценарий, не гарантия устойчивости.</p>`;
      if(Number(monthly)>p.monthly)estimate+='<p class="behavior-note">Ваш темп выше этого ориентира. Он может быть достижим — проверьте будущие доходы и обязательства, которых нет в журнале.</p>';
    }else if(result.planningReason==='nonpositive')estimate='<p class="behavior-copy">Истории уже достаточно для сравнения, но положительный ежемесячный темп по ней не подтверждён. Не будем рекомендовать сумму, которую эти записи не поддерживают. Вы можете сохранить собственный план и проверить его после новых наблюдений.</p>';
    else estimate='<p class="behavior-copy">Для персонального ориентира пока мало истории: нужны 3 полных месяца с поступлениями и хотя бы 12 днями расходов, либо 3 месяца наблюдения за подушкой. Пока можно сохранить собственный план — мы не будем выдавать его за рекомендацию.</p>';
    return `<details class="behavior-planner" data-behavior-detail="planner"><summary><span class="savings-planner-icon" aria-hidden="true"><i data-lucide="sprout"></i></span><span class="savings-planner-title"><strong>Темп накоплений</strong><small>Ваш план и ориентир по истории</small></span></summary><div class="savings-planner-body"><p class="behavior-copy">Сравните свой план с доступной историей. Это сценарий для размышления, не обязательство и не гарантия результата.</p><form id="behavior-plan-form"><div class="savings-fields"><label><span>Осталось накопить, ₽</span><input name="remaining" inputmode="decimal" value="${esc(fieldMoney(remaining))}" placeholder="Например, 100 000" required></label><label><span>Ваш темп в месяц, ₽</span><input name="monthly" inputmode="decimal" value="${esc(fieldMoney(monthly))}" placeholder="Например, 5 000" required></label></div><div class="savings-preview" aria-live="polite"><span>Срок по вашему плану</span><strong data-savings-duration>—</strong><small data-savings-explanation>Укажите сумму и ежемесячный взнос</small></div><button type="submit" class="behavior-primary">Сохранить мой план</button></form><div class="savings-history"><div class="savings-history-label"><i data-lucide="scan-text" aria-hidden="true"></i>Что видно по истории</div>${estimate}</div>${data.plan?`<p class="behavior-evidence">Ваш план сохранён ${date(data.plan.date)}. ${data.planChanges>1?`Вы явно меняли его ${Math.min(data.planChanges-1,999)} раз; это не считается ошибкой.`:''} Баланс и цель в разделе подушки не меняются.</p>`:''}</div></details>`;
  }
  function entryHTML(){
    const data=initial();
    if(data.enabled===false)return `<section id="fintex-behavior" class="behavior-panel"><h3>Поведенческие закономерности</h3><p class="behavior-copy">Наблюдения отключены. Финансовые записи и обычная аналитика не меняются.</p><button type="button" class="behavior-primary" data-behavior-enable>Включить наблюдения</button><p class="behavior-status" role="status"></p></section>`;
    const result=window.FintexBehaviorModel.analyze({transactions:state.transactions,today:today(),savingsEvents:data.savingsEvents||[],observedSince:data.observedSince,feedback:data.feedback||{},planned:data.planned||{}});
    const current=result.currentScenario;
    let currentHTML='';
    if(current){const horizon=FintexMath.ordinal(state.payday)===null?0:FintexMath.ordinal(state.payday)-FintexMath.ordinal(today());const estimate=horizon>0&&horizon<=45?` Если такой темп записанных трат сохранится ещё ${horizon} дней до указанной вами даты зарплаты, это около ${money(FintexMath.money(current.dailyRate*horizon))} расходов. Будущие доходы и изменения планов не учтены.`:'';
      currentHTML=`<article class="behavior-scenario"><span class="behavior-tag">Похожий сценарий сейчас</span><h4>Первые дни после зарплаты</h4><p>За ${current.days} дня записано ${money(current.spent)} — ${current.share}% отмеченной зарплаты. В сравнимые дни прошлых интервалов медиана — ${money(current.typical)}.${estimate}</p>${evidence(current.evidence)}<p class="behavior-note">Условный сценарий, не прогноз остатка и не предупреждение о неизбежной нехватке денег.</p></article>`;
    }
    const observations=result.insights.map((i,index)=>`<article class="behavior-insight"><div class="behavior-insight-heading"><span class="behavior-observation-number">${String(index+1).padStart(2,'0')}</span><span class="behavior-tag">Наблюдение по записям</span></div><h4>${esc(i.title)}</h4><p>${esc(i.text)}</p>${evidence(i.evidence, i.id)}<p class="behavior-note">${esc(i.suggestion)}</p>${feedback(i.id,data)}</article>`).join('');
    const unusual=result.unusual.map(t=>`<article class="behavior-unusual"><h4>${esc(t.merchant)}</h4><p class="money-val">${money(t.amount)} · ${date(t.date)}. Примерно в ${t.multiple.toFixed(1).replace('.',',')} раза больше медианы ${money(t.baseline)} в этой категории.</p><p class="behavior-evidence">Сравнение с ${t.count} более ранними покупками · ${period(t.from,t.date)}. Это необычная сумма, не доказательство импульсивности.</p><button type="button" data-behavior-planned="${esc(t.id)}">Было запланировано</button></article>`).join('');
    return `<section id="fintex-behavior" class="behavior-panel"><div class="behavior-heading"><div class="behavior-title-line"><span class="behavior-emblem" aria-hidden="true"><i data-lucide="sparkles"></i></span><span class="behavior-tag">Личные наблюдения</span></div><h3>Поведенческий<br>интеллект<span aria-hidden="true">.</span></h3><p class="behavior-copy">Замечаем повторения в расходах.<br>Без оценок характера и диагнозов.</p></div><div class="behavior-window"><i data-lucide="calendar-range" aria-hidden="true"></i><div><strong>${period(result.from,result.to)}</strong><span>Своя история до 183 дней · не зависит от периода выше</span></div></div><div class="behavior-metrics"><div><strong>${result.insights.length}</strong><span>наблюдений</span></div><div><strong>${result.records}</strong><span>записей</span></div><div><strong>${result.activeDays}</strong><span>дней с тратами</span></div></div>${profile(result,data)}${currentHTML}<div class="behavior-insights">${observations||'<p class="behavior-empty">Повторяющиеся закономерности пока не подтверждены. Пустой список — не оценка вашего поведения. По мере появления сопоставимых недель и месяцев здесь появятся объяснимые наблюдения.</p>'}</div>${result.hiddenCount?`<p class="behavior-evidence">${result.hiddenCount} подсказок скрыто по вашему выбору.</p><button type="button" data-behavior-restore>Показать скрытые подсказки</button>`:''}${unusual?`<details class="behavior-unusual-list" data-behavior-detail="unusual" open><summary>Покупки выше привычного</summary>${unusual}</details>`:''}${planner(result,data)}<details class="behavior-method" data-behavior-detail="method"><summary>Как читать наблюдения</summary><p class="behavior-footnote">${esc(result.caveat)} Реакции меняют порядок и частоту подсказок, а не достоверность фактов. Молчание не считается согласием.</p></details><details class="behavior-settings" data-behavior-detail="settings"><summary>Данные и управление</summary><p class="behavior-copy">Вычисления и обратная связь хранятся в этом браузере, не отправляются внешнему ИИ. Облачный журнал может быть неполным. История пополнений подушки начинается после включения функции; прошлое не восстанавливаем по текущему остатку.</p><div class="behavior-feedback"><button type="button" data-behavior-disable>Отключить наблюдения</button><button type="button" data-behavior-reset>Сбросить память подсказок</button></div><p class="behavior-evidence">Сброс удалит только реакции, отметки «запланировано», план и историю наблюдений за подушкой. Суммы на счетах и операции останутся.</p></details><p class="behavior-status" role="status" aria-live="polite"></p></section>`;
  }
  function rerender(note){window.FintexAnalyticsPro?.render();const el=document.querySelector('#fintex-behavior .behavior-status');if(el)el.textContent=note;}
  function bind(container){
    const panel=container.querySelector('#fintex-behavior');if(!panel||panel.dataset.bound)return;panel.dataset.bound='1';
    panel.addEventListener('click',event=>{
      const b=event.target.closest('button');if(!b)return;const data=initial();data.feedback=data.feedback||{};data.planned=data.planned||{};
      let note='';
      if(b.hasAttribute('data-behavior-useful')){const id=b.dataset.behaviorUseful;data.feedback[id]={...data.feedback[id],useful:!data.feedback[id]?.useful};note='Реакция сохранена. Она влияет на приоритет, не на выводы из данных.';}
      else if(b.hasAttribute('data-behavior-dismiss')){const id=b.dataset.behaviorDismiss;data.feedback[id]={...data.feedback[id],dismissedUntil:FintexMath.shift(today(),30)};note='Подсказка скрыта на 30 дней. Это не считается подтверждением или опровержением закономерности.';}
      else if(b.hasAttribute('data-behavior-planned')){data.planned[b.dataset.behaviorPlanned]=true;note='Покупка отмечена как запланированная. Исключили её из необычных покупок, не удаляя из расчётов.';}
      else if(b.hasAttribute('data-behavior-restore')){for(const f of Object.values(data.feedback))delete f.dismissedUntil;note='Скрытые подсказки снова доступны.';}
      else if(b.hasAttribute('data-behavior-disable')){data.enabled=false;note='Наблюдения отключены.';}
      else if(b.hasAttribute('data-behavior-enable')){data.enabled=true;note='Наблюдения включены. Новые действия с подушкой будут учитываться с этого момента.';data.observedSince=today();data.savingsEvents=[];}
      else if(b.hasAttribute('data-behavior-reset')){if(!window.confirm('Сбросить память подсказок? Финансовые операции и баланс не изменятся.'))return;if(!store({enabled:true,observedSince:today()})){rerender('Не удалось сохранить изменения в браузере.');return;}rerender('Память подсказок сброшена. Финансовые записи не изменены.');return;}
      else return;
      if(!store(data)){rerender('Не удалось сохранить реакцию в браузере.');return;}rerender(note);
    });
    const planForm=panel.querySelector('#behavior-plan-form');
    function updatePlanPreview(){
      if(!planForm)return;
      const remaining=FintexMath.parse(planForm.elements.remaining.value),monthly=FintexMath.parse(planForm.elements.monthly.value);
      const valid=remaining>0&&monthly>0;
      planForm.querySelector('[data-savings-duration]').textContent=valid?`${Math.ceil(remaining/monthly).toLocaleString('ru-RU')} мес.`:'—';
      planForm.querySelector('[data-savings-explanation]').textContent=valid?'При неизменном взносе. Без доходности и инфляции; это сценарий, не гарантия.':'Укажите положительные суммы с точностью до копеек';
    }
    planForm?.addEventListener('input',updatePlanPreview);updatePlanPreview();
    panel.querySelector('#behavior-plan-form')?.addEventListener('submit',event=>{
      event.preventDefault();const fields=new FormData(event.target),remaining=FintexMath.parse(fields.get('remaining')),monthly=FintexMath.parse(fields.get('monthly'));
      if(!(remaining>0&&monthly>0)){panel.querySelector('.behavior-status').textContent='Укажите положительные суммы с точностью до копеек.';return;}
      const data=initial();if(!data.plan||data.plan.remaining!==remaining||data.plan.monthly!==monthly)data.planChanges=Math.min(1000,(Number(data.planChanges)||0)+1);
      data.plan={remaining,monthly,date:today()};
      if(!store(data)){panel.querySelector('.behavior-status').textContent='Не удалось сохранить план.';return;}
      rerender('Ваш план сохранён. Баланс, резерв и существующая цель не менялись.');
      document.querySelector('.behavior-planner')?.setAttribute('open','');
    });
  }
  function recordSaving(delta){
    const data=initial();if(data.enabled===false||!Number.isFinite(delta)||delta===0)return;
    data.savingsEvents=[...(Array.isArray(data.savingsEvents)?data.savingsEvents:[]),{date:today(),delta:FintexMath.money(delta)}];
    if(data.savingsEvents.length>2000){data.savingsEvents=data.savingsEvents.slice(-2000);data.observedSince=FintexMath.shift(data.savingsEvents[0].date,1);}
    store(data);
  }
  window.FintexBehavior={entryHTML,bind,recordSaving};initial();
  if(window.FintexAnalyticsPro)window.FintexAnalyticsPro.render();
})();
