/* Bounded local receipt preparation. No network, storage or financial writes. */
(function(root){
 'use strict';
 function plan(width,height){
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width*height>25000000)throw Error('Выберите изображение до 25 Мп.');
  const scale=Math.min(Math.max(2,Math.min(6,1200/width)),1800/width,Math.sqrt(8000000/(width*height)));
  const w=Math.max(1,Math.round(width*scale)),h=Math.max(1,Math.floor(height*scale)),regions=[];
  if(h<=3600)return {width:w,height:h,regions:[{y:0,height:h}]};
  for(let y=0;y<h;y+=1600){regions.push({y,height:Math.min(1800,h-y)});if(y+1800>=h)break;}
  if(regions.length>8)throw Error('Чек слишком длинный. Разделите изображение на части или обрежьте пустые поля.');
  return {width:w,height:h,regions};
 }
 function join(parts){
  let lines=[];
  for(const text of parts){const next=String(text||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean);let overlap=0;
   const key=l=>l.replace(/\s+/g,' ').toLocaleLowerCase('ru');
   for(let n=1;n<=Math.min(20,lines.length,next.length);n++)if(lines.slice(-n).every((l,i)=>key(l)===key(next[i])))overlap=n;
   lines.push(...next.slice(overlap));
  }return lines.join('\n');
 }
 function isReceipt(text,qr){
  if(qr?.found)return true;
  const t=String(text||'').toUpperCase().replace(/[A-Z]/g,c=>({O:'О',T:'Т',C:'С',E:'Е',H:'Н',K:'К',M:'М',P:'Р',X:'Х'})[c]||c);
  const signals=[/КАССОВ|ФИСКАЛЬН|(?:^|[^А-ЯЁ])ЧЕК(?:А|Е|ОМ)?(?=$|[^А-ЯЁ])/m.test(t),/(?:^|[^А-ЯЁ])(?:ФН|ФД|ИНН|ККТ)(?=$|[^А-ЯЁ])/m.test(t),/ИТОГ|К\s*ОПЛАТЕ/.test(t),/НДС|БЕЗНАЛИЧ|НАЛИЧНЫ|ПРИХОД/.test(t)];
  return signals.filter(Boolean).length>=2;
 }
 function total(raw){
  const lines=String(raw||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean),candidates=[];
  function amount(value){
   const match=value.match(/^[\s*«»“”=:_~—–]*(\d[\d \u00a0\u202f]*(?:[.,]\s*\d{2})?)(?:\s*(?:₽|р\.?|руб\.?|RUB))?[\s*«»“”_~—–-]*$/i);
   if(!match)return null;
   const integer=match[1].split(/[.,]/)[0].trim();if(!/^\d+(?:[ \u00a0\u202f]\d{3})*$/.test(integer))return null;
   const n=Number(match[1].replace(/[ \u00a0\u202f]/g,'').replace(',','.'));return Number.isFinite(n)&&n>0&&n<=1e10?n:null;
  }
  for(let i=0;i<lines.length;i++){
   const label=lines[i].toUpperCase().replace(/[IOATCEHKMOPX]/g,c=>({I:'И',O:'О',A:'А',T:'Т',C:'С',E:'Е',H:'Н',K:'К',M:'М',P:'Р',X:'Х'})[c]);
   if(/НДС|НАЛОГ|СКИДК|СДАЧ|ПОЛУЧЕН|ПРЕДВАРИТ|ПОДЫТОГ/.test(label))continue;
   const heading=label.match(/^(И\s*Т\s*О\s*Г(?:\s*О)?(?:\s+К\s+ОПЛАТЕ)?|К\s*ОПЛАТЕ|ВСЕГО|СУММА(?:\s+ПО\s+ЧЕКУ|\s+РАСЧ[ЕЁ]ТА)?)(?=\s|[.,:=*]|$)/);
   if(!heading)continue;
   const rest=lines[i].slice(heading[0].length),numeric=rest.search(/\d/);
   if(/[-−]\s*\d/.test(rest))continue;
   let value=numeric>=0?amount(rest.slice(numeric)):null;
   // A heading may have OCR noise or decoration after it; only a directly
   // adjacent, otherwise money-only line is accepted. Never guess missing digits.
   if(value===null&&numeric<0&&i+1<lines.length)value=amount(lines[i+1]);
   if(value!==null)candidates.push({amount:value,rank:/^И|^К/.test(heading[0])?2:1});
  }
  const rank=Math.max(0,...candidates.map(c=>c.rank)),best=candidates.filter(c=>c.rank===rank),values=[...new Set(best.map(c=>c.amount))];
  return {amount:values.length===1?values[0]:null,ambiguous:values.length>1};
 }
 async function rotate(src,degrees){
  const img=await new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('Не удалось повернуть изображение.'));image.src=src;});
  const canvas=document.createElement('canvas');canvas.width=img.naturalHeight;canvas.height=img.naturalWidth;
  const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.translate(canvas.width/2,canvas.height/2);ctx.rotate(degrees*Math.PI/180);ctx.drawImage(img,-img.naturalWidth/2,-img.naturalHeight/2);const result=canvas.toDataURL('image/png');canvas.width=canvas.height=1;return result;
 }
 async function prepare(src){
  const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Не удалось открыть изображение.'));img.src=src;});
  const p=plan(image.naturalWidth,image.naturalHeight),canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='white';ctx.fillRect(0,0,p.width,p.height);ctx.drawImage(image,0,0,p.width,p.height);
  const raw=[],slices=[];let qrRaw='';
  const crop=(source,region)=>{const c=document.createElement('canvas');c.width=p.width;c.height=region.height;const x=c.getContext('2d',{willReadFrequently:true});x.fillStyle='white';x.fillRect(0,0,c.width,c.height);x.drawImage(source,0,region.y,c.width,c.height,0,0,c.width,c.height);return c;};
  // Search unmodified pixels: contrast processing can damage QR modules.
  for(const region of p.regions){
   const c=crop(canvas,region),x=c.getContext('2d',{willReadFrequently:true});raw.push(c.toDataURL('image/png'));
   if(!qrRaw&&root.jsQR){const data=x.getImageData(0,0,c.width,c.height),qr=root.jsQR(data.data,c.width,c.height,{inversionAttempts:'attemptBoth'});if(qr?.data)qrRaw=qr.data;}
   c.width=c.height=1;await new Promise(resolve=>setTimeout(resolve,0));
  }
  // Tile-local paper brightness compensates for uneven lighting without a hard
  // black/white threshold that would erase thin thermal-print strokes.
  const pixels=ctx.getImageData(0,0,p.width,p.height),d=pixels.data,size=64,cols=Math.ceil(p.width/size),rows=Math.ceil(p.height/size),paper=new Uint8Array(cols*rows),hist=new Uint32Array(256);
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const i=(y*p.width+x)*4,lum=Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2]),tile=Math.floor(y/size)*cols+Math.floor(x/size);paper[tile]=Math.max(paper[tile],lum);d[i]=d[i+1]=d[i+2]=lum;}
  for(let y=0;y<p.height;y++)for(let x=0;x<p.width;x++){const i=(y*p.width+x)*4,bg=Math.max(80,paper[Math.floor(y/size)*cols+Math.floor(x/size)]),lum=Math.min(255,Math.round(d[i]*255/bg));d[i]=d[i+1]=d[i+2]=lum;hist[lum]++;}
  let count=0,black=0;const cutoff=p.width*p.height*.004;for(let i=0;i<255;i++){count+=hist[i];if(count>=cutoff){black=Math.min(i,210);break;}}
  for(let i=0;i<d.length;i+=4){const lum=Math.max(0,Math.min(255,(d[i]-black)*255/Math.max(45,255-black)));d[i]=d[i+1]=d[i+2]=lum;d[i+3]=255;}ctx.putImageData(pixels,0,0);
  for(const region of p.regions){const c=crop(canvas,region);slices.push(c.toDataURL('image/png'));c.width=c.height=1;}
  canvas.width=canvas.height=1;
  return {slices,originalSlices:raw,qrRaw,width:p.width,height:p.height,enhancedUrl:src};
 }
 const api={plan,join,total,isReceipt,prepare,rotate};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.FintexReceiptVision=api;
})(typeof window==='undefined'?globalThis:window);
