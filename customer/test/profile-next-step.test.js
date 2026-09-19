const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('bottom profile CTA presentation mirrors the app-owned next-step action',()=>{
  const runtime=read('profile-action-runtime.js');
  const html=read('index.html');
  assert.doesNotMatch(html,/profile-header-actions[^\n]*edit-profile/);
  assert.match(html,/profile-approval-actions[^\n]*id="edit-profile"/);
  assert.match(html,/profile-next-action[^\n]*id="approve-profile"[^\n]*Continue to Market Strategy/);
  assert.doesNotMatch(html,/approve-profile-bottom/);
  assert.match(runtime,/Continue to Market Strategy/);
  assert.match(runtime,/Approve this profile before building Market Strategy/);
  assert.doesNotMatch(runtime,/openMarketStrategy/);
  assert.doesNotMatch(runtime,/document\.addEventListener\(['"]click['"]/);
  assert.doesNotMatch(runtime,/card\.hidden\s*=\s*true/);
});
