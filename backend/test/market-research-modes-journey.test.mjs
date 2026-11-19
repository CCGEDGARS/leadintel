import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {loadPlaywright} from './step5-journey-fixture.mjs';
import {verifyProfileStrategyJourney} from '../../scripts/verify-profile-strategy-journey.mjs';

for(const mainAiProvider of ['gemini','anthropic'])for(const mode of ['quick','deep','intelligence'])test(`${mainAiProvider} ${mode} research button saves evidence, verifies coverage and connects its report to Companies`,{timeout:180000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in market research journey CI.');return;}
 const evidence=await verifyProfileStrategyJourney({researchHandoff:true,mainAiProvider,researchMode:mode,marketModeChecks:true,artifactDir:'/tmp/leadintel-market-modes/'+mainAiProvider+'/'+mode});
 assert.equal(evidence.researchFreshBrowserReopen,true);assert.equal(evidence.marketMode.companiesHandoff,true);assert.equal(evidence.marketMode.reportOpened,true);assert.deepEqual(evidence.pageErrors,[]);
});
