import test from 'node:test';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import app from '../src/app.js';

test('a shared-budget yield after contact completion preserves the pending review phase',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),D=globalThis.LeadIntelDiscovery,original=D.acceptedOfficialBuyerEmail;let runtime;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts',phase_ms=200000,phase_runs=5 WHERE id=?").run(job.id);
 // confirmNamed runs after mandatory research resolves and immediately before
 // the final checkpoint guard; an admitted peer may use the remaining shared room.
 t.mock.method(D,'acceptedOfficialBuyerEmail',(...args)=>{const result=original(...args);runtime.bookInvocationBudget.used=600;return result;});
 const waits=[],noop=async()=>({completed:0}),services={search:async()=>[],read:async url=>({url,markdown:'Robert Lund — Head of Procurement — Forge Industries',metadata:{sourceURL:url}}),independent:async()=>({status:'not_configured',results:[]})};
 await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runBuyerResearchJobs:async(env,options)=>{runtime=env;return runBuyerResearchJobs(env,{...options,maxJobs:1,jobId:job.id,services});},runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id}),candidate=JSON.parse(saved.result_json);
 assert.equal(candidate.publicResearch.accountability.status,'complete');assert.equal(saved.status,'queued');
 assert.equal(saved.phase,'review','Accumulated contact time cannot exhaust a review that has not run');
 assert.equal(saved.phase_ms,0);assert.equal(saved.phase_runs,0);
});

test('a shared-budget yield after a completed review settles the scoped job quality instead of inventing a review hold',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,personIds:['robert']});let runtime;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 const services={search:async()=>[],read:async url=>({url,markdown:'Robert Lund — Head of Procurement — Forge Industries',metadata:{sourceURL:url}}),independent:async()=>({status:'not_configured',results:[]}),review:async()=>{let reads=0;return {provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:['robert'],findings:[]},get conflicts(){if(++reads===2)runtime.bookInvocationBudget.used=600;return [];}};}};
 const tick=async()=>{const waits=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runBuyerResearchJobs:async(env,options)=>{runtime=env;return runBuyerResearchJobs(env,{...options,maxJobs:1,jobId:job.id,services});},runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);};
 await tick();assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).phase,'review');await tick();
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id}),candidate=JSON.parse(saved.result_json);assert.equal(candidate.publicResearch.aiReview.status,'complete');assert.equal(saved.phase,'done');assert.equal(saved.status,'complete','A final checkpoint yield cannot manufacture unmet quality requirements');assert.equal(candidate.publicContactStatus,'complete');
});
