const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('customer table detector publishes a stable browser API even before reference customers loads',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','reference-customer-table-detection.js'),'utf8');
  const context={globalThis:null};
  context.globalThis=context;
  vm.runInNewContext(source,context,{filename:'reference-customer-table-detection.js'});
  assert.equal(typeof context.LeadIntelReferenceCustomerTableDetection?.detectCustomerTable,'function');
});

test('smart importer accepts the standalone detector API instead of requiring it on LeadIntelReferenceCustomers',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','reference-customer-smart-import.js'),'utf8');
  assert.match(source,/LeadIntelReferenceCustomerTableDetection/);
  assert.doesNotMatch(source,/Customer table detector is not ready\. Reload and try again\./);
});
