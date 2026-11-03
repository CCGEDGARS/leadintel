import test from 'node:test';
import app from '../src/app.js';
import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {paidCandidate} from './paid-candidate-fixture.mjs';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {paidBuyerScope,paidSnapshotCandidate} from '../src/buyer-paid-research.js';
import {upsertCrmCompany,upsertCrmIntelligence,getCrmCompany} from '../src/crm.js';
import '../../customer/crm-engine.js';

for(const change of ['none','before_repair','during_repair','after_repair','evidence_after_repair'])test(`a legacy paid timeout preserves its saved intent with CRM change=${change}`,async t=>{
 const f=await buyerJobsFixture(t),c=paidCandidate(),context={workspaceId,userId:f.users.owner.id,role:'owner'};
 const company=(await upsertCrmCompany(f.env.DB,context,{company:c.company,domain:c.domain})).company;c.crmId=company.id;
 // Runtime-created checks contain channels; the paid fixture helper only supplies receipts.
 c.people.forEach(p=>p.contactResearch.channels={});
 await upsertCrmIntelligence(f.env.DB,context,c.crmId,globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(c).intelligence);
 f.DB.raw.prepare("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,approved_by) VALUES(?,1,0,'treg',10,100,2,?)").run(workspaceId,f.users.owner.id);
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,{candidate:c,paidResearch:true});
 c.publicResearch.accountability.status='partial';c.publicResearch.accountability.stopReason='time_budget';
 c.people.forEach(p=>p.contactResearch.checks.gmail.status='partial');
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='paid',input_json=json_remove(input_json,'$.contactContinuationVersion'),result_json=? WHERE id=?").run(JSON.stringify(c),job.id);
 let calls=0;
 const services={search:async()=>[],read:async url=>({url,markdown:c.people.map(p=>`### ${p.name}\n${p.title}\nForge Industries`).join('\n\n'),metadata:{sourceURL:url}}),independent:async()=>({status:'not_configured',results:[]}),review:async()=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:c.people.map(p=>p.id),findings:[]},conflicts:[]}),paidLookup:async()=>{calls++;return {request:{status:'not_found'},research:{status:'not_found'}};}};
 const tick=async()=>{const waits=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,maxJobs:1,jobId:job.id,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);};
 const edit=()=>f.DB.raw.prepare("UPDATE crm_intelligence SET research_snapshot_json=json_set(research_snapshot_json,'$.buyerResearch.buyers[0].title','Manual title') WHERE company_id=?").run(c.crmId);
 await tick(); // Old paid phase publishes its own partial CRM snapshot, then correctly blocks spending.
 const before=await readBuyerJob(f.env,workspaceId,{id:job.id}),prior=JSON.parse(before.result_json),detail=await getCrmCompany(f.env.DB,context,c.crmId);
 assert.equal(before.phase,'done');assert.equal(before.status,'needs_review');assert.equal(calls,0);
 assert.equal(detail.intelligence.research_snapshot.buyerResearch.jobId,job.id);
 assert.equal(paidBuyerScope(paidSnapshotCandidate(prior,detail)),paidBuyerScope(prior),'The CRM evidence is exactly the job own pre-repair evidence; no external edit occurred');
 if(change==='before_repair')edit();
 if(change==='during_repair'){const prepare=f.DB.prepare.bind(f.DB);let changed=false;t.mock.method(f.DB,'prepare',sql=>{if(!changed&&sql.startsWith('UPDATE buyer_research_jobs SET input_json=')){changed=true;edit();}return prepare(sql);});}
 await tick(); // Repair and public contact checks.
 if(change==='during_repair'){assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).status,'needs_review','A CRM edit during repair must defeat its captured-scope CAS');await tick();}
 if(change==='after_repair')edit();
 if(change==='evidence_after_repair')f.DB.raw.prepare("UPDATE crm_intelligence SET evidence_json=? WHERE company_id=?").run(JSON.stringify([{url:'https://forge.example/new-evidence',text:'Manual source evidence'}]),c.crmId);
 const recovered=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);
 assert.equal(recovered.publicResearch.accountability.status,'complete');assert.equal(recovered.publicResearch.accountability.checkedPeople,4);
 await tick(); // Current AI review.
 assert.equal((await readBuyerJob(f.env,workspaceId,{id:job.id})).phase,'paid');
 await tick(); // Saved paid intent must continue, guarded by unchanged original CRM scope.
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id}),result=JSON.parse(saved.result_json);
 t.diagnostic(JSON.stringify({calls,status:saved.status,phase:saved.phase,coverage:result.publicResearch.accountability.status,paidCode:result.publicResearch.paidResearch.code}));
 if(change==='none'){assert.ok(calls>0,'The paid stage must refresh its own unchanged prior CRM scope and continue saved intent');assert.notEqual(result.publicResearch.paidResearch.code,'PAID_SCOPE_CHANGED');await tick();await tick();assert.equal(calls,2,'Recovery retains the saved two-buyer paid limit');}
 else{assert.equal(calls,0,'A genuine CRM edit cannot be overwritten or authorize provider dispatch');assert.equal(result.publicResearch.paidResearch.code,'PAID_SCOPE_CHANGED');const latest=await getCrmCompany(f.env.DB,context,c.crmId);if(change==='evidence_after_repair')assert.equal(latest.intelligence.evidence[0].text,'Manual source evidence');else assert.equal(latest.intelligence.research_snapshot.buyerResearch.buyers[0].title,'Manual title');}
});
