const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),crypto=require('node:crypto');
const B=require('../brand-catalog.js'),sources=require('../assets/brands/SOURCES.json');
test('all catalog entries have real bundled SVGs with pinned provenance and verified hashes',()=>{
 assert.equal(B.count,164);assert.equal(new Set(B.entries.map(e=>e.id)).size,B.count);assert.equal(sources.length,B.count);
 for(const entry of B.entries){assert.ok(Object.isFrozen(entry));assert.equal(B.match(entry.name,entry.kind)?.id,entry.id);const source=sources.find(s=>s.id===entry.id),bytes=fs.readFileSync('assets/brands/'+entry.id+'.svg'),svg=bytes.toString();assert.ok(source.source.startsWith('https://github.com/'));assert.ok(source.revision);assert.ok(source.license);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),source.sha256);assert.match(svg,/<svg\b/);assert.match(svg,/viewBox=/);assert.doesNotMatch(svg,/<(?:script|image|foreignObject|iframe|text)\b|<!ENTITY|<!DOCTYPE|\bon\w+\s*=|(?:href|src)\s*=\s*["'](?!#)/i);}
});
test('Cyrillic/transliterated names and terminal separators match the actual brand',()=>{
 for(const [input,name]of [['ПЯТЁРОЧКА №123','Пятёрочка'],['оплата PYATEROCHKA 123','Пятёрочка'],['WILDBERRIES*MOSCOW','Wildberries'],['Сбербанк','Сбер'],['TINKOFF','Т-Банк'],['ALFA-BANK','Альфа-Банк'],['М.Видео','М.Видео'],['АЗС ЛУКОЙЛ 123','Лукойл'],['Рестораны McDonald\'s','McDonald\'s'],['H&M','H&M'],['ZABKA WARSZAWA','Żabka'],['Visa','Visa'],['МИР','Мир']])assert.equal(B.match(input)?.name,name,input);
});
test('specific banks/payments win over parent shops and networks are never inferred from issuers',()=>{
 assert.equal(B.match('Ozon Банк').kind,'bank');assert.equal(B.match('Ozon Банк','merchant'),null);assert.equal(B.match('Ozon','merchant').name,'Ozon');assert.equal(B.match('Ozon','bank'),null);assert.equal(B.match('МТС Банк','bank').name,'МТС Банк');assert.equal(B.match('Т-Банк','payment'),null);assert.equal(B.match('Google Pay').name,'Google Pay');assert.equal(B.match('АльфаСтрахование').kind,'service');
});
test('unknown/generic names and substrings do not receive fabricated company marks',()=>{
 for(const input of ['кофе','такси','аптека','АЗС','Продукты','магазин у дома','мир природы','альфавит','лента для упаковки','магнитный держатель','microspotifyx','admin','http://evil.test/<img onerror=x>'])assert.equal(B.match(input),null,input);
 assert.equal(B.badge('<img src=x onerror=alert(1)>'),'');assert.ok(!B.badge('Visa').includes('http'));assert.ok(!B.badge('Visa').includes('onerror'));assert.equal(B.badge('Т-Банк','payment'),'');
});
test('catalog code is display-only and logos form part of the offline shell',()=>{
 const code=fs.readFileSync('brand-catalog.js','utf8');assert.doesNotMatch(code,/fetch\(|XMLHttpRequest|localStorage|sessionStorage|state\.|\.transactions/);
 const vm=require('node:vm'),sandbox={self:{}};vm.runInNewContext(fs.readFileSync('offline-assets.js','utf8'),sandbox);const core=sandbox.self.FINTEX_OFFLINE.core;for(const entry of B.entries)assert.ok(core.includes('assets/brands/'+entry.id+'.svg'));for(const file of ['brand-catalog.js','brand-ui.js','brand-logos.css'])assert.ok(core.includes(file));
});
