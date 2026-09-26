const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');

test('target tab hides the customer workflow and preserves separate customer data',()=>{
  const ui=read('reference-customer-ui.js'),css=read('reference-customers.css');
  assert.match(ui,/querySelector\('\.reference-customer-dialog'\)\.classList\.toggle\('show-targets',targets\)/);
  assert.match(css,/\.reference-customer-dialog\.show-targets>\*:not\(header\):not\(\.reference-segment-tabs\):not\(\.target-companies-panel\)\{display:none!important\}/);
  assert.match(ui,/Copying keeps the original customer list/);
  assert.doesNotMatch(ui,/modal\.classList\.toggle\('show-targets',targets\)/);
});

test('saved customer lists show their actions before the editor and draft table',()=>{
  const library=read('reference-customer-library-ui.js'),css=read('reference-customers.css');
  assert.match(library,/element\.hidden=!showEditor/);
  assert.match(library,/data-show-targets/);
  assert.match(css,/\.reference-table-wrap\[hidden\].*display:none!important/);
});
