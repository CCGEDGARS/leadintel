const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-library-ui.js'),'utf8');
const aiRuntime=fs.readFileSync(path.join(__dirname,'..','reference-customer-ai-runtime.js'),'utf8');

test('every saved customer list exposes Analyze Activate Edit and Delete row actions',()=>{
  assert.match(ui,/data-analyze-reference-list/);
  assert.match(ui,/data-activate-reference-list/);
  assert.match(ui,/data-edit-reference-list/);
  assert.match(ui,/data-delete-reference-list/);
  assert.match(ui,/>Analyze<\/button>/);
  assert.match(ui,/\?\s*'Deactivate'\s*:\s*'Activate'/);
  assert.match(ui,/>Edit<\/button>/);
  assert.match(ui,/>Delete<\/button>/);
});

test('row Analyze selects its list before starting the existing analysis runtime',()=>{
  assert.match(ui,/async function analyzeList\(id/);
  assert.match(ui,/Portfolio\.selectList\(state,id\)/);
  assert.match(ui,/reference-analyze/);
});

test('analysis results are synchronized back into the selected saved list',()=>{
  assert.match(aiRuntime,/LeadIntelReferenceCustomerPortfolio/);
  assert.match(aiRuntime,/Portfolio\.syncCurrentList\(state\)/);
});

test('row activation supports analyzed candidates and active-model deactivation',()=>{
  assert.match(ui,/async function activateList\(id/);
  assert.match(ui,/activateReferenceSegments/);
  assert.match(ui,/publishReferenceModel/);
  assert.match(ui,/setListActive/);
});
