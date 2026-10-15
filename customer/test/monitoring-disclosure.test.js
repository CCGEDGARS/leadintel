const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('customer/index.html','utf8');
const app=fs.readFileSync('customer/app.js','utf8');
function setup(){
 const window=new JSDOM(html,{url:"https://leadintel.test"}).window,document=window.document,$=id=>document.getElementById(id);
 const config={enabled:true,frequency:'weekly',researchDepth:'deep',minimumScore:70,sourceTypes:['news'],signalIds:['signal'],customSources:['https://example.com/news']};
 const state={market:{strategyApproved:true,signals:[{id:'signal',name:'Expansion',active:true}],monitoring:{...config}}};
 const calls=[];
 const context={window,document,$,state,monitoringBusy:false,monitoringDraftBaseline:null,monitoringDraftMarket:null,esc:String,saveState(){},showToast(){},LeadIntelMarket:{normalizeMonitoring:c=>({...config,...c}),SOURCE_TYPES:{news:{}},filterResearchSourceTypes:s=>s},monitoringApi:async(path,options)=>{calls.push(JSON.parse(options.body));return {config:{}};}};
 window.LeadIntelWorkspacePersistence={saveWorkspace:async()=>true};
 const dialog=$('monitoring-close-dialog');if(dialog){dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;}
 vm.createContext(context);
 vm.runInContext(app.slice((app.includes('function monitoringFormSnapshot(')?app.indexOf('function monitoringFormSnapshot('):app.indexOf('function renderMonitoringControls(')),app.indexOf('async function markMonitoringAlertRead(')),context);
 return {...context,context,calls};
}
test('monitoring is optional and closed initially with an accessible explicit button',()=>{
 const document=new JSDOM(html).window.document;
 assert.equal(document.getElementById('monitoring-settings')?.hidden,true);
 const toggle=document.getElementById('toggle-monitoring-settings');
 assert.equal(toggle?.getAttribute('aria-expanded'),'false');
 assert.equal(toggle?.getAttribute('aria-controls'),'monitoring-settings');
 assert.match(document.getElementById('monitoring-panel').textContent,/Optional/);
});
test('open and close leave enabled configuration intact; reopening retains saved values',()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 assert.equal(c.$('monitoring-settings').hidden,false);
 assert.equal(c.$('toggle-monitoring-settings').querySelector('[data-monitoring-action-label]')?.textContent,'Close settings');
 assert.equal(c.$('toggle-monitoring-settings').querySelector('[aria-hidden]')?.textContent,'↑');
 c.context.requestCloseMonitoringSettings();
 assert.equal(c.$('monitoring-settings').hidden,true);
 assert.equal(c.state.market.monitoring.enabled,true);
 c.context.openMonitoringSettings();assert.equal(c.$('monitoring-enabled').checked,true);
});
test('dirty close offers choices; keep editing preserves draft and discard restores saved values',()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 c.$('monitoring-frequency').value='daily';c.context.requestCloseMonitoringSettings();
 assert.equal(c.$('monitoring-close-dialog').open,true);
 c.context.keepEditingMonitoring();assert.equal(c.$('monitoring-frequency').value,'daily');
 c.context.renderMonitoringControls();assert.equal(c.$('monitoring-frequency').value,'daily');
 c.context.discardMonitoringEdits();assert.equal(c.state.market.monitoring.frequency,'weekly');
 c.context.openMonitoringSettings();assert.equal(c.$('monitoring-frequency').value,'weekly');
});
test('save captures edits before rendering and closes only after server success',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 c.$('monitoring-frequency').value='daily';c.$('monitoring-custom-sources').value='https://example.org/projects';
 assert.equal(await c.context.saveMonitoringConfig(),true);
 assert.equal(c.calls[0].frequency,'daily');assert.deepEqual(c.calls[0].custom_sources,['https://example.org/projects']);
 assert.equal(c.state.market.monitoring.frequency,'daily');assert.equal(c.$('monitoring-settings').hidden,true);
 c.context.openMonitoringSettings();assert.equal(c.$('monitoring-frequency').value,'daily');
});
test('failed save keeps draft open and retains previous saved settings',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 c.$('monitoring-frequency').value='daily';c.context.monitoringApi=async()=>{throw Error('offline');};
 assert.equal(await c.context.saveMonitoringConfig(),false);
 assert.equal(c.$('monitoring-settings').hidden,false);assert.equal(c.$('monitoring-frequency').value,'daily');
 assert.equal(c.state.market.monitoring.frequency,'weekly');
});
test('turning monitoring off requires saving; closing alone never disables it',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 c.$('monitoring-enabled').checked=false;c.context.requestCloseMonitoringSettings();
 assert.equal(c.state.market.monitoring.enabled,true);assert.equal(c.calls.length,0);
 await c.context.saveMonitoringConfig();assert.equal(c.calls[0].enabled,false);assert.equal(c.state.market.monitoring.enabled,false);
 assert.equal(c.$('monitoring-summary-status').textContent,'Off');
});
test('locked strategy does not prevent opening or closing the optional panel',async()=>{
 const c=setup();c.state.market.strategyApproved=false;c.context.renderMonitoringControls();
 c.context.openMonitoringSettings();assert.equal(c.$('monitoring-settings').hidden,false);
 assert.equal(await c.context.saveMonitoringConfig(),false);assert.equal(c.calls.length,0);
 c.context.requestCloseMonitoringSettings();assert.equal(c.$('monitoring-settings').hidden,true);
});
test('Run now refuses unsaved changes without mutating saved configuration',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 c.$('monitoring-frequency').value='daily';c.$('monitoring-enabled').checked=false;
 await c.context.runMonitoringNow();assert.equal(c.calls.length,0);
 c.context.discardMonitoringEdits();assert.equal(c.state.market.monitoring.frequency,'weekly');assert.equal(c.state.market.monitoring.enabled,true);
});
test('pending save freezes form and competing dialog actions, then returns focus to toggle',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();c.$('monitoring-frequency').value='daily';c.context.requestCloseMonitoringSettings();
 let resolve;c.context.monitoringApi=()=>new Promise(r=>resolve=r);
 const pending=c.context.saveMonitoringConfig();await new Promise(r=>setImmediate(r));
 for(const id of ['monitoring-frequency','monitoring-custom-sources','discard-monitoring-close','keep-editing-monitoring'])assert.equal(c.$(id).disabled,true,id);
 resolve({config:{}});await pending;
 assert.equal(c.document.activeElement.id,'toggle-monitoring-settings');assert.equal(c.$('monitoring-frequency').disabled,false);
});
test('switching workspace state replaces old draft instead of retaining previous workspace inputs',()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();c.$('monitoring-custom-sources').value='https://private-old.example';
 c.state.market={...c.state.market,monitoring:{...c.state.market.monitoring,customSources:['https://new.example']}};
 c.context.renderMonitoringControls();assert.equal(c.$('monitoring-custom-sources').value,'https://new.example');
});
test('late monitoring save cannot replace a newly loaded workspace or its saved configuration',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();c.$('monitoring-frequency').value='daily';
 let resolve;c.context.monitoringApi=()=>new Promise(r=>resolve=r);
 const pending=c.context.saveMonitoringConfig();await new Promise(r=>setImmediate(r));
 c.state.market={strategyApproved:true,signals:[],monitoring:{enabled:false,frequency:'monthly',customSources:['https://new.example']}};
 const next=c.state.market.monitoring;resolve({config:{enabled:true,frequency:'daily',customSources:['https://old.example']}});
 assert.equal(await pending,false);assert.equal(c.state.market.monitoring.enabled,false);assert.equal(c.state.market.monitoring.frequency,next.frequency);
 assert.deepEqual(c.state.market.monitoring.customSources,next.customSources);
});
test('failed old monitoring save cannot roll previous workspace configuration into a new workspace',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 let reject;c.context.monitoringApi=()=>new Promise((_,r)=>reject=r);
 const pending=c.context.saveMonitoringConfig();await new Promise(r=>setImmediate(r));
 c.state.market={strategyApproved:true,signals:[],monitoring:{enabled:false,frequency:'monthly',customSources:['https://new.example']}};
 reject(Error('Workspace changed'));await pending;
 assert.equal(c.state.market.monitoring.enabled,false);assert.equal(c.state.market.monitoring.frequency,'monthly');
});
test('failed monitoring load retries and a new market reloads instead of sharing a global loaded flag',async()=>{
 const c=setup();c.context.monitoringLoaded=false;c.context.waitForMarketServerBridge=async()=>({session:{authenticated:true},workspace:{id:'a'}});
 let attempts=0;c.context.monitoringApi=async()=>{attempts++;throw Error('offline');};
 await c.context.loadMonitoringServerState();await c.context.loadMonitoringServerState();assert.equal(attempts,6);
 c.context.monitoringApi=async()=>({config:{enabled:false,frequency:'monthly'},alerts:[],runs:[]});
 await c.context.loadMonitoringServerState();assert.equal(c.state.market.monitoring.frequency,'monthly');
 c.state.market={...c.state.market,monitoring:{enabled:false,frequency:'daily'}};
 await c.context.loadMonitoringServerState();assert.equal(c.state.market.monitoring.frequency,'monthly');
});
test('delayed monitoring load does not write server config into replaced active market',async()=>{
 const c=setup();c.context.monitoringLoaded=false;c.context.waitForMarketServerBridge=async()=>({session:{authenticated:true},workspace:{id:'a'}});
 // Resolve all three endpoints together after the state changes.
 const deferred=[];c.context.monitoringApi=()=>new Promise(r=>deferred.push(r));
 const pending=c.context.loadMonitoringServerState();await new Promise(r=>setImmediate(r));
 c.state.market={strategyApproved:true,signals:[],monitoring:{enabled:false,frequency:'monthly',customSources:['https://new.example']}};
 deferred.forEach(r=>r({config:{enabled:true,frequency:'daily'},alerts:[],runs:[]}));await pending;
 assert.equal(c.state.market.monitoring.enabled,false);assert.equal(c.state.market.monitoring.frequency,'monthly');
});
test('failed immediate off save restores the confirmed switch while retaining other draft edits',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 c.$('monitoring-enabled').checked=false;c.$('monitoring-frequency').value='daily';
 c.context.monitoringApi=async()=>{throw Error('offline');};await c.context.saveMonitoringConfig({closeAfterSave:false});
 assert.equal(c.$('monitoring-enabled').checked,true);assert.equal(c.$('monitoring-frequency').value,'daily');
 assert.match(c.$('monitoring-status').textContent,/Not saved/);
});
test('removing a research website preserves separately saved monitoring scope and states what changed',()=>{
 const c=setup();c.state.market.researchCustomSources=['https://example.com/news'];let notice='';
 Object.assign(c.context,{LeadIntelProfile:{normalizeUrl:s=>s},renderResearchControls(){},showToast:s=>notice=s});
 vm.runInContext(app.slice(app.indexOf('function removeSavedResearchWebsite('),app.indexOf('function renderResearchControls(')),c.context);
 c.context.removeSavedResearchWebsite('https://example.com/news');
 assert.deepEqual(c.state.market.researchCustomSources,[]);
 assert.deepEqual(c.state.market.monitoring.customSources,['https://example.com/news']);
 assert.match(notice,/monitoring settings/i);
});
test('a late old save releases the new workspace controls without closing its panel',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 let resolve;c.context.monitoringApi=()=>new Promise(r=>resolve=r);
 const pending=c.context.saveMonitoringConfig();await new Promise(r=>setImmediate(r));
 c.state.market={strategyApproved:true,signals:[],monitoring:{enabled:false,frequency:'monthly'}};c.context.renderMonitoringControls();
 assert.equal(c.$('toggle-monitoring-settings').disabled,true);
 resolve({config:{enabled:true}});await pending;
 assert.equal(c.$('toggle-monitoring-settings').disabled,false);assert.equal(c.$('monitoring-frequency').disabled,false);
 assert.equal(c.$('monitoring-settings').hidden,false);assert.notEqual(c.$('monitoring-summary-status').textContent,'Saving…');
});
