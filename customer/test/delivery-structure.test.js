const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
function read(name){return fs.readFileSync(path.join(__dirname,'..',name),'utf8');}

test('outreach module loads delivery engine and modular delivery UI',()=>{
  const ui=read('outreach-ui.js');
  assert.match(ui,/delivery-engine\.js/);
  assert.match(ui,/delivery-ui\.js/);
  assert.match(ui,/loadDeliveryModules/);
});

test('delivery UI injects Step 7 controlled Gmail compose and CRM learning controls',()=>{
  const ui=read('delivery-ui.js');
  for(const pattern of [
    /data-step-marker="7"/,/id="step-7"/,/id="delivery-company-select"/,/id="delivery-recipient"/,
    /id="open-gmail-draft"/,/id="confirm-delivery-sent"/,/id="delivery-activity"/,
    /id="reply-text"/,/id="record-reply"/,/id="reply-classification"/,
    /data-outcome-stage="Meeting"/,/data-outcome-stage="Proposal"/,/data-outcome-stage="Won"/,/data-outcome-stage="Lost"/,
    /id="learning-scorecard"/,/id="learning-segments"/,/id="learning-recommendations"/,/id="export-learning-data"/
  ]) assert.match(ui,pattern);
});

test('delivery UI keeps sending explicit while production Gmail status is loaded by the server bridge',()=>{
  const ui=read('delivery-ui.js');
  assert.match(ui,/Gmail Compose/);
  assert.match(ui,/Manual confirmation/);
  assert.match(ui,/Production Gmail status loads here/i);
  assert.match(ui,/buildGmailComposeUrl/);
  assert.match(ui,/never auto-sends/i);
  assert.doesNotMatch(ui,/gmail\.googleapis\.com|users\/messages\/send|access_token|sendEmail\s*\(/i);
});

test('delivery UI updates existing discovery pipeline through connector-neutral events',()=>{
  const ui=read('delivery-ui.js');
  assert.match(ui,/leadintel_customer_v2_delivery/);
  assert.match(ui,/leadintel_customer_v2_discovery/);
  assert.match(ui,/LeadIntelDelivery\.confirmSend/);
  assert.match(ui,/LeadIntelDelivery\.recordReply/);
  assert.match(ui,/LeadIntelDelivery\.recordOutcome/);
  assert.match(ui,/LeadIntelDelivery\.buildLearningSummary/);
});