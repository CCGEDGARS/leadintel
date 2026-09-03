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

test('workspace persistence boundary loads before server bridge and prevents legacy draft rehydration',()=>{
  assert.ok(persistence,'workspace-persistence.js must exist');
  assert.match(processMap,/workspace-persistence\.js\?v=/);
  assert.ok(processMap.indexOf('workspace-persistence.js')<processMap.indexOf('server-bridge.js'),'persistence boundary must load before server bridge');
  assert.match(persistence,/prepareForLoad\(\)/);
  assert.match(persistence,/leadintel_customer_v2_workspace_saved_snapshot_v1/);
  assert.match(persistence,/leadintel_customer_v2_workspace_explicit_save_v1/);
  assert.match(persistence,/if\(!isExplicitlySaved\(\)\)[\s\S]*clearWorkspaceData\(\)/);
});

test('website activation keeps a real failure visible after the request finishes',()=>{
  assert.match(activation,/let\s+activationError\s*=\s*['"]['"]/);
  assert.match(activation,/activationError\s*=\s*`Activation failed/);
  assert.match(activation,/if\(activationError\)[\s\S]*setStatus\(['"]error['"]/);
  assert.doesNotMatch(activation,/catch\(error\)[\s\S]{0,350}setStatus\(['"]error['"][\s\S]{0,350}finally\{running=false;render\(\);\}/);
});

test('signed-in Firecrawl routing retries managed fallback only for retryable backend failures',()=>{
  assert.match(router,/function\s+retryableStatus\s*\(/);
  assert.match(router,/status===429\|\|status>=500/);
  assert.match(router,/catch\s*\([^)]*\)[\s\S]*originalFetch\(input,options\)/);
  assert.match(router,/if\(retryableStatus\(response\.status\)\)[\s\S]*originalFetch\(input,options\)/);
  assert.doesNotMatch(router,/status===400\|\|status===401\|\|status===403[\s\S]{0,200}originalFetch\(input,options\)/);
});
