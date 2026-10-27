import test from 'node:test';import assert from 'node:assert/strict';
import {storageFixture} from './writing-reference-fixture.mjs';
const mod=await import('../src/book-processing.js').catch(()=>({}));
test('three workers fill available slots, stop on failure and drain successful checkpoints',async()=>{
 assert.equal(typeof mod.boundedBookWork,'function');let active=0,peak=0,started=0,release;const hold=new Promise(r=>release=r),saved=[];
 const run=mod.boundedBookWork([0,1,2,3,4,5],async n=>{started++;peak=Math.max(peak,++active);await hold;active--;if(n===1)throw Error('rate limit');saved.push(n);});
 await new Promise(r=>setImmediate(r));assert.equal(started,3);release();const result=await run;assert.equal(peak,3);assert.deepEqual(saved,[0,2]);assert.equal(result.errors.length,1);assert.equal(started,3);
});
test('one workspace lock excludes another book or skill and stale owners cannot release a newer lock',async()=>{
 assert.equal(typeof mod.acquireBookLock,'function');const env=storageFixture();
 assert.equal(await mod.acquireBookLock(env,'w1','book-a',100,500),true);
 assert.equal(await mod.acquireBookLock(env,'w1','skill-b',200,600),false);
 assert.equal(await mod.acquireBookLock(env,'w2','book-c',200,600),true);
 assert.equal(await mod.acquireBookLock(env,'w1','skill-b',501,900),true);
 await mod.releaseBookLock(env,'w1','book-a');assert.equal(await mod.acquireBookLock(env,'w1','book-d',502,1000),false);
});
test('progress ignores legacy baseline and reports no fabricated speed before enough samples',()=>{
 assert.equal(typeof mod.processingProgress,'function');
 const none=mod.processingProgress({started_at:1000,progress_baseline:120,last_progress_at:1000},121,249,61000);assert.equal(none.etaSeconds,null);
 const p=mod.processingProgress({started_at:1000,progress_baseline:120,last_progress_at:61000},126,249,61000);
 assert.equal(p.ratePerMinute,6);assert.equal(p.etaSeconds,1230);assert.equal(p.percent,50);assert.equal(p.lastProgressAt,61000);
});
