const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','intelligence-profile-runtime.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('canonical profile runtime owns the Reference Customer CTA click and opens the manager',()=>{
  assert.match(runtime,/data-reference-customers-manage/);
  assert.match(runtime,/LeadIntelReferenceCustomerUI\?\.open\?\.\(\)/);
});

test('approved profile changes the main approval button to Profile approved and disables it',()=>{
  assert.match(app,/approve-profile[^\n]+Profile approved ✓/);
  assert.match(app,/approve-profile[^\n]+disabled=approved/);
});

test('redundant bottom profile approval reminder is hidden from the profile',()=>{
  assert.match(app,/approval-card[^\n]+hidden\s*=\s*true/);
});
