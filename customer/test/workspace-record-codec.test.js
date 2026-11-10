const test=require('node:test'),assert=require('node:assert/strict'),budget=require('../state-budget.js');
test('a record workspace over the hosting proxy limit is transferred losslessly below it',()=>{
 const payload={main:{market:{researchResults:[{url:'https://buyer.example/news',text:'New production line and recruitment. '.repeat(14000)}]}},discovery:{retainedEvidence:'Source-backed industrial evidence. '.repeat(140000)},outreach:{approvedDraft:'Keep this exact manual draft. €'},delivery:{},meta:{}};
 const original=JSON.stringify(payload);assert.ok(Buffer.byteLength(original)>4500000);assert.ok(Buffer.byteLength(original)<8*1024*1024);
 const result=budget.prepareForSync(payload,{maxSyncBytes:8*1024*1024,allowCompressionPacking:true});
 assert.ok(result.bytes<4*1024*1024,'the request must fit the first-party hosting proxy, not just the backend allowance');
 assert.equal(JSON.stringify(budget.restoreFromSync(result.payload)),original,'compression must preserve every quote and the approved draft');assert.equal(JSON.stringify(payload),original);
});
test('record transport rejects oversized uncompressible transfers before a network request without trimming data',()=>{
 const payload={discovery:{notes:require('node:crypto').randomBytes(3300000).toString('base64')}};
 const original=JSON.stringify(payload);assert.ok(Buffer.byteLength(original)>4*1024*1024);
 assert.throws(()=>budget.prepareForSync(payload,{maxSyncBytes:8*1024*1024,allowCompressionPacking:true}),/4 MB transfer limit/);assert.equal(JSON.stringify(payload),original);
});
test('record transport without compression support preserves a bounded payload and rejects an oversized one',()=>{
 const payload={main:{notes:'Exact uncompressed text. '.repeat(30000)}};
 assert.deepEqual(budget.prepareForSync(payload,{maxSyncBytes:8*1024*1024}).payload,payload);
 assert.throws(()=>budget.prepareForSync({main:{notes:'x'.repeat(4300000)}},{maxSyncBytes:8*1024*1024}),/4 MB transfer limit/);
});
test('record-capable server accepts complete research beyond the legacy workspace ceiling without truncating evidence',()=>{
 const payload={main:{scrapedSources:[{url:'https://seller.test',text:'Official evidence. '.repeat(40000)}]},discovery:{notes:require('node:crypto').randomBytes(420000).toString('base64')},outreach:{approved:'Preserve this'},meta:{}};
 const result=budget.prepareForSync(payload,{maxSyncBytes:8*1024*1024,allowCompressionPacking:true});
 assert.deepEqual(budget.restoreFromSync(result.payload),payload);
 assert.ok(result.bytes>500*1024);assert.ok(result.bytes<8*1024*1024);
});
test('unnegotiated clients retain their bounded legacy transport',()=>{
 assert.throws(()=>budget.prepareForSync({discovery:{notes:'x'.repeat(600000)}}),/500 KB/);
});
test('record transport compresses expanded research above the envelope without trimming official evidence',()=>{
 const text=require('node:crypto').randomBytes(350000).toString('base64').repeat(5),sources=[{url:'https://official.test/about',text}];
 const payload={main:{scrapedSources:sources},discovery:{sources},outreach:{sources},delivery:{sources},meta:{}};
 assert.ok(budget.bytes(payload)>8*1024*1024);
 const result=budget.prepareForSync(payload,{maxSyncBytes:8*1024*1024,allowBundlePacking:true,allowCompressionPacking:true});
 const restored=budget.restoreFromSync(result.payload);assert.equal(restored.main.scrapedSources[0].text.length,text.length);assert.equal(restored.discovery.sources[0].text.length,text.length);
});
