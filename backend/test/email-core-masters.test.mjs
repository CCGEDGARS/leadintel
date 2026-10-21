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
  assert.equal(row.masterVersion,row.style==='professional'?'20261017-professional-v1':'20261015-v4');
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
test('unrecognized unversioned email wording remains an owner revision',async()=>{
 const db={prepare(){return {all:async()=>({results:[{id:'email:professional',payload_json:JSON.stringify({channel:'email',style:'professional',name:'Old master',body:'Old email message',subject:'Old subject',history:[]}),revision:3}]})};}};
 const rows=await coreScripts(db);
 const item=rows.find(x=>x.id==='email:professional');
 assert.equal(item.body,'Old email message');
 assert.equal(item.subject,'Old subject');
 assert.equal(item.builtin,false);
 assert.equal(item.revision,3);
 assert.deepEqual(item.history,[]);
});

test('explicit unversioned owner revisions never migrate even when their text matches an old builtin',async()=>{
 for(const seed of coreScriptSeeds.filter(row=>row.channel==='email')){
  const saved={...seed,body:seed.previousBuiltinBodies[0],builtin:false};delete saved.masterVersion;
  const db={prepare(){return {all:async()=>({results:[{id:seed.id,payload_json:JSON.stringify(saved),revision:7}]})};}};
  const item=(await coreScripts(db)).find(row=>row.id===seed.id);
  assert.equal(item.body,saved.body,seed.id);assert.equal(item.subject,saved.subject);assert.equal(item.revision,7);
 }
});

test('an owner-edited subject preserves a recognized old body for every email style',async()=>{
 for(const seed of coreScriptSeeds.filter(row=>row.channel==='email')){
  const saved={...seed,body:seed.previousBuiltinBodies[0],subject:'Owner approved subject',masterVersion:'20261015'};
  const db={prepare(){return {all:async()=>({results:[{id:seed.id,payload_json:JSON.stringify(saved),revision:4}]})};}};
  const item=(await coreScripts(db)).find(row=>row.id===seed.id);
  assert.equal(item.subject,saved.subject,seed.id);assert.equal(item.body,saved.body);assert.equal(item.builtin,false);
 }
});

test('recognized unversioned builtins upgrade to exact canonical sources with history',async()=>{
 for(const seed of coreScriptSeeds.filter(row=>row.channel==='email')){
  const saved={...seed,body:seed.previousBuiltinBodies[0]};delete saved.masterVersion;
  const db={prepare(){return {all:async()=>({results:[{id:seed.id,payload_json:JSON.stringify(saved),revision:3}]})};}};
  const item=(await coreScripts(db)).find(row=>row.id===seed.id);
  assert.equal(item.body,A.approvedPattern(seed.style));assert.equal(item.original,A.originalText(seed.style));
  assert.equal(item.subject,seed.subject);assert.equal(item.masterVersion,seed.masterVersion);assert.equal(item.revision,3);
  assert.equal(item.history.at(-1).body,saved.body);assert.equal(item.history.at(-1).subject,saved.subject);
 }
});

test('unversioned email deletion tombstones retain their exact text and history',async()=>{
 for(const seed of coreScriptSeeds.filter(row=>row.channel==='email')){
  const saved={...seed,body:seed.previousBuiltinBodies[0],deleted:true,history:[{body:'Previous owner text',subject:'Previous subject',revision:1}]};delete saved.masterVersion;
  const db={prepare(){return {all:async()=>({results:[{id:seed.id,payload_json:JSON.stringify(saved),revision:5}]})};}};
  const item=(await coreScripts(db)).find(row=>row.id===seed.id);
  assert.equal(item.deleted,true);assert.equal(item.body,saved.body);assert.equal(item.subject,saved.subject);
  assert.deepEqual(item.history,saved.history);assert.equal(item.revision,5);assert.equal(item.builtin,false);
 }
});
test('an owner-edited new-version master can remain primary',async()=>{
 const db={prepare(){return {all:async()=>({results:[{id:'email:friendly',payload_json:JSON.stringify({channel:'email',style:'friendly',name:'Owner updated',body:'Approved revision',subject:'Owner subject',masterVersion:'20261015'}),revision:4}]})};}};
 const item=(await coreScripts(db)).find(x=>x.id==='email:friendly');
 assert.equal(item.body,'Approved revision');
 assert.equal(item.revision,4);
});

test('October 17 Professional replaces an old builtin with history, preserving owner revisions',async()=>{const seed=coreScriptSeeds.find(r=>r.id==='email:professional');const old={...seed,body:seed.previousBuiltinBodies.at(-1),masterVersion:'20261015-v4'};const db={prepare(){return {all:async()=>({results:[{id:seed.id,payload_json:JSON.stringify(old),revision:5}]})};}};const updated=(await coreScripts(db)).find(r=>r.id===seed.id);assert.equal(updated.masterVersion,'20261017-professional-v1');assert.match(updated.original,/Safety: ISO 45001:2018 certified/);assert.ok(updated.history.some(h=>h.body===old.body));old.body='Owner separately approved custom Professional';const kept=(await coreScripts(db)).find(r=>r.id===seed.id);assert.equal(kept.body,old.body);});
