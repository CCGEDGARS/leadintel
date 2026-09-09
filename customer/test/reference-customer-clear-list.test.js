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

test('Reference Customer Intelligence uses an in-app clear confirmation, never browser confirm',()=>{
  const runtime=fs.readFileSync(path.join(__dirname,'..','reference-customer-clear-list.js'),'utf8');
  assert.match(runtime,/button\.id=['"]reference-clear-list['"]/);
  assert.match(runtime,/Clear customer list/);
  assert.match(runtime,/Remove all reference customers and reset Lookalike Intelligence\?/);
  assert.match(runtime,/data-reference-clear-confirm/);
  assert.match(runtime,/data-reference-clear-confirm-yes/);
  assert.match(runtime,/data-reference-clear-confirm-no/);
  assert.doesNotMatch(runtime,/root\.confirm\s*\(/);
  assert.match(runtime,/leadintel:reference-customers-updated/);
});
