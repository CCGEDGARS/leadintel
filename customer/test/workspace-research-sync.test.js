const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const budget=require('../state-budget.js');
const persistenceSource=fs.readFileSync(require.resolve('../workspace-persistence.js'),'utf8');
const KEYS={main:'leadintel_customer_v2_state',discovery:'leadintel_customer_v2_discovery',outreach:'leadintel_customer_v2_outreach',delivery:'leadintel_customer_v2_delivery',meta:'leadintel_customer_v2_discovery_meta'};
function load(values,nativeFetch){
 const timers=new Map();let timer=0;
 const root={console,URL,Request,Response,Date,Promise,LeadIntelStateBudget:budget,LeadIntelServerBridge:{session:{authenticated:true},workspace:{id:'w1'}},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},location:{href:'https://leadintel.ccgroup.lv/customer/'},fetch:nativeFetch,document:{readyState:'loading',querySelector:()=>null,getElementById:()=>null,addEventListener(){}},addEventListener(){},removeEventListener(){},setTimeout(fn){const id=++timer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 root.globalThis=root;vm.runInNewContext(persistenceSource,root);return root;
}
function localValues(payload){return new Map(Object.entries(KEYS).map(([key,storageKey])=>[storageKey,JSON.stringify(key==='meta'?payload.meta.discovery:payload[key]||{})]));}
const endpoint='https://leadintel-api.edgars-7e7.workers.dev/api/customer/state?workspace_id=w1';

test('real save boundary compacts research and keeps a stable clean local baseline across save and reload',async()=>{
 const evidence=Array.from({length:50},(_,i)=>({url:`https://company${i}.se/news`,title:'Factory news',text:'Manufacturing investment '.repeat(1500),date:'2026-10-01'}));
 const payload={main:{website:'https://seller.example',profile:{companyName:'Seller'}},discovery:{rawResults:evidence,selectedProspects:[{company:'Company',domain:'company.se',notes:'Retain selected buyer'}]},outreach:{},delivery:{},meta:{discovery:{}}};
 const values=localValues(payload);let saved;
 const root=load(values,async(input,options)=>{
  if(options.method==='PUT'){saved=JSON.parse(options.body);assert.ok(budget.bytes(saved.payload)<=500*1024);return new Response(JSON.stringify({saved:true,version:8}),{status:200});}
  return new Response(JSON.stringify({version:8,payload:saved.payload}),{status:200});
 });
 const response=await root.fetch(endpoint,{method:'PUT',body:JSON.stringify({schema_version:1,version:7,payload}),leadintelSaveIntent:true,leadintelExplicitSave:true});
 assert.equal(response.status,200);assert.equal(saved.payload.meta.persistence.explicit_saved,true);
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
 assert.equal(JSON.parse(values.get(KEYS.discovery)).rawResults[0].text,evidence[0].text);
 values.set('leadintel_customer_v2_server_versions',JSON.stringify({w1:8}));
 await root.fetch(endpoint,{method:'GET'});
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false,'compacted server bodies must not create endless dirty-state autosaves');
 // Another browser starts from the server payload and preserves source links and selected records.
 const reloadedValues=localValues(saved.payload);const reloaded=load(reloadedValues,async()=>new Response(JSON.stringify({version:8,payload:saved.payload}),{status:200}));
 await reloaded.fetch(endpoint,{method:'GET'});
 assert.equal(JSON.parse(reloadedValues.get(KEYS.discovery)).rawResults.length,50);
 assert.equal(JSON.parse(reloadedValues.get(KEYS.discovery)).rawResults[0].url,evidence[0].url);
 assert.equal(JSON.parse(reloadedValues.get(KEYS.discovery)).selectedProspects[0].notes,'Retain selected buyer');
});

test('edits made while a research save is in flight remain unsaved and are never overwritten',async()=>{
 const payload={main:{website:'https://seller.example'},discovery:{candidates:[]},outreach:{},delivery:{},meta:{discovery:{}}};
 const values=localValues(payload);let finish;
 const root=load(values,()=>new Promise(resolve=>finish=()=>resolve(new Response(JSON.stringify({saved:true,version:8}),{status:200}))));
 const saving=root.fetch(endpoint,{method:'PUT',body:JSON.stringify({schema_version:1,version:7,payload}),leadintelSaveIntent:true,leadintelExplicitSave:true});
 values.set(KEYS.main,JSON.stringify({website:'https://seller.example',answers:{priority_offers:'New offer'}}));finish();await saving;
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),true);
 assert.equal(JSON.parse(values.get(KEYS.main)).answers.priority_offers,'New offer');
});

test('oversized business data fails before the network and remains available locally',async()=>{
 const payload={main:{website:'https://seller.example'},discovery:{businessNotes:'z'.repeat(520*1024)},outreach:{},delivery:{},meta:{discovery:{}}};
 const values=localValues(payload);let requests=0;const root=load(values,async()=>{requests++;return new Response('{}');});
 await assert.rejects(root.fetch(endpoint,{method:'PUT',body:JSON.stringify({payload}),leadintelSaveIntent:true,leadintelExplicitSave:true}),/500 KB sync limit/);
 assert.equal(requests,0);assert.equal(JSON.parse(values.get(KEYS.discovery)).businessNotes.length,520*1024);
 assert.equal(root.LeadIntelWorkspacePersistence.isExplicitlySaved(),false);
});
test('repeated discovery references survive the real save and hydration boundary',async()=>{
 const company={domain:'example.com',people:Array.from({length:30},(_,i)=>({name:'Buyer '+i,notes:'Sourced role evidence '.repeat(100)}))};
 const payload={main:{notes:'x'.repeat(360*1024)},discovery:{candidates:[company],selectedProspects:[company],pipeline:[company]},outreach:{},delivery:{},meta:{discovery:{}}};
 let saved;const values=localValues(payload),root=load(values,async(input,options)=>{if(options.method==='PUT'){saved=JSON.parse(options.body);return new Response(JSON.stringify({saved:true,version:8}));}return new Response(JSON.stringify({version:8,payload:saved.payload}));});
 await root.fetch(endpoint,{method:'PUT',body:JSON.stringify({payload}),leadintelSaveIntent:true,leadintelExplicitSave:true});
 assert.equal(saved.payload.discovery.format,'leadintel-discovery-refs-v1');assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
 values.set('leadintel_customer_v2_server_versions',JSON.stringify({w1:8}));await root.fetch(endpoint,{method:'GET'});assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
 assert.deepEqual(budget.restoreFromSync(saved.payload).discovery,payload.discovery);
});
