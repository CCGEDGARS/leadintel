import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {step6Fixture,reviewedLinkedInUrl} from './step6-journey-fixture.mjs';
import {loadPlaywright,workspaceId,sessionToken} from './step5-journey-fixture.mjs';
import {sha256} from '../src/security.js';

test('Step 6 fixture executes the authorized production AI boundary with hashed session and encrypted key',async()=>{
 const f=await step6Fixture();
 try{
  const session=f.DB.raw.prepare('SELECT token_hash FROM sessions').get();assert.equal(session.token_hash,await sha256(sessionToken));assert.notEqual(session.token_hash,sessionToken);
  const integration=f.DB.raw.prepare('SELECT encrypted_api_key,last_used_at FROM workspace_ai_integrations').get();assert.ok(integration.encrypted_api_key);assert.notEqual(integration.encrypted_api_key,'step6-fixture-key');
  const sources={triggerSummary:'',offer:'industrial automation',value:'',difference:'Our team supports industrial projects.',approach:'',meetingValue:''};
  const body=JSON.stringify({system:'Prepare only the supplied six fields.',prompt:JSON.stringify({sources,style:'professional'}),task:'outreach-generation',max_output_tokens:300});
  const request=(workspace,cookie)=>fetch(f.origin+'/api/ai/generate?workspace_id='+workspace,{method:'POST',headers:{'Content-Type':'application/json',...(cookie?{Cookie:'leadintel_session='+cookie}:{})},body});
  assert.equal((await request(workspaceId)).status,401);assert.equal((await request('foreign-workspace',sessionToken)).status,403);assert.equal(f.providerRequests.length,0);
  const response=await request(workspaceId,sessionToken);assert.equal(response.status,200);const result=await response.json();assert.deepEqual(JSON.parse(result.text),sources);assert.equal(f.providerRequests.length,1);assert.equal(f.providerRequests[0].kind,'fields');
  assert.ok(f.DB.raw.prepare('SELECT last_used_at FROM workspace_ai_integrations').get().last_used_at);assert.doesNotMatch(JSON.stringify(result),/step6-fixture-key|encrypted_api_key/);
  const state=await f.getState();assert.equal(state.payload.main.answerStatus.meeting_value,'user');
  const person=state.payload.discovery.selectedProspects[0].people.find(person=>person.id==='robert');assert.equal(person.publicLinkedinUrl,reviewedLinkedInUrl);assert.ok(!person.linkedinConfirmedUrl);assert.ok(!state.payload.meta.discovery.selectedLinkedInBuyer,'browser acceptance must complete the real profile review');
 }finally{await f.close();}
});

test('authenticated Chromium saves exact rich-text Messages to real CRM, reopens, recovers failed saves and isolates two buyers',{timeout:150000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Local Chromium/Playwright unavailable; LEADINTEL_REQUIRE_BROWSER=true makes browser acceptance mandatory.');return;}
 const {verifyStep6Journey}=await import('../../scripts/verify-step6-journey.mjs');
 const artifactDir=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step6-test-')),evidence=await verifyStep6Journey({artifactDir});
 assert.equal(evidence.exactManualCrmSnapshot,true);assert.equal(evidence.freshBrowserReopen,true);assert.equal(evidence.newerCrmRecovery.exactTextRestored,true);assert.equal(evidence.reopenProviderReplays,0);assert.equal(evidence.twoBuyerIsolation,true);assert.equal(evidence.lateOtherBuyerPreparationPreservedCurrentDraft,true);assert.equal(evidence.linkedin.visibleProfileReviewAndCrmAcknowledgement,true);assert.equal(evidence.linkedin.emailDraftPreserved,true);assert.equal(evidence.linkedin.freshBrowserReopen,true);assert.equal(evidence.invalidPreparation.previousDraftPreserved,true);assert.equal(evidence.failedSave.workingTextPreserved,true);assert.equal(evidence.failedSave.retrySaved,true);assert.equal(evidence.coreStyles.length,4);assert.equal(evidence.outboundMessages,0);assert.equal(evidence.paidContactRequests,0);assert.deepEqual(evidence.consoleErrors,[]);
 t.diagnostic('Controlled local browser/real SQL evidence: '+path.join(artifactDir,'evidence.json'));
});
