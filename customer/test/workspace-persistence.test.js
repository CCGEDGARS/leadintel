const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.join(__dirname,'..');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8');
const persistencePath=path.join(root,'workspace-persistence.js');
const persistence=fs.existsSync(persistencePath)?fs.readFileSync(persistencePath,'utf8'):'';

test('workspace persistence helper loads before app state initializes',()=>{
  assert.equal(fs.existsSync(persistencePath),true,'workspace-persistence.js must exist');
  const helperPos=index.indexOf('workspace-persistence.js');
  const appPos=index.indexOf('app.js');
  assert.ok(helperPos>=0&&appPos>helperPos,'persistence helper must load before app.js');
  assert.match(persistence,/prepareForLoad\(\)/);
});

test('legacy autosaved workspace data is ignored unless it has an explicit saved snapshot',()=>{
  assert.match(persistence,/leadintel_customer_v2_workspace_explicit_save_v1/);
  assert.match(persistence,/leadintel_customer_v2_workspace_saved_snapshot_v1/);
  assert.match(persistence,/function prepareForLoad\(\)/);
  assert.match(persistence,/if\(!isExplicitlySaved\(\)\).*clearWorkspaceData\(\)/s);
  assert.match(persistence,/restoreSavedSnapshot\(\)/);
  for(const key of ['leadintel_customer_v2_state','leadintel_customer_v2_discovery','leadintel_customer_v2_outreach','leadintel_customer_v2_delivery','leadintel_customer_v2_discovery_meta','leadintel_customer_v2_website_activation_v1','leadintel_customer_v2_research_meta_v1'])assert.match(persistence,new RegExp(key));
});

test('customer gets an explicit Save workspace action that snapshots and persists the current workspace',()=>{
  assert.match(persistence,/id=["']save-workspace["']/);
  assert.match(persistence,/Save workspace/);
  assert.match(persistence,/captureWorkspaceSnapshot\(\)/);
  assert.match(persistence,/markExplicitlySaved\(\)/);
  assert.match(persistence,/LeadIntelServerBridge\?\.saveNow\?\.\(\)/);
});

test('workspace reset removes explicit persistence but does not touch API provider configuration or CRM',()=>{
  assert.match(persistence,/clearExplicitSave\(\)/);
  assert.match(persistence,/leadintel_customer_v2_force_reset_save_v1/);
  assert.match(persistence,/localStorage\.removeItem\(SNAPSHOT_KEY\)/);
  assert.doesNotMatch(persistence,/\/api\/integrations\/ai\/provider|disconnectProvider|deleteCrmCompany|\/api\/crm/i);
});

test('runtime server autosave is disabled so drafts cannot become persistent without Save workspace',()=>{
  assert.match(persistence,/Storage\.prototype\.__leadintelServerPatched\s*=\s*true/);
  assert.match(persistence,/function installFetchBoundary\(\)/);
  assert.match(persistence,/\/api\/customer\/state/);
  assert.match(persistence,/if\(method===["']PUT["']&&!isExplicitlySaved\(\)&&!forceReset\)/);
});

test('legacy server state is not rehydrated, while explicitly saved server state is allowed and snapshotted',()=>{
  assert.match(persistence,/explicit_saved===true/);
  assert.match(persistence,/snapshotFromServerPayload/);
  assert.match(persistence,/payload:\{\}/);
  assert.match(persistence,/leadintel_customer_v2_server_hydration/);
});

test('server PUT provenance distinguishes explicit save from reset',()=>{
  assert.match(persistence,/explicit_saved:isExplicitlySaved\(\)/);
  assert.match(persistence,/explicit_saved:false/);
  assert.match(persistence,/FORCE_RESET_KEY/);
});
