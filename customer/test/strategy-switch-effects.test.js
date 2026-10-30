const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const Market=require('../market-engine.js');
const I=require('../strategy-integrity.js');
const Discovery=require('../discovery-engine.js');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const ui=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
const profile={companyName:'Seller',website:'https://seller.example',idealCustomer:'oldcoremarker',priorityOffers:'consulting',targetMarkets:'Latvia',decisionMakers:'Old role',buyingTriggers:'disabledsignalmarker',exclusions:'seller.example'};
const icps=[{id:'icp-core',type:'core',active:false,description:'oldcoremarker',targetMarkets:'Latvia',buyerRoles:'Old role'},{id:'icp-trigger-led',type:'trigger-led',active:true,description:'hospitality',targetMarkets:'Sweden',buyerRoles:'Hotel manager',offers:'staff training',exclusions:'competitor.example'}];
function fn(source,start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
function monitoringState(enabled){const state={approved:true,website:profile.website,profile,market:{strategyApproved:true,icps,signals:[{id:'hiring',active:true,name:'Hiring',keywords:'hiring',weight:7}],monitoring:{enabled,frequency:'weekly',revision:1}}};state.market.strategyApproval=I.approval(state);return state;}
function monitoringWindow(){return {LeadIntelStrategyIntegrity:I,LeadIntelServerBridge:{ready:true,workspace:{id:'w1'},session:{authenticated:true,user:{id:'u1'}}},LeadIntelWorkspacePersistence:{saveWorkspace:async()=>true}};}
const monitoringHelpers=fn(app,'function strategyIntegrity(){','function captureStrategyContext(')+fn(app,'function captureMonitoringContext(','function monitoringHasEdits()');
test('active ICP fields drive downstream targeting; off profile fields stay saved through reload',()=>{
 const market=Market.normalizeMarketState(JSON.parse(JSON.stringify({icps,signals:[{id:'disabled',active:false,name:'disabledsignalmarker'},{id:'hiring',active:true,name:'recruitment'}]})));
 const effective=Market.effectiveTargetingProfile(profile,market);
 assert.equal(effective.idealCustomer,'hospitality');assert.equal(effective.targetMarkets,'Sweden');assert.equal(effective.decisionMakers,'Hotel manager');assert.equal(effective.priorityOffers,'staff training');assert.equal(effective.buyingTriggers,'recruitment');assert.match(effective.exclusions,/seller.example/);assert.match(effective.exclusions,/competitor.example/);
 assert.equal(market.icps[0].description,'oldcoremarker');assert.equal(market.icps[0].active,false);
});
test('all ICPs off prevents initial and follow-up company research instead of silently using core profile',()=>{
 const market={icps:icps.map(x=>({...x,active:false})),signals:[{active:true,name:'recruitment'}]};
 assert.deepEqual(Discovery.buildDiscoveryQueries(profile,market),[]);
 assert.deepEqual(Discovery.buildDiscoveryFollowUpQueries(profile,market,[],4),[]);
});
test('buyer roles follow enabled non-core ICP when core is off',()=>{
 assert.equal(Discovery.buyerRolesForTarget({profile,market:{icps}},{}),'Hotel manager');
});
test('discovery qualification consumes selected ICP fields and preserves exclusions',()=>{
 const source=fn(ui,'function companyQualificationProfile(','\n',);
 const context={LeadIntelDiscovery:Discovery,main:{profile,market:{icps},answers:{exclusions:'blocked.example'},targetMarkets:['Latvia']},canonicalDomain:x=>x,window:{LeadIntelMarket:Market,LeadIntelTargeting:{profileFields:()=>({targetMarkets:'Latvia'})}}};
 const result=vm.runInNewContext(source+';companyQualificationProfile(main)',context);
 assert.equal(result.idealCustomer,'hospitality');assert.equal(result.targetMarkets,'Sweden');assert.equal(result.decisionMakers,'Hotel manager');assert.match(result.exclusions,/blocked.example/);assert.match(result.exclusions,/competitor.example/);
});
test('ICP rendering distinguishes off and setup-required and disables inactive edits',()=>{
 const elements={'icp-list':{innerHTML:''}};
 const context={state:{profile,market:{icps:[icps[0],{id:'opp',type:'opportunity-led',active:false,name:'Opportunity'}],contentLanguage:'en'}},LeadIntelMarket:{buildIcpCandidates:()=>[]},enforceIcpActivationRequirements:()=>{},icpActivationRequirement:x=>({available:x.type!=='opportunity-led',reason:'Research required',target:'run-market-research',action:'Go to Market Research'}),esc:x=>String(x??''),$:id=>elements[id]};
 vm.runInNewContext(fn(app,'function renderIcps(){','function renderSignalDesigner(){')+';renderIcps()',context);
 assert.match(elements['icp-list'].innerHTML,/This profile won’t be used/);assert.match(elements['icp-list'].innerHTML,/Setup required/);assert.match(elements['icp-list'].innerHTML,/<fieldset[^>]*disabled/);assert.doesNotMatch(elements['icp-list'].innerHTML,/Why is this off/);
});
test('failed monitoring save restores confirmed state and never reports an unconfirmed active state',async()=>{
 const elements={'monitoring-enabled':{checked:true}};let persisted=0,notice='';
 const state=monitoringState(false);
 const context={state,monitoringBusy:false,monitoringLoaded:false,monitoringRequestSerial:0,monitoringDraftBaseline:null,$:id=>elements[id],LeadIntelMarket:Market,window:monitoringWindow(),readMonitoringEdits:()=>({enabled:true,frequency:'weekly',signalIds:['hiring'],sourceTypes:['news']}),closeMonitoringSettings:()=>{},renderMonitoringControls:()=>{},saveState:()=>persisted++,monitoringApi:async()=>{throw Error('Network failed');},showToast:x=>notice=x};
 await vm.runInNewContext(monitoringHelpers+fn(app,'async function saveMonitoringConfig(','async function runMonitoringNow(){')+';saveMonitoringConfig()',context);
 assert.equal(state.market.monitoring.enabled,false);assert.match(notice,/Network failed/);assert.ok(persisted>0);
});
test('monitoring can be switched off even after strategy edits invalidate approval',async()=>{
 const state=monitoringState(true);state.market.strategyApproved=false;let called=false;
 const context={state,monitoringBusy:false,monitoringLoaded:false,monitoringRequestSerial:0,monitoringDraftBaseline:null,$:()=>({checked:false}),LeadIntelMarket:Market,window:monitoringWindow(),readMonitoringEdits:()=>({enabled:false,signalIds:[],sourceTypes:[]}),closeMonitoringSettings:()=>{},renderMonitoringControls:()=>{},saveState:()=>{},monitoringApi:async()=>{called=true;return {saved:true,config:{enabled:false,frequency:'weekly',revision:2}};},showToast:()=>{}};
 await vm.runInNewContext(monitoringHelpers+fn(app,'async function saveMonitoringConfig(','async function runMonitoringNow(){')+';saveMonitoringConfig()',context);
 assert.equal(called,true);assert.equal(state.market.monitoring.enabled,false);
});
test('rendered inactive fields are disabled while the switch remains usable, and re-enabling preserves values',()=>{
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<div id="icp-list"></div><div id="market-opportunities"></div><div id="signal-designer"></div>');
 const state={profile,market:{icps:JSON.parse(JSON.stringify(icps)),signals:[],opportunities:[]}};
 let saved='';
 const context={state,window:{LeadIntelStrategyIntegrity:I},document:dom.window.document,LeadIntelMarket:{...Market,buildIcpCandidates:()=>[]},esc:x=>String(x??''),$:id=>dom.window.document.getElementById(id),icpActivationRequirement:()=>({available:true}),saveState:()=>{saved=JSON.stringify(state);},syncResearchSourcesToSignals:()=>{}};
 const renderer=fn(app,'function renderIcps(){','function renderSignalDesigner(){');
 const reader=fn(app,'function readMarketEdits(','function syncResearchSourcesToSignals(){');
 const enforcer=fn(app,'function enforceIcpActivationRequirements(){','function readMarketEdits(');
 vm.runInNewContext(fn(app,'function strategyIntegrity(){','function captureStrategyContext(')+enforcer+reader+renderer+';renderIcps()',context);
 const toggle=dom.window.document.querySelector('[data-icp-field="active"][data-index="0"]');
 assert.equal(toggle.disabled,false);assert.equal(dom.window.document.querySelector('[data-icp-field="description"]').matches(':disabled'),true);
 toggle.checked=true;vm.runInNewContext('readMarketEdits();renderIcps()',context);
 assert.equal(dom.window.document.querySelector('[data-icp-field="description"]').matches(':disabled'),false);
 assert.equal(JSON.parse(saved).market.icps[0].description,'oldcoremarker');assert.equal(JSON.parse(saved).market.icps[0].active,true);
});
test('explicitly deselected monitoring sources stay off instead of silently restoring defaults',()=>{
 assert.deepEqual(Market.normalizeMonitoring({sourceTypes:[],customSources:['https://example.com']}).sourceTypes,[]);
 assert.ok(Market.normalizeMonitoring({}).sourceTypes.length>0);
});
