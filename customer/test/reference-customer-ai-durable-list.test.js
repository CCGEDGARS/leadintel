const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const Ref=require('../reference-customers.js');
require('../reference-customer-library.js');
const Portfolio=require('../reference-customer-portfolio.js');
const source=fs.readFileSync(path.join(__dirname,'..','reference-customer-ai-runtime.js'),'utf8').replace(/^import .*;\n/gm,'');
const key='leadintel_customer_v2_state';

function setup(beforeResult=()=>{},saveNow=async()=>({saved:true})){
  const store=new Map();
  const row=Ref.normalizeImportedRows([{Company:'Billerud',Website:'https://www.billerud.com'}],{sourceType:'manual'})[0];
  store.set(key,JSON.stringify({referenceCustomers:Ref.normalizeReferenceState({rows:[row]})}));
  const root={
    localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},
    document:{addEventListener(){},getElementById:id=>id==='reference-list-name'?{value:'Reference Customers'}:null},
    LeadIntelReferenceCustomers:Ref,LeadIntelReferenceCustomerPortfolio:Portfolio,
    LeadIntelReferenceCustomerAI:{async requestReferenceCustomerAnalysis(){beforeResult(store);return {analyses:{[row.id]:{industry:'Paper manufacturing',confidence:'low'}},segmentationMeaningful:true,segments:[{id:'paper',name:'Paper manufacturers',canActivate:true}]};}},
    LeadIntelServerBridge:{session:{authenticated:true},workspace:{id:'workspace-1'},saveNow},
    fetch:async()=>({ok:true,json:async()=>({data:{markdown:'Paper manufacturer'}})}),
    CustomEvent:class{},dispatchEvent(){},setTimeout,console
  };
  root.globalThis=root;
  vm.runInNewContext(source,root,{filename:'reference-customer-ai-runtime.js'});
  return {root,row,read:()=>JSON.parse(store.get(key))};
}

test('analysis saves an unsaved customer draft before calling external services',async()=>{
  const {root,row,read}=setup(store=>{
    const state=JSON.parse(store.get(key));
    assert.equal(state.referenceCustomerPortfolio.lists.length,1);
    assert.equal(state.referenceCustomerPortfolio.lists[0].reference.rows[0].id,row.id);
  });
  await root.LeadIntelReferenceCustomerAIRuntime.runAiAnalysis({disabled:false});
  const state=read();
  assert.equal(state.referenceCustomerPortfolio.lists[0].reference.analyses[row.id].industry,'Paper manufacturing');
  assert.equal(state.referenceCustomers.rows[0].id,row.id);
});

test('analysis does not claim success when the saved customer list disappears mid-run',async()=>{
  const {root,read}=setup(store=>{
    const state=JSON.parse(store.get(key));
    state.referenceCustomers=Ref.normalizeReferenceState({rows:[]});
    state.referenceCustomerPortfolio=Portfolio.normalizePortfolio({lists:[]});
    store.set(key,JSON.stringify(state));
  });
  await assert.rejects(root.LeadIntelReferenceCustomerAIRuntime.runAiAnalysis({disabled:false}),/customer list changed during analysis/i);
  assert.equal(read().referenceCustomerPortfolio.lists.length,0);
});

test('analysis stops before research if the customer list did not sync',async()=>{
  let researched=false;
  const {root,read}=setup(()=>{researched=true;},async()=>({saved:false}));
  await assert.rejects(root.LeadIntelReferenceCustomerAIRuntime.runAiAnalysis({disabled:false}),/has not synced/i);
  assert.equal(researched,false);
  assert.equal(read().referenceCustomerPortfolio.lists.length,1);
});

test('analysis will not overwrite a saved list if its current draft was cleared mid-run',async()=>{
  const {root,read}=setup(store=>{
    const state=JSON.parse(store.get(key));
    state.referenceCustomers=Ref.normalizeReferenceState({rows:[]});
    store.set(key,JSON.stringify(state));
  });
  await assert.rejects(root.LeadIntelReferenceCustomerAIRuntime.runAiAnalysis({disabled:false}),/customer list changed during analysis/i);
  assert.equal(read().referenceCustomerPortfolio.lists[0].reference.rows.length,1);
});
