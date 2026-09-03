const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const read=name=>fs.existsSync(path.join(root,name))?fs.readFileSync(path.join(root,name),'utf8'):'';
const processMap=read('process-map.js');
const activation=read('website-activation.js');
const router=read('firecrawl-workspace-router.js');
const persistence=read('workspace-persistence.js');

test('workspace persistence boundary loads before server bridge and preserves a meaningful local draft across internal reloads',()=>{
  assert.ok(persistence,'workspace-persistence.js must exist');
  assert.match(processMap,/workspace-persistence\.js\?v=/);
  assert.ok(processMap.indexOf('workspace-persistence.js')<processMap.indexOf('server-bridge.js'),'persistence boundary must load before server bridge');
  assert.match(persistence,/prepareForLoad\(\)/);
  assert.match(persistence,/leadintel_customer_v2_workspace_saved_snapshot_v1/);
  assert.match(persistence,/leadintel_customer_v2_workspace_explicit_save_v1/);
  assert.match(persistence,/if\(!isExplicitlySaved\(\)\)return false;/,'an unsaved local draft must survive ordinary/internal reloads');
  assert.match(persistence,/if\(hasMeaningfulWorkspaceData\(\)\)return false;/,'current meaningful local data must win over an older saved snapshot');
});

test('explicit persistence boundary allows a confirmed workspace reset to clear server state',()=>{
  assert.match(persistence,/function\s+handleResetClick\s*\(/);
  assert.match(persistence,/button\.dataset\.resetArmed!==['"]true['"]/);
  assert.match(persistence,/sessionStorage\?\.setItem\(FORCE_RESET_KEY,['"]1['"]\)/);
  assert.match(persistence,/clearExplicitSave\(\)/);
  assert.match(persistence,/addEventListener\?\.\(['"]click['"],handleResetClick,true\)/);
  assert.match(persistence,/forceReset[\s\S]*meta\.persistence=\{explicit_saved:false\}/);
});

test('website activation keeps a real failure visible after the request finishes',()=>{
  assert.match(activation,/let\s+activationError\s*=\s*['"]['"]/);
  assert.match(activation,/activationError\s*=\s*`Activation failed/);
  assert.match(activation,/if\(activationError\)\{setStatus\(['"]error['"],activationError\);return;\}/);
  assert.match(activation,/finally\{running=false;render\(\);\}/,'request cleanup may render only because render preserves activationError');
  assert.match(activation,/function\s+clearErrorAndRender\(\)\{activationError=['"]['"];render\(\);\}/,'a new website edit explicitly clears the previous failure');
});

test('signed-in Firecrawl routing retries managed fallback only for retryable backend failures',()=>{
  assert.match(router,/function\s+retryableStatus\s*\(/);
  assert.match(router,/status===429\|\|status>=500/);
  assert.match(router,/catch\s*\([^)]*\)[\s\S]*originalFetch\(input,options\)/);
  assert.match(router,/if\(retryableStatus\(response\.status\)\)[\s\S]*originalFetch\(input,options\)/);
  assert.doesNotMatch(router,/status===400\|\|status===401\|\|status===403[\s\S]{0,200}originalFetch\(input,options\)/);
});
