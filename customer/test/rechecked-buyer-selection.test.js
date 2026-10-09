const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../discovery-ui.js'),'utf8');
function selection({candidates=[],potentialMatches=[],selectedProspects=[],suppressed=[]}={}){
  const context={discovery:{candidates,potentialMatches,selectedProspects},
    canonicalDomain:value=>String(value||'').replace(/^www\./,''),
    qualificationAssessment:row=>({eligible:row.qualified===true}),
    selectedTargets:()=>[],crmCompanyByDomain:domain=>suppressed.includes(domain)?{lifecycle_status:'suppressed'}:null};
  vm.createContext(context);
  vm.runInContext(source.slice(source.indexOf('function buyerSelectionRows(){'),source.indexOf('function currentJourneyFocus()')),context);
  return context.buyerSelectionRows();
}
const saved={domain:'lkab.com',buyerSearchMode:'user_selected_qualified',people:[{id:'joakim',kept:true,flowSelected:true,emailResearch:{status:'complete'}}]};
test('rechecking a selected company preserves its Buyers handoff when qualification becomes incomplete',()=>{
  const result=selection({candidates:[{domain:'lkab.com',qualified:false,needsRecheck:true}],selectedProspects:[saved]});
  assert.equal(result.length,1);assert.equal(result[0],saved);assert.equal(result[0].people[0].flowSelected,true);
});
test('parking a selected company in research review retains the saved buyers',()=>{
  const result=selection({potentialMatches:[{domain:'lkab.com',qualified:false}],selectedProspects:[saved]});
  assert.equal(result.length,1);assert.equal(result[0].people,saved.people);
});
test('retaining reviewed selections does not import stale company searches',()=>{
  assert.equal(selection({candidates:[{domain:'other.com',qualified:true}],selectedProspects:[saved]}).length,0);
});
test('suppression still excludes a selected company after recheck',()=>{
  assert.equal(selection({potentialMatches:[{domain:'lkab.com'}],selectedProspects:[saved],suppressed:['lkab.com']}).length,0);
});
