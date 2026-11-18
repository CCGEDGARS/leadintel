const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const body=app.slice(app.indexOf('function saveState(){'),app.indexOf('\nfunction esc(',app.indexOf('function saveState(){')));
test('async main-app results notify the shared autosave owner and unchanged saves do not reschedule it',()=>{
 const events=[],values=new Map([['state','{}']]);
 const context={state:{market:{researchResults:[{url:'https://manufacturer.example/news'}]}},STORAGE_KEY:'state',localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},window:{dispatchEvent:event=>events.push(event.type)},CustomEvent:class{constructor(type){this.type=type;}},profileApprovalContext:()=> 'workspace-a',updateCompleteness(){},updateNavigationAvailability(){}};
 vm.createContext(context);vm.runInContext(body+';saveState()',context);
 assert.deepEqual(events,['leadintel:workspace-dirty']);
 assert.equal(JSON.parse(values.get('state')).market.researchResults.length,1);
 vm.runInContext('saveState()',context);assert.equal(events.length,1);
});
test('a main-form edit retains the latest campaign settings owned by Messages',()=>{
 for(const stale of [undefined,{schemaVersion:1,coreScenario:{summary:'Old summary'},presets:[],selectedPresetId:''}]){
  const campaignStudio={schemaVersion:1,coreScenario:{summary:'Reviewed summary',status:'approved'},presets:[{id:'export-preset',segment:'Export buyers',language:'de'}],selectedPresetId:'export-preset'};
  const events=[],values=new Map([['state',JSON.stringify({website:'https://seller.example/',campaignStudio})]]);
  const context={state:{website:'https://seller.example/',setupWebsiteDraft:'https://seller.example/proposed',...(stale?{campaignStudio:stale}:{})},STORAGE_KEY:'state',localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},window:{dispatchEvent:event=>events.push(event.type)},CustomEvent:class{constructor(type){this.type=type;}},profileApprovalContext:()=> 'workspace-a',updateCompleteness(){},updateNavigationAvailability(){}};
  vm.createContext(context);vm.runInContext(body+';saveState()',context);
  const saved=JSON.parse(values.get('state'));assert.deepEqual(saved.campaignStudio,campaignStudio);assert.equal(saved.setupWebsiteDraft,'https://seller.example/proposed');
  vm.runInContext('saveState()',context);assert.deepEqual(events,['leadintel:workspace-dirty']);
 }
});
test('an active research run does not import an extra snapshot before its final report is captured',()=>{
 const start=app.indexOf('function renderResearchReports(){'),end=app.indexOf('\nfunction setActivationFeedback',start);
 const state={market:{researchResults:[{url:'https://manufacturer.example/news'}],researchStatus:'complete',researchReports:[]}};
 let imports=0;
 const context={state,activeMarketResearchRun:{id:'finishing'},saveState(){},window:{dispatchEvent(){}},LeadIntelResearchReport:{snapshot(){imports++;return {};},install(){return {render(){}};}}};
 vm.createContext(context);vm.runInContext('let researchReportUi;'+app.slice(start,end)+';renderResearchReports()',context);
 assert.equal(imports,0);assert.deepEqual(state.market.researchReports,[]);
 context.activeMarketResearchRun=null;vm.runInContext('renderResearchReports()',context);assert.equal(imports,1,'legacy saved evidence still receives its recovery report');
});
test('main-form saves preserve managed material evidence, coverage and removal under their current owner',()=>{
 const material={id:'material:one',name:'source.pdf',materialRevision:3,managedMaterial:true,text:'Exact source',partial:true,coverage:{total:2,readable:1,unreadable:1}},legacy={id:'legacy',name:'manual.pdf',text:'Edited local text'};
 const values=new Map([['state',JSON.stringify({documents:[material]})]]),events=[];
 const context={state:{setupWebsiteDraft:'https://proposed.example/',documents:[legacy,{id:material.id,text:'Stale normalized source',size:0}]},STORAGE_KEY:'state',localStorage:{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)},window:{dispatchEvent:e=>events.push(e.type)},CustomEvent:class{constructor(type){this.type=type;}},profileApprovalContext:()=> 'workspace-a',updateCompleteness(){},updateNavigationAvailability(){}};
 vm.createContext(context);vm.runInContext(body+';saveState()',context);assert.deepEqual(JSON.parse(values.get('state')).documents,[legacy,material]);
 vm.runInContext('saveState()',context);assert.equal(events.length,1,'unchanged evidence must not schedule another save');
 const current=JSON.parse(values.get('state'));current.documents=[legacy];values.set('state',JSON.stringify(current));vm.runInContext('saveState()',context);assert.deepEqual(JSON.parse(values.get('state')).documents,[legacy],'removed managed evidence cannot be resurrected by an old view');
});
