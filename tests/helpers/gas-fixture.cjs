const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),vm=require('node:vm');
const SECRET='ab'.repeat(32),BOT='123456:example-server-only-bot-token',UID='8141670312';
function fixture(){
  let now=Date.UTC(2026,10,24,12),deliver=true;
  class Clock extends Date {constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}}
  const sheets=new Map(),props=new Map([['FINTEX_BOT_TOKEN',BOT],['FINTEX_AUTH_SECRET',SECRET],['FINTEX_SS_ID','test-db']]),messages=[];
  function sheet(){
    const data=[];
    return {data,appendRow(row){data.push([...row]);},setFrozenRows(){},getLastRow(){return data.length;},getDataRange(){return {getValues:()=>data.map(r=>[...r])};},getRange(row,col,rows=1,cols=1){return {setValue(value){while(data.length<row)data.push([]);data[row-1][col-1]=value;},setValues(values){for(let i=0;i<rows;i++){while(data.length<row+i)data.push([]);for(let j=0;j<cols;j++)data[row+i-1][col+j-1]=values[i][j];}}};}};
  }
  const ss={getSheetByName:name=>sheets.get(name)||null,insertSheet(name){const s=sheet();sheets.set(name,s);return s;}};
  const buffer=value=>typeof value==='string'?Buffer.from(value):Buffer.from(value.map?Array.from(value,x=>(x+256)%256):value);
  const signed=buf=>Array.from(buf,x=>x>127?x-256:x);
  let held=false;
  const ctx={Date:Clock,console,PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key)||null,setProperty:(key,value)=>props.set(key,value)})},
    SpreadsheetApp:{getActiveSpreadsheet:()=>ss,openById:()=>ss},Session:{getScriptTimeZone:()=> 'UTC'},
    LockService:{getScriptLock:()=>({tryLock(){held=true;return true;},waitLock(){held=true;},hasLock:()=>held,releaseLock(){held=false;}})},
    Utilities:{getUuid:()=>crypto.randomUUID(),DigestAlgorithm:{SHA_256:'sha256'},
      newBlob:value=>({getBytes:()=>signed(buffer(value)),getDataAsString:()=>buffer(value).toString('utf8')}),
      computeHmacSha256Signature:(value,key)=>signed(crypto.createHmac('sha256',buffer(key)).update(buffer(value)).digest()),
      computeDigest:(alg,value)=>signed(crypto.createHash('sha256').update(buffer(value)).digest()),
      base64EncodeWebSafe:value=>buffer(value).toString('base64url'),base64DecodeWebSafe:value=>signed(Buffer.from(value,'base64url')),
      formatDate(date,tz,format){const iso=new Date(date).toISOString();return format==='HH:mm'?iso.slice(11,16):iso.slice(0,10);}},
    ContentService:{MimeType:{JSON:'json'},createTextOutput:text=>({setMimeType:()=>text})},
    UrlFetchApp:{fetch(url,options){assert.match(url,/^https:\/\/api.telegram.org\/bot/);assert.equal(held,true);messages.push(JSON.parse(options.payload));return {getResponseCode:()=>deliver?200:403,getContentText:()=>JSON.stringify({ok:deliver})};}}
  };
  vm.createContext(ctx);for(const file of ['backend/Code.gs','backend/Auth.gs','backend/QuickCapture.gs','backend/Places.gs'])vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
  function initData(uid=UID,more={}){
    const fields={auth_date:String(Math.floor(now/1000)),user:JSON.stringify({id:Number(uid),first_name:'Тест'}),...more};
    const check=Object.keys(fields).sort().map(k=>k+'='+fields[k]).join('\n');
    const secret=crypto.createHmac('sha256','WebAppData').update(BOT).digest();
    fields.hash=crypto.createHmac('sha256',secret).update(check).digest('hex');return new URLSearchParams(fields).toString();
  }
  function post(body){const result=JSON.parse(ctx.doPost({postData:{contents:JSON.stringify(body)}}));assert.equal(held,false);return result;}
  function auth(action,fields={}){return post({action,init_data:initData(),...fields});}
  function setup(){const result=auth('init');assert.equal(result.ok,true,JSON.stringify(result));return result;}
  return {ctx,post,auth,setup,initData,sheets,props,messages,tick:ms=>{now+=ms;},failDelivery:()=>{deliver=false;}};
}

module.exports={fixture};
