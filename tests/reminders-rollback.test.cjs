const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('rollback removes notification UI, runtime and authenticated reminder endpoints',()=>{
  const html=fs.readFileSync('index.html','utf8'),code=fs.readFileSync('backend/Code.gs','utf8');
  assert.ok(!/reminders\.js|settings-notifications|fintex-reminders|reminder-form/.test(html));
  assert.ok(!/reminders_(get|save|context)|sendFintexReminders/.test(code));
  assert.ok(!fs.existsSync('reminders.js'));assert.ok(!fs.existsSync('backend/Reminders.gs'));
  assert.ok(html.includes('capture.js'));assert.ok(html.includes('behavior.js'));
});
test('downloaded recovery server is the password-free revisioned v8 and matches its source modules',()=>{
  const txt=fs.readFileSync('downloads/Fintex-Code.txt','utf8');assert.equal(txt,fs.readFileSync('downloads/Fintex-Code.gs','utf8'));
  for(const file of ['Auth.gs','Code.gs','QuickCapture.gs','Places.gs'])assert.ok(txt.includes(fs.readFileSync('backend/'+file,'utf8')));
  assert.ok(txt.includes('FINTEX v8'));assert.ok(!/sendFintexReminders|requestWriteAccess|REMINDER_COLUMNS/.test(txt));
});
