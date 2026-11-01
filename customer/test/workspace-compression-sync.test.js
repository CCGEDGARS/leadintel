const test=require('node:test'),assert=require('node:assert/strict'),B=require('../state-budget.js');
const uniqueWorkspace=require('./helpers/workspace-distinct-capacity.js');
test('distinct research records compress losslessly even when reference sharing cannot fit',()=>{
 const input=uniqueWorkspace();assert.throws(()=>B.prepareForSync(input,{allowBundlePacking:true}),/Compression permitted: false; candidate: unavailable/);
 const result=B.prepareForSync(input,{allowBundlePacking:true,allowCompressionPacking:true});assert.ok(result.bytes<=B.MAX_SYNC_BYTES);assert.equal(result.payload.main.encoding,'lzw16-refs-base64-v2');assert.deepEqual(B.restoreFromSync(result.payload),input);
 const wire=JSON.parse(JSON.stringify(result.payload));wire.meta.persistence.explicit_saved=false;assert.deepEqual(B.restoreFromSync(wire),{...input,meta:{...input.meta,persistence:{explicit_saved:false}}});
 assert.deepEqual(B.prepareForSync(result.payload,{allowCompressionPacking:true}).payload,result.payload);
});
test('compressed state rejects malformed encoding, codes and decompression bombs',()=>{
 const wire=B.prepareForSync(uniqueWorkspace(),{allowCompressionPacking:true}).payload;
 for(const data of ['!','AAAA','//8='])assert.throws(()=>B.restoreFromSync({...wire,main:{...wire.main,data}}),/Invalid|safe restore limit/);
 assert.throws(()=>B.restoreFromSync({...wire,main:{...wire.main,encoding:'unknown'}}),/Invalid/);
 const codes=[123,...Array.from({length:12000},(_,i)=>256+i)],raw=Buffer.from(codes.flatMap(code=>[code>>>8,code&255]));
 assert.throws(()=>B.restoreFromSync({...wire,main:{...wire.main,data:raw.toString('base64')}}),/safe restore limit/);
});


test('byte compression round-trips after its dictionary freezes',()=>{
 let seed=42;let text='';for(let i=0;i<180000;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;text+=String.fromCharCode(65+(seed>>>16)%26);}
 const input={main:{notes:text+text},meta:{persistence:{explicit_saved:true}}},wire=B.prepareForSync(input,{allowCompressionPacking:true}).payload;assert.equal(wire.main.encoding,'lzw16-refs-base64-v2');assert.deepEqual(B.restoreFromSync(wire),input);
});

test('compression retains reference sharing instead of expanding high-entropy evidence copies',()=>{
 const input=require('./helpers/workspace-shared-compression.js')();assert.throws(()=>B.prepareForSync(input,{allowBundlePacking:true}),/500 KB sync limit/);
 const wire=B.prepareForSync(input,{allowBundlePacking:true,allowCompressionPacking:true});assert.ok(wire.bytes<=B.MAX_SYNC_BYTES);assert.deepEqual(B.restoreFromSync(wire.payload),input);assert.deepEqual(B.prepareForSync(wire.payload,{allowCompressionPacking:true}).payload,wire.payload);
});

test('previous compressed workspaces remain readable',()=>{const wire=require('./fixtures/workspace-compression-v1.json');assert.equal(wire.main.encoding,'lzw16-base64-v1');assert.deepEqual(B.restoreFromSync(wire),{main:{notes:'Legacy record preserved. '.repeat(1000)},meta:{persistence:{explicit_saved:true}}});});
