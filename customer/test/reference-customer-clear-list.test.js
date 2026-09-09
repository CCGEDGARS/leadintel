const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Ref=require('../reference-customers.js');

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

  const cleared=Ref.clearReferenceCustomersFromWorkspace(workspace);

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

test('Reference Customer Intelligence UI exposes a clear-list action with confirmation',()=>{
  const ui=fs.readFileSync(path.join(__dirname,'..','reference-customer-ui.js'),'utf8');
  assert.match(ui,/id="reference-clear-list"/);
  assert.match(ui,/Clear customer list/);
  assert.match(ui,/Remove all reference customers and reset Lookalike Intelligence\?/);
  assert.match(ui,/clearReferenceCustomersFromWorkspace/);
});
