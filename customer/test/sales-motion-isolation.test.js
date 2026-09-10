const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');

test('sales motion never falls back to legacy lookalike customer names',()=>{
  assert.doesNotMatch(source,/sales_motion\|\|state\.answers\?\.lookalike_customers/);
  assert.match(source,/const saved=String\(state\.answers\?\.sales_motion\|\|""\)/);
});

test('sales motion migration clears a reused legacy textarea before showing the question',()=>{
  assert.match(source,/legacy\.dataset\.question="sales_motion"/);
  assert.match(source,/visible\.value=""/);
});
