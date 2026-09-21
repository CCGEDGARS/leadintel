import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const runtime=fs.readFileSync(new URL('../profile-action-runtime.js',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');

test('Approve Profile has one authoritative persistence path in app.js',()=>{
  assert.match(app,/function approveProfile\(\)/);
  assert.match(app,/state\.approved=true/);
  assert.match(app,/state\.profile\.approvedAt/);
  assert.match(app,/\$\("approve-profile"\)\.addEventListener\("click",\(\)=>approveProfile\(\)\)/);
  assert.match(app,/\$\("continue-market-strategy"\)\.addEventListener\("click",openMarketStrategy\)/);
  assert.doesNotMatch(runtime,/document\.addEventListener\(['"]click['"]/);
});

test('presentation runtime only mirrors authoritative approval state',()=>{
  assert.match(runtime,/syncApprovalControls\(\)/);
  assert.doesNotMatch(runtime,/state\.approved=true/);
  assert.doesNotMatch(runtime,/localStorage\.setItem/);
});
