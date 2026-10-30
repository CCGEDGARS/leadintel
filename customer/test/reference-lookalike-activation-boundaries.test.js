const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Ref=require('../reference-customers.js');
require('../reference-customer-library.js');
const Portfolio=require('../reference-customer-portfolio.js');
const key='leadintel_customer_v2_state';
const lookSource=fs.readFileSync(require.resolve('../lookalike-discovery.js'),'utf8');
function activeWorkspace(){
  const rows=Ref.normalizeImportedRows([{Company:'Northlight Care',Website:'https://care.example'}]);
  const analyses={[rows[0].id]:{industry:'Healthcare',confidence:'medium'}};
  let reference=Ref.activateReferenceCustomers({rows,analyses},[rows[0].id]);reference.dna=Ref.buildReferenceDna(reference,analyses);reference=Ref.publishReferenceModel(reference);
  let state=Portfolio.saveCurrentList({website:'https://seller.example',referenceCustomers:reference},{name:'Healthcare references'});
  return Portfolio.setListActive(state,state.referenceCustomerPortfolio.selectedListId,true);
}
function runtime(state,{portfolio=true}={}){
  const Discovery={buildDiscoveryFollowUpQueries:()=>[],mergeCompanyCandidates:rows=>rows,buildPotentialCompanyCandidates:rows=>rows};
  const Market={localizeGeneratedState:state=>({...state})};
  const root={URL,module:{exports:{}},require:name=>require('../'+name),localStorage:{getItem:k=>k===key?JSON.stringify(state):null},LeadIntelReferenceCustomers:Ref,LeadIntelReferenceCustomerPortfolio:portfolio?Portfolio:undefined,LeadIntelDiscovery:Discovery,LeadIntelMarket:Market};
  vm.runInNewContext(lookSource,root,{filename:'lookalike-discovery.js'});
  return {Look:root.module.exports,Discovery,Market};
}
const candidates=()=>[{company:'Clinic analogue',domain:'clinic-analogue.example',industry:'Healthcare',score:{total:60}}];
for(const kind of ['deactivated','empty','deleted','active','legacy']){
  test(`lookalike Strategy localization and ranking honor ${kind} portfolio state`,()=>{
    let state=activeWorkspace(),id=state.referenceCustomerPortfolio.selectedListId;
    if(kind==='deactivated')state=Portfolio.setListActive(state,id,false);
    if(kind==='empty')state.referenceCustomerPortfolio={lists:[],selectedListId:''};
    if(kind==='deleted')state=Portfolio.deleteList(state,id);
    if(kind==='legacy')delete state.referenceCustomerPortfolio;
    const expected=kind==='active'||kind==='legacy',r=runtime(state),profile={website:state.website,targetMarkets:'Latvia'};
    const localized=r.Market.localizeGeneratedState({icps:[]},profile,'en'),lens=localized.icps.find(item=>item.id==='icp-reference-lookalike');
    assert.equal(lens.active,expected,'Strategy lens activity');assert.equal(lens.referenceModelAvailable,expected,'Strategy evidence availability');
    assert.equal(r.Discovery.mergeCompanyCandidates(candidates(),profile)[0].lookalikeMatch.active,expected,'qualified candidate ranking');
    assert.equal(r.Discovery.buildPotentialCompanyCandidates(candidates(),profile)[0].lookalikeMatch.active,expected,'review candidate ranking');
  });
}
for(const value of [null,undefined])test(`explicit ${value} reference model suppresses browser fallback during ranking`,()=>{
  const r=runtime(activeWorkspace()),profile={website:'https://seller.example',referenceSimilarityModel:value};
  assert.equal(r.Discovery.mergeCompanyCandidates(candidates(),profile)[0].lookalikeMatch.active,false);
  assert.equal(r.Discovery.buildPotentialCompanyCandidates(candidates(),profile)[0].lookalikeMatch.active,false);
});
test('an explicit portfolio cannot use the legacy editor model before the portfolio runtime loads',()=>{
  const r=runtime(activeWorkspace(),{portfolio:false}),localized=r.Market.localizeGeneratedState({icps:[]},{website:'https://seller.example'},'en');
  assert.equal(localized.icps.find(item=>item.id==='icp-reference-lookalike').active,false);
  assert.equal(r.Discovery.mergeCompanyCandidates(candidates(),{})[0].lookalikeMatch.active,false);
});
test('an explicitly supplied model remains usable without browser reference state',()=>{
  const state=activeWorkspace(),model=Portfolio.getCombinedActiveModel(state),r=runtime({referenceCustomerPortfolio:{lists:[]}});
  assert.equal(r.Discovery.mergeCompanyCandidates(candidates(),{referenceSimilarityModel:model})[0].lookalikeMatch.active,true);
  assert.equal(r.Discovery.buildPotentialCompanyCandidates(candidates(),{referenceSimilarityModel:model})[0].lookalikeMatch.active,true);
});
test('a genuine legacy reference model remains usable before the portfolio runtime loads',()=>{
  const state=activeWorkspace();delete state.referenceCustomerPortfolio;const r=runtime(state,{portfolio:false});
  assert.equal(r.Market.localizeGeneratedState({icps:[]},{},'en').icps.find(item=>item.id==='icp-reference-lookalike').active,true);
  assert.equal(r.Discovery.mergeCompanyCandidates(candidates(),{})[0].lookalikeMatch.active,true);
});
