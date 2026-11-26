import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {handleBuyerResearchRoute} from '../src/buyer-research-routes.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {readBuyerJob} from '../src/buyer-research-store.js';
import {upsertCrmCompany,upsertCrmIntelligence,getCrmCompany} from '../src/crm.js';
import {controlledLookup} from './paid-lookup-fixture.mjs';
import {paidCohortCandidate} from './paid-candidate-fixture.mjs';
import {loadBuyerContactContext} from '../src/buyer-contact-context.js';
import {buyerPaidIntent,runWorkflowPaidResearch} from '../src/buyer-paid-research.js';
import * as Workflow from '../src/approved-workflow-runner.js';
const require=createRequire(import.meta.url),D=require('../../customer/discovery-engine.js'),Crm=require('../../customer/crm-engine.js');

async function cohortFixture(t,{limit=4,phone=true,callIds=true,paidEmailLimit,smallTeam=false}={}){
 const f=await buyerJobsFixture(t),c=paidCohortCandidate(),stamp=c.publicResearch.accountability.completedAt;
 if(smallTeam){
  c.people=c.people.slice(0,3);
  require('../../customer/test/helpers/buyer-research-receipts.cjs')(c,stamp);
  Object.assign(c.publicResearch.accountability,{totalPeople:3,checkedPeople:3});
  Object.assign(c.publicResearch.aiReview,{reviewedPersonIds:c.people.map(p=>p.id),inputSignature:D.buyerReviewSignature(c)});
 }
 const context={workspaceId,userId:f.users.owner.id,role:'owner'},company=(await upsertCrmCompany(f.env.DB,context,{company:c.company,domain:c.domain})).company;c.crmId=company.id;await upsertCrmIntelligence(f.env.DB,context,c.crmId,Crm.mapDiscoveryCandidateToCrm(c).intelligence);
 f.DB.raw.prepare("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,approved_by,automatic_buyer_limit) VALUES(?,1,?,'treg',10,100,10,?,?)").run(workspaceId,Number(phone),f.users.owner.id,limit);
 const response=await handleBuyerResearchRoute(new Request('https://app.fixture.test/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify({action:'start',candidate:c,paidResearch:true,paidEmailLimit})}),f.env);assert.equal(response.status,200);const job=(await response.json()).job;
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='paid',result_json=? WHERE id=?").run(JSON.stringify(c),job.id);
 const calls=[],lookup=await controlledLookup(f,calls,{callIds}),queries=[],body=c.people.map(p=>'### '+p.name+'\n'+p.title+'\nForge Industries').join('\n\n');
 const services={paidLookup:lookup,search:async query=>{queries.push(query);return [];},read:async url=>({url,markdown:body,sourceRead:true,extractedAt:stamp,metadata:{sourceURL:url}}),independent:async()=>({status:'not_configured',results:[]}),review:async(_env,_workspace,input)=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:input.people.map(p=>p.id),findings:[]},conflicts:[]})};
 const tick=async()=>{const pending=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>pending.push(p)},{runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,jobId:job.id,maxJobs:1,windowMs:50000,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(pending);};
 return {...f,c,context,job,calls,queries,services,tick,row:()=>readBuyerJob(f.env,workspaceId,{id:job.id})};
}

for(const [limit,phone]of [[4,true],[1,false]])test(`paid success re-enters bounded free research for its new visible cohort and resumes the original ${limit} buyers (phone=${phone})`,{timeout:120000},async t=>{
 const f=await cohortFixture(t,{limit,phone}),initial=JSON.parse((await f.row()).input_json).paidResearch;
 assert.equal(D.buyerResearchCoveragePassed(f.c),true);await f.tick();
 const paused=await f.row(),partial=JSON.parse(paused.result_json),intent=JSON.parse(paused.input_json).paidResearch;
 assert.equal(paused.phase,'contacts','paid confirmation makes a newly displayed buyer need its deeper public checks');assert.equal(paused.status,'queued');assert.equal(partial.publicResearch.paidResearch.status,'running');assert.match(intent.continuationScopeHash,/^[a-f0-9]{64}$/);
 assert.equal(partial.publicResearch.accountability.status,'partial','a known new priority-depth gap cannot display Passed accountability');assert.equal(partial.publicResearch.accountability.checkedPeople,7);assert.equal(partial.people.find(p=>p.id==='p2').emailResearch.status,'partial');
 assert.equal(partial.publicResearch.paidResearch.outcomes[0].personId,'p2');assert.equal(partial.publicResearch.paidResearch.outcomes[0].status,'processing');assert.equal(partial.publicResearch.paidResearch.outcomes[0].costMicro,2000,'settled email charges remain visible during free continuation');
 assert.equal(f.calls.filter(c=>c.url.includes('email.find')).length,1);assert.equal(f.calls.filter(c=>c.url.includes('email.verify')).length,1);assert.equal(f.calls.some(c=>c.url.includes('phone.find')),false);
 const {continuationScopeHash,...unchanged}=intent;assert.deepEqual(unchanged,initial,'continuation cannot adopt newer limits or permissions');
 for(let i=0;i<40&&['queued','running'].includes((await f.row()).status);i++)await f.tick();
 const finalRow=await f.row(),final=JSON.parse(finalRow.result_json),detail=await getCrmCompany(f.env.DB,f.context,f.c.crmId),{contactOptions}=await loadBuyerContactContext(f.env,f.context,final,{detail});
 assert.equal(finalRow.phase,'done');assert.equal(final.publicResearch.paidResearch.status,'complete',JSON.stringify(final.publicResearch.paidResearch));assert.equal(D.buyerResearchCoveragePassed(final,{contactOptions}),true);
 assert.equal(f.calls.filter(c=>c.url.includes('email.find')).length,limit,'completed email finding is not purchased again');assert.equal(f.calls.filter(c=>c.url.includes('email.verify')).length,limit,'completed verification is not purchased again');assert.equal(f.calls.filter(c=>c.url.includes('phone.find')).length,phone?limit:0);
 assert.deepEqual(new Set(final.publicResearch.paidResearch.outcomes.map(p=>p.personId)),new Set(limit===4?['p2','p0','p1','p3']:['p2']));assert.equal(final.publicResearch.paidResearch.outcomes.every(p=>p.status==='checked'),true);
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM additional_contact_attempts').get().n,limit);assert.equal(f.DB.raw.prepare('SELECT SUM(cost_micro) n FROM treg_contact_calls').get().n,limit*(phone?3000:2000));
 assert.ok(f.queries.some(query=>query.includes('"Cameron West"')&&query.includes('filetype:pdf')),'new priority depth uses actual shared public queries');
 assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM gmail_messages').get().n,0);
});

test('a CRM research edit after paid-cohort capture blocks own-scope publishing and preserves the paid ledger',{timeout:120000},async t=>{
 const f=await cohortFixture(t);await f.tick();assert.equal((await f.row()).phase,'contacts');
 f.DB.raw.prepare("UPDATE crm_intelligence SET research_snapshot_json=json_set(research_snapshot_json,'$.buyerResearch.buyers[0].title','Manual changed role') WHERE company_id=?").run(f.c.crmId);
 for(let i=0;i<12&&['queued','running'].includes((await f.row()).status);i++)await f.tick();
 const c=JSON.parse((await f.row()).result_json);assert.equal(c.publicResearch.paidResearch.code,'PAID_SCOPE_CHANGED');assert.equal(c.publicResearch.paidResearch.status,'blocked');assert.equal(f.calls.filter(c=>c.url.includes('email.find')).length,1);assert.equal(f.calls.some(c=>c.url.includes('phone.find')),false);
 const detail=await getCrmCompany(f.env.DB,f.context,f.c.crmId);assert.equal(detail.intelligence.research_snapshot.buyerResearch.buyers[0].title,'Manual changed role');assert.equal(f.DB.raw.prepare('SELECT SUM(cost_micro) n FROM treg_contact_calls').get().n,2000);
});

for(const failPublic of [false,true])test('approved workflow checkpoints paid-cohort continuation without restarting identity discovery (public failure='+failPublic+')',{timeout:120000},async t=>{
 const f=await cohortFixture(t),guard=async()=>{};guard.writeAuthority=()=>({sql:'1',args:[]});let candidate=f.c;
 candidate.buyerDiscovery.paidIntent=await buyerPaidIntent(f.env,workspaceId,true,candidate);candidate.buyerDiscovery.paidRunId='cohort-workflow';
 let report;for(let i=0;i<12;i++){
  const intent=candidate.buyerDiscovery.paidIntent;
  report=await runWorkflowPaidResearch(f.env,f.context,candidate,{intent,runId:'cohort-workflow',guard,lookup:f.services.paidLookup,resumePublic:()=>Workflow.resumePaidBuyerPublicResearch(f.env,f.context,candidate,{intent,jobId:'workflow:cohort-workflow',guard,services:f.services})});
  if(report.status!=='running')break;
  assert.equal(report.code,'ADDITIONAL_CONTACT_PRIORITY_RESEARCH_REQUIRED');
  if(failPublic)f.services.search=async query=>{f.queries.push(query);throw Error('Controlled unavailable public evidence');};
  candidate=JSON.parse(JSON.stringify(candidate));
 }
 assert.equal(report.status,failPublic?'blocked':'complete',JSON.stringify(report));
 if(failPublic){assert.equal(report.code,'PAID_PRIORITY_RESEARCH_INCOMPLETE');assert.equal(report.publicResearchAttempts,2);assert.equal(f.calls.filter(c=>c.url.includes('email.find')).length,1);assert.equal(f.calls.some(c=>c.url.includes('phone.find')),false);}
 else {assert.equal(f.calls.filter(c=>c.url.includes('email.find')).length,4);assert.equal(f.calls.filter(c=>c.url.includes('email.verify')).length,4);assert.equal(f.calls.filter(c=>c.url.includes('phone.find')).length,4);assert.deepEqual(new Set(report.outcomes.map(p=>p.personId)),new Set(['p2','p0','p1','p3']));}
});

for(const callIds of [true,false])test('a slice interrupted after verified email recovers the own paid ledger before selecting another buyer (callIds='+callIds+')',{timeout:120000},async t=>{
 const f=await cohortFixture(t,{limit:1,phone:false,callIds}),lookup=f.services.paidLookup;let interrupted=false;
 f.services.paidLookup=async(...args)=>{try{return await lookup(...args);}catch(error){if(!interrupted&&error.code==='ADDITIONAL_CONTACT_PRIORITY_RESEARCH_REQUIRED'){interrupted=true;throw Object.assign(Error('Controlled slice interruption after committed email and before its job outcome'),{code:'TIME_BUDGET'});}throw error;}};
 await f.tick();const first=await f.row();assert.equal(first.phase,'paid');assert.equal(JSON.parse(first.result_json).publicResearch.paidResearch.outcomes.length,0);assert.equal(f.calls.filter(c=>c.url.includes('email.find')).length,1);
 assert.equal(interrupted,true);f.services.paidLookup=lookup;await f.tick();assert.equal((await f.row()).phase,'contacts','same-job paid ledger must recover the continuation without a previously saved outcome');
 for(let i=0;i<16&&['queued','running'].includes((await f.row()).status);i++)await f.tick();
 const final=JSON.parse((await f.row()).result_json);assert.equal(final.publicResearch.paidResearch.status,'complete');assert.equal(final.publicResearch.paidResearch.outcomes[0].personId,'p2');assert.equal(final.publicResearch.paidResearch.outcomes[0].costMicro,2000);assert.equal(f.calls.filter(c=>c.url.includes('email.find')).length,1);assert.equal(f.calls.filter(c=>c.url.includes('email.verify')).length,1);
});

test('a later paid buyer interrupted after email retains every earlier checked outcome and its own known charge',{timeout:120000},async t=>{
 const f=await cohortFixture(t,{limit:4,phone:false,callIds:false}),lookup=f.services.paidLookup;let interrupted=false;
 f.services.paidLookup=async(...args)=>{try{return await lookup(...args);}catch(error){if(args[3].person_id==='p0'&&!interrupted&&error.code==='ADDITIONAL_CONTACT_PRIORITY_RESEARCH_REQUIRED'){interrupted=true;throw Object.assign(Error('Controlled later-buyer slice interruption'),{code:'TIME_BUDGET'});}throw error;}};
 for(let i=0;i<16&&!interrupted;i++)await f.tick();assert.equal(interrupted,true);
 const paused=JSON.parse((await f.row()).result_json);assert.deepEqual(paused.publicResearch.paidResearch.outcomes.map(p=>[p.personId,p.status,p.costMicro]),[['p2','checked',2000]]);
 for(let i=0;i<40&&['queued','running'].includes((await f.row()).status);i++)await f.tick();
 const report=JSON.parse((await f.row()).result_json).publicResearch.paidResearch;assert.equal(report.status,'complete');assert.deepEqual(new Set(report.outcomes.map(p=>p.personId)),new Set(['p2','p0','p1','p3']));assert.equal(report.outcomes.reduce((sum,p)=>sum+p.costMicro,0),8000);assert.equal(f.calls.filter(c=>c.url.includes('email.find')).length,4);assert.equal(f.calls.filter(c=>c.url.includes('email.verify')).length,4);
});

test('canceling a captured paid/free continuation prevents further source or paid dispatch and retains charged phases',{timeout:120000},async t=>{
 const f=await cohortFixture(t);await f.tick();const row=await f.row();assert.equal(row.phase,'contacts');
 const response=await handleBuyerResearchRoute(new Request('https://app.fixture.test/api/buyers/research?workspace_id='+workspaceId,{method:'POST',headers:{Cookie:'leadintel_session='+f.users.owner.token,'Content-Type':'application/json'},body:JSON.stringify({action:'cancel',jobId:f.job.id,expectedRevision:row.revision})}),f.env);assert.equal(response.status,200);
 f.services.search=async()=>assert.fail('Canceled continuation cannot research');f.services.paidLookup=async()=>assert.fail('Canceled continuation cannot purchase');await f.tick();
 assert.equal((await f.row()).status,'canceled');assert.equal(f.calls.length,2);assert.equal(f.DB.raw.prepare('SELECT SUM(cost_micro) n FROM treg_contact_calls').get().n,2000);
});

test('explicit email-only search verifies a small researched team with the approved limit',async t=>{
 const f=await cohortFixture(t,{limit:4,phone:true,paidEmailLimit:2,smallTeam:true});
 const intent=JSON.parse((await f.row()).input_json).paidResearch;
 assert.deepEqual([intent.workEmailSearch,intent.automaticBuyerLimit,intent.email,intent.phone],[true,2,true,false]);
 for(let i=0;i<24&&['queued','running'].includes((await f.row()).status);i++)await f.tick();
 const terminal=await f.row(),saved=JSON.parse(terminal.result_json).publicResearch.paidResearch;
 assert.equal(terminal.status,'complete',JSON.stringify(terminal.diagnostic_json));assert.equal(saved.status,'complete',JSON.stringify(saved));assert.equal(f.calls.filter(c=>c.url.includes('email.find')).length,2);
 assert.equal(f.calls.filter(c=>c.url.includes('phone.find')).length,0);
 const detail=await getCrmCompany(f.DB,f.context,f.c.crmId);assert.equal(detail.contacts.filter(c=>c.email_status==='verified').length,2);
});
