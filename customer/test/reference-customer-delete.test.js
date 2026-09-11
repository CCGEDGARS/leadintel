const test=require('node:test');
const assert=require('node:assert/strict');

const Portfolio=require('../reference-customer-portfolio.js');

function ref(name){return {rows:[{id:name,name}],analyses:{},segments:[],activeSegmentIds:[],activeIds:[],activated:false,fingerprint:'',dna:null,publishedModel:null,draftDirty:false};}

test('deleteList removes only the requested saved list and opens another saved list',()=>{
  const state={
    referenceCustomers:ref('one'),
    referenceCustomerPortfolio:{version:1,selectedListId:'one',lists:[
      {id:'one',name:'One',reference:ref('one')},
      {id:'two',name:'Two',reference:ref('two')}
    ]}
  };
  const next=Portfolio.deleteList(state,'one');
  assert.deepEqual(next.referenceCustomerPortfolio.lists.map(x=>x.id),['two']);
  assert.equal(next.referenceCustomerPortfolio.selectedListId,'two');
  assert.equal(next.referenceCustomers.rows[0].name,'two');
});

test('deleteList clears the working reference state when the final saved list is deleted',()=>{
  const state={referenceCustomers:ref('one'),referenceCustomerPortfolio:{version:1,selectedListId:'one',lists:[{id:'one',name:'One',reference:ref('one')} ]}};
  const next=Portfolio.deleteList(state,'one');
  assert.equal(next.referenceCustomerPortfolio.lists.length,0);
  assert.equal(next.referenceCustomerPortfolio.selectedListId,'');
  assert.equal(next.referenceCustomers.rows.length,0);
  assert.equal(next.referenceCustomers.publishedModel,null);
});

test('deleting an active list removes its model from active model collection',()=>{
  const activeRef={...ref('one'),publishedModel:{active:true,fingerprint:'fp',activeCount:1,dna:{active:true,activeCount:1,dimensions:[]}}};
  const state={referenceCustomers:activeRef,referenceCustomerPortfolio:{version:1,selectedListId:'one',lists:[{id:'one',name:'One',active:true,reference:activeRef}]}};
  const next=Portfolio.deleteList(state,'one');
  assert.deepEqual(Portfolio.getActiveModels(next),[]);
});
