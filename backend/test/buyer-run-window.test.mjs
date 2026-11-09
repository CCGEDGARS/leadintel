import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {readBuyerJob,startBuyerJob,publicBuyerJob} from '../src/buyer-research-store.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';

async function schedule(f,id,services){
 const waits=[],noop=async()=>({completed:0});
 await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,maxJobs:1,windowMs:50000,services,jobId:id}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);
}
for(const legacy of [false,true])test(`expired ${legacy?'legacy':'current'} job pauses through the real scheduler; HTTP resume retains its work and phase`,async t=>{
 const f=await buyerJobsFixture(t),url=f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId,headers={Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'};
 const start=await app.fetch(new Request(url,{method:'POST',headers,body:JSON.stringify(f.body)}),f.env,{});assert.equal(start.status,200);const {job}=await start.json();
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts',created_at=datetime('now','-58 minutes'),input_json=json_set(input_json,'$.executionWindowStartedAt',?),phase_runs=0 WHERE id=?").run(new Date(Date.now()-58*60000).toISOString(),job.id);
 if(legacy)f.DB.raw.prepare("UPDATE buyer_research_jobs SET input_json=json_remove(input_json,'$.executionWindowStartedAt') WHERE id=?").run(job.id);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,result_json) VALUES(?,'saved-source','read','contacts','https://forge.example/team','complete',1,'{\"url\":\"https://forge.example/team\",\"markdown\":\"Robert Lund Head of Procurement Forge Industries\"}')").run(job.id);
 const receipt=f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=?').all(job.id);let calls=0;const services={search:async()=>{calls++;return [];},read:async()=>{calls++;return {markdown:'No new data'};},independent:async()=>{calls++;return {status:'not_configured',results:[]};}};
 await schedule(f,job.id,services);let row=await readBuyerJob(f.env,workspaceId,{id:job.id});
 assert.equal(calls,0);assert.equal(row.status,'needs_review');assert.equal(row.phase,'contacts');assert.equal(JSON.parse(row.diagnostic_json).at(-1).code,'run_window');assert.equal(JSON.parse(row.result_json).people[0].id,f.candidate.people[0].id);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=?').all(job.id),receipt);
 const reopened=await app.fetch(new Request(url+'&job_id='+job.id,{headers}),f.env,{});assert.equal((await reopened.json()).job.status,'needs_review');
 await schedule(f,job.id,services);assert.equal(calls,0,'A paused job cannot silently restart');assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).revision,row.revision);
 const resume=await app.fetch(new Request(url,{method:'POST',headers,body:JSON.stringify({action:'resume',jobId:job.id,expectedRevision:row.revision})}),f.env,{});assert.equal(resume.status,200);const resumed=(await resume.json()).job;assert.equal(resumed.id,job.id);assert.equal(resumed.phase,'contacts');assert.equal(resumed.status,'queued');assert.equal(resumed.progress.timing.runWindow.expired,false);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=?').all(job.id),receipt);
});
test('fresh successful receipts do not extend the explicit run deadline; stage advancement is not proof of completion',async t=>{
 const f=await buyerJobsFixture(t),row=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),start=JSON.parse(row.input_json).executionWindowStartedAt;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts',phase_runs=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").run(row.id);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,status) VALUES(?,'latest','search','complete')").run(row.id);
 const view=await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{id:row.id}));assert.equal(view.progress.timing.runWindow.startedAt,start);assert.equal(view.progress.stages.dossier,false);assert.equal(view.progress.stages.contacts,false);assert.equal(view.progress.stages.identities,true);
});
test('crossing the window during a provider response pauses rather than accepting a late result or advancing to review',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);let now=Date.now(),calls=0;t.mock.method(Date,'now',()=>now);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts',input_json=json_set(input_json,'$.executionWindowStartedAt',?) WHERE id=?").run(new Date(now-30*60000+1000).toISOString(),job.id);
 await schedule(f,job.id,{search:async()=>{calls++;now+=1500;return [];},read:async()=>{calls++;now+=1500;return {markdown:'Late source'};},independent:async()=>{calls++;now+=1500;return {status:'not_configured',results:[]};}});
 const row=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.ok(calls>0);assert.equal(row.status,'needs_review');assert.equal(row.phase,'contacts');assert.equal(JSON.parse(row.diagnostic_json).at(-1).code,'run_window');assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND phase='contacts' AND status IN ('failed','complete')").get(job.id).n,0,'Interrupted contact dispatch is not a provider-failure or success receipt');
});
