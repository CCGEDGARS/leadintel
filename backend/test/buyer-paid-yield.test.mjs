import test from 'node:test';import assert from 'node:assert/strict';
import {buyerJobsFixture,workspaceId} from './buyer-research-jobs-fixture.mjs';
import {paidCandidate} from './paid-candidate-fixture.mjs';
import {upsertCrmCompany,upsertCrmIntelligence} from '../src/crm.js';
import {lookupAdditionalEmail} from '../src/additional-contact-services.js';
import '../../customer/crm-engine.js';

test('an interrupted paid email-only worker resumes its existing billed reservation instead of freezing it as needs-review',async t=>{
 const f=await buyerJobsFixture(t),c=paidCandidate(),context={workspaceId,userId:f.users.owner.id,role:'owner'},company=(await upsertCrmCompany(f.env.DB,context,{company:c.company,domain:c.domain})).company;await upsertCrmIntelligence(f.env.DB,context,company.id,globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(c).intelligence);
 f.DB.raw.prepare("INSERT INTO additional_contact_policies(workspace_id,enabled,phone_enabled,provider,daily_limit,monthly_limit,max_per_company,approved_by) VALUES(?,1,0,'treg',1,10,1,?)").run(workspaceId,f.users.owner.id);
 let calls=0;const credential=async()=>({configured:true,source:'customer',apiKey:'controlled'}),input={person_id:c.people[0].id,provider:'treg',automatic:true,email_lookup:true};
 await assert.rejects(lookupAdditionalEmail(f.env,context,company.id,input,{credential,findTreg:async(_e,_ctx,_c,_p,_id,options)=>{calls++;await options.onDispatch({phase:'find'});throw Object.assign(Error('Controlled invocation budget yield'),{code:'TIME_BUDGET'});}}),{code:'TIME_BUDGET'});
 assert.equal(f.DB.raw.prepare('SELECT status FROM additional_contact_attempts').get().status,'retryable');
 await lookupAdditionalEmail(f.env,context,company.id,input,{credential,findTreg:async()=>{calls++;return {request:{status:'not_found'},research:{provider:'treg',status:'not_found'}};}});assert.equal(calls,2);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM additional_contact_attempts').get().n,1,'Resume reuses the existing daily reservation');
});
