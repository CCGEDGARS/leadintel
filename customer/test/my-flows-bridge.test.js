const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
async function fixture({saveFails=false,editDuringSwitch=false}={}){
 const dom=new JSDOM('<!doctype html><div class="top-actions"></div><span class="autosave"></span><div id="toast"></div>',{url:'https://app.test/customer/',runScripts:'outside-only'}),w=dom.window;
 w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify({website:'https://seller.test',targetMarkets:['Sweden'],myFlow:{id:'se',name:'Sweden'}}));w.localStorage.setItem('leadintel_customer_v2_workspace','w1');w.sessionStorage.setItem('leadintel_customer_v2_server_hydration','w1:1');let version=1,reloads=0;const calls=[];
 w.__testReload=()=>reloads++;
 w.fetch=async(url,options={})=>{const path=new URL(url).pathname,body=options.body&&JSON.parse(options.body);calls.push({path,body});let value={};let status=200;
 if(path==='/api/session')value={authenticated:true,user:{id:'u1',name:'Owner'}};
 else if(path==='/api/workspaces')value={workspaces:[{id:'w1',name:'Workspace',role:'owner'}]};
 else if(path==='/api/customer/state'&&options.method==='PUT'){if(saveFails){status=500;value={error:'Save unavailable'};}else value={saved:true,version:++version};}
 else if(path==='/api/customer/state')value={version,payload:{main:JSON.parse(w.localStorage.getItem('leadintel_customer_v2_state'))}};
 else if(path==='/api/flows/fi'){value={state:{version:++version,payload:{main:{website:'https://seller.test',targetMarkets:['Finland'],myFlow:{id:'fi',name:'Finland'}},discovery:{},outreach:{},delivery:{},meta:{discovery:{}}}}};if(editDuringSwitch){w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify({website:'https://seller.test',myFlow:{id:'se'},answers:{priority_offers:'Late edit'}}));}}
 else value={configured:false,connected:false};return new w.Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});};
 w.Response=Response;w.AbortController=AbortController;w.eval(fs.readFileSync(require.resolve('../server-bridge.js'),'utf8').replaceAll('location.reload()','window.__testReload()'));
 for(let i=0;i<15&&!w.LeadIntelServerBridge.ready;i++)await tick();assert.equal(w.LeadIntelServerBridge.ready,true);return {w,dom,calls,reloads:()=>reloads};
}
test('flow switch saves the current flow before applying and reloading the target',async()=>{const f=await fixture();await f.w.LeadIntelServerBridge.openSavedFlow('fi',1);const writes=f.calls.filter(c=>c.body);assert.equal(writes[0].path,'/api/customer/state');assert.equal(writes[1].path,'/api/flows/fi');assert.equal(writes[1].body.workspaceVersion,2);assert.equal(JSON.parse(f.w.localStorage.getItem('leadintel_customer_v2_state')).myFlow.id,'fi');assert.equal(f.reloads(),1);f.dom.window.close();});
test('save failure prevents a flow switch and retains local work',async()=>{const f=await fixture({saveFails:true});await assert.rejects(()=>f.w.LeadIntelServerBridge.openSavedFlow('fi',1),/Save unavailable/);assert.equal(f.calls.some(c=>c.path==='/api/flows/fi'),false);assert.equal(JSON.parse(f.w.localStorage.getItem('leadintel_customer_v2_state')).myFlow.id,'se');f.dom.window.close();});
test('a late edit during switching is preserved and blocks applying another flow',async()=>{const f=await fixture({editDuringSwitch:true});await assert.rejects(()=>f.w.LeadIntelServerBridge.openSavedFlow('fi',1),/preserved/);assert.equal(f.w.LeadIntelServerBridge.conflict,true);assert.equal(JSON.parse(f.w.localStorage.getItem('leadintel_customer_v2_state')).answers.priority_offers,'Late edit');assert.equal(f.reloads(),0);f.dom.window.close();});
