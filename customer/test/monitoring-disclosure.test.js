const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const html=fs.readFileSync('customer/index.html','utf8');
const app=fs.readFileSync('customer/app.js','utf8');
function setup(){
 const window=new JSDOM(html).window,document=window.document,$=id=>document.getElementById(id);
 const config={enabled:true,frequency:'weekly',researchDepth:'deep',minimumScore:70,sourceTypes:['news'],signalIds:['signal'],customSources:['https://example.com/news']};
 const state={market:{strategyApproved:true,signals:[{id:'signal',name:'Expansion',active:true}],monitoring:{...config}}};
 const calls=[];
 const context={window,document,$,state,monitoringBusy:false,monitoringDraftBaseline:null,esc:String,saveState(){},showToast(){},LeadIntelMarket:{normalizeMonitoring:c=>({...config,...c}),SOURCE_TYPES:{news:{}},filterResearchSourceTypes:s=>s},monitoringApi:async(path,options)=>{calls.push(JSON.parse(options.body));return {config:{}};}};
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
