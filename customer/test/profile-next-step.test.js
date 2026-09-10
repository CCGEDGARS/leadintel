const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('bottom profile CTA is a next-step action and never requires approval',()=>{
  const runtime=read('profile-action-runtime.js');
  assert.match(runtime,/Next:\s*Market Strategy/);
  assert.match(runtime,/Continue to Market Strategy/);
  assert.match(runtime,/openMarketStrategy/);
  assert.match(runtime,/closest\?\.\(['"]#approve-profile-bottom['"]\)/);
  assert.doesNotMatch(runtime,/card\.hidden\s*=\s*true/);
});
