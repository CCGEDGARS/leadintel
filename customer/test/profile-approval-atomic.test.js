import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../profile-action-runtime.js',import.meta.url),'utf8');

test('Approve Profile has a non-intercepting recovery path if the primary app handler aborts',()=>{
  assert.match(runtime,/closest\?\.\(['"]#approve-profile,#approve-profile-bottom['"]\)/);
  assert.match(runtime,/if\(readState\(\)\.approved\)return/);
  assert.match(runtime,/state\.approved=true/);
  assert.match(runtime,/state\.profile\.approvedAt/);
  assert.match(runtime,/localStorage\.setItem\(PROFILE_ACTION_STATE_KEY,JSON\.stringify\(state\)\)/);
  assert.doesNotMatch(runtime,/stopPropagation\(|stopImmediatePropagation\(/);
});

test('approval recovery updates the UI and emits the standard approval event',()=>{
  assert.match(runtime,/syncApprovalControls\(\)/);
  assert.match(runtime,/leadintel:profile-approved/);
  assert.match(runtime,/Company Intelligence Profile approved/);
});
