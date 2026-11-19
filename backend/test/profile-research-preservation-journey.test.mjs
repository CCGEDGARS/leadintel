import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadPlaywright} from './step5-journey-fixture.mjs';
import {verifyProfileStrategyJourney} from '../../scripts/verify-profile-strategy-journey.mjs';

test('authenticated seller research preserves market work, directly reviews Profile and recovers in a fresh browser',{timeout:180000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium/Playwright unavailable; mandatory in the Profile journey CI job.');return;}
 const evidence=await verifyProfileStrategyJourney({researchHandoff:true,profileRefreshRecovery:true,artifactDir:'/tmp/leadintel-profile-preservation'});
 for(const key of ['directEmptyReview','refreshPreservedResearch','profileRecoveryReusedEvidence','foreignWorkspaceBlocked','researchFreshBrowserReopen','marketEditPreservedEvidence'])assert.equal(evidence[key],true,key);
 assert.deepEqual(evidence.pageErrors,[]);t.diagnostic(JSON.stringify(evidence));
});
