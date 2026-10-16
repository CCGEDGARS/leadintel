import test from 'node:test';
import assert from 'node:assert/strict';
import {coreScriptSeeds} from '../src/core-script-seeds.js';
import {coreScripts} from '../src/script-library-routes.js';
import {createRequire} from 'node:module';
const A=createRequire(import.meta.url)('../../customer/approved-reference-scripts.js');

const fixtures={
 professional:'We would like to be considered as a bidder',
 curiosity:'Many project teams simply like to have one more qualified option',
 friendly:'Congratulations on getting the foundation work started',
 brutal:'I wrote the introduction. The conversation would be with a real human.'
};
test('four protected email sources use October 15 approved masters',()=>{
 const rows=coreScriptSeeds.filter(row=>row.channel==='email');
 assert.equal(rows.length,4);
 for(const row of rows){
  assert.equal(row.masterVersion,'20261015-v2');
  assert.ok(row.original.includes(fixtures[row.style]),row.style);
  assert.ok(row.body.includes({professional:'We would like to be considered as a bidder',curiosity:'Many project teams simply like to have one more qualified option',friendly:'we would be happy to assist',brutal:'I wrote the introduction. The conversation would be with a real human.'}[row.style]),row.style);
  assert.match(row.body,/{{firstName}}/);
  assert.match(row.body,/{{calendly}}/);
  assert.equal(row.builtin,true);
  assert.equal(row.original,A.originalText(row.style));
  assert.equal(row.body,A.approvedPattern(row.style));
 }
});
test('flattened October 15 imports migrate with history while tombstones stay deleted',async()=>{
 const seed=coreScriptSeeds.find(r=>r.id==='email:brutal');
 for(const deleted of [false,true]){
  const old={...seed,body:seed.previousBuiltinBodies[0],masterVersion:'20261015',deleted};
  const db={prepare(){return {all:async()=>({results:[{id:seed.id,payload_json:JSON.stringify(old),revision:2}]})};}};
  const item=(await coreScripts(db)).find(r=>r.id===seed.id);
  if(deleted)assert.equal(item.deleted,true);
  else {assert.equal(item.body,seed.body);assert.equal(item.builtin,true);assert.ok(item.history.some(h=>h.body===old.body));}
 }
});
test('legacy protected database copies cannot override newly approved masters',async()=>{
 const db={prepare(){return {all:async()=>({results:[{id:'email:professional',payload_json:JSON.stringify({channel:'email',style:'professional',name:'Old master',body:'Old email message',subject:'Old subject',history:[]}),revision:3}]})};}};
 const rows=await coreScripts(db);
 const item=rows.find(x=>x.id==='email:professional');
 assert.ok(item.body.includes(fixtures.professional));
 assert.equal(item.revision,3);
 assert.ok(item.history.some(h=>h.body==='Old email message'));
});
test('an owner-edited new-version master can remain primary',async()=>{
 const db={prepare(){return {all:async()=>({results:[{id:'email:friendly',payload_json:JSON.stringify({channel:'email',style:'friendly',name:'Owner updated',body:'Approved revision',subject:'Owner subject',masterVersion:'20261015'}),revision:4}]})};}};
 const item=(await coreScripts(db)).find(x=>x.id==='email:friendly');
 assert.equal(item.body,'Approved revision');
 assert.equal(item.revision,4);
});
