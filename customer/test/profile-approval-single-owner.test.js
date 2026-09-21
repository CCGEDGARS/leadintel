import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../profile-action-runtime.js',import.meta.url),'utf8');

test('app.js is the sole owner of profile approval and profile-next-step clicks',()=>{
  assert.match(app,/\$\("approve-profile"\)\.addEventListener\("click",\(\)=>approveProfile\(\)\)/);
  assert.match(app,/\$\("continue-market-strategy"\)\.addEventListener\("click",openMarketStrategy\)/);
  assert.doesNotMatch(app,/approve-profile-bottom/);
  assert.doesNotMatch(runtime,/document\.addEventListener\(['"]click['"]/,'presentation runtime must not intercept profile clicks');
  assert.doesNotMatch(runtime,/persistApprovedState/,'presentation runtime must not write approval state');
  assert.doesNotMatch(runtime,/stopImmediatePropagation/,'profile runtime must never suppress app click handlers');
});

test('profile runtime is presentation-only and mirrors app semantics',()=>{
  assert.match(runtime,/syncApprovalControls/);
  assert.match(runtime,/Continue to Market Strategy/);
});
