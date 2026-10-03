const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../discovery.css'),'utf8');

test('clear-results uses an in-app LeadIntel dialog instead of browser confirm',()=>{
  assert.doesNotMatch(source,/window\.confirm\(/);
  assert.match(source,/id="clear-company-results-modal"/);
  assert.match(source,/Clear search results\?/);
  assert.match(source,/This will remove/);
  assert.match(source,/This will stay/);
  assert.match(source,/Saved CRM records/);
});

test('clear-results dialog has explicit cancel and confirm actions',()=>{
  assert.match(source,/id="cancel-clear-company-results"[^>]*>Cancel</);
  assert.match(source,/id="confirm-clear-company-results"[^>]*>Clear results</);
  assert.match(source,/clear-company-results"\)\?\.addEventListener\("click",openClearCompanyResultsModal\)/);
  assert.match(source,/confirm-clear-company-results"\)\?\.addEventListener\("click",clearCompanySearchResults\)/);
  assert.match(source,/event\.key==="Escape"/);
});

test('clear-results modal follows LeadIntel visual system',()=>{
  assert.match(css,/\.clear-company-modal\[hidden\]/);
  assert.match(css,/\.clear-company-modal-dialog/);
  assert.match(css,/\.clear-company-modal-impact/);
  assert.match(css,/\.clear-company-modal-open/);
});
