const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('website enrichment reports progress beside the action buttons and exposes total search failure',()=>{
  const source=read('reference-customer-website-enrichment.js');
  assert.match(source,/reference-action-status/);
  assert.match(source,/Finding missing websites/i);
  assert.match(source,/firstError|searchError|lastError/);
  assert.match(source,/Unable to search|Website search failed/i);
});

test('AI analysis reports progress and sign-in errors beside the action buttons',()=>{
  const source=read('reference-customer-ai-runtime.js');
  assert.match(source,/reference-action-status/);
  assert.match(source,/Analyzing|Scraping reference customer websites/i);
  assert.match(source,/AI analysis requires a signed-in LeadIntel workspace/);
});

test('process map loads refreshed reference-customer action runtimes',()=>{
  const source=read('process-map.js');
  assert.match(source,/reference-customer-clear-list\.js\?v=20260909-action-repair-v1/);
  assert.match(source,/reference-customer-website-enrichment\.js\?v=20260909-action-repair-v1/);
  assert.match(source,/reference-customer-ai-runtime\.js\?v=20260909-action-repair-v1/);
});
