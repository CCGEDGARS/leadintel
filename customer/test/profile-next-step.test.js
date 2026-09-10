const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('profile action runtime owns a resilient delegated Approve Profile click',()=>{
  const runtime=read('profile-action-runtime.js');
  assert.match(runtime,/closest\?\.\(['"]#approve-profile['"]\)/);
  assert.match(runtime,/state\.approved\s*=\s*true/);
  assert.match(runtime,/Company Intelligence Profile approved/);
});

test('bottom profile CTA is a next-step action and never requires approval',()=>{
  const runtime=read('profile-action-runtime.js');
  assert.match(runtime,/Next:\s*Market Strategy/);
  assert.match(runtime,/openMarketStrategy/);
  assert.match(runtime,/closest\?\.\(['"]#approve-profile-bottom['"]\)/);
  assert.doesNotMatch(runtime,/Approve profile \(optional\)/i);
});
