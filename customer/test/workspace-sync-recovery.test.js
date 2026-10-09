const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const persistence=fs.readFileSync(require.resolve('../workspace-persistence.js'),'utf8');
const bridgeSource=fs.readFileSync(require.resolve('../server-bridge.js'),'utf8');
const MAIN='leadintel_customer_v2_state',RECOVERY='leadintel_customer_v2_sync_recovery_v1';
function load(fetchImpl,{withBridge=false,quota=false,recoveryLimit=Infinity,withBudget=false}={}){
 const values=new Map([[MAIN,JSON.stringify({website:'https://seller.example',answers:{offer:'Local offer'}})],['leadintel_customer_v2_workspace','w1']]);
 const events=[],timers=new Map();let id=0;
 const storage={getItem:key=>values.get(key)??null,setItem(key,value){if(key===RECOVERY&&(quota||Buffer.byteLength(String(value))>recoveryLimit))throw new Error('Quota exceeded');values.set(key,String(value));},removeItem:key=>values.delete(key)};
 const root={console,URL,Request,Response,Headers,FormData,Blob,Date,Promise,localStorage:storage,sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},location:{href:'https://leadintel.ccgroup.lv/customer/',reload(){events.push('reload');}},fetch:fetchImpl,document:{readyState:'loading',getElementById:()=>null,querySelector:()=>null,addEventListener(){}},addEventListener(){},dispatchEvent:e=>events.push(e.type),setTimeout(fn){timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id),CustomEvent:class{constructor(type){this.type=type;}}};
 if(withBudget)root.LeadIntelStateBudget=require('../state-budget.js');
 root.window=root;root.globalThis=root;
 vm.runInNewContext(fs.readFileSync(require.resolve('../workspace-sync.js'),'utf8'),root);
 vm.runInNewContext(persistence,root);
 if(withBridge){vm.runInNewContext(bridgeSource.replace('root.LeadIntelServerBridge=bridge;', 'root.__hydrate=hydrateAuthenticated;root.LeadIntelServerBridge=bridge;'),root);Object.assign(root.LeadIntelServerBridge,{ready:true,session:{authenticated:true},workspace:{id:'w1'},stateVersion:3,conflict:true,conflictState:{version:3,payload:{main:{website:'old.example'}}}});}
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
test('recovery download appears during conflict and hides after resolution without deleting the backup',async()=>{
 const {root,values}=load(async()=>new Response(JSON.stringify({version:12,payload:{main:{website:'server.example'}}})),{withBridge:true});
 const visibility=[];let hidden=true;
 const recovery={get hidden(){return hidden;},set hidden(value){hidden=value;visibility.push(value);}},actions={hidden:true,setAttribute(){}};
 root.document.getElementById=id=>id==='server-sync-recovery'?recovery:id==='server-conflict-actions'?actions:null;
 values.set(RECOVERY,JSON.stringify({workspace_id:'w1',local:{main:{website:'local.example'}}}));
 assert.equal((await root.LeadIntelServerBridge.resolveConflictUseServer()).resolved,true);
 assert.equal(recovery.hidden,true,'resolved conflicts must not clutter the toolbar');
 assert.ok(visibility.includes(false),'recovery remains available while conflicting');
 assert.equal(JSON.parse(values.get(RECOVERY)).local.main.answers.offer,'Local offer','backup remains intact');
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

function establishBase(root,values,version=3){
 const payload={main:JSON.parse(values.get(MAIN)),discovery:{},outreach:{},delivery:{},meta:{discovery:{}}};
 root.LeadIntelWorkspacePersistence.snapshotFromServerPayload(payload,{workspaceId:'w1',version,localData:root.LeadIntelWorkspacePersistence.currentWorkspaceData(),dirty:false});
 values.set('leadintel_customer_v2_server_dirty',JSON.stringify({workspace_id:'w1',base_version:version}));
 return payload;
}
test('409 with disjoint changes preserves server research and local edits before one bounded retry',async()=>{
 const puts=[];let server;
 const {root,values}=load(async(input,options)=>{
  if(options.method==='PUT'){puts.push(JSON.parse(options.body));return puts.length===1?new Response(JSON.stringify({current:server}),{status:409}):new Response(JSON.stringify({saved:true,version:5}));}
  return new Response(JSON.stringify(server));
 },{withBridge:true});
 const base=establishBase(root,values);server={version:4,payload:{...base,discovery:{buyers:[{name:'New buyer',source:'https://buyer.example/team'}]}}};
 values.set(MAIN,JSON.stringify({...base.main,answers:{offer:'New local offer'}}));
 Object.assign(root.LeadIntelServerBridge,{conflict:false,conflictState:null});
 const result=await root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true});
 assert.equal(result.saved,true);assert.equal(puts.length,2);assert.equal(puts[1].version,4);assert.equal(puts[1].payload.main.answers.offer,'New local offer');assert.equal(puts[1].payload.discovery.buyers[0].name,'New buyer');
 const recovery=JSON.parse(values.get(RECOVERY));assert.equal(recovery.local.main.answers.offer,'New local offer');assert.equal(recovery.server.payload.discovery.buyers[0].name,'New buyer');
 assert.equal(root.LeadIntelServerBridge.conflict,false);
});
test('409 with overlapping edits, missing baseline or wrong workspace never overwrites server',async()=>{
 for(const mode of ['overlap','missing','other-workspace']){
  let server,writes=0;const {root,values}=load(async()=>{writes++;return new Response(JSON.stringify({current:server}),{status:409});},{withBridge:true});
  const base=establishBase(root,values);server={version:4,payload:{...base,main:{...base.main,answers:{offer:'Remote edit'}}}};
  values.set(MAIN,JSON.stringify({...base.main,answers:{offer:'Local edit'}}));
  if(mode==='missing')values.delete('leadintel_customer_v2_workspace_saved_snapshot_v1');
  if(mode==='other-workspace'){const key='leadintel_customer_v2_workspace_saved_snapshot_v1',snapshot=JSON.parse(values.get(key));snapshot.workspace_id='w2';values.set(key,JSON.stringify(snapshot));}
  Object.assign(root.LeadIntelServerBridge,{conflict:false,conflictState:null});
  const result=await root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true});
  assert.equal(result.conflict,true);assert.equal(writes,1);assert.equal(JSON.parse(values.get(MAIN)).answers.offer,'Local edit');
 }
});
test('quota failure blocks automatic merge before replacing local evidence',async()=>{
 let writes=0,server;const {root,values}=load(async()=>{writes++;return new Response(JSON.stringify({current:server}),{status:409});},{withBridge:true,quota:true});
 const base=establishBase(root,values);server={version:4,payload:{...base,discovery:{buyers:[{name:'Remote buyer'}]}}};values.set(MAIN,JSON.stringify({...base.main,answers:{offer:'Local edit'}}));
 Object.assign(root.LeadIntelServerBridge,{conflict:false,conflictState:null});
 assert.equal((await root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true})).conflict,true);assert.equal(writes,1);assert.equal(JSON.parse(values.get(MAIN)).answers.offer,'Local edit');
});

test('reload safely reconciles navigation changes with newer researched buyers using the trusted baseline',async()=>{
 let server;const {root,values,events}=load(async()=>new Response(JSON.stringify(server)),{withBridge:true});
 const base=establishBase(root,values);server={version:4,payload:{...base,discovery:{buyers:[{name:'New buyer'}]}}};
 values.set('leadintel_customer_v2_discovery_meta',JSON.stringify({stage:5}));
 Object.assign(root.LeadIntelServerBridge,{conflict:false,conflictState:null});
 assert.equal(await root.__hydrate(),false);
 assert.equal(JSON.parse(values.get('leadintel_customer_v2_discovery')).buyers[0].name,'New buyer');
 assert.equal(JSON.parse(values.get('leadintel_customer_v2_discovery_meta')).stage,5);
 assert.equal(root.LeadIntelServerBridge.conflict,false);assert.ok(events.includes('reload'));
 assert.equal(root.LeadIntelWorkspacePersistence.syncedBase('w1').version,4);
});
test('identical payload with a newer server version clears false conflict without writing',async()=>{
 let writes=0,server;const {root,values}=load(async(input,options)=>{writes++;return new Response(JSON.stringify({current:server}),{status:409});},{withBridge:true});
 server={version:4,payload:establishBase(root,values)};
 Object.assign(root.LeadIntelServerBridge,{conflict:false,conflictState:null});
 const result=await root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true});
 assert.equal(result.saved,true);assert.equal(writes,1);assert.equal(root.LeadIntelServerBridge.conflict,false);
});
test('unsaved recovery response restores review state and retains the local draft',async()=>{
 const {root,values}=load(async(input,options)=>new Response(JSON.stringify(options.method==='PUT'?{saved:false,version:4}:{version:4,payload:{main:{website:'Remote'}}})),{withBridge:true});
 const result=await root.LeadIntelServerBridge.resolveConflictKeepLocal();
 assert.equal(result.resolved,false);assert.equal(root.LeadIntelServerBridge.conflict,true);assert.equal(JSON.parse(values.get(MAIN)).answers.offer,'Local offer');assert.match(result.error,/not completed/);
});

test('a save in a second tab uses the shared acknowledged version instead of creating a false 409',async()=>{
 const puts=[];const {root,values}=load(async(input,options)=>{const body=JSON.parse(options.body);puts.push(body);return new Response(JSON.stringify({version:5,payload:body.payload}));},{withBridge:true});
 const base=establishBase(root,values,4);values.set('leadintel_customer_v2_server_versions',JSON.stringify({w1:4}));
 values.set(MAIN,JSON.stringify({...base.main,answers:{offer:'Next tab edit'}}));Object.assign(root.LeadIntelServerBridge,{stateVersion:3,conflict:false});
 assert.equal((await root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true})).saved,true);assert.equal(puts[0].version,4);
});
test('safe reload merge tolerates legacy compacted research without erasing newer cloud buyers',async()=>{
 const budget=require('../state-budget.js');let server;const {root,values}=load(async()=>new Response(JSON.stringify(server)),{withBridge:true});root.LeadIntelStateBudget=budget;
 const base=establishBase(root,values);base.discovery={rawResults:[{url:'https://buyer.example/news',text:'Evidence '.repeat(90000)}],people:[{id:'a',name:'Anna Buyer'}]};
 values.set('leadintel_customer_v2_discovery',JSON.stringify(base.discovery));root.LeadIntelWorkspacePersistence.snapshotFromServerPayload(budget.prepareForSync(base).payload,{workspaceId:'w1',version:3,localData:root.LeadIntelWorkspacePersistence.currentWorkspaceData(),dirty:false});
 // Simulate an already-saved pre-fix snapshot: it contained only full local data.
 const key='leadintel_customer_v2_workspace_saved_snapshot_v1',old=JSON.parse(values.get(key));delete old.server_payload;values.set(key,JSON.stringify(old));
 server={version:4,payload:budget.prepareForSync(base).payload};server.payload.discovery.people.push({id:'b',name:'New Buyer'});
 values.set('leadintel_customer_v2_discovery_meta',JSON.stringify({stage:5}));Object.assign(root.LeadIntelServerBridge,{conflict:false});
 assert.equal(await root.__hydrate(),false);assert.equal(root.LeadIntelServerBridge.conflict,false);
 assert.equal(JSON.parse(values.get('leadintel_customer_v2_discovery')).people.length,2);assert.equal(JSON.parse(values.get('leadintel_customer_v2_discovery_meta')).stage,5);
});

test('autosave during authenticated startup retains the existing cloud baseline until hydration is ready',async()=>{
 const {root,values}=load(async()=>new Response('{}'));const base=establishBase(root,values),key='leadintel_customer_v2_workspace_saved_snapshot_v1',snapshot=values.get(key);
 let timeout;root.setTimeout=(fn,ms)=>{if(ms===1800)timeout=fn;return 1;};root.LeadIntelServerBridge={session:{authenticated:true},workspace:null,ready:false};
 values.set(MAIN,JSON.stringify({...base.main,answers:{offer:'New draft during slow startup'}}));
 const saving=root.LeadIntelWorkspacePersistence.saveWorkspace({automatic:true});await new Promise(resolve=>setImmediate(resolve));timeout?.();
 assert.equal(await saving,false);assert.equal(values.get(key),snapshot,'startup must not replace a cloud baseline with a browser-only snapshot');
 assert.equal(root.LeadIntelWorkspacePersistence.syncedBase('w1').version,3);
});

test('a late hydration read cannot replace data already acknowledged at a newer shared revision',async()=>{
 const {root,values}=load(async()=>new Response(JSON.stringify({version:8,payload:{main:{website:'old.example'}}})),{withBridge:true});
 establishBase(root,values,9);values.set('leadintel_customer_v2_server_versions',JSON.stringify({w1:9}));values.delete('leadintel_customer_v2_server_dirty');Object.assign(root.LeadIntelServerBridge,{stateVersion:9,conflict:false});
 assert.equal(await root.__hydrate(),true);assert.equal(JSON.parse(values.get(MAIN)).website,'https://seller.example');assert.equal(root.LeadIntelServerBridge.stateVersion,9);
});
test('an older save acknowledgement cannot roll back a newer shared revision or its dirty baseline',async()=>{
 let finish;const {root,values}=load(()=>new Promise(resolve=>finish=()=>resolve(new Response(JSON.stringify({version:4,saved:true})))),{withBridge:true});
 const base=establishBase(root,values);Object.assign(root.LeadIntelServerBridge,{stateVersion:3,conflict:false});
 const saving=root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true});await new Promise(resolve=>setImmediate(resolve));
 values.set(MAIN,JSON.stringify({...base.main,answers:{offer:'Latest acknowledged edit'}}));
 root.LeadIntelWorkspacePersistence.snapshotFromServerPayload({...base,main:JSON.parse(values.get(MAIN))},{workspaceId:'w1',version:9,localData:root.LeadIntelWorkspacePersistence.currentWorkspaceData(),dirty:false});
 values.set('leadintel_customer_v2_server_versions',JSON.stringify({w1:9}));finish();await saving;
 assert.equal(root.LeadIntelServerBridge.stateVersion,9);assert.equal(root.LeadIntelWorkspacePersistence.syncedBase('w1').version,9);
 assert.equal(JSON.parse(values.get('leadintel_customer_v2_server_dirty')).base_version,9);
});
test('an actual conflict records the exact competing field and preserves both versions immediately',async()=>{
 let server;const {root,values}=load(async()=>new Response(JSON.stringify({current:server}),{status:409}),{withBridge:true});
 const base=establishBase(root,values);server={version:4,payload:{...base,main:{...base.main,answers:{offer:'Remote offer'}}}};
 values.set(MAIN,JSON.stringify({...base.main,answers:{offer:'New local offer'}}));
 Object.assign(root.LeadIntelServerBridge,{conflict:false,conflictState:null});
 assert.equal((await root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true})).conflict,true);
 assert.deepEqual(Array.from(root.LeadIntelServerBridge.conflictDetails.paths),['main.answers.offer']);
 const recovery=JSON.parse(values.get(RECOVERY));assert.equal(recovery.local.main.answers.offer,'New local offer');assert.equal(recovery.server.payload.main.answers.offer,'Remote offer');
 assert.equal(recovery.conflict.reason,'overlapping_changes');
});
test('409 from concurrent stage navigation retries safely and reloads with remote buyer research intact',async()=>{
 const puts=[];let server;const {root,values,events}=load(async(input,options)=>{
  puts.push(JSON.parse(options.body));return puts.length===1?new Response(JSON.stringify({current:server}),{status:409}):new Response(JSON.stringify({saved:true,version:5}));
 },{withBridge:true});
 const base=establishBase(root,values);base.main.step=4;
 base.meta.discovery={activeJourneyStage:3,visibleStep:4};
 values.set(MAIN,JSON.stringify(base.main));values.set('leadintel_customer_v2_discovery_meta',JSON.stringify(base.meta.discovery));
 root.LeadIntelWorkspacePersistence.snapshotFromServerPayload(base,{workspaceId:'w1',version:3,localData:root.LeadIntelWorkspacePersistence.currentWorkspaceData(),dirty:false});
 values.set(MAIN,JSON.stringify({...base.main,step:6}));values.set('leadintel_customer_v2_discovery_meta',JSON.stringify({activeJourneyStage:6,visibleStep:6}));
 server={version:4,payload:{...base,main:{...base.main,step:5},meta:{discovery:{activeJourneyStage:5,visibleStep:5}},discovery:{people:[{id:'a',name:'Remote researched buyer'}]}}};
 Object.assign(root.LeadIntelServerBridge,{conflict:false,conflictState:null});
 assert.equal((await root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true})).saved,true);
 assert.equal(puts.length,2);assert.equal(puts[1].payload.main.step,6);assert.equal(puts[1].payload.meta.discovery.visibleStep,6);
 assert.equal(puts[1].payload.discovery.people[0].name,'Remote researched buyer');assert.ok(events.includes('reload'));
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);assert.equal(root.LeadIntelServerBridge.conflict,false);
});

test('keep-local resolves only conflicting fields and retains newer server Profile answers and Calendly',async()=>{
 let put;const {root,values,events}=load(async(input,options)=>{if(options.method==='PUT'){put=JSON.parse(options.body);return new Response(JSON.stringify({saved:true,version:10}));}return new Response(JSON.stringify(server));},{withBridge:true});
 const base=establishBase(root,values),server=structuredClone(base);server.main.answers.offer='Remote competing offer';server.main.answers.delivery_approach='Single partner';server.main.answers.meeting_value='Real data';server.outreach.messageStudio={essentials:{calendly:'https://calendly.com/remote/meeting'}};
 const local=JSON.parse(values.get(MAIN));local.answers.offer='Chosen local offer';values.set(MAIN,JSON.stringify(local));
 server.version=9;server.payload=structuredClone(server);delete server.payload.version;delete server.payload.payload;
 assert.equal((await root.LeadIntelServerBridge.resolveConflictKeepLocal()).resolved,true);
 assert.equal(put.payload.main.answers.offer,'Chosen local offer');assert.equal(put.payload.main.answers.meeting_value,'Real data');
 assert.equal(put.payload.outreach.messageStudio.essentials.calendly,'https://calendly.com/remote/meeting');
 assert.ok(events.includes('reload'),'merged storage must replace stale in-memory modules');
});

test('conflict recovery retains edits made while the server refresh is pending',async()=>{
 let finish,put;const {root,values}=load(async(input,options)=>{if(options.method==='PUT'){put=JSON.parse(options.body);return new Response(JSON.stringify({saved:true,version:10}));}return new Promise(resolve=>finish=resolve);},{withBridge:true});
 const base=establishBase(root,values),server={version:9,payload:structuredClone(base)};server.payload.main.answers.offer='Remote offer';
 const resolving=root.LeadIntelServerBridge.resolveConflictKeepLocal();await new Promise(resolve=>setImmediate(resolve));
 values.set(MAIN,JSON.stringify({...base.main,answers:{...base.main.answers,offer:'Latest local edit'}}));
 finish(new Response(JSON.stringify(server)));assert.equal((await resolving).resolved,true);assert.equal(put.payload.main.answers.offer,'Latest local edit');
});

test('conflict resolution locks editing during the merged save and reloads canonical module state',async()=>{
 let finish,put;const {root,values,events}=load(async(input,options)=>{if(options.method==='PUT'){put=JSON.parse(options.body);return new Promise(resolve=>finish=resolve);}return new Response(JSON.stringify(server));},{withBridge:true});
 const editable={inert:false,dataset:{}};root.document.querySelectorAll=()=>[editable];
 const base=establishBase(root,values),server={version:9,payload:structuredClone(base)};server.payload.outreach.messageStudio={essentials:{calendly:'https://calendly.com/legal/consultation'}};
 const resolving=root.LeadIntelServerBridge.resolveConflictKeepLocal();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(editable.inert,true);assert.equal(root.LeadIntelServerBridge.resolvingSync,true);assert.equal(put.payload.outreach.messageStudio.essentials.calendly,'https://calendly.com/legal/consultation');
 finish(new Response(JSON.stringify({saved:true,version:10})));assert.equal((await resolving).resolved,true);assert.ok(events.includes('reload'));assert.equal(editable.inert,false);
});


test('large overlapping research recovery stays below browser quota and preserves every original and latest source',async()=>{
 const Budget=require('../state-budget.js'),text='Exact original research evidence. '.repeat(4000);
 const local={main:{website:'local.example',answers:{offer:'Protected local offer'}},discovery:{rawResults:Array.from({length:30},(_,i)=>({url:`https://buyer${i}.se/news`,text})),selectedProspects:[{domain:'buyer0.se',people:[{name:'Saved Buyer'}]}]},outreach:{messageStudio:{originalScripts:{professional:{body:'Protected original message'}}}},delivery:{},meta:{discovery:{}}};
 const server={version:9,payload:{...local,main:{website:'server.example',answers:{offer:'Protected server offer'}}}};
 const {root,values}=load(async(_,options)=>options?.method==='PUT'?new Response(JSON.stringify({saved:true,version:10})):new Response(JSON.stringify(server)),{withBridge:true,withBudget:true,recoveryLimit:900000});
 for(const [key,value] of Object.entries(local))values.set(`leadintel_customer_v2_${key==='main'?'state':key}`,JSON.stringify(value));
 assert.ok(Buffer.byteLength(JSON.stringify({local,server}))>900000);
 const result=await root.LeadIntelServerBridge.resolveConflictUseServer();assert.equal(result.resolved,true);
 const stored=JSON.parse(values.get(RECOVERY));assert.equal(stored.format,'leadintel-sync-recovery-refs-v1');assert.ok(Buffer.byteLength(values.get(RECOVERY))<900000);
 const recovery=Budget.restoreRecoveryRecord(stored);assert.deepEqual(recovery.local,local);assert.deepEqual(recovery.server,server);assert.deepEqual(recovery.original.local,local);
 assert.equal(recovery.local.outreach.messageStudio.originalScripts.professional.body,'Protected original message');assert.equal(recovery.local.discovery.selectedProspects[0].people[0].name,'Saved Buyer');
});
test('lossless recovery migrates legacy records and rejects mismatched workspace envelopes',()=>{
 const B=require('../state-budget.js'),legacy={workspace_id:'w1',original:{notes:'Legacy evidence '.repeat(10000)}};const record={...legacy,local:legacy.original,server:{notes:legacy.original.notes}};
 const packed=B.packRecoveryRecord(record);assert.deepEqual(B.restoreRecoveryRecord(packed),record);assert.equal(B.restoreRecoveryRecord(legacy),legacy);
 assert.throws(()=>B.restoreRecoveryRecord({...packed,workspace_id:'other'}),/workspace does not match/);
});
