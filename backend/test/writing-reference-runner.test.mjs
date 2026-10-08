import test from 'node:test';import assert from 'node:assert/strict';import {storageFixture} from './writing-reference-fixture.mjs';import {putWritingReference,deleteWritingReference,listWritingReferences} from '../src/writing-reference-store.js';
test('large complete catalogues are stored privately without exceeding D1 string limits',async()=>{const env=storageFixture();const text='a'.repeat(2000000),extracted={sections:[{location:'line:1',text}],characters:text.length,coverage:{total:1,readable:1,unreadable:0}};const one=await putWritingReference(env,{workspaceId:'w1'},{slot:1,expectedRevision:0,filename:'large.txt',document:{bytes:new TextEncoder().encode(text),mime:'text/plain',sha256:'large',extracted}});const {chunkWritingReference}=await import('../src/writing-reference-analysis.js');const chunks=chunkWritingReference(extracted);let count=0;for(const c of chunks){const techniques=Array.from({length:10},(_,i)=>({id:c.id+':'+i,name:'Technique '+(++count),principle:'p'.repeat(1000),pattern:'q'.repeat(1000),uses:['writing'],cautions:['verify'],locations:['line:1']}));env.DB.raw.prepare("INSERT INTO writing_reference_chunks(source_id,chunk_id,status,techniques_json) VALUES(?,?,'Complete',?)").run(one.id,c.id,JSON.stringify(techniques));}const prepare=env.DB.prepare.bind(env.DB);env.DB.prepare=sql=>{const s=prepare(sql),bind=s.bind;s.bind=function(...v){if(v.some(x=>typeof x==='string'&&new TextEncoder().encode(x).length>2000000))throw Error('D1 string too large');return bind.apply(this,v);};return s;};const runner=await import('../src/writing-reference-runner.js');await runner.runWritingReferenceJobs(env,{maxChunks:0,generate:async()=>{throw Error('no calls needed');}});const source=(await listWritingReferences(env,{workspaceId:'w1'}))[0];assert.equal(source.status,'Ready');assert.ok(source.catalogue_key);const catalogue=JSON.parse(await(await env.WRITING_REFERENCES_BUCKET.get(source.catalogue_key)).text());assert.equal(catalogue.techniques.length,count);assert.ok(source.techniques.length<count);assert.equal(source.coverage.techniqueCount,count);});
const runner=await import('../src/writing-reference-runner.js').catch(()=>({}));const scope={workspaceId:'w1',userId:'u1'};
async function fixture(){const env=storageFixture();const text='a'.repeat(13000);const one=await putWritingReference(env,scope,{slot:1,expectedRevision:0,filename:'guide.txt',document:{bytes:new TextEncoder().encode(text),mime:'text/plain',sha256:'test',extracted:{sections:[{location:'line:1',text}],characters:text.length,coverage:{total:1,readable:1,unreadable:0}}}});return {env,one};}
function generate(){return Promise.resolve({text:JSON.stringify({techniques:[{name:'Clear question',principle:'Ask one relevant question',uses:['opening'],cautions:['No fabricated data'],pattern:'Does your role involve {{service}}?',locations:['line:1']}]}),usage:{input_tokens:1,output_tokens:1}});}
test('all chunks are analysed and completed chunks survive provider failure and retry',async()=>{
 assert.equal(typeof runner.runWritingReferenceJobs,'function');const {env,one}=await fixture();let calls=0;
 await runner.runWritingReferenceJobs(env,{maxJobs:1,maxChunks:2,generate:async()=>{if(++calls===2)throw Error('quota exceeded');return generate();}});
 assert.equal(env.DB.raw.prepare("SELECT count(*) n FROM writing_reference_chunks WHERE status='Complete'").get().n,1);
 assert.equal((await listWritingReferences(env,scope))[0].status,'Failed');
 await runner.retryWritingReference(env,scope,{id:one.id,expectedRevision:(await listWritingReferences(env,scope))[0].revision});
 calls=0;await runner.runWritingReferenceJobs(env,{maxJobs:1,maxChunks:2,generate:()=>{calls++;return generate();}});assert.equal(calls,1);
 const row=(await listWritingReferences(env,scope))[0];assert.equal(row.status,'Ready');assert.equal(row.active,false);assert.ok(row.techniques.length);
});
test('lease excludes concurrent runners and deletion discards a late provider response',async()=>{
 assert.equal(typeof runner.runWritingReferenceJobs,'function');const {env,one}=await fixture();let release,started;const barrier=new Promise(r=>started=r),hold=new Promise(r=>release=r);
 const first=runner.runWritingReferenceJobs(env,{maxJobs:1,maxChunks:1,generate:async()=>{started();await hold;return generate();}});await barrier;
 let calls=0;await runner.runWritingReferenceJobs(env,{maxJobs:1,generate:()=>{calls++;return generate();}});assert.equal(calls,0);
 await deleteWritingReference(env,scope,{id:one.id,expectedRevision:one.revision});release();await first;
 assert.equal(env.DB.raw.prepare('SELECT count(*) n FROM writing_reference_chunks').get().n,0);assert.equal(env.objects.size,0);assert.equal((await listWritingReferences(env,scope)).length,0);
});
test('analysis failures identify confirmed quota, rate limits, timeout and invalid output without exposing source or secrets',async()=>{
 for(const [message,expected] of [
  ['OpenAI request failed (429) · code: insufficient_quota',/credits or billing quota/],
  ['OpenAI request failed (429) · code: rate_limit_exceeded',/rate limit/],
  ['OpenAI request timed out',/timed out/],
  ['Technique response must be valid JSON',/invalid analysis output/],
  ['private document text sk-secret-value',/unexpected error/]
 ]){const {env}=await fixture();await runner.runWritingReferenceJobs(env,{generate:async()=>{throw Error(message);}});const row=(await listWritingReferences(env,scope))[0];assert.match(row.error_code,expected);assert.ok(!row.error_code.includes('sk-secret-value'));assert.ok(!row.error_code.includes('private document'));}
});
test('source snapshots report completed analysis sections for long books',async()=>{
 const {env}=await fixture();await runner.runWritingReferenceJobs(env,{maxChunks:1,generate});const {writingReferenceProgress}=await import('../src/writing-reference-runner.js');const row=(await listWritingReferences(env,scope))[0];assert.deepEqual(await writingReferenceProgress(env,scope,row.id),{completed:1,total:2});
});
