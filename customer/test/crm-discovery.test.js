const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');

test('Discovery labels CRM save and pipeline actions separately',()=>{
  assert.match(source,/data-action="save-crm"/);
  assert.match(source,/data-action="add-pipeline"/);
  assert.match(source,/"Save in CRM"/);
  assert.match(source,/Saved in CRM ✓/);
  assert.match(source,/pipeline-crm-status/);
  assert.match(source,/data-open-crm-company="\$\{esc\(item\.crmId\|\|item\.id\)\}">Open CRM/);
  assert.match(source,/Suppressed/);
});

test('Buyers focus shows a distinct saved-company list and supports buyer search from the pipeline',()=>{
  assert.match(source,/discoveryPanel\.hidden=buyers/);
  assert.match(source,/buyers-focus-guide/);
  assert.match(source,/data-find-pipeline-buyers/);
  assert.match(source,/function findPipelineDecisionMakers/);
  assert.match(source,/function searchDecisionMakers\(candidate/);
  assert.match(source,/Find buyers/);
});

test('buyer search uses the authenticated workspace Apollo integration',()=>{
  const start=source.indexOf('async function searchDecisionMakers(');
  const end=source.indexOf('function saveLocalPipeline',start);
  const search=source.slice(start,end);
  assert.match(search,/searchApolloPeople/);
  assert.doesNotMatch(search,/fetch\(`\$\{INTELLIGENCE_PROXY\}/);
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
