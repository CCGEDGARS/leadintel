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
  assert.match(runtime,/setText\(eyebrow,'Next step'\)/);
  assert.match(runtime,/setText\(heading,'Continue to Market Strategy\.'\)/);
  assert.match(runtime,/setText\(copy,'Approval is optional\./);
  assert.match(runtime,/setText\(nextButton,'Next: Market Strategy →'\)/);
  assert.doesNotMatch(runtime,/if\(eyebrow\)eyebrow\.textContent=/);
  assert.doesNotMatch(runtime,/if\(heading\)heading\.textContent=/);
  assert.doesNotMatch(runtime,/if\(copy\)copy\.textContent=/);
  assert.doesNotMatch(runtime,/new MutationObserver/);
});

test('process map cache-busts the emergency-stable profile runtime',()=>{
  assert.match(processMap,/profile-action-runtime\.js\?v=20260911-emergency-stable-v1/);
});
