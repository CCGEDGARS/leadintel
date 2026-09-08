const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const variants=fs.readFileSync(path.join(process.cwd(),'content-variants.js'),'utf8');
const processMap=fs.readFileSync(path.join(process.cwd(),'process-map.js'),'utf8');
const bridge=fs.readFileSync(path.join(process.cwd(),'outreach-automation-bridge.js'),'utf8');

test('customer boot does not eagerly load outreach automation network modules',()=>{
  assert.doesNotMatch(variants,/import\('\.\/outreach-automation-(?:bridge|ui|delivery-handoff)\.js/);
  assert.match(processMap,/import '\.\/outreach-automation-loader\.js\?v=/);
});

test('outreach automation loader activates only for Delivery step 7',()=>{
  const loader=fs.readFileSync(path.join(process.cwd(),'outreach-automation-loader.js'),'utf8');
  assert.match(loader,/Number\(event\.detail\?\.step\)===7/);
  assert.match(loader,/Promise\.all/);
  assert.doesNotMatch(loader,/setTimeout\([^)]*loadAutomation/);
});

test('outreach automation API requests have a hard browser timeout',()=>{
  assert.match(bridge,/AbortController/);
  assert.match(bridge,/setTimeout\([^,]+,\s*10000\)/);
  assert.match(bridge,/signal:controller\.signal/);
});
