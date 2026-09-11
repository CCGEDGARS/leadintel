import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const baseUi=fs.readFileSync(new URL('../reference-customer-ui.js',import.meta.url),'utf8');
const uploadMode=fs.readFileSync(new URL('../reference-customer-upload-mode.js',import.meta.url),'utf8');
const launcher=fs.readFileSync(new URL('../reference-customer-launcher.js',import.meta.url),'utf8');
const aiRuntime=fs.readFileSync(new URL('../reference-customer-ai-runtime.js',import.meta.url),'utf8');
const processMap=fs.readFileSync(new URL('../process-map.js',import.meta.url),'utf8');

const VERSION='20260911-reference-single-owner-v1';

test('Reference Customer base UI is the sole owner of the import button click',()=>{
  assert.match(baseUi,/querySelector\('#reference-upload-button'\)\?\.addEventListener\('click'/);
  assert.match(baseUi,/fileInput\.click\(\)/);
  assert.doesNotMatch(uploadMode,/closest\?\.\('#reference-upload-button'\)/);
  assert.doesNotMatch(uploadMode,/stopImmediatePropagation\s*\(/);
});

test('launcher is the sole owner of the outer Reference Customer manage CTA',()=>{
  assert.match(launcher,/data-reference-customers-manage/);
  assert.match(launcher,/LeadIntelReferenceCustomerUI\?\.open/);
  assert.doesNotMatch(baseUi,/data-reference-customers-manage/);
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

test('single-owner Reference Customer runtime is cache-busted at every changed module boundary',()=>{
  assert.match(processMap,new RegExp(`reference-customer-ui\\.js\\?v=${VERSION}`));
  assert.match(processMap,new RegExp(`reference-customer-ai-runtime\\.js\\?v=${VERSION}`));
  assert.match(processMap,new RegExp(`reference-customer-launcher\\.js\\?v=${VERSION}`));
  assert.match(aiRuntime,new RegExp(`reference-customer-upload-mode\\.js\\?v=${VERSION}`));
  assert.match(launcher,new RegExp(`REFERENCE_CUSTOMER_LAUNCH_VERSION='${VERSION}'`));
});
