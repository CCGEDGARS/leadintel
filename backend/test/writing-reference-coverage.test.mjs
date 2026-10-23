import test from 'node:test';
import assert from 'node:assert/strict';
import {storageFixture} from './writing-reference-fixture.mjs';
import {putWritingReference,listWritingReferences,getWritingReference,patchWritingReference,writingReferenceRevision,writingReferenceSlots} from '../src/writing-reference-store.js';
import {runWritingReferenceJobs} from '../src/writing-reference-runner.js';
const scope={workspaceId:'w1'};
const generate=async()=>({text:JSON.stringify({techniques:[{name:'Clear question',principle:'Ask one relevant question',uses:['opening'],cautions:['No fabricated data'],pattern:'One question?',locations:['page:1']}]}),usage:{input_tokens:1,output_tokens:1}});
async function source(env,coverage,workspace=scope){
 const text='Ask one clear question.';
 return putWritingReference(env,workspace,{slot:1,expectedRevision:0,filename:'book.pdf',document:{bytes:new TextEncoder().encode('original book bytes'),mime:'application/pdf',sha256:'original',extracted:{sections:[{location:'page:1',text}],characters:text.length,coverage}}});
}
async function completedLegacy(env,coverage,workspace=scope){
 const row=await source(env,coverage,workspace);
 env.DB.raw.prepare("UPDATE writing_reference_sources SET status='Needs attention',catalogue_key='catalogue',techniques_json=? WHERE id=?").run(JSON.stringify([{name:'Clear question',principle:'Ask one question',locations:['page:1']}]),row.id);
 return row;
}
for(const [readable,total,expected] of [[80,100,'Ready'],[4,5,'Ready'],[99,100,'Ready'],[79,100,'Needs attention'],[0,100,'Needs attention']]){
 test(`completed analysis with ${readable}/${total} readable pages becomes ${expected}`,async()=>{
  const env=storageFixture(),row=await source(env,{total,readable,unreadable:total-readable});
  await runWritingReferenceJobs(env,{generate});
  assert.equal(env.DB.raw.prepare('SELECT status FROM writing_reference_sources WHERE id=?').get(row.id).status,expected);
  const saved=await getWritingReference(env,scope,row.id);
  assert.equal(saved.active,false);assert.equal(saved.coverage.unreadable,total-readable);
 });
}
test('existing 80% book becomes durably Ready with atomic revision changes and activates after reload',async()=>{
 const env=storageFixture(),row=await completedLegacy(env,{total:100,readable:80,unreadable:20});
 const before=await writingReferenceRevision(env,scope),slots=await writingReferenceSlots(env,scope),objects=new Map(env.objects);
 const ready=(await listWritingReferences(env,scope))[0];
 assert.equal(ready.status,'Ready');assert.equal(ready.active,false);assert.equal(ready.revision,row.revision+1);
 assert.equal(await writingReferenceRevision(env,scope),before+1);assert.equal((await writingReferenceSlots(env,scope))[1],slots[1]+1);
 assert.equal(env.DB.raw.prepare('SELECT status FROM writing_reference_sources WHERE id=?').get(row.id).status,'Ready');
 assert.deepEqual(env.objects,objects,'source files and extracted text must remain unchanged');
 assert.equal((await listWritingReferences(env,scope))[0].revision,ready.revision,'recovery must be idempotent');
 const active=await patchWritingReference(env,scope,{id:row.id,expectedRevision:ready.revision,active:true});
 assert.equal(active.active,true);assert.equal((await getWritingReference(env,scope,row.id)).active,true);
});
test('direct source access recovers an existing eligible book without requiring a library list first',async()=>{
 const env=storageFixture(),row=await completedLegacy(env,{total:5,readable:4,unreadable:1});
 assert.equal((await getWritingReference(env,scope,row.id)).status,'Ready');
});
test('recovery never changes books in another workspace',async()=>{
 const env=storageFixture(),row=await completedLegacy(env,{total:5,readable:4,unreadable:1},{workspaceId:'w2'});
 assert.deepEqual(await listWritingReferences(env,scope),[]);
 assert.equal(env.DB.raw.prepare('SELECT status FROM writing_reference_sources WHERE id=?').get(row.id).status,'Needs attention');
});
test('native extraction review is independent of readable percentage',async()=>{
 const env=storageFixture(),row=await completedLegacy(env,{total:100,readable:100,unreadable:0,requiresReview:true});
 assert.equal((await getWritingReference(env,scope,row.id)).status,'Needs attention');
 await assert.rejects(patchWritingReference(env,scope,{id:row.id,expectedRevision:row.revision,active:true}),/Ready/);
});
test('incomplete analysis and invalid counts never qualify for automatic recovery',async()=>{
 for(const coverage of [{total:0,readable:0,unreadable:0},{total:100,readable:79,unreadable:21},{total:100,readable:101,unreadable:-1},{total:100,readable:80,unreadable:30},{total:100,readable:'80',unreadable:20},{}]){
  const env=storageFixture(),row=await completedLegacy(env,coverage);
  assert.equal((await listWritingReferences(env,scope))[0].status,'Needs attention');
  assert.equal((await getWritingReference(env,scope,row.id)).revision,row.revision);
 }
 const env=storageFixture(),row=await source(env,{total:100,readable:80,unreadable:20});
 assert.equal((await getWritingReference(env,scope,row.id)).status,'Processing');
});
test('backend health publishes the readable coverage policy used for release verification',async()=>{
 const {default:core}=await import('../src/index.js');
 const response=await core.fetch(new Request('https://api.test/api/health'),{});
 assert.equal(response.status,200);assert.equal((await response.json()).writing_reference_readable_percent,80);
});
test('failed recovery rolls back dependent revisions along with the status change',async()=>{
 const env=storageFixture(),row=await completedLegacy(env,{total:5,readable:4,unreadable:1});
 const before=await writingReferenceRevision(env,scope),slots=await writingReferenceSlots(env,scope),prepare=env.DB.prepare.bind(env.DB);
 env.DB.prepare=sql=>{const statement=prepare(sql);if(sql.startsWith("UPDATE writing_reference_sources SET status='Ready'"))statement.run=async()=>{throw Error('database unavailable');};return statement;};
 await assert.rejects(listWritingReferences(env,scope),/database unavailable/);env.DB.prepare=prepare;
 assert.equal(env.DB.raw.prepare('SELECT status,revision FROM writing_reference_sources WHERE id=?').get(row.id).revision,row.revision);
 assert.equal(await writingReferenceRevision(env,scope),before);assert.deepEqual(await writingReferenceSlots(env,scope),slots);
});
