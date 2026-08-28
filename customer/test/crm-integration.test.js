const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const bridge=fs.readFileSync(path.join(root,'server-bridge.js'),'utf8');
const processMap=fs.readFileSync(path.join(root,'process-map.js'),'utf8');

test('process shell loads CRM engine before the server bridge and CRM UI',()=>{
  const engineIndex=processMap.indexOf("crm-engine.js");
  const bridgeIndex=processMap.indexOf("server-bridge.js");
  const uiIndex=processMap.indexOf("crm-ui.js");
  assert.ok(engineIndex>=0&&bridgeIndex>engineIndex&&uiIndex>bridgeIndex);
});

test('server bridge exposes authenticated Master CRM operations without placing CRM into customer state bundle',()=>{
  for(const method of ['listCrmCompanies','getCrmCompany','saveCrmCompany','addCrmToPipeline','removeCrmFromPipeline','archiveCrmCompany','restoreCrmCompany','suppressCrmCompany','markCrmCustomer','saveCrmContacts','recordCrmActivity','deleteCrmCompany'])assert.match(bridge,new RegExp(method));
  assert.match(bridge,/`\/api\/crm\$\{path\}/);
  assert.match(bridge,/crmRequest\('\/companies'/);
  assert.doesNotMatch(bridge,/KEYS=\{[^}]*crm:/);
});

test('server bridge migrates old local pipeline idempotently per workspace without deleting local data',()=>{
  assert.match(bridge,/CRM_MIGRATION_KEY/);
  assert.match(bridge,/migrateLocalPipeline/);
  assert.match(bridge,/mapLocalPipelineItemToCrm/);
  assert.match(bridge,/pipeline/);
  assert.doesNotMatch(bridge,/removeItem\(KEYS\.discovery\)/);
});
