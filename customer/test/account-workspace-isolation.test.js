const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const MAIN='leadintel_customer_v2_state',WS='leadintel_customer_v2_workspace',SNAP='leadintel_customer_v2_workspace_saved_snapshot_v1';
const modulePath=require.resolve('../server-bridge.js').replace('server-bridge.js','account-cache.js');
function load(values=new Map(),{account='b',workspace='wb',search='',failArchive=false,fetchImpl}={}){
 const session=new Map(),events=[],timers=new Map(),attrs=new Map();let timer=0;
 class Storage{constructor(map){this.values=map;}get length(){return this.values.size;}key(i){return [...this.values.keys()][i]??null;}getItem(k){return this.values.get(String(k))??null;}setItem(k,v){if(failArchive&&String(k).startsWith('leadintel_account_cache_v1:'))throw Error('Quota exceeded');this.values.set(String(k),String(v));}removeItem(k){this.values.delete(String(k));}clear(){this.values.clear();}}
 Storage.prototype.__leadintelServerPatched=true;
 const storage=new Storage(values),sessionStorage=new Storage(session),requests=[],listeners=new Map();
 const root={console,URL,URLSearchParams,Request,Response,Headers,FormData,Blob,Date,Promise,Math,Storage,localStorage:storage,sessionStorage,location:{href:'https://leadintel.ccgroup.lv/customer/'+search,search,origin:'https://leadintel.ccgroup.lv',reload(){events.push('reload');}},document:{readyState:'loading',documentElement:{setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},head:{appendChild(){}},createElement:()=>({dataset:{},textContent:''}),getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(){}},addEventListener(name,fn){listeners.set(name,fn);},dispatchEvent:e=>events.push(e.type),setTimeout(fn,ms){if(ms===350||ms===700)queueMicrotask(fn);else timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),CustomEvent:class{constructor(type){this.type=type;}},fetch:async(input,options={})=>{const url=new URL(input);requests.push({url:url.pathname,options});if(fetchImpl)return fetchImpl(input,options);if(url.pathname==='/api/session')return new Response(JSON.stringify({authenticated:true,user:{id:account,email:account+'@example.com'}}));if(url.pathname==='/api/workspaces')return new Response(JSON.stringify({workspaces:[{id:workspace,name:workspace,role:'owner'}]}));if(url.pathname==='/api/customer/state')return new Response(JSON.stringify({version:workspace==='wa'?3:0,payload:workspace==='wa'?{main:{website:'https://ccgroup.lv',answers:{offer:'CCGROUP private offer'}}}:{}}));return new Response('{}');}};
 root.window=root;root.globalThis=root;
 if(fs.existsSync(modulePath))vm.runInNewContext(fs.readFileSync(modulePath,'utf8'),root);
 vm.runInNewContext(fs.readFileSync(require.resolve('../workspace-sync.js'),'utf8'),root);
 vm.runInNewContext(fs.readFileSync(require.resolve('../workspace-persistence.js'),'utf8'),root);
 vm.runInNewContext(fs.readFileSync(require.resolve('../server-bridge.js'),'utf8').replace('root.LeadIntelServerBridge=bridge;','root.__init=init;root.LeadIntelServerBridge=bridge;'),root);
 return {root,storage,values,session,events,attrs,requests,listeners};
}
function seed(){const main=JSON.stringify({website:'https://ccgroup.lv',answers:{offer:'CCGROUP private offer'}});return new Map([[WS,'wa'],[MAIN,main],['leadintel_customer_v2_workspace_explicit_save_v1','1'],[SNAP,JSON.stringify({server_synced:true,workspace_id:'wa',server_version:3,data:{[MAIN]:main}})],['leadintel_customer_v2_legacy_local_cleanup_20260901_v2','done'],['leadintel_customer_v2_website_activation_v1','CCGROUP activation'],['leadintel_customer_v2_research_meta_v1','CCGROUP research'],['leadintel_customer_v2_background_tasks_v1','CCGROUP tasks']]);}
test('a second account with an empty server workspace never inherits the first saved profile or snapshot',async()=>{
 const runtime=load(seed());await runtime.root.__init();assert.equal(runtime.values.has(MAIN),false);assert.equal(runtime.values.has(SNAP),false);assert.equal(runtime.values.has('leadintel_customer_v2_website_activation_v1'),false);assert.equal(runtime.values.has('leadintel_customer_v2_research_meta_v1'),false);assert.equal(runtime.values.has('leadintel_customer_v2_background_tasks_v1'),false);assert.equal(runtime.requests.some(x=>x.options.method==='PUT'),false);
});
test('sign-out preserves an unsynced profile and recovery snapshot without displaying either to the next account',async()=>{
 const runtime=load(seed(),{account:'a',workspace:'wa'});await runtime.root.__init();runtime.storage.setItem(MAIN,JSON.stringify({website:'ccgroup.lv',answers:{offer:'Unsynced CCGROUP edit'}}));runtime.storage.setItem('leadintel_customer_v2_server_dirty',JSON.stringify({workspace_id:'wa',base_version:3}));await runtime.root.LeadIntelServerBridge.signOut();assert.equal(runtime.values.has(MAIN),false);assert.equal(runtime.values.has(SNAP),false);
 const next=load(runtime.values,{account:'b',workspace:'wb'});await next.root.__init();assert.equal(next.values.has(MAIN),false);
 const back=load(next.values,{account:'a',workspace:'wa'});await back.root.__init();assert.equal(JSON.parse(back.values.get(MAIN)).answers.offer,'Unsynced CCGROUP edit');assert.equal(JSON.parse(back.values.get(SNAP)).workspace_id,'wa');assert.equal(JSON.parse(back.values.get('leadintel_customer_v2_server_dirty')).workspace_id,'wa');
});
test('a different login callback detaches previous data before application modules load and never trusts URL membership',()=>{
 const runtime=load(seed(),{search:'?auth=success&workspace_id=untrusted'});assert.equal(runtime.values.has(MAIN),false);assert.equal(runtime.values.has(SNAP),false);assert.equal(runtime.values.get(WS),undefined);
});
test('returning to the same verified account retains its active local edits without replacing the baseline',async()=>{
 const values=seed(),runtime=load(values,{account:'a',workspace:'wa'});values.set('leadintel_customer_v2_server_dirty',JSON.stringify({workspace_id:'wa',base_version:3}));await runtime.root.__init();assert.equal(JSON.parse(values.get(MAIN)).website,'https://ccgroup.lv');assert.equal(JSON.parse(values.get(SNAP)).workspace_id,'wa');
});
test('archive storage failure aborts sign-out without deleting unsynced work or ending the session',async()=>{
 const runtime=load(seed(),{account:'a',workspace:'wa',failArchive:true});Object.assign(runtime.root.LeadIntelServerBridge,{workspace:{id:'wa'},session:{authenticated:true,user:{id:'a'}}});await runtime.root.LeadIntelServerBridge.signOut();assert.equal(JSON.parse(runtime.values.get(MAIN)).website,'https://ccgroup.lv');assert.equal(runtime.requests.some(x=>x.url==='/api/logout'),false);assert.equal(runtime.events.includes('reload'),false);
});
test('old tabs cannot overwrite, read, or send workspace requests after another tab changes accounts',async()=>{
 const values=seed(),old=load(values,{account:'a',workspace:'wa'});await old.root.__init();const switching=load(values,{account:'a',workspace:'wa'});await switching.root.__init();await switching.root.LeadIntelServerBridge.signOut();
 assert.throws(()=>old.storage.setItem(MAIN,'stale data'),/account changed/i);assert.throws(()=>old.storage.getItem(MAIN),/account changed/i);await assert.rejects(old.root.fetch('https://leadintel.ccgroup.lv/api/customer/state?workspace_id=wa',{method:'PUT'}),/account changed/i);assert.equal(values.has(MAIN),false);
 old.listeners.get('storage')?.({key:'leadintel_account_context_v1'});assert.ok(old.events.includes('reload'));
});
test('a response begun before an account change is rejected before persistence can hydrate the new cache',async()=>{
 let finish;const runtime=load(seed(),{fetchImpl:()=>new Promise(resolve=>finish=resolve)});runtime.root.LeadIntelAccountCache?.activate({workspaceId:'wa',userId:'a'});const request=runtime.root.fetch('https://leadintel.ccgroup.lv/api/customer/state?workspace_id=wa');
 runtime.root.LeadIntelAccountCache?.detach();finish(new Response(JSON.stringify({version:4,payload:{main:{website:'ccgroup.lv'},meta:{persistence:{explicit_saved:true}}}})));await assert.rejects(request,/account changed/i);assert.equal(runtime.values.has(MAIN),false);assert.equal(runtime.values.has(SNAP),false);
});
test('sign-out failure leaves the active account and profile intact',async()=>{
 const runtime=load(seed(),{fetchImpl:()=>new Response('{}',{status:503})});await runtime.root.LeadIntelServerBridge.signOut();assert.equal(JSON.parse(runtime.values.get(MAIN)).website,'https://ccgroup.lv');assert.equal(runtime.events.includes('reload'),false);
});
test('confirmed expired sessions park private cache, while a failed session check preserves it and blocks saves',async()=>{
 for(const status of [200,503]){
  const runtime=load(seed(),{fetchImpl:()=>new Response(JSON.stringify({authenticated:false}),{status})});await runtime.root.__init();
  if(status===200){assert.equal(runtime.values.has(MAIN),false);assert.ok(runtime.events.includes('reload'));}
  else{assert.equal(JSON.parse(runtime.values.get(MAIN)).website,'https://ccgroup.lv');assert.equal(runtime.root.LeadIntelServerBridge.ready,false);assert.equal(runtime.attrs.get('data-account-check'),'error');}
 }
});
test('failed cache preservation during a second login stays closed without sending old data to the new workspace',async()=>{
 const runtime=load(seed(),{failArchive:true});await runtime.root.__init();assert.equal(JSON.parse(runtime.values.get(MAIN)).website,'https://ccgroup.lv');assert.equal(runtime.root.LeadIntelServerBridge.ready,false);assert.equal(runtime.requests.some(x=>x.options.method==='PUT'),false);
 await assert.rejects(runtime.root.fetch('https://leadintel.ccgroup.lv/api/customer/state?workspace_id=wb',{method:'PUT',leadintelSaveIntent:true,body:JSON.stringify({payload:{main:{website:'ccgroup.lv'}}})}),/not verified/);
});
test('provider switching detaches the previous workspace and resumes at the requested provider',async()=>{
 const runtime=load(seed(),{account:'a',workspace:'wa'});await runtime.root.__init();const result=await runtime.root.LeadIntelServerBridge.switchProvider('microsoft');assert.equal(result.ok,true);assert.equal(runtime.values.has(MAIN),false);assert.match(runtime.root.location.href,/auth\/microsoft\/start/);
});
test('unknown guest data is quarantined, never assigned by a URL, and successive logins retain separate recovery copies',async()=>{
 const values=new Map([[MAIN,JSON.stringify({website:'private-guest.example'})]]),first=load(values);await first.root.__init();assert.equal(values.has(MAIN),false);
 const copy=[...values.entries()].find(([key])=>key.startsWith('leadintel_account_cache_v1:unassigned:'));assert.ok(copy);assert.match(copy[1],/private-guest/);
 await first.root.LeadIntelServerBridge.signOut();const second=load(values,{account:'c',workspace:'wc'});await second.root.__init();assert.equal(values.get(copy[0]),copy[1]);assert.equal(values.has(MAIN),false);
});
test('account cache executes before any customer module can read workspace data',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');assert.ok(html.indexOf('account-cache.js')<html.indexOf('<script defer'));assert.ok(html.indexOf('account-cache.js')<html.indexOf('src="app.js'));assert.match(html,/html\[data-account-check\] body\{visibility:hidden/);
});
function startupSeed(){
 const values=seed(),snapshot=JSON.parse(values.get(SNAP));
 for(const key of ['leadintel_customer_v2_website_activation_v1','leadintel_customer_v2_research_meta_v1'])snapshot.data[key]=values.get(key);
 values.set(SNAP,JSON.stringify(snapshot));values.set('leadintel_customer_v2_server_versions',JSON.stringify({wa:3}));return values;
}
function startupBackend({failPath='',failures=1,malformedSession=false}={}){
 let failed=0;
 return async input=>{
  const path=new URL(input).pathname;
  if(path===failPath&&failed++<failures)throw new TypeError('Failed to fetch');
  if(path==='/api/session')return new Response(malformedSession?'not JSON':JSON.stringify({authenticated:true,user:{id:'a'}}));
  if(path==='/api/workspaces')return new Response(JSON.stringify({workspaces:[{id:'wa',role:'owner'}]}));
  if(path==='/api/customer/state')return new Response(JSON.stringify({version:3,payload:{main:{website:'https://ccgroup.lv',answers:{offer:'CCGROUP private offer'}}}}));
  return new Response('{}');
 };
}
test('optional mail status failures cannot conceal an already verified workspace',async()=>{
 for(const path of ['/api/integrations/gmail/status','/api/integrations/microsoft-mail/status']){
  const runtime=load(startupSeed(),{fetchImpl:startupBackend({failPath:path,failures:Infinity})});
  runtime.session.set('leadintel_customer_v2_server_hydration','wa:3');
  await runtime.root.__init();
  assert.equal(runtime.root.LeadIntelServerBridge.ready,true);
  assert.equal(runtime.attrs.has('data-account-check'),false);
  assert.equal(JSON.parse(runtime.values.get(MAIN)).website,'https://ccgroup.lv');
  assert.ok(runtime.events.includes('leadintel:server-ready'));
 }
});
test('each mandatory startup read recovers from transient network failures without losing local work',async()=>{
 for(const path of ['/api/session','/api/workspaces','/api/customer/state']){
  const runtime=load(startupSeed(),{fetchImpl:startupBackend({failPath:path,failures:2})});
  runtime.session.set('leadintel_customer_v2_server_hydration','wa:3');
  await runtime.root.__init();
  assert.equal(runtime.requests.filter(request=>request.url===path).length,3);
  assert.equal(runtime.root.LeadIntelServerBridge.ready,true);
  assert.equal(runtime.attrs.has('data-account-check'),false);
  assert.equal(runtime.events.includes('reload'),false);
  assert.equal(JSON.parse(runtime.values.get(MAIN)).website,'https://ccgroup.lv');
 }
});
test('malformed successful session responses are not treated as a confirmed sign-out',async()=>{
 const runtime=load(startupSeed(),{fetchImpl:startupBackend({malformedSession:true})});
 await runtime.root.__init();
 assert.equal(JSON.parse(runtime.values.get(MAIN)).website,'https://ccgroup.lv');
 assert.equal(runtime.values.get(WS),'wa');
 assert.equal(runtime.events.includes('reload'),false);
 assert.equal(runtime.root.LeadIntelServerBridge.ready,false);
 assert.equal(runtime.attrs.get('data-account-check'),'error');
});
test('permanent verification failure is bounded and keeps private data hidden and intact',async()=>{
 const runtime=load(startupSeed(),{fetchImpl:startupBackend({failPath:'/api/session',failures:Infinity})});
 await runtime.root.__init();
 assert.equal(runtime.requests.length,3);
 assert.equal(runtime.requests.some(request=>request.options.method==='PUT'),false);
 assert.equal(JSON.parse(runtime.values.get(MAIN)).website,'https://ccgroup.lv');
 assert.equal(runtime.attrs.get('data-account-check'),'error');
 assert.equal(runtime.root.LeadIntelServerBridge.ready,false);
});
test('failed workspace reads are retried rather than reported as an empty account',async()=>{
 let attempts=0;const backend=startupBackend();
 const runtime=load(startupSeed(),{fetchImpl:async input=>new URL(input).pathname==='/api/workspaces'&&attempts++<2?new Response('{}',{status:503}):backend(input)});
 runtime.session.set('leadintel_customer_v2_server_hydration','wa:3');await runtime.root.__init();
 assert.equal(attempts,3);assert.equal(runtime.root.LeadIntelServerBridge.workspace.id,'wa');assert.equal(runtime.root.LeadIntelServerBridge.ready,true);
});
test('CRM migration failure leaves the verified workspace accessible and migration data intact',async()=>{
 const values=startupSeed();values.set('leadintel_customer_v2_discovery',JSON.stringify({pipeline:[{domain:'sample.example'}]}));
 const runtime=load(values,{fetchImpl:startupBackend({failPath:'/api/crm/companies',failures:Infinity})});
 runtime.session.set('leadintel_customer_v2_server_hydration','wa:3');
 runtime.root.LeadIntelCrm={mapLocalPipelineItemToCrm:item=>item};await runtime.root.__init();
 assert.equal(runtime.root.LeadIntelServerBridge.ready,true);assert.equal(runtime.attrs.has('data-account-check'),false);
 assert.equal(JSON.parse(runtime.values.get('leadintel_customer_v2_discovery')).pipeline[0].domain,'sample.example');
 assert.equal(runtime.values.has('leadintel_customer_v2_crm_migrations'),false);
});
test('a failed state verification revokes workspace requests without removing local records',async()=>{
 const runtime=load(startupSeed(),{fetchImpl:startupBackend({failPath:'/api/customer/state',failures:Infinity})});
 await runtime.root.__init();const count=runtime.requests.length;
 await assert.rejects(runtime.root.fetch('https://leadintel.ccgroup.lv/api/customer/state?workspace_id=wa',{method:'PUT',leadintelSaveIntent:true,body:JSON.stringify({version:3,payload:{main:{website:'https://ccgroup.lv'}}})}),/Verify the signed-in account/);
 assert.equal(runtime.requests.length,count);assert.equal(JSON.parse(runtime.values.get(MAIN)).website,'https://ccgroup.lv');
});
test('verification errors present a retry control while the private application remains hidden',()=>{
 const {JSDOM}=require('jsdom');const w=new JSDOM(fs.readFileSync(require.resolve('../index.html'),'utf8'),{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 try{
  const recovery=w.document.getElementById('account-recovery');assert.equal(w.getComputedStyle(recovery).display,'none');
  w.document.documentElement.setAttribute('data-account-check','error');
  assert.equal(w.getComputedStyle(w.document.body).visibility,'hidden');
  assert.equal(w.getComputedStyle(recovery).visibility,'visible');assert.equal(w.getComputedStyle(recovery).pointerEvents,'auto');
  const button=recovery.querySelector('button');assert.equal(button.textContent,'Try again');assert.equal(button.disabled,false);
  assert.equal(recovery.querySelectorAll('input,a').length,0);
  w.document.documentElement.removeAttribute('data-account-check');assert.equal(w.getComputedStyle(recovery).display,'none');
 }finally{w.close();}
});
test('two accounts save and reload their own profiles and research through the real persistence boundary',async()=>{
 const values=seed();values.set('leadintel_customer_v2_server_versions',JSON.stringify({wa:3}));const snapshot=JSON.parse(values.get(SNAP));for(const key of ['leadintel_customer_v2_website_activation_v1','leadintel_customer_v2_research_meta_v1'])snapshot.data[key]=values.get(key);values.set(SNAP,JSON.stringify(snapshot));const cloud=new Map([['wa',{version:3,payload:{main:{website:'https://ccgroup.lv',answers:{offer:'CCGROUP private offer'}},discovery:{buyers:[{id:'cc-buyer',name:'CCGROUP buyer'}]},outreach:{},delivery:{},meta:{discovery:{}}}}]]);
 const backend=account=>async(input,options={})=>{const url=new URL(input),ws=url.searchParams.get('workspace_id');if(url.pathname==='/api/session')return new Response(JSON.stringify({authenticated:true,user:{id:account}}));if(url.pathname==='/api/workspaces')return new Response(JSON.stringify({workspaces:[{id:account==='a'?'wa':'wb',role:'owner'}]}));if(url.pathname==='/api/customer/state'){if(options.method==='PUT'){const body=JSON.parse(options.body);assert.equal(ws,account==='a'?'wa':'wb');const next={version:(cloud.get(ws)?.version||0)+1,payload:body.payload};cloud.set(ws,next);return new Response(JSON.stringify({saved:true,version:next.version}));}return new Response(JSON.stringify(cloud.get(ws)||{version:0,payload:{}}));}return new Response('{}');};
 let a=load(values,{account:'a',workspace:'wa',fetchImpl:backend('a')});await a.root.__init();await a.root.LeadIntelServerBridge.signOut();
 let b=load(values,{fetchImpl:backend('b')});await b.root.__init();b=load(values,{fetchImpl:backend('b')});await b.root.__init();
 b.storage.setItem(MAIN,JSON.stringify({website:'https://ercon.lv',answers:{offer:'ERCON steel'}}));b.storage.setItem('leadintel_customer_v2_discovery',JSON.stringify({buyers:[{id:'er-buyer',name:'ERCON buyer'}]}));assert.equal((await b.root.LeadIntelServerBridge.saveNow({saveIntent:true,explicitSave:true})).saved,true);await b.root.LeadIntelServerBridge.signOut();
 a=load(values,{account:'a',workspace:'wa',fetchImpl:backend('a')});await a.root.__init();a=load(values,{account:'a',workspace:'wa',fetchImpl:backend('a')});await a.root.__init();assert.equal(JSON.parse(values.get(MAIN)).website,'https://ccgroup.lv');assert.equal(JSON.parse(values.get('leadintel_customer_v2_discovery')).buyers[0].name,'CCGROUP buyer');await a.root.LeadIntelServerBridge.signOut();
 b=load(values,{fetchImpl:backend('b')});await b.root.__init();b=load(values,{fetchImpl:backend('b')});await b.root.__init();assert.equal(JSON.parse(values.get(MAIN)).website,'https://ercon.lv');assert.equal(JSON.parse(values.get('leadintel_customer_v2_discovery')).buyers[0].name,'ERCON buyer');assert.equal(cloud.get('wa').payload.main.website,'https://ccgroup.lv');assert.equal(cloud.get('wb').payload.main.website,'https://ercon.lv');
});
test('the guard works with native browser Storage, independent session storage and first-party transport',async()=>{
 const {JSDOM,VirtualConsole}=require('jsdom'),virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',error=>{if(!/Not implemented: navigation/.test(error.message))throw error;});const dom=new JSDOM('<html><head></head><body></body></html>',{url:'https://leadintel.ccgroup.lv/customer/',runScripts:'outside-only',virtualConsole}),root=dom.window;
 root.Response=Response;root.Request=Request;const nativeGet=root.Storage.prototype.getItem;let release;
 root.fetch=()=>new Promise(resolve=>release=resolve);for(const [key,value] of seed())root.localStorage.setItem(key,value);
 root.eval(fs.readFileSync(require.resolve('../api-transport.js'),'utf8'));root.eval(fs.readFileSync(modulePath,'utf8'));root.LeadIntelAccountCache.activate({workspaceId:'wa',userId:'a'});root.sessionStorage.setItem('leadintel_reopen_delivery','private');
 const pending=root.fetch('https://leadintel-api.edgars-7e7.workers.dev/api/customer/state?workspace_id=wa');root.LeadIntelAccountCache.detach();release(new Response('{}'));await assert.rejects(pending,/account changed/i);assert.equal(nativeGet.call(root.localStorage,MAIN),null);assert.equal(nativeGet.call(root.sessionStorage,'leadintel_reopen_delivery'),null);dom.window.close();
});

test('cached background work cannot start paid workspace requests before session and membership verification',async()=>{
 const runtime=load(seed(),{account:'a',workspace:'wa'});
 await assert.rejects(runtime.root.fetch('https://leadintel.ccgroup.lv/api/ai/generate?workspace_id=wa',{method:'POST',body:'{}'}),/Verify the signed-in account/);
 assert.equal(runtime.requests.length,0);await runtime.root.__init();
 await runtime.root.fetch('https://leadintel.ccgroup.lv/api/ai/generate?workspace_id=wa',{method:'POST',body:'{}'});assert.ok(runtime.requests.some(x=>x.url==='/api/ai/generate'));
});
