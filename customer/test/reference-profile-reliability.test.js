const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const Ref=require('../reference-customers.js');
require('../reference-customer-library.js');
const Portfolio=require('../reference-customer-portfolio.js');
const key='leadintel_customer_v2_state';
const source=file=>fs.readFileSync(require.resolve('../'+file),'utf8').replace(/^import .*;\n/gm,'');
const fixtures=[{name:'Baltic Pumps',site:'https://pumps.example/',industry:'Equipment manufacturing'},{name:'Northlight Care',site:'https://care.example/',industry:'Healthcare'}];
function analysisRuntime(fixture=fixtures[0]){
  const row=Ref.normalizeImportedRows([{Company:fixture.name,Website:fixture.site}])[0];
  let state=Portfolio.saveCurrentList({website:'https://seller.example/',targetMarkets:['Latvia'],referenceCustomers:{rows:[row]}},{name:'Evidence list'});
  const store=new Map([[key,JSON.stringify(state)]]);
  const read=()=>JSON.parse(store.get(key)),update=fn=>{const current=read();fn(current);store.set(key,JSON.stringify(current));};
  const root={document:{addEventListener(){},getElementById(){return null;}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},CustomEvent:class{},dispatchEvent(){},console,
    LeadIntelReferenceCustomers:Ref,LeadIntelReferenceCustomerPortfolio:Portfolio,
    LeadIntelServerBridge:{session:{authenticated:true,user:{id:'owner-a'}},workspace:{id:'workspace-a'},saveNow:async()=>({saved:true})},
    LeadIntelFirstPartyResearch:{collectWebsiteEvidence:async()=>({pages:[{url:fixture.site,text:'We provide specialist equipment and services.'}],coverage:{pagesRead:1,pagesPlanned:2,partial:true}}),boundedSources:pages=>pages},
    LeadIntelReferenceCustomerAI:{requestReferenceCustomerAnalysis:async()=>({analyses:{[row.id]:{industry:fixture.industry,confidence:'medium'}},segmentationMeaningful:false})}};
  vm.runInNewContext(source('reference-customer-ai-runtime.js'),root);
  return {root,row,read,update,run:()=>root.LeadIntelReferenceCustomerAIRuntime.runAiAnalysis({disabled:false})};
}
for(const fixture of fixtures){
  test(`late analysis preserves a newer manual evidence edit: ${fixture.name}`,async()=>{
    const r=analysisRuntime(fixture);
    const request=r.root.LeadIntelReferenceCustomerAI.requestReferenceCustomerAnalysis;
    r.root.LeadIntelReferenceCustomerAI.requestReferenceCustomerAnalysis=async()=>{r.update(s=>{s.referenceCustomers.analyses[r.row.id]={industry:'Manually reviewed evidence',confidence:'high'};});return request();};
    await assert.rejects(r.run(),/changed during analysis/i);
    assert.equal(r.read().referenceCustomers.analyses[r.row.id].industry,'Manually reviewed evidence');
  });
}
for(const boundary of ['account','seller','new-row','market']){
  test(`late analysis is rejected after a ${boundary} context change`,async()=>{
    const r=analysisRuntime();
    const request=r.root.LeadIntelReferenceCustomerAI.requestReferenceCustomerAnalysis;
    r.root.LeadIntelReferenceCustomerAI.requestReferenceCustomerAnalysis=async()=>{
      if(boundary==='account')r.root.LeadIntelServerBridge.session.user.id='owner-b';
      else r.update(s=>{if(boundary==='seller')s.website='https://another-seller.example/';if(boundary==='market')s.targetMarkets=['Finland'];if(boundary==='new-row')s.referenceCustomers.rows.push(Ref.normalizeImportedRows([{Company:'Extra',Website:'https://extra.example'}])[0]);});
      return request();
    };
    await assert.rejects(r.run(),/changed during analysis/i);
    assert.deepEqual(r.read().referenceCustomers.analyses,{});
  });
}
test('a context switch while syncing stops external research before it starts',async()=>{
  const r=analysisRuntime();let calls=0;
  r.root.LeadIntelFirstPartyResearch.collectWebsiteEvidence=async()=>{calls++;throw Error('Unexpected research');};
  r.root.LeadIntelServerBridge.saveNow=async()=>{r.root.LeadIntelServerBridge.session.user.id='owner-b';return {saved:true};};
  await assert.rejects(r.run(),/changed during analysis/i);assert.equal(calls,0);
});
test('partial website coverage survives analysis, saved-list sync and reload',async()=>{
  const r=analysisRuntime();await r.run();
  const current=r.read(),reloaded=Portfolio.ensurePortfolio(JSON.parse(JSON.stringify(current)));
  assert.equal(reloaded.referenceCustomers.analyses[r.row.id].evidenceCoverage.pagesRead,1);
  assert.equal(reloaded.referenceCustomerPortfolio.lists[0].reference.analyses[r.row.id].evidenceCoverage.pagesPlanned,2);
});
function clearRuntime(){
  const dom=new JSDOM('<div id="reference-customer-modal"><div class="reference-import-actions"></div><div id="reference-import-status"></div></div>',{url:'https://app.example/',runScripts:'outside-only'});
  const root=dom.window;root.setTimeout=fn=>{fn();return 0;};
  root.LeadIntelServerBridge={session:{authenticated:true,user:{id:'owner-a'}},workspace:{id:'workspace-a'}};
  root.localStorage.setItem(key,JSON.stringify({website:'https://seller.example/',referenceCustomers:{rows:[{id:'a',companyName:'Original'}]}}));
  root.eval(source('reference-customer-clear-list.js'));root.document.dispatchEvent(new root.Event('DOMContentLoaded'));
  return {dom,root,click:selector=>root.document.querySelector(selector).click()};
}
for(const boundary of ['workspace','account','draft'])test(`clear confirmation cannot erase a changed ${boundary}`,()=>{
  const r=clearRuntime();r.click('#reference-clear-list');
  if(boundary==='workspace')r.root.LeadIntelServerBridge.workspace.id='workspace-b';
  if(boundary==='account')r.root.LeadIntelServerBridge.session.user.id='owner-b';
  if(boundary==='draft')r.root.localStorage.setItem(key,JSON.stringify({referenceCustomers:{rows:[{id:'b',companyName:'New draft'}]}}));
  const before=r.root.localStorage.getItem(key);r.click('[data-reference-clear-confirm-yes]');
  assert.equal(r.root.localStorage.getItem(key),before);r.dom.window.close();
});
test('clear Cancel preserves the draft and explicit confirmation clears only that draft',()=>{
  const r=clearRuntime(),before=r.root.localStorage.getItem(key);r.click('#reference-clear-list');r.click('[data-reference-clear-confirm-no]');assert.equal(r.root.localStorage.getItem(key),before);
  r.click('#reference-clear-list');r.click('[data-reference-clear-confirm-yes]');assert.deepEqual(JSON.parse(r.root.localStorage.getItem(key)).referenceCustomers.rows,[]);r.dom.window.close();
});
function enrichmentRuntime(){
  const dom=new JSDOM('<div id="reference-customer-modal"><div class="reference-import-actions"></div><div class="reference-analysis-actions"></div><div id="reference-import-status"></div></div>',{url:'https://app.example/',runScripts:'outside-only'});
  const root=dom.window;root.setTimeout=fn=>{fn();return 0;};root.LeadIntelReferenceCustomers=Ref;
  root.LeadIntelServerBridge={session:{authenticated:true,user:{id:'owner-a'}},workspace:{id:'workspace-a'}};
  const row=Ref.normalizeImportedRows([{Company:'Northlight Care',Notes:'Keep my manual notes'}])[0];
  root.localStorage.setItem(key,JSON.stringify({website:'https://seller.example/',referenceCustomers:Ref.normalizeReferenceState({rows:[row]})}));
  let finish;root.fetch=()=>new Promise(resolve=>{finish=()=>resolve({ok:true,json:async()=>({data:[{url:'https://northlightcare.example/',title:'Northlight Care official website'}]})});});
  root.eval(source('reference-customer-website-enrichment.js'));root.document.dispatchEvent(new root.Event('DOMContentLoaded'));
  return {root,row,dom,finish:()=>finish(),read:()=>JSON.parse(root.localStorage.getItem(key)),start:()=>root.document.querySelector('#reference-find-websites').click()};
}
for(const boundary of ['account','draft'])test(`missing-info results preserve a changed ${boundary}`,async()=>{
  const r=enrichmentRuntime();r.start();
  if(boundary==='account')r.root.LeadIntelServerBridge.session.user.id='owner-b';
  else{const state=r.read();state.referenceCustomers.rows[0].notes='New reviewed notes';r.root.localStorage.setItem(key,JSON.stringify(state));}
  const before=r.root.localStorage.getItem(key);r.finish();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.root.localStorage.getItem(key),before);r.dom.window.close();
});
test('missing-info completion retains unrelated concurrent workspace edits',async()=>{
  const r=enrichmentRuntime();r.start();const state=r.read();state.answers={manual:'New seller answer'};r.root.localStorage.setItem(key,JSON.stringify(state));r.finish();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.read().answers.manual,'New seller answer');assert.equal(r.read().referenceCustomers.rows[0].website,'https://northlightcare.example/');r.dom.window.close();
});
test('name-only row review flags are preserved independently',()=>{
  const rows=Ref.normalizeImportedRows([{Company:'Pumps'},{Company:'Clinics'}]);rows[0].reviewed=false;rows[0].status='needs_review';
  const state=Ref.normalizeReferenceState({rows});assert.equal(state.rows[1].reviewed,true);assert.equal(state.rows[1].status,'unresolved');
});
function deleteRuntime(){
  const dom=new JSDOM('<div id="reference-customer-modal"><div class="reference-saved-row" data-reference-list-row="list-a"><div class="reference-saved-buttons"></div></div><div id="reference-import-status"></div></div>',{url:'https://app.example/',runScripts:'outside-only'});
  const root=dom.window;root.setTimeout=fn=>{fn();return 0;};root.MutationObserver=class{observe(){}};
  root.LeadIntelReferenceCustomers=Ref;root.LeadIntelReferenceCustomerPortfolio=Portfolio;
  root.LeadIntelServerBridge={session:{authenticated:true,user:{id:'owner-a'}},workspace:{id:'workspace-a'},saveNow:async()=>({saved:true})};
  const r=analysisRuntime(),state=r.read();state.referenceCustomerPortfolio.lists[0].id='list-a';state.referenceCustomerPortfolio.selectedListId='list-a';
  root.localStorage.setItem(key,JSON.stringify(state));root.eval(source('reference-customer-delete-ui.js'));root.document.dispatchEvent(new root.Event('DOMContentLoaded'));
  return {root,dom,click:selector=>root.document.querySelector(selector).click()};
}
for(const boundary of ['account','cache','seller','list','draft'])test(`saved-list delete confirmation preserves a changed ${boundary}`,async()=>{
  const r=deleteRuntime();r.click('[data-delete-reference-list]');
  if(boundary==='account')r.root.LeadIntelServerBridge.session.user.id='owner-b';
  if(boundary==='cache')r.root.localStorage.setItem('leadintel_account_context_v1','new-owner-ticket');
  if(boundary==='seller'||boundary==='list'||boundary==='draft'){
    const state=JSON.parse(r.root.localStorage.getItem(key));
    if(boundary==='seller')state.website='https://another-seller.example/';
    if(boundary==='list')state.referenceCustomerPortfolio.lists[0].name='New reviewed list';
    if(boundary==='draft')state.referenceCustomers.rows[0].notes='New manual notes';
    r.root.localStorage.setItem(key,JSON.stringify(state));
  }
  const before=r.root.localStorage.getItem(key);r.click('[data-confirm-delete-list]');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.root.localStorage.getItem(key),before);r.dom.window.close();
});
test('reviewed saved-list deletion remains functional with an existing unsaved draft',async()=>{
  const r=deleteRuntime(),state=JSON.parse(r.root.localStorage.getItem(key));state.referenceCustomers.rows[0].notes='Discard this draft';r.root.localStorage.setItem(key,JSON.stringify(state));
  r.click('[data-delete-reference-list]');r.click('[data-confirm-delete-list]');await new Promise(resolve=>setImmediate(resolve));
  assert.equal(JSON.parse(r.root.localStorage.getItem(key)).referenceCustomerPortfolio.lists.length,0);r.dom.window.close();
});
test('a quoted sector cannot legitimize unsupported matching fields in published DNA',()=>{
  const AI=require('../reference-customer-ai.js'),row=Ref.normalizeImportedRows([{Company:'Northlight Care',Website:'https://care.example'}])[0],quote='We provide specialist healthcare services to our communities.';
  const parsed=AI.parseReferenceCustomerAnalysis(JSON.stringify({companies:[{id:row.id,broadIndustry:'Healthcare',industry:'Aircraft manufacturing',sizeBand:'500+',businessModel:'B2B',buyerRoles:['Procurement Director'],buyingTriggers:['Factory expansion'],sourceEvidence:[{field:'broadIndustry',quote,url:row.website}],confidence:'high'}]}),[row.id],[{id:row.id,website:row.website,text:quote}]);
  let reference=Ref.activateReferenceCustomers({rows:[row],analyses:parsed.analyses},[row.id]);reference.dna=Ref.buildReferenceDna(reference,parsed.analyses);reference=Ref.publishReferenceModel(reference);
  const dimensions=Ref.getActiveReferenceModel(reference).dna.referenceProfiles[0].dimensions;
  assert.deepEqual(dimensions.map(d=>d.key),['broadIndustry']);
});
function referenceUiRuntime(){
  const dom=new JSDOM('<div id="toast"></div>',{url:'https://app.example/',runScripts:'outside-only'}),root=dom.window;
  root.LeadIntelReferenceCustomers=Ref;root.LeadIntelReferenceCustomerPortfolio=Portfolio;
  root.LeadIntelServerBridge={session:{authenticated:true,user:{id:'owner-a'}},workspace:{id:'workspace-a'},saveNow:async()=>({saved:true})};
  const r=analysisRuntime(),state=r.read();state.referenceCustomers.analyses[r.row.id]={industry:'Specialist equipment',confidence:'medium'};state.referenceCustomers.analyzedAt='2026-10-30T12:00:00.000Z';
  root.localStorage.setItem(key,JSON.stringify(state));root.eval(source('reference-customer-ui.js'));root.LeadIntelReferenceCustomerUI.open();
  return {root,dom,row:r.row,read:()=>JSON.parse(root.localStorage.getItem(key))};
}
test('an opportunity map cannot write into another account with the same reference IDs',async()=>{
  const r=referenceUiRuntime();let finish;
  r.root.LeadIntelReferenceCustomerAI={requestOpportunityMap:()=>new Promise(resolve=>{finish=()=>resolve([{niche:'Equipment operators',sharedNeed:'Uptime',whyRelevant:'Service need',evidenceToCheck:'Service expansion'}]);})};
  const form=r.root.document.querySelector('#customer-opportunity-form');form.elements.service.value='Equipment maintenance';form.elements.problem.value='Reduce downtime';form.dispatchEvent(new r.root.Event('submit',{bubbles:true,cancelable:true}));
  r.root.LeadIntelServerBridge.session.user.id='owner-b';const before=r.root.localStorage.getItem(key);finish();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.root.localStorage.getItem(key),before);r.dom.window.close();
});
test('a delayed reference file cannot import into a different workspace context',async()=>{
  const r=referenceUiRuntime();let finish;
  const input=r.root.document.querySelector('#reference-file-input');Object.defineProperty(input,'files',{value:[{name:'references.csv',text:()=>new Promise(resolve=>{finish=()=>resolve('Company,Website\nOther Company,https://other.example');})}]});
  input.dispatchEvent(new r.root.Event('change'));r.root.LeadIntelServerBridge.session.user.id='owner-b';const before=r.root.localStorage.getItem(key);finish();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(r.root.localStorage.getItem(key),before);r.dom.window.close();
});
test('adding a manual reference preserves the existing deal fields and PDF review gate',async()=>{
  const r=referenceUiRuntime(),state=r.read();Object.assign(state.referenceCustomers.rows[0],{productService:'Maintenance contract',approximateValue:'50000 EUR',status:'needs_review',reviewed:false});r.root.localStorage.setItem(key,JSON.stringify(state));
  r.root.document.querySelector('#reference-add-manual').click();r.root.document.querySelector('#reference-manual-company').value='New reference';r.root.document.querySelector('#reference-manual-website').value='https://new-reference.example/';
  r.root.document.querySelector('#reference-manual-form').dispatchEvent(new r.root.Event('submit',{bubbles:true,cancelable:true}));await new Promise(resolve=>setImmediate(resolve));
  const kept=r.read().referenceCustomers.rows.find(row=>row.id===r.row.id);assert.equal(kept.productService,'Maintenance contract');assert.equal(kept.approximateValue,'50000 EUR');assert.equal(kept.reviewed,false);assert.equal(kept.status,'needs_review');r.dom.window.close();
});
test('an older base singleton upgrades once and subsequent imports retain its library patches',()=>{
  const previous={runtimeVersion:'20260930-reference-activation-v6'},root={LeadIntelReferenceCustomers:previous,URL};
  vm.runInNewContext(source('reference-customers.js'),root);
  const current=root.LeadIntelReferenceCustomers;assert.notEqual(current,previous);assert.equal(typeof current.referenceWorkflowScope,'function');
  vm.runInNewContext(source('reference-customer-library.js'),root);const normalize=current.normalizeReferenceState;
  vm.runInNewContext(source('reference-customers.js'),root);assert.equal(root.LeadIntelReferenceCustomers,current);assert.equal(current.normalizeReferenceState,normalize);
});
function publishedWorkspace(){
  const r=analysisRuntime(),state=r.read(),analyses={[r.row.id]:{industry:'Healthcare',confidence:'medium'}};
  let reference=Ref.activateReferenceCustomers({rows:[r.row],analyses},[r.row.id]);reference.dna=Ref.buildReferenceDna(reference,analyses);reference=Ref.publishReferenceModel(reference);
  let saved=Portfolio.saveCurrentList({...state,referenceCustomers:reference},{name:'Published references'});return Portfolio.setListActive(saved,saved.referenceCustomerPortfolio.selectedListId,true);
}
function discoveryProfile(state,withPortfolio=true){
  const root={URL,console,addEventListener(){},setTimeout(){return 0;},clearTimeout(){},LeadIntelDiscovery:require('../discovery-engine.js'),LeadIntelReferenceCustomers:Ref,LeadIntelReferenceCustomerPortfolio:withPortfolio?Portfolio:undefined,
    localStorage:{getItem:k=>k===key?JSON.stringify(state):null},document:{getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[]}};root.window=root;
  vm.runInNewContext(source('discovery-ui.js').replace(/\ninitDiscoveryWhenReady\(\);\s*$/,'\nglobalThis.readQualificationProfile=()=>qualificationContext().profile;'),root);
  return root.readQualificationProfile();
}
function strategyAvailability(state,withPortfolio=true){
  const app=source('app.js'),start=app.indexOf('function icpActivationRequirement('),end=app.indexOf('\nfunction enforceIcpActivationRequirements',start);
  const root={state,localStorage:{getItem:()=>JSON.stringify(state)},STORAGE_KEY:key,LeadIntelReferenceCustomers:Ref,LeadIntelReferenceCustomerPortfolio:withPortfolio?Portfolio:undefined};
  vm.runInNewContext(app.slice(start,end),root);return root.icpActivationRequirement({type:'lookalike'}).available;
}
for(const stateKind of ['deactivated','empty','deleted','active','legacy'])test(`Strategy and Discovery honor ${stateKind} reference portfolio state`,()=>{
  let state=publishedWorkspace(),expected=stateKind==='active'||stateKind==='legacy',id=state.referenceCustomerPortfolio.selectedListId;
  if(stateKind==='deactivated')state=Portfolio.setListActive(state,id,false);
  if(stateKind==='empty')state.referenceCustomerPortfolio={lists:[],selectedListId:''};
  if(stateKind==='deleted')state=Portfolio.deleteList(state,id);
  if(stateKind==='legacy')delete state.referenceCustomerPortfolio;
  assert.equal(strategyAvailability(state),expected,'Strategy availability');assert.equal(Boolean(discoveryProfile(state).referenceSimilarityModel),expected,'Discovery qualification model');
});
test('an explicit portfolio cannot bypass deactivation while its runtime is unavailable',()=>{
  const state=publishedWorkspace();assert.equal(strategyAvailability(state,false),false);assert.equal(Boolean(discoveryProfile(state,false).referenceSimilarityModel),false);
});
