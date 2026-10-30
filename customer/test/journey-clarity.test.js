const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {JSDOM}=require('jsdom');
const Journey=require('../journey-progress.js');
const source=fs.readFileSync(require.resolve('../process-map.js'),'utf8');
const availability=Object.fromEntries([1,2,3,4,5,6,7].map(id=>[id,true]));
const setup={main:{website:'https://seller.example',targetMarkets:['Sweden']},websiteActivated:true,currentStep:1,availability};
function messages(){return {main:{brandIdentity:{status:'ready'},campaignStudio:{coreScenario:{status:'approved'}}},currentStep:6,availability,outreach:{items:[{domain:'buyer.example',dossier:{},drafts:{emailSubject:'Subject',emailBody:'Body'},localizationStatus:'complete',approved:true}]}};}
function renderer(model){
 const w=new JSDOM('<div id="commercial-process-map"><span data-journey-position></span><span data-journey-title></span><span data-journey-overall></span><i data-journey-overall-bar></i><button data-process-step="1"><span data-stage-state></span><span data-stage-progress></span></button><button data-process-step="6"><span data-stage-state></span><span data-stage-progress></span></button></div><ol class="steps"><li data-workflow-stage="1"><em data-sidebar-stage-state></em></li><li data-workflow-stage="6"><em data-sidebar-stage-state></em></li></ol><section id="journey-stage-guide"><header><div><span data-stage-guide-kicker></span><strong data-stage-guide-title></strong></div><span data-stage-guide-progress></span></header><ol data-stage-mini-steps></ol><p><strong>Next action</strong><span data-stage-next-action></span></p></section>').window;
 const ctx={window:{LeadIntelJourneyProgress:Journey},document:w.document,processMap:w.document.getElementById('commercial-process-map'),stageAvailability:()=>availability,currentProcessStep:()=>6,journeyModel:()=>model,expandedSidebarStage:0,readStageJson:()=>({}),DISCOVERY_STORAGE_KEY:'discovery'};
 vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('const statusLabels='),source.indexOf('function processToast('))+source.slice(source.indexOf('function syncProcessMap(){'),source.indexOf('function openProcessStep(')),ctx);
 return {w,ctx};
}

test('selected Setup reports all required work complete while optional evidence stays separate',()=>{
 const stage=Journey.buildJourneyModel(setup)[0];
 assert.equal(stage.active,true);
 assert.equal(stage.status,'complete');
 assert.equal(stage.requiredComplete,true);
 assert.equal(stage.optionalCompleted,0);
 assert.equal(stage.optionalTotal,1);
 assert.equal(Journey.stageStatusLabel(stage),'Complete');
 assert.equal(stage.nextAction,'Continue to Profile');
 assert.deepEqual(stage.nextTarget,{stageId:2,itemId:'offer-customer'});
});

test('selecting a completed Messages stage never changes its completion status',()=>{
 const input=messages(),saved=JSON.stringify(input),active=Journey.buildJourneyModel(input)[5],elsewhere=Journey.buildJourneyModel({...input,currentStep:7})[5];
 assert.equal(active.active,true);assert.equal(elsewhere.active,false);
 assert.equal(active.status,'complete');assert.equal(active.status,elsewhere.status);
 assert.equal(active.requiredCompleted,5);assert.equal(active.requiredTotal,5);
 assert.equal(active.nextAction,'Continue to Delivery');
 assert.deepEqual(active.nextTarget,{stageId:7,itemId:'sent'});
 assert.equal(JSON.stringify(input),saved,'Assessing or selecting a stage must not alter saved drafts or outcomes');
});

test('a buyer name keeps the mandatory quality action unfinished and actionable',()=>{
 const stage=Journey.buildJourneyModel({currentStep:5,journeyFocus:'buyers',availability,discovery:{pipeline:[{domain:'buyer.example',people:[{name:'Buyer'}]}]}})[4];
 assert.equal(stage.active,true);assert.equal(stage.status,'in-progress');
 assert.equal(stage.requiredCompleted,1);assert.equal(stage.requiredTotal,2);
 assert.match(stage.nextAction,/quality check/);
 assert.deepEqual(stage.nextTarget,{stageId:5,itemId:'buyer-quality'});
});

test('failed optional research neither completes research nor reopens required profile work',()=>{
 const main={answers:{priority_offers:'Offer',ideal_customer:'Customer',buyer_roles:'CEO',exclusions:'None'},profile:{},approved:true,market:{researchStatus:'error',lastResearchAt:'2026-10-01'}};
 main.targetingConfirmation=require('../targeting-policy.js').confirm(main);
 const stage=Journey.buildJourneyModel({main,currentStep:3,availability})[1];
 assert.equal(stage.status,'complete');assert.equal(stage.steps.find(s=>s.id==='research').complete,false);
 assert.equal(stage.nextAction,'Continue to Strategy');
 assert.deepEqual(stage.nextTarget,{stageId:3,itemId:'icps'});
});

test('typed websites cannot complete activation and recovered legacy activation remains usable',()=>{
 assert.equal(Journey.buildJourneyModel({...setup,websiteActivated:false})[0].steps[0].complete,false);
 const Activation=require('../website-activation.js');
 const old={website:'https://seller.example/',profile:{website:'https://seller.example/'},scrapedSources:[{type:'website',url:'https://seller.example/',text:'Evidence saved during prior research'}]};
 const previousStorage=globalThis.localStorage;
 globalThis.localStorage={getItem:key=>key===Activation.STORAGE_KEY?JSON.stringify(old):null};
 try{
  const recovered=Activation.isCurrentWebsiteActive(old.website);
  assert.equal(recovered,true);
  assert.equal(Journey.buildJourneyModel({...setup,main:{...old,targetMarkets:['Sweden']},websiteActivated:recovered})[0].status,'complete');
 }finally{globalThis.localStorage=previousStorage;}
});

test('guide, sidebar and total bar expose required completion independently of active selection',()=>{
 const model=Journey.buildJourneyModel(messages()),{w,ctx}=renderer(model),d=w.document;
 ctx.syncProcessMap();
 const marker=d.querySelector('[data-workflow-stage="6"]');
 assert.equal(marker.classList.contains('active'),true);assert.equal(marker.classList.contains('complete'),true);
 assert.equal(marker.getAttribute('aria-current'),'step');
 assert.match(marker.textContent,/Complete · 5\/5 required/);
 assert.equal(d.querySelector('[data-stage-guide-progress]').textContent,'5 of 5 required steps');
 assert.match(d.querySelector('[data-journey-overall]').textContent,/required steps complete$/);
 assert.equal(d.querySelector('[data-stage-next-action]').tagName,'BUTTON');
 assert.equal(d.querySelector('[data-stage-next-action]').textContent,'Continue to Delivery');
 assert.equal(d.querySelector('[data-stage-next-action]').dataset.stageId,'7');
 assert.equal(d.querySelector('[data-stage-next-action]').dataset.stageMiniStep,'sent');
 assert.equal(d.querySelectorAll('[data-stage-mini-steps] [data-stage-mini-step]').length,5);
 assert.equal(d.querySelectorAll('[data-stage-optional-steps] [data-stage-mini-step]').length,1);
 w.close();
});

test('journey refresh preserves keyboard focus in both guide and sidebar substeps',()=>{
 const {w,ctx}=renderer(Journey.buildJourneyModel(messages()));ctx.syncProcessMap();
 const guide=w.document.querySelector('[data-stage-mini-step="scripts"]');guide.focus();ctx.syncProcessMap();
 assert.equal(w.document.activeElement.dataset.stageMiniStep,'scripts');
 const marker=w.document.querySelector('[data-workflow-stage="6"]');ctx.renderSidebarSteps(marker,Journey.buildJourneyModel(messages())[5],true);
 const sidebar=marker.querySelector('[data-sidebar-substep="approval"]');sidebar.focus();ctx.renderSidebarSteps(marker,Journey.buildJourneyModel(messages())[5],true);
 assert.equal(w.document.activeElement.dataset.sidebarSubstep,'approval');w.close();
});

test('all required Delivery outcomes complete without presenting future replies as required work',()=>{
 const stage=Journey.buildJourneyModel({currentStep:7,availability,delivery:{opportunities:[{domain:'buyer.example',sentAt:'2026-10-24'}]}})[6];
 assert.equal(stage.active,true);assert.equal(stage.status,'complete');assert.equal(stage.optionalCompleted,0);assert.equal(stage.optionalTotal,3);
 assert.equal(stage.nextAction,'Required steps complete');assert.equal(stage.nextTarget,null);
});

test('next-action button uses existing substep navigation and completed selection keeps its actual module route',()=>{
 const model=Journey.buildJourneyModel(messages()),{w,ctx}=renderer(model),opened=[];
 ctx.syncProcessMap();ctx.reviewMiniStep=(...args)=>opened.push(args);ctx.openProcessStep=id=>opened.push(id);
 const listener=source.slice(source.indexOf('processMap.addEventListener("click"'),source.indexOf('const steps=document.querySelector(".steps");'));
 vm.runInContext(listener,ctx);w.document.getElementById('commercial-process-map').append(w.document.getElementById('journey-stage-guide'));
 w.document.querySelector('[data-stage-next-action]').click();assert.deepEqual(opened,[[7,'sent']]);
 const events=[],routes={window:{LeadIntelJourneyProgress:Journey,dispatchEvent:event=>events.push(event.detail)},CustomEvent:w.CustomEvent,readProcessState:()=>({}),stageAvailability:()=>availability,currentProcessStep:()=>6,journeyModel:()=>model,setTimeout:()=>{},syncProcessMap(){},syncContextArchitecture(){},processToast(){}};
 vm.createContext(routes);vm.runInContext(source.slice(source.indexOf('function openProcessStep('),source.indexOf('function reviewMiniStep(')),routes);
 routes.openProcessStep(6);assert.equal(events.length,1);assert.equal(events[0].step,6);assert.equal(events[0].journeyStage,6);w.close();
});

test('quality action reaches the existing Buyers check without executing research or changing the recipient',()=>{
 const w=new JSDOM('<section class="buyer-quality-supervisor"><button>Run quality check</button></section>').window,opened=[];
 const panel=w.document.querySelector('section');let scrolled=0;panel.scrollIntoView=()=>scrolled++;
 const ctx={window:{},document:w.document,openProcessStep:stage=>opened.push(stage),setTimeout:callback=>callback(),syncProcessMap(){}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function reviewMiniStep('),source.indexOf('if(processMap){',source.indexOf('function reviewMiniStep('))),ctx);
 let executed=0;panel.querySelector('button').addEventListener('click',()=>executed++);
 ctx.reviewMiniStep(5,'buyer-quality');assert.deepEqual(opened,[5]);assert.equal(scrolled,1);assert.equal(w.document.activeElement,panel);assert.equal(executed,0);w.close();
});

test('keyboard stage activation remains distinct from nested substep and channel buttons',()=>{
 const w=new JSDOM('<ol class="steps"><li data-workflow-stage="6" tabindex="0"><button data-sidebar-substep="approval" data-stage-id="6">Approval</button></li></ol>').window,opened=[];
 const ctx={document:w.document,window:{},openProcessStep:id=>opened.push(id),syncProcessMap(){},processToast(){},reviewMiniStep(){},expandedSidebarStage:0};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('const steps=document.querySelector(".steps");'),source.indexOf('document.getElementById("company-website")?.addEventListener')),ctx);
 const stage=w.document.querySelector('li');stage.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.deepEqual(opened,['6']);
 stage.querySelector('button').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));assert.deepEqual(opened,['6']);w.close();
});

test('active sidebar names the missing requirement and offers its existing review action',()=>{const input=messages();input.outreach.items[0].approved=false;const model=Journey.buildJourneyModel(input),{w,ctx}=renderer(model);ctx.syncProcessMap();const button=w.document.querySelector('[data-workflow-stage="6"] [data-sidebar-next-action]');assert.equal(button.hidden,false);assert.match(button.textContent,/Review and approve/);assert.equal(button.dataset.sidebarSubstep,'approval');assert.equal(button.dataset.stageId,'6');w.close();});

test('unmet buyer quality is not labelled as met and sync recovery takes priority without changing evidence',()=>{
 const input={currentStep:5,journeyFocus:'buyers',availability,discovery:{selectedProspects:[{domain:'buyer.example',people:[{id:'anna',name:'Anna Buyer'}]}]}};
 const stage=Journey.buildJourneyModel(input)[4];assert.match(stage.steps.find(s=>s.id==='buyer-quality').label,/needs review/);
 const blocked=Journey.buildJourneyModel({...input,syncConflict:true})[4];assert.equal(blocked.nextAction,'Resolve workspace synchronization');assert.equal(blocked.nextTarget.itemId,'sync-review');
 assert.equal(blocked.requiredCompleted,stage.requiredCompleted);assert.equal(blocked.steps.find(s=>s.id==='buyer-quality').complete,false);
 const passed=Journey.buildJourneyModel({...input,buyerQualityPassed:true})[4];assert.match(passed.steps.find(s=>s.id==='buyer-quality').label,/requirements met/);
});
