const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../outreach-engine.js');
const I=require('../strategy-integrity.js'),Market=require('../market-engine.js');
const Editor=require('../message-editor.js');
const ui=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
function restoreHarness(overrides={}){
 const status={textContent:''},calls=[],saved=[];
 const item={domain:'maker.se',selectedPersonId:'p1',channel:'email',dossier:{people:[{id:'p1',name:'Alex Buyer'}]},drafts:{emailBody:'Saved text'}};
 const bridge={session:{authenticated:true},workspace:{id:'w1'},getCrmCompany:async()=>({ok:true,activities:[],activity_next_cursor:'older'}),getCrmActivities:async(id,filters)=>{calls.push(filters);return {ok:true,activities:[{metadata:{script_package:E.buildCrmScriptSnapshot(item)}}]};}};
 Object.assign(bridge,overrides.bridge||{});
 const context={LeadIntelOutreach:E,LeadIntelMessageEditor:Editor,messageEditor:null,studioGenerationBusy:false,messageTranslationBusy:false,subjectEditing:false,subjectBusy:false,messageWorkspaceUsable:()=>true,currentItem:()=>item,editorDraft:()=>Editor.workingDraft(item),scriptRestoreRequest:0,scriptGenerationRequest:0,outreach:{selectedDomain:'maker.se'},selectedCandidate:()=>({domain:'maker.se'}),crmAuthenticated:()=>true,crmBridge:()=>bridge,durableCompany:async(candidate,options)=>{assert.equal(options.create,false);return {ok:true,company:{id:'c1'}};},q:()=>status,upsertItem:item=>saved.push(item),cancelPendingScriptGeneration(){},restoreAppliedMessageStyle(){},renderAll(){},Set};
 Object.assign(context,overrides.context||{});vm.createContext(context);require('./helpers/message-crm-authority.cjs')(context);
 vm.runInContext(ui.slice(ui.indexOf('async function restoreScriptPackage()'),ui.indexOf('async function loadTriggerAlerts()')),context);
 vm.runInContext(ui.slice(ui.indexOf('async function savedBuyerCrmDraft('),ui.indexOf('async function openMessageChannel(')),context);
 return {context,bridge,status,calls,saved};
}
test('reopening scripts finds durable package beyond latest 40 activities',async()=>{
 const h=restoreHarness();await h.context.restoreScriptPackage();assert.equal(h.calls[0].cursor,'older');assert.equal(h.saved[0].drafts.emailBody,'Saved text');assert.match(h.status.textContent,/reopened from CRM/);
});
test('workspace switch while CRM history loads cannot overwrite current scripts',async()=>{
 const h=restoreHarness();h.bridge.getCrmActivities=async()=>{h.bridge.workspace.id='w2';return {ok:true,activities:[{metadata:{script_package:E.buildCrmScriptSnapshot({domain:'maker.se'})}}]};};await h.context.restoreScriptPackage();assert.equal(h.saved.length,0);
});
test('CRM history failure leaves current scripts unchanged',async()=>{
 const h=restoreHarness({bridge:{getCrmActivities:async()=>({ok:false})}});await h.context.restoreScriptPackage();assert.equal(h.saved.length,0);assert.match(h.status.textContent,/unchanged/);
});
test('completed monitoring run refreshes alerts and history while busy',async()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8'),calls=[];
 const state={website:'https://seller.example',approved:true,profile:{priorityOffers:'Clinical software',targetMarkets:'Finland'},market:{strategyApproved:true,icps:[{id:'core',active:true}],signals:[{id:'growth',active:true,keywords:'clinic',weight:7}],monitoring:{enabled:true,frequency:'weekly',sourceTypes:['news'],signalIds:['growth'],revision:1}}};state.market.strategyApproval=I.approval(state);
 const bridge={ready:true,session:{authenticated:true,user:{id:'u1'}},workspace:{id:'w1'}};
 const context={window:{LeadIntelStrategyIntegrity:I,LeadIntelServerBridge:bridge},monitoringRequestSerial:0,monitoringLoaded:true,monitoringBusy:false,state,LeadIntelMarket:Market,$:()=>({textContent:''}),waitForMarketServerBridge:async()=>bridge,monitoringApi:async(path)=>{calls.push(path);return path.endsWith('/run')?{run:{status:'completed',sourceCount:2,alertCount:1}}:path.endsWith('/config')?{config:{...state.market.monitoring,revision:1}}:{alerts:[{id:'new'}],runs:[{id:'run'}]};},saveState:()=>{},renderMonitoringControls:()=>{},renderMonitoringAlerts:items=>{context.alerts=items},renderMonitoringHistory:items=>{context.runs=items},monitoringHasEdits:()=>false,showToast:()=>{}};
 vm.createContext(context);require('./helpers/message-crm-authority.cjs')(context);
 vm.runInContext(app.slice(app.indexOf('function strategyIntegrity(){'),app.indexOf('function captureStrategyContext(')),context);
 vm.runInContext(app.slice(app.indexOf('function captureMonitoringContext('),app.indexOf('function monitoringHasEdits()')),context);
 for(const [name,next] of [['loadMonitoringServerState','saveMonitoringConfig'],['runMonitoringNow','markMonitoringAlertRead']]){const start=app.indexOf(`async function ${name}(`),end=app.indexOf(`async function ${next}(`,start);vm.runInContext(app.slice(start,end),context);}
 await context.runMonitoringNow();assert.equal(context.alerts[0].id,'new');assert.equal(context.runs[0].id,'run');assert.equal(context.monitoringBusy,false);assert.equal(calls.length,4);
});
