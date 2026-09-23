const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Clear=require('../reference-customer-clear-list.js');

test('clearing reference customers preserves the rest of the workspace',()=>{
  const workspace={
    website:'https://example.com',
    targetMarkets:['Latvia'],
    answers:{sales_motion:'Direct B2B sales'},
    aiSettings:{provider:'openai'},
    referenceCustomers:{
      rows:[{companyName:'Acme',website:'https://acme.com'}],
      analyses:{x:{industry:'software'}},
      segments:[{id:'seg-1',rowIds:['x']}],
      activeSegmentIds:['seg-1'],
      activeIds:['x'],
      activated:true,
      dna:{active:true}
    }
  };

  const cleared=Clear.clearReferenceCustomersFromWorkspace(workspace);

  assert.equal(cleared.website,'https://example.com');
  assert.deepEqual(cleared.targetMarkets,['Latvia']);
  assert.deepEqual(cleared.answers,{sales_motion:'Direct B2B sales'});
  assert.deepEqual(cleared.aiSettings,{provider:'openai'});
  assert.deepEqual(cleared.referenceCustomers.rows,[]);
  assert.deepEqual(cleared.referenceCustomers.analyses,{});
  assert.deepEqual(cleared.referenceCustomers.segments,[]);
  assert.deepEqual(cleared.referenceCustomers.activeSegmentIds,[]);
  assert.deepEqual(cleared.referenceCustomers.activeIds,[]);
  assert.equal(cleared.referenceCustomers.activated,false);
  assert.equal(cleared.referenceCustomers.dna,null);
});

test('clearing a selected working draft keeps saved lists and active models intact but deselects the list',()=>{
  const workspace={
    referenceCustomers:{rows:[{companyName:'Acme',website:'https://acme.com'}]},
    referenceCustomerPortfolio:{selectedListId:'saved-1',lists:[{id:'saved-1',active:true,reference:{rows:[{id:'saved-row'}]}}]}
  };
  const cleared=Clear.clearReferenceCustomersFromWorkspace(workspace);
  assert.equal(cleared.referenceCustomers.rows.length,0);
  assert.equal(cleared.referenceCustomerPortfolio.selectedListId,'');
  assert.deepEqual(cleared.referenceCustomerPortfolio.lists,workspace.referenceCustomerPortfolio.lists);
});

test('Reference Customer Intelligence uses an in-app clear confirmation, never browser confirm',()=>{
  const runtime=fs.readFileSync(path.join(__dirname,'..','reference-customer-clear-list.js'),'utf8');
  assert.match(runtime,/button\.id=['"]reference-clear-list['"]/);
  assert.match(runtime,/Clear current draft/);
  assert.match(runtime,/Clear every company in the current working draft\?/);
  assert.match(runtime,/data-reference-clear-confirm/);
  assert.match(runtime,/data-reference-clear-confirm-yes/);
  assert.match(runtime,/data-reference-clear-confirm-no/);
  assert.doesNotMatch(runtime,/root\.confirm\s*\(/);
  assert.match(runtime,/leadintel:reference-customers-updated/);
});

test('Cancel can actually hide the clear confirmation panel after its inline grid styles are applied',()=>{
  assert.equal(typeof Clear.CONFIRMATION_CSS,'string');
  assert.match(Clear.CONFIRMATION_CSS,/\.reference-clear-confirm\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/i);
  const runtime=fs.readFileSync(path.join(__dirname,'..','reference-customer-clear-list.js'),'utf8');
  assert.match(runtime,/panel\.hidden=true/);
  assert.match(runtime,/panel\.style\?\.removeProperty\?\.\('display'\)/);
  assert.match(runtime,/trigger\?\.focus\?\.\(\)/);
});

test('the clear confirmation labels cancellation separately from the destructive action',()=>{
  assert.match(Clear.CONFIRMATION_CSS,/\.reference-clear-confirm\[hidden\]\s*\{[^}]*display\s*:\s*none\s*!important/i);
  const runtime=fs.readFileSync(path.join(__dirname,'..','reference-customer-clear-list.js'),'utf8');
  assert.match(runtime,/data-reference-clear-confirm-no>Cancel/);
  assert.match(runtime,/data-reference-clear-confirm-yes>Clear draft/);
});
