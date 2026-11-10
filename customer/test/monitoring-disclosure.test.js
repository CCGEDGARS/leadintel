const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const I=require('../strategy-integrity.js'),Market=require('../market-engine.js');
function serverConfig(body,revision=2){return Market.normalizeMonitoring({enabled:body.enabled,frequency:body.frequency,researchDepth:body.research_depth,minimumScore:body.minimum_score,sourceTypes:body.source_types,signalIds:body.signal_ids,customSources:body.custom_sources,revision});}
const html=fs.readFileSync('customer/index.html','utf8');
const app=fs.readFileSync('customer/app.js','utf8');
function setup(){
 const window=new JSDOM(html,{url:"https://leadintel.test"}).window,document=window.document,$=id=>document.getElementById(id);
 const config={revision:1,enabled:true,frequency:'weekly',researchDepth:'deep',minimumScore:70,sourceTypes:['news'],signalIds:['signal'],customSources:['https://example.com/news']};
 const state={website:'https://seller.example',approved:true,profile:{priorityOffers:'Industrial automation',targetMarkets:'Finland'},market:{strategyApproved:true,icps:[{id:'core',active:true}],signals:[{id:'signal',name:'Expansion',keywords:'expansion',weight:7,active:true}],monitoring:{...config}}};state.market.strategyApproval=I.approval(state);
 window.LeadIntelStrategyIntegrity=I;window.LeadIntelServerBridge={ready:true,workspace:{id:'w1'},session:{authenticated:true,user:{id:'u1'}}};window.LeadIntelAccountCache={current:()=>true};
 const calls=[];
 const context={window,document,$,state,monitoringBusy:false,monitoringLoaded:false,monitoringRequestSerial:0,monitoringDraftBaseline:null,monitoringDraftMarket:null,monitoringApprovalContext:null,closeStrategyHandoff(){},esc:String,saveState(){},showToast(){},LeadIntelMarket:Market,waitForMarketServerBridge:async()=>window.LeadIntelServerBridge,monitoringApi:async(path,options={})=>{if(options.method==='PUT'){const body=JSON.parse(options.body);calls.push(body);return {saved:true,config:serverConfig(body)};}return path.endsWith('/config')?{config:{...config}}:path.endsWith('/alerts')?{alerts:[]}:{runs:[]};}};
 window.LeadIntelWorkspacePersistence={saveWorkspace:async()=>true};
 const dialog=$('monitoring-close-dialog');if(dialog){dialog.showModal=()=>dialog.open=true;dialog.close=()=>dialog.open=false;}
 vm.createContext(context);
 vm.runInContext(app.slice(app.indexOf('function strategyIntegrity(){'),app.indexOf('function captureStrategyContext(')),context);
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
test('monitoring intent survives required Profile review without approving it automatically',()=>{
 const c=setup();c.state.approved=false;c.state.step=3;let reviews=0;c.context.setStep=()=>false;c.context.openStrategyHandoff=()=>reviews++;
 assert.equal(c.context.beginMonitoringApproval(),false);assert.equal(c.$('monitoring-approval-guide').hidden,false);assert.equal(c.state.approved,false);
 assert.equal(c.context.continueMonitoringApproval(),false);assert.equal(reviews,0);
 c.state.approved=true;c.context.setStep=step=>{assert.equal(step,4);return true;};
 assert.equal(c.context.continueMonitoringApproval(),true);assert.equal(reviews,1);
});
for(const change of ['workspace','user','seller','market'])test('monitoring continuation is discarded after '+change+' changes',()=>{
 const c=setup();c.context.setStep=()=>false;c.context.beginMonitoringApproval();let returned=0;c.context.window.LeadIntelWebsiteScanUI={openMonitoring:()=>{returned++;return true;}};
 if(change==='workspace')c.window.LeadIntelServerBridge.workspace.id='other';if(change==='user')c.window.LeadIntelServerBridge.session.user.id='other';if(change==='seller')c.state.website='https://other.example/';if(change==='market')c.state.targetMarkets=['Other country'];
 assert.equal(c.context.returnToMonitoring(),false);assert.equal(returned,0);assert.equal(c.context.monitoringApprovalContext,null);
});
test('cancel returns to the actual monitoring wrapper and consumes the continuation without enabling it',()=>{
 const c=setup();c.state.market.monitoring.enabled=false;c.context.setStep=()=>false;c.context.beginMonitoringApproval();const opened=[];
 c.context.setStep=step=>{opened.push(step);return true;};c.window.LeadIntelWebsiteScanUI={openMonitoring:()=>{opened.push('monitoring');return true;}};
 assert.equal(c.context.returnToMonitoring(),true);assert.deepEqual(opened,[2,'monitoring']);assert.equal(c.context.monitoringApprovalContext,null);assert.equal(c.state.market.monitoring.enabled,false);assert.equal(c.$('monitoring-approval-guide').hidden,true);
});
test('a stale return ticket cannot consume a replacement monitoring review',()=>{
 const c=setup();c.context.setStep=()=>false;c.context.beginMonitoringApproval();const old=c.context.monitoringApprovalContext;c.context.beginMonitoringApproval();const replacement=c.context.monitoringApprovalContext;
 assert.equal(c.context.returnToMonitoring(old),false);assert.equal(c.context.monitoringApprovalContext,replacement);
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
test('inactive Strategy allows saving an off monitoring draft, without enabling a schedule',async()=>{
 const c=setup();c.state.market.strategyApproved=false;c.state.market.monitoring.enabled=false;
 c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 c.$('monitoring-frequency').value='daily';c.$('monitoring-depth').value='quick';c.$('monitoring-custom-sources').value='https://jobindex.dk/';
 assert.equal(c.$('save-monitoring').disabled,false);
 assert.equal(c.$('monitoring-enabled').disabled,true);assert.equal(c.$('run-monitoring-now').disabled,true);
 assert.equal(c.$('monitoring-review-strategy').hidden,false);
 assert.equal(await c.context.saveMonitoringConfig(),true);assert.equal(c.calls[0].enabled,false);
 c.context.openMonitoringSettings();assert.equal(c.$('monitoring-frequency').value,'daily');
 assert.equal(c.$('monitoring-depth').value,'quick');assert.match(c.$('monitoring-saved-summary').textContent,/Saved:.*Daily.*Quick/);
});
test('stale Strategy approval cannot unlock monitoring through the legacy approved boolean',()=>{
 const c=setup();c.state.market.monitoring.enabled=false;c.state.profile.priorityOffers='Changed offer';
 c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 assert.equal(c.state.market.strategyApproved,true);assert.equal(c.$('monitoring-enabled').disabled,true);
 assert.equal(c.$('run-monitoring-now').disabled,true);assert.equal(c.$('save-monitoring').disabled,false);
});
test('unsaved settings are labelled and a manual run explains why it cannot start',()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 c.$('monitoring-frequency').value='daily';c.$('monitoring-depth').value='quick';c.context.updateMonitoringDisclosure();
 assert.match(c.$('monitoring-saved-summary').textContent,/Saved:.*Weekly.*Deep/);
 assert.match(c.$('monitoring-status').textContent,/Unsaved changes/);assert.equal(c.$('run-monitoring-now').disabled,true);
});
test('opening monitoring from Profile loads authoritative settings without visiting Strategy',async()=>{
 const c=setup();let reads=0;
 c.context.monitoringApi=async path=>{reads++;return path.endsWith('/config')?{config:{enabled:false,frequency:'monthly',researchDepth:'quick',revision:7,customSources:['https://saved.example/news']}}:{alerts:[],runs:[]};};
 c.context.openMonitoringSettings();await new Promise(r=>setImmediate(r));
 assert.equal(reads,3);assert.equal(c.state.market.monitoring.revision,7);assert.equal(c.$('monitoring-frequency').value,'monthly');assert.equal(c.$('monitoring-custom-sources').value,'https://saved.example/news');
});
test('retired saved signals expose the active choices and block a misleading manual run',()=>{
 const c=setup();c.state.market.signals=[{id:'replacement',active:true,name:'New production project',keywords:'production',weight:7}];c.state.market.strategyApproval=I.approval(c.state);
 c.context.renderMonitoringControls();assert.match(c.$('monitoring-status').textContent,/saved buying signals have changed/);
 assert.equal(c.$('monitoring-advanced').open,true);assert.equal(c.$('run-monitoring-now').disabled,true);
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
 resolve({saved:true,config:{...c.state.market.monitoring,frequency:'daily',revision:2}});await pending;
 assert.equal(c.document.activeElement.id,'toggle-monitoring-settings');assert.equal(c.$('monitoring-frequency').disabled,false);
});
test('switching workspace state replaces old draft instead of retaining previous workspace inputs',()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();c.$('monitoring-custom-sources').value='https://private-old.example';
 c.state.market={...c.state.market,monitoring:{...c.state.market.monitoring,customSources:['https://new.example/']}};
 c.context.renderMonitoringControls();assert.equal(c.$('monitoring-custom-sources').value,'https://new.example/');
});
test('late monitoring save cannot replace a newly loaded workspace or its saved configuration',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();c.$('monitoring-frequency').value='daily';
 let resolve;c.context.monitoringApi=()=>new Promise(r=>resolve=r);
 const pending=c.context.saveMonitoringConfig();await new Promise(r=>setImmediate(r));
 c.state.market={strategyApproved:true,signals:[],monitoring:{enabled:false,frequency:'monthly',customSources:['https://new.example/']}};
 c.window.LeadIntelServerBridge.workspace.id='w2';const next=c.state.market.monitoring;resolve({saved:true,config:{enabled:true,frequency:'daily',customSources:['https://old.example']}});
 assert.equal(await pending,false);assert.equal(c.state.market.monitoring.enabled,false);assert.equal(c.state.market.monitoring.frequency,next.frequency);
 assert.deepEqual(c.state.market.monitoring.customSources,next.customSources);
});
test('failed old monitoring save cannot roll previous workspace configuration into a new workspace',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();
 let reject;c.context.monitoringApi=()=>new Promise((_,r)=>reject=r);
 const pending=c.context.saveMonitoringConfig();await new Promise(r=>setImmediate(r));
 c.state.market={strategyApproved:true,signals:[],monitoring:{enabled:false,frequency:'monthly',customSources:['https://new.example/']}};
 c.window.LeadIntelServerBridge.workspace.id='w2';reject(Error('Workspace changed'));await pending;
 assert.equal(c.state.market.monitoring.enabled,false);assert.equal(c.state.market.monitoring.frequency,'monthly');
});
test('failed monitoring load retries and a new workspace reloads confirmed server settings',async()=>{
 const c=setup();c.context.monitoringLoaded=false;c.context.waitForMarketServerBridge=async()=>c.window.LeadIntelServerBridge;
 let attempts=0;c.context.monitoringApi=async()=>{attempts++;throw Error('offline');};
 await c.context.loadMonitoringServerState();await c.context.loadMonitoringServerState();assert.equal(attempts,6);
 c.context.monitoringApi=async()=>({config:{enabled:false,frequency:'monthly'},alerts:[],runs:[]});
 await c.context.loadMonitoringServerState();assert.equal(c.state.market.monitoring.frequency,'monthly');
 c.state.market={...c.state.market,monitoring:{enabled:false,frequency:'daily'}};c.window.LeadIntelServerBridge.workspace.id='w2';
 await c.context.loadMonitoringServerState();assert.equal(c.state.market.monitoring.frequency,'monthly');
});
test('delayed monitoring load does not write server config after workspace changes',async()=>{
 const c=setup();c.context.monitoringLoaded=false;c.context.waitForMarketServerBridge=async()=>c.window.LeadIntelServerBridge;
 // Resolve all three endpoints together after the state changes.
 const deferred=[];c.context.monitoringApi=()=>new Promise(r=>deferred.push(r));
 const pending=c.context.loadMonitoringServerState();await new Promise(r=>setImmediate(r));
 c.state.market={strategyApproved:true,signals:[],monitoring:{enabled:false,frequency:'monthly',customSources:['https://new.example/']}};
 c.window.LeadIntelServerBridge.workspace.id='w2';deferred.forEach(r=>r({config:{enabled:true,frequency:'daily'},alerts:[],runs:[]}));await pending;
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
 c.state.market={strategyApproved:true,signals:[],monitoring:{enabled:false,frequency:'monthly'}};c.window.LeadIntelServerBridge.workspace.id='w2';c.context.renderMonitoringControls();
 assert.equal(c.$('toggle-monitoring-settings').disabled,true);
 resolve({saved:true,config:{enabled:true,revision:2}});await pending;
 assert.equal(c.$('toggle-monitoring-settings').disabled,false);assert.equal(c.$('monitoring-frequency').disabled,false);
 assert.equal(c.$('monitoring-settings').hidden,false);assert.notEqual(c.$('monitoring-summary-status').textContent,'Saving…');
});

test('same-context market normalization does not discard a confirmed monitoring save',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();c.$('monitoring-frequency').value='daily';let resolve,submitted;
 c.context.monitoringApi=async(path,options)=>{submitted=JSON.parse(options.body);return new Promise(r=>resolve=r);};
 const pending=c.context.saveMonitoringConfig();await new Promise(r=>setImmediate(r));c.state.market=JSON.parse(JSON.stringify(c.state.market));
 resolve({saved:true,config:serverConfig(submitted)});assert.equal(await pending,true);assert.equal(c.state.market.monitoring.frequency,'daily');assert.equal(c.state.market.monitoring.revision,2);assert.equal(c.$('monitoring-settings').hidden,true);
});

test('same-workspace material Strategy edit discards the old enabled monitoring response',async()=>{
 const c=setup();c.context.renderMonitoringControls();c.context.openMonitoringSettings();c.$('monitoring-frequency').value='daily';let resolve,submitted;
 c.context.monitoringApi=async(path,options)=>{submitted=JSON.parse(options.body);return new Promise(r=>resolve=r);};
 const pending=c.context.saveMonitoringConfig();await new Promise(r=>setImmediate(r));c.state.profile.priorityOffers='New reviewed service';
 resolve({saved:true,config:serverConfig(submitted)});assert.equal(await pending,false);assert.equal(c.state.market.monitoring.frequency,'weekly');assert.equal(c.state.profile.priorityOffers,'New reviewed service');assert.equal(c.$('monitoring-settings').hidden,false);
});

test('same-context market object replacement accepts the authoritative monitoring load',async()=>{
 const c=setup(),deferred=[];c.context.monitoringApi=()=>new Promise(r=>deferred.push(r));
 const pending=c.context.loadMonitoringServerState();await new Promise(r=>setImmediate(r));c.state.market=JSON.parse(JSON.stringify(c.state.market));
 deferred.forEach(resolve=>resolve({config:{...c.state.market.monitoring,frequency:'daily',revision:3},alerts:[],runs:[]}));await pending;
 assert.equal(c.state.market.monitoring.frequency,'daily');assert.equal(c.state.market.monitoring.revision,3);
});
