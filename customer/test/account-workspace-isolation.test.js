const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const MAIN='leadintel_customer_v2_state',WS='leadintel_customer_v2_workspace',SNAP='leadintel_customer_v2_workspace_saved_snapshot_v1';
const modulePath=require.resolve('../server-bridge.js').replace('server-bridge.js','account-cache.js');
function load(values=new Map(),{account='b',workspace='wb',search='',failArchive=false,fetchImpl,indexedDB,localQuota=Infinity,stateBudget=false,documentReadyState='loading',parserDeferred=false,legacyCodec=false}={}){
 const session=new Map(),events=[],timers=new Map(),attrs=new Map(),domListeners=new Map();let timer=0;
 class Storage{constructor(map){this.values=map;}get length(){return this.values.size;}key(i){return [...this.values.keys()][i]??null;}getItem(k){return this.values.get(String(k))??null;}setItem(k,v){if(failArchive&&String(k).startsWith('leadintel_account_cache_v1:'))throw Error('Quota exceeded');const next=new Map(this.values);next.set(String(k),String(v));if(this.values===values&&[...next].reduce((size,[key,value])=>size+2*(key.length+value.length),0)>localQuota)throw Object.assign(Error('Browser storage quota exceeded'),{name:'QuotaExceededError'});this.values.set(String(k),String(v));}removeItem(k){this.values.delete(String(k));}clear(){this.values.clear();}}
 Storage.prototype.__leadintelServerPatched=true;
 const storage=new Storage(values),sessionStorage=new Storage(session),requests=[],listeners=new Map();
 const root={console,URL,URLSearchParams,Request,Response,Headers,FormData,Blob,Date,Promise,Math,Storage,localStorage:storage,sessionStorage,location:{href:'https://leadintel.ccgroup.lv/customer/'+search,search,origin:'https://leadintel.ccgroup.lv',reload(){events.push('reload');},replace(url){events.push('navigate:'+url);}},document:{readyState:documentReadyState,currentScript:{defer:parserDeferred},documentElement:{setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)},head:{appendChild(){}},createElement:()=>({dataset:{},textContent:''}),getElementById:()=>null,querySelector:()=>null,querySelectorAll:()=>[],addEventListener(name,fn){domListeners.set(name,fn);}},addEventListener(name,fn){listeners.set(name,fn);},dispatchEvent:e=>events.push(e.type),setTimeout(fn,ms){if(ms===350||ms===700)queueMicrotask(fn);else timers.set(++timer,fn);return timer;},clearTimeout:id=>timers.delete(id),CustomEvent:class{constructor(type){this.type=type;}},fetch:async(input,options={})=>{const url=new URL(input);requests.push({url:url.pathname,options});if(fetchImpl)return fetchImpl(input,options);if(url.pathname==='/api/session')return new Response(JSON.stringify({authenticated:true,user:{id:account,email:account+'@example.com'}}));if(url.pathname==='/api/workspaces')return new Response(JSON.stringify({workspaces:[{id:workspace,name:workspace,role:'owner'}]}));if(url.pathname==='/api/customer/state')return new Response(JSON.stringify({version:workspace==='wa'?3:0,payload:workspace==='wa'?{main:{website:'https://ccgroup.lv',answers:{offer:'CCGROUP private offer'}}}:{}}));return new Response('{}');}};
 root.indexedDB=indexedDB;root.window=root;root.globalThis=root;
 if(fs.existsSync(modulePath)){const cacheSource=fs.readFileSync(modulePath,'utf8');vm.runInNewContext(legacyCodec?cacheSource.replace("const LOCAL_CODEC_EPOCH='li2:'","const LOCAL_CODEC_EPOCH='li1:'"):cacheSource,root);}
 if(stateBudget){Object.assign(root,{TextEncoder,TextDecoder,Buffer});vm.runInNewContext(fs.readFileSync(require.resolve('../state-budget.js'),'utf8'),root);}
 vm.runInNewContext(fs.readFileSync(require.resolve('../workspace-sync.js'),'utf8'),root);
 vm.runInNewContext(fs.readFileSync(require.resolve('../workspace-persistence.js'),'utf8'),root);
 vm.runInNewContext(fs.readFileSync(require.resolve('../server-bridge.js'),'utf8').replace('root.LeadIntelServerBridge=bridge;','root.__init=init;root.LeadIntelServerBridge=bridge;'),root);
 return {root,storage,values,session,events,attrs,requests,listeners,domListeners};
}
function seed(){const main=JSON.stringify({website:'https://ccgroup.lv',answers:{offer:'CCGROUP private offer'}});return new Map([[WS,'wa'],[MAIN,main],['leadintel_customer_v2_workspace_explicit_save_v1','1'],[SNAP,JSON.stringify({server_synced:true,workspace_id:'wa',server_version:3,data:{[MAIN]:main}})],['leadintel_customer_v2_legacy_local_cleanup_20260901_v2','done'],['leadintel_customer_v2_website_activation_v1','CCGROUP activation'],['leadintel_customer_v2_research_meta_v1','CCGROUP research'],['leadintel_customer_v2_background_tasks_v1','CCGROUP tasks']]);}
test('a second account with an empty server workspace never inherits the first saved profile or snapshot',async()=>{
 const runtime=load(seed());await runtime.root.__init();assert.equal(runtime.values.has(MAIN),false);assert.equal(runtime.values.has(SNAP),false);assert.equal(runtime.values.has('leadintel_customer_v2_website_activation_v1'),false);assert.equal(runtime.values.has('leadintel_customer_v2_research_meta_v1'),false);assert.equal(runtime.values.has('leadintel_customer_v2_background_tasks_v1'),false);assert.equal(runtime.requests.some(x=>x.options.method==='PUT'),false);
});
test('sign-out preserves an unsynced profile and recovery snapshot without displaying either to the next account',async()=>{
 const runtime=load(seed(),{account:'a',workspace:'wa'});await runtime.root.__init();runtime.storage.setItem(MAIN,JSON.stringify({website:'ccgroup.lv',answers:{offer:'Unsynced CCGROUP edit'}}));runtime.storage.setItem('leadintel_customer_v2_server_dirty',JSON.stringify({workspace_id:'wa',base_version:3}));const eventsBefore=runtime.events.length;await runtime.root.LeadIntelServerBridge.signOut();assert.equal(runtime.values.has(MAIN),false);assert.equal(runtime.values.has(SNAP),false);
 // Founder report 2026-10-26: after Sign out the workspace page reloaded without a session (sign-in links in the top bar, an empty form). Sign-out now lands on the sign-in page, as the admin page does.
 const afterSignOut=runtime.events.slice(eventsBefore);assert.ok(afterSignOut.includes('navigate:/?access=signed-out'),'sign-out lands on the sign-in page with the signed-out notice');assert.equal(afterSignOut.includes('reload'),false,`the signed-out workspace is not reloaded in place (events after sign-out: ${afterSignOut.join(', ')})`);
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
test('large compressed cloud outreach hydrates and reopens without exceeding local storage or leaking accounts',async()=>{
 const {IDBFactory}=require('fake-indexeddb'),budget=require('../state-budget.js'),indexedDB=new IDBFactory(),values=startupSeed();
 const priorSnapshot=JSON.parse(values.get(SNAP));
 for(const key of ['leadintel_customer_v2_website_activation_v1','leadintel_customer_v2_research_meta_v1']){values.delete(key);delete priorSnapshot.data[key];}
 values.set(SNAP,JSON.stringify(priorSnapshot));
 const outreach={messages:Array.from({length:50},(_,i)=>({id:'message-'+i,body:'Approved message and verified research. '.repeat(1700),approved:i%2===0}))};
 const payload={main:{website:'https://ccgroup.lv'},discovery:{},outreach,delivery:{},meta:{discovery:{}}};
 const packed=budget.prepareForSync(payload,{allowCompressionPacking:true}).payload;
 const backend=async input=>new URL(input).pathname==='/api/customer/state'?new Response(JSON.stringify({version:4,payload:packed})):startupBackend()(input);
 const first=load(values,{indexedDB,account:'a',workspace:'wa',localQuota:5*1024*1024,stateBudget:true,fetchImpl:backend});await first.root.__init();
 assert.notEqual(first.attrs.get('data-account-check'),'error');assert.ok(first.events.includes('reload'));
 const reopened=load(values,{indexedDB,account:'a',workspace:'wa',localQuota:5*1024*1024,stateBudget:true,fetchImpl:backend});
 reopened.session.set('leadintel_customer_v2_server_hydration','wa:4');await reopened.root.__init();
 assert.equal(reopened.root.LeadIntelServerBridge.ready,true);assert.equal(reopened.attrs.has('data-account-check'),false);
 assert.deepEqual(JSON.parse(reopened.storage.getItem('leadintel_customer_v2_outreach')),outreach);
 assert.equal(reopened.root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),false);
 assert.equal(first.requests.concat(reopened.requests).some(request=>request.options.method==='PUT'),false);
 await reopened.root.LeadIntelServerBridge.signOut();
 const other=load(values,{indexedDB,account:'b',workspace:'wb',localQuota:5*1024*1024,stateBudget:true});await other.root.__init();
 assert.equal(other.storage.getItem('leadintel_customer_v2_outreach'),null);
 const back=load(values,{indexedDB,account:'a',workspace:'wa',localQuota:5*1024*1024,stateBudget:true,fetchImpl:backend});await back.root.__init();
 assert.deepEqual(JSON.parse(back.storage.getItem('leadintel_customer_v2_outreach')),outreach);
});
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
 // three bounded /api/session attempts plus the single /api/workspaces probe that startup now runs beside the session check
 assert.equal(runtime.requests.length,4);
 assert.equal(runtime.requests.filter(request=>request.url==='/api/session').length,3);
 assert.equal(runtime.requests.filter(request=>request.url==='/api/workspaces').length,1);
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

function quotaFor(values){return [...values].reduce((size,[key,value])=>size+2*(key.length+value.length),0)+64;}
test('expired HTTP 401 sessions preserve full browser cache outside localStorage before detaching',async()=>{
 const {IDBFactory}=require('fake-indexeddb'),indexedDB=new IDBFactory(),values=seed();
 const original=new Map(values),runtime=load(values,{indexedDB,localQuota:quotaFor(values),fetchImpl:()=>new Response('{}',{status:401})});
 assert.throws(()=>runtime.storage.setItem('leadintel_account_cache_v1:wa',JSON.stringify(Object.fromEntries(values))),{name:'QuotaExceededError'});
 await runtime.root.__init();assert.equal(values.has(MAIN),false);assert.equal(values.has(SNAP),false);assert.ok(runtime.events.includes('reload'));assert.equal(runtime.attrs.get('data-account-check'),'pending');
 const back=load(values,{indexedDB,account:'a',workspace:'wa'});await back.root.__init();
 for(const [key,value] of original)assert.equal(values.get(key),value,key);
 assert.equal(back.requests.some(request=>request.options.method==='PUT'),false);
});
test('legacy archives migrate only after a committed backup and remain isolated across account switches',async()=>{
 const {IDBFactory}=require('fake-indexeddb'),indexedDB=new IDBFactory(),values=seed();
 const archiveKey='leadintel_account_cache_v1:wb',legacy=JSON.stringify({schemaVersion:1,workspaceId:'wb',userId:'b',data:{[MAIN]:JSON.stringify({website:'https://ercon.lv',answers:{offer:'Unsynced ERCON edit'}})},sessionData:{leadintel_delivery_draft:'ERCON draft'}});
 values.set(archiveKey,legacy);const runtime=load(values,{indexedDB,localQuota:quotaFor(values),account:'a',workspace:'wa'});
 await runtime.root.LeadIntelAccountCache.detach();assert.equal(values.has(archiveKey),false);assert.equal(values.has(MAIN),false);
 const next=load(values,{indexedDB,account:'b',workspace:'wb'});await next.root.__init();assert.equal(JSON.parse(values.get(MAIN)).answers.offer,'Unsynced ERCON edit');assert.equal(next.session.get('leadintel_delivery_draft'),'ERCON draft');
 await next.root.LeadIntelAccountCache.detach();const back=load(values,{indexedDB,account:'a',workspace:'wa'});await back.root.__init();assert.equal(JSON.parse(values.get(MAIN)).answers.offer,'CCGROUP private offer');assert.equal(back.session.has('leadintel_delivery_draft'),false);
});
test('unavailable archive database keeps all drafts and existing archives and does not sign out',async()=>{
 const values=seed(),legacyKey='leadintel_account_cache_v1:other';values.set(legacyKey,'existing recovery copy');const original=new Map(values);
 const runtime=load(values,{indexedDB:{open(){throw Error('Archive database unavailable');}},account:'a',workspace:'wa',localQuota:quotaFor(values)});
 Object.assign(runtime.root.LeadIntelServerBridge,{workspace:{id:'wa'},session:{authenticated:true,user:{id:'a'}}});
 await runtime.root.LeadIntelServerBridge.signOut();assert.deepEqual(values,original);assert.equal(runtime.requests.some(request=>request.url==='/api/logout'),false);assert.equal(runtime.events.includes('reload'),false);
});

test('asynchronous login-callback preservation completes before mandatory session verification',async()=>{
 const {IDBFactory}=require('fake-indexeddb'),indexedDB=new IDBFactory(),runtime=load(seed(),{indexedDB,search:'?auth=success&workspace_id=wb'});
 assert.equal(runtime.requests.length,0);await runtime.root.__init();assert.equal(runtime.values.has(MAIN),false);assert.equal(runtime.root.LeadIntelServerBridge.workspace.id,'wb');assert.ok(runtime.events.includes('reload'));assert.equal(runtime.requests.some(request=>request.options.method==='PUT'),false);
});

test('a put success followed by transaction abort never retires local archives or active drafts',async()=>{
 const {IDBFactory}=require('fake-indexeddb'),indexedDB=new IDBFactory(),open=indexedDB.open.bind(indexedDB);
 indexedDB.open=(...args)=>{const request=open(...args);request.addEventListener('success',()=>{const db=request.result,transaction=db.transaction.bind(db);db.transaction=(...args)=>{const tx=transaction(...args);if(args[1]==='readwrite'){const objectStore=tx.objectStore.bind(tx);tx.objectStore=name=>{const store=objectStore(name),put=store.put.bind(store);store.put=(...values)=>{const result=put(...values);result.addEventListener('success',()=>tx.abort(),{once:true});return result;};return store;};}return tx;};});return request;};
 const values=seed();values.set('leadintel_account_cache_v1:old','untouched archive');const original=new Map(values),runtime=load(values,{indexedDB});
 await assert.rejects(runtime.root.LeadIntelAccountCache.detach(),/safely preserve/);assert.deepEqual(values,original);assert.equal(runtime.events.includes('reload'),false);
});
test('account changes during an asynchronous archive cannot clear or restore the new active account',async()=>{
 const {IDBFactory}=require('fake-indexeddb'),values=seed(),runtime=load(values,{indexedDB:new IDBFactory()});
 const pending=runtime.root.LeadIntelAccountCache.detach();assert.throws(()=>runtime.storage.setItem(MAIN,'late edit'),/preserving/);
 values.set('leadintel_account_context_v1',JSON.stringify({workspaceId:'wb',userId:'b',epoch:'other-tab'}));values.set(MAIN,'new account work');
 await assert.rejects(pending,/account changed/);assert.equal(values.get(MAIN),'new account work');
});
test('native browser Storage quota permits archival and exact restoration without a duplicate local copy',async()=>{
 const {JSDOM}=require('jsdom'),{IDBFactory}=require('fake-indexeddb'),dom=new JSDOM('<html><body></body></html>',{url:'https://leadintel.ccgroup.lv/customer/',runScripts:'outside-only',storageQuota:10000}),root=dom.window;
 try{
  const original=seed();original.set('leadintel_large_unsynced_draft','x'.repeat(5500));for(const [key,value] of original)root.localStorage.setItem(key,value);
  assert.throws(()=>root.localStorage.setItem('leadintel_account_cache_v1:wa',JSON.stringify({data:Object.fromEntries(original)})),{name:'QuotaExceededError'});
  root.indexedDB=new IDBFactory();root.eval(fs.readFileSync(modulePath,'utf8'));await root.LeadIntelAccountCache.detach();assert.equal(root.localStorage.getItem(MAIN),null);
  await root.LeadIntelAccountCache.activate({workspaceId:'wa',userId:'a'});for(const [key,value] of original)assert.equal(root.localStorage.getItem(key),value,key);
  assert.equal(root.localStorage.getItem('leadintel_account_cache_v1:wa'),null);
 }finally{root.close();}
});
test('quota-safe archives preserve drafts through sign-out, provider and workspace changes',async()=>{
 const {IDBFactory}=require('fake-indexeddb');
 for(const action of ['signOut','switchProvider','selectWorkspace']){
  const values=startupSeed(),indexedDB=new IDBFactory(),runtime=load(values,{indexedDB,account:'a',workspace:'wa'});runtime.session.set('leadintel_customer_v2_server_hydration','wa:3');await runtime.root.__init();
  values.set(MAIN,JSON.stringify({website:'https://ccgroup.lv',answers:{offer:'Preserved '+action}}));runtime.root.LeadIntelServerBridge.workspaces.push({id:'wb'});
  if(action==='selectWorkspace')await runtime.root.LeadIntelServerBridge.selectWorkspace('wb');else await runtime.root.LeadIntelServerBridge[action]('microsoft');
  assert.equal(values.has(MAIN),false);const back=load(values,{indexedDB,account:'a',workspace:'wa'});await back.root.__init();assert.equal(JSON.parse(values.get(MAIN)).answers.offer,'Preserved '+action);
 }
});

test('verified same-account startup retires legacy backup duplicates only after preserving every draft',async()=>{
 const {IDBFactory}=require('fake-indexeddb'),values=startupSeed(),indexedDB=new IDBFactory(),key='leadintel_account_cache_v1:other';
 const archived=JSON.stringify({schemaVersion:1,workspaceId:'other',userId:'other-user',data:{[MAIN]:'Other private draft'},sessionData:{}});values.set(key,archived);
 const runtime=load(values,{indexedDB,account:'a',workspace:'wa',localQuota:quotaFor(values)});await runtime.root.__init();
 assert.equal(values.has(key),false);assert.equal(JSON.parse(values.get(MAIN)).website,'https://ccgroup.lv');
 await runtime.root.LeadIntelAccountCache.detach();await runtime.root.LeadIntelAccountCache.activate({workspaceId:'other',userId:'other-user'});assert.equal(values.get(MAIN),'Other private draft');
});

test('full active local storage hydrates and reopens an exact cloud baseline through committed IndexedDB snapshots',async()=>{
 const {IDBFactory}=require('fake-indexeddb'),indexedDB=new IDBFactory(),values=startupSeed();
 const main={website:'https://ccgroup.lv',answers:{offer:'Exact saved offer'},research:'Verified reference. '.repeat(12000)};
 values.set(MAIN,JSON.stringify(main));const snapshot=JSON.parse(values.get(SNAP));snapshot.data[MAIN]=values.get(MAIN);values.set(SNAP,JSON.stringify(snapshot));
 const payload={main,discovery:{},outreach:{},delivery:{},meta:{discovery:{}}},backend=async(input)=>{
  const path=new URL(input).pathname;
  if(path==='/api/customer/state')return new Response(JSON.stringify({version:3,payload}));
  return startupBackend()(input);
 };
 const limit=quotaFor(values)+4096,runtime=load(values,{indexedDB,account:'a',workspace:'wa',localQuota:limit,fetchImpl:backend});runtime.session.set('leadintel_customer_v2_server_hydration','wa:3');
 await runtime.root.__init();assert.equal(runtime.root.LeadIntelServerBridge.ready,true);assert.equal(runtime.attrs.has('data-account-check'),false);
 assert.equal(JSON.parse(values.get(SNAP)).format,'leadintel-indexed-workspace-snapshot-v1');assert.equal(values.get(MAIN),JSON.stringify(main));
 assert.deepEqual(JSON.parse(JSON.stringify(runtime.root.LeadIntelWorkspacePersistence.syncedBase('wa').payload)),payload);
 const reopened=load(values,{indexedDB,account:'a',workspace:'wa',localQuota:limit,fetchImpl:backend});reopened.session.set('leadintel_customer_v2_server_hydration','wa:3');await reopened.root.__init();
 assert.equal(reopened.root.LeadIntelServerBridge.ready,true);assert.deepEqual(JSON.parse(JSON.stringify(reopened.root.LeadIntelWorkspacePersistence.syncedBase('wa').payload)),payload);
 values.set(MAIN,JSON.stringify({...main,answers:{offer:'Unsynced working edit'}}));assert.equal(reopened.root.LeadIntelWorkspacePersistence.hasUnsavedChanges(),true);
});

test('failed durable snapshot commit keeps the prior baseline and active working records behind recovery',async()=>{
 const {IDBFactory}=require('fake-indexeddb'),values=startupSeed(),before=new Map(values),runtime=load(values,{indexedDB:new IDBFactory(),account:'a',workspace:'wa',localQuota:quotaFor(values)+4096,fetchImpl:async input=>new URL(input).pathname==='/api/customer/state'?new Response(JSON.stringify({version:3,payload:{main:{website:'https://ccgroup.lv',notes:'Research '.repeat(12000)}}})):startupBackend()(input)});
 runtime.root.LeadIntelAccountCache.saveRecoverySnapshot=async()=>{throw Error('Durable snapshot unavailable');};await runtime.root.__init();
 assert.equal(runtime.root.LeadIntelServerBridge.ready,false);assert.equal(runtime.attrs.get('data-account-check'),'error');
 assert.equal(values.get(SNAP),before.get(SNAP));assert.equal(values.get(MAIN),before.get(MAIN));assert.equal(runtime.requests.some(x=>x.options.method==='PUT'),false);
});

test('login provider survives callback cleanup, workspace activation and reload but clears on sign-out',async()=>{
 const values=seed();values.set('leadintel_auth_provider','google');
 const callback=load(values,{search:'?auth=success&workspace_id=wb'});
 assert.equal(values.get('leadintel_auth_provider'),'google');
 await callback.root.__init();assert.equal(values.get('leadintel_auth_provider'),'google');
 const reloaded=load(values);assert.equal(reloaded.root.LeadIntelServerBridge.authProvider,'google');
 await reloaded.root.__init();await reloaded.root.LeadIntelServerBridge.signOut();
 assert.equal(values.has('leadintel_auth_provider'),false);
});
test('restoring an old workspace cannot overwrite the current login provider',async()=>{
 const values=seed();values.set('leadintel_account_context_v1',JSON.stringify({workspaceId:'wa',userId:'a'}));
 const runtime=load(values,{account:'a',workspace:'wa'});values.set('leadintel_auth_provider','google');await runtime.root.LeadIntelAccountCache.checkpoint();
 await runtime.root.LeadIntelAccountCache.detach();values.set('leadintel_auth_provider','microsoft');
 await runtime.root.LeadIntelAccountCache.activate({workspaceId:'wa',userId:'a'});
 assert.equal(values.get('leadintel_auth_provider'),'microsoft');
});

test('storage-format migration fences previous-version tabs before replacing shared JSON',async()=>{
 const values=seed(),old=load(values,{account:'a',workspace:'wa',legacyCodec:true});await old.root.__init();
 const key='leadintel_customer_v2_outreach',value=JSON.stringify({body:'Approved script. '.repeat(10000)});values.set(key,value);
 const upgraded=load(values,{account:'a',workspace:'wa',stateBudget:true});
 assert.equal(upgraded.storage.getItem(key),value);assert.notEqual(values.get(key),value);
 assert.throws(()=>old.storage.getItem(key),/account changed/);
 assert.throws(()=>old.storage.setItem(key,'{}'),/account changed/);
 await assert.rejects(old.root.fetch('https://leadintel.ccgroup.lv/api/customer/state?workspace_id=wa',{method:'PUT'}),/account changed/);
 const ticket=values.get('leadintel_account_context_v1');
 const another=load(values,{account:'a',workspace:'wa',stateBudget:true});
 assert.equal(values.get('leadintel_account_context_v1'),ticket);assert.equal(upgraded.storage.getItem(key),value);
 another.storage.setItem(key,value+' ');assert.equal(upgraded.storage.getItem(key),value+' ');
});

test('codec fence failure keeps the legacy section and account ticket usable',()=>{
 const values=seed(),key='leadintel_customer_v2_outreach',value=JSON.stringify({body:'Exact saved draft. '.repeat(10000)});values.set(key,value);
 const oldTicket=JSON.stringify({workspaceId:'wa',userId:'a'});values.set('leadintel_account_context_v1',oldTicket);
 const r=load(values,{stateBudget:true,localQuota:quotaFor(values)-64});
 assert.equal(values.get(key),value);assert.equal(values.get('leadintel_account_context_v1'),oldTicket);
 assert.equal(r.storage.getItem(key),value);assert.equal(r.root.LeadIntelAccountCache.current(),true);
 assert.throws(()=>r.storage.setItem(key,value+' '),{name:'QuotaExceededError'});assert.equal(values.get(key),value);
});
test('a codec fence fits a completely full UUID context and survives account transitions',async()=>{
 const values=seed(),context='leadintel_account_context_v1',ticket=JSON.stringify({workspaceId:'wa',userId:'a',epoch:'12345678-1234-1234-1234-123456789abc'});values.set(context,ticket);
 const r=load(values,{stateBudget:true,localQuota:quotaFor(values)-64});
 r.root.LeadIntelAccountCache.prepareLocalStorageCodec();assert.equal(values.get(context).length,ticket.length);
 assert.match(JSON.parse(values.get(context)).epoch,/^li2:/);
 const {IDBFactory}=require('fake-indexeddb');r.root.indexedDB=new IDBFactory();
 await r.root.LeadIntelAccountCache.detach();assert.match(JSON.parse(values.get(context)).epoch,/^li2:/);
 await r.root.LeadIntelAccountCache.activate({workspaceId:'wa',userId:'a'});assert.match(JSON.parse(values.get(context)).epoch,/^li2:/);
});

test('startup reuses the parsed state body after snapshot work instead of rereading an expired stream',async()=>{
 const backend=startupBackend();
 const r=load(startupSeed(),{fetchImpl:async input=>{
  const response=await backend(input);
  if(new URL(input).pathname==='/api/customer/state')response.json=async()=>{throw Object.assign(Error('Body stream expired during snapshot work'),{name:'AbortError'});};
  return response;
 }});
 r.session.set('leadintel_customer_v2_server_hydration','wa:3');await r.root.__init();
 assert.equal(r.root.LeadIntelServerBridge.ready,true);assert.equal(r.attrs.has('data-account-check'),false);
 assert.equal(r.root.LeadIntelServerBridge.stateVersion,3);
});

test('the snapshot body fix versions both its entrypoint and imported persistence module',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),app=fs.readFileSync(require.resolve('../app.js'),'utf8');
 assert.match(html,/<script type="module" src="app\.js[^"\n]*snapshot-body=20261016-v1/);
 assert.match(app,/import '\.\/workspace-persistence\.js[^'\n]*snapshot-body=20261016-v1/);
});

function interruptedBody(name='AbortError'){
 return new Response(new ReadableStream({start(controller){controller.error(Object.assign(Error('Response body interrupted'),{name}));}}),{headers:{'Content-Type':'application/json'}});
}
test('all mandatory startup reads retry interrupted response bodies rather than treating them as empty data',async()=>{
 for(const name of ['AbortError','TimeoutError','TypeError'])for(const failPath of ['/api/session','/api/workspaces','/api/customer/state']){
  let attempts=0;const backend=startupBackend(),r=load(startupSeed(),{fetchImpl:input=>new URL(input).pathname===failPath&&attempts++<2?interruptedBody(name):backend(input)});
  r.session.set('leadintel_customer_v2_server_hydration','wa:3');await r.root.__init();
  assert.equal(r.root.LeadIntelServerBridge.ready,true,name+' '+failPath);
  assert.equal(r.attrs.has('data-account-check'),false);assert.equal(attempts,3);
  assert.equal(r.requests.some(x=>x.options.method==='PUT'),false);
  assert.equal(JSON.parse(r.storage.getItem(MAIN)).website,'https://ccgroup.lv');
 }
});
test('exhausted interrupted startup bodies preserve local records and keep workspace requests closed',async()=>{
 let attempts=0;const r=load(startupSeed(),{fetchImpl:input=>new URL(input).pathname==='/api/workspaces'?(attempts++,interruptedBody()):startupBackend()(input)});
 await r.root.__init();assert.equal(attempts,3);assert.equal(r.root.LeadIntelServerBridge.ready,false);assert.equal(r.attrs.get('data-account-check'),'error');
 assert.equal(JSON.parse(r.storage.getItem(MAIN)).website,'https://ccgroup.lv');
 await assert.rejects(r.root.fetch('https://leadintel.ccgroup.lv/api/customer/state?workspace_id=wa',{method:'PUT',leadintelSaveIntent:true,body:'{"payload":{}}'}),/Verify the signed-in account/);
});

test('startup retries a real deadline abort while the workspace-list body is still streaming',async()=>{
 let attempts=0,deadline;const backend=startupBackend();
 const r=load(startupSeed(),{fetchImpl:(input,options)=>{
  if(new URL(input).pathname==='/api/workspaces'&&attempts++<2){
   const body=new ReadableStream({start(controller){options.signal.addEventListener('abort',()=>controller.error(options.signal.reason),{once:true});}});
   const fire=deadline;queueMicrotask(()=>fire());return new Response(body); // the deadline of THIS request: /api/session runs beside it and arms its own timer
  }return backend(input);
 }});
 Object.assign(r.root,{AbortController,DOMException});
 const schedule=r.root.setTimeout;r.root.setTimeout=(fn,ms)=>ms===15000?(deadline=fn,999):schedule(fn,ms);
 r.session.set('leadintel_customer_v2_server_hydration','wa:3');await r.root.__init();
 assert.equal(attempts,3);assert.equal(r.root.LeadIntelServerBridge.ready,true);
 assert.equal(r.attrs.has('data-account-check'),false);
});
test('a failed write response body never automatically repeats the write or detaches saved records',async()=>{
 let writes=0;const backend=startupBackend(),r=load(startupSeed(),{fetchImpl:(input,options)=>new URL(input).pathname==='/api/logout'?(writes++,interruptedBody()):backend(input)});
 r.session.set('leadintel_customer_v2_server_hydration','wa:3');await r.root.__init();
 await r.root.LeadIntelServerBridge.signOut();assert.equal(writes,1);
 assert.equal(JSON.parse(r.storage.getItem(MAIN)).website,'https://ccgroup.lv');assert.equal(r.events.includes('reload'),false);
});

test('parser-deferred bridge waits for the module bootstrap before starting verification',async()=>{
 const r=load(startupSeed(),{documentReadyState:'interactive',parserDeferred:true,fetchImpl:startupBackend()});
 assert.equal(r.requests.length,0,'the parser marks deferred scripts interactive before module dependencies are ready');
 assert.equal(typeof r.domListeners.get('DOMContentLoaded'),'function');
 r.session.set('leadintel_customer_v2_server_hydration','wa:3');await r.domListeners.get('DOMContentLoaded')();
 assert.equal(r.root.LeadIntelServerBridge.ready,true);
});
