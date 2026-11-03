import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import app from '../src/app.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
import {readBuyerJob,startBuyerJob} from '../src/buyer-research-store.js';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {upsertCrmCompany,upsertCrmIntelligence,getCrmCompany} from '../src/crm.js';
import {paidBuyerScope,paidSnapshotCandidate} from '../src/buyer-paid-research.js';
import {sha256} from '../src/security.js';
import '../../customer/crm-engine.js';
const require=createRequire(import.meta.url),D=require('../../customer/discovery-engine.js'),C=require('../../customer/company-dossier.js'),receipts=require('../../customer/test/helpers/buyer-research-receipts.cjs');

async function scheduledSlice(f,id,services){
 const pending=[],noop=async()=>({completed:0});
 await app.scheduled({cron:'* * * * *',scheduledTime:Date.now()},f.env,{waitUntil:p=>pending.push(p)},{runBuyerResearchJobs:(env,options)=>runBuyerResearchJobs(env,{...options,jobId:id,maxJobs:1,services}),runWritingReferenceJobs:noop,runWorkspaceSkillJobs:noop,runCompanyMaterialJobs:noop,runLanguagePackJobs:noop});
 await Promise.all(pending);
}

for(const originalStatus of ['needs_review','complete','queued_paid','queued_paid_enabled','queued_paid_enabled_hold'])test(`actual scheduler refreshes stale semantic review from legacy ${originalStatus} without replaying completed source work`,async t=>{
 const queuedPaid=originalStatus.startsWith('queued_paid'),enabledPaid=originalStatus.includes('_enabled'),derivedHold=originalStatus==='needs_review'||originalStatus.endsWith('_hold');
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body),input=JSON.parse(job.input_json),stamp=new Date().toISOString();
 const candidate=structuredClone(f.candidate),person=candidate.people[0],url=person.publicNameUrl,quote=`${person.name} is ${person.title} at ${candidate.company}.`;
 Object.assign(person,{identityStatus:'confirmed',nameVerification:'confirmed',emailResearch:{status:'complete',checkedAt:stamp,searches:9,failed:0}});
 candidate.publicResearch={accountability:{...D.createBuyerResearchAccountability(),status:'complete',checkedPeople:1,totalPeople:1,completedAt:stamp}};receipts(candidate,stamp);person.contactResearch.channels={};
 if(enabledPaid)candidate.qualification={eligible:true,companyScore:85,score:85,researchedAt:stamp};
 await D.runOfficialContactResearch(candidate,{search:async()=>[],readPage:async source=>({url:source,markdown:quote,sourceRead:true,extractedAt:stamp})});
 const context={...candidate,formulas:D.buyerResearchPlan(candidate,input.profile).dossierFormulas},plan=C.researchPlan(context);
 const passes=['openai','gemini'].map(provider=>{
  const validated=C.validatePass({provider,webSearch:true,people:[{name:person.name,title:person.title,status:'current',sourceUrl:url,quote}]},[{url,text:quote}],context);
  return {...validated,planSignature:plan.signature,searchFamilies:plan.families.map(family=>({name:family.name,kind:family.kind,query:family.kind==='formula'?`Research ${candidate.company}\nSearch formula: ${family.formula}\nReturn source quotes.`:(family.kind==='contacts'?'CONTACT ROUTES':'CURRENT LEADERSHIP AND PROJECT DOSSIER')+' for '+candidate.company,status:'complete',attempts:1,completedAt:stamp,results:[{url}]})),sourceReads:[{url,status:'succeeded',checkedAt:stamp}],extractedSources:[url]};
 });
 candidate.buyerDiscovery.companyDossier=C.reconcile(passes,context);
 if(derivedHold)person.opportunityScope={status:'review_required',reason:'Dossier role conflict requires review',checkedAt:stamp};
 candidate.publicResearch.buyerAgent={version:D.BUYER_AGENT_VERSION,status:derivedHold?'needs_review':'checked',checkedAt:stamp,context:D.buyerAgentContext(candidate,input.profile),people:[{personId:person.id,name:person.name,identity:derivedHold?'conflict':'supported',checks:'complete',opportunity:'supported',evidence:derivedHold?[]:[{url,quote}],conflicts:derivedHold?[{url,quote:quote+' Previously, she was a manager at Other Company.'}]:[]}]};
 const legacySignature=D.buyerReviewSignature(candidate,{legacyInterpretation:true});
 candidate.publicResearch.buyerAgent.inputSignature=legacySignature;
 candidate.publicResearch.aiReview={status:'complete',provider:'original-review',checkedAt:stamp,inputSignature:legacySignature,reviewedPersonIds:[person.id],findings:[],conflicts:[]};
 const originalChecks=JSON.stringify(person.contactResearch),originalDossierCheckedAt=candidate.buyerDiscovery.companyDossier.checkedAt;
 assert.equal(D.officialContactCoveragePassed(candidate),true);assert.equal(candidate.buyerDiscovery.companyDossier.status,'complete');assert.equal(D.buyerResearchCoveragePassed(candidate),true);
 const projected=D.reconcileBuyerEvidence(candidate,{trustedAgentSources:true});
 assert.equal(projected.buyerDiscovery.companyDossier.status,'complete');if(derivedHold)assert.equal(projected.people[0].opportunityScope,null);assert.equal(D.buyerQualityAssessment(projected).aiReviewStatus,'stale');
 f.DB.raw.prepare("UPDATE buyer_research_jobs SET status=?,phase=?,input_json=json_set(input_json,'$.executionContinuationVersion',1),result_json=? WHERE id=?").run(queuedPaid?'queued':originalStatus,queuedPaid?'paid':'done',JSON.stringify(candidate),job.id);
 let savedPaidIntent={provider:'treg',email:true,phone:true,companyId:'original-company',snapshotHash:'original-snapshot'};
 if(queuedPaid){
  f.DB.raw.prepare("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company) VALUES(?,?,0,'treg',3,30,2)").run(workspaceId,Number(enabledPaid));
  if(enabledPaid){
   const crmContext={workspaceId,userId:f.users.owner.id,role:'owner'},company=(await upsertCrmCompany(f.env.DB,crmContext,{company:candidate.company,domain:candidate.domain})).company;
   const intelligence=globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(candidate).intelligence;intelligence.research_snapshot.buyerResearch.jobId=job.id;
   await upsertCrmIntelligence(f.env.DB,crmContext,company.id,intelligence);
   const own=await getCrmCompany(f.env.DB,crmContext,company.id);
   assert.equal(paidBuyerScope(paidSnapshotCandidate(candidate,own)),paidBuyerScope(candidate),'Before recovery the CRM snapshot is exactly this job’s original evidence, including any derived hold');
   savedPaidIntent={...savedPaidIntent,phone:false,companyId:company.id,snapshotHash:await sha256(JSON.stringify(intelligence.research_snapshot))};
  }
  f.DB.raw.prepare("UPDATE buyer_research_jobs SET input_json=json_set(input_json,'$.paidResearch',json(?)) WHERE id=?").run(JSON.stringify(savedPaidIntent),job.id);
 }
 f.DB.raw.prepare("INSERT INTO buyer_research_tasks(job_id,task_key,kind,phase,status,attempts,result_json) VALUES(?,'saved-current-role','read','contacts','complete',1,?)").run(job.id,JSON.stringify({url,markdown:quote,sourceRead:true,extractedAt:stamp}));
 let reviewCalls=0,sourceCalls=0,paidCalls=0;const services={search:async()=>{sourceCalls++;return [];},read:async()=>{sourceCalls++;throw Error('Completed source reads must be reused');},review:async(_env,_workspace,body)=>{reviewCalls++;assert.equal(body.people[0].id,person.id);return {provider:'fresh-review',supervisor:{status:'complete',reviewedPersonIds:[person.id],findings:[]},conflicts:[]};},paidLookup:async()=>{paidCalls++;if(!enabledPaid)throw Error('Disabled paid channels cannot dispatch');return {request:{status:'not_found'},research:{status:'not_found'}};}};
 if(queuedPaid){
  await scheduledSlice(f,job.id,services);const held=await readBuyerJob(f.env,workspaceId,{id:job.id});
  assert.equal(held.status,'needs_review');assert.equal(held.phase,'done');assert.equal(reviewCalls,0);assert.equal(paidCalls,0);
  assert.equal(JSON.parse(held.input_json).executionContinuationVersion,1,'The unprocessed stale review must remain eligible for guarded own-CRM recovery');
 }
 for(let i=0;i<2&&!reviewCalls;i++)await scheduledSlice(f,job.id,services);
 if(queuedPaid)await scheduledSlice(f,job.id,services);
 const saved=await readBuyerJob(f.env,workspaceId,{id:job.id}),result=JSON.parse(saved.result_json);
 assert.equal(reviewCalls,1,'Once-only semantic recovery must execute the now-stale review: '+JSON.stringify({phase:saved.phase,status:saved.status,lastError:saved.last_error,diagnostics:JSON.parse(saved.diagnostic_json)}));assert.equal(sourceCalls,0);
 assert.equal(JSON.parse(saved.input_json).executionContinuationVersion,3);
 assert.equal(result.publicResearch.aiReview.provider,'fresh-review');assert.equal(result.publicResearch.aiReview.inputSignature,D.buyerReviewSignature(result));
 assert.equal(D.buyerQualityAssessment(result).aiReviewStatus,'complete');
 assert.equal(JSON.stringify(result.people[0].contactResearch),originalChecks,'Completed per-person checks survive the repair');
 assert.equal(result.buyerDiscovery.companyDossier.checkedAt,originalDossierCheckedAt,'Role reinterpretation cannot claim a fresh dossier execution');
 assert.equal(f.DB.raw.prepare("SELECT attempts FROM buyer_research_tasks WHERE job_id=? AND task_key='saved-current-role'").get(job.id).attempts,1);
 if(queuedPaid){
  assert.equal(paidCalls,enabledPaid?1:0);
  const actualIntent={...JSON.parse(saved.input_json).paidResearch};
  if(enabledPaid){assert.notEqual(result.publicResearch.paidResearch.code,'PAID_SCOPE_CHANGED');assert.equal(result.publicResearch.paidResearch.outcomes[0].status,'checked');assert.match(actualIntent.continuationScopeHash,/^[a-f0-9]{64}$/);delete actualIntent.continuationScopeHash;}
  else assert.equal(result.publicResearch.paidResearch.status,'disabled');
  assert.deepEqual(actualIntent,savedPaidIntent,'Review recovery cannot change original paid consent, provider, company or snapshot');
  if(!enabledPaid)assert.equal(f.DB.raw.prepare('SELECT COUNT(*) n FROM additional_contact_attempts WHERE workspace_id=?').get(workspaceId).n,0,'Disabled channels cannot reserve or spend credits');
  const policy=f.DB.raw.prepare('SELECT enabled,phone_enabled,daily_limit,monthly_limit,max_per_company FROM additional_contact_policies WHERE workspace_id=?').get(workspaceId);
  assert.deepEqual({...policy},{enabled:Number(enabledPaid),phone_enabled:0,daily_limit:3,monthly_limit:30,max_per_company:2});
 }
});
