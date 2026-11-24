/* Fintex · Free learning foundation. No quotes, broker API or paid services.
 * The isolated local account cannot execute trades or affect the real budget.
 */
(function (root) {
  'use strict';
  const KEY = 'fp_invest_learning_v1';
  const INITIAL_CASH = 10000000; // integer kopecks, virtual RUB only
  const lessons = [
    { id: 'ownership', title: 'Что вы покупаете', text: 'Акция — доля в компании. Её цена может расти и падать. Ни известное имя компании, ни прошлый рост не гарантируют прибыль. Владелец акции может потерять вложенные деньги.', question: 'Что гарантирует покупка акции?', options: ['Доход каждый месяц', 'Долю в компании, но не прибыль', 'Возврат всей вложенной суммы'], answer: 1, explanation: 'Акция даёт долю в компании. Доход и сохранность вложенной суммы не гарантированы.' },
    { id: 'quotes', title: 'Цена и время', text: 'У котировки есть источник и время. Realtime — поток без заявленной задержки; delayed — данные с задержкой; EOD — итог дня. Даже realtime-котировка может устареть. Последняя цена сделки не гарантирует цену вашей покупки.', question: 'Можно ли считать вчерашнюю цену актуальной только потому, что страница обновилась?', options: ['Да, после обновления это новая цена', 'Нет, важно время самой котировки'], answer: 1, explanation: 'Обновление страницы не меняет время рыночного события. При устаревших данных учебные сделки должны быть заблокированы.' },
    { id: 'fees', title: 'Комиссия тоже расход', text: 'Условный пример, не рыночная котировка: акция стоит 1 000 ₽. Покупка двух акций стоит 2 000 ₽. При учебной комиссии 0,3% дополнительно потребуется 6 ₽. Продажа может иметь отдельную комиссию. В реальном счёте условия зависят от брокера и рынка.', question: 'Сколько нужно на такую покупку с комиссией?', options: ['2 000 ₽', '2 006 ₽', '1 994 ₽'], answer: 1, explanation: '2 × 1 000 + 2 000 × 0,003 = 2 006 ₽. Это арифметический пример, не текущая цена акции и не действующий тариф брокера.' },
    { id: 'diversification', title: 'Не всё в одну компанию', text: 'Концентрация — большая доля денег в одном активе. Разные компании и отрасли могут снизить отдельные риски, но диверсификация не исключает убытки. Несколько компаний одного сектора могут реагировать на события похожим образом.', question: 'Что верно о диверсификации?', options: ['Она исключает любой убыток', 'Любые две акции уже полностью защищают портфель', 'Она снижает некоторые риски, но не все'], answer: 2, explanation: 'Распределение денег снижает некоторые риски, однако общий рынок тоже может падать.' },
    { id: 'horizon', title: 'План важнее эмоций', text: 'До решения полезно записать цель, срок, допустимый убыток и причины пересмотра. Нереализованный результат — изменение оценки ещё не проданной позиции; реализованный — результат закрытой части позиции с учётом выбранной методики и издержек. Рост на экране не становится свободными деньгами.', question: 'Как лучше оценивать учебный прогресс?', options: ['По числу сделок за день', 'По пониманию рисков, издержек и причин решений', 'Только по самому высокому доходу за неделю'], answer: 1, explanation: 'Цель обучения — понимать решения и их ограничения, а не соревноваться в частоте сделок или краткосрочной прибыли.' }
  ];
  function fresh() { return { version: 1, cashKopecks: INITIAL_CASH, completed: [], journal: [] }; }
  function valid(s) {
    return !!s && s.version === 1 && s.cashKopecks === INITIAL_CASH &&
      Array.isArray(s.completed) && s.completed.length <= lessons.length && new Set(s.completed).size === s.completed.length && s.completed.every(id => lessons.some(l => l.id === id)) &&
      Array.isArray(s.journal) && s.journal.length <= 100 && s.journal.every(n => n && typeof n.id === 'string' && n.id.length <= 100 &&
        typeof n.createdAt === 'string' && Number.isFinite(Date.parse(n.createdAt)) &&
        typeof n.company === 'string' && n.company.length <= 80 && typeof n.thesis === 'string' && n.thesis.trim().length > 0 && n.thesis.length <= 1200 &&
        typeof n.horizon === 'string' && n.horizon.length <= 120 && typeof n.risk === 'string' && n.risk.length <= 600) &&
      new Set(s.journal.map(n => n.id)).size === s.journal.length;
  }
  function read(storage) {
    try {
      const raw = storage.getItem(KEY);
      if (raw === null) return { data: fresh(), error: '' };
      const data = JSON.parse(raw);
      if (!valid(data)) throw new Error('schema');
      return { data, error: '' };
    } catch (_) { return { data: fresh(), error: 'Не удалось прочитать учебные данные. Исходная запись не перезаписана. Проверьте доступ к хранилищу или явно сбросьте только обучение.' }; }
  }
  function write(storage, data) {
    if (!valid(data)) throw new Error('Некорректные учебные данные');
    storage.setItem(KEY, JSON.stringify(data));
  }
  const core = { KEY, INITIAL_CASH, fresh, valid, read, write, lessons };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (!root.document) return;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let dialog, tab = 'account', currentLesson = null, overflow, status;
  let draft = { company: '', thesis: '', horizon: '', risk: '' };
  let resetRequested = false;
  const store = {
    getItem: key => root.localStorage.getItem(key),
    setItem: (key, value) => root.localStorage.setItem(key, value)
  };
  function entryHTML() {
    return `<button type="button" class="inv-entry card-surface" data-invest-open><span class="inv-entry-icon" aria-hidden="true">↗</span><span><span class="inv-eyebrow">Бесплатно · Учебный режим</span><strong>Учиться инвестировать</strong><small>5 уроков, виртуальный счёт и дневник решений</small></span><span aria-hidden="true">→</span></button>`;
  }
  function showMessage(text, error = false) {
    const el = dialog.querySelector('#inv-message');
    el.textContent = text; el.dataset.error = String(error);
  }
  function commit(change) {
    const latest = read(store);
    if (latest.error) { showMessage(latest.error, true); return false; }
    try { change(latest.data); write(store, latest.data); status = latest; return true; }
    catch (_) { showMessage('Не удалось сохранить. Возможно, хранилище заполнено или недоступно. Запись не подтверждена; введённый текст сохранён в форме.', true); return false; }
  }
  function accountHTML() {
    return `<div class="inv-wallet card-surface"><span class="inv-eyebrow">Виртуальные деньги · RUB</span><div class="inv-cash money-val">100 000 ₽</div><p>Стартовый учебный остаток. Это не реальные деньги: их нельзя пополнить, вывести или потратить в Fintex.</p><div class="inv-wallet-stats"><span>Позиции <b>0</b></span><span>Сделки <b>0</b></span><span>Результат <b>—</b></span></div></div>
      <section class="inv-notice" aria-labelledby="inv-data-title"><span class="inv-eyebrow">Рыночные данные</span><h3 id="inv-data-title">Котировки не подключены</h3><p>Платные источники не используются и не планируются. Доступ ко всем биржам в реальном времени не обещаем. Бесплатный источник можно подключить только после проверки прав на показ данных пользователям.</p><div class="inv-actions"><button type="button" disabled>Купить</button><button type="button" disabled>Продать</button></div><small>Пока нет проверенных котировок, сделки заблокированы. Случайных цен и фиктивных графиков здесь нет.</small></section>
      <section class="inv-section"><h3>Начните с понимания</h3><p>Пройдите короткий урок, затем запишите, какие риски вы готовы принять. Здесь нет сигналов «покупай» и соревнований по доходности.</p><button type="button" class="inv-primary" data-inv-tab="lessons">Перейти к урокам →</button></section>`;
  }
  function lessonsHTML() {
    if (currentLesson) {
      const l = lessons.find(l => l.id === currentLesson);
      return `<section class="inv-section card-surface"><button type="button" class="inv-link" data-lesson-back>← Все уроки</button><span class="inv-eyebrow">Урок ${lessons.indexOf(l)+1} из 5</span><h3>${l.title}</h3><p>${l.text}</p><form id="inv-quiz"><fieldset><legend>${l.question}</legend>${l.options.map((o,i)=>`<label class="inv-answer"><input type="radio" name="answer" value="${i}" required> <span>${o}</span></label>`).join('')}</fieldset><button class="inv-primary" type="submit">Проверить ответ</button></form><p id="inv-feedback" role="status"></p></section>`;
    }
    return `<section class="inv-section"><h3>Знания, а не гонка за доходом</h3><p>Пройдено: ${status.data.completed.length} из 5. Прогресс засчитывается за верный ответ, не за сделки.</p><progress aria-label="Пройденные уроки" max="5" value="${status.data.completed.length}"></progress></section><div class="inv-lesson-list">${lessons.map((l,i)=>`<button type="button" class="inv-lesson card-surface" data-lesson="${l.id}"><span class="inv-lesson-number">${i+1}</span><span><strong>${l.title}</strong><small>${status.data.completed.includes(l.id)?'Пройдено · Повторить':'Короткое объяснение и вопрос'}</small></span><span aria-hidden="true">${status.data.completed.includes(l.id)?'✓':'→'}</span></button>`).join('')}</div>`;
  }
  function journalHTML() {
    return `<section class="inv-section"><h3>Сначала запишите своё решение</h3><p>Это заметка, не заявка на покупку. Не записывайте пароли и ключи API. До ${100-status.data.journal.length} новых записей.</p><form id="inv-journal-form"><label>Компания или тикер · необязательно<input name="company" maxlength="80" value="${esc(draft.company)}" placeholder="Название для вашей заметки"></label><label>Почему рассматриваю эту инвестицию?<textarea name="thesis" required maxlength="1200" rows="3">${esc(draft.thesis)}</textarea></label><label>На какой срок?<input name="horizon" maxlength="120" value="${esc(draft.horizon)}" placeholder="Например, несколько лет"></label><label>Какие риски вижу и что изменит моё мнение?<textarea name="risk" maxlength="600" rows="3">${esc(draft.risk)}</textarea></label><button type="submit" class="inv-primary">Сохранить запись</button></form></section><section class="inv-section"><h3>Мои записи · ${status.data.journal.length}</h3>${status.data.journal.length ? status.data.journal.map(n=>`<article class="inv-note card-surface"><small>${esc(new Date(n.createdAt).toLocaleDateString('ru-RU'))}</small><h4>${esc(n.company || 'Размышление об инвестициях')}</h4><p>${esc(n.thesis)}</p>${n.horizon?`<p><b>Срок:</b> ${esc(n.horizon)}</p>`:''}${n.risk?`<p><b>Риски и пересмотр:</b> ${esc(n.risk)}</p>`:''}</article>`).join('') : '<div class="inv-empty">Записей пока нет. Начните с вопроса: зачем мне инвестировать?</div>'}</section>`;
  }
  function rulesHTML() {
    return `<section class="inv-section card-surface"><h3>Бесплатно — без подписок</h3><p>В этом разделе нет оплаты, брокерских подключений, внешних запросов котировок или скрытого перехода на платный тариф.</p><h3>Отдельно от вашего бюджета</h3><p>Учебный остаток не входит в баланс Fintex, дневной лимит, расходы и накопления. Реальные покупки и продажи здесь невозможны.</p><h3>Сохраняется только на этом устройстве</h3><p>Уроки и дневник хранятся в localStorage этого браузера. Облачной синхронизации нет. Очистка данных браузера или смена устройства может привести к потере записей. Не используйте дневник как единственную копию важных данных.</p><h3>Не индивидуальная рекомендация</h3><p>Материалы помогают понять базовые понятия, но не выбирают акции за вас и не обещают доходность.</p></section><section class="inv-section"><h3>Сброс обучения</h3><p>Удалит только прогресс уроков и записи инвестиционного дневника. Виртуальный остаток вернётся к 100 000 ₽. Личные финансы Fintex не изменятся.</p>${resetRequested ? '<div class="inv-reset-confirm" role="group" aria-label="Подтверждение сброса"><p>Все учебные записи будут удалены без возможности отмены.</p><button type="button" class="inv-danger" data-reset-confirm>Удалить учебные данные</button><button type="button" data-reset-cancel>Отмена</button></div>' : '<button type="button" class="inv-danger" data-reset-request>Сбросить только обучение</button>'}</section>`;
  }
  function render() {
    status = read(store);
    const content = dialog.querySelector('#inv-content');
    content.innerHTML = tab === 'account' ? accountHTML() : tab === 'lessons' ? lessonsHTML() : tab === 'journal' ? journalHTML() : rulesHTML();
    dialog.querySelectorAll('[data-inv-nav]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.invNav===tab)));
    showMessage(status.error, !!status.error);
  }
  function setTab(next) {
    if (!['account','lessons','journal','rules'].includes(next)) return;
    tab=next; currentLesson=null; resetRequested=false; render(); dialog.querySelector('#inv-content').scrollTop=0;
  }
  function mount() {
    if (dialog) return;
    dialog=document.createElement('dialog'); dialog.id='invest-learning'; dialog.className='inv-dialog';
    dialog.setAttribute('aria-labelledby','inv-title');
    dialog.innerHTML=`<header class="inv-header"><div><span class="inv-eyebrow">Демо · Только виртуальные деньги</span><h2 id="inv-title">Учиться инвестировать</h2></div><button type="button" class="inv-close" data-invest-close aria-label="Закрыть учебные инвестиции">×</button></header><nav class="inv-nav" aria-label="Учебные инвестиции">${[['account','Счёт'],['lessons','Уроки'],['journal','Дневник'],['rules','Правила']].map(([id,label])=>`<button type="button" data-inv-nav="${id}" aria-pressed="false">${label}</button>`).join('')}</nav><div id="inv-message" role="status" aria-live="polite"></div><div id="inv-content" class="inv-content"></div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close',()=>{document.body.style.overflow=overflow;});
    dialog.addEventListener('click',event=>{
      const b=event.target.closest('button'); if(!b) return;
      if(b.hasAttribute('data-invest-close')) dialog.close();
      if(b.dataset.invNav) setTab(b.dataset.invNav);
      if(b.dataset.invTab) setTab(b.dataset.invTab);
      if(b.dataset.lesson) {currentLesson=b.dataset.lesson;render();dialog.querySelector('[data-lesson-back]').focus();}
      if(b.hasAttribute('data-lesson-back')) {currentLesson=null;render();}
      if(b.hasAttribute('data-reset-request')) {resetRequested=true;render();dialog.querySelector('[data-reset-cancel]').focus();}
      if(b.hasAttribute('data-reset-cancel')) {resetRequested=false;render();dialog.querySelector('[data-reset-request]').focus();}
      if(b.hasAttribute('data-reset-confirm')) {
        try {write(store,fresh());draft={company:'',thesis:'',horizon:'',risk:''};resetRequested=false;render();showMessage('Учебные данные сброшены. Личный бюджет не изменён.');}
        catch(_){showMessage('Не удалось сбросить данные. Проверьте доступ к хранилищу.',true);}
      }
    });
    dialog.addEventListener('input',event=>{
      if(event.target.form?.id==='inv-journal-form') draft[event.target.name]=event.target.value;
    });
    dialog.addEventListener('submit',event=>{
      event.preventDefault();
      if(event.target.id==='inv-quiz') {
        const l=lessons.find(l=>l.id===currentLesson);
        const answer=new FormData(event.target).get('answer');
        const feedback=dialog.querySelector('#inv-feedback');
        if(answer===null) {feedback.textContent='Выберите ответ.';return;}
        if(Number(answer)!==l.answer){feedback.textContent='Попробуйте ещё раз. '+l.explanation;return;}
        if(commit(s=>{if(!s.completed.includes(l.id))s.completed.push(l.id);})){feedback.textContent='Верно. '+l.explanation;}
      }
      if(event.target.id==='inv-journal-form') {
        const values=Object.fromEntries(new FormData(event.target));
        if(!values.thesis?.trim()){showMessage('Запишите причину решения — не только пробелы.',true);return;}
        if(read(store).data.journal.length>=100){showMessage('Достигнут предел: 100 записей. Перед сбросом сохраните важные записи отдельно.',true);return;}
        if(commit(s=>{
          if(s.journal.length>=100)throw new Error('limit');
          s.journal.unshift({id:root.crypto.randomUUID(),createdAt:new Date().toISOString(),company:values.company.trim(),thesis:values.thesis.trim(),horizon:values.horizon.trim(),risk:values.risk.trim()});
        })){draft={company:'',thesis:'',horizon:'',risk:''};render();showMessage('Запись сохранена только на этом устройстве.');}
      }
    });
  }
  function open() {
    mount(); if(dialog.open)return;
    render(); overflow=document.body.style.overflow; document.body.style.overflow='hidden'; dialog.showModal();
    dialog.querySelector('[data-invest-close]').focus();
  }
  document.addEventListener('click',e=>{if(e.target.closest('[data-invest-open]'))open();});
  root.addEventListener('storage',event=>{
    if(dialog?.open && (event.key===KEY || event.key===null)) {render();if(!status.error)showMessage('Учебные данные обновлены в другой вкладке.');}
  });
  root.FintexInvestments={open,entryHTML};
})(typeof window !== 'undefined' ? window : globalThis);
