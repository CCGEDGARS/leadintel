const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{JSDOM}=require('jsdom');
const Market=require('../opportunity-led-icp.js').install(require('../market-engine.js'));
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
function part(start,end){const a=app.indexOf(start);assert.ok(a>=0,`${start} missing`);return app.slice(a,app.indexOf(end,a));}
function setup(){
 const dom=new JSDOM('<div id="icp-list"></div>'),state={profile:{},market:Market.normalizeMarketState({icps:[{id:'opportunity',type:'opportunity-led',name:'Opportunity-led ICP',active:false,requestedActive:false}],signals:[]})};let opens=0;
 const context={strategyIntegrity:()=>require('../strategy-integrity.js'),state,document:dom.window.document,$:id=>dom.window.document.getElementById(id),esc:s=>String(s??''),saveState:()=>{},syncResearchSourcesToSignals:()=>{},LeadIntelMarket:{...Market,buildIcpCandidates:()=>[]},icpActivationRequirement:()=>({available:context.ready,reason:'Run research',target:'run-market-research',action:'Research & activate'}),ready:false,LeadIntelTargeting:{focusControl:()=>{}},window:{LeadIntelProfileMarket:{open:()=>{opens++;return Promise.resolve();}}},setTimeout:f=>f()};
 vm.createContext(context);vm.runInContext(part('function enforceIcpActivationRequirements(){','function readMarketEdits(')+part('function readMarketEdits(','function syncResearchSourcesToSignals(){')+part('function renderIcps(){','function renderSignalDesigner(){'),context);
 return {context,document:dom.window.document,state,opens:()=>opens};
}
test('blocked profile can request activation rather than presenting a disabled switch',()=>{
 const h=setup();h.context.renderIcps();assert.equal(h.document.querySelector('[data-icp-field="active"]').disabled,false);
 assert.equal(h.document.querySelector('[data-icp-unlock]').dataset.icpId,'opportunity');
});
test('research handoff keeps On off until evidence exists and the user activates again',()=>{
 const h=setup();vm.runInContext(part('function requestIcpActivation(','function renderSignalDesigner(){'),h.context);
 h.context.requestIcpActivation('opportunity');assert.equal(h.opens(),1);assert.equal(h.state.market.icps[0].requestedActive,false);assert.equal(h.state.market.icps[0].active,false);
 h.state.market=Market.normalizeMarketState(JSON.parse(JSON.stringify(h.state.market)));h.context.ready=true;h.context.renderIcps();assert.equal(h.state.market.icps[0].active,false);h.context.requestIcpActivation('opportunity');assert.equal(h.state.market.icps[0].active,true);
});
test('failed research does not activate and deliberate Off cancels a pending request',()=>{
 const h=setup();vm.runInContext(part('function requestIcpActivation(','function renderSignalDesigner(){'),h.context);
 h.context.requestIcpActivation('opportunity');h.context.renderIcps();assert.equal(h.state.market.icps[0].active,false);
 h.document.querySelector('[data-icp-field="active"]').checked=false;h.context.readMarketEdits();h.context.ready=true;h.context.renderIcps();assert.equal(h.state.market.icps[0].requestedActive,false);assert.equal(h.state.market.icps[0].active,false);
});
function bindControls(h){
 const extra=h.document.createElement('div');extra.id='market-opportunities';h.document.body.append(extra);
 h.context.renderMarketOpportunities=()=>{};h.context.renderMonitoringControls=()=>{};
 vm.runInContext(part('function requestIcpActivation(','function renderSignalDesigner(){')+part('  [$("icp-list"),$("market-opportunities")].forEach(', '  $("signal-designer").addEventListener("change"'),h.context);
 h.context.renderIcps();
}
test('the real research button keeps a blocked profile off before navigating',()=>{
 const h=setup();bindControls(h);h.document.querySelector('[data-icp-unlock]').click();assert.equal(h.opens(),1);assert.equal(h.state.market.icps[0].requestedActive,false);
 h.context.ready=true;h.context.renderIcps();assert.equal(h.state.market.icps[0].active,false);h.context.requestIcpActivation('opportunity');assert.equal(h.state.market.icps[0].active,true);
});
test('the real blocked switch goes back without saving pending activation',()=>{
 const h=setup();bindControls(h);h.document.querySelector('[data-icp-field="active"]').click();assert.equal(h.opens(),1);assert.equal(h.state.market.icps[0].requestedActive,false);assert.equal(h.state.market.icps[0].active,false);
 h.context.ready=true;h.context.renderIcps();assert.equal(h.state.market.icps[0].active,false);
});
