const test=require('node:test'),assert=require('node:assert/strict'),budget=require('../state-budget.js');
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
