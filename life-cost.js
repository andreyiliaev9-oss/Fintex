/* Price in working time. Explicit net income only, no transaction inference,
 * network calls or changes to the user's budget. */
(function (root) {
  'use strict';
  const KEY = 'fp_work_time_v1';
  function decimal(value) {
    const text = String(value ?? '').trim().replace(/[ \u00a0\u202f]/g, '').replace(',', '.');
    if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }
  function profile(income, hours) {
    const monthlyIncome = decimal(income), monthlyHours = decimal(hours);
    if (monthlyIncome === null || monthlyIncome <= 0 || monthlyIncome > 1e9) return {error:'Укажите доход на руки за месяц: больше 0 и не больше 1 млрд ₽.'};
    if (monthlyHours === null || monthlyHours <= 0 || monthlyHours > 744) return {error:'Укажите рабочие часы за тот же месяц: больше 0 и не больше 744.'};
    return {data:{version:1, monthlyIncome, monthlyHours}};
  }
  function calculate(price, income, hours) {
    const checked = profile(income, hours);
    if (checked.error) return checked;
    const amount = decimal(price);
    if (amount === null || amount < 0 || amount > 1e9) return {error:'Введите цену от 0 до 1 млрд ₽, не больше двух знаков после запятой.'};
    const minutes = amount / checked.data.monthlyIncome * checked.data.monthlyHours * 60;
    if (!Number.isSafeInteger(Math.round(minutes))) return {error:'Для этих значений время слишком велико. Проверьте доход и цену.'};
    return {minutes, hourlyRate: checked.data.monthlyIncome / checked.data.monthlyHours};
  }
  function formatTime(minutes) {
    if (!Number.isFinite(minutes) || minutes < 0) return '—';
    if (minutes > 0 && minutes < 1) return 'Меньше 1 мин';
    const rounded = Math.round(minutes), hours = Math.floor(rounded / 60), remainder = rounded % 60;
    return hours ? `${hours.toLocaleString('ru-RU')} ч${remainder ? ` ${remainder} мин` : ''}` : `${rounded} мин`;
  }
  function read(storage) {
    try {
      const raw = storage.getItem(KEY);
      if (raw === null) return {data:null};
      const parsed = JSON.parse(raw);
      if (parsed?.version !== 1 || typeof parsed.monthlyIncome !== 'number' || typeof parsed.monthlyHours !== 'number') throw new Error('schema');
      const result = profile(parsed.monthlyIncome, parsed.monthlyHours);
      if (result.error) throw new Error('schema');
      return result;
    } catch (_) { return {data:null,error:'Не удалось прочитать параметры. Исходная запись сохранена. Введите данные заново и сохраните, чтобы заменить её.'}; }
  }
  function write(storage, income, hours) {
    const checked = profile(income, hours);
    if (checked.error) return checked;
    try { storage.setItem(KEY, JSON.stringify(checked.data)); return checked; }
    catch (_) { return {error:'Не удалось сохранить параметры. Расчёт доступен, но после закрытия введённые данные могут потеряться.'}; }
  }
  const core = {KEY, decimal, profile, calculate, formatTime, read, write};
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  if (!root.document) return;
  const doc = root.document;
  const storage = {getItem:key => root.localStorage.getItem(key), setItem:(key,value) => root.localStorage.setItem(key,value)};
  let dialog, overflow;
  const get = id => doc.getElementById(id);
  function refreshPurchase() {
    const saved = read(storage), output = get('cb-work-time'), hint = get('cb-work-hint');
    if (!output) return;
    const amount = get('cb-amount').value;
    if (!saved.data) {
      output.textContent = 'Сколько это часов работы?';
      hint.textContent = saved.error ? 'Проверьте параметры дохода и рабочего времени.' : 'Укажите доход и рабочие часы — без доступа к счетам.';
      return;
    }
    if (amount === '') {
      output.textContent = 'Цена в часах жизни'; hint.textContent = 'Введите стоимость покупки выше.'; return;
    }
    const result = calculate(amount, saved.data.monthlyIncome, saved.data.monthlyHours);
    output.textContent = result.error ? 'Проверьте стоимость' : `≈ ${formatTime(result.minutes)} работы`;
    hint.textContent = result.error || 'По сохранённому доходу на руки и рабочим часам за месяц.';
  }
  function update() {
    const result = calculate(get('work-price').value, get('work-income').value, get('work-hours').value);
    get('work-result').textContent = result.error ? '—' : formatTime(result.minutes);
    const rate = result.hourlyRate;
    get('work-explanation').textContent = result.error || `≈ ${rate < .01 ? 'меньше 0,01' : rate.toLocaleString('ru-RU',{maximumFractionDigits:2})} ₽ за час. Округлено до минуты; это рабочее время, не срок накопления.`;
  }
  function mount() {
    if (dialog) return;
    dialog = get('life-cost-dialog');
    dialog.querySelector('[data-work-close]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { doc.body.style.overflow = overflow; });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll('button, input, summary')].filter(el => !el.disabled && el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && doc.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && doc.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    dialog.addEventListener('input', event => {
      if (event.target.id !== 'work-price') get('work-status').textContent = 'Изменения дохода и часов пока не сохранены.';
      update();
    });
    get('work-save').addEventListener('click', () => {
      const result = write(storage, get('work-income').value, get('work-hours').value);
      get('work-status').textContent = result.error || 'Доход и рабочие часы сохранены на этом устройстве. Цена покупки не сохраняется.';
      refreshPurchase(); update();
    });
  }
  function open(price = '', focusProfile = false) {
    mount();
    const saved = read(storage);
    get('work-price').value = price;
    get('work-income').value = saved.data?.monthlyIncome ?? '';
    get('work-hours').value = saved.data?.monthlyHours ?? '';
    get('work-status').textContent = saved.error || '';
    update();
    if (!dialog.open) { overflow = doc.body.style.overflow; doc.body.style.overflow = 'hidden'; dialog.showModal(); }
    get(focusProfile || !saved.data ? 'work-income' : 'work-price').focus();
    dialog.scrollTop = 0;
  }
  doc.addEventListener('click', event => {
    const button = event.target.closest('[data-work-open]');
    if (button) open(button.dataset.workOpen === 'purchase' ? get('cb-amount').value : '', button.dataset.workOpen === 'settings');
  });
  root.addEventListener('storage', event => { if (event.key === KEY || event.key === null) refreshPurchase(); });
  root.FintexWorkTime = {open, refreshPurchase};
})(typeof window === 'undefined' ? globalThis : window);
