import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {step7Fixture,exactDrafts} from './step7-journey-fixture.mjs';
import {loadPlaywright,workspaceId,sessionToken} from './step5-journey-fixture.mjs';
import {sha256} from '../src/security.js';
const require=createRequire(import.meta.url),Outreach=require('../../customer/outreach-engine.js');

test('Step 7 approvals use the same confirmed profile material as browser canonical normalization',async()=>{
 const f=await step7Fixture();try{
  const {payload}=await f.getState(),main=payload.main,Strategy=require('../../customer/strategy-integrity.js');
  assert.equal(main.profile.customerPainPointsStatus,'AI-inferred · review recommended','exercise saved approvals that still carry the legacy display label');
  const root={LeadIntelProfile:{...require('../../customer/profile-engine.js')},LeadIntelCanonicalIntelligence:require('../../customer/canonical-intelligence.js'),LeadIntelCompanyBrain:globalThis.LeadIntelCompanyBrain,LeadIntelReferenceCustomers:require('../../customer/reference-customers.js')};
  const restoreAppState=value=>({...value,market:require('../../customer/market-engine.js').recoverInterruptedResearch(main.market),brandIdentity:require('../../customer/brand-identity.js').normalize(main.brandIdentity),senderIdentityVersion:main.senderIdentityVersion});
  const early=restoreAppState(root.LeadIntelProfile.normalizeSavedState(JSON.parse(JSON.stringify(main))));
  assert.equal(Strategy.signature(early),Strategy.signature(main),'ordinary startup normalization must preserve confirmed context before the canonical module loads');
  const ordinaryProfile={...root.LeadIntelProfile};
  delete root.LeadIntelProfile.__canonicalRuntimeInstalled;
  vm.runInNewContext(await fs.readFile(new URL('../../customer/canonical-profile-runtime.js',import.meta.url),'utf8'),root);
  const normalized=restoreAppState(root.LeadIntelProfile.normalizeSavedState(JSON.parse(JSON.stringify(early))));
  assert.equal(Strategy.signature(normalized),Strategy.signature(main),'restoring confirmed context must not invalidate a fixture approval');
  const reverse=restoreAppState(ordinaryProfile.normalizeSavedState(JSON.parse(JSON.stringify(normalized))));
  assert.equal(Strategy.signature(reverse),Strategy.signature(main),'canonical-first restoration must also preserve existing approval material');
  assert.equal(main.profile.customerPainPoints,main.profile.canonical.fields.customerPainPoints.value);
  for(const item of payload.outreach.items)assert.equal(Outreach.sourceAuthorityCurrent(item,normalized,payload.outreach.messageStudio),true);
  normalized.answers={...normalized.answers,buying_outcomes:'A newly edited customer problem'};
  for(const item of payload.outreach.items)assert.equal(Outreach.sourceAuthorityCurrent(item,normalized,payload.outreach.messageStudio),false,'real context edits still require approval');
 }finally{await f.close();}
});

test('Step 7 controlled fixture retains real auth, canonical approval, confirmed exact CRM buyers and rich text',async()=>{
 const f=await step7Fixture();try{
  assert.equal(f.DB.raw.prepare('SELECT token_hash FROM sessions').get().token_hash,await sha256(sessionToken));
  assert.notEqual(f.DB.raw.prepare('SELECT encrypted_refresh_token FROM gmail_connections').get().encrypted_refresh_token,'controlled-refresh');
  const state=await f.getState();assert.equal(state.payload.main.step,7);
  for(const item of state.payload.outreach.items){assert.equal(Outreach.approvalCurrent(item),true);assert.equal(Outreach.sourceAuthorityCurrent(item,state.payload.main,state.payload.outreach.messageStudio),true);const draft=exactDrafts[item.selectedPersonId],payload=Outreach.buildApprovedSendPayload(item,item.selectedPersonId+'@forge.example');assert.equal(payload.subject,draft.subject);assert.equal(payload.textBody,draft.message);assert.equal(payload.htmlBody,draft.messageHtml);const contact=f.contacts.find(row=>row.external_person_id===item.selectedPersonId);assert.equal(item.approvalAuthority.recipient.contactId,contact.id);assert.equal(contact.company_id,f.candidate.crmId);assert.equal(contact.workspace_id,workspaceId);}
  const endpoint=f.origin+'/api/integrations/gmail/send?workspace_id='+workspaceId;
  assert.equal((await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,401);
  assert.equal((await fetch(endpoint.replace(workspaceId,'unknown-workspace'),{method:'POST',headers:{Cookie:'leadintel_session='+sessionToken,'Content-Type':'application/json'},body:'{}'})).status,403);assert.equal(f.providerRequests.length,0);
 }finally{await f.close();}
});

test('authenticated Chromium Delivery preserves approved copy, sends once, reopens and persists isolated replies/outcomes',{timeout:150000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium/Playwright unavailable; LEADINTEL_REQUIRE_BROWSER=true makes this acceptance mandatory.');return;}
 const {verifyStep7Journey}=await import('../../scripts/verify-step7-journey.mjs'),artifactDir=process.env.LEADINTEL_STEP7_ARTIFACT_DIR||await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step7-test-')),evidence=await verifyStep7Journey({artifactDir,delayCanonicalUntilReady:true});
 assert.equal(evidence.exactApprovedDelivery,true);assert.equal(evidence.canonicalStartupOrderVerified,true);assert.equal(evidence.duplicateClickSingleSubmission,true);assert.equal(evidence.freshBrowserReopen,true);assert.equal(evidence.replyAndOutcomePersisted,true);assert.equal(evidence.twoBuyerIsolation,true);assert.equal(evidence.workspaceSwitchIsolation,true);assert.equal(evidence.providerCrmOutageRecoveryWithoutResend,true);assert.equal(evidence.replyCrmOutageRecovery,true);assert.equal(evidence.newerCrmRecovery.exactOutcomeRestored,true);assert.ok(evidence.newerCrmRecovery.failedWorkspacePuts>0);assert.equal(evidence.manualConfirmation.explicitRecordPersisted,true);assert.equal(evidence.unknownSubmission.freshBrowserReplayPrevented,true);assert.equal(evidence.unknownSubmission.freshBrowserManualRecordBlocked,true);assert.equal(evidence.mailboxStatus.retryUsedRealRoute,true);assert.equal(evidence.foreignWorkspaceWrites,0);assert.equal(evidence.paidContactRequests,0);assert.equal(evidence.automationQueue,0);assert.deepEqual(evidence.consoleErrors,[]);
 t.diagnostic('Controlled local browser/real SQL evidence: '+path.join(artifactDir,'evidence.json'));
});
