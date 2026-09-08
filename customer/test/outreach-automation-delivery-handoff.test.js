const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const handoff=fs.readFileSync(path.join(root,'outreach-automation-delivery-handoff.js'),'utf8');
const delivery=fs.readFileSync(path.join(root,'delivery-ui.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');
const loader=fs.readFileSync(path.join(root,'outreach-automation-loader.js'),'utf8');

test('Delivery handoff emits approved package plus explicit recipient without auto-enqueueing',()=>{
  assert.match(handoff,/leadintel:approved-outreach-package/);
  assert.match(handoff,/delivery-recipient/);
  assert.match(handoff,/approvedAt/);
  assert.match(handoff,/emailSubject/);
  assert.match(handoff,/emailBody/);
  assert.match(handoff,/followUp/);
  assert.match(handoff,/contact_identity/);
  assert.doesNotMatch(handoff,/enqueueOutreachAutomation\(/,'handoff may announce but must never enqueue automatically');
  assert.doesNotMatch(delivery,/enqueueOutreachAutomation\(/,'legacy manual Delivery must remain explicit');
});

test('handoff refreshes when approved opportunity or recipient changes and is loaded lazily for Delivery',()=>{
  assert.match(handoff,/announceApprovedAutomationPackage/);
  assert.match(handoff,/delivery-company-select/);
  assert.match(handoff,/delivery-recipient/);
  assert.match(handoff,/addEventListener\('input'/);
  assert.match(handoff,/addEventListener\('change'/);
  assert.match(processMap,/outreach-automation-loader\.js/);
  assert.match(loader,/outreach-automation-delivery-handoff\.js/);
});
