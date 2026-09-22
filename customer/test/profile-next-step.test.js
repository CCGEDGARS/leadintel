const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('profile approval and Market Strategy navigation are separate user actions',()=>{
  const runtime=read('profile-action-runtime.js');
  const app=read('app.js');
  const approvalUI=read('profile-approval-ui.js');
  const html=read('index.html');

  assert.match(html,/profile-approval-actions[\s\S]*id="edit-profile"[\s\S]*id="approve-profile"[\s\S]*Approve profile/);
  assert.match(html,/profile-next-action[\s\S]*id="continue-market-strategy"[\s\S]*Continue to Market Strategy/);
  assert.match(app,/\$\("approve-profile"\)\.addEventListener\("click",\(\)=>approveProfile\(\)\)/);
  assert.match(app,/\$\("continue-market-strategy"\)\.addEventListener\("click",openMarketStrategy\)/);
  assert.match(approvalUI,/continueButton\.disabled=!approved/);
  assert.match(runtime,/continue-market-strategy/);
  assert.match(runtime,/continueButton\.disabled=!approved/);
  assert.doesNotMatch(app,/approve-profile"\)\.addEventListener\("click",[^{]*\{[^}]*openMarketStrategy/);
});

test('profile approval card remains visible after approval',()=>{
  const runtime=read('profile-action-runtime.js');
  assert.match(runtime,/Profile approved/);
  assert.match(runtime,/Your approved profile is ready for Market Strategy/);
  assert.doesNotMatch(runtime,/card\.hidden\s*=\s*true/);
});
