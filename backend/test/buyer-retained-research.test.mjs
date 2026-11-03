import test from 'node:test';
import assert from 'node:assert/strict';
import retainedFixture from '../../customer/test/fixtures/buyer-retained-research.cjs';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {putCustomerState} from '../src/customer-state.js';
import {startBuyerJob,readBuyerJob,publicBuyerJob} from '../src/buyer-research-store.js';
import {runBuyerResearchJobs} from '../src/buyer-research-runner.js';
const D=globalThis.LeadIntelDiscovery;
async function history(t){
 const f=await buyerJobsFixture(t),{c}=retainedFixture({company:'Forge Industries',domain:'forge.example'});f.payload.discovery.selectedProspects=[c];await putCustomerState(f.env,{workspaceId,userId:f.users.owner.id,expectedVersion:1,payload:f.payload});
 const old=await startBuyerJob(f.env,workspaceId,f.users.owner,{candidate:c});f.DB.raw.prepare("UPDATE buyer_research_jobs SET status='needs_review',phase='done',result_json=? WHERE id=?").run(JSON.stringify(c),old.id);
 const current=await startBuyerJob(f.env,workspaceId,f.users.owner,{candidate:c,force:true,jobId:old.id,expectedRevision:old.revision});return {...f,c,old,current};
}
test('a domain lookup recovers fresh same-person source facts from earlier owned jobs without changing execution receipts',async t=>{
 const f=await history(t),before=f.DB.raw.prepare('SELECT total_changes() n').get().n,view=await publicBuyerJob(f.env,f.current,{recoverRetained:true});
 assert.equal(D.confirmedBuyerShortlist(view.candidate.people,{decisionMakers:f.c.buyerRoles},view.candidate).priorityIds.length,4);assert.equal(view.candidate.buyerDiscovery.officialContactInventory.channels.length,4);assert.equal(view.candidate.publicResearch.accountability,undefined,'an older report does not impersonate this new execution');assert.equal(view.quality.researchPassed,false);assert.equal(f.DB.raw.prepare('SELECT total_changes() n').get().n,before,'restoration is read-only');assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM buyer_research_tasks').get().n,0);
});
test('recovery never adds removed people or overrides a rejected exact-email binding',async t=>{
 const f=await history(t),candidate=JSON.parse(f.current.result_json);candidate.people=candidate.people.slice(0,2);candidate.people[0].publicEmailSourceCheck={status:'failed',email:candidate.people[0].publicEmail,url:candidate.people[0].publicEmailUrl,checkedAt:new Date().toISOString()};f.DB.raw.prepare('UPDATE buyer_research_jobs SET result_json=? WHERE id=?').run(JSON.stringify(candidate),f.current.id);
 const view=await publicBuyerJob(f.env,await readBuyerJob(f.env,workspaceId,{id:f.current.id}),{recoverRetained:true});assert.equal(view.candidate.people.length,2);assert.equal(D.acceptedOfficialBuyerEmail(view.candidate,view.candidate.people[0]),'');assert.equal(D.acceptedOfficialBuyerEmail(view.candidate,view.candidate.people[1]),'bo.lind@forge.example');
});
test('official source-task reads appear in the current job accounting before person checks begin',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);await runBuyerResearchJobs(f.env,{jobId:job.id,maxJobs:1,windowMs:2000,services:{search:async()=>[],read:async url=>({url,markdown:'### Robert Lund\nHead of Procurement\nrobert.lund@forge.example',metadata:{sourceURL:url,source:'direct-fallback'}})}});
 const saved=JSON.parse((await readBuyerJob(f.env,workspaceId,{id:job.id})).result_json);assert.equal(saved.publicResearch.accountability.officialPages,2);assert.equal(saved.publicResearch.accountability.officialPageReads.length,2);assert.equal(saved.publicResearch.accountability.checkedPeople,0);
});

test('a completed bounded two-provider dossier attempt does not strand contact acquisition on a partial dossier',async t=>{
 const f=await buyerJobsFixture(t),job=await startBuyerJob(f.env,workspaceId,f.users.owner,f.body);f.DB.raw.prepare("UPDATE buyer_research_jobs SET phase='dossier' WHERE id=?").run(job.id);
 await runBuyerResearchJobs(f.env,{jobId:job.id,maxJobs:1,windowMs:2000,services:{dossier:async()=>({status:'partial',continuation:false,gaps:['A source was unavailable'],passes:[{provider:'openai',status:'partial'},{provider:'gemini',status:'partial'}]})}});
 const row=await readBuyerJob(f.env,workspaceId,{id:job.id});assert.equal(row.phase,'identities');assert.equal(JSON.parse(row.result_json).buyerDiscovery.companyDossier.status,'partial');assert.notEqual(row.status,'complete');
});
test('history from a changed seller context or another workspace cannot restore source proof',async t=>{
 const f=await history(t),input=JSON.parse(f.old.input_json);input.workspaceContext='another-seller-context';f.DB.raw.prepare('UPDATE buyer_research_jobs SET input_json=? WHERE id=?').run(JSON.stringify(input),f.old.id);
 const view=await publicBuyerJob(f.env,f.current,{recoverRetained:true});assert.equal(D.confirmedBuyerShortlist(view.candidate.people,{decisionMakers:f.c.buyerRoles},view.candidate).priorityIds.length,0);
 f.DB.raw.prepare('UPDATE buyer_research_jobs SET workspace_id=?,input_json=? WHERE id=?').run('storage-w2',f.old.input_json,f.old.id);const foreign=await publicBuyerJob(f.env,f.current,{recoverRetained:true});assert.equal(D.confirmedBuyerShortlist(foreign.candidate.people,{decisionMakers:f.c.buyerRoles},foreign.candidate).priorityIds.length,0);
});
