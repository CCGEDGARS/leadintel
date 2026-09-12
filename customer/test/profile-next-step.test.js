const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('bottom profile CTA presentation mirrors the app-owned next-step action',()=>{
  const runtime=read('profile-action-runtime.js');
  assert.match(runtime,/Continue to Market Strategy/);
  assert.match(runtime,/Approve profile \(optional\)/);
  assert.doesNotMatch(runtime,/openMarketStrategy/);
  assert.doesNotMatch(runtime,/document\.addEventListener\(['"]click['"]/);
  assert.doesNotMatch(runtime,/card\.hidden\s*=\s*true/);
});
