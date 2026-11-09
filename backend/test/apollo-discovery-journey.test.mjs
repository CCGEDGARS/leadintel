import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {loadPlaywright} from './step5-journey-fixture.mjs';
test('authenticated Apollo settings and free background discovery save, resume and reopen without paid reveals',{timeout:120000},async t=>{
 try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; mandatory in Apollo journey CI.');return;}
 const {verifyApolloDiscoveryJourney}=await import('../../scripts/verify-apollo-discovery-journey.mjs');const e=await verifyApolloDiscoveryJourney();assert.equal(e.settingsSaveAndRestore,true);assert.equal(e.freeSearchCalls,1);assert.equal(e.executedReceiptsRestored,true);assert.equal(e.paidContactCalls,0);
});
