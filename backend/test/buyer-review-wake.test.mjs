import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {importAesKey,encryptSecret} from '../src/oauth.js';

test('HTTP Resume defers the 45-second AI review to cron without consuming its phase allowance or replaying saved sources',async t=>{
 const f=await buyerJobsFixture(t),j=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,23).toString('base64');
 const encrypted=await encryptSecret('controlled-review-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY));
 f.DB.raw.prepare("INSERT INTO workspace_ai_integrations(workspace_id,provider,encrypted_api_key,key_hint,model,active) VALUES(?,'openai',?,'test','gpt-6.1-sol',1)").run(workspaceId,encrypted);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='review',status='needs_review',phase_ms=0,phase_runs=0,input_json=json_set(input_json,'$.apolloIdentityVersion',1),diagnostic_json='[{\"phase\":\"review\",\"code\":\"run_window\",\"reason\":\"Research paused after 30 minutes\"}]' WHERE id=?").run(j.id);
 const source={url:'https://forge.example/team',markdown:'Robert Lund is Head of Procurement at Forge Industries.',sourceRead:true,extractedAt:new Date().toISOString()};
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,result_json) VALUES(?,'saved-staff','read','official',?,'complete',1,?)").run(j.id,source.url,JSON.stringify(source));
 const savedTasks=f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=?').all(j.id);let calls=0;
 t.mock.method(globalThis,'fetch',async(url,options)=>{assert.equal(new URL(url).hostname,'api.openai.com','No source reread, contact reveal or paid lookup is dispatched');calls++;return Response.json({output_text:JSON.stringify({reviewed_person_ids:['robert'],findings:[],conflicts:[],summary:'Source reviewed.'}),usage:{}});});
 const wake=async()=>{const pending=[];const response=await app.fetch(new Request(f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify({action:'resume',jobId:j.id})}),f.env,{waitUntil:p=>pending.push(p)});assert.equal(response.status,200);await Promise.all(pending);};
 await wake();
 assert.equal(calls,0,'An 18s HTTP wake must not start the 45s review');
 for(let i=0;i<2;i++)await wake();
 const deferred=await readBuyerJob(f.env,workspaceId,{id:j.id});assert.equal(deferred.phase,'review');assert.equal(deferred.status,'queued');assert.equal(deferred.phase_ms,0);assert.equal(deferred.phase_runs,0);assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=?').all(j.id),savedTasks);
 const pending=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>pending.push(p)},{runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,maxJobs:1,jobId:j.id}),runCopilotResearchJobs:noop,runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(pending);
 const finished=await readBuyerJob(f.env,workspaceId,{id:j.id}),candidate=JSON.parse(finished.result_json);assert.equal(calls,1);assert.equal(candidate.publicResearch.aiReview.status,'complete');assert.equal(finished.phase,'done');assert.equal(finished.status,'needs_review','A completed AI review cannot approve unfinished public checks');assert.deepEqual(f.DB.raw.prepare('SELECT * FROM buyer_research_tasks WHERE job_id=?').all(j.id),savedTasks);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_enrichment_requests').get().n,0);
});

test('review deferral cannot extend the explicit 30-minute run window',async t=>{
 const f=await buyerJobsFixture(t),j=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='review',input_json=json_set(input_json,'$.executionWindowStartedAt',?,'$.apolloIdentityVersion',1) WHERE id=?").run(new Date(Date.now()-31*60000).toISOString(),j.id);let calls=0;await runBuyerResearchJobs(f.env,{jobId:j.id,maxJobs:1,windowMs:18000,services:{review:async()=>{calls++;return {};}}});const saved=await readBuyerJob(f.env,workspaceId,{id:j.id});assert.equal(calls,0);assert.equal(saved.status,'needs_review');assert.equal(saved.phase,'review');assert.equal(JSON.parse(saved.diagnostic_json).at(-1).code,'run_window');
});

test('failed AI-review execution receipts survive the same job checkpoint without approving partial public research',async t=>{
 const f=await buyerJobsFixture(t),j=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='review',input_json=json_set(input_json,'$.apolloIdentityVersion',1) WHERE id=?").run(j.id);
 await runBuyerResearchJobs(f.env,{jobId:j.id,maxJobs:1,services:{review:async()=>({status:'unavailable',provider:'none',reason:'AI review timed out',conflicts:[],researchTrace:[{provider:'ai_review',status:'failed',reason:'OpenAI request timed out',code:'AI_REVIEW_TIMEOUT',failureKind:'timeout'}]})}});
 const saved=await readBuyerJob(f.env,workspaceId,{id:j.id}),result=JSON.parse(saved.result_json),receipt=result.publicResearch.accountability.tools.find(row=>row.provider==='ai_review');assert.equal(receipt.attempted,1);assert.equal(receipt.failed,1);assert.equal(receipt.lastFailure.code,'AI_REVIEW_TIMEOUT');assert.equal(result.publicResearch.aiReview.status,'unavailable');assert.equal(saved.status,'needs_review');
});
