import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {paidCandidate} from './paid-candidate-fixture.mjs';
import {controlledLookup} from './paid-lookup-fixture.mjs';
import {saveAdditionalContactPolicy} from '../src/additional-contact-services.js';
import {upsertCrmCompany,upsertCrmIntelligence,getCrmCompany} from '../src/crm.js';
const require=createRequire(import.meta.url),D=require('../../customer/discovery-engine.js'),Crm=require('../../customer/crm-engine.js'),receipts=require('../../customer/test/helpers/buyer-research-receipts.cjs');
export async function paidFixture(t,{email=true,phone=true,limit=2,intent=true}={}){
 const f=await buyerJobsFixture(t),c=paidCandidate();
 const context={workspaceId,userId:f.users.owner.id,role:'owner'},company=(await upsertCrmCompany(f.env.DB,context,{company:c.company,domain:c.domain})).company;c.crmId=company.id;await upsertCrmIntelligence(f.env.DB,context,c.crmId,Crm.mapDiscoveryCandidateToCrm(c).intelligence);
 f.DB.raw.prepare('INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,approved_by) VALUES(?,?,?,\'treg\',10,100,?,?)').run(workspaceId,Number(email),Number(phone),limit,f.users.owner.id);
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,{candidate:c,paidResearch:intent});f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='paid',result_json=? WHERE id=?").run(JSON.stringify(c),job.id);
 return {...f,c,job,context};
}
test('the owner can configure the retained ten-buyer pool without raising other saved limits',async t=>{
 const f=await buyerJobsFixture(t),context={workspaceId,userId:f.users.owner.id,role:'owner'};const policy=await saveAdditionalContactPolicy(f.env,context,{provider:'apollo',enabled:false,phoneEnabled:false,dailyLimit:3,monthlyLimit:30,maxPerCompany:10});assert.equal(policy.maxPerCompany,10);assert.equal(policy.dailyLimit,3);assert.equal(policy.enabled,false);
});
test('a saved job automatically continues both enabled paid channels beyond the first buyer',async t=>{
 const f=await paidFixture(t),calls=[];for(let i=0;i<5;i++)await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:2000,services:{paidLookup:async(_env,_context,_company,input)=>{calls.push(input);return {request:{status:'not_found'},research:{provider:'treg',status:'not_found'}};}}});
 const detail=await getCrmCompany(f.env.DB,f.context,f.c.crmId),s=detail.intelligence.research_snapshot,a={...f.c,...s,people:s.buyerResearch.buyers,publicResearch:s.buyerResearch.publicResearch,buyerDiscovery:s.buyerResearch.discovery};assert.equal(new Set(calls.map(c=>c.person_id)).size,2,JSON.stringify(a.people.map(p=>({id:p.id,reason:globalThis.LeadIntelAdditionalContactPolicy.readiness(a,p,{provider:'treg',automatic:true})})))); assert.ok(calls.every(c=>c.automatic===true&&c.email_lookup===true&&c.phone_approved===true));const row=await readBuyerJob(f.env,workspaceId,{id:f.job.id});assert.equal(row.phase,'done');assert.notEqual(row.status,'complete','paid no-results do not manufacture completion');
});
test('real paid lookup accounting, CRM email confirmation and contact data survive worker restart without duplicate provider calls',async t=>{
 const f=await paidFixture(t),calls=[],paidLookup=await controlledLookup(f,calls);
 for(let i=0;i<5;i++)await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:3000,services:{paidLookup}});
 const detail=await getCrmCompany(f.env.DB,f.context,f.c.crmId);assert.equal(detail.contacts.filter(c=>globalThis.LeadIntelContactPolicy.accepted(c,f.c.domain,'provider_verified')).length,2,JSON.stringify((await readBuyerJob(f.env,workspaceId,{id:f.job.id})).result_json));assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,2);assert.equal(calls.filter(c=>c.url.includes('email.find')).length,2);assert.equal(calls.filter(c=>c.url.includes('phone.find')).length,2);const before=calls.length;await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:1000,services:{paidLookup}});assert.equal(calls.length,before);
});
for(const [email,phone] of [[false,false],[true,false],[false,true]])test(`saved channel permissions dispatch only email=${email}, phone=${phone}`,async t=>{
 const f=await paidFixture(t,{email,phone}),calls=[],paidLookup=await controlledLookup(f,calls);for(let i=0;i<4;i++)await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:3000,services:{paidLookup}});assert.equal(calls.some(c=>c.url.includes('email.find')),email);assert.equal(calls.some(c=>c.url.includes('phone.find')),phone);if(!email)assert.equal(calls.some(c=>c.url.includes('people.enrich')),false);
});
test('a free-only research request cannot spend saved paid permissions',async t=>{
 const f=await paidFixture(t,{intent:false});await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:1000,services:{paidLookup:async()=>assert.fail('Free-only jobs cannot dispatch paid research')}});const c=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:f.job.id})).result_json);assert.equal(c.publicResearch.paidResearch.status,'disabled');
});
test('a manual CRM research change after job creation blocks overwrite and provider spending',async t=>{
 const f=await paidFixture(t);f.DB.raw.prepare("UPDATE crm_intelligence SET research_snapshot_json=json_set(research_snapshot_json,'$.buyerResearch.buyers[0].title','Changed role') WHERE company_id=?").run(f.c.crmId);await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:1000,services:{paidLookup:async()=>assert.fail('Changed CRM research cannot dispatch')}});assert.equal(JSON.parse((await readBuyerJob(f.env,workspaceId,{id:f.job.id})).result_json).publicResearch.paidResearch.status,'blocked');assert.equal((await getCrmCompany(f.env.DB,f.context,f.c.crmId)).intelligence.research_snapshot.buyerResearch.buyers[0].title,'Changed role');
});
test('daily budget exhaustion stops the real provider adapter and preserves its prior verified contact',async t=>{
 const f=await paidFixture(t),calls=[],paidLookup=await controlledLookup(f,calls);f.DB.raw.prepare('UPDATE additional_contact_policies SET daily_limit=1 WHERE workspace_id=?').run(workspaceId);for(let i=0;i<4;i++)await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:3000,services:{paidLookup}});assert.equal(calls.filter(c=>c.url.includes('email.find')).length,1);const c=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:f.job.id})).result_json);assert.equal(c.publicResearch.paidResearch.status,'blocked');assert.match(c.publicResearch.paidResearch.reason,/daily|limit/i);assert.equal((await getCrmCompany(f.env.DB,f.context,f.c.crmId)).contacts.filter(c=>c.email_status==='verified').length,1);
});
test('revoked phone consent is rechecked before a later buyer and cannot purchase its phone channel',async t=>{
 const f=await paidFixture(t),calls=[],paidLookup=await controlledLookup(f,calls);await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:3000,services:{paidLookup}});f.DB.raw.prepare('UPDATE additional_contact_policies SET phone_enabled=0 WHERE workspace_id=?').run(workspaceId);for(let i=0;i<3;i++)await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:3000,services:{paidLookup}});assert.equal(calls.filter(c=>c.url.includes('email.find')).length,2);assert.equal(calls.filter(c=>c.url.includes('phone.find')).length,1);
});
test('a newer paid permission cannot upgrade an earlier explicitly free-only request',async t=>{
 const f=await paidFixture(t,{intent:false});f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='review' WHERE id=?").run(f.job.id);await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:3000,services:{review:async()=>({provider:'controlled',supervisor:{status:'complete',reviewedPersonIds:f.c.people.map(p=>p.id),findings:[]},conflicts:[]}),paidLookup:async()=>assert.fail('Free-only intent cannot adopt paid settings')}});assert.equal((await readBuyerJob(f.env,workspaceId,{id:f.job.id})).phase,'done');
});
test('paid outcomes and company binding survive normalized workspace serialization',async t=>{
 const f=await paidFixture(t),calls=[],paidLookup=await controlledLookup(f,calls);await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:3000,services:{paidLookup}});const c=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:f.job.id})).result_json),saved=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0];assert.equal(saved.publicResearch.paidResearch.companyId,f.c.crmId);assert.equal(saved.publicResearch.paidResearch.outcomes.length,1);assert.equal(saved.publicResearch.paidResearch.outcomes[0].personId,'buyer-0');
});

test('automatic workflow checks every approved buyer before selecting a message recipient',async t=>{
 const f=await paidFixture(t,{limit:4}),calls=[],paidLookup=await controlledLookup(f,calls),{buyerPaidIntent,runWorkflowPaidResearch}=await import('../src/buyer-paid-research.js');
 const guard=async()=>{};guard.writeAuthority=()=>({sql:'1',args:[]});
 await runWorkflowPaidResearch(f.env,f.context,f.c,{intent:await buyerPaidIntent(f.env,workspaceId,true,f.c),runId:'controlled-workflow',guard,lookup:paidLookup});
 assert.equal(calls.filter(c=>c.url.includes('email.find')).length,4);assert.equal(calls.filter(c=>c.url.includes('phone.find')).length,4);assert.equal((await getCrmCompany(f.env.DB,f.context,f.c.crmId)).contacts.filter(c=>c.email_status==='verified').length,4);
});

test('confirmed phones do not consume automatic missing-phone target slots',async t=>{
 const f=await paidFixture(t,{email:false,phone:true,limit:2}),calls=[],paidLookup=await controlledLookup(f,calls),stamp=new Date().toISOString(),id=f.c.people[0].id;
 const rows=[{url:'https://forge.example/team',sourceRead:true,extractedAt:stamp,markdown:'### Anna Buyer\nProcurement Director\nPhone: +46 70 111 11 11\nForge Industries'}];
 Object.assign(f.c.people[0],D.discoverCompanyContacts(rows,f.c).find(p=>p.name==='Anna Buyer'),{id});
 f.c.publicResearch.aiReview.inputSignature=D.buyerReviewSignature(f.c);assert.ok(D.confirmedBuyerPhone(f.c,f.c.people[0]),JSON.stringify(f.c.people[0]));
 await upsertCrmIntelligence(f.env.DB,f.context,f.c.crmId,Crm.mapDiscoveryCandidateToCrm(f.c).intelligence);
 const {buyerPaidIntent}=await import('../src/buyer-paid-research.js'),input=JSON.parse(f.DB.raw.prepare('SELECT input_json FROM buyer_research_jobs WHERE id=?').get(f.job.id).input_json);input.paidResearch=await buyerPaidIntent(f.env,workspaceId,true,f.c);f.DB.raw.prepare('UPDATE buyer_research_jobs SET input_json=?,result_json=? WHERE id=?').run(JSON.stringify(input),JSON.stringify(f.c),f.job.id);
 for(let i=0;i<4;i++)await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:3000,services:{paidLookup}});
 assert.equal(calls.filter(c=>c.url.includes('phone.find')).length,2,JSON.stringify((await readBuyerJob(f.env,workspaceId,{id:f.job.id})).result_json));
});

test('pending lookup at the approved company cap resumes the same person before applying the new-person limit',async t=>{
 const f=await paidFixture(t,{limit:1}),calls=[];const paidLookup=async(_env,_ctx,_company,input)=>{calls.push(input.person_id);return {request:{status:calls.length===1?'processing':'not_found'},research:{status:calls.length===1?'processing':'not_found'}};};
 for(let i=0;i<3;i++)await runBuyerResearchJobs(f.env,{jobId:f.job.id,maxJobs:1,windowMs:1000,services:{paidLookup}});assert.deepEqual(calls,['buyer-0','buyer-0']);assert.equal(JSON.parse((await readBuyerJob(f.env,workspaceId,{id:f.job.id})).result_json).publicResearch.paidResearch.status,'complete');
});

test('a post-provider manual qualification hold survives final workflow persistence and blocks stale selection',async t=>{
 const f=await paidFixture(t,{limit:1}),calls=[],real=await controlledLookup(f,calls),{buyerPaidIntent,runWorkflowPaidResearch}=await import('../src/buyer-paid-research.js'),{persistWorkflowBuyerResearch}=await import('../src/approved-workflow-runner.js'),guard=async()=>{};guard.writeAuthority=()=>({sql:'1',args:[]});
 const lookup=async(...args)=>{const value=await real(...args);f.DB.raw.prepare("UPDATE crm_intelligence SET research_snapshot_json=json_set(research_snapshot_json,'$.buyerResearch.buyers[0].roleReview',json(?)) WHERE company_id=?").run(JSON.stringify({version:1,status:'conflict',reason:'Manual current role conflict',checkedAt:new Date().toISOString(),sources:[]}),f.c.crmId);return value;};
 const report=await runWorkflowPaidResearch(f.env,f.context,f.c,{intent:await buyerPaidIntent(f.env,workspaceId,true,f.c),runId:'held-workflow',guard,lookup});assert.equal(report.code,'PAID_SCOPE_CHANGED');assert.equal(await persistWorkflowBuyerResearch(f.env,f.context,f.c,guard),false);assert.equal((await getCrmCompany(f.env.DB,f.context,f.c.crmId)).intelligence.research_snapshot.buyerResearch.buyers[0].roleReview.status,'conflict');assert.equal(calls.filter(c=>c.url.includes('email.find')).length,1);
});

test('a post-provider current-employer conflict cannot preserve stale recipient eligibility',async t=>{
 const f=await paidFixture(t,{limit:1}),calls=[],real=await controlledLookup(f,calls),{buyerPaidIntent,runWorkflowPaidResearch}=await import('../src/buyer-paid-research.js'),{persistWorkflowBuyerResearch}=await import('../src/approved-workflow-runner.js'),guard=async()=>{};guard.writeAuthority=()=>({sql:'1',args:[]});
 const lookup=async(...args)=>{const value=await real(...args);f.DB.raw.prepare("UPDATE crm_intelligence SET research_snapshot_json=json_set(research_snapshot_json,'$.buyerResearch.publicResearch.conflicts',json(?)) WHERE company_id=?").run(JSON.stringify([{person_id:'buyer-0',reason:'Current employer conflict'}]),f.c.crmId);return value;};
 const report=await runWorkflowPaidResearch(f.env,f.context,f.c,{intent:await buyerPaidIntent(f.env,workspaceId,true,f.c),runId:'held-workflow',guard,lookup});assert.equal(report.code,'PAID_SCOPE_CHANGED');assert.equal(await persistWorkflowBuyerResearch(f.env,f.context,f.c,guard),false);assert.equal((await getCrmCompany(f.env.DB,f.context,f.c.crmId)).intelligence.research_snapshot.buyerResearch.publicResearch.conflicts[0].reason,'Current employer conflict');assert.equal(calls.filter(c=>c.url.includes('email.find')).length,1);
});

test('revocation settles an already pending workflow continuation without new paid dispatch',async t=>{
 const f=await paidFixture(t,{limit:1}),{buyerPaidIntent,runWorkflowPaidResearch}=await import('../src/buyer-paid-research.js'),guard=async()=>{};guard.writeAuthority=()=>({sql:'1',args:[]});const intent=await buyerPaidIntent(f.env,workspaceId,true,f.c);let calls=0;
 await runWorkflowPaidResearch(f.env,f.context,f.c,{intent,runId:'revoked-workflow',guard,lookup:async()=>{calls++;return {request:{status:'processing'}};}});f.DB.raw.prepare('UPDATE additional_contact_policies SET enabled=0,phone_enabled=0 WHERE workspace_id=?').run(workspaceId);
 const report=await runWorkflowPaidResearch(f.env,f.context,f.c,{intent,runId:'revoked-workflow',guard,lookup:async()=>assert.fail('Revoked consent cannot dispatch')});assert.equal(report.status,'disabled');assert.equal(calls,1);
});

test('capacity migration preserves existing owner permissions, limits and timestamps',async t=>{
 const f=await paidFixture(t,{limit:1}),before=f.DB.raw.prepare('SELECT * FROM additional_contact_policies WHERE workspace_id=?').get(workspaceId),fs=await import('node:fs');f.DB.raw.exec(fs.readFileSync(new URL('../migrations/0068_paid_buyer_capacity.sql',import.meta.url),'utf8'));assert.deepEqual(f.DB.raw.prepare('SELECT * FROM additional_contact_policies WHERE workspace_id=?').get(workspaceId),before);f.DB.raw.prepare('UPDATE additional_contact_policies SET max_per_company=10 WHERE workspace_id=?').run(workspaceId);assert.equal(f.DB.raw.prepare('SELECT max_per_company n FROM additional_contact_policies WHERE workspace_id=?').get(workspaceId).n,10);
});

test('saved market changes are included in current eligibility and cannot reuse a prior paid scope',async t=>{
 const f=await paidFixture(t),{paidBuyerScope,paidSnapshotCandidate}=await import('../src/buyer-paid-research.js');f.c.market='Sweden';f.c.people[0].country='Sweden';await upsertCrmIntelligence(f.env.DB,f.context,f.c.crmId,Crm.mapDiscoveryCandidateToCrm(f.c).intelligence);const detail=await getCrmCompany(f.env.DB,f.context,f.c.crmId);assert.equal(paidBuyerScope(paidSnapshotCandidate(f.c,detail)),paidBuyerScope(f.c));detail.intelligence.research_snapshot.market='Finland';const active=paidSnapshotCandidate(f.c,detail);assert.equal(active.market,'Finland');assert.notEqual(paidBuyerScope(active),paidBuyerScope(f.c));assert.equal(D.qualifyBuyer(active.people[0],{decisionMakers:active.buyerRoles},active).eligible,false);
});
