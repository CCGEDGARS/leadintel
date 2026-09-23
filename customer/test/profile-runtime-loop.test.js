const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const runtime=fs.readFileSync(path.join(__dirname,'..','profile-action-runtime.js'),'utf8');
const processMap=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');

test('profile synchronization is idempotent and does not depend on mutation-loop rewrites',()=>{
  assert.match(runtime,/function setText\(/);
  assert.match(runtime,/function toggleClass\(/);
  assert.match(runtime,/if\(card\.hidden\)card\.hidden=false/);
  assert.match(runtime,/setText\(eyebrow,approved\?'Profile approved':'Profile approval'\)/);
  assert.match(runtime,/Approve this profile before building your Strategy\./);
  assert.match(runtime,/Approval saves it as the current source of truth\./);
  assert.match(runtime,/Continue to Strategy/);
  assert.doesNotMatch(runtime,/approve-profile-bottom/);
  assert.doesNotMatch(runtime,/if\(eyebrow\)eyebrow\.textContent=/);
  assert.doesNotMatch(runtime,/if\(heading\)heading\.textContent=/);
  assert.doesNotMatch(runtime,/if\(copy\)copy\.textContent=/);
  assert.doesNotMatch(runtime,/new MutationObserver/);
});

test('process map cache-busts the emergency-stable profile runtime',()=>{
  assert.match(processMap,/profile-action-runtime\.js\?v=20260924-friendly-workflow-labels-v1/);
});
