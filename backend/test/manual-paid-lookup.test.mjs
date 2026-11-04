import test from 'node:test';
import fs from 'node:fs/promises';
import {loadPlaywright} from './step5-journey-fixture.mjs';
import {verifyManualPaidJourney} from '../../scripts/verify-manual-paid-journey.mjs';
test('manual paid email: actual browser, HTTP authorization, provider, CRM and reopen with pending purchasing fit',{timeout:90000},async t=>{try{await loadPlaywright();await fs.access(process.env.LEADINTEL_CHROMIUM_PATH||'/usr/bin/chromium');}catch(error){if(process.env.LEADINTEL_REQUIRE_BROWSER==='true')throw error;t.skip('Chromium unavailable; required Customer CI runs this journey.');return;}await verifyManualPaidJourney();});
