const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const Q=require('../page-quality.js'),Targeting=require('../targeting-policy.js');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8').replace(/\ninitDiscoveryWhenReady\(\);\s*$/,'');
function qualityRuntime(){
 const storage=new Map([['leadintel_customer_v2_state',JSON.stringify({website:'https://seller.example',profile:{companyName:'Seller'},scrapedSources:[{text:'source evidence '.repeat(300000)}]})]]);
 const c={URL,console,setTimeout,clearTimeout,document:{getElementById:()=>null},addEventListener(){},localStorage:{getItem:k=>storage.get(k)||null},LeadIntelDiscovery:{canonicalDomain:v=>v,assessCompanyQualification:()=>({eligible:true})}};c.window=c;
 vm.createContext(c);vm.runInContext(source,c);
 c.LeadIntelPageQuality=Q;c.LeadIntelStep2Brief={confirmationMissing:()=>[]};c.LeadIntelTargeting={isConfirmed:()=>true};c.LeadIntelPageProcedures={strategyBlockers:()=>[]};c.LeadIntelServerBridge={workspace:{id:'w1'}};
 vm.runInContext("discovery={status:'partial',candidates:[],selectedProspects:[],pipeline:[]};discoveryMounted=true;buyerSelectionRows=()=>[]",c);
 return {c,storage,read:()=>c.discoveryQualityContext('companies')};
}
test('Companies checks do not serialize full seller research, while saved changes invalidate action tickets',()=>{
 const r=qualityRuntime();const context=r.read();assert.ok(JSON.stringify(context.inputs).length<2000,'page-check inputs must not contain megabytes of source documents');
 const coordinator=Q.createCoordinator({session:()=>({ready:true,workspaceId:'w1'})});coordinator.register('companies',{read:r.read});
 const ticket=coordinator.capture('companies','prepare');assert.ok(ticket);assert.equal(coordinator.current(ticket),true);
 const main=JSON.parse(r.storage.get('leadintel_customer_v2_state'));main.scrapedSources[0].text+=' changed';r.storage.set('leadintel_customer_v2_state',JSON.stringify(main));
 assert.equal(coordinator.current(ticket),false,'a saved evidence edit must invalidate the old ticket');
 const evidenceTicket=coordinator.capture('companies','prepare');
 vm.runInContext("discovery.candidates.push({domain:'buyer.example',evidence:[{text:'new evidence'}]})",r.c);
 assert.equal(coordinator.current(evidenceTicket),false,'unsaved in-memory company evidence must still invalidate tickets');
 const changed=coordinator.capture('companies','prepare');r.c.LeadIntelServerBridge.workspace.id='w2';assert.equal(coordinator.current(changed),false);
});
test('viewing saved Companies does not redirect unconfirmed targeting to Profile; research still requires confirmation',()=>{
 const app=fs.readFileSync(require.resolve('../app.js'),'utf8');const fn=app.slice(app.indexOf('function setStep('),app.indexOf('window.LeadIntelCustomerNavigation='));
 let redirected=0,saved=0;const c={state:{website:'https://seller.example',profile:{companyName:'Seller'},answers:{}},campaignModuleAllowed:()=>false,LeadIntelTargeting:{...Targeting,focusRequired:()=>{redirected++;return false;}},saveState:()=>saved++,document:{querySelectorAll:()=>[]},CustomEvent:class{},window:{dispatchEvent(){},scrollTo(){}},renderProfile(){},ensureMarketStrategySeeded(){},renderMarketStrategy(){}};
 vm.createContext(c);vm.runInContext(fn,c);c.setStep(5,{review:true});assert.equal(redirected,0);assert.equal(c.state.step,5);assert.equal(saved,1);
 c.setStep(5);assert.equal(redirected,1,'ordinary advance still requires targeting confirmation');
 c.setStep(6,{review:true});assert.equal(redirected,2,'review cannot bypass Messages gates');
 c.state.profile=null;c.setStep(5,{review:true});assert.equal(redirected,3,'a seller profile is required to review Companies');
});

test('Companies route explicitly requests saved-page review without weakening Strategy navigation',()=>{
 const fn=source.slice(source.indexOf('function persistMainStep('),source.indexOf('function loadDiscovery('));
 const calls=[];const c={window:{LeadIntelCustomerNavigation:{setStep:(step,options)=>calls.push({step,review:options.review})}}};vm.createContext(c);vm.runInContext(fn,c);
 c.persistMainStep(5);c.persistMainStep(4);assert.deepEqual(calls,[{step:5,review:true},{step:4,review:false}]);
});
test('reading selected Buyers validates selected company evidence without rescoring the entire search pool',()=>{
 const r=qualityRuntime();let checks=0;r.c.LeadIntelDiscovery.assessCompanyQualification=()=>{checks++;return {eligible:true};};r.c.LeadIntelDiscovery.effectiveTargetingProfile=p=>p;
 // Use the actual selection reader instead of the empty fixture helper.
 const fn=source.slice(source.indexOf('function buyerSelectionRows(){'),source.indexOf('function currentJourneyFocus(){'));
 vm.runInContext(fn+";discovery.candidates=Array.from({length:50},(_,i)=>({domain:'buyer'+i+'.example'}));discovery.selectedProspects=[{domain:'buyer0.example',buyerSearchMode:'user_selected_qualified'}];",r.c);
 assert.equal(r.c.buyerSelectionRows().length,1);assert.equal(checks,1,'unselected search results must not block navigation with synchronous qualification');
 vm.runInContext('discovery.selectedProspects=[]',r.c);checks=0;assert.equal(r.c.buyerSelectionRows().length,0);assert.equal(checks,0);
});
