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
