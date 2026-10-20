const test=require('node:test');
const assert=require('node:assert/strict');
const Display=require('../qualification-display.js');

test('display reads return immediately, batch duplicate work and detach results',async()=>{
  const sent=[];let updated=0;
  const display=Display.create({request:async batch=>{sent.push(batch);return batch.rows.map(row=>({id:row.id,result:{eligible:true,score:80,gaps:[]}}));},onUpdate:()=>updated++});
  const context={profile:{},market:{}},candidate={domain:'a.example'};
  assert.equal(display.read(context,candidate,{}).pending,true);
  assert.equal(display.read(context,candidate,{}).pending,true);
  assert.equal(sent.length,0,'no scoring or worker dispatch inside the input event');
  await new Promise(resolve=>setTimeout(resolve,20));
  assert.equal(sent.length,1);assert.equal(sent[0].rows.length,1);assert.equal(updated,1);
  const result=display.read(context,candidate,{});assert.equal(result.score,80);result.gaps.push('mutated');
  assert.deepEqual(display.read(context,candidate,{}).gaps,[]);
});

test('late results cannot cross contexts; changed evidence, rules and expired displays are checked again',async()=>{
  const waiting=[];let now=0;
  const display=Display.create({now:()=>now,request:batch=>new Promise(resolve=>waiting.push({batch,resolve})),onUpdate(){}});
  const first={profile:{},market:{}},second={profile:{},market:{}};
  display.read(first,{domain:'a'},{});await new Promise(resolve=>setTimeout(resolve,5));
  display.read(second,{domain:'a'},{});await new Promise(resolve=>setTimeout(resolve,5));
  waiting[0].resolve(waiting[0].batch.rows.map(row=>({id:row.id,result:{score:99}})));await Promise.resolve();
  assert.equal(display.read(second,{domain:'a'},{}).pending,true);
  waiting[1].resolve(waiting[1].batch.rows.map(row=>({id:row.id,result:{score:80}})));await new Promise(resolve=>setTimeout(resolve,5));
  assert.equal(display.read(second,{domain:'a'},{}).score,80);
  assert.equal(display.read(second,{domain:'a',evidence:[{text:'changed'}]},{}).pending,true);
  assert.equal(display.read(second,{domain:'a'},{minimumScore:95}).pending,true);
  now=60001;assert.equal(display.read(second,{domain:'a'},{}).pending,true);
});

test('worker evaluates the same evidence policy and result as synchronous action validation',()=>{
  const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
  const c={URL};c.self=c;vm.createContext(c);
  c.importScripts=(...files)=>files.forEach(file=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file.split('?')[0]),'utf8'),c));
  let output;c.postMessage=value=>{output=value;};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../qualification-worker.js'),'utf8'),c);
  const batch={profile:{priorityOffers:'Training'},market:{},rows:[{id:1,candidate:{domain:'buyer.example',company:'Buyer',evidence:[]},settings:{}}]};
  c.onmessage({data:batch});
  const expected=require('../discovery-engine.js').assessCompanyQualification(batch.rows[0].candidate,batch.profile,batch.market,{});
  assert.deepEqual(JSON.parse(JSON.stringify(output.results[0].result)),expected);
});
