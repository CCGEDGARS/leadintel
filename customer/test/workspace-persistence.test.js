const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const bridge=fs.readFileSync(path.join(root,'server-bridge.js'),'utf8');
const persistencePath=path.join(root,'workspace-persistence.js');
const persistence=fs.existsSync(persistencePath)?fs.readFileSync(persistencePath,'utf8'):'';

test('workspace persistence helper loads before app state initializes',()=>{
  assert.equal(fs.existsSync(persistencePath),true,'workspace-persistence.js must exist');
  const helperPos=index.indexOf('workspace-persistence.js');
  const appPos=index.indexOf('app.js');
  assert.ok(helperPos>=0&&appPos>helperPos,'persistence helper must load before app.js');
  assert.match(persistence,/prepareForLoad\(\)/);
});

test('legacy autosaved workspace data is ignored unless it was explicitly saved',()=>{
  assert.match(persistence,/leadintel_customer_v2_workspace_explicit_save_v1/);
  assert.match(persistence,/function prepareForLoad\(\)/);
  assert.match(persistence,/if\(!isExplicitlySaved\(\)\).*clearWorkspaceData\(\)/s);
  for(const key of ['leadintel_customer_v2_state','leadintel_customer_v2_discovery','leadintel_customer_v2_outreach','leadintel_customer_v2_delivery','leadintel_customer_v2_discovery_meta','leadintel_customer_v2_website_activation_v1','leadintel_customer_v2_research_meta_v1'])assert.match(persistence,new RegExp(key));
});

test('customer gets an explicit Save workspace action that persists the current workspace',()=>{
  assert.match(persistence,/id=["']save-workspace["']/);
  assert.match(persistence,/Save workspace/);
  assert.match(persistence,/markExplicitlySaved\(\)/);
  assert.match(persistence,/LeadIntelServerBridge\?\.saveNow\?\.\(\)/);
});

test('workspace reset removes explicit persistence but does not touch API provider configuration or CRM',()=>{
  assert.match(persistence,/clearExplicitSave\(\)/);
  assert.match(persistence,/leadintel_customer_v2_force_reset_save_v1/);
  assert.doesNotMatch(persistence,/\/api\/integrations\/ai\/provider|disconnectProvider|deleteCrmCompany|\/api\/crm/i);
});

test('server bridge never syncs or restores an unsaved draft as a persistent workspace',()=>{
  assert.match(bridge,/workspace_explicit_save/);
  assert.match(bridge,/explicit_saved/);
  assert.match(bridge,/function isExplicitlySaved\(\)/);
  assert.match(bridge,/function serverPayloadIsExplicitlySaved/);
  assert.match(bridge,/if\(!isExplicitlySaved\(\)\)return;/);
  assert.match(bridge,/if\(!serverPayloadIsExplicitlySaved\(state\.payload\)\).*return true/s);
  assert.match(bridge,/force_reset_save/);
});

test('server payload carries explicit-save provenance so saved workspaces restore on another signed-in browser',()=>{
  assert.match(bridge,/explicit_saved:isExplicitlySaved\(\)/);
  assert.match(bridge,/markExplicitlySaved\(\)/);
  assert.match(bridge,/applyPayload\(state\.payload\)/);
});
