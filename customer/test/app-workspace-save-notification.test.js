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
test('an active research run does not import an extra snapshot before its final report is captured',()=>{
 const start=app.indexOf('function renderResearchReports(){'),end=app.indexOf('\nfunction setActivationFeedback',start);
 const state={market:{researchResults:[{url:'https://manufacturer.example/news'}],researchStatus:'complete',researchReports:[]}};
 let imports=0;
 const context={state,activeMarketResearchRun:{id:'finishing'},saveState(){},window:{dispatchEvent(){}},LeadIntelResearchReport:{snapshot(){imports++;return {};},install(){return {render(){}};}}};
 vm.createContext(context);vm.runInContext('let researchReportUi;'+app.slice(start,end)+';renderResearchReports()',context);
 assert.equal(imports,0);assert.deepEqual(state.market.researchReports,[]);
 context.activeMarketResearchRun=null;vm.runInContext('renderResearchReports()',context);assert.equal(imports,1,'legacy saved evidence still receives its recovery report');
});
