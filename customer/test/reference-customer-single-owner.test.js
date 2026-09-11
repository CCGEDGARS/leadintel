import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baseUi=fs.readFileSync(new URL('../reference-customer-ui.js',import.meta.url),'utf8');
const uploadMode=fs.readFileSync(new URL('../reference-customer-upload-mode.js',import.meta.url),'utf8');
const launcher=fs.readFileSync(new URL('../reference-customer-launcher.js',import.meta.url),'utf8');

test('Reference Customer base UI is the sole owner of the import button click',()=>{
  assert.match(baseUi,/querySelector\('#reference-upload-button'\)\?\.addEventListener\('click'/);
  assert.match(baseUi,/fileInput\.click\(\)/);
  assert.doesNotMatch(uploadMode,/closest\?\.\('#reference-upload-button'\)/);
  assert.doesNotMatch(uploadMode,/stopImmediatePropagation\s*\(/);
});

test('launcher only opens the Reference Customer UI and does not own file import behavior',()=>{
  assert.match(launcher,/LeadIntelReferenceCustomerUI\?\.open/);
  assert.doesNotMatch(launcher,/reference-file-input|\.click\(\).*reference-file|startNewListUpload/);
});

test('upload mode exposes import-state helpers without intercepting document clicks',()=>{
  assert.match(uploadMode,/consumeImportMode/);
  assert.match(uploadMode,/prepareFileImport/);
  assert.doesNotMatch(uploadMode,/document\.addEventListener\('click'/);
});
