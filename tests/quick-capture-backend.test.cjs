const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {fixture}=require('./helpers/gas-fixture.cjs');
function setup(){const f=fixture();f.setup();const pair=f.auth('quick_capture_pair');assert.equal(pair.ok,true);const send=(fields={})=>f.post({action:'quick_capture_submit',uid:pair.uid,token:pair.token,capture_id:'a'.repeat(64),confirmed:true,transaction:{date:'2026-11-24',amount:100.25,type:'expense',currency:'RUB',merchant:'Кофе',category:'cafe'},...fields});return {f,pair,send};}
test('capture credentials are hashed, separate from old automation, rotated/revoked and cannot read the account',()=>{
 const {f,pair,send}=setup();assert.match(pair.token,/^[a-f0-9]{64}$/);assert.ok(!f.props.get('FINTEX_QC_'+pair.uid).includes(pair.token));assert.equal(f.auth('quick_capture_status').paired,true);assert.equal(f.auth('quick_capture_status').token,undefined);assert.notEqual(f.setup().webhook_token,pair.token);
 assert.equal(f.post({action:'init',uid:pair.uid,token:pair.token}).ok,false);assert.equal(f.post({action:'quick_capture_pair',uid:pair.uid,token:pair.token}).ok,false);assert.equal(send({uid:'999'}).code,'QC_UNAUTHORIZED');f.auth('quick_capture_pair');assert.equal(send().code,'QC_UNAUTHORIZED');f.auth('quick_capture_revoke');assert.equal(f.auth('quick_capture_status').paired,false);
});
test('capture is one durable ledger commit, preserves kopecks, returns no account data and retries exactly once',()=>{
 const {f,send}=setup();const r=send();assert.equal(r.status,'saved');assert.equal(r.balance,undefined);assert.equal(r.transaction,undefined);assert.equal(f.sheets.get('Transactions').data.length,1);assert.equal(f.sheets.get('LedgerEvents').data.length,2);assert.equal(f.auth('init').user.balance,-100.25);assert.equal(send().status,'duplicate');assert.equal(f.auth('init').user.balance,-100.25);assert.equal(f.sheets.get('LedgerEvents').data.length,2);
 const other=send({capture_id:'b'.repeat(64),transaction:{date:'2026-11-24',amount:.15,type:'income',currency:'RUB',merchant:'Возврат',category:'other'}});assert.equal(other.status,'saved');assert.equal(f.auth('init').user.balance,-100.1);
});
test('retry after edit/delete never replays a capture; changed fields with same screenshot are rejected',()=>{
 const {f,send}=setup(),r=send();const records=f.auth('ledger_sync',{mutations:[]}).records;const tx=records.find(x=>x.id===r.transaction_id).tx;
 f.auth('ledger_sync',{mutations:[{id:'delete',txId:tx.id,baseRevision:1,tx:null}]});assert.equal(f.auth('init').user.balance,0);assert.equal(send().status,'duplicate');assert.equal(f.auth('init').transactions.length,0);
 assert.equal(send({transaction:{...tx,amount:50,currency:'RUB'}}).code,'QC_ID_REUSED');assert.equal(f.auth('init').user.balance,0);
});
test('whole capture validation happens before any financial writes',()=>{
 const {f,send}=setup();for(const fields of [{confirmed:false},{capture_id:'bad'},{transaction:{date:'2026-11-24',amount:.001,type:'expense',currency:'RUB',merchant:'A',category:'other'}},{transaction:{date:'2026-11-25',amount:1,type:'expense',currency:'RUB',merchant:'A',category:'other'}},{transaction:{date:'2026-11-24',amount:1,type:'transfer',currency:'RUB',merchant:'A',category:'other'}},{transaction:{date:'2026-11-24',amount:1,type:'expense',currency:'USD',merchant:'A',category:'other'}}])assert.equal(send(fields).ok,false);
 assert.equal(f.sheets.has('LedgerEvents'),false);assert.equal(f.auth('init').user.balance,0);
});
test('on-device OCR text preview requires later confirmation, does not write or log text, and rejects own transfers/foreign currency',()=>{
 const {f,pair}=setup(),preview=text=>f.post({action:'quick_capture_parse',uid:pair.uid,token:pair.token,text});
 const r=preview('Покупка 100,25 RUB Кофе 12:01');assert.equal(r.candidate.amount,100.25);assert.equal(r.requires_confirmation,true);assert.equal(r.saved,false);assert.equal(f.sheets.has('LedgerEvents'),false);assert.equal(f.sheets.get('Logs').data.length,1);assert.equal(preview('Покупка 25 USD').code,'QC_CURRENCY');assert.equal(preview('Перевод между своими счетами 100 RUB').code,'QC_OWN_TRANSFER');assert.equal(preview('Текст без суммы').candidate,null);
});
test('only an owner-configured real iCloud URL is returned; no invented installer and combined download contains capture code',()=>{
 const {f}=setup();assert.equal(f.auth('quick_capture_status').shortcut_url,'');for(const url of ['javascript:alert(1)','https://evil.test/shortcuts/'+'a'.repeat(32),'https://www.icloud.com/shortcuts/'+'a'.repeat(32)+'?token=bad']){f.props.set('FINTEX_QC_SHORTCUT_URL',url);assert.equal(f.auth('quick_capture_status').shortcut_url,'');}const url='https://www.icloud.com/shortcuts/'+'a'.repeat(32);f.props.set('FINTEX_QC_SHORTCUT_URL',url);assert.equal(f.auth('quick_capture_status').shortcut_url,url);
 const bundle=fs.readFileSync('downloads/Fintex-Code.gs','utf8');assert.ok(bundle.includes(fs.readFileSync('backend/QuickCapture.gs','utf8')));assert.equal(bundle,fs.readFileSync('downloads/Fintex-Code.txt','utf8'));
});
test('daily limit is checked before a new financial commit but safe retries remain available',()=>{
 const {f,pair,send}=setup();assert.equal(send().status,'saved');const key='FINTEX_QC_'+pair.uid,record=JSON.parse(f.props.get(key));record.day='2026-11-24';record.used=300;f.props.set(key,JSON.stringify(record));assert.equal(send().status,'duplicate');assert.equal(send({capture_id:'c'.repeat(64)}).code,'QC_RATE_LIMIT');assert.equal(f.auth('init').user.balance,-100.25);f.tick(86400000);assert.equal(send({capture_id:'c'.repeat(64)}).status,'saved');
});
test('Quick Capture setup assets are included in the prepared offline app',()=>{
 const vm=require('node:vm'),sandbox={self:{}};vm.runInNewContext(fs.readFileSync('offline-assets.js','utf8'),sandbox);for(const path of ['quick-capture.js','quick-capture.css'])assert.ok(sandbox.self.FINTEX_OFFLINE.core.includes(path));
});
