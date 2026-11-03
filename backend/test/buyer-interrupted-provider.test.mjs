import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {sha256} from '../src/security.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';

async function tick(f,id,services){const pending=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>pending.push(p)},{runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,jobId:id,maxJobs:1,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(pending);}

for(const state of ['running','running_prior_failure','failed'])test(`an interrupted independent task resumes while genuine exhausted failures stay held: ${state}`,async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),p=f.candidate.people[0],value=JSON.stringify([p.id,p.name,p.title]),key=await sha256('independent|'+value);let calls=0;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts,error) VALUES(?,?,'independent','contacts',?,?,2,?)").run(job.id,key,value,state==='failed'?'failed':'running',state==='running'?'':'independent: provider or source unavailable');
 await tick(f,job.id,{search:async()=>[],read:async url=>({url,markdown:'Robert Lund is Head of Procurement at Forge Industries.',metadata:{sourceURL:url}}),independent:async()=>{calls++;return {status:'complete',web_search:true,provider:'gemini',results:[]};}});
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id}),person=JSON.parse(saved.result_json).people[0];
 assert.equal(calls,state==='failed'?0:1);assert.equal(person.contactResearch.checks.independent.status,state==='failed'?'partial':'complete');
 assert.equal(f.DB.raw.prepare('SELECT attempts FROM buyer_research_tasks WHERE job_id=? AND task_key=?').get(job.id,key).attempts,state==='running'?1:2,'Only actually recorded earlier failures consume retry capacity');
});

test('the cumulative official deadline cannot abandon a still-progressing finite source plan',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);let now=Date.now();t.mock.method(Date,'now',()=>now);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='official',phase_ms=179000,phase_runs=3 WHERE id=?").run(job.id);
 const links=Array.from({length:28},(_,i)=>`[Supplier contact ${i}](https://forge.example/supplier-contact-${i})`).join('\n');
 await tick(f,job.id,{search:async()=>{now+=1000;return [];},read:async url=>{now+=1000;return {url,markdown:links+'\nRobert Lund is Head of Procurement at Forge Industries.',metadata:{sourceURL:url}};}});
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});
 // A complete source plan may advance. A partial one must retain its actual phase.
 const inventory=JSON.parse(saved.result_json).buyerDiscovery.officialContactInventory;
 assert.equal(inventory.research.status,'partial');assert.ok(inventory.research.pendingUrls.length);assert.equal(saved.phase,'official');
 assert.ok(saved.phase_runs<=18);
});

for(const mode of ['authorized','revoked','changed_context','replaced','canceled','already_repaired'])test(`saved interrupted execution recovery is once-only and preserves authority: ${mode}`,async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);let calls=0;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status=?,phase='done',input_json=json_remove(input_json,'$.executionContinuationVersion') WHERE id=?").run(mode==='canceled'?'canceled':'needs_review',job.id);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts) VALUES(?,'interrupted','independent','contacts','saved check','running',2)").run(job.id);
 if(mode==='revoked')f.DB.raw.prepare("UPDATE workspace_members SET role='viewer' WHERE workspace_id=? AND user_id=?").run(workspaceId,f.users.owner.id);
 if(mode==='changed_context')f.DB.raw.prepare("UPDATE customer_workspace_state SET payload_json=json_set(payload_json,'$.main.website','https://changed.example/'),version=version+1 WHERE workspace_id=?").run(workspaceId);
 if(mode==='replaced')await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,force:true});
 if(mode==='already_repaired')f.DB.raw.prepare("UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.executionContinuationVersion',2) WHERE id=?").run(job.id);
 await tick(f,job.id,{search:async()=>{calls++;return [];},read:async url=>({url,markdown:'Robert Lund is Head of Procurement at Forge Industries.',metadata:{sourceURL:url}})});
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});
 assert.equal(f.DB.raw.prepare("SELECT attempts FROM buyer_research_tasks WHERE job_id=? AND task_key='interrupted'").get(job.id).attempts,2,'Recovery does not erase an actual earlier failure');
 if(mode==='authorized'){assert.equal(saved.status,'queued');assert.equal(saved.phase,'dossier','Recovery starts at the earliest incomplete owner');assert.equal(JSON.parse(saved.input_json).executionContinuationVersion,2);assert.ok(calls>0);assert.equal(saved.id,job.id);}
 else{assert.equal(calls,0);assert.equal(saved.status,mode==='canceled'?'canceled':'needs_review');}
});

test('the review retains actually read staff evidence when search-result volume exceeds its bounded view',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),quote='Robert Lund is Head of Procurement at Forge Industries.';let received;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='review' WHERE id=?").run(job.id);
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,status,attempts,result_json) VALUES(?,'aaa-source','read','complete',1,?)").run(job.id,JSON.stringify({url:'https://forge.example/team',markdown:quote,sourceRead:true,extractedAt:new Date().toISOString()}));
 for(let i=0;i<35;i++)f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,status,attempts,result_json) VALUES(?,?,'search','complete',1,?)").run(job.id,'zzz-'+i,JSON.stringify({rows:Array.from({length:8},(_,j)=>({url:`https://forge.example/search-${i}-${j}`,description:'Generic company search summary',evidenceKind:'model_summary'}))}));
 await tick(f,job.id,{review:async(_env,_workspace,body)=>{received=body;return {provider:'controlled',supervisor:{status:'complete',reviewedPersonIds:['robert'],findings:[]},conflicts:[]};}});
 assert.ok(JSON.stringify(received.evidence).includes(quote),'Search summaries cannot evict the exact source body needed for review');
});
test('the short HTTP wake saves free checks and defers the native25-second independent call to cron',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 const services={search:async()=>[],read:async url=>({url,markdown:'Robert Lund is Head of Procurement at Forge Industries.',metadata:{sourceURL:url}})};
 await runBuyerResearchJobs(f.env,{jobId:job.id,maxJobs:1,windowMs:18000,services});
 const short=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(short.phase,'contacts');assert.equal(short.status,'queued');assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND kind='independent'").get(job.id).n,0,'No native request/attempt is dispatched into an insufficient window');
 await tick(f,job.id,services);const resumed=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(resumed.phase,'review');assert.equal(JSON.parse(resumed.result_json).publicResearch.accountability.checkedPeople,1);
});
test('completed work from a large earlier source scan cannot prevent the remaining finite person plan',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 for(let i=0;i<256;i++)f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,status,attempts,result_json) VALUES(?,?,'search','official','complete',1,'{\"rows\":[]}')").run(job.id,'retained-'+i);
 await tick(f,job.id,{search:async()=>[],read:async url=>({url,markdown:'Robert Lund is Head of Procurement at Forge Industries.',metadata:{sourceURL:url}}),independent:async()=>({status:'complete',web_search:true,results:[]})});
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(JSON.parse(saved.result_json).publicResearch.accountability.checkedPeople,1);assert.equal(saved.phase,'review');assert.ok(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks WHERE job_id=?').get(job.id).n>256);
 assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND task_key LIKE 'retained-%' AND status='complete'").get(job.id).n,256,'Recovery preserves earlier receipts');
});
test('two interrupted dispatches cannot consume the two real provider-failure attempts',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),services={search:async()=>[],read:async url=>({url,markdown:'Robert Lund is Head of Procurement at Forge Industries.',metadata:{sourceURL:url}}),independent:async()=>({status:'complete',web_search:true,results:[]})};
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);await tick(f,job.id,services);
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id}),candidate=JSON.parse(saved.result_json);candidate.people[0].contactResearch.checks.independent.status='partial';for(const receipt of candidate.people[0].contactResearch.checks.independent.queryLog){receipt.status='partial';receipt.searchStatus='partial';}
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts',phase_runs=0,result_json=? WHERE id=?").run(JSON.stringify(candidate),job.id);
 f.DB.raw.prepare("UPDATE buyer_research_tasks SET status='running',attempts=2,error='' WHERE job_id=? AND kind='independent'").run(job.id);let failures=0;services.independent=async()=>{failures++;throw Error('Provider temporarily unavailable');};
 await tick(f,job.id,services);assert.equal(failures,1);assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).phase,'contacts','The first real failure still has one allowed retry');
 await tick(f,job.id,services);assert.equal(failures,2);assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).phase,'review');assert.equal(f.DB.raw.prepare("SELECT attempts FROM buyer_research_tasks WHERE job_id=? AND kind='independent'").get(job.id).attempts,2);
});
