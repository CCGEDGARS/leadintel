import test from 'node:test';import assert from 'node:assert/strict';import {storageFixture} from './writing-reference-fixture.mjs';
const module=await import('../src/writing-reference-store.js').catch(()=>({}));
const scope={workspaceId:'w1',userId:'u1'};
const doc={bytes:new TextEncoder().encode('Ask one clear question.'),mime:'text/plain',sha256:'abc',extracted:{sections:[{location:'line:1',text:'Ask one clear question.'}],coverage:{total:1,readable:1,unreadable:0},characters:23}};
test('a stale replacement cannot overwrite another source with the same numeric revision',async()=>{const env=storageFixture();const a=await module.putWritingReference(env,scope,{slot:1,expectedRevision:0,filename:'a.txt',document:doc});await module.deleteWritingReference(env,scope,{id:a.id,expectedRevision:a.revision});const b=await module.putWritingReference(env,scope,{slot:1,expectedRevision:0,expectedSlotRevision:(await module.writingReferenceSlots(env,scope))[1],filename:'b.txt',document:doc});await assert.rejects(module.putWritingReference(env,scope,{slot:1,expectedRevision:a.revision,expectedSourceId:a.id,filename:'stale.txt',document:doc}),/changed/);assert.equal((await module.listWritingReferences(env,scope))[0].id,b.id);});
test('an old empty-slot token cannot recreate a slot after an upload and delete cycle',async()=>{const env=storageFixture();const a=await module.putWritingReference(env,scope,{slot:1,expectedRevision:0,filename:'a.txt',document:doc});await module.deleteWritingReference(env,scope,{id:a.id,expectedRevision:a.revision});await assert.rejects(module.putWritingReference(env,scope,{slot:1,expectedRevision:0,expectedSlotRevision:0,filename:'stale.txt',document:doc}),/changed/);});
test('staged private objects remain recoverable when database commit and compensating deletes fail',async()=>{const env=storageFixture();const batch=env.DB.batch.bind(env.DB),del=env.WRITING_REFERENCES_BUCKET.delete;env.DB.batch=async()=>{throw Error('commit unavailable');};env.WRITING_REFERENCES_BUCKET.delete=async()=>{throw Error('storage unavailable');};await assert.rejects(module.putWritingReference(env,scope,{slot:1,expectedRevision:0,filename:'a.txt',document:doc}));env.DB.batch=batch;env.WRITING_REFERENCES_BUCKET.delete=del;const {runWritingReferenceJobs}=await import('../src/writing-reference-runner.js');await runWritingReferenceJobs(env,{now:Date.now()+3600000,maxJobs:0});assert.equal(env.objects.size,0);});
test('private three-slot lifecycle rejects foreign, stale and incomplete activation and removes every derivative',async()=>{
 assert.equal(typeof module.putWritingReference,'function','private storage lifecycle must exist');const env=storageFixture();
 const one=await module.putWritingReference(env,scope,{slot:1,expectedRevision:0,filename:'guide.txt',document:doc});
 assert.equal(one.active,false);assert.equal(one.status,'Processing');assert.equal(env.objects.size,2);
 for(const slot of [2,3])await module.putWritingReference(env,scope,{slot,expectedRevision:0,filename:'guide.txt',document:doc});
 await assert.rejects(module.putWritingReference(env,scope,{slot:4,expectedRevision:0,filename:'guide.txt',document:doc}),/slot/i);
 await assert.rejects(module.patchWritingReference(env,{workspaceId:'w2'},{id:one.id,expectedRevision:one.revision,active:true}),/not found/i);
 await assert.rejects(module.patchWritingReference(env,scope,{id:one.id,expectedRevision:one.revision,active:true}),/Ready/i);
 await assert.rejects(module.patchWritingReference(env,scope,{id:one.id,expectedRevision:0,instruction:'new'}),/changed/i);
 const result=await module.deleteWritingReference(env,scope,{id:one.id,expectedRevision:one.revision});assert.equal(result.status,'Deleted');assert.equal(env.objects.size,4);
 assert.equal((await module.listWritingReferences(env,scope)).length,2);
 assert.equal(env.DB.raw.prepare('SELECT count(*) AS n FROM writing_reference_chunks WHERE source_id=?').get(one.id).n,0);
 await assert.rejects(module.putWritingReference(env,scope,{slot:1,expectedRevision:one.revision,filename:'late.txt',document:doc}),/changed/i);
});
test('interrupted deletion stays inactive and cleanup retry is idempotent',async()=>{
 assert.equal(typeof module.deleteWritingReference,'function');const env=storageFixture();const one=await module.putWritingReference(env,scope,{slot:1,expectedRevision:0,filename:'guide.txt',document:doc});
 const del=env.WRITING_REFERENCES_BUCKET.delete;env.WRITING_REFERENCES_BUCKET.delete=async()=>{throw Error('store unavailable');};
 await assert.rejects(module.deleteWritingReference(env,scope,{id:one.id,expectedRevision:one.revision}),/cleanup/i);
 const row=(await module.listWritingReferences(env,scope))[0];assert.equal(row.status,'Deleting');assert.equal(row.active,false);assert.equal(row.instruction,'');assert.deepEqual(row.techniques,[]);
 env.WRITING_REFERENCES_BUCKET.delete=del;await module.cleanupWritingReference(env,scope,row.id);await module.cleanupWritingReference(env,scope,row.id);assert.equal(env.objects.size,0);
});
test('snapshot cannot pair stale active cards with a newer reference revision',async()=>{const env=storageFixture();const one=await module.putWritingReference(env,scope,{slot:1,expectedRevision:0,filename:'guide.txt',document:doc});env.DB.raw.prepare("UPDATE writing_reference_sources SET status='Ready',active=1 WHERE id=?").run(one.id);const prepare=env.DB.prepare.bind(env.DB);let changed=false;env.DB.prepare=sql=>{const s=prepare(sql),all=s.all;s.all=async()=>{const r=await all.call(s);if(!changed&&sql.includes('SELECT s.*')){changed=true;await module.patchWritingReference(env,scope,{id:one.id,expectedRevision:one.revision,active:false});}return r;};return s;};const snapshot=await module.writingReferenceStore(env).snapshot(scope);assert.equal(snapshot.cards[0].active,false);});
test('owner can acknowledge partial readable coverage only after analysis completes',async()=>{
 const env=storageFixture(),source=await module.putWritingReference(env,scope,{slot:1,expectedRevision:0,filename:'guide.txt',document:doc});
 await assert.rejects(module.patchWritingReference(env,scope,{id:source.id,expectedRevision:source.revision,acknowledgePartial:true}),/completed analysis/);
 env.DB.raw.prepare("UPDATE writing_reference_sources SET status='Needs attention',catalogue_key='private/catalogue',techniques_json='[{\"name\":\"Question\"}]',coverage_json='{\"total\":3,\"readable\":2,\"unreadable\":1}' WHERE id=?").run(source.id);
 const ready=await module.patchWritingReference(env,scope,{id:source.id,expectedRevision:source.revision,acknowledgePartial:true});assert.equal(ready.status,'Ready');assert.equal(ready.active,false);assert.equal(ready.coverage.unreadable,1);assert.equal(ready.coverage.partialAccepted,true);
});
