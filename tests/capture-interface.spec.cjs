const {test,expect}=require('@playwright/test');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWQAAAABJRU5ErkJggg==','base64');
async function open(page,{qr=false,confidence=97,text='',defer=false}={}){
  await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)&&!/(?:tesseract.min|jsQR)\.js/.test(route.request().url())?route.continue():route.abort());
  await page.addInitScript(({qr,confidence,text,defer})=>{
    localStorage.setItem('fp_name','Анна');localStorage.setItem('fp_onboarded','1');localStorage.setItem('fp_balance','1000');localStorage.setItem('fp_local_tx','[]');localStorage.setItem('fp_motion','0');localStorage.setItem('fp_visual_style','growth');localStorage.setItem('fp_theme','light');
    const now=new Date(),d=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`,dmy=d.split('-').reverse().join('.');
    window.__text=text||`ООО Магнит\n${dmy} 12:01\nМолоко 120.50\nИТОГ 120.50`;
    window.Tesseract={createWorker:async()=>({terminate:async()=>{},recognize:()=>defer?new Promise(resolve=>window.__resolveOcr=()=>resolve({data:{text:window.__text,confidence}})):Promise.resolve({data:{text:window.__text,confidence}})})};
    if(qr)window.jsQR=()=>({data:`t=${d.replaceAll('-','')}T1201&s=120.50&fn=1234567890123456&i=123&fp=456&n=1`});
  },{qr,confidence,text,defer});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexCapture&&!!window.FINTEX_SIM?.ui);await page.evaluate(()=>dismissReturningSplash());
  await expect(page.locator('#capture-fab')).toBeVisible();
  await page.locator('#capture-fab').click();
}
async function upload(page,mode='receipt',name='receipt.png'){await page.locator('#capture-file-'+mode).setInputFiles({name,mimeType:'image/png',buffer:png});}
test('Capture menu has four choices, green in every palette, and stays inside home screen',async({page})=>{
  await open(page);
  for(const name of ['Сфотографировать','Выбрать скриншот','Загрузить чек','Распознать операцию'])await expect(page.getByRole('button',{name,exact:false})).toBeVisible();
  await expect(page.locator('#capture-file-camera')).toHaveAttribute('capture','environment');
  await expect(page.locator('#capture-file-receipt')).toHaveAttribute('accept','image/*,application/pdf');
  await expect(page.locator('#capture-dialog')).toBeVisible();
  await page.keyboard.press('Escape');await expect(page.locator('#capture-dialog')).not.toBeVisible();
  for(const style of ['forest','sapphire','growth']){
    await page.evaluate(style=>setVisualStyle(style),style);await expect(page.locator('#capture-fab')).toHaveCSS('background-color','rgb(34, 98, 60)');
  }
  await page.locator('[data-nav="calendar"]').click();await expect(page.locator('#capture-fab')).toBeHidden();
  await page.locator('[data-nav="home"]').click();await expect(page.locator('#capture-fab')).toBeVisible();
  await page.locator('#hdr-plus-btn').click();await expect(page.locator('#capture-fab')).toBeHidden();
});
test('corroborated receipt saves once; repeat image does not change balance again',async({page})=>{
  await open(page,{qr:true});await upload(page);
  await expect(page.locator('#capture-done-title')).toHaveText('Чек записан автоматически');
  expect(await page.evaluate(()=>state.balance)).toBe(879.5);expect(await page.evaluate(()=>state.transactions.length)).toBe(1);
  await page.locator('[data-capture-again]').first().click();await upload(page,'receipt','renamed.png');
  await expect(page.locator('#capture-done-title')).toHaveText('Уже учтено');
  expect(await page.evaluate(()=>state.balance)).toBe(879.5);expect(await page.evaluate(()=>state.transactions.length)).toBe(1);
});
test('unmatched or low-confidence receipt waits for editable confirmation; autosave can be disabled',async({page})=>{
  await open(page,{qr:true,confidence:50});await upload(page);
  await expect(page.locator('#capture-form')).toBeVisible();expect(await page.evaluate(()=>state.transactions.length)).toBe(0);
  await page.locator('#capture-amount').fill('130,25');await page.locator('#capture-save').click();
  await expect(page.locator('#capture-done-title')).toHaveText('Операция записана');expect(await page.evaluate(()=>state.balance)).toBe(869.75);
});
test('cancelled OCR never writes a late result',async({page})=>{
  await open(page,{qr:true,defer:true});await upload(page);await page.waitForFunction(()=>!!window.__resolveOcr);
  await page.getByRole('button',{name:'Отменить',exact:true}).click();await page.evaluate(()=>window.__resolveOcr());
  await expect(page.locator('#capture-dialog')).not.toBeVisible();expect(await page.evaluate(()=>state.transactions.length)).toBe(0);expect(await page.evaluate(()=>state.balance)).toBe(1000);
});
test('bank screenshot is reviewed, bank is not inferred from settings and account balance is not applied',async({page})=>{
  await open(page,{text:'Покупка 120,50 RUB Магнит 24.11.2026 12:01\nБаланс 99999,00 RUB'});await upload(page,'operation');
  await expect(page.locator('#capture-form')).toBeVisible();await expect(page.locator('#capture-bank')).toHaveValue('');
  await page.locator('#capture-date').fill(await page.evaluate(()=>TODAY));await page.locator('#capture-save').click();
  expect(await page.evaluate(()=>state.balance)).toBe(879.5);
});
test('missing OCR, invalid files and multi-page PDFs produce recoverable errors without writes',async({page})=>{
  await open(page);await page.evaluate(()=>{delete window.Tesseract;});await upload(page);
  await expect(page.locator('#capture-error-text')).toContainText('Движок распознавания');expect(await page.evaluate(()=>state.transactions.length)).toBe(0);
  await page.getByRole('button',{name:'Выбрать другое изображение'}).click();
  await page.locator('#capture-file-receipt').setInputFiles({name:'bad.txt',mimeType:'text/plain',buffer:Buffer.from('x')});
  await expect(page.locator('#capture-error-text')).toContainText('Поддерживаются изображения');
});
test('capture menu fits 320px in both modes and preview',async({page})=>{
  await open(page);await page.setViewportSize({width:320,height:700});
  for(const mode of ['light','dark']){
    await page.evaluate(mode=>setTheme(mode),mode);
    expect(await page.locator('#capture-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  }
  await page.setViewportSize({width:390,height:844});await page.evaluate(()=>setTheme('light'));
  await expect(page.locator('#capture-dialog')).toHaveCSS('background-color','rgb(250, 245, 237)');
  await page.screenshot({path:'docs/capture-menu-preview.png'});
});

test('autosave preference can be disabled and persists without changing records',async({page})=>{
  await open(page,{qr:true});await page.locator('#capture-auto').uncheck();
  await upload(page);await expect(page.locator('#capture-form')).toBeVisible();
  expect(await page.evaluate(()=>state.transactions.length)).toBe(0);
  await page.getByRole('button',{name:'Закрыть Capture'}).click();await page.locator('#capture-fab').click();await expect(page.locator('#capture-auto')).not.toBeChecked();
});

function pdf(pages=1){
  const stream='BT /F1 22 Tf 30 350 Td (OOO MAGNIT) Tj 0 -35 Td (24.11.2026 12:01) Tj 0 -35 Td (Milk 120.50) Tj ET';
  const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Kids [${Array.from({length:pages},(_,i)=>`${3+i} 0 R`).join(' ')}] /Count ${pages} >>`];
  for(let i=0;i<pages;i++)objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 500 450] /Resources << /Font << /F1 ${3+pages} 0 R >> >> /Contents ${4+pages} 0 R >>`);
  objects.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  let data='%PDF-1.4\n',offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(data));data+=`${i+1} 0 obj\n${obj}\nendobj\n`;});const xref=Buffer.byteLength(data);data+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(data);
}
test('real local PDF reader extracts a one-page receipt and rejects multiple pages',async({page})=>{
  await open(page);
  await page.locator('#capture-file-receipt').setInputFiles({name:'receipt.pdf',mimeType:'application/pdf',buffer:pdf()});
  await expect(page.locator('#capture-form')).toBeVisible();await expect(page.locator('#capture-amount')).toHaveValue('120.5');await expect(page.locator('#capture-confidence')).toContainText('PDF');
  expect(await page.evaluate(()=>state.transactions.length)).toBe(0);
  await page.getByRole('button',{name:'Закрыть Capture'}).click();await page.locator('#capture-fab').click();
  await page.locator('#capture-file-receipt').setInputFiles({name:'two.pdf',mimeType:'application/pdf',buffer:pdf(2)});
  await expect(page.locator('#capture-error-text')).toContainText('одной странице PDF');expect(await page.evaluate(()=>state.balance)).toBe(1000);
});

test('real local OCR reads a generated bank notification without external hosts',async({page})=>{
  test.setTimeout(120000);
  const hosts=[];
  await page.route('**/*',route=>{const host=new URL(route.request().url()).hostname;hosts.push(host);return ['localhost','127.0.0.1'].includes(host)?route.continue():route.abort();});
  await page.addInitScript(()=>{localStorage.setItem('fp_name','Анна');localStorage.setItem('fp_onboarded','1');localStorage.setItem('fp_motion','0');localStorage.setItem('fp_balance','1000');});
  await page.goto('/');await page.waitForFunction(()=>!!window.FintexCapture);await page.evaluate(()=>dismissReturningSplash());
  const image=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=650;const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,1000,650);ctx.fillStyle='black';ctx.font='44px Arial';['Т-Банк','Покупка 120,50 RUB','Магнит',TODAY.split('-').reverse().join('.')+' 12:01','Баланс 9999,00 RUB'].forEach((text,i)=>ctx.fillText(text,50,85+i*100));return canvas.toDataURL('image/png').split(',')[1];});
  await page.locator('#capture-fab').click();await page.locator('#capture-file-operation').setInputFiles({name:'bank.png',mimeType:'image/png',buffer:Buffer.from(image,'base64')});
  await expect(page.locator('#capture-form')).toBeVisible({timeout:100000});
  await expect(page.locator('#capture-amount')).toHaveValue('120.5');expect(await page.evaluate(()=>state.transactions.length)).toBe(0);
  expect(hosts.filter(h=>!['localhost','127.0.0.1','telegram.org','cdnjs.cloudflare.com'].includes(h))).toEqual([]);
});
