const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');

test('Discovery applies decision-maker ranking before persisting Apollo people',()=>{
  assert.match(ui,/LeadIntelDiscovery\.selectDecisionMakers\(\s*LeadIntelDiscovery\.normalizeApolloPeople\([^)]*\)\s*,\s*main\.profile\s*\|\|\s*\{\}\s*,\s*4\s*\)/s);
});

test('Discovery makes a shortage explicit instead of implying four contacts were found',()=>{
  assert.match(ui,/relevant decision-maker/i);
  assert.match(ui,/people\.length\s*<\s*3/);
});

test('Discovery exposes a separate authenticated paid enrichment action for selected people',()=>{
  assert.match(ui,/Enrich contact/);
  assert.match(ui,/data-action="enrich-contact"/);
  assert.match(ui,/bridge\(\)\.enrichCrmContact/);
  assert.match(ui,/person_id|person\.id/);
  assert.doesNotMatch(ui,/X-Api-Key/);
});

test('verified enrichment stays out of local Discovery state and is rendered from CRM-safe memory',()=>{
  assert.match(ui,/enrichmentResults/);
  assert.match(ui,/Verified email/i);
  assert.doesNotMatch(ui,/candidate\.people\[[^\]]+\]\.email\s*=/);
  assert.doesNotMatch(ui,/person\.email\s*=.*saveDiscovery/s);
});

test('Discovery requires durable CRM identity before paid enrichment',()=>{
  assert.match(ui,/crmCompanyByDomain/);
  assert.match(ui,/saveCrmCompany/);
  assert.match(ui,/Sign in.*enrich/i);
});
