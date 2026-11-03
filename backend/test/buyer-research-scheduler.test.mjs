import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';

test('actual minute scheduler advances a saved buyer job after the starting request is gone',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),waits=[],calls=[];
 const services={search:async query=>{calls.push(query);return [];},read:async url=>({url,markdown:'# Forge Industries\n### Robert Lund\nHead of Procurement\n[robert@forge.example](mailto:robert@forge.example)',links:[],metadata:{sourceURL:url}})};
 const noop=async()=>({completed:0}),jobs={runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,maxJobs:1,windowMs:2000,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop};
 await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:promise=>waits.push(promise)},jobs);await Promise.all(waits);
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.ok(saved.revision>job.revision,'The real scheduler must reach the worker instead of rejecting its registered task');assert.notEqual(saved.phase,'official');assert.ok(calls.length>0);assert.ok(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND status='complete'").get(job.id).n>0);
 const receipts=f.DB.raw.prepare("SELECT metadata_json FROM audit_events WHERE event_type='operations.scheduler' AND entity_type='buyer_research' ORDER BY rowid").all().map(row=>JSON.parse(row.metadata_json));assert.deepEqual(receipts.map(row=>row.outcome),['started','completed']);
});
