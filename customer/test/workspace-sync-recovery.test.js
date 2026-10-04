const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const persistence=fs.readFileSync(require.resolve('../workspace-persistence.js'),'utf8');
const bridgeSource=fs.readFileSync(require.resolve('../server-bridge.js'),'utf8');
const MAIN='leadintel_customer_v2_state',RECOVERY='leadintel_customer_v2_sync_recovery_v1';
function load(fetchImpl,{withBridge=false,quota=false}={}){
 const values=new Map([[MAIN,JSON.stringify({website:'https://seller.example',answers:{offer:'Local offer'}})],['leadintel_customer_v2_workspace','w1']]);
 const events=[],timers=new Map();let id=0;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){if(quota&&key===RECOVERY)throw new Error('Quota exceeded');values.set(key,String(value));},removeItem:key=>values.delete(key)};
 const root={console,URL,Request,Response,Headers,FormData,Blob,Date,Promise,localStorage:storage,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},location:{href:'https://leadintel.ccgroup.lv/customer/',reload(){events.push('reload');}},fetch:fetchImpl,document:{readyState:'loading',getElementById:()=>null,querySelector:()=>null,addEventListener(){}},addEventListener(){},dispatchEvent:e=>events.push(e.type),setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),CustomEvent:class{constructor(type){this.type=type;}}};
 root.window=root;root.globalThis=root;
 vm.runInNewContext(persistence,root);
 if(withBridge){vm.runInNewContext(bridgeSource,root);Object.assign(root.LeadIntelServerBridge,{session:{authenticated:true},workspace:{id:'w1'},stateVersion:3,conflict:true,conflictState:{version:3,payload:{main:{website:'old.example'}}}});}
 return {root,values,events};
}
const endpoint='https://leadintel.ccgroup.lv/api/customer/state?workspace_id=w1';
test('first-party saves update the baseline and do not repeatedly autosave an unsaved draft',async()=>{
 let put;const {root}=load(async(input,options)=>{put=JSON.parse(options.body);return new Response(JSON.stringify({saved:true,version:4}));});
 const payload={main:{website:'https://seller.example'},discovery:{},outreach:{},delivery:{},meta:{}};
 await root.fetch(endpoint,{method:'PUT',body:JSON.stringify({version:3,payload}),leadintelSaveIntent:true,leadintelExplicitSave:true});
 assert.equal(put.payload.meta.persistence.explicit_saved,true);
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
});
test('legacy saved first-party payload is not replaced with a stale local snapshot',async()=>{
 const state={version:9,payload:{main:{website:'server.example'},discovery:{buyers:[{name:'Current buyer'}]}}};
 const {root}=load(async()=>new Response(JSON.stringify(state)));
 const actual=await(await root.fetch(endpoint)).json();assert.deepEqual(actual,state);
 assert.equal(root.LeadIntelWorkspacePersistence.isExplicitlySaved(),true);
});
test('automatic saves never choose keep-local on behalf of the user',async()=>{
 let kept=0;const {root}=load(async()=>new Response('{}'));
 root.LeadIntelServerBridge={session:{authenticated:true},workspace:{id:'w1'},conflict:true,resolveConflictKeepLocal(){kept++;return {saved:true};}};
 assert.equal(await root.LeadIntelWorkspacePersistence.saveWorkspace({automatic:true}),false);assert.equal(kept,0);
});
test('keep-local refreshes stale versions, retries a concurrent write, saves once and keeps both recovery copies',async()=>{
 const puts=[],server={version:9,payload:{main:{website:'newer.example'},discovery:{buyers:[{name:'Researched buyer'}]}}};
 const {root,values}=load(async(input,options)=>{
  if(options.method==='PUT'){const body=JSON.parse(options.body);puts.push(body);if(puts.length===1){server.version=10;return new Response(JSON.stringify({current:server}),{status:409});}return new Response(JSON.stringify({saved:true,version:11}));}
  return new Response(JSON.stringify(server));
 },{withBridge:true});
 const bridge=root.LeadIntelServerBridge;
 const a=bridge.resolveConflictKeepLocal(),b=bridge.resolveConflictKeepLocal();assert.equal(a,b,'double clicks share one resolution');
 assert.equal((await a).resolved,true);assert.deepEqual(puts.map(p=>p.version),[9,10]);
 assert.equal(puts[1].payload.main.answers.offer,'Local offer');assert.equal(bridge.conflict,false);
 const recovery=JSON.parse(values.get(RECOVERY));assert.equal(recovery.workspace_id,'w1');assert.equal(recovery.server.version,10);assert.equal(recovery.original.server.version,9);assert.equal(recovery.server.payload.discovery.buyers[0].name,'Researched buyer');
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
});
test('use-server fetches the current research and preserves the local draft before reload',async()=>{
 const {root,values,events}=load(async()=>new Response(JSON.stringify({version:12,payload:{main:{website:'server.example'},discovery:{buyers:[{name:'Newest buyer'}]}}})),{withBridge:true});
 assert.equal((await root.LeadIntelServerBridge.resolveConflictUseServer()).resolved,true);
 assert.equal(JSON.parse(values.get(MAIN)).website,'server.example');assert.equal(JSON.parse(values.get(RECOVERY)).local.main.answers.offer,'Local offer');assert.ok(events.includes('reload'));
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
});
test('recovery storage failure prevents an overwrite and allows a safe retry',async()=>{
 let writes=0;const {root,values}=load(async(input,options)=>{if(options.method==='PUT')writes++;return new Response(JSON.stringify({version:9,payload:{main:{website:'server.example'}}}));},{withBridge:true,quota:true});
 assert.equal((await root.LeadIntelServerBridge.resolveConflictKeepLocal()).resolved,false);assert.equal(writes,0);assert.equal(root.LeadIntelServerBridge.conflict,true);assert.equal(root.LeadIntelServerBridge.conflictState.version,3);assert.equal(JSON.parse(values.get(MAIN)).answers.offer,'Local offer');
});
test('unrelated origins cannot invoke the persistence boundary and unapproved first-party writes stay blocked',async()=>{
 let calls=0;const {root}=load(async()=>{calls++;return new Response('{}');});
 const blocked=await(await root.fetch(endpoint,{method:'PUT',body:'{}'})).json();assert.equal(blocked.saved,false);assert.equal(calls,0);
 await root.fetch('https://unrelated.example/api/customer/state',{method:'PUT',body:'{}'});assert.equal(calls,1);
});
test('a previous workspace recovery copy is never included in another workspace recovery',async()=>{
 const {root,values}=load(async(input,options)=>new Response(JSON.stringify(options.method==='PUT'?{saved:true,version:10}:{version:9,payload:{main:{website:'server.example'}}})),{withBridge:true});
 values.set(RECOVERY,JSON.stringify({workspace_id:'other-workspace',original:{local:{private:'Other seller'}}}));
 assert.equal((await root.LeadIntelServerBridge.resolveConflictKeepLocal()).resolved,true);
 assert.equal(JSON.parse(values.get(RECOVERY)).workspace_id,'w1');assert.doesNotMatch(values.get(RECOVERY),/Other seller/);
});
