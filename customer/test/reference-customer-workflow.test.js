const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-ui.js'),'utf8');
const profile=fs.readFileSync(path.join(__dirname,'..','intelligence-profile-ui.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','reference-customers.css'),'utf8');
const boot=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');

test('customer boot loads reference engine, AI classifier, UI and lookalike integration in dependency order',()=>{
  const engine=boot.indexOf('reference-customers.js');
  const ai=boot.indexOf('reference-customer-ai.js');
  const manager=boot.indexOf('reference-customer-ui.js');
  const lookalike=boot.indexOf('lookalike-discovery.js');
  assert.ok(engine>=0,'reference-customers.js must be loaded');
  assert.ok(ai>engine,'reference-customer-ai.js must load after the reference engine');
  assert.ok(manager>ai,'reference-customer-ui.js must load after the AI classifier');
  assert.ok(lookalike>manager,'lookalike integration must load after the reference customer UI');
});

test('reference customer card is prominent and uses a large upload-and-analyze CTA',()=>{
  assert.match(profile,/REFERENCE CUSTOMER INTELLIGENCE/i);
  assert.match(profile,/HIGH IMPACT/i);
  assert.match(profile,/Upload & Analyze Customers/i);
  assert.match(css,/reference-customer-summary/);
  assert.match(css,/reference-customer-manage/);
});

test('manager explains the minimal two-column file format and offers a CSV template',()=>{
  assert.match(ui,/Company Name/i);
  assert.match(ui,/Website/i);
  assert.match(ui,/Download example CSV/i);
  assert.match(ui,/Only company name and website are required/i);
});

test('manager uses configured AI after scraping and before activation',()=>{
  assert.match(ui,/LeadIntelReferenceCustomerAI/);
  assert.match(ui,/requestReferenceCustomerAnalysis/);
  assert.match(ui,/AI analysis/i);
});

test('manager analyzes before activation and shows segment review controls',()=>{
  assert.match(ui,/Analyze customer list/i);
  assert.match(ui,/Customer segments/i);
  assert.match(ui,/Activate selected segments/i);
  assert.match(ui,/No meaningful sub-segments detected/i);
});

test('activation copy explains downstream effect without implying outreach',()=>{
  assert.match(ui,/priority model/i);
  assert.match(ui,/Discovery/i);
  assert.match(ui,/does not add these companies to outreach/i);
});
