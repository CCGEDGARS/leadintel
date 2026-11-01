const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),Model=require('../attention-centre-model.js'),{createTaskCentre}=require('../background-task-centre.js');
const refreshSource=source.slice(source.indexOf('function registerCrmRecoveryRetry('),source.indexOf('function injectDiscoveryUI('));
function timeout(){return Object.assign(new Error('LeadIntel server request timed out for /api/crm/companies.'),{code:'request_timeout',requestPath:'/api/crm/companies',phase:'request',transient:true});}
function runtime({list=async()=>{throw timeout();},hydrate=()=>{},tasks=createTaskCentre()}={}){
 const bridge={workspace:{id:'w1'},listCrmCompanies:list};
 const ctx={window:{LeadIntelTaskCentre:tasks},discoveryMounted:true,crmRefreshing:false,crmRefreshRevision:0,crmAvailable:true,crmCompanies:[{id:'cached-company'}],crmPipeline:[{id:'cached-pipeline'}],discovery:{pipeline:[{domain:'buyer.example',people:[{id:'kept',kept:true,publicEmailUrl:'https://buyer.example/team'}]}],selectedProspects:[]},crmAuthenticated:()=>true,bridge:()=>bridge,hydrateLocalPipelineFromCrm:hydrate,renderAll(){ctx.renders++;},scheduleSavedBuyerPublicChecks(){ctx.checks++;},renders:0,checks:0};
 vm.createContext(ctx);vm.runInContext(refreshSource,ctx);return {ctx,bridge,tasks};
}
test('a CRM read started before permanent removal cannot reintroduce its deleted company',async()=>{
 const pending=[];let hydrated=0;
 const r=runtime({list:()=>new Promise(resolve=>pending.push(resolve)),hydrate:()=>{hydrated++;}});
 const refresh=r.ctx.refreshCrmState();r.ctx.crmRefreshRevision++;r.ctx.crmCompanies=[];r.ctx.crmPipeline=[];
 for(const finish of pending)finish({ok:true,companies:[{id:'deleted',normalized_domain:'example.com'}]});
 await refresh;assert.equal(r.ctx.crmCompanies.length,0);assert.equal(r.ctx.crmPipeline.length,0);assert.equal(hydrated,0);
});
test('the actual server-ready CRM refresh does not report its expected timeout as an unhandled component crash',()=>{
 const script=`const fs=require('node:fs'),vm=require('node:vm'),source=fs.readFileSync('customer/discovery-ui.js','utf8'),listeners={},unhandled=[];process.on('unhandledRejection',error=>unhandled.push(error.message));const ctx={window:{addEventListener:(name,fn)=>listeners[name]=fn},discoveryMounted:true,crmRefreshing:false,crmRefreshRevision:0,crmAvailable:true,crmCompanies:[{id:'saved'}],crmPipeline:[],discovery:{selectedProspects:[]},crmAuthenticated:()=>true,bridge:()=>({workspace:{id:'w1'},listCrmCompanies:async()=>{throw Object.assign(new Error('LeadIntel server request timed out for /api/crm/companies.'),{code:'request_timeout',requestPath:'/api/crm/companies',transient:true});}}),renderAll(){},scheduleSavedBuyerPublicChecks(){}};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function registerCrmRecoveryRetry('),source.indexOf('function injectDiscoveryUI('))+'\\n'+source.split('\\n').find(line=>line.includes('window.addEventListener("leadintel:server-ready",()=>{void refreshCrmState();})')),ctx);listeners['leadintel:server-ready']();setImmediate(()=>console.log(JSON.stringify({unhandled,refreshing:ctx.crmRefreshing,companies:ctx.crmCompanies})));`;
 const result=JSON.parse(execFileSync(process.execPath,['-e',script],{cwd:require('node:path').join(__dirname,'../..'),encoding:'utf8'}));
 assert.deepEqual(result.unhandled,[]);assert.equal(result.refreshing,false);assert.deepEqual(result.companies,[{id:'saved'}]);
});
test('a CRM list timeout preserves buyer evidence and offers a scoped retry that clears its warning after recovery',async()=>{
 const {ctx,bridge,tasks}=runtime(),before=JSON.stringify({companies:ctx.crmCompanies,pipeline:ctx.crmPipeline,discovery:ctx.discovery});
 assert.equal(await ctx.refreshCrmState(),false);assert.equal(ctx.crmRefreshing,false);assert.equal(ctx.crmAvailable,false);assert.equal(ctx.renders,1);
 assert.equal(JSON.stringify({companies:ctx.crmCompanies,pipeline:ctx.crmPipeline,discovery:ctx.discovery}),before);
 const task=tasks.list()[0];assert.equal(task.type,'crm-refresh');assert.equal(task.metadata.workspaceId,'w1');assert.equal(task.status,'error');assert.equal(tasks.hasAction(task.id,'retry'),true);assert.match(task.error,/CRM.*retry|retry.*CRM/i);
 assert.equal(Model.buildAttentionItems({tasks:tasks.list(),workspaceStarted:false})[0].target.type,'tasks');
 bridge.listCrmCompanies=async()=>({ok:true,companies:[{id:'server-company'}]});assert.equal(await tasks.retry(task.id),true);
 assert.equal(ctx.crmAvailable,true);assert.equal(tasks.get(task.id).status,'complete');assert.deepEqual(Model.buildAttentionItems({tasks:tasks.list(),workspaceStarted:false}),[]);
});
test('a stale CRM timeout cannot change another workspace cache or publish its warning there',async()=>{
 let reject;const {ctx,bridge,tasks}=runtime({list:()=>new Promise((resolve,rejectPromise)=>{reject=rejectPromise;})});
 const pending=ctx.refreshCrmState();bridge.workspace={id:'w2'};ctx.crmAvailable=true;ctx.crmCompanies=[{id:'new-workspace-company'}];ctx.discovery={pipeline:[{domain:'new.example'}],selectedProspects:[]};
 reject(timeout());assert.equal(await pending,false);assert.equal(ctx.crmAvailable,true);assert.equal(ctx.crmCompanies[0].id,'new-workspace-company');assert.equal(ctx.discovery.pipeline[0].domain,'new.example');assert.equal(tasks.list().length,0);
});
test('a CRM retry from an earlier workspace cannot issue requests in the new workspace',async()=>{
 let calls=0;const {ctx,bridge,tasks}=runtime({list:async()=>{calls++;throw timeout();}});await ctx.refreshCrmState();const task=tasks.list()[0],before=calls;bridge.workspace={id:'w2'};
 await tasks.retry(task.id);assert.equal(calls,before);assert.equal(ctx.discovery.pipeline[0].domain,'buyer.example');
});
test('CRM refresh programming errors and untyped lookalike messages remain observable as component failures',async()=>{
 for(const options of [{list:async()=>{throw new TypeError('Cannot set properties of null');}},{list:async()=>{throw new Error(timeout().message);}},{list:async()=>({ok:true,companies:[]}),hydrate:()=>{throw new TypeError('Hydration programming error');}}]){
  const {ctx,tasks}=runtime(options);let error;try{await ctx.refreshCrmState();}catch(cause){error=cause;}
  assert.ok(error);assert.equal(tasks.list().length,0);assert.equal(ctx.crmRefreshing,false);
  assert.equal(Model.buildAttentionItems({runtimeErrors:[{id:'real',message:error.message}],workspaceStarted:false})[0].target.type,'runtime');
 }
});
test('an interrupted CRM list body uses the same recoverable path while other request failures stay observable',async()=>{
 const error=Object.assign(timeout(),{code:'response_body_failed'}),{ctx,tasks}=runtime({list:async()=>{throw error;}});
 assert.equal(await ctx.refreshCrmState(),false);assert.match(tasks.list()[0].error,/interrupted/);
 for(const patch of [{transient:false},{requestPath:'/api/customer/state'},{code:'programming_error'}]){
  const h=runtime({list:async()=>{throw Object.assign(timeout(),patch);}});await assert.rejects(()=>h.ctx.refreshCrmState());assert.equal(h.tasks.list().length,0);
 }
});
test('a successful response from a replaced workspace bridge cannot replace the new cache',async()=>{
 let release;const result=new Promise(resolve=>{release=resolve;}),{ctx,tasks}=runtime({list:()=>result});
 const pending=ctx.refreshCrmState();ctx.bridge=()=>({workspace:{id:'w2'}});ctx.crmCompanies=[{id:'new-company'}];ctx.crmPipeline=[{id:'new-pipeline'}];
 release({ok:true,companies:[{id:'old-server-company'}]});assert.equal(await pending,false);assert.equal(ctx.crmCompanies[0].id,'new-company');assert.equal(ctx.crmPipeline[0].id,'new-pipeline');assert.equal(tasks.list().length,0);
});
test('Workspace status offers the CRM task Retry action and removes its warning after a successful click',async()=>{
 const {JSDOM}=require('jsdom'),w=new JSDOM('<button id="workspace-attention"><em data-attention-summary></em><b data-attention-count></b></button>',{url:'https://workspace.example',runScripts:'outside-only'}).window;
 const bridge={workspace:{id:'w1'},listCrmCompanies:async()=>{throw timeout();}};
 try{
  Object.assign(w,{discoveryMounted:true,crmRefreshing:false,crmRefreshRevision:0,crmAvailable:true,crmCompanies:[{id:'cached-company'}],crmPipeline:[],discovery:{selectedProspects:[]},crmAuthenticated:()=>true,bridge:()=>bridge,hydrateLocalPipelineFromCrm(){},renderAll(){},scheduleSavedBuyerPublicChecks(){},LeadIntelWorkspacePersistence:{hasMeaningfulWorkspaceData:()=>false,hasUnsavedChanges:()=>false}});w.setInterval=()=>0;
  for(const file of ['background-task-centre.js','attention-centre-model.js','attention-centre.js'])w.eval(fs.readFileSync(require.resolve('../'+file),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.eval(refreshSource);assert.equal(await w.refreshCrmState(),false);w.LeadIntelAttention.refresh();
  w.document.getElementById('workspace-attention').click();assert.match(w.document.querySelector('.attention-list').textContent,/CRM connection needs attention/);assert.doesNotMatch(w.document.querySelector('.attention-list').textContent,/page component stopped unexpectedly/);
  Array.from(w.document.querySelectorAll('.attention-action')).find(button=>button.textContent==='Review task').click();
  const retry=w.document.querySelector('[data-task-action="retry"]');assert.ok(retry);bridge.listCrmCompanies=async()=>({ok:true,companies:[{id:'recovered-company'}]});retry.click();await new Promise(resolve=>setImmediate(resolve));w.LeadIntelAttention.refresh();
  assert.equal(w.LeadIntelTaskCentre.list()[0].status,'complete');assert.equal(w.LeadIntelAttention.list().some(item=>item.id.startsWith('task-crm-refresh:')),false);assert.equal(w.crmCompanies[0].id,'recovered-company');assert.equal(w.document.querySelector('[data-task-card] strong').textContent,'CRM connection refreshed');assert.equal(w.document.querySelector('[data-task-action=retry]'),null);
 }finally{w.close();}
});

test('a stored CRM failure regains its retry before Buyers mounts and stays failed until the scoped read succeeds',async()=>{
 const stored=new Map(),storage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
 const before=createTaskCentre({storage});before.start({id:'crm-refresh:w1',type:'crm-refresh',metadata:{workspaceId:'w1'},canRetry:true});before.fail('crm-refresh:w1','CRM refresh timed out');
 const tasks=createTaskCentre({storage}),r=runtime({tasks,list:async()=>({ok:true,companies:[{id:'restored'}]})});r.ctx.discoveryMounted=false;
 r.ctx.ensureDiscoveryMounted=options=>{assert.equal(options.refreshCrm,false);r.ctx.discoveryMounted=true;};
 assert.equal(tasks.hasAction('crm-refresh:w1','retry'),false);assert.equal(await r.ctx.refreshCrmState(),false);
 assert.equal(tasks.get('crm-refresh:w1').status,'error');assert.equal(tasks.hasAction('crm-refresh:w1','retry'),true);
 assert.equal(await tasks.retry('crm-refresh:w1'),true);assert.equal(tasks.get('crm-refresh:w1').status,'complete');assert.equal(r.ctx.crmCompanies[0].id,'restored');
});
test('malformed successful CRM responses cannot erase cached companies or clear their warning',async()=>{
 const r=runtime();await r.ctx.refreshCrmState();const before=JSON.stringify({companies:r.ctx.crmCompanies,pipeline:r.ctx.crmPipeline,discovery:r.ctx.discovery});
 r.bridge.listCrmCompanies=async()=>({ok:true,companies:null});
 await assert.rejects(r.ctx.refreshCrmState(),error=>error.code==='invalid_crm_response');
 assert.equal(JSON.stringify({companies:r.ctx.crmCompanies,pipeline:r.ctx.crmPipeline,discovery:r.ctx.discovery}),before);assert.equal(r.tasks.list()[0].status,'error');
});
test('an in-flight CRM read cannot apply after its bridge is replaced for the same workspace',async()=>{
 let release;const response=new Promise(resolve=>{release=resolve;}),r=runtime({list:()=>response}),pending=r.ctx.refreshCrmState();
 r.ctx.bridge=()=>({workspace:{id:'w1'}});release({ok:true,companies:[{id:'stale'}]});
 assert.equal(await pending,false);assert.equal(r.ctx.crmCompanies[0].id,'cached-company');
});
test('signing out during a CRM read prevents both data application and warning recovery',async()=>{
 let release;const response=new Promise(resolve=>{release=resolve;}),r=runtime({list:()=>response}),pending=r.ctx.refreshCrmState();
 r.ctx.crmAuthenticated=()=>false;release({ok:true,companies:[{id:'stale'}]});
 assert.equal(await pending,false);assert.equal(r.ctx.crmCompanies[0].id,'cached-company');
});
test('actual CRM refresh resolves only captured transport incidents after validated success, retaining an unknown component error',async()=>{
 const {JSDOM}=require('jsdom'),w=new JSDOM('<button id="workspace-attention"><em data-attention-summary></em><b data-attention-count></b></button>',{url:'https://workspace.example',runScripts:'outside-only'}).window;
 const b={workspace:{id:'w1'},listCrmCompanies:async()=>{throw timeout();}};
 try{
  Object.assign(w,{discoveryMounted:true,crmRefreshing:false,crmRefreshRevision:0,crmAvailable:true,crmCompanies:[{id:'cached'}],crmPipeline:[],discovery:{selectedProspects:[]},crmAuthenticated:()=>true,bridge:()=>b,LeadIntelServerBridge:b,hydrateLocalPipelineFromCrm(){},renderAll(){},scheduleSavedBuyerPublicChecks(){},LeadIntelWorkspacePersistence:{hasMeaningfulWorkspaceData:()=>false,hasUnsavedChanges:()=>false}});w.setInterval=()=>0;
  for(const file of ['background-task-centre.js','attention-centre-model.js','attention-centre.js'])w.eval(fs.readFileSync(require.resolve('../'+file),'utf8'));
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));w.eval(refreshSource);
  for(const error of [timeout(),new TypeError('A real render failure')]){const event=new w.Event('unhandledrejection');event.reason=error;w.dispatchEvent(event);}
  assert.equal(await w.refreshCrmState(),false);w.LeadIntelAttention.refresh();assert.equal(w.LeadIntelAttention.list().filter(item=>item.target.type==='runtime').length,2);
  b.listCrmCompanies=async()=>({ok:true,companies:[{id:'verified'}]});assert.equal(await w.refreshCrmState(),true);w.LeadIntelAttention.refresh();
  const items=w.LeadIntelAttention.list();assert.equal(items.length,1);assert.match(items[0].technical,/A real render failure/);assert.equal(w.LeadIntelTaskCentre.get('crm-refresh:w1').status,'complete');
 }finally{w.close();}
});
test('Discovery initialization rebinds a retained CRM retry when server-ready occurred before its listeners mounted',()=>{
 const tasks=createTaskCentre();tasks.start({id:'crm-refresh:w1',type:'crm-refresh',metadata:{workspaceId:'w1'}});tasks.fail('crm-refresh:w1','CRM refresh timed out');
 const r=runtime({tasks});r.ctx.discoveryMounted=false;
 for(const name of ['injectDiscoveryUI','bindDiscovery','openDiscoveryFromHandoff','pipelineRows','openCampaignResearch','researchCampaign','continueBuyerMessages','readyBuyerCount','renderSelectedEmailBuyer','startCompanyResearchFromStrategy','companySearchPlan'])r.ctx[name]=()=>{};
 r.ctx.mainState=()=>({step:1});r.ctx.loadMeta=()=>({});r.ctx.refreshCrmState=()=>assert.fail('Setup initialization must only register recovery actions, never invoke a CRM refresh');
 vm.runInContext(source.slice(source.indexOf('function initDiscovery(){'),source.indexOf('function initDiscoveryWhenReady(')),r.ctx);r.ctx.initDiscovery();
 assert.equal(tasks.hasAction('crm-refresh:w1','retry'),true);assert.equal(tasks.get('crm-refresh:w1').status,'error');assert.equal(r.ctx.discoveryMounted,false);
});
