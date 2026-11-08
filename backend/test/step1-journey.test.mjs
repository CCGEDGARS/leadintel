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
