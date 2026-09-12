const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','profile-action-runtime.js'),'utf8');
const launcher=fs.readFileSync(path.join(__dirname,'..','reference-customer-launcher.js'),'utf8');
const boot=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('Reference Customer CTA is isolated from profile actions and owned by the dedicated launcher',()=>{
  assert.doesNotMatch(runtime,/data-reference-customers-manage/);
  assert.match(launcher,/data-reference-customers-manage/);
  assert.match(launcher,/LeadIntelReferenceCustomerUI\?\.open/);
  assert.match(launcher,/reference-customer-upload-mode\.js/);
});

test('approved profile presentation mirrors app state without duplicating the click handler',()=>{
  assert.match(runtime,/Continue to Market Strategy/);
  assert.match(runtime,/if\(button\.disabled\)button\.disabled=false/);
  assert.match(app,/\$\("approve-profile"\)\.addEventListener\("click",\(\)=>state\.approved\?openMarketStrategy\(\):approveProfile\(\)\)/);
  assert.doesNotMatch(runtime,/document\.addEventListener\(['"]click['"]/);
});

test('bottom profile card semantics are owned by app.js',()=>{
  assert.match(runtime,/approval-card/);
  assert.match(runtime,/Continue to Market Strategy/);
  assert.match(runtime,/Approve Profile/);
  assert.match(app,/\$\("approve-profile"\)\.addEventListener\("click",\(\)=>state\.approved\?openMarketStrategy\(\):approveProfile\(\)\)/);
  assert.doesNotMatch(app,/approve-profile-bottom/);
  assert.doesNotMatch(runtime,/approve-profile-bottom/);
  assert.doesNotMatch(runtime,/openMarketStrategy/);
  assert.doesNotMatch(runtime,/card\.hidden=true/);
});

test('dedicated Reference Customer launcher boots after the base Reference Customer UI and independently of profile presentation',()=>{
  const ui=boot.indexOf('reference-customer-ui.js');
  const launcherIndex=boot.indexOf('reference-customer-launcher.js');
  const actions=boot.indexOf('profile-action-runtime.js');
  assert.ok(ui>=0);
  assert.ok(launcherIndex>ui);
  assert.ok(actions>launcherIndex);
});
