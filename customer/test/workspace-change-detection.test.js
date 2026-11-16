const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const MAIN='leadintel_customer_v2_state',DISCOVERY='leadintel_customer_v2_discovery',OUTREACH='leadintel_customer_v2_outreach',DELIVERY='leadintel_customer_v2_delivery',META='leadintel_customer_v2_discovery_meta',SNAP='leadintel_customer_v2_workspace_saved_snapshot_v1',DIRTY='leadintel_customer_v2_server_dirty';
const source=fs.readFileSync(require.resolve('../workspace-persistence.js'),'utf8');
const copy=value=>JSON.parse(JSON.stringify(value));
function fixture(){return {main:{step:1,website:'https://seller.example/',answers:{offer:'Engineering'},market:{strategyApproved:true}},discovery:{selectedProspects:[{id:'buyer',domain:'buyer.example',people:[{id:'person',publicEmail:'person@buyer.example'}]}]},outreach:{selectedDomain:'buyer.example',items:[{id:'draft',drafts:{emailBody:'Exact retained draft'}}],messageStudio:{mode:'professional',linkedinMode:'professional',defaultTemplates:{email:'professional'}}},delivery:{opportunities:[]},meta:{discovery:{visibleStep:1,activeJourneyStage:1},persistence:{explicit_saved:true}}};}
function runtime({browserOnly=false,noSnapshot=false,realBridge=false}={}){
 const payload=fixture(),data=Object.fromEntries([[MAIN,payload.main],[DISCOVERY,payload.discovery],[OUTREACH,payload.outreach],[DELIVERY,payload.delivery],[META,payload.meta.discovery]].map(([key,value])=>[key,JSON.stringify(value)]));
 const values=new Map(Object.entries(data)),session=new Map(),events=new Map(),dom=new Map(),timers=new Map(),writes=[];let timerId=0,version=7,cloud=copy(payload),putGate=null,failPut=false;
 values.set('leadintel_customer_v2_workspace','w1');values.set('leadintel_customer_v2_workspace_explicit_save_v1','1');values.set('leadintel_customer_v2_server_versions',JSON.stringify({w1:7}));
 if(!noSnapshot)values.set(SNAP,JSON.stringify({schema_version:1,server_synced:!browserOnly,workspace_id:'w1',server_version:7,saved_at:'2026-11-16T10:00:00.000Z',server_payload:payload,data}));
 const storage=map=>({getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)});
 const status={textContent:''},button={dataset:{},disabled:false,addEventListener(){}},bar={dataset:{}};
 const root={console,URL,Request,Response,Date,Promise,TextEncoder,localStorage:storage(values),sessionStorage:storage(session),location:{href:'https://fixture.test/customer/'},
  document:{readyState:'complete',querySelector:selector=>selector==='.workspace-save-bar'?bar:null,getElementById:id=>id==='save-workspace'?button:id==='workspace-save-state'?status:null,addEventListener(name,fn){const list=dom.get(name)||[];list.push(fn);dom.set(name,list);}},
  addEventListener(name,fn){const list=events.get(name)||[];list.push(fn);events.set(name,list);},removeEventListener(){},dispatchEvent(event){for(const fn of events.get(event.type)||[])fn(event);},
  setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),queueMicrotask,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
  async fetch(input,options={}){if(options.method!=='PUT')return Response.json({version,payload:cloud});const body=JSON.parse(options.body);assert.equal(body.version,version);const gate=putGate;putGate=null;if(gate){gate.started();await gate.wait;}if(failPut){failPut=false;return Response.json({error:'Controlled save outage'},{status:503});}cloud=copy(body.payload);writes.push(cloud);return Response.json({saved:true,version:++version});}
 };
 root.LeadIntelServerBridge={ready:true,session:{authenticated:true},workspace:{id:'w1'},stateVersion:7,conflict:false,async saveNow(){const r=await root.fetch('https://fixture.test/api/customer/state?workspace_id=w1',{method:'PUT',leadintelSaveIntent:true,leadintelExplicitSave:true,body:JSON.stringify({version:this.stateVersion,payload:{main:JSON.parse(values.get(MAIN)),discovery:JSON.parse(values.get(DISCOVERY)),outreach:JSON.parse(values.get(OUTREACH)),delivery:JSON.parse(values.get(DELIVERY)),meta:{discovery:JSON.parse(values.get(META))}}})});const result=await r.json();this.stateVersion=result.version;return result;}};
 root.window=root;root.globalThis=root;vm.createContext(root);vm.runInContext(fs.readFileSync(require.resolve('../workspace-sync.js'),'utf8'),root);vm.runInContext(source,root);
 if(realBridge){delete root.LeadIntelServerBridge;root.document.readyState='loading';vm.runInContext(fs.readFileSync(require.resolve('../server-bridge.js'),'utf8'),root);root.document.readyState='complete';Object.assign(root.LeadIntelServerBridge,{ready:true,session:{authenticated:true},workspace:{id:'w1'},stateVersion:7,conflict:false});}
 const api=root.LeadIntelWorkspacePersistence;
 return {root,api,values,writes,status,button,bar,read:key=>JSON.parse(values.get(key)),edit(key,change){const next=JSON.parse(values.get(key));change(next);values.set(key,JSON.stringify(next));},event(name){root.dispatchEvent(new root.CustomEvent(name));},ui(name){const target={closest:selector=>selector==='.workspace'?{}:null};for(const fn of dom.get(name)||[])fn({target});},async settle(){for(const [id,item]of [...timers])if(item.ms===0){timers.delete(id);item.fn();}await new Promise(resolve=>setImmediate(resolve));},async debounce(){for(const [id,item]of [...timers])if(item.ms===2200){timers.delete(id);item.fn();}await new Promise(resolve=>setImmediate(resolve));},holdSave(){let started,release;const began=new Promise(r=>started=r),wait=new Promise(r=>release=r);putGate={started,wait};return {began,release};},failNextSave(){failPut=true;},cloud:()=>cloud};
}

test('a spurious workspace dirty event never uploads an unchanged acknowledged workspace',async()=>{
 const r=runtime();r.event('leadintel:workspace-dirty');await r.settle();await r.debounce();
 assert.equal(r.writes.length,0);assert.equal(r.api.hasUnsavedChanges(),false);assert.equal(r.values.has(DIRTY),false);assert.match(r.status.textContent,/Saved automatically/);
});
test('an unchanged workspace UI input or selection does not start a save',async()=>{
 const r=runtime();r.ui('input');r.ui('change');await r.settle();await r.debounce();
 assert.equal(r.writes.length,0);assert.equal(r.api.hasUnsavedChanges(),false);assert.match(r.status.textContent,/Saved automatically/);
});
test('stage and viewed-message navigation stays local without a cloud write',async()=>{
 const r=runtime();r.edit(MAIN,x=>x.step=7);r.edit(META,x=>{x.visibleStep=7;x.activeJourneyStage=7;});r.edit(OUTREACH,x=>{x.selectedDomain='other.example';x.messageStudio.mode='friendly';x.messageStudio.linkedinMode='curiosity';});
 r.event('leadintel:workspace-dirty');await r.settle();await r.debounce();
 assert.equal(r.writes.length,0);assert.equal(r.api.hasUnsavedChanges(),false);assert.equal(r.read(MAIN).step,7);assert.equal(r.read(OUTREACH).selectedDomain,'other.example');assert.equal(r.read(OUTREACH).items[0].drafts.emailBody,'Exact retained draft');
});
test('Save now on an unchanged acknowledged workspace keeps its revision and snapshot',async()=>{
 const r=runtime(),snapshot=r.values.get(SNAP);assert.equal(await r.api.saveWorkspace(),true);
 assert.equal(r.writes.length,0);assert.equal(r.root.LeadIntelServerBridge.stateVersion,7);assert.equal(r.values.get(SNAP),snapshot);assert.match(r.status.textContent,/Saved automatically/);
});
test('the capturing input listener observes the genuine edit made by the later input handler',async()=>{
 const r=runtime();r.ui('input');r.edit(MAIN,x=>x.answers.offer='Updated engineering offer');await r.settle();await r.debounce();
 assert.equal(r.writes.length,1);assert.equal(r.cloud().main.answers.offer,'Updated engineering offer');assert.equal(r.cloud().outreach.items[0].drafts.emailBody,'Exact retained draft');assert.equal(r.api.hasUnsavedChanges(),false);
});
test('an edit reverted before autosave does not create a redundant revision',async()=>{
 const r=runtime();r.edit(MAIN,x=>x.answers.offer='Temporary');r.event('leadintel:workspace-dirty');r.edit(MAIN,x=>x.answers.offer='Engineering');r.event('leadintel:workspace-dirty');await r.settle();await r.debounce();
 assert.equal(r.writes.length,0);assert.equal(r.api.hasUnsavedChanges(),false);assert.equal(r.values.has(DIRTY),false);
});
test('a real draft or saved default change still requires and completes a save',async()=>{
 for(const edit of [x=>x.items[0].drafts.emailBody='Exact changed draft',x=>x.messageStudio.defaultTemplates.email='friendly']){const r=runtime();r.edit(OUTREACH,edit);r.event('leadintel:workspace-dirty');await r.settle();assert.equal(r.api.hasUnsavedChanges(),true);await r.debounce();assert.equal(r.writes.length,1);assert.equal(r.api.hasUnsavedChanges(),false);assert.deepEqual(r.cloud().discovery.selectedProspects[0].people,[{id:'person',publicEmail:'person@buyer.example'}]);}
});
test('browser-only or never-acknowledged data must still reach the cloud even when unchanged',async()=>{
 for(const options of [{browserOnly:true},{noSnapshot:true}]){const r=runtime(options);assert.equal(await r.api.saveWorkspace(),true);assert.equal(r.writes.length,1);assert.equal(r.root.LeadIntelServerBridge.stateVersion,8);assert.match(r.status.textContent,/Saved automatically/);}
});
test('navigation during a real save does not queue another identical upload',async()=>{
 const r=runtime();r.edit(MAIN,x=>x.answers.offer='Real saved edit');const gate=r.holdSave(),saving=r.api.saveWorkspace();await gate.began;
 r.edit(MAIN,x=>x.step=7);r.event('leadintel:workspace-dirty');gate.release();assert.equal(await saving,true);await r.debounce();
 assert.equal(r.writes.length,1);assert.equal(r.cloud().main.answers.offer,'Real saved edit');assert.equal(r.read(MAIN).step,7);assert.equal(r.api.hasUnsavedChanges(),false);
});
test('a genuine edit made during a save remains dirty and is included in the next acknowledgement',async()=>{
 const r=runtime();r.edit(MAIN,x=>x.answers.offer='First edit');const gate=r.holdSave(),saving=r.api.saveWorkspace();await gate.began;
 r.edit(OUTREACH,x=>x.items[0].drafts.emailBody='A later exact draft');r.event('leadintel:workspace-dirty');gate.release();assert.equal(await saving,true);assert.equal(r.api.hasUnsavedChanges(),true);await r.debounce();
 assert.equal(r.writes.length,2);assert.equal(r.cloud().outreach.items[0].drafts.emailBody,'A later exact draft');assert.equal(r.api.hasUnsavedChanges(),false);
});
test('a pending write acknowledgement cannot be bypassed by an unchanged-save shortcut',async()=>{
 const r=runtime();r.values.set('leadintel_customer_v2_workspace_write_ack_v1',JSON.stringify({schema_version:1,workspace_id:'w1',version:8,payload_hash:'a'.repeat(64)}));
 assert.equal(await r.api.saveWorkspace(),true);assert.equal(r.writes.length,1);
});
test('a stale or foreign dirty lineage cannot reuse a previous save acknowledgement',async()=>{
 for(const marker of [{workspace_id:'w1',base_version:6},{workspace_id:'other-workspace',base_version:7}]){const r=runtime();r.values.set(DIRTY,JSON.stringify(marker));assert.equal(await r.api.saveWorkspace(),true);assert.equal(r.writes.length,1);}
});
test('explicit conflict resolution cannot be skipped as an unchanged save',async()=>{
 const r=runtime();r.root.LeadIntelServerBridge.resolvingSync=true;assert.equal(await r.api.saveWorkspace(),true);assert.equal(r.writes.length,1);
});
test('a deferred UI edit cannot mark or save a different account or workspace',async()=>{
 for(const change of [r=>r.values.set('leadintel_account_context_v1','another-account'),r=>r.root.LeadIntelServerBridge.workspace={id:'other-workspace'}]){const r=runtime(),snapshot=r.values.get(SNAP);r.ui('input');r.edit(MAIN,x=>x.answers.offer='Old-owner input');change(r);await r.settle();await r.debounce();assert.equal(r.writes.length,0);assert.equal(r.values.has(DIRTY),false);assert.equal(r.values.get(SNAP),snapshot);}
});
test('reverting during a slow direct bridge save remains pending and is saved after its acknowledgement',async()=>{
 const r=runtime({realBridge:true});r.edit(MAIN,x=>x.answers.offer='Intermediate edit');const gate=r.holdSave(),saving=r.root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true});await gate.began;
 try{r.edit(MAIN,x=>x.answers.offer='Engineering');r.event('leadintel:workspace-dirty');await r.settle();await r.debounce();assert.equal(r.api.reuseAcknowledgedSave(),false,'the old baseline cannot stand in for an active write');assert.match(r.status.textContent,/Saving/);}finally{gate.release();}
 assert.equal((await saving).saved,true);assert.equal(r.api.hasUnsavedChanges(),true);await r.debounce();
 assert.equal(r.writes.length,2);assert.equal(r.cloud().main.answers.offer,'Engineering');assert.equal(r.api.hasUnsavedChanges(),false);assert.match(r.status.textContent,/Saved automatically/);
});
test('navigation during a direct bridge write does not leave the save indicator or dirty marker pending',async()=>{
 const r=runtime({realBridge:true});r.edit(MAIN,x=>x.answers.offer='Actual edit');const gate=r.holdSave(),saving=r.root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true});await gate.began;
 r.edit(MAIN,x=>x.step=7);r.event('leadintel:workspace-dirty');gate.release();assert.equal((await saving).saved,true);await r.debounce();
 assert.equal(r.writes.length,1);assert.equal(r.root.LeadIntelServerBridge.status,'synced');assert.equal(r.values.has(DIRTY),false);assert.equal(r.api.hasUnsavedChanges(),false);assert.match(r.status.textContent,/Saved automatically/);
});
test('direct writes immediately show pending state and a concurrent toolbar save joins their acknowledgement',async()=>{
 const r=runtime({realBridge:true});r.edit(MAIN,x=>x.answers.offer='Direct edit');const gate=r.holdSave(),direct=r.root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true});await gate.began;
 let joined;try{assert.match(r.status.textContent,/Saving/);assert.equal(r.button.disabled,true);joined=r.api.saveWorkspace();}finally{gate.release();}
 assert.equal((await direct).saved,true);assert.equal(await joined,true);assert.equal(r.writes.length,1);assert.match(r.status.textContent,/Saved automatically/);
});
test('two controller requests share a pending save instead of returning an unsuccessful second result',async()=>{
 const r=runtime();r.edit(MAIN,x=>x.answers.offer='One real edit');const gate=r.holdSave(),first=r.api.saveWorkspace();await gate.began;const second=r.api.saveWorkspace();gate.release();
 assert.deepEqual(await Promise.all([first,second]),[true,true]);assert.equal(r.writes.length,1);
});
test('a second controller request waits for its newer edit to be acknowledged',async()=>{
 const r=runtime();r.edit(MAIN,x=>x.answers.offer='First edit');const gate=r.holdSave(),first=r.api.saveWorkspace();await gate.began;r.edit(OUTREACH,x=>x.items[0].drafts.emailBody='Newer requested draft');const second=r.api.saveWorkspace();gate.release();
 assert.deepEqual(await Promise.all([first,second]),[true,true]);assert.equal(r.writes.length,2);assert.equal(r.cloud().outreach.items[0].drafts.emailBody,'Newer requested draft');assert.equal(r.api.hasUnsavedChanges(),false);
});
test('a failed direct write cannot expose the reverted older snapshot as a completed save',async()=>{
 const r=runtime({realBridge:true});r.edit(MAIN,x=>x.answers.offer='Intermediate edit');const gate=r.holdSave(),saving=r.root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true});await gate.began;r.edit(MAIN,x=>x.answers.offer='Engineering');r.event('leadintel:workspace-dirty');r.failNextSave();gate.release();
 await assert.rejects(saving);assert.match(r.status.textContent,/Sync failed/);assert.equal(r.api.reuseAcknowledgedSave(),false);assert.equal(await r.api.saveWorkspace(),true);assert.equal(r.cloud().main.answers.offer,'Engineering');assert.match(r.status.textContent,/Saved automatically/);
});
test('an acknowledgement overtaken during synchronous snapshot publication returns the newer owner without marking it dirty',()=>{
 const r=runtime(),incoming=fixture();incoming.main.answers.offer='Older incoming acknowledgement';const incomingData={...r.api.currentWorkspaceData(),[MAIN]:JSON.stringify(incoming.main)},newer=fixture();newer.main.answers.offer='Newer shared acknowledgement';const newerData={...r.api.currentWorkspaceData(),[MAIN]:JSON.stringify(newer.main)};
 const get=r.root.localStorage.getItem;let reads=0;r.root.localStorage.getItem=key=>{if(key===SNAP&&++reads===3){r.values.set(MAIN,newerData[MAIN]);r.values.set(SNAP,JSON.stringify({schema_version:1,server_synced:true,workspace_id:'w1',server_version:9,saved_at:'2026-11-16T11:00:00.000Z',server_payload:newer,data:newerData}));}return get(key);};
 const result=r.api.snapshotFromServerPayload(incoming,{workspaceId:'w1',version:8,localData:incomingData});assert.equal(result.server_version,9);assert.equal(r.api.syncedBase('w1').version,9);assert.equal(r.read(MAIN).answers.offer,'Newer shared acknowledgement');assert.equal(r.api.hasUnsavedChanges(),false);
});
