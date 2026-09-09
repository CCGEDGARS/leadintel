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

test('reference customer actions use the requested two-line labels and equal-size layout',()=>{
  const runtime=read('reference-customer-website-enrichment.js');
  const css=read('reference-customers.css');
  assert.match(runtime,/Find missing info/);
  assert.match(css,/\.reference-analysis-actions\s*>\s*button/);
  assert.match(css,/min-width\s*:\s*190px/);
  assert.match(css,/min-height\s*:\s*72px/);
  assert.match(css,/white-space\s*:\s*normal/);
  assert.match(css,/line-height\s*:\s*1\.2/);
});

test('AI analysis reports progress and sign-in errors beside the action buttons',()=>{
  const source=read('reference-customer-ai-runtime.js');
  assert.match(source,/reference-action-status/);
  assert.match(source,/Analyzing|Scraping reference customer websites/i);
  assert.match(source,/AI analysis requires a signed-in LeadIntel workspace/);
});

test('process map loads refreshed reference-customer action runtimes',()=>{
  const source=read('process-map.js');
  assert.match(source,/reference-customer-clear-list\.js\?v=20260909-reference-actions-v2/);
  assert.match(source,/reference-customer-website-enrichment\.js\?v=20260909-reference-actions-v2/);
  assert.match(source,/reference-customer-ai-runtime\.js\?v=20260909-reference-actions-v2/);
});
