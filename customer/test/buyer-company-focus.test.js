const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8').replace(/\ninitDiscoveryWhenReady\(\);\s*$/,'');
const META='leadintel_customer_v2_discovery_meta';
function runtime(saved){
 const data=new Map(saved||[]),c={CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},console,URL,setTimeout,clearTimeout,LeadIntelDiscovery:D,localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},document:{getElementById:()=>null},addEventListener(){},dispatchEvent(){}};c.window=c;vm.createContext(c);vm.runInContext(source,c);
 c.qualificationAssessment=()=>({eligible:true,matchedSignals:[]});
 vm.runInContext("discovery=JSON.parse(localStorage.getItem('leadintel_customer_v2_discovery')||'null')||{candidates:[],selectedProspects:[],pipeline:[]};",c);
 return {c,data,set:rows=>{c.rows=rows;vm.runInContext('discovery.selectedProspects=rows',c);},read:()=>Array.from(c.buyerSelectionRows(),r=>r.domain)};
}
const company=(domain,name=domain)=>({domain,company:name,buyerSearchMode:'user_selected_target',people:[{id:domain+'-person',name:'Saved Buyer',kept:true}],peopleStatus:'complete'});
test('saved selections open the most recently selected company first and retain other companies',()=>{
 const r=runtime();r.set([company('older.example'),company('chosen.example')]);
 assert.deepEqual(r.read(),['chosen.example','older.example']);
});
test('explicit qualified selection wins over old order, survives reload, and preserves saved buyers on reselection',async()=>{
 const r=runtime(),first=company('first.example'),chosen=company('chosen.example');r.set([chosen,first]);
 r.c.input={domain:'chosen.example',company:'Chosen',people:[],buyerSearchMode:'user_selected_qualified'};
 vm.runInContext('discovery.candidates=[input]',r.c);
 assert.equal(await r.c.selectQualifiedForBuyers(0),true);
 assert.deepEqual(r.read(),['chosen.example','first.example']);
 const saved=JSON.parse(r.data.get('leadintel_customer_v2_discovery'));
 assert.equal(saved.selectedProspects.find(x=>x.domain==='chosen.example').people[0].kept,true);
 assert.equal(JSON.parse(r.data.get(META)).activeBuyerCompanyDomain,'chosen.example');
 const restored=runtime([...r.data]);assert.deepEqual(restored.read(),r.read());
 // Background updates/order changes must not override an explicit focus.
 restored.set([chosen,first]);assert.deepEqual(restored.read(),['chosen.example','first.example']);
});
test('unknown or suppressed focus cannot introduce a company into Buyers',()=>{
 const r=runtime();r.set([company('first.example'),company('second.example')]);r.data.set(META,JSON.stringify({activeBuyerCompanyDomain:'unselected.example'}));assert.equal(r.read().includes('unselected.example'),false);
 r.data.set(META,JSON.stringify({activeBuyerCompanyDomain:'second.example'}));r.c.crmCompanyByDomain=d=>d==='second.example'?{lifecycle_status:'suppressed'}:null;assert.deepEqual(r.read(),['first.example']);
});
