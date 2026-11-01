const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const budget=require('../state-budget.js');
const persistenceSource=fs.readFileSync(require.resolve('../workspace-persistence.js'),'utf8');
const KEYS={main:'leadintel_customer_v2_state',discovery:'leadintel_customer_v2_discovery',outreach:'leadintel_customer_v2_outreach',delivery:'leadintel_customer_v2_delivery',meta:'leadintel_customer_v2_discovery_meta'};
function load(values,nativeFetch,{snapshotLimit=Infinity}={}){
 const timers=new Map();let timer=0;
 const root={console,URL,Request,Response,Date,Promise,LeadIntelStateBudget:budget,LeadIntelServerBridge:{workspaceStateCodec:'workspace-sections-v1',session:{authenticated:true},workspace:{id:'w1'}},localStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>{if(key==='leadintel_customer_v2_workspace_saved_snapshot_v1'&&String(value).length>snapshotLimit)throw Object.assign(new Error('Storage quota exceeded'),{name:'QuotaExceededError'});values.set(key,String(value));},removeItem:key=>values.delete(key)},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},location:{href:'https://leadintel.ccgroup.lv/customer/'},fetch:nativeFetch,document:{readyState:'loading',querySelector:()=>null,getElementById:()=>null,addEventListener(){}},addEventListener(){},removeEventListener(){},setTimeout(fn){const id=++timer;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}};
 root.globalThis=root;vm.runInNewContext(persistenceSource,root);return root;
}
function localValues(payload){return new Map(Object.entries(KEYS).map(([key,storageKey])=>[storageKey,JSON.stringify(key==='meta'?payload.meta.discovery:payload[key]||{})]));}
const endpoint='https://leadintel-api.edgars-7e7.workers.dev/api/customer/state?workspace_id=w1';

test('large recovery packing leaves the page thread free and preserves exact saved data',async()=>{
 const payload={main:{website:'seller.example'},discovery:{notes:'Exact published evidence. '.repeat(5000)},outreach:{items:[{id:'draft',body:'Exact approved text'}]},delivery:{},meta:{discovery:{}}};
 const values=localValues(payload),root=load(values,async()=>new Response('{}'));const jobs=[];
 root.Worker=class{
  postMessage(job){jobs.push(job);setImmediate(()=>this.onmessage({data:{id:job.id,result:budget[job.operation](job.value,job.options)}}));}
  terminate(){}
 };
 root.LeadIntelStateBudget={...budget,packWorkspaceSnapshot(){throw new Error('Packing blocked the page thread');}};
 const saving=root.LeadIntelWorkspacePersistence.snapshotFromServerPayload(payload,{workspaceId:'w1',version:8,localData:root.LeadIntelWorkspacePersistence.currentWorkspaceData(),dirty:false});
 assert.equal(jobs.length,1,'large snapshot packing must be delegated before blocking the page');
 assert.equal(typeof saving?.then,'function');await saving;
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
 assert.deepEqual(JSON.parse(JSON.stringify(root.LeadIntelWorkspacePersistence.syncedBase('w1').payload)),payload);
});

for(const compression of [false,true,'shared'])test(`${compression?'text compression':'bundle sharing'} survives real explicit Save and fresh-browser hydration`,async()=>{
 const payload=require(compression==='shared'?'./helpers/workspace-shared-compression.js':compression?'./helpers/workspace-distinct-capacity.js':'./helpers/workspace-capacity.js')(),values=localValues(payload);let wire;
 const root=load(values,async(input,options)=>{wire=JSON.parse(options.body).payload;return new Response(JSON.stringify({saved:true,version:8}));});
 root.LeadIntelServerBridge.workspaceBundleCodec='workspace-bundle-v1';if(compression)root.LeadIntelServerBridge.workspaceCompressionCodec='workspace-lzw-v2';
 await root.fetch(endpoint,{method:'PUT',body:JSON.stringify({version:7,payload}),leadintelSaveIntent:true,leadintelExplicitSave:true});
 assert.equal(wire.main.format,'leadintel-workspace-bundle-refs-v1');if(compression)assert.equal(wire.main.encoding,'lzw16-refs-base64-v2');assert.ok(budget.bytes(wire)<=budget.MAX_SYNC_BYTES);assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
 assert.deepEqual(JSON.parse(JSON.stringify(root.LeadIntelWorkspacePersistence.syncedBase('w1').payload)),payload);
 const freshValues=new Map(),fresh=load(freshValues,async()=>new Response(JSON.stringify({version:8,payload:wire})));await fresh.fetch(endpoint,{method:'GET'});fresh.LeadIntelWorkspacePersistence.prepareForLoad();
 for(const key of ['main','discovery','outreach','delivery'])assert.deepEqual(JSON.parse(freshValues.get(KEYS[key])),payload[key]);
 assert.deepEqual(JSON.parse(freshValues.get(KEYS.meta)),payload.meta.discovery);
});

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
 const values=localValues(payload);let finish,started;const sending=new Promise(resolve=>started=resolve);
 const root=load(values,()=>new Promise(resolve=>{finish=()=>resolve(new Response(JSON.stringify({saved:true,version:8}),{status:200}));started();}));
 const saving=root.fetch(endpoint,{method:'PUT',body:JSON.stringify({schema_version:1,version:7,payload}),leadintelSaveIntent:true,leadintelExplicitSave:true});
 await sending;
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
 assert.equal(saved.payload.discovery.format,'leadintel-discovery-refs-v2');assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
 values.set('leadintel_customer_v2_server_versions',JSON.stringify({w1:8}));await root.fetch(endpoint,{method:'GET'});assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
 assert.deepEqual(budget.restoreFromSync(saved.payload).discovery,payload.discovery);
});

test('cloud baseline remains the acknowledged compact payload while browser baseline keeps full evidence',async()=>{
 const payload={main:{website:'seller.example'},discovery:{rawResults:[{url:'https://buyer.example/news',text:'Evidence '.repeat(90000)}],selectedProspects:[{domain:'buyer.example',people:[{id:'a',name:'Anna Buyer'}]}]},outreach:{},delivery:{},meta:{discovery:{}}};
 const values=localValues(payload);let wire;
 const root=load(values,async(input,options)=>{wire=JSON.parse(options.body).payload;return new Response(JSON.stringify({version:8,payload:wire}));});
 await root.fetch(endpoint,{method:'PUT',body:JSON.stringify({version:7,payload}),leadintelSaveIntent:true,leadintelExplicitSave:true});
 const base=root.LeadIntelWorkspacePersistence.syncedBase('w1');
 assert.deepEqual(JSON.parse(JSON.stringify(base.payload.discovery)),budget.restoreFromSync(wire).discovery);
 assert.equal(base.localPayload.discovery.rawResults[0].text.length,810000);
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
});

test('a late older response cannot replace a newer acknowledged cloud baseline',async()=>{
 const payload={main:{website:'seller.example'},discovery:{},outreach:{},delivery:{},meta:{discovery:{}}},values=localValues(payload),root=load(values,async()=>new Response('{}'));
 root.LeadIntelWorkspacePersistence.snapshotFromServerPayload({...payload,main:{website:'newer.example'}},{workspaceId:'w1',version:9});
 root.LeadIntelWorkspacePersistence.snapshotFromServerPayload(payload,{workspaceId:'w1',version:8});
 const base=root.LeadIntelWorkspacePersistence.syncedBase('w1');assert.equal(base.version,9);assert.equal(base.payload.main.website,'newer.example');
});

test('profile and approved messages round-trip through the real persistence boundary with a clean cloud baseline',async()=>{
 const report={summary:'Commercial evidence '.repeat(1800)};const message={body:'Approved paragraph '.repeat(1500),approved:true};
 const payload={main:{website:'https://seller.example',market:{researchReports:Array.from({length:15},(_,i)=>({...report,id:'r'+i}))}},discovery:{selectedProspects:[{domain:'buyer.example',people:[{id:'p1',name:'Buyer One'}]}]},outreach:{items:Array.from({length:12},(_,i)=>({...message,id:'m'+i})),messageStudio:{originalScripts:{professional:{body:'Protected master'}}}},delivery:{},meta:{discovery:{scriptBuyer:{personId:'p1'}}}};
 let wire;const values=localValues(payload),root=load(values,async(input,options)=>{if(options.method==='PUT'){wire=JSON.parse(options.body).payload;return new Response(JSON.stringify({saved:true,version:8}));}return new Response(JSON.stringify({version:8,payload:wire}));});
 await root.fetch(endpoint,{method:'PUT',body:JSON.stringify({version:7,payload}),leadintelSaveIntent:true,leadintelExplicitSave:true});
 assert.ok(budget.bytes(wire)<=budget.MAX_SYNC_BYTES);assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
 const base=root.LeadIntelWorkspacePersistence.syncedBase('w1');assert.deepEqual(JSON.parse(JSON.stringify(base.payload.main)),payload.main);assert.deepEqual(JSON.parse(JSON.stringify(base.payload.outreach)),payload.outreach);
 const freshValues=new Map(),fresh=load(freshValues,async()=>new Response(JSON.stringify({version:8,payload:wire})));await fresh.fetch(endpoint,{method:'GET'});fresh.LeadIntelWorkspacePersistence.prepareForLoad();
 assert.deepEqual(JSON.parse(freshValues.get(KEYS.main)),payload.main);assert.deepEqual(JSON.parse(freshValues.get(KEYS.outreach)),payload.outreach);
});

for(const seller of ['Metal Works','Legal Partners'])test(`quota-limited snapshot hydration retains exact ${seller} research and messages`,async()=>{
 const payload={main:{website:'seller.example',profile:{companyName:seller}},discovery:{rawResults:[{url:'https://buyer.example/news',text:'Verified project evidence. '.repeat(35000)}]},outreach:{items:[{selectedPersonId:'buyer-1',channel:'email',drafts:{emailBody:'Exact saved copy — '+seller}}]},delivery:{},meta:{discovery:{}}};
 const values=new Map(),root=load(values,async()=>new Response(JSON.stringify({version:8,payload})),{snapshotLimit:128*1024});
 const response=await root.fetch(endpoint,{method:'GET'});assert.equal(response.status,200);
 assert.ok(values.get('leadintel_customer_v2_workspace_saved_snapshot_v1').length<128*1024);
 assert.deepEqual(JSON.parse(JSON.stringify(root.LeadIntelWorkspacePersistence.syncedBase('w1').payload)),payload);
 assert.equal(root.LeadIntelWorkspacePersistence.prepareForLoad(),true);
 assert.equal(JSON.parse(values.get(KEYS.discovery)).rawResults[0].text,payload.discovery.rawResults[0].text);
 assert.equal(JSON.parse(values.get(KEYS.outreach)).items[0].drafts.emailBody,payload.outreach.items[0].drafts.emailBody);
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
 const reopened=load(values,async()=>new Response('{}'),{snapshotLimit:128*1024});
 assert.deepEqual(JSON.parse(JSON.stringify(reopened.LeadIntelWorkspacePersistence.syncedBase('w1').payload)),payload);
 values.set(KEYS.outreach,JSON.stringify({...payload.outreach,items:[]}));assert.equal(reopened.LeadIntelWorkspacePersistence.hasUnsavedChanges(),true);
});

test('local-only recovery snapshots compress without losing full unsynced working text',()=>{
 const payload={main:{website:'seller.example'},discovery:{notes:'Saved notes. '.repeat(90000)},outreach:{items:[{drafts:{emailBody:'Unsynced text'}}]},delivery:{},meta:{discovery:{}}};
 const values=localValues(payload),root=load(values,async()=>new Response('{}'),{snapshotLimit:128*1024});
 root.LeadIntelWorkspacePersistence.captureWorkspaceSnapshot();root.LeadIntelWorkspacePersistence.markExplicitlySaved();
 const saved=values.get('leadintel_customer_v2_workspace_saved_snapshot_v1');assert.ok(saved.length<128*1024);
 values.delete(KEYS.discovery);values.delete(KEYS.outreach);root.LeadIntelWorkspacePersistence.restoreSavedSnapshot();
 assert.equal(JSON.parse(values.get(KEYS.discovery)).notes,payload.discovery.notes);assert.equal(JSON.parse(values.get(KEYS.outreach)).items[0].drafts.emailBody,'Unsynced text');
 assert.equal(root.LeadIntelWorkspacePersistence.syncedBase('w1'),null);
});

test('an edit during a delayed durable snapshot commit stays unsaved and does not replace its acknowledged baseline',async()=>{
 const payload={main:{website:'seller.example',notes:'Verified notes. '.repeat(18000)},discovery:{},outreach:{},delivery:{},meta:{discovery:{}}};
 const values=localValues(payload),root=load(values,async()=>new Response('{}'),{snapshotLimit:1024});let release;
 root.LeadIntelAccountCache={saveRecoverySnapshot:()=>new Promise(resolve=>release=resolve)};
 const saving=root.LeadIntelWorkspacePersistence.snapshotFromServerPayload(payload,{workspaceId:'w1',version:8,localData:root.LeadIntelWorkspacePersistence.currentWorkspaceData(),dirty:false});
 assert.equal(typeof release,'function');values.set(KEYS.main,JSON.stringify({...payload.main,website:'edited.example'}));release('leadintel_workspace_snapshot_v1:w1:test');await saving;
 assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),true);
 assert.equal(root.LeadIntelWorkspacePersistence.syncedBase('w1').payload.main.website,'seller.example');assert.equal(JSON.parse(values.get(KEYS.main)).website,'edited.example');
});

test('the real worker saves and reopens a large research workspace without page-thread encoding',async()=>{
 const {Worker}=require('node:worker_threads'),workers=[];
 const payload={main:{website:'seller.example'},discovery:{notes:'Published project evidence. '.repeat(65000)},outreach:{items:[{id:'m1',drafts:{emailBody:'Exact saved wording — tērauds'}}]},delivery:{},meta:{discovery:{}}};
 const values=localValues(payload);let wire;
 const root=load(values,async(input,options)=>{wire=JSON.parse(options.body).payload;return Response.json({saved:true,version:8});});
 root.LeadIntelServerBridge.workspaceCompressionCodec='workspace-lzw-v2';
 root.Worker=class{
  constructor(url){
   assert.match(String(url),/\/customer\/workspace-codec-worker\.js\?v=20261020-v1&research-storage=20261101-v1$/);
   this.thread=new Worker(`const {parentPort,workerData}=require('node:worker_threads');global.self=global;global.importScripts=()=>{self.LeadIntelStateBudget=require(workerData.codec);};self.postMessage=data=>parentPort.postMessage(data);require(workerData.worker);parentPort.on('message',data=>self.onmessage({data}));`,{eval:true,workerData:{codec:require.resolve('../state-budget.js'),worker:require.resolve('../workspace-codec-worker.js')}});
   workers.push(this.thread);this.thread.on('message',data=>this.onmessage?.({data}));this.thread.on('error',error=>this.onerror?.(error));
  }
  postMessage(job){this.thread.postMessage(job);}
  terminate(){this.thread.terminate();}
 };
 root.LeadIntelStateBudget={...budget,prepareForSync(){throw new Error('Transfer packing blocked the page');},packWorkspaceSnapshot(){throw new Error('Snapshot packing blocked the page');}};
 try{
  await root.fetch(endpoint,{method:'PUT',body:JSON.stringify({version:7,payload}),leadintelSaveIntent:true,leadintelExplicitSave:true});
  assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);assert.deepEqual(budget.restoreFromSync(wire).discovery,payload.discovery);
  const freshValues=new Map(),fresh=load(freshValues,async()=>Response.json({version:8,payload:wire}));await fresh.fetch(endpoint);fresh.LeadIntelWorkspacePersistence.prepareForLoad();
  assert.equal(freshValues.get(KEYS.discovery),values.get(KEYS.discovery));assert.equal(freshValues.get(KEYS.outreach),values.get(KEYS.outreach));
 }finally{await Promise.all(workers.map(worker=>worker.terminate()));}
});

test('an encoding timeout preserves the acknowledged baseline and a later retry can save',async()=>{
 const payload={main:{website:'seller.example'},discovery:{notes:'Source evidence. '.repeat(6000)},outreach:{},delivery:{},meta:{discovery:{}}};
 const values=localValues(payload),root=load(values,async()=>Response.json({saved:true,version:9}));
 await root.LeadIntelWorkspacePersistence.snapshotFromServerPayload(payload,{workspaceId:'w1',version:8,localData:root.LeadIntelWorkspacePersistence.currentWorkspaceData(),dirty:false});
 const stored=values.get('leadintel_customer_v2_workspace_saved_snapshot_v1');values.set(KEYS.main,JSON.stringify({website:'edited.example'}));
 let expire,terminated=false;const schedule=root.setTimeout;root.setTimeout=(fn,ms)=>{if(ms===30000)expire=fn;return schedule(fn,ms);};
 root.Worker=class{postMessage(){}terminate(){terminated=true;}};
 const saving=root.LeadIntelWorkspacePersistence.prepareSyncPayload(payload);expire();await assert.rejects(saving,/encoding timed out/);
 assert.equal(terminated,true);assert.equal(values.get('leadintel_customer_v2_workspace_saved_snapshot_v1'),stored);assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),true);
 root.Worker=undefined;
 await root.fetch(endpoint,{method:'PUT',body:JSON.stringify({version:8,payload:{...payload,main:{website:'edited.example'}}}),leadintelSaveIntent:true,leadintelExplicitSave:true});
 assert.equal(root.LeadIntelWorkspacePersistence.syncedBase('w1').version,9);assert.equal(root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
});

test('a background snapshot cannot install the previous workspace baseline after a workspace switch',async()=>{
 const payload={main:{website:'seller.example'},discovery:{notes:'Retained evidence. '.repeat(5000)},outreach:{},delivery:{},meta:{discovery:{}}};
 const values=localValues(payload),root=load(values,async()=>Response.json({}));let release;
 root.Worker=class{postMessage(job){release=()=>this.onmessage({data:{id:job.id,result:budget[job.operation](job.value,job.options)}});}terminate(){}};
 const saving=root.LeadIntelWorkspacePersistence.snapshotFromServerPayload(payload,{workspaceId:'w1',version:8});
 root.LeadIntelServerBridge.workspace={id:'w2'};values.set(KEYS.main,JSON.stringify({website:'other-seller.example'}));release();
 await assert.rejects(saving,/workspace changed/i);assert.equal(values.has('leadintel_customer_v2_workspace_saved_snapshot_v1'),false);assert.equal(JSON.parse(values.get(KEYS.main)).website,'other-seller.example');
});
