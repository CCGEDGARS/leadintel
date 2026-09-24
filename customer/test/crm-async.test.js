const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function harness(bridge){
  const window={LeadIntelServerBridge:bridge};
  const document={readyState:'loading',addEventListener(){},getElementById(){return null;}};
  const source=fs.readFileSync(path.join(__dirname,'../crm-ui.js'),'utf8').replace('})(window);','root.testAccess={state,loadCompanies,openCompany,loadMoreActivities:typeof loadMoreActivities==="function"?loadMoreActivities:null};})(window);');
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
test('company details load older CRM activity pages without duplicates',async()=>{
  const firstPage=Array.from({length:40},(_,index)=>({id:`new-${index}`,activity_type:'content.approved'}));
  const secondPage=Array.from({length:5},(_,index)=>({id:`old-${index}`,activity_type:'content.approved'}));
  let activityRequests=0;
  const bridge={
    workspace:{id:'one'},
    async getCrmCompany(id){return {ok:true,company:{id},activities:firstPage,activity_next_cursor:'older'};},
    async getCrmActivities(id,query){activityRequests++;return query.cursor==='older'?{ok:true,activities:secondPage,next_cursor:null}:{ok:true,activities:firstPage,next_cursor:'older'};}
  };
  const h=harness(bridge);
  assert.equal(typeof h.loadMoreActivities,'function');
  await h.openCompany('company-1');
  assert.equal(activityRequests,0);
  assert.equal(h.state.detail.activities.length,40);
  assert.equal(h.state.activityCursor,'older');
  await h.loadMoreActivities();
  assert.equal(activityRequests,1);
  assert.equal(h.state.detail.activities.length,45);
  assert.equal(new Set(h.state.detail.activities.map(activity=>activity.id)).size,45);
  assert.equal(h.state.activityCursor,null);
});
