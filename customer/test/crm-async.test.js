const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function harness(bridge){
  const window={LeadIntelServerBridge:bridge};
  const document={readyState:'loading',addEventListener(){},getElementById(){return null;}};
  const source=fs.readFileSync(path.join(__dirname,'../crm-ui.js'),'utf8').replace('})(window);','root.testAccess={state,loadCompanies,openCompany};})(window);');
  vm.runInNewContext(source,{window,document,console,setTimeout,clearTimeout});
  return window.testAccess;
}
test('CRM follows next page without discarding the first page',async()=>{
  const bridge={session:{authenticated:true},workspace:{id:'one'},async listCrmCompanies(query){return query.cursor==='100'?{ok:true,companies:[{id:'second'}],next_cursor:null}:{ok:true,companies:[{id:'first'}],next_cursor:'100'};}};
  const h=harness(bridge);await h.loadCompanies();await h.loadCompanies(true);
  assert.deepEqual(Array.from(h.state.companies,x=>x.id),['first','second']);
});
test('late detail response cannot replace the newly selected company',async()=>{
  let resolveOld;
  const h=harness({workspace:{id:'one'},getCrmCompany(id){return id==='old'?new Promise(r=>resolveOld=r):Promise.resolve({ok:true,company:{id:'new'}});}});
  const pending=h.openCompany('old');await h.openCompany('new');resolveOld({ok:true,company:{id:'old'}});await pending;
  assert.equal(h.state.detail.company.id,'new');
});
test('CRM transport failure clears loading and exposes a recoverable error',async()=>{
  const h=harness({session:{authenticated:true},workspace:{id:'one'},async listCrmCompanies(){throw Error('offline');}});
  await h.loadCompanies();assert.equal(h.state.loading,false);assert.ok(h.state.error);
});
