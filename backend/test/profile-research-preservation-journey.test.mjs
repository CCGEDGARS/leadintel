import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyProfileStrategyJourney} from '../../scripts/verify-profile-strategy-journey.mjs';

test('authenticated seller research preserves market work, directly reviews Profile and recovers in a fresh browser',{timeout:180000},async t=>{
 const evidence=await verifyProfileStrategyJourney({researchHandoff:true,profileRefreshRecovery:true,artifactDir:'/tmp/leadintel-profile-preservation'});
 for(const key of ['directEmptyReview','refreshPreservedResearch','profileRecoveryReusedEvidence','foreignWorkspaceBlocked','researchFreshBrowserReopen','marketEditPreservedEvidence'])assert.equal(evidence[key],true,key);
 assert.deepEqual(evidence.pageErrors,[]);t.diagnostic(JSON.stringify(evidence));
});
