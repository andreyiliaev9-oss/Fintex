const {test}=require('node:test'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const B=require('../backup-model.js'),M=require('../finance-math.js'),{createStudyBackup}=require('../scripts/create-study-backup.cjs');
test('research seed is deterministic, schema-valid and credential-free with a genuine checksum',()=>{
 const f=createStudyBackup('2026-11-24');assert.deepEqual(f,createStudyBackup('2026-11-24'));assert.equal(B.parse(JSON.stringify(f),'2026-11-24').data.balance,8750.25);assert.equal(crypto.createHash('sha256').update(B.payload(f)).digest('hex'),f.sha256);assert.equal(f.cloudOwner,null);assert.doesNotMatch(JSON.stringify(f),/init_data|bot_token|auth_secret|api_token|https:\/\//i);assert.equal(f.data.transactions.length,4);assert.equal(M.add(1000,...f.data.transactions.map(t=>M.ledgerEffect(t))),8750.25);
});
test('research dates shift with session day including leap/month boundaries; impossible dates are rejected',()=>{
 const f=createStudyBackup('2028-03-01');assert.equal(f.data.transactions[0].date,'2028-02-29');assert.equal(f.data.bills[0].due_date,'2028-03-05');assert.equal(f.data.payday,'2028-03-11');for(const date of ['2026-02-30','bad','',undefined])assert.throws(()=>createStudyBackup(date));
});
