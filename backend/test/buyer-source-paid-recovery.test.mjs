import test from 'node:test';import assert from 'node:assert/strict';
import app from '../src/app.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {paidCandidate} from './paid-candidate-fixture.mjs';
import {startBuyerJob,readBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {paidBuyerScope,paidSnapshotCandidate} from '../src/buyer-paid-research.js';
import {upsertCrmCompany,upsertCrmIntelligence,getCrmCompany} from '../src/crm.js';
import '../../customer/crm-engine.js';
for(const changed of [false,true])test(`active v4 paid source-plan recovery preserves original own-CRM authority: changed=${changed}`,async t=>{
 const f=await buyerJobsFixture(t),D=globalThis.LeadIntelDiscovery,c=paidCandidate(),context={workspaceId,userId:f.users.owner.id,role:'owner'},stamp=new Date().toISOString();
 c.people.forEach(p=>p.contactResearch.channels={});
 c.buyerDiscovery.officialContactInventory={version:1,domain:c.domain,companyName:c.company,checkedAt:stamp,sourcePages:['https://forge.example/'],sourceEvidence:[],contacts:[],channels:[],routes:[],research:{policyVersion:D.OFFICIAL_CONTACT_RESEARCH_POLICY.version,discoveryScope:'20261103-contact-links-v1',startedAt:stamp,status:'partial',completedUrls:['https://forge.example/'],pendingUrls:[],queries:D.officialContactResearchQueries(c).map(query=>({query,status:'complete',results:0})),reads:[{url:'https://forge.example/',status:'complete'}],failures:[],discoveryTruncated:true}};
 c.publicResearch.aiReview.inputSignature=D.buyerReviewSignature(c);
 const company=(await upsertCrmCompany(f.env.DB,context,{company:c.company,domain:c.domain})).company;c.crmId=company.id;
 await upsertCrmIntelligence(f.env.DB,context,c.crmId,globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(c).intelligence);
 f.DB.raw.prepare("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,approved_by) VALUES(?,1,0,'treg',10,100,2,?)").run(workspaceId,f.users.owner.id);
 const job=await startBuyerJob(f.env,workspaceId,f.users.owner,{candidate:c,paidResearch:true});
 const own=globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(c).intelligence;own.research_snapshot.buyerResearch.jobId=job.id;await upsertCrmIntelligence(f.env.DB,context,c.crmId,own);
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='paid',input_json=json_set(input_json,'$.contactSourceScope','20261103-contact-links-v1','$.executionContinuationVersion',4),result_json=? WHERE id=?").run(JSON.stringify(c),job.id);
 const detail=await getCrmCompany(f.env.DB,context,c.crmId);assert.equal(paidBuyerScope(paidSnapshotCandidate(c,detail)),paidBuyerScope(c));
 if(changed){const edited=structuredClone(own);edited.research_snapshot.buyerResearch.buyers[0].name='Changed Recipient';await upsertCrmIntelligence(f.env.DB,context,c.crmId,edited);}
 const beforeCrm=f.DB.raw.prepare('SELECT research_snapshot_json,evidence_json FROM crm_intelligence WHERE workspace_id=? AND company_id=?').get(workspaceId,c.crmId);
 let calls=0;const dispatchCoverage=[];const services={search:async()=>[],read:async url=>({url,markdown:c.people.map(p=>`### ${p.name}\n${p.title}\nForge Industries`).join('\n\n'),metadata:{sourceURL:url}}),dossier:async()=>({status:'complete',people:[],facts:[],channels:[],sources:[],passes:[]}),independent:async()=>({status:'not_configured',results:[]}),review:async()=>({provider:'controlled-review',supervisor:{status:'complete',reviewedPersonIds:c.people.map(p=>p.id),findings:[]},conflicts:[]}),paidLookup:async()=>{const active=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);calls++;dispatchCoverage.push({official:D.officialContactCoveragePassed(active),people:D.buyerResearchCoveragePassed(active)});return {request:{status:'not_found'},research:{status:'not_found'}};}};
 for(let i=0;i<10;i++){const waits=[],noop=async()=>({completed:0});await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>waits.push(p)},{runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,maxJobs:1,jobId:job.id,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});await Promise.all(waits);const j=await readBuyerJob(f.env,workspaceId,{id:job.id}),r=JSON.parse(j.result_json);if(i===0)assert.equal(calls,0,'Holding the original paid scope cannot dispatch before the free source repair');}
 const final=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);if(changed){assert.equal(calls,0);assert.equal(final.publicResearch.paidResearch?.code,'PAID_SCOPE_CHANGED');assert.deepEqual(f.DB.raw.prepare('SELECT research_snapshot_json,evidence_json FROM crm_intelligence WHERE workspace_id=? AND company_id=?').get(workspaceId,c.crmId),beforeCrm);}else{assert.notEqual(final.publicResearch.paidResearch?.code,'PAID_SCOPE_CHANGED');assert.ok(calls>0&&calls<=2,'The original enabled channel resumes within its saved two-person limit');assert.ok(dispatchCoverage.every(check=>check.official&&check.people),'Every actual dispatch waits for current official and per-person free coverage');}
});
