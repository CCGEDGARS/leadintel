const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('manual entry is a semantic form with a real submit handler and an explicit hidden override',()=>{
  const ui=source('reference-customer-ui.js');
  const css=source('reference-customers.css');
  assert.match(ui,/<form id="reference-manual-form"[^>]*hidden>/);
  assert.match(ui,/manualForm\?\.addEventListener\('submit'/);
  assert.match(ui,/type="submit" id="reference-save-manual"/);
  assert.match(ui,/type="button" id="reference-cancel-manual"/);
  assert.match(css,/\.reference-manual-form\[hidden\]\s*\{\s*display:none!important\s*\}/);
});

test('manual add keeps the saved-list workflow visible so the updated draft can be saved',()=>{
  const ui=source('reference-customer-ui.js');
  const library=source('reference-customer-library-ui.js');
  assert.match(ui,/writeState\(state\);\s*form\.hidden=true/);
  assert.match(ui,/LeadIntelReferenceCustomerLibraryUI\?\.openEditor\?\.\(\)/);
  assert.match(library,/Portfolio\.hasUnsavedCurrentListDraft\?\.\(state\)/);
  assert.match(library,/Save Updated List to keep these changes/);
  assert.match(library,/Save Updated List before opening results, activating, or switching/);
});

test('saved-list navigation cannot overwrite an unsaved company draft',()=>{
  const library=source('reference-customer-library-ui.js');
  assert.match(library,/Portfolio\.selectListSafely\?Portfolio\.selectListSafely\(state,id\)/);
  assert.match(library,/if\(blockOnUnsavedDraft\('Opening another list',state\)\)return false/);
  assert.match(library,/if\(blockOnUnsavedDraft\('Analyzing a saved list',state\)\)return/);
  assert.match(library,/if\(blockOnUnsavedDraft\('Activating a saved list',state\)\)return/);
  assert.match(library,/if\(blockOnUnsavedDraft\('Creating a new list',state\)\)return/);
});

test('reference customer writes do not wait on remote sync before updating the UI',()=>{
  for(const file of ['reference-customer-ui.js','reference-customer-library-ui.js','reference-customer-delete-ui.js','reference-customer-ai-runtime.js','reference-customer-smart-import.js','reference-customer-website-enrichment.js']){
    const runtime=source(file);
    assert.doesNotMatch(runtime,/await\s+root\.LeadIntelServerBridge\?\.saveNow/);
  }
});
