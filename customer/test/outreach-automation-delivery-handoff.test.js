const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','delivery-ui.js'),'utf8');

test('Delivery hands an approved package plus explicit recipient to Outreach Automation without auto-enqueueing',()=>{
  assert.match(source,/leadintel:approved-outreach-package/);
  assert.match(source,/delivery-recipient/);
  assert.match(source,/approvedAt/);
  assert.match(source,/emailSubject/);
  assert.match(source,/emailBody/);
  assert.match(source,/followUp/);
  assert.match(source,/contact_identity/);
  assert.doesNotMatch(source,/enqueueOutreachAutomation\(/,'Delivery may announce an approved package but must not enqueue it automatically');
});

test('Delivery refreshes the automation handoff when approved opportunity or recipient changes',()=>{
  assert.match(source,/announceApprovedAutomationPackage/);
  assert.match(source,/delivery-company-select[\s\S]{0,800}announceApprovedAutomationPackage/);
  assert.match(source,/delivery-recipient[\s\S]{0,800}announceApprovedAutomationPackage/);
});
