const test=require('node:test');
const assert=require('node:assert/strict');
const Portfolio=require('../reference-customer-portfolio.js');

function referenceState({active=false,count=3,fingerprint='rc-a'}={}){
  const rows=Array.from({length:count},(_,i)=>({id:`r${i+1}`,companyName:`Company ${i+1}`,website:`https://c${i+1}.example.com`,status:'ready',reviewed:true}));
  const dna=active?{version:3,calibrationVersion:1,active:true,activeCount:count,sampleSize:count,confidence:'high',profileConfidence:'high',fingerprint,dimensions:[{key:'industry',label:'Industry',values:['B2B services'],evidenceByValue:{'B2B services':count},evidenceCount:count,supportThreshold:Math.max(2,Math.ceil(count*.6)),prevalence:1,weight:1,confidence:'high'}]}:null;
  const publishedModel=active?{active:true,activeCount:count,confidence:'high',fingerprint,dna,activeRows:rows,activeSegments:[],segmentIds:[],activatedAt:'2026-09-10T06:00:00.000Z',updatedAt:'2026-09-10T06:00:00.000Z'}:null;
  return {version:3,rows,analyses:{},segments:[],activeSegmentIds:[],activeIds:active?rows.map(r=>r.id):[],activated:active,fingerprint:active?fingerprint:'',dna,publishedModel,draftDirty:false};
}

test('a current reference customer draft can be saved as a named list without activating it',()=>{
  const state={referenceCustomers:referenceState({active:false})};
  const next=Portfolio.saveCurrentList(state,{name:'Latvia Training Clients',markets:['Latvia'],purpose:'Training prospecting'});
  assert.equal(next.referenceCustomerPortfolio.lists.length,1);
  assert.equal(next.referenceCustomerPortfolio.lists[0].name,'Latvia Training Clients');
  assert.equal(next.referenceCustomerPortfolio.lists[0].active,false);
  assert.equal(next.referenceCustomerPortfolio.lists[0].reference.rows.length,3);
  assert.equal(next.referenceCustomerPortfolio.selectedListId,next.referenceCustomerPortfolio.lists[0].id);
});

test('multiple saved lists can be active at the same time',()=>{
  let state={referenceCustomers:referenceState({active:true,fingerprint:'rc-a'})};
  state=Portfolio.saveCurrentList(state,{name:'A',markets:['Latvia']});
  const a=state.referenceCustomerPortfolio.selectedListId;
  state=Portfolio.setListActive(state,a,true);
  state.referenceCustomers=referenceState({active:true,fingerprint:'rc-b'});
  state.referenceCustomerPortfolio.selectedListId='';
  state=Portfolio.saveCurrentList(state,{name:'B',markets:['Lithuania']});
  const b=state.referenceCustomerPortfolio.selectedListId;
  state=Portfolio.setListActive(state,b,true);
  assert.deepEqual(Portfolio.getActiveModels(state).map(m=>m.listName).sort(),['A','B']);
});

test('selecting a saved list loads it back into the current editor',()=>{
  let state={referenceCustomers:referenceState({active:false,count:2})};
  state=Portfolio.saveCurrentList(state,{name:'First'});
  const id=state.referenceCustomerPortfolio.selectedListId;
  assert.equal(Portfolio.hasUnsavedCurrentListDraft(state),false);
  state.referenceCustomers={rows:[]};
  state=Portfolio.selectList(state,id);
  assert.equal(state.referenceCustomers.rows.length,2);
});

test('a pending fifth company is preserved instead of being replaced by the four-company saved snapshot',()=>{
  assert.equal(typeof Portfolio.selectListSafely,'function');
  let state={referenceCustomers:referenceState({active:false,count:4})};
  state=Portfolio.saveCurrentList(state,{name:'Reference Customers',markets:['Sweden']});
  const id=state.referenceCustomerPortfolio.selectedListId;
  state.referenceCustomers.rows.push({id:'r5',companyName:'Ivarssons i Metsjö AB',website:'https://metsjo.se/',domain:'metsjo.se',status:'ready',reviewed:true});

  const selection=Portfolio.selectListSafely(state,id);

  assert.equal(selection.ok,false);
  assert.equal(selection.reason,'unsaved-draft');
  assert.equal(selection.state.referenceCustomers.rows.length,5);
  assert.equal(selection.state.referenceCustomerPortfolio.selectedListId,id);
});

test('saving an edited reference list commits the fifth company and clears the unsaved state',()=>{
  let state={referenceCustomers:referenceState({active:false,count:4})};
  state=Portfolio.saveCurrentList(state,{name:'Reference Customers',markets:['Sweden']});
  const id=state.referenceCustomerPortfolio.selectedListId;
  state.referenceCustomers.rows.push({id:'r5',companyName:'Ivarssons i Metsjö AB',website:'https://metsjo.se/',domain:'metsjo.se',status:'ready',reviewed:true});
  assert.equal(Portfolio.hasUnsavedCurrentListDraft(state),true);

  state=Portfolio.saveCurrentList(state,{name:'Reference Customers',markets:['Sweden']});

  assert.equal(state.referenceCustomerPortfolio.selectedListId,id);
  assert.equal(state.referenceCustomerPortfolio.lists[0].reference.rows.length,5);
  assert.equal(Portfolio.hasUnsavedCurrentListDraft(state),false);
});

test('an unsaved new customer list is recognized before switching to another saved list',()=>{
  let state={referenceCustomers:referenceState({active:false,count:2})};
  state=Portfolio.saveCurrentList(state,{name:'Saved'});
  const savedId=state.referenceCustomerPortfolio.selectedListId;
  state=Portfolio.newList(state);
  state.referenceCustomers=referenceState({active:false,count:1});

  assert.equal(Portfolio.hasUnsavedCurrentListDraft(state),true);
  const selection=Portfolio.selectListSafely(state,savedId);
  assert.equal(selection.ok,false);
  assert.equal(selection.reason,'unsaved-draft');
  assert.equal(selection.state.referenceCustomers.rows.length,1);
});

test('a clean customer draft can still switch to another saved list',()=>{
  assert.equal(typeof Portfolio.selectListSafely,'function');
  let state={referenceCustomers:referenceState({active:false,count:2})};
  state=Portfolio.saveCurrentList(state,{name:'First'});
  const firstId=state.referenceCustomerPortfolio.selectedListId;
  state.referenceCustomers=referenceState({active:false,count:3});
  state.referenceCustomerPortfolio.selectedListId='';
  state=Portfolio.saveCurrentList(state,{name:'Second'});
  const secondId=state.referenceCustomerPortfolio.selectedListId;
  state=Portfolio.selectList(state,firstId);

  const selection=Portfolio.selectListSafely(state,secondId);

  assert.equal(selection.ok,true);
  assert.equal(selection.state.referenceCustomerPortfolio.selectedListId,secondId);
  assert.equal(selection.state.referenceCustomers.rows.length,3);
});

test('newList clears only the editor and preserves saved and active lists',()=>{
  let state={referenceCustomers:referenceState({active:true})};
  state=Portfolio.saveCurrentList(state,{name:'Keep me'});
  const id=state.referenceCustomerPortfolio.selectedListId;
  state=Portfolio.setListActive(state,id,true);
  state=Portfolio.newList(state);
  assert.equal(state.referenceCustomerPortfolio.lists.length,1);
  assert.equal(state.referenceCustomerPortfolio.lists[0].active,true);
  assert.equal(state.referenceCustomerPortfolio.selectedListId,'');
  assert.equal(state.referenceCustomers.rows.length,0);
});

test('active model aggregation preserves per-list models and creates usable combined DNA',()=>{
  let state={referenceCustomers:referenceState({active:true,fingerprint:'rc-a'})};
  state=Portfolio.saveCurrentList(state,{name:'A'});state=Portfolio.setListActive(state,state.referenceCustomerPortfolio.selectedListId,true);
  state.referenceCustomers=referenceState({active:true,fingerprint:'rc-b'});state.referenceCustomers.publishedModel.dna.dimensions=[{key:'sizeBand',values:['50-200'],weight:1,confidence:'medium'}];
  state.referenceCustomerPortfolio.selectedListId='';state=Portfolio.saveCurrentList(state,{name:'B'});state=Portfolio.setListActive(state,state.referenceCustomerPortfolio.selectedListId,true);
  const combined=Portfolio.getCombinedActiveModel(state);
  assert.equal(combined.active,true);
  assert.equal(combined.models.length,2);
  assert.equal(combined.dna.activeCount,6);
  assert.deepEqual(combined.dna.dimensions.map(d=>d.key).sort(),['industry','sizeBand']);
});
