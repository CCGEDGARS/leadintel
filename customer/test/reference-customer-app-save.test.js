const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

test('main app saves preserve customer-model activation written by the customer modal',()=>{
  const source=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const start=source.indexOf('function saveState(){');
  const end=source.indexOf('\nfunction esc(',start);
  assert.ok(start>=0&&end>start);
  const stored={targetCompanies:[{name:'Södra'}],referenceCustomers:{activated:true,publishedModel:{active:true}},referenceCustomerPortfolio:{lists:[{id:'billerud',active:true,reference:{publishedModel:{active:true}}}]}};
  const values=new Map([['leadintel_customer_v2_state',JSON.stringify(stored)]]);
  const state={step:4,market:{icps:[]},referenceCustomers:{activated:false},referenceCustomerPortfolio:{lists:[]}};
  const context={state,STORAGE_KEY:'leadintel_customer_v2_state',localStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)},updateCompleteness(){},updateNavigationAvailability(){},window:{LeadIntelJourney:{refresh(){}}}};
  vm.runInNewContext(`${source.slice(start,end)}\nsaveState();`,context);
  const saved=JSON.parse(values.get('leadintel_customer_v2_state'));
  assert.equal(saved.step,4);
  assert.equal(saved.referenceCustomers.activated,true);
  assert.equal(saved.referenceCustomerPortfolio.lists[0].active,true);
  assert.equal(saved.targetCompanies[0].name,'Södra');
});
