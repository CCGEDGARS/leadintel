const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
function harness(bridge,extra={}){
  const window={LeadIntelServerBridge:bridge,...extra};
  const document={readyState:'loading',addEventListener(){},getElementById(){return null;}};
  const source=fs.readFileSync(path.join(__dirname,'../crm-ui.js'),'utf8').replace('})(window);','root.testAccess={state,loadCompanies,openCompany,loadMoreActivities:typeof loadMoreActivities==="function"?loadMoreActivities:null,findBuyersForSavedCompany};})(window);');
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
test('saved CRM prospect finds and persists buyer roles without company rediscovery or Pipeline promotion',async()=>{
  const calls=[];
  const company={id:'billerud-1',company_name:'Billerud',normalized_domain:'billerud.com',lifecycle_status:'prospect',pipeline_stage:null};
  const bridge={workspace:{id:'one'},session:{authenticated:true},
    async searchApolloPeople(payload){calls.push(['apollo',payload]);return {ok:true,people:[{id:'person-1',name:'Johan',title:'Operations Director'}]};},
    async saveCrmContacts(id,contacts){calls.push(['contacts',id,contacts]);return {ok:true};},
    async listCrmCompanies(){return {ok:true,companies:[company]};},
    async getCrmCompany(){return {ok:true,company,contacts:[{name:'Johan',title:'Operations Director'}],activities:[]};}
  };
  const engine={buildApolloPeopleSearchPayload:({domain},profile)=>({q_organization_domains_list:[domain],person_titles:profile.decisionMakers}),normalizeApolloPeople:result=>result.people,selectDecisionMakers:people=>people};
  const h=harness(bridge,{LeadIntelCrm:{canonicalDomain:value=>value},LeadIntelDiscovery:engine,localStorage:{getItem:()=>JSON.stringify({profile:{decisionMakers:['Operations Director']}})}});
  h.state.selectedId=company.id;h.state.detail={company,contacts:[]};
  assert.equal(await h.findBuyersForSavedCompany(),true);
  assert.deepEqual(calls.map(call=>call[0]),['apollo','contacts']);
  assert.equal(calls[0][1].q_organization_domains_list[0],'billerud.com');
  assert.equal(calls[1][2][0].external_person_id,'person-1');
  assert.equal(calls[1][2][0].work_email,undefined);
  assert.equal(h.state.detail.contacts.length,1);
  assert.equal(company.pipeline_stage,null);
});

test('a CRM workspace switch clears the prior records before awaiting the new workspace list',async()=>{
 let finish;const b={session:{authenticated:true},workspace:{id:'one'},listCrmCompanies:async()=>({ok:true,companies:[{id:'old'}]})},h=harness(b);await h.loadCompanies();h.state.selectedId='old';h.state.detail={company:{id:'old'}};b.workspace.id='two';b.listCrmCompanies=()=>new Promise(resolve=>finish=resolve);const pending=h.loadCompanies();assert.equal(h.state.companies.length,0);assert.equal(h.state.detail,null);assert.equal(h.state.selectedId,'');finish({ok:true,companies:[{id:'new'}]});await pending;assert.equal(h.state.companies[0].id,'new');
});
test('a late buyer search cannot save contacts after the same bridge object switches workspace',async()=>{
 let finish,saves=0;const b={workspace:{id:'one'},searchApolloPeople:()=>new Promise(resolve=>finish=resolve),saveCrmContacts:async()=>{saves++;return {ok:true};}},h=harness(b,{LeadIntelCrm:{canonicalDomain:x=>x},LeadIntelDiscovery:{buildApolloPeopleSearchPayload:()=>({person_titles:['Director']}),normalizeApolloPeople:x=>x.people,selectDecisionMakers:x=>x},localStorage:{getItem:()=>'{"profile":{}}'}});h.state.selectedId='old';h.state.detail={company:{id:'old',normalized_domain:'old.example'}};const pending=h.findBuyersForSavedCompany();b.workspace.id='two';finish({ok:true,people:[{id:'person',name:'Person'}]});assert.equal(await pending,false);assert.equal(saves,0);
});
