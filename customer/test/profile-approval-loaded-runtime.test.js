const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','profile-action-runtime.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('app runtime owns approval persistence',()=>{
  assert.match(app,/function approveProfile\(\)/);
  assert.match(app,/state\.approved=true/);
  assert.match(app,/approvedAt/);
  assert.match(app,/\$\("approve-profile"\)\.addEventListener\("click",\(\)=>state\.approved\?openMarketStrategy\(\):approveProfile\(\)\)/);
});

test('loaded profile presentation runtime does not duplicate approval state writes',()=>{
  assert.match(runtime,/syncApprovalControls\(\)/);
  assert.doesNotMatch(runtime,/approved=true/);
  assert.doesNotMatch(runtime,/captureWorkspaceSnapshot/);
  assert.doesNotMatch(runtime,/document\.addEventListener\(['"]click['"]/);
});
