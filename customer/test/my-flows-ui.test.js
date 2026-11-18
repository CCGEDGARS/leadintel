const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const F=require('../my-flows.js');const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){const dom=new JSDOM('<!doctype html><div class="sidebar"><button class="wf-open"><strong>My Flows</strong><small data-flow-summary></small></button></div><header><div class="top-actions"></div></header><main></main>',{url:'https://app.test/customer/',runScripts:'outside-only'}),w=dom.window;w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};w.HTMLElement.prototype.scrollIntoView=function(){};w.LeadIntelFlowState=F;const calls=[],opens=[],automation=[];let save=true;const data={role:'owner',currentId:'se',activeCount:1,limits:{saved:10,active:2},flows:[{id:'se',name:'Seller <unsafe> — Sweden',status:'automatic',revision:3,review:[],readiness:'Approved',summary:{markets:['Sweden'],triggers:['Expansion'],template:'professional',language:'en',roles:['COO'],sources:[],companies:3,buyers:4,dailyLimit:5},updatedAt:new Date().toISOString(),metrics:{period:'Last 30 days · email',providerConfirmedSent:2}},{id:'fi',name:'Finland',status:'paused',revision:1,review:[{id:'markets',label:'Confirm target markets'}],readiness:'Review required',summary:{markets:['Finland'],triggers:[],template:'professional',language:'en',roles:[],sources:[],companies:0,buyers:0},updatedAt:new Date().toISOString(),metrics:{providerConfirmedSent:0}}]};w.LeadIntelServerBridge={workspace:{id:'w1'},session:{authenticated:true},stateVersion:7,saveNow:async()=>({saved:save}),openSavedFlow:async(...args)=>opens.push(args)};w.LeadIntelApprovedWorkflow={openAutomation:id=>automation.push(id)};w.fetch=async(url,opts)=>{calls.push({url,body:opts.body&&JSON.parse(opts.body)});return {ok:true,json:async()=>url.includes('/api/flows/se?')&&!opts.body?{revision:3}:structuredClone(data)}};w.eval(fs.readFileSync(require.resolve('../my-flows-ui.js'),'utf8'));return {w,dom,data,calls,opens,automation,setSave:v=>save=v};}
test('library displays truthful summaries, opens any paused flow manually, and routes per-flow automation',async()=>{const f=fixture();f.w.LeadIntelMyFlows.open();await tick();assert.equal(f.w.document.querySelector('[data-flow-summary]').textContent,'1 active · 2 saved');assert.match(f.w.document.body.textContent,/2 \/ 10 saved flows/);assert.match(f.w.document.body.textContent,/1 \/ 2 active/);assert.match(f.w.document.body.textContent,/Not tracked/);assert.equal(f.w.document.querySelector('unsafe'),null);f.w.document.querySelector('[data-flow-open="fi"]').click();await tick();assert.deepEqual(f.opens,[['fi',1]]);f.w.document.querySelector('[data-flow-automation="fi"]').click();assert.deepEqual(f.automation,['fi']);f.dom.window.close();});
test('failed save prevents current setup creation and preserves settings for retry',async()=>{const f=fixture();f.w.LeadIntelMyFlows.open();await tick();f.setSave(false);const form=f.w.document.querySelector('[data-flows-create]');form.querySelector('input').value='Saved setup';form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(f.calls.length,1);assert.match(f.w.document.querySelector('[data-flows-notice]').textContent,/preserved/);f.setSave(true);form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();assert.equal(f.calls[1].body.action,'create');assert.equal(f.calls[1].body.workspaceVersion,7);f.dom.window.close();});
test('duplicate sends market-specific configuration and exact selected flow revision',async()=>{const f=fixture();f.w.LeadIntelMyFlows.open();await tick();f.w.document.querySelector('[data-flow-duplicate="se"]').click();const form=f.w.document.querySelector('[data-flow-editor]');form.querySelector('[name=name]').value='Finland';form.querySelector('[name=markets]').value='Finland';form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await tick();const body=f.calls.find(c=>c.body?.action==='duplicate').body;assert.deepEqual(body,{action:'duplicate',name:'Finland',markets:['Finland'],revision:3});assert.match(f.w.document.querySelector('[data-flows-notice]').textContent,/paused/);f.dom.window.close();});
test('workspace changes clear private cached cards before refresh and reject old mutations',async()=>{const f=fixture();f.w.LeadIntelMyFlows.open();await tick();f.w.LeadIntelServerBridge.workspace.id='w2';f.w.LeadIntelServerBridge.session.authenticated=false;await f.w.LeadIntelMyFlows.refreshSummary();await f.w.LeadIntelMyFlows.refresh();assert.equal(f.w.document.querySelector('[data-flow-summary]').textContent,'Sign in to manage flows');assert.equal(f.w.document.querySelectorAll('.mf-card').length,0);assert.match(f.w.document.querySelector('[data-flows-notice]').textContent,/Sign in/);f.dom.window.close();});
test('profile normalization keeps flow identity through real seven-step loads',()=>{const P=require('../profile-engine.js');const state=P.normalizeSavedState({myFlow:{id:'saved-fi',name:'Finland',stateVersion:4},website:'https://seller.test',targetMarkets:['Finland']});assert.equal(state.myFlow.id,'saved-fi');assert.equal(state.myFlow.name,'Finland');});
test('selector restores the authenticated saved workflow and never leaks cached names after account changes',async()=>{
 const f=fixture();await f.w.LeadIntelMyFlows.refreshSummary();assert.equal(f.w.LeadIntelMyFlows.current().id,'se');
 f.w.LeadIntelServerBridge.workspace.id='other';assert.equal(f.w.LeadIntelMyFlows.current(),null);
 f.w.dispatchEvent(new f.w.CustomEvent('leadintel:workspace-changed'));assert.equal(f.w.LeadIntelMyFlows.listSummary(),null);f.dom.window.close();
});
test('a protected version flushes local changes and uses the post-save revision',async()=>{
 const f=fixture();f.data.flows[0].snapshotPolicy='pinned';f.data.flows[0].savedVersion=1;f.w.LeadIntelMyFlows.open();await tick();
 const button=f.w.document.querySelector('[data-flow-checkpoint="se"]');assert.ok(button);button.click();await tick();await tick();
 const saved=f.calls.find(c=>c.body?.action==='checkpoint');assert.equal(saved.body.workspaceVersion,7);assert.equal(saved.body.revision,3);assert.match(f.w.document.querySelector('[data-flows-notice]').textContent,/Protected version saved/);f.dom.window.close();
});

test('concurrent selector refreshes share one request and keep the last workflow visible while refreshing',async()=>{
 const f=fixture();await f.w.LeadIntelMyFlows.refreshSummary();
 let release;const gate=new Promise(resolve=>release=resolve),fetch=f.w.fetch;f.w.fetch=async(...args)=>{await gate;return fetch(...args);};
 const pending=Array.from({length:10},()=>f.w.LeadIntelMyFlows.refreshSummary());
 assert.equal(f.w.LeadIntelMyFlows.current().id,'se');assert.equal(f.w.document.querySelector('[data-flow-summary]').textContent,'1 active · 2 saved');
 release();await Promise.all(pending);assert.equal(f.calls.length,2,'one initial request and one shared refresh');f.dom.window.close();
});

test('fresh focus reuses the summary, but a changed saved revision refreshes it',async()=>{
 const f=fixture();await f.w.LeadIntelMyFlows.refreshSummary();
 for(let i=0;i<10;i++)f.w.dispatchEvent(new f.w.Event('focus'));await tick();assert.equal(f.calls.length,1);
 f.w.LeadIntelServerBridge.stateVersion++;f.w.dispatchEvent(new f.w.Event('focus'));await tick();assert.equal(f.calls.length,2);
 await f.w.LeadIntelMyFlows.refreshSummary();assert.equal(f.calls.length,3,'explicit refresh must still read the server');f.dom.window.close();
});

test('workflow switch uses the lightweight selector instead of loading all workflow contents and metrics',async()=>{
 const f=fixture();await f.w.LeadIntelMyFlows.selectFlow('fi');assert.match(f.calls[0].url,/view=selector/);assert.deepEqual(f.opens,[['fi',1]]);f.dom.window.close();
});

test('a delayed old-account summary cannot replace the new account workflow',async()=>{
 const f=fixture();let release;const gate=new Promise(resolve=>release=resolve),fetch=f.w.fetch;
 f.w.fetch=async(...args)=>{if(args[0].includes('workspace_id=w1'))await gate;return fetch(...args);};
 const old=f.w.LeadIntelMyFlows.refreshSummary();f.w.LeadIntelServerBridge.workspace.id='w2';f.w.dispatchEvent(new f.w.CustomEvent('leadintel:workspace-changed'));
 f.data.currentId='fi';await f.w.LeadIntelMyFlows.refreshSummary();assert.equal(f.w.LeadIntelMyFlows.current().id,'fi');release();await old;assert.equal(f.w.LeadIntelMyFlows.current().id,'fi');f.dom.window.close();
});

test('an unresponsive body reader cannot hold the workflow selector busy beyond its deadline',async()=>{
 const f=fixture(),fetch=f.w.fetch,timer=f.w.setTimeout;let deadline;
 f.w.setTimeout=(callback,ms,...args)=>ms===20000?(deadline=callback,99):timer(callback,ms,...args);
 f.w.fetch=async()=>({ok:true,json:()=>new Promise(()=>{})});
 const pending=f.w.LeadIntelMyFlows.refreshSummary();deadline();await pending;
 assert.match(f.w.document.querySelector('[data-flow-summary]').textContent,/unavailable/);
 f.w.fetch=fetch;f.w.setTimeout=timer;await f.w.LeadIntelMyFlows.refreshSummary();assert.equal(f.w.LeadIntelMyFlows.current().id,'se');f.dom.window.close();
});

test('a save during an in-flight summary triggers one follow-up read instead of leaving stale workflow status',async()=>{
 const f=fixture();let release,reads=0;const gate=new Promise(resolve=>release=resolve);
 f.w.fetch=async()=>{const result=structuredClone(f.data);if(++reads===1)await gate;return {ok:true,json:async()=>result};};
 const first=f.w.LeadIntelMyFlows.refreshSummary();f.data.flows[0].status='paused';f.w.LeadIntelServerBridge.stateVersion++;
 const pending=f.w.LeadIntelMyFlows.refreshSummary({force:false});release();await Promise.all([first,pending]);assert.equal(reads,2);assert.equal(f.w.LeadIntelMyFlows.current().status,'paused');f.dom.window.close();
});
