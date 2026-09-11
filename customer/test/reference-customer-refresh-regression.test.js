const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Profile=require('../profile-engine.js');

test('core state normalization preserves Reference Customer extension namespaces',()=>{
  const referenceCustomers={rows:[{id:'acme'}],analyses:{}};
  const referenceCustomerPortfolio={version:1,selectedListId:'list-1',lists:[{id:'list-1',name:'Best customers'}]};
  const normalized=Profile.normalizeSavedState({
    step:2,
    website:'https://example.com',
    targetMarkets:['Latvia'],
    referenceCustomers,
    referenceCustomerPortfolio
  });
  assert.deepEqual(normalized.referenceCustomers,referenceCustomers);
  assert.deepEqual(normalized.referenceCustomerPortfolio,referenceCustomerPortfolio);
});

test('dark Analyze styling targets the visible library action, not only the hidden compatibility control',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','reference-customers.css'),'utf8');
  assert.match(css,/\[data-analyze-current\][^{]*\{[^}]*background:\s*#0d1b2e/i);
  assert.match(css,/\[data-analyze-current\][^{]*\{[^}]*color:\s*#fff/i);
});
