/* ============================================================================
 * FINTEX — Модуль автономного сканирования чеков (OCR + QR + PDF) и трекера цен
 * Файл: scanner.js
 * ============================================================================ */

// ==================== INDEXED DB ДЛЯ ОРИГИНАЛОВ ЧЕКОВ ====================
function openOriginalsDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('fintex_originals_db', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('files', { keyPath: 'scan_id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveOriginalBlob(scanId, dataUrl, fileName, mimeType) {
  try {
    const db = await openOriginalsDB();
    const tx = db.transaction('files', 'readwrite');
    tx.objectStore('files').put({ scan_id: scanId, dataUrl, fileName, mimeType });
  } catch (e) {}
}

async function loadOriginalBlob(scanId) {
  try {
    const db = await openOriginalsDB();
    return await new Promise((resolve) => {
      const tx = db.transaction('files', 'readonly');
      const req = tx.objectStore('files').get(scanId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
}

// ==================== МОДУЛЬ FINTEX SCAN (ЛОКАЛЬНЫЙ OCR + QR + PDF) ====================
function openScanModal() {
  vibro('light');
  document.getElementById('scan-progress-box').classList.add('hidden');
  document.getElementById('scan-error-box').classList.add('hidden');
  document.getElementById('scan-result-stage').classList.add('hidden');
  document.getElementById('modal-scan').classList.remove('hidden');
  lucide.createIcons();
}

function preprocessReceiptCanvas(imageSrc) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const targetW = Math.min(1600, Math.max(1000, img.width));
      const scale = targetW / img.width;
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);
      const d = imgData.data;

      let minL = 255, maxL = 0;
      for (let i = 0; i < d.length; i += 4) {
        const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        if (lum < minL) minL = lum;
        if (lum > maxL) maxL = lum;
      }
      const range = Math.max(1, maxL - minL);

      for (let i = 0; i < d.length; i += 4) {
        let lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        lum = ((lum - minL) / range) * 255;
        lum = lum < 135 ? Math.max(0, lum * 0.78) : Math.min(255, lum * 1.12);
        d[i] = d[i + 1] = d[i + 2] = lum;
      }
      ctx.putImageData(imgData, 0, 0);

      let qrRaw = '';
      if (window.jsQR) {
        const qrCode = jsQR(imgData.data, w, h);
        if (qrCode && qrCode.data) qrRaw = qrCode.data;
      }

      const sliceH = 1400;
      const overlap = 180;
      const slices = [];
      if (h <= sliceH) {
        slices.push(canvas.toDataURL('image/png'));
      } else {
        let y = 0;
        while (y < h) {
          const curH = Math.min(sliceH, h - y);
          const sc = document.createElement('canvas');
          sc.width = w;
          sc.height = curH;
          sc.getContext('2d').drawImage(canvas, 0, y, w, curH, 0, 0, w, curH);
          slices.push(sc.toDataURL('image/png'));
          if (y + curH >= h) break;
          y += (sliceH - overlap);
        }
      }
      resolve({ enhancedUrl: canvas.toDataURL('image/png'), slices, qrRaw });
    };
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = imageSrc;
  });
}

async function renderPdfToDataUrl(arrayBuffer) {
  if (!window.pdfjsLib) throw new Error('Модуль PDF.js не загружен');
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2.2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas.toDataURL('image/png');
}

function parseFiscalQrString(raw) {
  if (!raw || !raw.toLowerCase().includes('fn=')) {
    return { found: false, raw: '', sum: null, date: '', time: '', fn: '', fd: '', fp: '', operation_type: '' };
  }
  const params = {};
  raw.split('&').forEach(part => {
    const idx = part.indexOf('=');
    if (idx > 0) params[part.slice(0, idx).toLowerCase()] = part.slice(idx + 1);
  });
  const t = params.t || '';
  const date = t.length >= 8 ? `${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}` : '';
  const time = t.length >= 13 ? `${t.slice(9, 11)}:${t.slice(11, 13)}` : '';
  const sum = params.s ? Math.round(parseFloat(params.s.replace(',', '.')) * 100) / 100 : null;
  const opTypes = { '1': 'Приход', '2': 'Возврат прихода', '3': 'Расход', '4': 'Возврат расхода' };
  return {
    found: true, raw, sum, date, time,
    fn: params.fn || '', fd: params.i || '', fp: params.fp || '',
    operation_type: opTypes[params.n || '1'] || 'Приход'
  };
}

function parseRussianReceiptText(rawText, qrData, avgConf) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const fullText = lines.join('\n');

  let merchant = 'Кассовый чек';
  for (const l of lines.slice(0, 8)) {
    if (/(ООО|АО|ПАО|ЗАО|ИП|НЕФТЬ|ПЯТЁРОЧКА|МАГНИТ|ВКУСВИЛЛ|ЛЕНТА|АЗС)/i.test(l) && !/КАССОВЫЙ ЧЕК/i.test(l)) {
      merchant = l.replace(/["«»]/g, '').trim();
      break;
    }
  }
  const innM = fullText.match(/ИНН[:\s]*(\d{10,12})/i);
  const inn = innM ? innM[1] : '';

  let date = qrData.date || '';
  let time = qrData.time || '';
  if (!date) {
    const dm = fullText.match(/(\d{2})[./](\d{2})[./](20\d{2})/);
    if (dm) date = `${dm[3]}-${dm[2]}-${dm[1]}`;
  }
  if (!time) {
    const tm = fullText.match(/\b([01]\d|2[0-3]):([0-5]\d)\b/);
    if (tm) time = `${tm[1]}:${tm[2]}`;
  }

  let ocrTotal = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/(ИТОГ|ВСЕГО|К ОПЛАТЕ|СУММА)/i.test(lines[i]) && !/НДС/i.test(lines[i])) {
      const nums = lines[i].match(/(\d[\d\s]*[.,]\d{2})/g);
      if (nums) {
        ocrTotal = parseFloat(nums[nums.length - 1].replace(/\s+/g, '').replace(',', '.'));
        break;
      }
    }
  }

  const vatM = fullText.match(/НДС[^\d]*(\d[\d\s]*[.,]\d{2})/i);
  const vat = vatM ? parseFloat(vatM[1].replace(/\s+/g, '').replace(',', '.')) : null;

  const items = [];
  const stopRe = /^(ИТОГ|ВСЕГО|К ОПЛАТЕ|БЕЗНАЛИЧНЫМИ|НАЛИЧНЫМИ|НДС|СПАСИБО|ФН|ФД|ФП|СМЕНА|ЧЕК)/i;
  const headRe = /^(КАССОВЫЙ ЧЕК|ПРИХОД|ИНН|Г\.|ШОССЕ|УЛ\.)/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (headRe.test(line) || stopRe.test(line)) continue;

    if (i + 1 < lines.length) {
      const next = lines[i + 1];
      const qpM = next.match(/(\d+(?:[.,]\d+)?)\s*(?:шт|кг|л|г|мл)?\s*[xх*×]\s*(\d+(?:[.,]\d{2}))(?:[^\d]+(\d+(?:[.,]\d{2})))?/i);
      if (qpM && !/\d+[.,]\d{2}$/.test(line)) {
        const qty = parseFloat(qpM[1].replace(',', '.'));
        const unitPrice = parseFloat(qpM[2].replace(',', '.'));
        const totalPrice = qpM[3] ? parseFloat(qpM[3].replace(',', '.')) : Math.round(qty * unitPrice * 100) / 100;
        const name = line.replace(/^\d+[.)]\s*/, '').trim();
        items.push({
          name: name || 'Позиция', quantity: qty, unit_price: unitPrice,
          total_price: totalPrice, category: classifyCategory(name), confidence: avgConf
        });
        i++;
        continue;
      }
    }

    const singleM = line.match(/^(.{3,}?)\s+(\d[\d\s]*[.,]\d{2})$/);
    if (singleM) {
      const name = singleM[1].replace(/^\d+[.)]\s*/, '').trim();
      const price = parseFloat(singleM[2].replace(/\s+/g, '').replace(',', '.'));
      if (price > 0 && price < 500000 && !stopRe.test(name)) {
        items.push({
          name, quantity: 1, unit_price: price,
          total_price: price, category: classifyCategory(name), confidence: avgConf
        });
      }
    }
  }

  const itemsSum = Math.round(items.reduce((s, it) => s + it.total_price, 0) * 100) / 100;
  const finalTotal = qrData.sum !== null ? qrData.sum : (ocrTotal !== null ? ocrTotal : (itemsSum > 0 ? itemsSum : null));

  const lowFields = [];
  if (merchant === 'Кассовый чек') lowFields.push('merchant');
  if (!date) lowFields.push('date');
  if (!finalTotal) lowFields.push('total');

  return {
    merchant, inn, date: date || TODAY, time, total: finalTotal,
    ocr_total: ocrTotal, items_sum: itemsSum, vat, items, qr: qrData,
    confidence: avgConf, low_confidence_fields: lowFields
  };
}

async function computeSha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleNewReceiptUpload(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  e.target.value = '';

  const scanId = 'scn_' + Date.now();
  const logs = [];
  const addLog = (stage, msg) => logs.push(`[${new Date().toLocaleTimeString()}] [${stage}] ${msg}`);

  document.getElementById('scan-progress-box').classList.remove('hidden');
  document.getElementById('scan-error-box').classList.add('hidden');
  document.getElementById('scan-result-stage').classList.add('hidden');
  setScanProgress(12, 'Этап 1: Сохранение оригинала...');

  try {
    let dataUrl = '';
    if (file.type === 'application/pdf') {
      addLog('INGEST', `Загружен PDF: ${file.name}`);
      const ab = await file.arrayBuffer();
      dataUrl = await renderPdfToDataUrl(ab);
    } else {
      addLog('INGEST', `Загружено фото: ${file.name}`);
      dataUrl = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej(new Error('Ошибка чтения файла'));
        r.readAsDataURL(file);
      });
    }

    const fileHash = await computeSha256(dataUrl.slice(0, 50000));
    await saveOriginalBlob(scanId, dataUrl, file.name, file.type || 'image/jpeg');
    addLog('STORAGE', `Оригинал сохранён в IndexedDB (ID: ${scanId})`);

    state.currentScan = { scan_id: scanId, file_hash: fileHash, dataUrl, logs, data: null };
    await executeScanPipeline(state.currentScan);
  } catch (err) {
    addLog('UPLOAD_ERROR', err.message);
    showScanStageError('UPLOAD_ERROR', err.message, logs);
  }
}

async function reprocessCurrentScan(specificScanId = null) {
  if (specificScanId) {
    const saved = await loadOriginalBlob(specificScanId);
    if (!saved) { toast('Оригинал не найден в хранилище'); return; }
    openScanModal();
    state.currentScan = {
      scan_id: specificScanId, file_hash: '', dataUrl: saved.dataUrl,
      logs: [`[${new Date().toLocaleTimeString()}] [REPROCESS] Повторная обработка ${specificScanId}`], data: null
    };
  }
  if (!state.currentScan?.dataUrl) return;
  document.getElementById('scan-progress-box').classList.remove('hidden');
  document.getElementById('scan-error-box').classList.add('hidden');
  await executeScanPipeline(state.currentScan);
}

async function executeScanPipeline(scanCtx) {
  const addLog = (stage, msg) => scanCtx.logs.push(`[${new Date().toLocaleTimeString()}] [${stage}] ${msg}`);
  document.getElementById('scan-result-stage').classList.remove('hidden');
  document.getElementById('scan-receipt-preview').src = scanCtx.dataUrl;
  document.getElementById('scan-laser').classList.remove('hidden');

  let prep;
  try {
    setScanProgress(30, 'Этап 2: Контраст, резкость и поиск QR...');
    prep = await preprocessReceiptCanvas(scanCtx.dataUrl);
    document.getElementById('scan-receipt-preview').src = prep.enhancedUrl;
    addLog('PREPROCESS', `Подготовлено фрагментов: ${prep.slices.length}`);
  } catch (e) {
    addLog('UPLOAD_ERROR', e.message);
    showScanStageError('UPLOAD_ERROR', e.message, scanCtx.logs);
    return;
  }

  const qrData = parseFiscalQrString(prep.qrRaw);
  addLog('QR', qrData.found ? `QR найден: сумма=${qrData.sum}, ФН=${qrData.fn}` : 'QR не найден, используем OCR');

  const isDup = state.scanHistory.some(h =>
    h.confirmed && ((qrData.found && h.fiscal_key === `${qrData.fn}_${qrData.fd}_${qrData.fp}`) || (scanCtx.file_hash && h.file_hash === scanCtx.file_hash))
  );

  let combinedText = '';
  let avgConf = 0.85;
  try {
    setScanProgress(55, 'Этап 3: Локальный OCR (Tesseract.js rus)...');
    if (!window.Tesseract) throw new Error('Tesseract.js недоступен');

    let confSum = 0;
    for (let i = 0; i < prep.slices.length; i++) {
      setScanProgress(55 + Math.round(((i + 1) / prep.slices.length) * 30), `OCR фрагмента ${i + 1} из ${prep.slices.length}...`);
      const ocrRes = await Tesseract.recognize(prep.slices[i], 'rus+eng');
      combinedText += '\n' + (ocrRes.data.text || '');
      confSum += (ocrRes.data.confidence || 75) / 100;
    }
    avgConf = Math.round((confSum / prep.slices.length) * 100) / 100;
    addLog('OCR', `Tesseract.js завершён (уверенность ${Math.round(avgConf * 100)}%)`);
  } catch (ocrErr) {
    if (!qrData.found) {
      addLog('OCR_ERROR', ocrErr.message);
      showScanStageError('OCR_ERROR', `Сбой распознавания текста: ${ocrErr.message}`, scanCtx.logs);
      return;
    }
  }

  try {
    setScanProgress(92, 'Этап 4: Парсинг и сверка суммы...');
    const parsed = parseRussianReceiptText(combinedText, qrData, avgConf);
    if (!parsed.total && parsed.items.length === 0) {
      throw new Error('Не найден итог и товарные позиции. Попробуйте сделать фото при лучшем освещении.');
    }
    parsed.is_duplicate = isDup;
    scanCtx.data = parsed;
    addLog('PARSE', `Готово: ${parsed.merchant}, позиций: ${parsed.items.length}, итог: ${parsed.total} ₽`);

    upsertScanArchive({
      scan_id: scanCtx.scan_id, file_hash: scanCtx.file_hash,
      fiscal_key: qrData.found ? `${qrData.fn}_${qrData.fd}_${qrData.fp}` : '',
      merchant: parsed.merchant, total: parsed.total, date: parsed.date, confirmed: false
    });

    setScanProgress(100, 'Готово');
    setTimeout(() => document.getElementById('scan-progress-box').classList.add('hidden'), 350);
    document.getElementById('scan-laser').classList.add('hidden');
    renderScanResultToForm(scanCtx);
  } catch (parseErr) {
    addLog('PARSE_ERROR', parseErr.message);
    showScanStageError('PARSE_ERROR', parseErr.message, scanCtx.logs);
  }
}

function setScanProgress(pct, label) {
  document.getElementById('scan-stage-pct').textContent = `${pct}%`;
  document.getElementById('scan-stage-label').textContent = label;
  document.getElementById('scan-stage-bar').style.width = `${pct}%`;
}

function showScanStageError(stageCode, message, logs) {
  document.getElementById('scan-progress-box').classList.add('hidden');
  document.getElementById('scan-result-stage').classList.add('hidden');
  document.getElementById('scan-laser').classList.add('hidden');
  const box = document.getElementById('scan-error-box');
  box.classList.remove('hidden');
  document.getElementById('scan-error-stage-badge').textContent = stageCode;
  document.getElementById('scan-error-msg').textContent = message;
  document.getElementById('res-tech-logs').textContent = (logs || []).join('\n');
}

function renderScanResultToForm(scanCtx) {
  const d = scanCtx.data;
  const confPct = Math.round((d.confidence || 0.85) * 100);
  document.getElementById('scan-conf-badge').textContent = `Уверенность: ${confPct}%`;
  document.getElementById('scan-dup-badge').classList.toggle('hidden', !d.is_duplicate);

  const mInp = document.getElementById('res-merchant');
  const dInp = document.getElementById('res-date');
  const tInp = document.getElementById('res-total');
  mInp.value = d.merchant || '';
  dInp.value = d.date || TODAY;
  tInp.value = d.total || '';

  mInp.classList.toggle('field-uncertain', (d.low_confidence_fields || []).includes('merchant'));
  dInp.classList.toggle('field-uncertain', (d.low_confidence_fields || []).includes('date'));
  tInp.classList.toggle('field-uncertain', (d.low_confidence_fields || []).includes('total'));

  document.getElementById('res-inn-lbl').textContent = `ИНН: ${d.inn || '—'}`;
  document.getElementById('res-vat-lbl').textContent = `НДС: ${d.vat !== null ? fmtR(d.vat) : '—'}`;

  const qrMatchEl = document.getElementById('res-qr-match-badge');
  const qrDetEl = document.getElementById('res-qr-details');
  if (d.qr && d.qr.found) {
    const matchOk = d.total !== null && d.qr.sum !== null && Math.abs(d.total - d.qr.sum) <= 1;
    qrMatchEl.textContent = matchOk ? 'Сумма = QR ✓' : `QR: ${d.qr.sum} ₽`;
    qrDetEl.textContent = `ФН: ${d.qr.fn} · ФД: ${d.qr.fd} · ФП: ${d.qr.fp} · ${d.qr.operation_type}`;
  } else {
    qrMatchEl.textContent = 'QR не найден';
    qrDetEl.textContent = 'QR-код не обнаружен — реквизиты и товары получены через OCR.';
  }

  document.getElementById('res-tech-logs').textContent = (scanCtx.logs || []).join('\n');
  renderEditableScanItems();
  recalcScanArithmetic();
}

function renderEditableScanItems() {
  const items = state.currentScan?.data?.items || [];
  document.getElementById('res-items-count').textContent = items.length;
  const listEl = document.getElementById('res-items-list');
  if (!items.length) {
    listEl.innerHTML = `<div class="text-xs text-sub py-2 text-center">Позиции не выделены — запишется итоговая сумма</div>`;
    return;
  }
  listEl.innerHTML = items.map((it, idx) => {
    const cmp = getPriceComparison(it.name, it.unit_price || it.total_price);
    return `
      <div class="input-surface p-2 flex items-center justify-between gap-2 text-xs">
        ${getProductIconBadge(it.name, it.category)}
        <div class="min-w-0 flex-1">
          <input type="text" value="${it.name.replace(/"/g, '&quot;')}" onchange="updateScanItem(${idx}, 'name', this.value)" class="w-full bg-transparent font-semibold text-main focus:outline-none" />
          <div class="flex flex-wrap items-center gap-1.5 mt-1">
            <select onchange="updateScanItem(${idx}, 'category', this.value)" class="bg-black/30 text-[10px] text-brand rounded px-1.5 py-0.5">
              ${Object.values(CATS).map(c => `<option value="${c.id}" ${c.id === it.category ? 'selected' : ''}>${c.name}</option>`).join('')}
            </select>
            <span class="text-[10px] text-sub">${it.quantity} × ${it.unit_price} ₽</span>
            ${cmp ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded ${cmp.diff > 0 ? 'bg-red-500/20 text-red-300' : cmp.diff < 0 ? 'bg-[#00D6C3]/15 text-brand' : 'bg-white/10 text-sub'}">${cmp.label}</span>` : ''}
          </div>
        </div>
        <input type="number" step="0.01" value="${it.total_price}" oninput="updateScanItem(${idx}, 'total_price', Number(this.value))" class="w-20 bg-black/30 border border-white/10 rounded px-2 py-1 text-right font-bold text-main tabular-nums" />
      </div>
    `;
  }).join('');
  state.transactions.forEach(t => { if (t._justMerged) delete t._justMerged; });
  lucide.createIcons();
}

function updateScanItem(idx, key, val) {
  if (!state.currentScan?.data?.items?.[idx]) return;
  state.currentScan.data.items[idx][key] = val;
  if (key === 'total_price') recalcScanArithmetic();
}

function addManualScanItem() {
  if (!state.currentScan?.data) return;
  state.currentScan.data.items.push({ name: 'Новая позиция', quantity: 1, unit_price: 0, total_price: 0, category: 'other', confidence: 1 });
  renderEditableScanItems();
  recalcScanArithmetic();
}

function recalcScanArithmetic() {
  if (!state.currentScan?.data) return;
  const items = state.currentScan.data.items || [];
  const itemsSum = Math.round(items.reduce((s, it) => s + (Number(it.total_price) || 0), 0) * 100) / 100;
  const totalVal = Number(document.getElementById('res-total').value) || 0;
  const el = document.getElementById('res-arith-status');
  if (!items.length) {
    el.textContent = `Итог чека: ${fmtR(totalVal)}`;
    return;
  }
  const diff = Math.abs(itemsSum - totalVal);
  el.textContent = diff <= 2 ? `${fmtR(itemsSum)} = ${fmtR(totalVal)} ✓` : `Позиции ${fmtR(itemsSum)} ≠ Итог ${fmtR(totalVal)}`;
  el.className = `font-bold tabular-nums ${diff <= 2 ? 'text-brand' : 'text-gold'}`;
}

function upsertScanArchive(entry) {
  const idx = state.scanHistory.findIndex(x => x.scan_id === entry.scan_id);
  if (idx >= 0) state.scanHistory[idx] = { ...state.scanHistory[idx], ...entry };
  else state.scanHistory.unshift(entry);
  persistAll();
}

function confirmAndCreateExpenseFromScan() {
  if (!state.currentScan?.data) return;
  const merchant = document.getElementById('res-merchant').value.trim() || 'Кассовый чек';
  const date = document.getElementById('res-date').value || TODAY;
  const total = Math.round(Math.abs(Number(document.getElementById('res-total').value) || 0));
  if (total <= 0) { toast('Укажите итоговую сумму'); return; }

  if (state.transactions.some(t => t.scan_id === state.currentScan.scan_id)) {
    toast('Этот чек уже записан в расходы');
    closeModals();
    return;
  }

  const items = state.currentScan.data.items || [];
  const mainCat = items.length ? items[0].category : classifyCategory(merchant);

  addOrMergeTransactions([{
    scan_id: state.currentScan.scan_id,
    merchant,
    amount: total,
    category: mainCat,
    type: 'expense',
    date,
    items: items.map(it => ({ name: it.name, price: it.total_price }))
  }], 'FINTEX Scan');

  items.forEach(it => {
    recordProductPrice(it.name, Number(it.unit_price || it.total_price) || 0, merchant, date, it.category);
  });
  upsertScanArchive({ scan_id: state.currentScan.scan_id, confirmed: true, merchant, total, date });
  closeModals();
  vibro('success');
  updateSyncQueueUI();
renderAll(false);
  toast(`Чек подтверждён: -${fmtR(total)}`);
}

// ==================== 2. ЛИЧНЫЙ ТРЕКЕР ЦЕН НА РЕГУЛЯРНЫЕ ТОВАРЫ ====================
function normalizeProductKey(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^\wа-яё\s%.,-]/gi, '')
    .replace(/\b(\d+(?:[.,]\d+)?\s*(?:л|мл|кг|г|гр|шт))\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function recordProductPrice(name, price, merchant, date, category = 'other') {
  const cleanName = (name || '').trim();
  const numPrice = Math.round(Number(price) * 100) / 100;
  if (!cleanName || numPrice <= 0) return;

  const key = normalizeProductKey(cleanName);
  if (!key || key.length < 2) return;

  if (!state.priceHistory[key]) {
    state.priceHistory[key] = { displayName: cleanName, category, records: [] };
  }
  const entry = state.priceHistory[key];
  entry.displayName = cleanName;
  // Не дублируем идентичную запись в тот же день и в том же магазине
  const dupSameDay = entry.records.some(r => r.date === date && r.merchant === merchant && Math.abs(r.price - numPrice) < 0.5);
  if (!dupSameDay) {
    entry.records.push({ date, price: numPrice, merchant });
    entry.records.sort((a, b) => a.date.localeCompare(b.date));
  }
  persistAll();
}

function getPriceComparison(name, currentPrice) {
  const key = normalizeProductKey(name);
  const entry = state.priceHistory[key];
  const cur = Number(currentPrice) || 0;
  if (!entry || !entry.records || entry.records.length === 0 || cur <= 0) return null;

  const prevRec = entry.records[entry.records.length - 1];
  if (!prevRec || prevRec.price <= 0) return null;

  const diff = Math.round((cur - prevRec.price) * 100) / 100;
  const pct = Math.round((diff / prevRec.price) * 100);
  if (Math.abs(pct) < 1) {
    return { diff: 0, pct: 0, label: `Как раньше (${prevRec.price} ₽)` };
  }
  if (diff > 0) {
    return { diff, pct, label: `Было ${prevRec.price} ₽ (${prevRec.merchant}) · +${pct}% ↑` };
  }
  return { diff, pct, label: `Было ${prevRec.price} ₽ (${prevRec.merchant}) · ${pct}% ↓` };
}

function renderPriceTrackerPreview() {
  const entries = Object.entries(state.priceHistory);
  const badge = document.getElementById('pt-count-badge');
  const box = document.getElementById('an-price-tracker-preview');
  if (!badge || !box) return;

  badge.textContent = `${entries.length} товаров`;
  if (!entries.length) {
    box.innerHTML = `<div class="text-xs text-sub">Отсканируйте первый чек через FINTEX Scan — система автоматически начнёт отслеживать динамику цен на ваши регулярные товары.</div>`;
    return;
  }

  box.innerHTML = entries.slice(0, 3).map(([key, item]) => {
    const recs = item.records;
    const latest = recs[recs.length - 1];
    const prev = recs.length > 1 ? recs[recs.length - 2] : null;
    const pct = prev && prev.price > 0 ? Math.round(((latest.price - prev.price) / prev.price) * 100) : 0;
    const deltaBadge = prev
      ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${pct > 0 ? 'bg-red-500/20 text-red-300' : pct < 0 ? 'bg-[#00D6C3]/15 text-brand' : 'bg-white/10 text-sub'}">${pct > 0 ? '+' + pct + '% ↑' : pct < 0 ? pct + '% ↓' : '0%'}</span>`
      : `<span class="text-[10px] text-sub">1 замер</span>`;

    return `
      <div onclick="openPriceTrackerModal('${key.replace(/'/g, '')}')" class="input-surface p-2.5 flex items-center justify-between text-xs cursor-pointer tap">
        <div class="flex items-center gap-2.5 min-w-0">
          ${getProductIconBadge(item.displayName, item.category)}
          <div class="min-w-0">
            <div class="font-semibold text-main truncate">${item.displayName}</div>
            <div class="text-[10px] text-sub truncate">${latest.merchant} · ${humanDate(latest.date)}</div>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          ${deltaBadge}
          <span class="font-bold text-main tabular-nums">${fmtR(latest.price)}</span>
        </div>
      </div>
    `;
  }).join('');
}

function openPriceTrackerModal(focusKey = null) {
  state.selectedPriceKey = focusKey;
  document.getElementById('pt-search-inp').value = '';
  renderPriceTrackerModal();
  document.getElementById('modal-price-tracker').classList.remove('hidden');
  lucide.createIcons();
}

function renderPriceTrackerModal() {
  const q = (document.getElementById('pt-search-inp')?.value || '').trim().toLowerCase();
  const entries = Object.entries(state.priceHistory).filter(([k, v]) => !q || v.displayName.toLowerCase().includes(q));
  const listEl = document.getElementById('pt-full-list');

  if (!entries.length) {
    document.getElementById('pt-chart-card').classList.add('hidden');
    listEl.innerHTML = `<div class="p-6 text-center text-xs text-sub">История цен пуста. Отсканируйте чек в FINTEX Scan, чтобы заполнить трекер.</div>`;
    return;
  }

  const activeKey = state.selectedPriceKey && state.priceHistory[state.selectedPriceKey] ? state.selectedPriceKey : entries[0][0];
  selectPriceTrackerItem(activeKey, false);

  listEl.innerHTML = entries.map(([key, item]) => {
    const recs = item.records;
    const latest = recs[recs.length - 1];
    const minPrice = Math.min(...recs.map(r => r.price));
    const bestRec = recs.find(r => r.price === minPrice);
    return `
      <div onclick="selectPriceTrackerItem('${key.replace(/'/g, '')}', true)" class="input-surface p-3 flex items-center justify-between text-xs cursor-pointer tap ${key === activeKey ? 'border border-[#00D6C3]/40' : ''}">
        <div class="flex items-center gap-2.5 min-w-0">
          ${getProductIconBadge(item.displayName, item.category)}
          <div class="min-w-0">
            <div class="font-semibold text-main truncate">${item.displayName}</div>
            <div class="text-[10px] text-sub">Мин. цена: ${fmtR(minPrice)} (${bestRec?.merchant || ''})</div>
          </div>
        </div>
        <span class="font-bold text-main tabular-nums shrink-0">${fmtR(latest.price)}</span>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function selectPriceTrackerItem(key, rerenderList = true) {
  state.selectedPriceKey = key;
  const item = state.priceHistory[key];
  const chartCard = document.getElementById('pt-chart-card');
  if (!item || !item.records.length) {
    chartCard.classList.add('hidden');
    return;
  }
  chartCard.classList.remove('hidden');
  const recs = item.records;
  const first = recs[0];
  const latest = recs[recs.length - 1];
  const pct = first.price > 0 ? Math.round(((latest.price - first.price) / first.price) * 100) : 0;

  document.getElementById('pt-chart-title').textContent = item.displayName;
  document.getElementById('pt-chart-sub').textContent = `Замеров: ${recs.length} · Диапазон: ${fmtR(Math.min(...recs.map(r => r.price)))} – ${fmtR(Math.max(...recs.map(r => r.price)))}`;
  const deltaEl = document.getElementById('pt-chart-delta');
  deltaEl.textContent = pct > 0 ? `+${pct}%` : `${pct}%`;
  deltaEl.className = `text-[10px] font-bold px-2 py-0.5 rounded ${pct > 0 ? 'bg-red-500/20 text-red-300' : 'bg-[#00D6C3]/15 text-brand'}`;

  const minV = Math.min(...recs.map(r => r.price)) * 0.9;
  const maxV = Math.max(...recs.map(r => r.price)) * 1.1 || 1;
  const coords = recs.map((r, i) => ({
    x: recs.length === 1 ? 140 : (i / (recs.length - 1)) * 260 + 10,
    y: 60 - ((r.price - minV) / Math.max(1, maxV - minV)) * 48
  }));
  const pathStr = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
  document.getElementById('pt-svg-line').setAttribute('d', pathStr);
  document.getElementById('pt-svg-dots').innerHTML = coords.map(c => `<circle cx="${c.x}" cy="${c.y}" r="3.5" fill="#00D6C3" />`).join('');

  document.getElementById('pt-chart-records').innerHTML = recs.slice().reverse().map(r => `
    <div class="flex justify-between text-sub"><span>${humanDate(r.date)} · ${r.merchant}</span><span class="font-bold text-main">${fmtR(r.price)}</span></div>
  `).join('');

  if (rerenderList) renderPriceTrackerModal();
}
