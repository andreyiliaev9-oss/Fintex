/* Fintex · Free learning with real-share reference and manual-price practice.
 * No market quotes, broker API or paid services. No effect on the real budget.
 */
(function (root) {
  'use strict';
  const KEY = 'fp_invest_learning_v1';
  const market = root.FintexPracticeMarket || (typeof require === 'function' ? require('./investment-market.js') : null);
  const INITIAL_CASH = 10000000; // integer kopecks, virtual RUB only
  const lessons = [
    { id: 'ownership', title: 'Акция — маленькая часть компании', text: 'Представьте пекарню, которую разделили на 100 частей. Купив одну часть, вы стали владельцем небольшой доли бизнеса. С акциями тот же смысл.', example: 'Компания может развиваться, а её акция — дорожать. Но бывают убытки, и цена может упасть. Даже известная компания не обещает вам прибыль.', question: 'Что вы получаете, покупая акцию?', options: ['Гарантированный доход каждый месяц', 'Долю в компании, но не обещание прибыли', 'Обещание вернуть все деньги'], answer: 1, explanation: 'Вы покупаете часть компании. Это не вклад с обещанной выплатой: можно заработать, а можно потерять деньги.' },
    { id: 'quotes', title: 'Цена может устареть', text: 'Котировка — это цена с биржи. Рядом важно смотреть время: когда именно она была получена. Цена вчера и цена сейчас могут сильно отличаться.', example: 'В магазине вчера яблоки стоили 100 ₽. Это не значит, что сегодня вы купите их за те же деньги. Обновление страницы тоже не делает вчерашнюю цену новой.', question: 'Страница обновилась, но у цены стоит вчерашняя дата. Это цена на сейчас?', options: ['Да, ведь страница обновилась', 'Нет, сама цена осталась вчерашней'], answer: 1, explanation: 'Смотрите на время рядом с ценой. В наших тренировках цену вводите вы сами — это не цена с биржи.' },
    { id: 'fees', title: 'За сделку может быть плата', text: 'Комиссия — плата за покупку или продажу. Она уменьшает ваш результат. В тренировке используем условную комиссию 0,3% за каждую сделку. У настоящего брокера правила могут быть другими.', example: 'Не рыночная цена, а пример: одна акция стоит 1 000 ₽. Две стоят 2 000 ₽. Комиссия 0,3% — ещё 6 ₽. Всего нужно 2 006 ₽.', question: 'Сколько нужно на две такие акции вместе с комиссией?', options: ['2 000 ₽', '2 006 ₽', '1 994 ₽'], answer: 1, explanation: '2 000 ₽ за акции + 6 ₽ платы за покупку = 2 006 ₽. При продаже плата в нашей тренировке будет ещё раз.' },
    { id: 'diversification', title: 'Не ставьте всё на одну компанию', text: 'Если все деньги вложены в одну компанию, проблемы этой компании сильно ударят по вашему результату. Разные компании и отрасли помогают уменьшить зависимость от одной истории.', example: 'Но пять нефтяных компаний — не пять совершенно разных рисков: падение цен на нефть может затронуть их вместе. И даже разные отрасли не защищают от любого падения.', question: 'Зачем распределять деньги между разными компаниями?', options: ['Чтобы точно никогда не потерять деньги', 'Любые две акции полностью защищают от убытка', 'Чтобы меньше зависеть от одной компании, но риск всё равно останется'], answer: 2, explanation: 'Распределение денег помогает уменьшить некоторые риски. Гарантии прибыли всё равно нет.' },
    { id: 'horizon', title: 'Сначала план, потом покупка', text: 'Перед решением ответьте: зачем покупаю, на какой срок и что буду делать, если цена упадёт? Запишите ответы в дневник — так проще не действовать только на эмоциях.', example: 'Пока акция не продана, рост на экране — только оценка. Деньги от продажи появятся после сделки. А прибыль считают с учётом того, сколько стоила покупка и сколько ушло на комиссии.', question: 'Что важнее для обучения?', options: ['Совершать как можно больше сделок', 'Понимать свои решения, расходы и риск потерь', 'Обогнать всех по прибыли за неделю'], answer: 1, explanation: 'Хорошая цель — научиться объяснять свои решения и понимать риск, а не угадывать самую быстрорастущую акцию.' }
  ];
  function fresh() { return { version: 2, cashKopecks: INITIAL_CASH, completed: [], journal: [], practice: market.newPractice() }; }
  function valid(s) {
    try { market.summary(s?.practice); } catch (_) { return false; }
    return !!s && s.version === 2 && s.cashKopecks === INITIAL_CASH &&
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
      if (raw === null) return { data: { ...fresh(), practice: {generation:'new-local-account-v2',trades:[]} }, error: '' };
      let data = JSON.parse(raw);
      if (data?.version === 1 && data.cashKopecks === INITIAL_CASH) data = { ...data, version: 2, practice: {generation:'migrated-v1',trades:[]} };
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
  let selectedStock = null, search = '', marketFilter = 'Все', tradeDraft = null, review = null;
  let draft = { company: '', thesis: '', horizon: '', risk: '' };
  let resetRequested = false;
  const store = {
    getItem: key => root.localStorage.getItem(key),
    setItem: (key, value) => root.localStorage.setItem(key, value)
  };
  function entryHTML() {
    return `<button type="button" class="inv-entry card-surface" data-invest-open><span class="inv-entry-icon" aria-hidden="true">↗</span><span><span class="inv-eyebrow">Бесплатно · Учебный режим</span><strong>Учиться инвестировать</strong><small>Настоящие акции, простые уроки и тренировка</small></span><span aria-hidden="true">→</span></button>`;
  }
  function showMessage(text, error = false) {
    const el = dialog.querySelector('#inv-message');
    el.textContent = text; el.dataset.error = String(error);
  }
  const withLock = fn => root.navigator?.locks?.request ? root.navigator.locks.request(KEY, fn) : Promise.resolve().then(fn);
  async function commit(change) {
    return withLock(() => {
    const latest = read(store);
    if (latest.error) { showMessage(latest.error, true); return false; }
    try { change(latest.data); write(store, latest.data); status = latest; return true; }
    catch (_) { showMessage('Не удалось сохранить. Возможно, хранилище заполнено или недоступно. Запись не подтверждена; введённый текст сохранён в форме.', true); return false; }
    });
  }
  const money = (minor, currency = 'RUB') => (minor / 100).toLocaleString('ru-RU', { style: 'currency', currency, maximumFractionDigits: 2, minimumFractionDigits: 0 });
  function accountHTML() {
    const data = market.summary(status.data.practice);
    const positions = Object.entries(data.positions).filter(([, p]) => p.quantity > 0);
    return `<div class="inv-wallet card-surface"><span class="inv-eyebrow">Виртуальные деньги · RUB</span><div class="inv-cash money-val">${money(data.cash.RUB)}</div><p>Только для упражнений. Не входят в личный бюджет, не выводятся и не пополняются настоящими деньгами.</p><div class="inv-currency-wallets"><span>Для акций США <b>${money(data.cash.USD,'USD')}</b></span><span>Для акций Европы <b>${money(data.cash.EUR,'EUR')}</b></span></div><div class="inv-wallet-stats"><span>Компании <b>${positions.length}</b></span><span>Тренировки <b>${data.trades.length}</b></span><span>Котировки <b>Нет</b></span></div></div>
      <section class="inv-notice"><span class="inv-eyebrow">Котировки не подключены</span><h3>Компании настоящие. Цену для упражнения задаёте вы.</h3><p>Это тренировка расчётов, а не торговля по текущей цене биржи. Автоматических котировок нет.</p><button type="button" class="inv-primary" data-inv-tab="stocks">Посмотреть акции →</button><small class="inv-block">Покупка по рыночной цене пока недоступна:</small><div class="inv-actions"><button type="button" disabled>Купить</button><button type="button" disabled>Продать</button></div></section>
      <section class="inv-section"><h3>Портфель — ваши учебные акции</h3><p>Здесь — количество акций и затраты на них. Сколько они стоят на бирже сейчас, мы не знаем.</p>${positions.length ? positions.map(([id,p]) => {const s=market.stock(id);return `<button type="button" class="inv-position card-surface" data-stock="${s.id}"><strong>${s.name} · ${s.symbol}</strong><span>${p.quantity} шт. · потрачено ${money(p.cost,s.currency)}</span><small>Средняя с платой за покупку: ${money(Math.round(p.cost/p.quantity),s.currency)}</small></button>`;}).join('') : '<div class="inv-empty">Пока ни одной акции. Откройте каталог и попробуйте учебную покупку.</div>'}</section>
      <section class="inv-section"><h3>Результат учебных продаж</h3><p>Прибыль или убыток только по ценам, которые вы вводили сами, с учётом условной комиссии. Это не результат на реальном рынке.</p><div class="inv-result-list">${Object.keys(data.realized).map(c=>`<span>${c} <b class="${data.realized[c]<0?'cal-expense':'cal-income'}">${money(data.realized[c],c)}</b></span>`).join('')}</div></section>
      <section class="inv-section"><h3>История упражнений</h3><p>Время записи — не время котировки. ${data.trades.length>20?'Показаны последние 20 записей.':''}</p>${data.trades.length?data.trades.slice(-20).reverse().map(t=>{const s=market.stock(t.instrumentId);return `<article class="inv-note card-surface"><strong>${t.side==='buy'?'Учебная покупка':'Учебная продажа'} · ${s.symbol}</strong><small class="inv-block">${esc(new Date(t.createdAt).toLocaleString('ru-RU'))} · Цена введена вручную</small><p>${t.quantity} шт. × ${money(t.priceMinor,s.currency)}<br>Условная комиссия: ${money(t.fee,s.currency)}</p></article>`;}).join(''):'<div class="inv-empty">Учебных сделок пока нет.</div>'}</section>`;
  }
  function stockListHTML() {
    const query=search.trim().toLocaleLowerCase('ru-RU');
    const list=market.stocks.filter(s=>(marketFilter==='Все'||s.market===marketFilter)&&`${s.name} ${s.symbol} ${s.exchange}`.toLocaleLowerCase('ru-RU').includes(query));
    return `<p class="inv-search-count" role="status">Найдено: ${list.length}</p>${list.length?list.map(s=>`<button type="button" class="inv-stock card-surface" data-stock="${s.id}"><span class="inv-stock-avatar" aria-hidden="true">${s.symbol.slice(0,2)}</span><span><strong>${s.name}</strong><small>${s.symbol} · ${s.exchange} · ${s.currency}</small><small>Цена с биржи не подключена</small></span><span aria-hidden="true">→</span></button>`).join(''):'<div class="inv-empty">Такой компании в подборке пока нет. Попробуйте другое название или тикер.</div>'}`;
  }
  function stocksHTML() {
    if (selectedStock) return stockDetailHTML();
    return `<section class="inv-section"><h3>Акции без сложных слов</h3><p>Акция — маленькая часть компании. Ниже начальная подборка из ${market.stocks.length} акций, не весь рынок и не совет что-либо купить. Тикер — короткий код акции, например AAPL.</p><label class="inv-field">Найти компанию или тикер<input id="inv-stock-search" maxlength="80" value="${esc(search)}" placeholder="Например, Apple или SBER" autocomplete="off"></label><label class="inv-field">Рынок<select id="inv-market-filter">${['Все','США','Россия','Европа'].map(m=>`<option ${marketFilter===m?'selected':''}>${m}</option>`).join('')}</select></label></section><div id="inv-stock-list">${stockListHTML()}</div>`;
  }
  function stockDetailHTML() {
    const s=market.stock(selectedStock);
    const data=market.summary(status.data.practice);
    const p=data.positions[s.id]||{quantity:0,cost:0};
    const d=tradeDraft||{side:'buy',quantity:'1',price:''};
    const {side}=d;
    return `<button type="button" class="inv-link" data-stock-back>← Все акции</button><section class="inv-section inv-asset"><span class="inv-eyebrow">${s.symbol} · ${s.exchange} · ${s.currency}</span><h3>${s.name}</h3><p>Выбранная акция настоящей компании. Её текущая биржевая цена здесь не показана.</p><a href="${s.source}" target="_blank" rel="noopener noreferrer">Справка об акции на официальном сайте ↗</a><p class="inv-asset-wallet">Виртуально доступно: <b>${money(data.cash[s.currency],s.currency)}</b><br>В портфеле: <b>${p.quantity} шт.</b></p></section>
      <section class="inv-section card-surface"><span class="inv-eyebrow">Упражнение · Не рыночная котировка</span><h3>Попробуйте посчитать сделку</h3><p>Придумайте цену или введите свою. Мы не проверяем её по бирже. Упражнение доступно в любое время; результат зависит от ваших чисел.</p>${review?reviewHTML(s):`<div class="inv-trade-side" role="group" aria-label="Действие в упражнении"><button type="button" data-trade-side="buy" aria-pressed="${side==='buy'}">Учебная покупка</button><button type="button" data-trade-side="sell" aria-pressed="${side==='sell'}">Учебная продажа</button></div><form id="inv-trade-form"><label class="inv-field">Количество акций, шт.<input name="quantity" inputmode="numeric" pattern="[0-9]+" maxlength="7" value="${esc(d.quantity)}" required></label><label class="inv-field">Ваша цена за одну акцию, ${s.currency}<input name="price" inputmode="decimal" maxlength="12" value="${esc(d.price)}" placeholder="Введите свою цену" required></label><small>Условная плата за каждую покупку и продажу — 0,3%, с округлением до копейки/цента. В упражнении можно покупать по одной акции; реальные размеры лотов не учитываются.</small><button type="submit" class="inv-primary">Посчитать перед подтверждением</button></form>`}</section>`;
  }
  function reviewHTML(s) {
    const {gross,fee}=market.costs(review.priceMinor,review.quantity);
    return `<div class="inv-review"><h4>${review.side==='buy'?'Учебная покупка':'Учебная продажа'} · ${s.symbol}</h4><dl><div><dt>Количество</dt><dd>${review.quantity} шт.</dd></div><div><dt>Ваша условная цена</dt><dd>${money(review.priceMinor,s.currency)}</dd></div><div><dt>Стоимость акций</dt><dd>${money(gross,s.currency)}</dd></div><div><dt>Условная комиссия 0,3%</dt><dd>${money(fee,s.currency)}</dd></div><div><dt>${review.side==='buy'?'Спишется виртуально':'Поступит виртуально'}</dt><dd>${money(review.side==='buy'?gross+fee:gross-fee,s.currency)}</dd></div></dl><form id="inv-trade-confirm"><label class="inv-answer"><input type="checkbox" name="manual-ack" required><span>Понимаю: цену ввожу я, это не котировка биржи. Деньги и сделка только учебные.</span></label><button type="submit" class="inv-primary">Подтвердить упражнение</button><button type="button" class="inv-link" data-trade-edit>Изменить числа</button></form></div>`;
  }
  function lessonsHTML() {
    if (currentLesson) {
      const l = lessons.find(l => l.id === currentLesson);
      return `<section class="inv-section card-surface"><button type="button" class="inv-link" data-lesson-back>← Все уроки</button><span class="inv-eyebrow">Урок ${lessons.indexOf(l)+1} из 5</span><h3>${l.title}</h3><p>${l.text}</p><div class="inv-example"><strong>На простом примере</strong><p>${l.example}</p></div><form id="inv-quiz"><fieldset><legend>${l.question}</legend>${l.options.map((o,i)=>`<label class="inv-answer"><input type="radio" name="answer" value="${i}" required> <span>${o}</span></label>`).join('')}</fieldset><button class="inv-primary" type="submit">Проверить ответ</button></form><p id="inv-feedback" role="status"></p></section>`;
    }
    return `<section class="inv-section"><h3>Знания, а не гонка за доходом</h3><p>Пройдено: ${status.data.completed.length} из 5. Отвечайте на вопросы в своём темпе. Здесь не нужно торговать ради баллов.</p><progress aria-label="Пройденные уроки" max="5" value="${status.data.completed.length}"></progress></section><div class="inv-lesson-list">${lessons.map((l,i)=>`<button type="button" class="inv-lesson card-surface" data-lesson="${l.id}"><span class="inv-lesson-number">${i+1}</span><span><strong>${l.title}</strong><small>${status.data.completed.includes(l.id)?'Пройдено · Повторить':'Короткое объяснение и вопрос'}</small></span><span aria-hidden="true">${status.data.completed.includes(l.id)?'✓':'→'}</span></button>`).join('')}</div>`;
  }
  function journalHTML() {
    return `<section class="inv-section"><h3>Сначала запишите своё решение</h3><p>Это заметка, не заявка на покупку. Не записывайте пароли и ключи API. До ${100-status.data.journal.length} новых записей.</p><form id="inv-journal-form"><label>Компания или тикер · необязательно<input name="company" maxlength="80" value="${esc(draft.company)}" placeholder="Название для вашей заметки"></label><label>Почему рассматриваю эту инвестицию?<textarea name="thesis" required maxlength="1200" rows="3">${esc(draft.thesis)}</textarea></label><label>На какой срок?<input name="horizon" maxlength="120" value="${esc(draft.horizon)}" placeholder="Например, несколько лет"></label><label>Какие риски вижу и что изменит моё мнение?<textarea name="risk" maxlength="600" rows="3">${esc(draft.risk)}</textarea></label><button type="submit" class="inv-primary">Сохранить запись</button></form></section><section class="inv-section"><h3>Мои записи · ${status.data.journal.length}</h3>${status.data.journal.length ? status.data.journal.map(n=>`<article class="inv-note card-surface"><small>${esc(new Date(n.createdAt).toLocaleDateString('ru-RU'))}</small><h4>${esc(n.company || 'Размышление об инвестициях')}</h4><p>${esc(n.thesis)}</p>${n.horizon?`<p><b>Срок:</b> ${esc(n.horizon)}</p>`:''}${n.risk?`<p><b>Риски и пересмотр:</b> ${esc(n.risk)}</p>`:''}</article>`).join('') : '<div class="inv-empty">Записей пока нет. Начните с вопроса: зачем мне инвестировать?</div>'}</section>`;
  }
  function rulesHTML() {
    return `<section class="inv-section card-surface"><h3>Бесплатно — без подписок</h3><p>В этом разделе нет оплаты, брокерских подключений, внешних запросов котировок или скрытого перехода на платный тариф.</p><h3>Отдельно от вашего бюджета</h3><p>Учебный остаток не входит в баланс Fintex, дневной лимит, расходы и накопления. Реальные покупки и продажи здесь невозможны.</p><h3>Сохраняется только на этом устройстве</h3><p>Уроки, дневник и учебные сделки хранятся только в этом браузере. Облачной синхронизации нет. Очистка данных браузера или смена устройства может привести к потере записей. Не используйте дневник как единственную копию важных данных.</p><h3>Как устроена тренировка с акциями</h3><p>Названия компаний настоящие, а цену задаёте вы. Автоматической биржевой цены нет. Условная комиссия — 0,3% при покупке и продаже. Покупаем по одной акции, без реальных лотов, проверки часов биржи, дивидендов, налогов, сплитов и очереди заявок. Это упражнение с числами, а не точная копия торговли.</p><p>У каждого рынка свой виртуальный кошелёк: 100 000 RUB, 10 000 USD и 10 000 EUR. Мы не складываем разные валюты и не придумываем курс обмена. Прибыль от продажи — по введённым вами ценам, с учётом покупок и комиссии. Стоимость оставшихся акций на реальном рынке неизвестна.</p><h3>Не индивидуальная рекомендация</h3><p>Материалы помогают понять базовые понятия, но не выбирают акции за вас и не обещают доходность.</p></section><section class="inv-section"><h3>Сброс обучения</h3><p>Удалит прогресс уроков, записи дневника и все упражнения с акциями. Виртуальные остатки вернутся к 100 000 ₽, 10 000 USD и 10 000 EUR. Личные финансы Fintex не изменятся.</p>${resetRequested ? '<div class="inv-reset-confirm" role="group" aria-label="Подтверждение сброса"><p>Все учебные записи будут удалены без возможности отмены.</p><button type="button" class="inv-danger" data-reset-confirm>Удалить учебные данные</button><button type="button" data-reset-cancel>Отмена</button></div>' : '<button type="button" class="inv-danger" data-reset-request>Сбросить только обучение</button>'}</section>`;
  }
  function render() {
    status = read(store);
    const content = dialog.querySelector('#inv-content');
    content.innerHTML = tab === 'account' ? accountHTML() : tab === 'stocks' ? stocksHTML() : tab === 'lessons' ? lessonsHTML() : tab === 'journal' ? journalHTML() : rulesHTML();
    dialog.querySelectorAll('[data-inv-nav]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.invNav===tab)));
    showMessage(status.error, !!status.error);
  }
  function setTab(next) {
    if (!['account','stocks','lessons','journal','rules'].includes(next)) return;
    tab=next; currentLesson=null; selectedStock=null; tradeDraft=null; review=null; resetRequested=false; render(); dialog.querySelector('#inv-content').scrollTop=0;
  }
  function mount() {
    if (dialog) return;
    dialog=document.createElement('dialog'); dialog.id='invest-learning'; dialog.className='inv-dialog';
    dialog.setAttribute('aria-labelledby','inv-title');
    dialog.innerHTML=`<header class="inv-header"><div><span class="inv-eyebrow">Демо · Только виртуальные деньги</span><h2 id="inv-title">Учиться инвестировать</h2></div><button type="button" class="inv-close" data-invest-close aria-label="Закрыть учебные инвестиции">×</button></header><nav class="inv-nav" aria-label="Учебные инвестиции">${[['account','Счёт'],['stocks','Акции'],['lessons','Уроки'],['journal','Дневник'],['rules','Правила']].map(([id,label])=>`<button type="button" data-inv-nav="${id}" aria-pressed="false">${label}</button>`).join('')}</nav><div id="inv-message" role="status" aria-live="polite"></div><div id="inv-content" class="inv-content"></div>`;
    document.body.appendChild(dialog);
    dialog.addEventListener('close',()=>{document.body.style.overflow=overflow;});
    dialog.addEventListener('click',async event=>{
      const b=event.target.closest('button'); if(!b) return;
      if(b.hasAttribute('data-invest-close')) dialog.close();
      if(b.dataset.invNav) setTab(b.dataset.invNav);
      if(b.dataset.invTab) setTab(b.dataset.invTab);
      if(b.dataset.stock) {
        if(!market.stock(b.dataset.stock))return;
        tab='stocks';selectedStock=b.dataset.stock;review=null;tradeDraft={side:'buy',quantity:'1',price:''};
        render();dialog.querySelector('[data-stock-back]').focus();dialog.querySelector('#inv-content').scrollTop=0;
      }
      if(b.hasAttribute('data-stock-back')) {selectedStock=null;review=null;tradeDraft=null;render();dialog.querySelector('#inv-stock-search').focus();}
      if(b.dataset.tradeSide) {tradeDraft.side=b.dataset.tradeSide;review=null;render();}
      if(b.hasAttribute('data-trade-edit')) {review=null;render();dialog.querySelector('[name="price"]').focus();}
      if(b.dataset.lesson) {currentLesson=b.dataset.lesson;render();dialog.querySelector('[data-lesson-back]').focus();}
      if(b.hasAttribute('data-lesson-back')) {currentLesson=null;render();}
      if(b.hasAttribute('data-reset-request')) {resetRequested=true;render();dialog.querySelector('[data-reset-cancel]').focus();}
      if(b.hasAttribute('data-reset-cancel')) {resetRequested=false;render();dialog.querySelector('[data-reset-request]').focus();}
      if(b.hasAttribute('data-reset-confirm')) {
        try {await withLock(()=>write(store,fresh()));selectedStock=null;tradeDraft=null;review=null;draft={company:'',thesis:'',horizon:'',risk:''};resetRequested=false;render();showMessage('Учебные данные сброшены. Личный бюджет не изменён.');}
        catch(_){showMessage('Не удалось сбросить данные. Проверьте доступ к хранилищу.',true);}
      }
    });
    dialog.addEventListener('input',event=>{
      if(event.target.id==='inv-stock-search') {search=event.target.value;dialog.querySelector('#inv-stock-list').innerHTML=stockListHTML();}
      if(event.target.id==='inv-market-filter') {marketFilter=event.target.value;dialog.querySelector('#inv-stock-list').innerHTML=stockListHTML();}
      if(event.target.form?.id==='inv-trade-form' && ['quantity','price'].includes(event.target.name)) tradeDraft[event.target.name]=event.target.value;
      if(event.target.form?.id==='inv-journal-form') draft[event.target.name]=event.target.value;
    });
    dialog.addEventListener('submit',async event=>{
      event.preventDefault();
      if(event.target.id==='inv-trade-form') {
        try {
          const latest=read(store);if(latest.error)throw new Error(latest.error);
          const values=new FormData(event.target);
          const next={id:root.crypto.randomUUID(),instrumentId:selectedStock,side:tradeDraft.side,quantity:market.quantity(values.get('quantity')),priceMinor:market.minor(values.get('price')),generation:latest.data.practice.generation,revision:latest.data.practice.trades.length,acknowledged:true};
          market.execute(latest.data.practice,next); // Validate without saving.
          review=next;render();dialog.querySelector('[name="manual-ack"]').focus();
        } catch(error) {showMessage(error.message,true);}
      }
      if(event.target.id==='inv-trade-confirm') {
        const order=review;if(!order)return;
        if(!root.navigator?.locks?.request){showMessage('В этом браузере нет защиты от одновременной записи из двух вкладок. Для упражнений откройте Fintex в современном браузере.',true);return;}
        if(!new FormData(event.target).has('manual-ack')){showMessage('Подтвердите, что цена условная.',true);return;}
        const button=event.target.querySelector('button[type="submit"]');button.disabled=true;
        try {
          await withLock(()=>{
            const latest=read(store);if(latest.error)throw new Error(latest.error);
            latest.data.practice=market.execute(latest.data.practice,order);write(store,latest.data);
          });
          review=null;tradeDraft={side:order.side,quantity:'1',price:''};render();showMessage('Упражнение сохранено. Цена введена вами, это не сделка на бирже.');
        } catch(error) {button.disabled=false;showMessage('Упражнение не сохранено. '+error.message,true);}
      }
      if(event.target.id==='inv-quiz') {
        const l=lessons.find(l=>l.id===currentLesson);
        const answer=new FormData(event.target).get('answer');
        const feedback=dialog.querySelector('#inv-feedback');
        if(answer===null) {feedback.textContent='Выберите ответ.';return;}
        if(Number(answer)!==l.answer){feedback.textContent='Попробуйте ещё раз. '+l.explanation;return;}
        if(await commit(s=>{if(!s.completed.includes(l.id))s.completed.push(l.id);})){feedback.textContent='Верно. '+l.explanation;}
      }
      if(event.target.id==='inv-journal-form') {
        const values=Object.fromEntries(new FormData(event.target));
        if(!values.thesis?.trim()){showMessage('Запишите причину решения — не только пробелы.',true);return;}
        if(read(store).data.journal.length>=100){showMessage('Достигнут предел: 100 записей. Перед сбросом сохраните важные записи отдельно.',true);return;}
        if(await commit(s=>{
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
    if(dialog?.open && (event.key===KEY || event.key===null)) {
      render();
      if(status.error)return;
      if(review && review.generation!==status.data.practice.generation)showMessage('Учебный счёт был сброшен в другой вкладке. Откройте форму заново.',true);
      else if(review && review.revision!==status.data.practice.trades.length)showMessage('Учебный портфель изменился в другой вкладке. Проверьте расчёт заново.',true);
      else showMessage('Учебные данные обновлены в другой вкладке.');
    }
  });
  root.FintexInvestments={open,entryHTML};
})(typeof window !== 'undefined' ? window : globalThis);
