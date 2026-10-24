const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const read=name=>fs.readFileSync(require.resolve('../'+name),'utf8');
function bridgeRuntime(api){
 const bridge={session:{authenticated:true,user:{id:'u1'}},workspace:{id:'w1'}},root={LeadIntelServerBridge:null};root.LeadIntelServerBridge=bridge;
 const source=read('server-bridge.js'),ctx={bridge,root,api,URLSearchParams};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('async function readWorkspaceResource('),source.indexOf('async function crmRequest(')),ctx);
 return {ctx,bridge,root};
}
test('commercial read methods require the captured authenticated workspace and never request a mutation',async()=>{
 const calls=[],r=bridgeRuntime(async(path,options)=>{calls.push({path,options});return {response:{ok:true,status:200},payload:{workspaceId:'w1'}};});
 assert.equal((await r.ctx.getResearchCosts({workspaceId:'w2'})).status,409);assert.equal(calls.length,0);
 assert.equal((await r.ctx.getResearchCosts({start:'2026-10-01',end:'2026-11-01'})).ok,true);assert.match(calls[0].path,/workspace_id=w1/);assert.equal(calls[0].options.method,'GET');
 await r.ctx.listConversations();assert.match(calls[1].path,/^\/api\/conversations\?/);assert.equal(calls[1].options.method,'GET');
 r.bridge.session.authenticated=false;assert.equal((await r.ctx.getResearchCosts()).status,401);assert.equal(calls.length,2);
});
test('late commercial reads cannot expose data after same-workspace account replacement',async()=>{
 let resolve;const r=bridgeRuntime(()=>new Promise(done=>{resolve=done;}));const result=r.ctx.getResearchCosts();
 r.bridge.session={authenticated:true,user:{id:'u2'}};resolve({response:{ok:true,status:200},payload:{workspaceId:'w1',secret:'old viewer'}});
 const value=await result;assert.equal(value.status,409);assert.equal(value.secret,undefined);
});
test('cost disclosure is lazy, read-only and drops the old panel on workspace changes',async()=>{
 const dom=new JSDOM('<div id="crm-insights-slot"></div>',{url:'https://example.test/customer/',runScripts:'outside-only'}),w=dom.window,calls=[];
 try{
  w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'u1'}},workspace:{id:'w1'},getResearchCosts:async options=>{calls.push(options);return {ok:true,workspaceId:options.workspaceId,period:{start:options.start,end:options.end},providers:[],confirmedSpend:[],contacts:{}};}};
  w.eval(read('research-costs.js'));w.eval(read('commercial-insights-loader.js').replace(/^import .*;\s*$/gm,''));
  w.dispatchEvent(new w.CustomEvent('leadintel:crm-opened'));const details=w.document.querySelector('.commercial-insights');assert.ok(details);assert.equal(calls.length,0);
  details.open=true;details.dispatchEvent(new w.Event('toggle'));await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(calls[0].workspaceId,'w1');assert.match(details.textContent,/incomplete coverage/);
  w.LeadIntelServerBridge.workspace={id:'w2'};w.dispatchEvent(new w.CustomEvent('leadintel:workspace-changed'));assert.equal(details.open,false);assert.equal(details.querySelector('.research-costs'),null);assert.equal(calls.length,1);
 }finally{w.close();}
});
test('an optional commercial panel failure cannot prevent the core CRM from loading',async()=>{
 const source=read('shell-support-loader.js'),loaded=[],events=[];
 const ctx={SUPPORT_MODULES:[],load:async path=>{loaded.push(path);if(path.includes('commercial-insights-loader'))throw Error('Optional panel unavailable');},console:{warn(){}},window:{dispatchEvent:event=>events.push(event)},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('async function loadSupportModules('),source.indexOf("window.addEventListener('load'",source.indexOf('async function loadSupportModules('))).replace(/\bimport\(/g,'load('),ctx);
 await ctx.loadSupportModules();assert.ok(loaded.some(path=>path.includes('crm-ui.js')));assert.equal(events[0].detail.failed,1);
});
