const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-ui.js'),'utf8');
const profile=fs.readFileSync(path.join(__dirname,'..','intelligence-profile-ui.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','reference-customers.css'),'utf8');
const boot=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
const aiRuntimePath=path.join(__dirname,'..','reference-customer-ai-runtime.js');

test('customer boot loads reference engine, AI client, UI, AI runtime and lookalike integration in dependency order',()=>{
  const engine=boot.indexOf('reference-customers.js');
  const ai=boot.indexOf('reference-customer-ai.js');
  const manager=boot.indexOf('reference-customer-ui.js');
  const runtime=boot.indexOf('reference-customer-ai-runtime.js');
  const lookalike=boot.indexOf('lookalike-discovery.js');
  assert.ok(engine>=0,'reference-customers.js must be loaded');
  assert.ok(ai>engine,'reference-customer-ai.js must load after the reference engine');
  assert.ok(manager>ai,'reference-customer-ui.js must load after the AI client');
  assert.ok(runtime>manager,'AI runtime must load after the reference customer UI');
  assert.ok(lookalike>runtime,'lookalike integration must load after AI analysis runtime');
});

test('reference customer card explains optional context and opens customer evidence',()=>{
  assert.match(boot,/Improve opportunity targeting/i);
  assert.match(boot,/Discovery searches for demand signals/i);
  assert.match(boot,/Add past customers/i);
  assert.match(css,/reference-customer-summary/);
  assert.match(css,/reference-customer-manage/);
});

test('manager explains the minimal two-column file format and offers a CSV template',()=>{
  assert.match(ui,/Company Name/i);
  assert.match(ui,/Website/i);
  assert.match(ui,/Download example CSV/i);
  assert.match(ui,/Include a Company Name, Website, or both/i);
});

test('AI runtime uses configured AI after scraping and before activation',()=>{
  assert.equal(fs.existsSync(aiRuntimePath),true,'AI runtime must exist');
  const runtime=fs.readFileSync(aiRuntimePath,'utf8');
  assert.match(runtime,/LeadIntelReferenceCustomerAI/);
  assert.match(runtime,/requestReferenceCustomerAnalysis/);
  assert.match(runtime,/AI analysis/i);
  assert.match(runtime,/firecrawl-scrape/);
});

test('manager analyzes before activation and shows segment review controls',()=>{
  assert.match(ui,/Analyze customer list/i);
  assert.match(ui,/Suggested customer profile/i);
  assert.match(ui,/Activate selected segments/i);
  assert.match(ui,/Review before activation/i);
});

test('profile review distinguishes one-off observations and requires explicit selection',()=>{
  assert.match(ui,/No shared customer pattern detected/i);
  assert.match(ui,/Observed attributes/i);
  assert.match(ui,/segment\.canActivate/);
  assert.match(ui,/checked:not\(:disabled\)/);
  assert.doesNotMatch(ui,/!reference\.activated&&segments\.length===1/);
});

test('activation copy explains downstream effect without implying outreach',()=>{
  assert.match(ui,/Only traits repeated across a segment/i);
  assert.match(ui,/verified opportunities rank by fit and demand signals/i);
  assert.match(ui,/Discovery/i);
  assert.match(ui,/does not exclude other companies or add these references to outreach/i);
});
