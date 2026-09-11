const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','profile-action-runtime.js'),'utf8');
const launcher=fs.readFileSync(path.join(__dirname,'..','reference-customer-launcher.js'),'utf8');
const boot=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');

test('Reference Customer CTA is isolated from profile actions and owned by the dedicated launcher',()=>{
  assert.doesNotMatch(runtime,/data-reference-customers-manage/);
  assert.match(launcher,/data-reference-customers-manage/);
  assert.match(launcher,/LeadIntelReferenceCustomerUI\?\.open/);
  assert.match(launcher,/reference-customer-upload-mode\.js/);
});

test('approved profile changes the main approval button to Profile Approved and disables it',()=>{
  assert.match(runtime,/✓ Profile Approved/);
  assert.match(runtime,/button\.disabled!==approved/);
});

test('bottom profile card is a direct Market Strategy next step rather than duplicate approval',()=>{
  assert.match(runtime,/approval-card/);
  assert.match(runtime,/Continue to Market Strategy/);
  assert.match(runtime,/Next:\s*Market Strategy/);
  assert.match(runtime,/closest\?\.\(['"]#approve-profile-bottom['"]\)/);
  assert.match(runtime,/openMarketStrategy/);
  assert.doesNotMatch(runtime,/card\.hidden=true/);
});

test('dedicated Reference Customer launcher boots after the base Reference Customer UI and independently of profile actions',()=>{
  const ui=boot.indexOf('reference-customer-ui.js');
  const launcherIndex=boot.indexOf('reference-customer-launcher.js');
  const actions=boot.indexOf('profile-action-runtime.js');
  assert.ok(ui>=0);
  assert.ok(launcherIndex>ui);
  assert.ok(actions>launcherIndex);
});
