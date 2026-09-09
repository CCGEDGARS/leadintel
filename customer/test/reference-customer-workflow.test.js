const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-ui.js'),'utf8');
const profile=fs.readFileSync(path.join(__dirname,'..','intelligence-profile-ui.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'..','reference-customers.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');

test('customer page loads reference customer engine and UI before profile runtime',()=>{
  const engine=html.indexOf('reference-customers.js');
  const manager=html.indexOf('reference-customer-ui.js');
  const runtime=html.indexOf('intelligence-profile-runtime.js');
  assert.ok(engine>=0,'reference-customers.js must be loaded');
  assert.ok(manager>engine,'reference-customer-ui.js must load after the engine');
  assert.ok(runtime>manager,'profile runtime must load after reference customer UI');
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
