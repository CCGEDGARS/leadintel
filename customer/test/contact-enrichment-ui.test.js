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

test('phone lookup is a separate explicit paid action and never runs silently with email enrichment',()=>{
  assert.match(ui,/Find phone[^<\n]*paid/i);
  assert.match(ui,/data-action="find-phone"/);
  assert.match(ui,/phoneLookup\s*:\s*true/);
  assert.match(ui,/phoneLookup\s*:\s*false/);
  assert.match(ui,/Verified phone/i);
  assert.match(ui,/Phone lookup.*pending/i);
});

test('pending Apollo phone lookup can be refreshed from durable CRM without buying another lookup',()=>{
  assert.match(ui,/data-action="refresh-phone"/);
  assert.match(ui,/getCrmCompany/);
  assert.match(ui,/external_person_id/);
  assert.match(ui,/phone_number/);
});
