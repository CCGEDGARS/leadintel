const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
const start=source.indexOf('const initialStage='),end=source.indexOf('function openDiscoveryFromHandoff',start);
test('saved Messages does not load before account and shared Discovery initialization',()=>{
 let read=0,mount=0,verified;
 const context={window:{LeadIntelAccountCache:{afterVerification(fn){verified=fn;}}},localStorage:{getItem(){read++;return '{"step":6}';}},ensureMessagesStageLoaded(){mount++;}};
 vm.runInNewContext(source.slice(start,end),context);
 assert.equal(read,0);assert.equal(mount,0);assert.equal(typeof verified,'function');
 verified();assert.equal(read,1);assert.equal(mount,1);
});
test('standalone Messages still restores and other stages stay lazy',()=>{
 for(const step of [1,4,6,7]){let mount=0;vm.runInNewContext(source.slice(start,end),{window:{},localStorage:{getItem:()=>JSON.stringify({step})},ensureMessagesStageLoaded(){mount++;}});assert.equal(mount,step===6?1:0);}
});
