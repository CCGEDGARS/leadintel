const test=require('node:test'),assert=require('node:assert/strict'),B=require('../state-budget.js');
const fixture=require('./helpers/workspace-capacity.js');

test('combined research and message state fits through lossless sharing across sections',()=>{
 const input=fixture(),before=JSON.stringify(input);assert.throws(()=>B.prepareForSync(input,{allowBundlePacking:false}),/500 KB sync limit/);
 const result=B.prepareForSync(input,{allowBundlePacking:true});assert.ok(result.bytes<=B.MAX_SYNC_BYTES);assert.equal(result.payload.main.format,'leadintel-workspace-bundle-refs-v1');
 assert.deepEqual(B.restoreFromSync(JSON.parse(JSON.stringify(result.payload))),input);assert.equal(JSON.stringify(input),before);
 assert.deepEqual(B.prepareForSync(result.payload,{allowBundlePacking:true}).payload,result.payload);
});
test('explicit-save metadata survives the second save boundary without replacing recipient metadata',()=>{
 const input=fixture(),wire=B.prepareForSync(input,{allowBundlePacking:true}).payload;
 wire.meta={...wire.meta,persistence:{explicit_saved:false}};
 const repeated=B.prepareForSync(wire,{allowBundlePacking:true});const restored=B.restoreFromSync(repeated.payload);
 assert.deepEqual(restored,{...input,meta:{...input.meta,persistence:{explicit_saved:false}}});
});
test('bundle decoding rejects invalid references and ambiguous sibling sections',()=>{
 const wire=B.prepareForSync(fixture(),{allowBundlePacking:true}).payload;
 assert.throws(()=>B.restoreFromSync({...wire,discovery:{replaced:true}}),/Invalid stored workspace bundle/);
 assert.throws(()=>B.restoreFromSync({...wire,main:{...wire.main,value:[0,999999]}}),/Invalid stored discovery research references/);
 assert.throws(()=>B.restoreFromSync({...wire,meta:{discovery:{replaced:true}}}),/Invalid stored workspace bundle/);
});

test('bundle rejects malformed metadata, recursive references and oversized restored sections',()=>{
 const wire=B.prepareForSync(fixture(),{allowBundlePacking:true}).payload;
 assert.throws(()=>B.restoreFromSync({...wire,meta:[]}),/Invalid stored workspace bundle/);
 assert.throws(()=>B.restoreFromSync({...wire,main:{...wire.main,value:[0,0],values:[[0,0]]}}),/Invalid stored discovery research references/);
 const quote='x'.repeat(128*1024),rows=Array.from({length:70},()=>({quote}));
 const packed=B.prepareForSync({main:{rows},discovery:{rows}},{allowBundlePacking:true}).payload;
 assert.throws(()=>B.restoreFromSync(packed),/safe restore limit|Invalid stored workspace bundle/);
});
