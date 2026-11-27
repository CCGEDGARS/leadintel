import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob,commandBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {sha256} from '../src/security.js';
import {upsertCrmCompany} from '../src/crm.js';
import {startWebsiteContacts} from '../src/website-contact-store.js';
import {runWebsiteContactJobs} from '../src/website-contact-runner.js';
import {fastCompanyPage,savedFastResearch} from '../src/fast-research-evidence.js';

function call(f,path,body){
 return app.fetch(new Request(f.env.APP_ORIGIN+path+'?workspace_id='+workspaceId,{method:'POST',
  headers:{Origin:f.env.APP_ORIGIN,Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify(body)}),f.env,{});
}
test('Full research reuses an active free job and repeat starts reopen partial runs without a new spending window',async t=>{
 const f=await buyerJobsFixture(t),fast={...f.body,peopleFirst:true,freeDiscovery:true},full={...f.body,peopleFirst:true,fullResearch:true};
 const initial=await startBuyerJob(f.env,workspaceId,f.users.owner,fast);
 const responses=await Promise.all([call(f,'/api/buyers/research',full),call(f,'/api/buyers/research',full)]);
 for(const response of responses){assert.equal(response.status,200);assert.equal((await response.json()).job.id,initial.id);}
 const run=await readBuyerJob(f.env,workspaceId,{id:initial.id});assert.ok(JSON.parse(run.input_json).fullResearch);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',last_error='Budget pause' WHERE id=?").run(run.id);
 const raw=await readBuyerJob(f.env,workspaceId,{id:run.id});
 const selected={...JSON.parse(raw.input_json),scope:'selected_buyers',personIds:['one'],fullResearch:false};
 f.DB.raw.prepare("INSERT INTO buyer_research_jobs(id,workspace_id,requested_by,session_hash,domain,context_key,input_json,result_json,phase,status) VALUES('one-buyer',?,?,?,?,?,?,?,'contacts','needs_review')").run(workspaceId,raw.requested_by,raw.session_hash,raw.domain,'other-scope',JSON.stringify(selected),raw.result_json);
 assert.equal((await (await call(f,'/api/buyers/research',full)).json()).job.id,run.id);
 f.DB.raw.prepare("DELETE FROM buyer_research_jobs WHERE id='one-buyer'").run();
 const freeClick=await call(f,'/api/buyers/research/free',{...fast,action:'start',force:true});
 assert.equal((await freeClick.json()).job.status,'needs_review');
 const implicitResume=await call(f,'/api/buyers/research',{action:'resume',jobId:run.id});
 assert.equal((await implicitResume.json()).job.status,'needs_review');
 const again=await call(f,'/api/buyers/research',full);assert.equal((await again.json()).job.status,'needs_review');
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM buyer_research_jobs').get().n,1);
 f.DB.raw.prepare("INSERT INTO workspace_research_settings(workspace_id,full_research_policy) VALUES(?,'free_only')").run(workspaceId);
 assert.equal((await call(f,'/api/buyers/research',full)).status,403);
 assert.equal((await call(f,'/api/buyers/research/free',full)).status,400);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM additional_contact_attempts').get().n,0);
});

test('Fast to Full through HTTP and scheduled work reuses company pages and the exact Apollo directory query',async t=>{
 const f=await buyerJobsFixture(t),context={workspaceId,userId:f.users.owner.id,role:'owner',sessionHash:f.users.owner.sessionTokenHash};
 const domain=f.candidate.domain,home='https://'+domain+'/',name=f.candidate.company;
 const saved=await upsertCrmCompany(f.DB,context,{company_name:name,website:home});
 const companyId=(saved.company||saved).id,shortlist={action:'shortlist',companyId,managementLimit:3};
 const raw=await Promise.all([startWebsiteContacts(f.env,context,shortlist),startWebsiteContacts(f.env,context,shortlist)]);
 assert.equal(raw[0].id,raw[1].id);
 const fast=(await (await call(f,'/api/websites/contacts',shortlist)).json()).job;
 const observed={fastReads:[],fullReads:[],fastApollo:0,fullDomainApollo:0,plan:0};
 const source={url:home,title:name,markdown:'# '+name+'\n'+name+' designs and manufactures industrial products.\n## Robert Lund\nHead of Procurement\nrobert@'+domain,links:[],metadata:{title:name,sourceURL:home,statusCode:200}};
 const people=['Alice Peters','Erik Lund'].map((name,i)=>({id:'a'+i,name,title:'Production Manager',organization:{name:f.candidate.company,primary_domain:domain}}));
 const fastServices={read:async url=>{observed.fastReads.push(url);return {...source,url,metadata:{...source.metadata,sourceURL:url}};},publicIndex:async()=>[],apollo:async()=>{observed.fastApollo++;return {people};}};
 const fullServices={read:async url=>{observed.fullReads.push(url);return {...source,url,metadata:{...source.metadata,sourceURL:url}};},search:async()=>[],peopleSearch:async()=>[],apollo:async p=>{if(!p.companyNameFallback)observed.fullDomainApollo++;return {people};},plan:async()=>{observed.plan++;return {queries:[],findMorePeople:false,provider:'fixture'};},review:async()=>({supervisor:{status:'complete'},provider:'fixture'}),registry:async()=>({status:'unavailable'})};
 const fullResponse=await call(f,'/api/buyers/research',{...f.body,peopleFirst:true,fullResearch:true});assert.equal(fullResponse.status,200);
 const full=(await fullResponse.json()).job;
 const scheduled=async(run,method)=>{const waits=[];await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runBuyerResearchJobs:async()=>[],runWebsiteContactJobs:async()=>[],[method]:run});await Promise.all(waits);};
 const runFull=(env)=>runBuyerResearchJobs(env,{jobId:full.id,services:fullServices,windowMs:50000});
 await scheduled(runFull,'runBuyerResearchJobs');assert.deepEqual(observed.fullReads,[]);assert.equal(observed.plan,0);
 for(let i=0;i<8;i++){
  await scheduled(env=>runWebsiteContactJobs(env,{jobId:fast.id,windowMs:4500,services:fastServices}),'runWebsiteContactJobs');
  if(!['queued','running'].includes(f.DB.raw.prepare('SELECT status FROM website_contact_jobs WHERE id=?').get(fast.id).status))break;
 }
 const evidence=await savedFastResearch(f.env,workspaceId,f.candidate);assert.equal(evidence.active,false);assert.ok(evidence.pages.has(home));assert.ok(evidence.directory);assert.equal(observed.fastApollo,1);
 assert.ok(await fastCompanyPage(f.env,workspaceId,home,domain));assert.equal(await fastCompanyPage(f.env,'storage-w2',home,domain),null);
 f.DB.raw.prepare('UPDATE buyer_research_jobs SET next_at=0 WHERE id=?').run(full.id);
 for(let i=0;i<5&&!observed.plan;i++)await scheduled(runFull,'runBuyerResearchJobs');
 assert.equal(observed.plan,1);assert.equal(observed.fullDomainApollo,0);
 for(const url of evidence.pages.keys())assert.ok(!observed.fullReads.includes(url),'Full redispatched '+url);
 const replay=(await (await call(f,'/api/buyers/research',{...f.body,peopleFirst:true,fullResearch:true})).json()).job;
 assert.equal(replay.id,full.id);assert.ok(replay.diagnostics.some(d=>d.code==='fast_evidence'));assert.equal(f.DB.raw.prepare('SELECT COUNT(*) AS n FROM additional_contact_attempts').get().n,0);
});

test('a Full research resume retains an interrupted provider dispatch and a free-only workspace blocks metered list creation',async t=>{
 const f=await buyerJobsFixture(t);
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,peopleFirst:true,fullResearch:true});
 const key=await sha256('independent|Full research query plan');
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,status,attempts) VALUES(?,?,'independent','identities','Full research query plan','running',1)").run(job.id,key);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='identities',status='needs_review' WHERE id=?").run(job.id);
 await commandBuyerJob(f.env,workspaceId,f.users.owner,{action:'resume',jobId:job.id,expectedRevision:job.revision});
 assert.equal(f.DB.raw.prepare('SELECT status FROM buyer_research_tasks WHERE job_id=? AND task_key=?').get(job.id,key).status,'running');
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='identities' WHERE id=?").run(job.id);
 let planned=0;
 await runBuyerResearchJobs(f.env,{jobId:job.id,windowMs:50000,services:{apollo:async()=>({people:[]}),registry:async()=>({status:'unavailable'}),plan:async()=>{planned++;return {queries:[]};}}});
 assert.equal(planned,0);
 const current=await readBuyerJob(f.env,workspaceId,{id:job.id});
 assert.equal(current.status,'needs_review');
 assert.match(current.diagnostic_json,/prior provider request/);
 f.DB.raw.prepare("INSERT INTO workspace_research_settings(workspace_id,full_research_policy) VALUES(?,'free_only')").run(workspaceId);
 assert.equal((await call(f,'/api/company-lists',{action:'start'})).status,403);
 assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM company_lists').get().n,0);
});

test('Fast opened after Full reuses its official page and completed Apollo domain lookup, including an empty result',async t=>{
 const f=await buyerJobsFixture(t),context={workspaceId,userId:f.users.owner.id,role:'owner',sessionHash:f.users.owner.sessionTokenHash};
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,{...f.body,fullResearch:true,peopleFirst:true});
 const domain=f.candidate.domain,home='https://'+domain+'/',company=f.candidate.company;
 const crm=await upsertCrmCompany(f.DB,context,{company_name:company,website:home}),companyId=crm.company.id;
 const input={action:'shortlist',companyId,managementLimit:3};
 await assert.rejects(startWebsiteContacts(f.env,context,input),/Full research is already running/);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review' WHERE id=?").run(job.id);
 const insert=f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,request_value,result_json,status,attempts) VALUES(?,?,?,'identities',?,?,'complete',1)");
 const date=new Date(Date.now()-3600000).toISOString(),page={url:home,title:company,markdown:company+' manufactures industrial equipment.',sourceRead:true,metadata:{sourceURL:home,statusCode:200},links:[],extractedAt:date};
 for(const [kind,value,result] of [['read',home,page],['search','Apollo people search · '+domain+' · domain · attempt 1',{people:[],status:'succeeded'}]]){
  insert.run(job.id,await sha256(kind+'|'+value),kind,value,JSON.stringify(result));
 }
 const fast=await startWebsiteContacts(f.env,context,input),reads=[];let apollo=0;
 for(let i=0;i<8;i++){
  await runWebsiteContactJobs(f.env,{jobId:fast.id,windowMs:5000,services:{read:async url=>{reads.push(url);return {...page,url,metadata:{sourceURL:url,statusCode:200}};},publicIndex:async()=>[],apollo:async()=>{apollo++;return {people:[]};}}});
  const {status}=f.DB.raw.prepare('SELECT status FROM website_contact_jobs WHERE id=?').get(fast.id);
  if(!['queued','running'].includes(status))break;
 }
 const saved=await savedFastResearch(f.env,workspaceId,f.candidate);
 assert.equal(saved.pages.get(home)?.extractedAt,date);assert.ok(!reads.includes(home));
 assert.deepEqual(saved.directory.people,[]);assert.equal(apollo,0);
});
