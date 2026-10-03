const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ui=fs.readFileSync(path.join(__dirname,'..','discovery-ui.js'),'utf8');

test('Discovery ranks a wider public pool and displays at most six before enrichment',()=>{
 const search=ui.slice(ui.indexOf('async function searchDecisionMakers('),ui.indexOf('function saveLocalPipeline'));
 assert.match(search,/mergeBuyerPool\(previous,publicPeople,buyerProfile\)/);
 assert.match(search,/candidate.people=.*slice\(0,6\)/);
 assert.match(search,/searchApolloPeople/);
});

test('Discovery makes a shortage explicit instead of implying four contacts were found',()=>{
  assert.match(ui,/relevant decision-maker/i);
  assert.match(ui,/people\.length\s*<\s*3/);
});

test('Discovery exposes a separate authenticated paid enrichment action for selected people',()=>{
  assert.match(ui,/Confirm email with Hunter and Apollo/);
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

test('selected buyer card shows Apollo outcome and makes another lookup explicit',()=>{
  assert.match(ui,/\$\{enrichmentResultHtml\(enrichmentResults\.get\(personKey\(candidate,person\)\)\)\}<\/div>\$\{!direct/);
  assert.match(ui,/Confirm email/);
  assert.match(ui,/confirmBuyerContact\(candidate,Number\(button\.dataset\.personIndex\),\{kind:"email"\}\)/);
  assert.match(ui,/Apollo check failed/);
});

test('Discovery requires durable CRM identity before paid enrichment',()=>{
  assert.match(ui,/crmCompanyByDomain/);
  assert.match(ui,/saveCrmCompany/);
  assert.match(ui,/Sign in.*enrich/i);
});

test('phone lookup is explicit or enabled by the buyer phone flow checkbox',()=>{
  assert.match(ui,/Confirm phone/i);
  assert.match(ui,/Phone found ✓/);
  assert.doesNotMatch(ui,/Find phone · paid|Find phone · up to 9 credits/);
  assert.match(ui,/phoneAction\s*=\s*phonePending\?"refresh-phone":"find-phone"/);
  assert.match(ui,/data-action="\$\{phoneAction\}"/);
  assert.match(ui,/auto-confirm-toggle/);
  assert.match(ui,/await apollo\(true\)/);
  assert.match(ui,/await apollo\(false\)/);
  assert.match(ui,/Verified phone/i);
  assert.match(ui,/Phone lookup.*pending/i);
});

test('pending Apollo phone lookup can be refreshed from durable CRM without buying another lookup',()=>{
  assert.match(ui,/"refresh-phone"/);
  assert.match(ui,/refreshEnrichedContact/);
  assert.match(ui,/getCrmCompany/);
  assert.match(ui,/external_person_id/);
  assert.match(ui,/phone_number/);
});

test('Discovery exposes Apollo LinkedIn identity links without implying role verification',()=>{
  assert.match(ui,/View public LinkedIn profile/);
  assert.match(ui,/confirm the current role before outreach/);
  assert.match(ui,/Find work email/);
});
