const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const source=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function runtime(storage=new Map()){
  const nodes=new Map();
  const node=()=>({innerHTML:'',textContent:'',hidden:false,disabled:false,value:'',dataset:{},querySelector(){return null},querySelectorAll(){return []},setAttribute(){},removeAttribute(){}});
  for(const id of ['reference-customer-modal','reference-library-styles','reference-segment-review','reference-segments','reference-analysis-count','reference-profile-sources','customer-opportunity-map','reference-import-status','reference-activate','reference-dna-summary'])nodes.set(id,node());
  const modal=nodes.get('reference-customer-modal');
  modal.querySelector=selector=>selector==='[data-reference-library-summary]'?nodes.get('summary'):nodes.get(selector.slice(1))||node();
  nodes.set('summary',node());
  let selection=[];
  const listeners=[];
  const document={body:null,addEventListener(type,fn){if(type==='click')listeners.push(fn)},getElementById:id=>nodes.get(id)||null,querySelector:()=>null,querySelectorAll:selector=>selector.includes('data-reference-segment')?selection:[]};
  const sandbox={URL,document,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},CustomEvent:class{},addEventListener(){},dispatchEvent(){},setTimeout:()=>0,clearTimeout(){},console};
  vm.createContext(sandbox);
  const load=name=>vm.runInContext(`(function(){${source(name)}\n})()`,sandbox);
  return {sandbox,nodes,storage,load,listeners,select:id=>selection=[{dataset:{referenceSegment:id}}]};
}
test('duplicate module URLs retain the shared patched API and a single activation handler',()=>{
  const r=runtime();r.load('reference-customers.js');const first=r.sandbox.LeadIntelReferenceCustomers;
  r.load('reference-customer-library.js');const normalize=first.normalizeReferenceState;
  r.load('reference-customers.js');r.load('reference-customer-library.js');
  assert.equal(r.sandbox.LeadIntelReferenceCustomers,first);
  assert.equal(first.normalizeReferenceState,normalize);
  r.load('reference-customer-portfolio.js');r.load('reference-customer-library-ui.js');r.load('reference-customer-library-ui.js');
  assert.equal(r.listeners.length,1);
});
test('actual profile UI survives duplicate base load, publishes new evidence, and stays checked after reload',async()=>{
  const r=runtime();r.load('reference-customers.js');r.load('reference-customer-ui.js');
  const Ref=r.sandbox.LeadIntelReferenceCustomers;
  // The UI captures Ref before an independently versioned loader imports it again.
  r.load('reference-customers.js');r.load('reference-customer-library.js');r.load('reference-customer-portfolio.js');r.load('reference-customer-library-ui.js');
  const P=r.sandbox.LeadIntelReferenceCustomerPortfolio;
  const rows=Ref.normalizeImportedRows([{Company:'Reference',Website:'https://reference.example'}]);
  const old={[rows[0].id]:{industry:'Old sector',confidence:'low'}};
  const seg=Ref.buildReferenceSegments(rows,old);
  let ref=Ref.activateReferenceSegments({rows,analyses:old,...seg},seg.segments.map(s=>s.id));ref.dna=Ref.buildReferenceDna(ref,old);ref=Ref.publishReferenceModel(ref);
  let state=P.saveCurrentList({referenceCustomers:ref,targetMarkets:['Sweden']},{name:'My references',markets:['Sweden'],purpose:'Find manufacturers'});state=P.setListActive(state,state.referenceCustomerPortfolio.selectedListId,true);
  const fresh={[rows[0].id]:{analysisVersion:4,broadIndustry:'New equipment sector',confidence:'high',sourceEvidence:[{field:'broadIndustry',quote:'New equipment sector',url:'https://reference.example/'}]}};
  state.referenceCustomers=Ref.markReferenceDraftChanged({...ref,analyses:fresh,...Ref.buildReferenceSegments(rows,fresh)});state=P.syncCurrentList(state);
  r.storage.set('leadintel_customer_v2_state',JSON.stringify(state));
  r.sandbox.LeadIntelReferenceCustomerUI.render();
  assert.match(r.nodes.get('reference-segments').innerHTML,/Select this profile/);
  r.select(state.referenceCustomers.segments[0].id);
  await r.sandbox.LeadIntelReferenceCustomerLibraryUI.publishSelected({disabled:false});
  const saved=JSON.parse(r.storage.get('leadintel_customer_v2_state'));
  assert.equal(saved.referenceCustomers.draftDirty,false);
  assert.equal(saved.referenceCustomerPortfolio.lists[0].active,true);
  assert.equal(saved.referenceCustomerPortfolio.lists[0].name,'My references');
  assert.deepEqual(saved.referenceCustomerPortfolio.lists[0].markets,['Sweden']);
  assert.equal(saved.referenceCustomerPortfolio.lists[0].purpose,'Find manufacturers');
  assert.equal(P.getCombinedActiveModel(saved).dna.referenceProfiles[0].dimensions[0].values[0],'New equipment sector');
  assert.match(r.nodes.get('reference-segments').innerHTML,/checked/);
  assert.match(r.nodes.get('reference-segments').innerHTML,/Active in company discovery/);
  const reload=runtime(r.storage);for(const name of ['reference-customers.js','reference-customer-ui.js','reference-customer-library.js','reference-customer-portfolio.js'])reload.load(name);
  reload.sandbox.LeadIntelReferenceCustomerUI.render();
  assert.match(reload.nodes.get('reference-segments').innerHTML,/checked/);
  assert.match(reload.nodes.get('reference-segments').innerHTML,/Active in company discovery/);
});

test('saving an existing list with a blank name retains its name instead of inventing Customer List 2',async()=>{
  const r=runtime();for(const file of ['reference-customers.js','reference-customer-library.js','reference-customer-portfolio.js','reference-customer-library-ui.js'])r.load(file);
  const P=r.sandbox.LeadIntelReferenceCustomerPortfolio,Ref=r.sandbox.LeadIntelReferenceCustomers;
  const rows=Ref.normalizeImportedRows([{Company:'Acme',Website:'https://acme.example'}]);
  const saved=P.saveCurrentList({referenceCustomers:{rows}},{name:'My best customers'});
  r.storage.set('leadintel_customer_v2_state',JSON.stringify(saved));
  r.nodes.set('reference-list-name',{value:''});
  await r.sandbox.LeadIntelReferenceCustomerLibraryUI.saveList();
  const next=JSON.parse(r.storage.get('leadintel_customer_v2_state'));
  assert.equal(next.referenceCustomerPortfolio.lists.length,1);
  assert.equal(next.referenceCustomerPortfolio.lists[0].id,saved.referenceCustomerPortfolio.selectedListId);
  assert.equal(next.referenceCustomerPortfolio.lists[0].name,'My best customers');
});

test('saving an unnamed new draft uses company context and does not create it merely on render',async()=>{
  const r=runtime();for(const file of ['reference-customers.js','reference-customer-library.js','reference-customer-portfolio.js','reference-customer-library-ui.js'])r.load(file);
  const Ref=r.sandbox.LeadIntelReferenceCustomers;
  const rows=Ref.normalizeImportedRows([{Company:'Acme',Website:'https://acme.example'}]);
  r.storage.set('leadintel_customer_v2_state',JSON.stringify({referenceCustomers:{rows},referenceCustomerPortfolio:{version:1,selectedListId:'',lists:[]}}));
  r.sandbox.LeadIntelReferenceCustomerLibraryUI.sync();
  assert.equal(JSON.parse(r.storage.get('leadintel_customer_v2_state')).referenceCustomerPortfolio.lists.length,0);
  await r.sandbox.LeadIntelReferenceCustomerLibraryUI.saveList();
  const next=JSON.parse(r.storage.get('leadintel_customer_v2_state'));
  assert.equal(next.referenceCustomerPortfolio.lists.length,1);
  assert.equal(next.referenceCustomerPortfolio.lists[0].name,'Reference Companies · Acme');
});
