/* FINTEX Capture lives only inside the open Mini App. No background/overlay APIs. */
(function(){
  'use strict';
  const M=window.FintexCaptureModel;
  let dialog,fab,busy=false,epoch=0,candidate=null,priorFocus=null,tgBack=null,activeWorker=null;
  const readArchive=()=>{try{const v=JSON.parse(localStorage.getItem('fp_capture_archive')||'[]');return Array.isArray(v)?v:[];}catch(_){return [];}};
  const autoEnabled=()=>localStorage.getItem('fp_capture_auto')!=='0';
  const $=id=>document.getElementById(id);
  function archive(){return [...readArchive(),...state.scanHistory.filter(s=>s.confirmed).map(s=>({fileHash:s.file_hash,fiscalKey:s.fiscal_key,txId:state.transactions.find(t=>t.scan_id===s.scan_id)?.id}))];}
  function assess(c){return M.assess(c,{today:TODAY,transactions:state.transactions,archive:archive()});}
  function status(text){$('capture-status').textContent=text;}
  function processing(phase,text,progress=null){
    $('capture-processing-title').textContent=text;
    dialog.querySelectorAll('[data-capture-step]').forEach((el,i)=>{el.dataset.state=i<phase?'done':i===phase?'current':'waiting';if(i===phase)el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');});
    const bar=$('capture-progress');bar.dataset.determinate=String(progress!==null);
    if(progress===null){bar.removeAttribute('aria-valuenow');$('capture-progress-label').textContent=phase===0?'Подготавливаем фото и ищем QR':'Загружаем локальный движок';}
    else{const pct=Math.min(100,Math.max(0,Math.round(progress*100)));bar.setAttribute('aria-valuenow',String(pct));bar.style.setProperty('--capture-progress',pct+'%');$('capture-progress-label').textContent=phase===2?'Сверяем сумму, дату и дубликаты':`Прочитано ${pct}% текста`;}
  }
  function stage(name){
    dialog.querySelectorAll('[data-capture-stage]').forEach(el=>{el.hidden=el.dataset.captureStage!==name;});
    dialog.setAttribute('aria-busy',String(name==='processing'));
  }
  function releasePreview(){$('capture-preview').removeAttribute('src');}
  function close(){
    if(activeWorker){activeWorker.terminate().catch(()=>{});activeWorker=null;}
    epoch++;busy=false;candidate=null;releasePreview();
    if(dialog.open)dialog.close();fab.setAttribute('aria-expanded','false');
    const back=window.Telegram?.WebApp?.BackButton;
    if(tgBack){try{back?.offClick(tgBack);back?.hide();}catch(_){}tgBack=null;}
    updateFab();priorFocus?.focus?.({preventScroll:true});
  }
  function open(){
    if(busy||dialog.open)return;
    $('capture-place-done').hidden=true;
    priorFocus=document.activeElement;candidate=null;status('');stage('menu');$('capture-auto').checked=autoEnabled();
    dialog.showModal();fab.setAttribute('aria-expanded','true');
    const back=window.Telegram?.WebApp?.BackButton;
    if(back){tgBack=close;try{back.show();back.onClick(tgBack);}catch(_){}}
    window.lucide?.createIcons();updateFab();
  }
  function fail(message){stage('error');$('capture-error-text').textContent=message;status('Ничего не записано.');}
  function readFile(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('Не удалось прочитать файл. Выберите его ещё раз.'));r.readAsDataURL(file);});}
  function timeout(promise,ms=90000){let t;return Promise.race([promise,new Promise((_,reject)=>{t=setTimeout(()=>reject(new Error('Распознавание заняло слишком много времени. Попробуйте более чёткое изображение.')),ms);})]).finally(()=>clearTimeout(t));}
  async function hashFile(file){
    if(!window.crypto?.subtle)throw new Error('Для проверки дубликатов нужен защищённый HTTPS-доступ.');
    const hash=await crypto.subtle.digest('SHA-256',await file.arrayBuffer());
    return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
  }
  async function imageData(file){
    const url=await readFile(file);
    return new Promise((resolve,reject)=>{
      const image=new Image();image.onerror=()=>reject(new Error('Изображение не открылось. Попробуйте JPEG или PNG вместо HEIC.'));
      image.onload=()=>{
        if(image.naturalWidth*image.naturalHeight>25000000){reject(new Error('Изображение слишком большое. Сделайте скриншот или уменьшите его до 25 Мп.'));return;}
        // Keep the source resolution. Receipt preparation has a pixel budget;
        // scaling every long receipt down to 4200px erased small print.
        resolve(url);
      };image.src=url;
    });
  }
  async function extract(file,id,mode){
    let dataUrl,text='',confidence=null,nativeText=false,retried=false,conflictingTotal=false;
    if(file.type==='application/pdf'||/\.pdf$/i.test(file.name)){
      const pdfjs=await import('./assets/ocr/pdf.min.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc=new URL('./assets/ocr/pdf.worker.min.mjs',location.href).href;
      const pdf=await timeout(pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise);
      try{
        if(pdf.numPages!==1)throw new Error('Пока поддерживается один чек на одной странице PDF. Выберите нужную страницу или её скриншот.');
        const page=await pdf.getPage(1),content=await page.getTextContent();
        let lastY=null;for(const item of content.items){const y=item.transform?.[5];if(lastY!==null&&Math.abs(y-lastY)>3)text+='\n';text+=item.str+(item.hasEOL?'\n':' ');lastY=y;}
        nativeText=text.trim().length>25;
        const base=page.getViewport({scale:1}),scale=Math.min(2,1800/base.width,Math.sqrt(8000000/(base.width*base.height))),viewport=page.getViewport({scale}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await timeout(page.render({canvasContext:canvas.getContext('2d'),viewport}).promise);dataUrl=canvas.toDataURL('image/png');
      }finally{await pdf.destroy();}
    }else dataUrl=await timeout(imageData(file));
    if(id!==epoch)return null;
    processing(0,'Готовим чёткое изображение');status('Ищем QR на исходном изображении…');
    const prep=await timeout(preprocessReceiptCanvas(dataUrl));
    if(id!==epoch)return null;
    if(prep.slices.length>8)throw new Error('Слишком длинное изображение. Обрежьте его до одной операции.');
    if(!nativeText){
      if(!window.Tesseract)throw new Error('Движок распознавания не загрузился. Для первой загрузки OCR нужен интернет. Финансовые записи не изменены.');
      text='';let confidenceSum=0,expired=false,worker,sliceIndex=0,retries=0;const parts=[];
      processing(1,'Читаем чек');status('Запускаем распознавание на устройстве…');
      const base=new URL('./assets/ocr/',location.href);
      try{
        worker=await timeout(Tesseract.createWorker('rus+eng',1,{
          workerPath:new URL('worker.min.js',base).href,
          corePath:new URL('tesseract-core-lstm.wasm.js',base).href,
          langPath:new URL('lang/',base).href,gzip:true,logger:message=>{if(id===epoch&&dialog.open&&message.status==='recognizing text'&&Number.isFinite(message.progress))processing(1,retried?'Уточняем нечёткие строки':'Читаем чек',Math.min(.99,(sliceIndex+message.progress)/prep.slices.length));}
        }).then(w=>{if(expired||id!==epoch){w.terminate();throw new Error('Распознавание отменено.');}return w;}));
        activeWorker=worker;
        if(worker.setParameters)await timeout(worker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300',tessedit_pageseg_mode:'3'}));
        for(let i=0;i<prep.slices.length;i++){
          if(id!==epoch)return null;
          sliceIndex=i;status(`Читаем часть ${i+1} из ${prep.slices.length}…`);
          let result=await timeout(worker.recognize(prep.slices[i],{rotateAuto:true}));
          if(id!==epoch)return null;
          if((!result.data?.text?.trim()||Number(result.data?.confidence||0)<65||(mode==='receipt'&&!FintexReceiptVision.total(result.data?.text).amount))&&prep.originalSlices?.[i]&&retries<2){
            retried=true;processing(1,'Уточняем нечёткие строки');status('Пробуем исходное фото и проверяем ориентацию…');
            const sideways=prep.slices.length===1&&prep.width>prep.height*1.2&&Number(result.data?.confidence||0)<65;
            const attempts=sideways?[{angle:90,psm:'3'},{angle:270,psm:'3'}]:[{angle:0,psm:'11'},{angle:0,psm:'6',enhanced:true}];
            const quality=data=>Number(data?.confidence||0)+(FintexReceiptVision.total(data?.text).amount?35:0);
            const seenTotals=new Set();const initialTotal=FintexReceiptVision.total(result.data?.text).amount;if(initialTotal)seenTotals.add(initialTotal);
            for(const attempt of attempts){
              const {angle,psm,enhanced}=attempt;
              if(retries>=2||id!==epoch)break;retries++;
              const source=angle?await FintexReceiptVision.rotate(prep.originalSlices[i],angle):enhanced?prep.slices[i]:prep.originalSlices[i];
              if(worker.setParameters)await timeout(worker.setParameters({tessedit_pageseg_mode:psm}));
              if(id!==epoch)return null;
              const alternate=await timeout(worker.recognize(source,{rotateAuto:true}));
              if(id!==epoch)return null;
              const nextTotal=FintexReceiptVision.total(alternate.data?.text).amount;if(nextTotal)seenTotals.add(nextTotal);
              if(alternate.data?.text?.trim()&&quality(alternate.data)>quality(result.data))result=alternate;
              if(Number(result.data?.confidence||0)>=85&&FintexReceiptVision.total(result.data?.text).amount)break;
            }
            if(seenTotals.size>1)conflictingTotal=true;
          }
          if(worker.setParameters)await timeout(worker.setParameters({tessedit_pageseg_mode:'3'}));
          parts.push(result.data?.text||'');confidenceSum+=Number.isFinite(result.data?.confidence)?Math.max(0,Math.min(100,result.data.confidence)):0;
        }
        text=FintexReceiptVision.join(parts);confidence=confidenceSum/prep.slices.length;
      }finally{expired=true;if(worker){await worker.terminate().catch(()=>{});if(activeWorker===worker)activeWorker=null;}}
    }
    processing(2,'Проверяем найденное',1);status('Проверяем итог, дату и повторные загрузки…');
    return {text,confidence,qr:parseFiscalQrString(prep.qrRaw),dataUrl,nativeText,retried,conflictingTotal,slices:prep.slices.length};
  }
  function makeCandidate(result,mode,fileHash){
    const {text,qr,confidence}=result;
    const receiptLike=FintexReceiptVision.isReceipt(text,qr);
    const kind=mode==='receipt'||receiptLike?'receipt':'bank';
    const bank=M.bankFromText(text);
    if(kind==='bank'){
      const op=parseBankSmsOrClipboard(text);
      if(!op)return {kind:'bank',raw:text,bank,confidence,fileHash,qr,merchant:'',amount:null,date:TODAY,dateInferred:true,uncertain:true,type:'expense',op_kind:'expense',category:'other',low_confidence_fields:['merchant','total','date'],incomplete:true};
      const explicitDate=/\b\d{1,2}[./]\d{1,2}[./](?:20)?\d{2}\b|сегодня|вчера/i.test(text);
      return {...op,raw:text,bank,kind,confidence,fileHash,dateInferred:!explicitDate,uncertain:!detectSmsOperationKind(text)||/(?:покупк|зачислен|списан|перевод).*(?:\n.*)*(?:покупк|зачислен|списан|перевод)/i.test(text),qr};
    }
    const data=parseRussianReceiptText(text,qr,(confidence||0)/100),params=new URLSearchParams(qr.raw||'');
    if(result.conflictingTotal){data.total=null;data.low_confidence_fields.push('total_conflict');}
    // Fiscal operation n is seller-facing. Returns and non-sale directions require review.
    const refund=params.get('n')==='2'||/возврат\s+прихода|чек\s+возврата/i.test(text);
    const uncertain=(data.low_confidence_fields||[]).length>0||(qr.found&&params.get('n')!=='1')||result.slices>1||result.nativeText||result.retried||mode==='operation';
    return {kind,raw:text,bank,confidence,fileHash,qr,merchant:data.merchant,amount:data.total,date:data.date,time:data.time,dateInferred:(data.low_confidence_fields||[]).includes('date'),ocrTotal:data.ocr_total,itemsSum:data.items_sum,items:data.items,low_confidence_fields:data.low_confidence_fields||[],uncertain,type:refund?'income':'expense',op_kind:refund?'refund':'expense',op_label:refund?'Возврат':'Покупка',category:classifyCategory(data.merchant),fiscalKey:M.fiscalKey(qr),dedup_hash:M.fiscalKey(qr)?'capture_fiscal_'+M.fiscalKey(qr):''};
  }
  async function receive(file,mode){
    if(!file||busy)return;
    $('capture-place-done').hidden=true;
    const id=++epoch;busy=true;candidate=null;releasePreview();stage('processing');processing(0,'Готовим чёткое изображение');status('Проверяем файл и дубликаты…');
    try{
      if(file.size>15*1024*1024||file.size===0)throw new Error('Выберите непустой файл размером до 15 МБ.');
      const pdf=file.type==='application/pdf'||/\.pdf$/i.test(file.name);
      if(!file.type.startsWith('image/')&&!pdf)throw new Error('Поддерживаются изображения и одностраничные PDF-чеки.');
      if(pdf&&mode!=='receipt')throw new Error('Для PDF используйте «Загрузить чек».');
      const fileHash=await hashFile(file);if(id!==epoch)return;
      const duplicate=M.duplicate({fileHash},state.transactions,archive());
      if(duplicate){stage('done');$('capture-done-title').textContent='Уже учтено';$('capture-done-text').textContent='Это изображение уже записано. Повторная загрузка не изменила баланс.';return;}
      const result=await extract(file,id,mode);if(id!==epoch||!result)return;
      const parsed=makeCandidate(result,mode,fileHash);if(id!==epoch)return;
      candidate=parsed;
      if(assess(parsed).autoSave&&autoEnabled())save(true);
      else showReview(result.dataUrl);
    }catch(error){if(id===epoch)fail(error.message||'Не удалось обработать файл. Попробуйте ещё раз.');}
    finally{if(id===epoch)busy=false;}
  }
  function showReview(dataUrl){
    stage('review');status(candidate.incomplete?'Не всё удалось прочитать. Фото доступно в предпросмотре — заполните сумму, дату и название перед записью.':'Проверьте поля перед записью.');
    if(dataUrl){$('capture-preview').src=dataUrl;}
    $('capture-bank').value=candidate.bank||'';$('capture-merchant').value=candidate.merchant||'';$('capture-amount').value=candidate.amount>0?String(candidate.amount):'';$('capture-date').value=candidate.dateInferred?'':candidate.date||'';$('capture-date').max=TODAY;$('capture-time').value=candidate.time||'';$('capture-kind').value=candidate.op_kind||candidate.type;
    $('capture-confidence').textContent=Number.isFinite(candidate.confidence)?`Качество текста OCR: ${Math.round(candidate.confidence)}%. Это не вероятность правильной операции.`:'Текст извлечён из PDF. Процент достоверности не придумываем.';
    candidate.reviewed={};$('capture-category').value=CATS[candidate.category]?candidate.category:classifyCategory(candidate.merchant);
    showPlace();refreshReview();$('capture-review-title').focus({preventScroll:true});
  }
  function showPlace(){const original=candidate;if(!original)return;window.FintexPlacePicker?.field($('capture-place'),{location:original.location,suggestedLabel:()=>$('capture-merchant').value.trim(),onChange:loc=>{if(candidate!==original||!dialog.open)return;if(loc)candidate.location=loc;else delete candidate.location;showPlace();}});}
  function formCandidate(){
    const kind=$('capture-kind').value,type=['income','refund','transfer_in'].includes(kind)?'income':'expense';
    const edited={...candidate,bank:$('capture-bank').value.trim(),merchant:$('capture-merchant').value.trim(),amount:FM.parse($('capture-amount').value),date:$('capture-date').value,time:$('capture-time').value,type,op_kind:kind};
    edited.op_label={income:'Пополнение',refund:'Возврат',transfer_in:'Перевод (вх.)',transfer_out:'Перевод (исх.)',expense:'Покупка',atm:'Наличные'}[kind];
    edited.category=$('capture-category').value;return edited;
  }
  function refreshReview(){
    if(!candidate)return;
    const c=formCandidate(),policy=assess(c),list=$('capture-reasons');list.replaceChildren();
    for(const reason of policy.reasons){const li=document.createElement('li');li.textContent=reason;list.append(li);}
    $('capture-level').textContent=policy.duplicateId?'Дубликат — не записываем':policy.autoSave?'QR и текст совпали':'Нужно подтверждение';
    const low=!Number.isFinite(candidate.confidence)||candidate.confidence<92,fields=candidate.low_confidence_fields||[];
    for(const field of ['merchant','amount','date','category']){
      const input=$('capture-'+field),hint=$('capture-'+field+'-hint'),changed=!!candidate.reviewed?.[field];
      const uncertain=field==='category'||field==='merchant'&&(low||fields.includes('merchant')||!candidate.merchant||candidate.merchant==='Кассовый чек')||field==='amount'&&(low||fields.includes('total')||Number.isFinite(candidate.ocrTotal)&&Math.round(candidate.ocrTotal*100)!==Math.round(candidate.amount*100)||Number.isFinite(candidate.itemsSum)&&candidate.itemsSum>0&&Math.round(candidate.itemsSum*100)!==Math.round(candidate.amount*100))||field==='date'&&(candidate.dateInferred||fields.includes('date'));
      hint.textContent=changed?'Изменено':field==='category'?'Подобрана автоматически':uncertain?'Проверьте по оригиналу':'';
      input.closest('label').dataset.reviewCheck=uncertain&&!changed?'suggested':'ready';input.setAttribute('aria-describedby',hint.id);
    }
    $('capture-validation').textContent=policy.canSave?'':policy.reasons.join(' ');
    $('capture-save').disabled=!policy.canSave||!CATS[c.category];
    $('capture-transfer-note').hidden=!c.op_kind.startsWith('transfer');
  }
  function save(automatic=false){
    if(!candidate)return;
    const c=automatic?candidate:formCandidate(),policy=assess(c);
    if(!policy.canSave||(automatic&&!policy.autoSave)){if(!automatic)refreshReview();return;}
    // Single synchronous ledger commit, rechecked against current transactions.
    const fiscal=policy.fiscalKey,hash=fiscal?'capture_fiscal_'+fiscal:computeClientDedupHash(c.date,c.time||'',c.amount,c.type,c.merchant,'');
    const result=addOrMergeTransactions([{...c,scan_id:'capture_'+c.fileHash,raw:'',dedup_hash:hash,items:(c.items||[]).map(i=>({name:i.name,price:i.total_price??i.price}))}],'FINTEX Capture');
    if(result.addedCount){
      const tx=result.added[0];
      try{localStorage.setItem('fp_capture_archive',JSON.stringify([{fileHash:c.fileHash,fiscalKey:fiscal,txId:tx.id},...readArchive()].slice(0,1000)));}catch(_){}
      if(c.kind==='receipt')try{upsertScanArchive({scan_id:tx.scan_id,file_hash:c.fileHash,fiscal_key:fiscal,merchant:c.merchant,total:c.amount,date:c.date,confirmed:true});}catch(_){/* Ledger is already saved; auxiliary archive is best-effort. */}
      if(c.kind==='receipt')for(const item of c.items||[])try{recordProductPrice(item.name,Number(item.unit_price||item.total_price)||0,c.merchant,c.date,item.category);}catch(_){}
    }
    $('capture-place-done').hidden=!result.addedCount;$('capture-place-done').onclick=()=>{const tx=state.transactions.find(t=>t.id===result.added[0]?.id);if(tx)window.FintexPlaces?.edit(tx);};
    candidate=null;stage('done');status('');$('capture-done-title').textContent=result.addedCount?(automatic?'Чек записан автоматически':'Операция записана'):'Уже учтено';
    $('capture-done-text').textContent=result.addedCount?`${c.op_label||'Покупка'} · ${c.merchant} · ${fmtR(c.amount)}. ${automatic?'QR и итог из текста совпали. Это не проверка чека в ФНС.':'Баланс изменён только на сумму операции, не на распознанный остаток счёта.'}`:'Дубликат отклонён. Баланс не изменён.';
    renderAll(false);updateSyncQueueUI();window.vibro?.('success');
  }
  function updateFab(){
    if(!fab)return;
    const home=!$('view-home')?.classList.contains('hidden');
    const overlay=!!document.querySelector('dialog[open]:not(#fintex-tour), [id^="modal-"]:not(.hidden), #onboarding-screen:not(.hidden), #returning-splash:not(.hidden)');
    const hidden=!home||overlay;if(fab.hidden!==hidden)fab.hidden=hidden;
  }
  function mount(){
    fab=document.createElement('button');fab.id='capture-fab';fab.type='button';fab.setAttribute('aria-label','FINTEX Capture — сканировать операцию');fab.setAttribute('aria-haspopup','dialog');fab.setAttribute('aria-controls','capture-dialog');fab.setAttribute('aria-expanded','false');fab.innerHTML='<i data-lucide="scan-line" aria-hidden="true"></i><span>Capture</span>';
    dialog=document.createElement('dialog');dialog.id='capture-dialog';dialog.setAttribute('aria-labelledby','capture-title');
    dialog.innerHTML=`<header class="capture-header"><div><span class="capture-kicker">ОДНО ИЗОБРАЖЕНИЕ → ОДНА ОПЕРАЦИЯ</span><h2 id="capture-title">FINTEX <span>Capture</span></h2></div><button type="button" data-capture-close aria-label="Закрыть Capture">×</button></header>
    <div class="capture-content">
      <section data-capture-stage="menu"><p class="capture-copy">Передайте изображение — мы найдём сумму, дату и назначение. Сомнительные поля проверим вместе.</p>
        <div class="capture-actions">
          <button type="button" data-capture-pick="camera"><i data-lucide="camera"></i><span><strong>Сфотографировать</strong><small>Камера · чек или уведомление</small></span><span aria-hidden="true">↗</span></button>
          <button type="button" data-capture-pick="screenshot"><i data-lucide="image"></i><span><strong>Выбрать скриншот</strong><small>Изображение из галереи</small></span><span aria-hidden="true">↗</span></button>
          <button type="button" data-capture-pick="receipt"><i data-lucide="receipt"></i><span><strong>Загрузить чек</strong><small>Фото или одностраничный PDF</small></span><span aria-hidden="true">↗</span></button>
          <button type="button" data-capture-pick="operation"><i data-lucide="scan-text"></i><span><strong>Распознать операцию</strong><small>Банковское уведомление или скрин</small></span><span aria-hidden="true">↗</span></button>
        </div>
        <label class="capture-auto"><input id="capture-auto" type="checkbox"><span>Автоучёт надёжных чеков<small>Только если полный QR и итог из текста совпали. Доходы, переводы и банковские скриншоты — с подтверждением.</small></span></label>
        <p class="capture-footnote">До 15 МБ · только рубли · без платных сервисов. Обработка в браузере; для первой загрузки OCR нужен интернет. Кнопка работает только внутри открытого FINTEX.</p>
      </section>
      <section data-capture-stage="processing" hidden><div class="capture-scan-scene" aria-hidden="true"><div class="capture-scan-halo"></div><div class="capture-paper"><span>FINTEX</span><i></i><i></i><i></i><b>₽</b><div class="capture-scan-beam"></div></div><span class="capture-scan-spark">✦</span></div><h3 id="capture-processing-title">Читаем чек</h3><ol class="capture-steps" aria-label="Этапы распознавания"><li data-capture-step>Фото</li><li data-capture-step>Текст</li><li data-capture-step>Проверка</li></ol><div id="capture-progress" role="progressbar" aria-label="Распознавание текста" aria-valuemin="0" aria-valuemax="100"><span></span></div><p id="capture-progress-label" class="capture-copy"></p><p class="capture-processing-note">Читаем на устройстве. Можно отменить — незавершённый результат не сохранится.</p><button type="button" class="capture-secondary" data-capture-close>Отменить</button></section>
      <section data-capture-stage="review" hidden><h3 id="capture-review-title" tabindex="-1">Проверьте запись</h3><span id="capture-level" class="capture-level"></span>
        <form id="capture-form"><div class="recognition-card" aria-label="Распознанная операция"><label class="recognition-wide">Где или за что<small id="capture-merchant-hint"></small><input id="capture-merchant" maxlength="100" required></label><label class="recognition-wide recognition-amount">Сколько, ₽<small id="capture-amount-hint"></small><input id="capture-amount" inputmode="decimal" type="text" autocomplete="off" required></label><label>Дата<small id="capture-date-hint"></small><input id="capture-date" type="date" required></label><label>Категория<small id="capture-category-hint"></small><select id="capture-category">${Object.values(CATS).map(c=>`<option value="${c.id}">${c.name}</option>`).join('')}</select></label></div>
        <label>Вид операции<select id="capture-kind"><option value="expense">Расход</option><option value="income">Доход</option><option value="transfer_out">Перевод — исходящий</option><option value="transfer_in">Перевод — входящий</option><option value="refund">Возврат</option><option value="atm">Снятие наличных</option></select></label><p id="capture-transfer-note" class="capture-copy" hidden>Проверьте направление. Перевод между своими счетами не добавляйте как расход или доход общего капитала.</p>
        <section id="capture-place"></section><details class="recognition-details"><summary>Изображение и детали распознавания</summary><details class="capture-image"><summary>Посмотреть изображение</summary><img id="capture-preview" alt="Загруженное изображение для проверки"></details><p id="capture-confidence" class="capture-copy"></p><div class="capture-fields"><label>Банк<input id="capture-bank" maxlength="60" placeholder="Не определён"></label><label>Время<input id="capture-time" type="time"></label></div><ul id="capture-reasons"></ul></details><p id="capture-validation" class="flow-status" role="status" aria-live="polite"></p><button id="capture-save" class="capture-primary" type="submit">Подтвердить и записать</button></form>
      </section>
      <section data-capture-stage="done" hidden><div class="capture-success" aria-hidden="true">✓</div><h3 id="capture-done-title"></h3><p id="capture-done-text" class="capture-copy"></p><button type="button" id="capture-place-done" class="capture-secondary" hidden>Добавить место покупки</button><button type="button" class="capture-primary" data-capture-close>Готово</button><button type="button" class="capture-secondary" data-capture-again>Добавить ещё</button></section>
      <section data-capture-stage="error" hidden><h3>Не получилось прочитать</h3><p id="capture-error-text" class="capture-copy"></p><button type="button" class="capture-primary" data-capture-again>Выбрать другое изображение</button></section>
      <p id="capture-status" role="status" aria-live="polite"></p>
    </div>`;
    document.body.append(fab,dialog);
    for(const [name,accept,camera] of [['camera','image/*',true],['screenshot','image/*',false],['receipt','image/*,application/pdf',false],['operation','image/*',false]]){
      const input=document.createElement('input');input.id='capture-file-'+name;input.type='file';input.accept=accept;input.hidden=true;if(camera)input.setAttribute('capture','environment');dialog.append(input);
      input.addEventListener('change',()=>{const file=input.files?.[0];input.value='';receive(file,name);});
    }
    fab.addEventListener('click',open);
    dialog.addEventListener('click',e=>{
      if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}
      if(e.target.closest('[data-capture-close]'))close();
      if(e.target.closest('[data-capture-again]')){epoch++;busy=false;candidate=null;releasePreview();status('');stage('menu');}
      const pick=e.target.closest('[data-capture-pick]');if(pick&&!busy)$('capture-file-'+pick.dataset.capturePick).click();
    });
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    $('capture-auto').addEventListener('change',e=>localStorage.setItem('fp_capture_auto',e.target.checked?'1':'0'));
    $('capture-form').addEventListener('input',e=>{if(candidate){const field=e.target.id.replace('capture-','');candidate.reviewed=candidate.reviewed||{};candidate.reviewed[field]=true;if(field==='merchant'&&!candidate.reviewed.category)$('capture-category').value=classifyCategory(e.target.value);}refreshReview();});$('capture-form').addEventListener('change',e=>{if(candidate){candidate.reviewed=candidate.reviewed||{};candidate.reviewed[e.target.id.replace('capture-','')]=true;}refreshReview();});$('capture-form').addEventListener('submit',e=>{e.preventDefault();if(!busy)save(false);});
    let scheduled=false;new MutationObserver(()=>{if(!scheduled){scheduled=true;requestAnimationFrame(()=>{scheduled=false;updateFab();});}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['class','hidden','open']});
    window.lucide?.createIcons();updateFab();
  }
  window.FintexCapture={open,close};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
