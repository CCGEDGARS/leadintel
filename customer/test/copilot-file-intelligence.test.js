const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('Ask LeadIntel loads file intelligence capability',()=>{
  const loader=fs.readFileSync(path.join(__dirname,'..','copilot-loader.js'),'utf8');
  assert.match(loader,/copilot-file-intelligence\.js\?v=/);
});

test('file intelligence supports Excel and CSV, enriches websites, and returns a sorted cleaned CSV',()=>{
  const file=fs.readFileSync(path.join(__dirname,'..','copilot-file-intelligence.js'),'utf8');
  assert.match(file,/\.xlsx/);
  assert.match(file,/\.xls/);
  assert.match(file,/\.csv/);
  assert.match(file,/Find missing websites/);
  assert.match(file,/LeadIntel_Customer_List_Cleaned\.csv/);
  assert.match(file,/Company Name,Website,Status,Confidence/);
  assert.match(file,/Use in Reference Customer Intelligence/);
});

test('file intelligence does not silently import into Reference Customer Intelligence',()=>{
  const file=fs.readFileSync(path.join(__dirname,'..','copilot-file-intelligence.js'),'utf8');
  assert.match(file,/data-copilot-file-import/);
  assert.doesNotMatch(file,/autoImport\s*=\s*true/);
});
