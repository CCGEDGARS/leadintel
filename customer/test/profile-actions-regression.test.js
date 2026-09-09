const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','profile-action-runtime.js'),'utf8');
const boot=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');

test('canonical profile action runtime owns the Reference Customer CTA click and opens the manager',()=>{
  assert.match(runtime,/data-reference-customers-manage/);
  assert.match(runtime,/LeadIntelReferenceCustomerUI\?\.open/);
  assert.match(runtime,/openReferenceCustomers/);
});

test('approved profile changes the main approval button to Profile Approved and disables it',()=>{
  assert.match(runtime,/✓ Profile Approved/);
  assert.match(runtime,/button\.disabled!==approved/);
});

test('redundant bottom profile approval reminder is hidden from the profile',()=>{
  assert.match(runtime,/approval-card/);
  assert.match(runtime,/card\.hidden=true/);
});

test('profile action runtime boots after reference customer UI',()=>{
  const ui=boot.indexOf('reference-customer-ui.js');
  const actions=boot.indexOf('profile-action-runtime.js');
  assert.ok(ui>=0);
  assert.ok(actions>ui);
});
