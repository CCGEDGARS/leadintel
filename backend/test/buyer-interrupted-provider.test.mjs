import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {sha256} from '../src/security.js';
import {encryptSecret,importAesKey} from '../src/oauth.js';
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
 if(mode==='already_repaired')f.DB.raw.prepare("UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.executionContinuationVersion',4) WHERE id=?").run(job.id);
 await tick(f,job.id,{search:async()=>{calls++;return [];},read:async url=>({url,markdown:'Robert Lund is Head of Procurement at Forge Industries.',metadata:{sourceURL:url}})});
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});
 assert.equal(f.DB.raw.prepare("SELECT attempts FROM buyer_research_tasks WHERE job_id=? AND task_key='interrupted'").get(job.id).attempts,2,'Recovery does not erase an actual earlier failure');
 if(mode==='authorized'){assert.equal(saved.status,'queued');assert.equal(saved.phase,'dossier','Recovery starts at the earliest incomplete owner');assert.equal(JSON.parse(saved.input_json).executionContinuationVersion,4);assert.ok(calls>0);assert.equal(saved.id,job.id);}
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

for(const mode of ['durable_progress','cached_only'])test(`actual HTTP wake and scheduler preserve bounded contact continuation with ${mode}`,async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),queries=[],reads=[];
 f.env.OAUTH_TOKEN_ENCRYPTION_KEY=Buffer.alloc(32,17).toString('base64');
 const encrypted=await encryptSecret('controlled-firecrawl-key',await importAesKey(f.env.OAUTH_TOKEN_ENCRYPTION_KEY));
 f.DB.raw.prepare("INSERT INTO workspace_service_integrations(workspace_id,provider,encrypted_api_key,key_hint,metadata_json) VALUES(?,'firecrawl',?,'test','{}')").run(workspaceId,encrypted);
 t.mock.method(globalThis,'fetch',async(input,options)=>{
  const url=new URL(typeof input==='string'?input:input.url);
  if(url.hostname==='api.firecrawl.dev'&&url.pathname==='/v2/search'){
   queries.push(JSON.parse(options.body).query);return Response.json({success:true,data:[{url:'https://forge.example/team',title:'Forge Industries team',description:'Robert Lund, Head of Procurement at Forge Industries'}]});
  }
  if(url.hostname==='forge.example'){
   reads.push(url.href);return new Response('<html><body><h2>Robert Lund</h2><p>Head of Procurement at Forge Industries</p></body></html>',{headers:{'Content-Type':'text/html'}});
  }
  throw Error('Unexpected external request in controlled contact wake: '+url.origin+url.pathname);
 });
 const wake=async()=>{
  const pending=[],response=await app.fetch(new Request(f.env.APP_ORIGIN+'/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify({action:'resume',jobId:job.id})}),f.env,{waitUntil:p=>pending.push(p)});
  assert.equal(response.status,200,await response.clone().text());assert.equal(pending.length,1,'The real route must register its bounded HTTP wake');await Promise.all(pending);
 };
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts',phase_ms=653585,phase_runs=? WHERE id=?").run(mode==='durable_progress'?17:0,job.id);
 await wake();
 const first=await readBuyerJob(f.env,workspaceId,{id:job.id}),complete=f.DB.raw.prepare("SELECT task_key,kind FROM buyer_research_tasks WHERE job_id=? AND status='complete'").all(job.id);
 assert.ok(complete.some(row=>row.kind==='search')&&complete.some(row=>row.kind==='read'),'The short wake must make real durable free-check progress');
 assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND kind='independent'").get(job.id).n,0,'The native30s admission rule must defer independent research in an18s HTTP wake');
 assert.equal(first.phase,'contacts','Durable progress cannot be abandoned at the old18-slice cutoff');assert.equal(first.status,'queued');assert.equal(first.phase_runs,0,'Progress resets the consecutive-idle counter');
 const countBefore=f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks WHERE job_id=?').get(job.id).n;
 if(mode==='cached_only'){
  f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase_runs=17 WHERE id=?").run(job.id);await wake();
  const stopped=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(stopped.phase,'review','Eighteen consecutive slices without saved task progress still stop the bounded phase');
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks WHERE job_id=?').get(job.id).n,countBefore);
  assert.equal(JSON.parse(stopped.result_json).publicResearch.accountability.checkedPeople,0,'A no-progress bound cannot manufacture completed coverage');
 }else{
  const previousQueries=queries.slice(),previousReads=reads.slice();await tick(f,job.id,{});
  const resumed=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(resumed.phase,'review');assert.equal(JSON.parse(resumed.result_json).publicResearch.accountability.checkedPeople,1);
  for(const query of previousQueries)assert.equal(queries.filter(value=>value===query).length,previousQueries.filter(value=>value===query).length,'Completed native searches are reused after the browser wake');
  assert.deepEqual(reads,previousReads,'The saved official body is reused by the actual scheduler');
  assert.ok(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks WHERE job_id=?').get(job.id).n<=384);
  assert.ok(f.DB.raw.prepare('SELECT MAX(attempts) n FROM buyer_research_tasks WHERE job_id=?').get(job.id).n<=2);
 }
});
test('completed work from a large earlier source scan cannot prevent the remaining finite person plan',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 for(let i=0;i<384;i++)f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,status,attempts,result_json) VALUES(?,?,'search','official','complete',1,'{\"rows\":[]}')").run(job.id,'retained-'+i);
 await tick(f,job.id,{search:async()=>[],read:async url=>({url,markdown:'Robert Lund is Head of Procurement at Forge Industries.',metadata:{sourceURL:url}}),independent:async()=>({status:'complete',web_search:true,results:[]})});
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(JSON.parse(saved.result_json).publicResearch.accountability.checkedPeople,1);assert.equal(saved.phase,'review');assert.ok(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks WHERE job_id=?').get(job.id).n>384);
 assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND task_key LIKE 'retained-%' AND status='complete'").get(job.id).n,384,'Earlier source-phase receipts cannot consume the contact phase’s own bounded task plan');
});
test('the contact phase still enforces its own384-task ceiling without dispatching or claiming completion',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);let calls=0;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='contacts' WHERE id=?").run(job.id);
 for(let i=0;i<384;i++)f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,status,attempts,result_json) VALUES(?,?,'search','contacts','complete',1,'{\"rows\":[]}')").run(job.id,'contact-budget-'+i);
 const services={search:async()=>{calls++;return [];},read:async url=>{calls++;return {url,markdown:'Robert Lund is Head of Procurement at Forge Industries.'};},independent:async()=>{calls++;return {status:'complete',web_search:true,results:[]};}};
 await tick(f,job.id,services);const saved=await readBuyerJob(f.env,workspaceId,{id:job.id}),candidate=JSON.parse(saved.result_json);
 assert.equal(calls,0,'A full active-phase task plan cannot dispatch another provider');assert.equal(f.DB.raw.prepare("SELECT count(*) n FROM buyer_research_tasks WHERE job_id=? AND phase='contacts'").get(job.id).n,384);
 const directory=f.DB.raw.prepare("SELECT phase,result_json FROM buyer_research_tasks WHERE job_id=? AND request_value LIKE 'Apollo people search%'").all(job.id);assert.equal(directory.length,1);assert.equal(directory[0].phase,'identities');assert.equal(JSON.parse(directory[0].result_json).executed,false,'The optional unconfigured directory receipt consumes no contact-plan capacity or provider call');
 assert.equal(candidate.publicResearch.accountability.checkedPeople,0);assert.notEqual(candidate.publicResearch.accountability.status,'complete');
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
