const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function slice(start,end){const from=source.indexOf(start);assert.ok(from>=0,start);const to=source.indexOf(end,from);assert.ok(to>from,end);return source.slice(from,to);}
const helpers=slice('function roleList(','function buyerQualificationHtml(');
const plain=value=>JSON.parse(JSON.stringify(value));
test('buyer role helpers accept the stored string form and the array form',()=>{
 const context={};vm.createContext(context);vm.runInContext(helpers,context);
 assert.deepEqual(plain(context.roleList('CEO; CTO;; Head of Operations')),['CEO','CTO','Head of Operations']);
 assert.deepEqual(plain(context.roleList(['CEO',' CTO ',''])),['CEO','CTO']);
 assert.deepEqual(plain(context.roleList(undefined)),[]);assert.deepEqual(plain(context.roleList(null)),[]);
 assert.deepEqual(plain(context.candidateBuyerRoles({buyerRoles:'CEO; CTO'})),['CEO','CTO']);
 assert.deepEqual(plain(context.candidateBuyerRoles({buyerRoles:'CEO',buyerDiscovery:{opportunityRoles:['Plant Manager']}})),['Plant Manager']);
 assert.deepEqual(plain(context.candidateBuyerRoles({buyerRoles:'CEO',buyerDiscovery:{opportunityRoles:'Plant Manager; COO'}})),['Plant Manager','COO']);
 assert.deepEqual(plain(context.candidateBuyerRoles({buyerRoles:'CEO',buyerRolesChanged:true,buyerDiscovery:{opportunityRoles:['Plant Manager']}})),['CEO']);
 assert.deepEqual(plain(context.candidateBuyerRoles({})),[]);
});
test('no template or qualification path calls join on the string buyerRoles field',()=>{
 assert.equal(/candidate\.buyerRoles\|\|\[\]\)\.join/.test(source),false);
 assert.equal(/candidate\.buyerRoles\)\.join/.test(source),false);
 assert.equal(/opportunityRoles:candidate\.buyerRoles\|\|/.test(source),false);
});
test('buyer role coverage works when buyerRoles is the stored string and opportunityRoles is absent',()=>{
 const context={LeadIntelDiscovery:D};vm.createContext(context);vm.runInContext(helpers+slice('function buyerRoleCoverage(','function buyerQualificationHtml('),context);
 const candidate={company:'Example',domain:'example.com',buyerRoles:'CEO; CTO; Head of Operations',people:[{id:'p1',name:'Anna Andersson',title:'CTO'}]};
 const plan=context.buyerRoleCoverage(candidate);assert.ok(plan&&typeof plan==='object');
});
test('a buyer search left in loading state is reset when discovery state loads',()=>{
 const storage=new Map();
 storage.set('leadintel_customer_v2_discovery',JSON.stringify({selectedProspects:[
  {company:'Stuck',domain:'stuck.example',buyerSearchMode:'user_selected_target',peopleStatus:'loading',buyerResearchProgress:{phase:'company',label:'Verifying company',step:1,total:5},people:[]},
  {company:'Done',domain:'done.example',buyerSearchMode:'user_selected_target',peopleStatus:'loading',people:[{id:'p1',name:'Anna Andersson',title:'CTO'}]}]}));
 const context={LeadIntelDiscovery:D,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},MAIN_STORAGE_KEY:'leadintel_customer_v2_state',DISCOVERY_STORAGE_KEY:'leadintel_customer_v2_discovery',recoveredInterruptedRun:false,mainState:()=>({}),window:{}};
 vm.createContext(context);vm.runInContext(slice('function loadDiscovery(','function saveDiscovery('),context);
 const state=context.loadDiscovery();
 const [stuck,done]=state.selectedProspects;
 assert.equal(stuck.peopleStatus,'idle');assert.equal(stuck.buyerResearchProgress,undefined);
 assert.equal(done.peopleStatus,'complete');
});

test('reloading an unchanged role selection preserves the researched buyer list',()=>{
 const main={profile:{priorityOffers:'industrial automation',decisionMakers:'COO'},market:{icps:[{id:'icp-core',active:true,buyerRoles:'COO; Team Leadership'}]}};
 const storage=JSON.stringify({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',buyerRoles:D.buyerSelectionRoles({decisionMakers:'COO; Team Leadership'}),buyerRolesChanged:false,people:[{id:'p1',name:'Anna Andersson',title:'COO',organization:'Example',publicNameUrl:'https://example.com/team'}]}]});
 const ctx={LeadIntelDiscovery:D,localStorage:{getItem:()=>storage},MAIN_STORAGE_KEY:'main',DISCOVERY_STORAGE_KEY:'discovery',recoveredInterruptedRun:false,mainState:()=>main,window:{}};
 vm.createContext(ctx);vm.runInContext(slice('function loadDiscovery(','function saveDiscovery('),ctx);
 const candidate=ctx.loadDiscovery().selectedProspects[0];
 assert.equal(candidate.buyerRolesChanged,false);assert.equal(candidate.people[0].name,'Anna Andersson');
});
