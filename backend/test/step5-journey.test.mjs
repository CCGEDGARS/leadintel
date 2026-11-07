import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {journeyFixture,loadPlaywright,workspaceId,sessionToken} from './step5-journey-fixture.mjs';

test('Step 5 journey uses production SQL session and workspace authorization',async()=>{
 const f=await journeyFixture();
 try{
  const unauthenticated=await fetch(f.origin+'/api/customer/state?workspace_id='+workspaceId);assert.equal(unauthenticated.status,401);
  const denied=await fetch(f.origin+'/api/customer/state?workspace_id=foreign-workspace',{headers:{Cookie:'leadintel_session='+sessionToken}});assert.equal(denied.status,403);
  const foreignCompany=await fetch(f.origin+'/api/crm/companies/'+f.candidate.crmId+'?workspace_id=storage-w2',{headers:{Cookie:'leadintel_session='+sessionToken}});assert.equal(foreignCompany.status,404);
  assert.equal(f.DB.raw.prepare('SELECT count(*) n FROM sessions').get().n,1);
  assert.equal((await f.getState()).payload.discovery.selectedProspects[0].people[0].publicEmail,'robert@forge.example');
 }finally{await f.close();}
});

test('authenticated Chromium preserves official channels across delayed provider, competing revision, Messages, CRM and fresh reopen',{timeout:60000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Local Chromium/Playwright unavailable; run scripts/verify-step5-journey.mjs with installed browser paths for acceptance evidence.');return;}
 const {verifyStep5Journey}=await import('../../scripts/verify-step5-journey.mjs');
 const evidence=await verifyStep5Journey({artifactDir:await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step5-test-'))});
 assert.equal(evidence.unrelatedRevisionMerged,true);assert.equal(evidence.crmReopen,true);assert.equal(evidence.sourceReads,1);assert.equal(evidence.outboundMessages,0);assert.equal(evidence.paidContactRequests,0);assert.ok(evidence.sameBuyerConflictPaths.some(p=>p.includes('people[robert]')));
 assert.equal(evidence.durableJob.roleReviewRecovered,true);assert.equal(evidence.durableJob.actualRefreshResumed,true);assert.equal(evidence.durableJob.completedReceiptsPreserved,true);assert.equal(evidence.durableJob.incompleteDossierContactsVisible,true);
 assert.equal(evidence.durableJob.status,'needs_review');assert.equal(evidence.durableJob.phase,'done');assert.equal(evidence.durableJob.restoreProviderReplays,0);assert.equal(evidence.durableJob.broaderQualityComplete,false);assert.ok(evidence.durableJob.queries.length>=9);assert.equal(new Set(evidence.durableJob.queries).size,evidence.durableJob.queries.length);
 t.diagnostic('Actual local browser/SQL evidence: '+path.dirname(evidence.screenshots[0])+'/evidence.json');
});

test('authenticated Chromium shows four confirmed contacts and keeps six others collapsed through reopen',{timeout:60000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory CI must run this journey.');return;}
 const {verifyConfirmedFourJourney}=await import('../../scripts/verify-step5-journey.mjs'),artifactDir=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step5-test-confirmed-four-'));
 const evidence=await verifyConfirmedFourJourney({artifactDir});assert.equal(evidence.mainContacts,4);assert.equal(evidence.confirmedWorkEmails,4);assert.equal(evidence.hiddenOtherContacts,6);assert.equal(evidence.freshBrowserReopen,true);assert.equal(evidence.readOnlyProviderReplays,0);assert.equal(evidence.paidContactRequests,0);assert.equal(evidence.outboundMessages,0);t.diagnostic('Confirmed-four evidence: '+artifactDir+'/evidence.json');
});

test('authenticated Chromium preserves four mixed confirmed channels with the other six hidden',{timeout:60000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory CI must run this journey.');return;}
 const {verifyConfirmedFourJourney}=await import('../../scripts/verify-step5-journey.mjs'),artifactDir=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step5-test-confirmed-four-mixed-'));
 const e=await verifyConfirmedFourJourney({artifactDir,mixedChannels:true});assert.equal(e.mainContacts,4);assert.equal(e.confirmedWorkEmails,2);assert.equal(e.confirmedPhones,1);assert.equal(e.confirmedLinkedin,1);assert.equal(e.hiddenOtherContacts,6);assert.equal(e.freshBrowserReopen,true);assert.equal(e.readOnlyProviderReplays,0);assert.equal(e.paidContactRequests,0);assert.equal(e.outboundMessages,0);t.diagnostic('Mixed-channel evidence: '+artifactDir+'/evidence.json');
});

 test('authenticated Chromium Refresh starts from a large retained research record and keeps four confirmed contacts after reopen',{timeout:60000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory CI must run this journey.');return;}
 const {verifyConfirmedFourJourney}=await import('../../scripts/verify-step5-journey.mjs'),artifactDir=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step5-test-large-snapshot-'));
 const e=await verifyConfirmedFourJourney({artifactDir,largeSavedResearch:true,mixedChannels:true});assert.ok(e.retainedSnapshotBytes>1000000);assert.ok(e.researchCommandBytes.every(bytes=>bytes>0&&bytes<64000));assert.equal(e.mainContacts,4);assert.equal(e.hiddenOtherContacts,6);assert.equal(e.freshBrowserReopen,true);assert.equal(e.readOnlyProviderReplays,0);assert.equal(e.paidContactRequests,0);assert.equal(e.outboundMessages,0);t.diagnostic('Large-snapshot browser evidence: '+artifactDir+'/evidence.json');
});

test('authenticated Chromium restores four recorded Viscaria contacts and preserves email-only Proceed through Refresh and reopen',{timeout:90000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; required in CI');return;}
 const {verifyRetainedViscariaJourney}=await import('../../scripts/verify-step5-journey.mjs'),artifactDir=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step5-test-viscaria-retention-'));const e=await verifyRetainedViscariaJourney({artifactDir});assert.equal(e.mainContacts,4);assert.equal(e.historyRecoveryReadOnly,true);assert.equal(e.refreshRetainsFour,true);assert.equal(e.freshBrowserReopen,true);assert.equal(e.profileOnlyProceedBlocked,true);assert.ok(e.profileLinkRetained);assert.equal(e.outboundMessages,0);assert.equal(e.paidContactRequests,0);t.diagnostic('Recorded Viscaria evidence: '+artifactDir+'/evidence.json');
});

test('authenticated Chromium Refresh automatically enriches only the priority buyer and restores its green email after closing the browser',{timeout:60000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory CI must run this journey.');return;}
 const {verifyPaidBuyerJourney}=await import('../../scripts/verify-step5-paid-journey.mjs'),artifactDir=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step5-test-paid-'));
 const e=await verifyPaidBuyerJourney({artifactDir});assert.equal(e.confirmedEmails,1);assert.equal(e.emailLookups,1);assert.equal(e.phoneLookups,1);assert.equal(e.readOnlyPaidReplays,0);assert.equal(e.outboundMessages,0);t.diagnostic('Controlled paid-flow browser evidence: '+artifactDir+'/evidence.json');
});

test('authenticated Chromium respects an explicitly selected four-contact automatic allowance',{timeout:60000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; required in CI');return;}
 const {verifyPaidBuyerJourney}=await import('../../scripts/verify-step5-paid-journey.mjs'),artifactDir=await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step5-test-selected-four-'));
 const e=await verifyPaidBuyerJourney({artifactDir,automaticLimit:4});assert.equal(e.confirmedEmails,4);assert.equal(e.emailLookups,4);assert.equal(e.phoneLookups,4);assert.equal(e.readOnlyPaidReplays,0);assert.equal(e.outboundMessages,0);
});

test('authenticated Chromium Recheck runs Charlotte alone through HTTP and scheduler, retains other contacts and reopens safely',{timeout:90000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; required in CI');return;}
 const {verifyRetainedViscariaJourney}=await import('../../scripts/verify-step5-journey.mjs');
 const e=await verifyRetainedViscariaJourney({artifactDir:await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-charlotte-recheck-')),recheck:true});
 assert.equal(e.mainContacts,4);assert.equal(e.freshBrowserReopen,true);assert.equal(e.profileOnlyProceedBlocked,true);assert.equal(e.paidContactRequests,0);assert.equal(e.outboundMessages,0);
});

 test('company Resume button continues saved checks through HTTP and scheduler after reopening',{timeout:90000},async t=>{
  try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; required in Customer CI');return;}
  const {verifyBuyerActionJourney}=await import('../../scripts/verify-buyer-action-journey.mjs');
  const e=await verifyBuyerActionJourney({artifactDir:await fs.mkdtemp(path.join(os.tmpdir(),'leadintel-step5-test-company-actions-'))});
  assert.equal(e.primaryResumeSameJob,true);assert.equal(e.refreshStartsFreshPlan,true);assert.equal(e.headerAndSummaryAgree,true);assert.equal(e.realSchedulerPause,true);assert.equal(e.sourceReceiptsRetained,true);assert.equal(e.statusOutageRecoverable,true);assert.equal(e.serverCancellation,true);assert.equal(e.noAutomaticRestartOnReload,true);assert.deepEqual(e.consoleErrors,[]);
 });
