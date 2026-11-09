import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {step1Fixture} from './step1-journey-fixture.mjs';
import {loadPlaywright,workspaceId,sessionToken} from './step5-journey-fixture.mjs';
import {sha256} from '../src/security.js';

test('Step 1 fixture begins empty with real hashed authentication and no operational approvals',async()=>{
 const f=await step1Fixture();try{
  const state=await f.getState();assert.equal(state.payload.main.step,1);assert.equal(state.payload.main.website,'');assert.equal(state.payload.main.approved,false);assert.equal(state.payload.main.profile,null);assert.deepEqual(state.payload.discovery.selectedProspects,[]);assert.equal(f.DB.raw.prepare('SELECT token_hash FROM sessions').get().token_hash,await sha256(sessionToken));
  for(const endpoint of ['/api/company-materials','/api/company-materials/profile-context']){
   assert.equal((await fetch(f.origin+endpoint+'?workspace_id='+workspaceId)).status,401);
   assert.equal((await fetch(f.origin+endpoint+'?workspace_id=foreign-workspace',{headers:{Cookie:'leadintel_session='+sessionToken}})).status,403);
  }
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM crm_contacts').get().n,0);assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM outreach_automation_queue').get().n,0);
 }finally{await f.close();}
});

test('authenticated Chromium Setup activates, reads original PDF evidence, hands off to Profile and reopens',{timeout:240000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium/Playwright unavailable; LEADINTEL_REQUIRE_BROWSER=true makes acceptance mandatory.');return;}
 const {verifyStep1Journey}=await import('../../scripts/verify-step1-journey.mjs');const artifactDir=process.env.LEADINTEL_STEP1_ARTIFACT_DIR||await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step1-test-'));const evidence=await verifyStep1Journey({artifactDir});
 for(const key of ['authenticatedEmptyStart','websiteActivated','countryOnly','originalBytesPreserved','realJobProcessed','reviewText','profileMaterialContext','freshBrowserReopen','workspaceIsolation'])assert.equal(evidence[key],true,key);
 assert.equal(evidence.websiteReplacement.failedSourceRetained,true);assert.equal(evidence.websiteReplacement.lateSourceDiscarded,true);assert.equal(evidence.cloudSave.retryWithoutExtraction,true);assert.equal(evidence.legacyRegionRestoration.countries,15);assert.equal(evidence.deletion.cancelPreserved,true);assert.equal(evidence.deletion.escapePreserved,true);assert.equal(evidence.unreadablePdf.retryRealJob,true);assert.deepEqual(evidence.foreignSourceReads,[{action:'original',status:404},{action:'extracted',status:404}]);assert.deepEqual(evidence.pageErrors,[]);assert.equal(evidence.paidContactRequests,0);assert.equal(evidence.automationQueue,0);t.diagnostic('Controlled browser/real SQL evidence: '+path.join(artifactDir,'evidence.json'));
});

test('authenticated Chromium preserves early website input through startup, activation and saved reopen',{timeout:60000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in journey CI.');return;}
 const {verifyWebsiteStartupInput}=await import('../../scripts/verify-step1-journey.mjs'),evidence=await verifyWebsiteStartupInput();assert.equal(evidence.typedBeforeInitialization,true);assert.equal(evidence.preservedAfterBlur,true);assert.equal(evidence.activationSucceeded,true);assert.equal(evidence.savedReopen,true);assert.deepEqual(evidence.pageErrors,[]);t.diagnostic(JSON.stringify(evidence));
});

test('authenticated Chromium targeting confirmation saves edited answers, reports failed sync and reopens',{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in journey CI.');return;}
 const {verifyTargetingConfirmation}=await import('../../scripts/verify-targeting-confirmation.mjs');const evidence=await verifyTargetingConfirmation();for(const key of ['confirmedThroughHttp','freshBrowserReopen','mobileButtonVisible','savedBadgesAgree','failedSaveIsActionable','retrySaved'])assert.equal(evidence[key],true,key);assert.deepEqual(evidence.pageErrors,[]);
});


test('authenticated Chromium review-status synchronization cannot wedge targeting confirmation',{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in journey CI.');return;}
 const {verifyTargetingConfirmation}=await import('../../scripts/verify-targeting-confirmation.mjs');const evidence=await verifyTargetingConfirmation({synchronizeReview:true,artifactDir:'/tmp/leadintel-targeting-review-sync'});assert.equal(evidence.confirmedThroughHttp,true);assert.equal(evidence.freshBrowserReopen,true);assert.equal(evidence.retrySaved,true);
});


test('authenticated Chromium compares genuine conflicting edits, preserves cancellation and merges only the chosen changes',{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in journey CI.');return;}
 const {verifyTargetingConfirmation}=await import('../../scripts/verify-targeting-confirmation.mjs');const evidence=await verifyTargetingConfirmation({conflictingEdit:true,artifactDir:'/tmp/leadintel-targeting-real-conflict'});assert.equal(evidence.staleComparisonPreserved,true);assert.equal(evidence.cancelPreservedBoth,true);assert.equal(evidence.independentSavedEvidencePreserved,true);assert.equal(evidence.freshBrowserReopen,true);
});


test('authenticated Chromium can choose the saved conflicting answer while preserving independent changes',{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in journey CI.');return;}
 const {verifyTargetingConfirmation}=await import('../../scripts/verify-targeting-confirmation.mjs');const evidence=await verifyTargetingConfirmation({conflictingEdit:true,conflictChoice:'saved',artifactDir:'/tmp/leadintel-targeting-saved-conflict'});assert.equal(evidence.staleComparisonPreserved,true);assert.equal(evidence.independentSavedEvidencePreserved,true);assert.equal(evidence.freshBrowserReopen,true);
});

test('authenticated Chromium runs fresh Setup through reviewed Profile and saved Strategy into Companies',{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in journey CI.');return;}
 const {verifyProfileStrategyJourney}=await import('../../scripts/verify-profile-strategy-journey.mjs');const evidence=await verifyProfileStrategyJourney();for(const key of ['setupResearchOpenedProfile','profileReviewedAndApproved','strategySavedBeforeCompanies','companySearchFinishedWithoutInventingResults','lateNavigationPreserved','freshBrowserReopen'])assert.equal(evidence[key],true);assert.deepEqual(evidence.pageErrors,[]);
});


test('Quick Overview automatically saves its sources, single report and Strategy handoff across a fresh browser',{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in journey CI.');return;}
 const {verifyProfileStrategyJourney}=await import('../../scripts/verify-profile-strategy-journey.mjs');
 const evidence=await verifyProfileStrategyJourney({researchHandoff:true,artifactDir:'/tmp/leadintel-research-handoff'});
 assert.equal(evidence.researchHandoff.automaticCloudSave,true);assert.equal(evidence.researchFreshBrowserReopen,true);
});
test('Quick Overview retains local results on cloud-save failure and a visible save retry persists the handoff',{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in journey CI.');return;}
 const {verifyProfileStrategyJourney}=await import('../../scripts/verify-profile-strategy-journey.mjs');
 const evidence=await verifyProfileStrategyJourney({researchHandoff:true,failResearchSave:true,artifactDir:'/tmp/leadintel-research-handoff-outage'});
 assert.equal(evidence.failedSaveRetainedLocalResults,true);assert.equal(evidence.researchFreshBrowserReopen,true);
});
test('Quick Overview completed before Opportunity-led activation reopens review, saves Strategy and reuses its research',{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in Profile/Strategy journey CI.');return;}
 const {verifyProfileStrategyJourney}=await import('../../scripts/verify-profile-strategy-journey.mjs');const evidence=await verifyProfileStrategyJourney({researchHandoff:true,legacyOpportunityContext:true,artifactDir:'/tmp/leadintel-research-handoff-legacy'});for(const key of ['reviewOpened','approvalSaved','marketRunReused','coldReopen'])assert.equal(evidence.legacyOpportunityRecovery[key],true);assert.deepEqual(evidence.pageErrors,[]);
});
test('Quick Overview company search shows slow extraction progress, mobile stages and a saved cancellation',{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in Profile/Strategy journey CI.');return;}
 const {verifyProfileStrategyJourney}=await import('../../scripts/verify-profile-strategy-journey.mjs');const evidence=await verifyProfileStrategyJourney({researchHandoff:true,companyProgress:true,artifactDir:'/tmp/leadintel-research-handoff-progress'});for(const key of ['slowBatchVisible','honestCounts','elapsedLive','mobile','reducedMotion','cancelSaved','freshReopen'])assert.equal(evidence.companyProgress[key],true);assert.deepEqual(evidence.pageErrors,[]);
});
