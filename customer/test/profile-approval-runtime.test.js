const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','profile-action-runtime.js'),'utf8');

test('loaded profile action runtime guarantees top approve action persists approved state',()=>{
  assert.match(source,/\#approve-profile/);
  assert.match(source,/approved=true/);
  assert.match(source,/approvedAt/);
  assert.match(source,/captureWorkspaceSnapshot/);
});

test('approval fallback re-syncs controls from persisted state',()=>{
  assert.match(source,/syncApprovalControls\(\)/);
  assert.match(source,/profile-approved/);
});
