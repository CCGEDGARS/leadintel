const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');

test('Discovery exposes separate Save to CRM and Add to Pipeline actions',()=>{
  assert.match(source,/data-action="save-crm"/);
  assert.match(source,/data-action="add-pipeline"/);
  assert.match(source,/In CRM/);
  assert.match(source,/Suppressed/);
});

test('Discovery uses Master CRM as authenticated source while preserving local fallback',()=>{
  assert.match(source,/listCrmCompanies/);
  assert.match(source,/saveCrmCompany/);
  assert.match(source,/addCrmToPipeline/);
  assert.match(source,/removeCrmFromPipeline/);
  assert.match(source,/LeadIntelCrm\.mapDiscoveryCandidateToCrm/);
  assert.match(source,/LeadIntelDiscovery\.upsertPipelineItem/);
});

test('Discovery blocks normal pipeline activation for suppressed CRM companies',()=>{
  assert.match(source,/lifecycle_status\s*===\s*["']suppressed["']/);
  assert.match(source,/CRM_COMPANY_SUPPRESSED|Suppressed/);
});

test('Discovery listens for durable CRM changes and refreshes company state',()=>{
  assert.match(source,/leadintel:server-ready/);
  assert.match(source,/leadintel:crm-migrated/);
  assert.match(source,/leadintel:crm-changed/);
});
