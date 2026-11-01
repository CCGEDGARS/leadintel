const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const modulePath=path.join(__dirname,'..','journey-progress.js');
const Journey=fs.existsSync(modulePath)?require(modulePath):{};
test('journey can assess retained companies before Companies mounts and uses the saved research timestamp',()=>{
 const D=require('../discovery-engine.js'),vm=require('node:vm'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
 const assess=vm.runInNewContext(source.slice(source.indexOf('function qualificationAssessment('),source.indexOf('function qualificationHtml('))+';qualificationAssessment',{
  discovery:null,qualificationPresentationDepth:0,qualificationContext:()=>({profile:{website:'seller.example',priorityOffers:'assembly services',idealCustomer:'equipment operators'},market:{}}),crmCompanyByDomain:()=>null,LeadIntelDiscovery:D,window:{}
 });
 const researchedAt='2026-10-20T08:00:00Z';let q;
 assert.doesNotThrow(()=>{q=assess({company:'Nordic',domain:'nordic.se'},{researchedAt});});
 assert.equal(q.researchedAt,researchedAt);
});
test('journey uses the current card assessment instead of a stale saved eligibility flag',()=>{
 const D=require('../discovery-engine.js'),vm=require('node:vm');
 const candidate={company:'Nordic',domain:'nordic.se',qualification:{eligible:true,score:90},evidence:[{url:'https://nordic.se/',text:'We use cookies. Accept all cookies.',verifiedAt:new Date().toISOString()}]};
 const source=fs.readFileSync(require.resolve('../process-map.js'),'utf8');
 const read=vm.runInNewContext(source.slice(source.indexOf('function readJourneyState(){'),source.indexOf('function websiteActivated('))+';readJourneyState',{
  DISCOVERY_STORAGE_KEY:'discovery',OUTREACH_STORAGE_KEY:'outreach',DELIVERY_STORAGE_KEY:'delivery',readProcessState:()=>({}),readStageJson:key=>key==='discovery'?{status:'partial',candidates:[candidate]}:{},
  window:{LeadIntelDiscoveryUI:{assessCompany:c=>D.assessCompanyQualification(c,{website:'seller.example',priorityOffers:'assembly services',idealCustomer:'equipment operators'},{},{researchedAt:new Date().toISOString()})}}
 });
 assert.equal(Journey.buildJourneyModel({...read(),currentStep:5,availability:{5:true}})[3].steps.find(s=>s.id==='companies').complete,false);
});
test('retained unscored company records cannot complete the company stage',()=>{
 const stage=Journey.buildJourneyModel({currentStep:5,discovery:{status:'partial',candidates:[{company:'Legacy',domain:'legacy.example'}],pipeline:[{domain:'saved.example'}]},discoveryMeta:{targetCount:5},availability:{5:true}})[3];
 assert.equal(stage.steps.find(s=>s.id==='companies').complete,false);assert.equal(stage.steps.find(s=>s.id==='review').complete,false);assert.notEqual(stage.nextAction,'Stage complete');
});
test('one checked company cannot complete a requested five-company result',()=>{
 const stage=Journey.buildJourneyModel({currentStep:5,discovery:{status:'partial',candidates:[{company:'Buyer',domain:'buyer.example',qualification:{eligible:true,score:70}}],pipeline:[{domain:'buyer.example'}]},discoveryMeta:{targetCount:5},availability:{5:true}})[3];
 assert.equal(stage.steps.find(s=>s.id==='companies').complete,false);assert.notEqual(stage.nextAction,'Stage complete');
});
test('a globally stale shortlist cannot complete company verification or review',()=>{
 const stage=Journey.buildJourneyModel({currentStep:5,discovery:{status:'complete',needsRefresh:true,candidates:[{company:'Previously checked',domain:'old.example',qualification:{eligible:true,score:90}}]},discoveryMeta:{targetCount:1},availability:{5:true}})[3];
 assert.equal(stage.steps.find(s=>s.id==='companies').complete,false);assert.equal(stage.steps.find(s=>s.id==='review').complete,false);
});

test('zero-score or incomplete company research cannot mark Companies found and reviewed complete',()=>{
 for(const candidate of [{company:'Unverified',domain:'unknown.example',buyerFit:{fit:0}},{company:'Incomplete',domain:'unknown.example',qualification:{eligible:false}},{company:'Stale',domain:'unknown.example',needsRecheck:true}]){
 const model=Journey.buildJourneyModel({currentStep:5,discovery:{status:'partial',candidates:[candidate]},discoveryMeta:{targetCount:5},availability:{5:true}});
 const companies=model.find(stage=>stage.name==='Companies');
 assert.equal(companies.steps.find(step=>step.id==='companies').complete,false);
 assert.equal(companies.steps.find(step=>step.id==='review').complete,false);
 }
});

test('commercial journey exposes one canonical seven-stage model',()=>{
  assert.equal(typeof Journey.buildJourneyModel,'function');
  const model=Journey.buildJourneyModel({currentStep:1,availability:{1:true}});
  assert.deepEqual(model.map(stage=>stage.name),[
    'Setup','Profile','Strategy','Companies','Buyers','Messages','Delivery'
  ]);
});

test('commercial journey derives completed substeps from real workspace outcomes',()=>{
  const answers={priority_offers:'Offer',ideal_customer:'Customer',buyer_roles:'CEO',exclusions:'None',buying_outcomes:'Growth',buying_triggers:'Expansion',value_proposition:'Value',differentiation:'Proof',proof_points:'Case',objections:'Timing'};
  const main={
    website:'https://example.com',targetMarkets:['Sweden'],documents:[{name:'proof.pdf'}],additionalLinks:[],
    brandIdentity:{status:'ready'},answers,profile:{companyName:'Example'},approved:true,
    market:{icps:[{active:true}],signals:[{active:true}],lastResearchAt:'2026-09-17T00:00:00Z',researchStatus:'complete',opportunities:[{active:true}],strategyApproved:true},
    campaignStudio:{coreScenario:{status:'approved'}}
  };
  main.targetingConfirmation=require('../targeting-policy.js').confirm(main);
  const discovery={status:'complete',candidates:[{company:'Buyer AB',domain:'buyer.example',qualification:{eligible:true,score:85},people:[{name:'Buyer'}]}],pipeline:[{domain:'buyer.example'}]};
  const outreach={selectedDomain:'buyer.example',items:[{domain:'buyer.example',dossier:{company:'Buyer'},drafts:{emailSubject:'Subject',emailBody:'Body'},localizationStatus:'complete',approved:true}]};
  const delivery={selectedDomain:'buyer.example',activity:[{type:'message.sent'},{type:'reply.received'},{type:'outcome.recorded'}],opportunities:[{domain:'buyer.example',sentAt:'2026-09-17T00:00:00Z',replies:[{text:'Yes'}],outcomeStage:'Meeting'}]};
  const availability=Object.fromEntries([1,2,3,4,5,6,7].map(step=>[step,true]));

  const model=Journey.buildJourneyModel({main,discovery,outreach,delivery,currentStep:7,availability,websiteActivated:true,buyerQualityPassed:true});

  assert.deepEqual(model.map(stage=>[stage.completed,stage.total]),[[3,3],[8,8],[4,4],[4,4],[2,2],[6,6],[5,5]]);
  assert.equal(model[6].active,true);
  assert.equal(model[6].status,'complete');
  assert.equal(model[6].nextAction,'Required steps complete');
});

test('current stage names the next required action without blocking on optional work',()=>{
  const model=Journey.buildJourneyModel({
    main:{website:'https://example.com',targetMarkets:[],documents:[],additionalLinks:[],brandIdentity:{}},
    currentStep:1,availability:{1:true},websiteActivated:true
  });

  assert.equal(model[0].nextAction,'Select at least one target market');
  assert.equal(model[0].requiredCompleted,1);
  assert.equal(model[0].requiredTotal,2);
  assert.equal(model[5].steps.find(step=>step.id==='brand').optional,true);
});

test('an empty current stage is labelled not started until real progress exists',()=>{
  assert.equal(typeof Journey.stageStatusLabel,'function');
  const empty=Journey.buildJourneyModel({currentStep:1,availability:{1:true}})[0];
  const started=Journey.buildJourneyModel({
    main:{website:'https://example.com'},currentStep:1,availability:{1:true},websiteActivated:true
  })[0];

  assert.equal(empty.active,true);
  assert.equal(empty.status,'not-started');
  assert.equal(Journey.stageStatusLabel(empty),'Not started');
  assert.equal(Journey.stageStatusLabel(started),'In progress');
});

test('required targeting cannot be reported as skipped optional profile context',()=>{
  const model=Journey.buildJourneyModel({main:{answers:{}},currentStep:4,availability:{1:true,2:true,3:true,4:true}});
  assert.equal(model[1].status,'not-started');
  assert.equal(model[1].completed,0);
  assert.equal(model[1].steps.find(step=>step.id==='offer-customer').optional,false);
  assert.equal(model[1].steps.find(step=>step.id==='decision-fit').optional,false);
});

test('customer shell contains seven permanent sidebar destinations and the active-stage guide',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const sidebar=html.match(/<ol class="steps">([\s\S]*?)<\/ol>/)?.[1]||'';
  const markers=[...new Set([...sidebar.matchAll(/data-workflow-stage="(\d)"/g)].map(match=>Number(match[1])))];
  assert.deepEqual(markers,[1,2,3,4,5,6,7]);
  assert.match(html,/id="journey-stage-guide"/);
  assert.match(html,/data-stage-mini-steps/);
  assert.match(html,/data-sidebar-stage-state>Not started</);
  assert.match(html,/data-stage-guide-kicker>Stage 1 · Not started</);
});

test('sidebar stage status has its own row and cannot squeeze the stage title',()=>{
  const css=fs.readFileSync(path.join(__dirname,'..','premium.css'),'utf8');
  const journeyStyles=css.match(/\/\* Commercial journey v2[\s\S]*?\/\* Workspace shell v3/)?.[0]||'';
  assert.match(journeyStyles,/\.steps li\{[^}]*grid-template-columns:24px minmax\(0,1fr\)(?:;|})/);
  assert.match(journeyStyles,/\.steps li>em\{[^}]*grid-column:2[^}]*justify-self:start[^}]*margin-top:7px/);
  assert.match(journeyStyles,/\.steps li\.active>em\{[^}]*background:#dcece5[^}]*color:#286b59/);
});

test('progressive navigation shows completed stages, the current stage and only one next stage',()=>{
  assert.equal(typeof Journey.visibleStageIds,'function');
  assert.deepEqual(Journey.visibleStageIds([
    {id:1,status:'complete'},{id:2,status:'skipped'},{id:3,status:'current'},
    {id:4,status:'available'},{id:5,status:'available'},{id:6,status:'locked'},{id:7,status:'locked'}
  ]),[1,2,3,4]);
  assert.deepEqual(Journey.visibleStageIds([
    {id:1,status:'current'},{id:2,status:'available'},{id:3,status:'available'},
    {id:4,status:'locked'},{id:5,status:'locked'},{id:6,status:'locked'},{id:7,status:'locked'}
  ]),[1,2]);
});

test('a later active stage keeps unfinished earlier stages visible for editing',()=>{
  assert.deepEqual(Journey.visibleStageIds([
    {id:1,status:'complete'},{id:2,status:'available'},{id:3,status:'locked'},
    {id:4,status:'current'},{id:5,status:'available'},{id:6,status:'locked'}
  ]),[1,2,3,4,5]);
  const processMap=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
  assert.match(processMap,/\.step-view\.active/);
  assert.match(processMap,/data-stage-mini-step/);
  assert.match(processMap,/reviewMiniStep/);
});

test('sidebar shows all seven stages and expandable substeps without changing stage access',()=>{
  const processMap=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
  const css=fs.readFileSync(path.join(__dirname,'..','premium.css'),'utf8');
  assert.match(processMap,/marker\.hidden=false/);
  assert.match(processMap,/renderSidebarSteps\(marker,stage,expandedSidebarStage===step\)/);
  assert.match(processMap,/let expandedSidebarStage=0;/);
  assert.doesNotMatch(processMap,/expandedSidebarStage=currentStage/);
  assert.doesNotMatch(processMap,/expandedSidebarStage=target/);
  assert.match(processMap,/button\.disabled=!stage\.available/);
  assert.match(processMap,/reviewMiniStep\(Number\(substep\.dataset\.stageId\),substep\.dataset\.sidebarSubstep\)/);
  assert.match(css,/\.progress-panel\{overflow-y:auto/);
  assert.match(css,/\.steps \.sidebar-substeps\[hidden\]\{display:none\}/);
});

test('friendly journey stages route through the preserved internal module IDs',()=>{
  assert.equal(Journey.journeyStageForModuleStep(2),2);
  assert.equal(Journey.journeyStageForModuleStep(3),2);
  assert.equal(Journey.journeyStageForModuleStep(4),3);
  assert.equal(Journey.journeyStageForModuleStep(5,'companies'),4);
  assert.equal(Journey.journeyStageForModuleStep(5,'buyers'),5);
  assert.deepEqual(Journey.routeForJourneyStage(2,{profile:{companyName:'Example'}}),{moduleStep:3,focus:'profile'});
  assert.deepEqual(Journey.routeForJourneyStage(3,{}),{moduleStep:4,focus:'strategy'});
  assert.deepEqual(Journey.routeForJourneyStage(4,{}),{moduleStep:5,focus:'companies'});
  assert.deepEqual(Journey.routeForJourneyStage(5,{}),{moduleStep:5,focus:'buyers'});
  assert.deepEqual(Journey.routeForJourneyStage(6,{}),{moduleStep:6,focus:'messages'});
  assert.deepEqual(Journey.routeForJourneyStage(7,{}),{moduleStep:7,focus:'delivery'});
});

test('process map renders the conceptual current stage instead of its legacy module ID',()=>{
  const processMap=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
  assert.match(processMap,/const currentStage=model\.find\(stage=>stage\.active\)\|\|model\[0\]/);
  assert.match(processMap,/renderStageGuide\(currentStage\)/);
});

test('customer shell keeps AI support, settings and task activity in a permanent right utility rail',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  assert.match(html,/<aside class="utility-panel"[^>]*>/);
  assert.match(html,/id="leadintel-copilot-entry"/);
  assert.match(html,/id="open-settings"/);
  assert.match(html,/data-utility-tasks/);
});

test('startup-critical journey runtime is not blocked by the optional module graph',()=>{
  const processMap=fs.readFileSync(path.join(__dirname,'..','process-map.js'),'utf8');
  const shellLoader=fs.readFileSync(path.join(__dirname,'..','shell-support-loader.js'),'utf8');
  assert.doesNotMatch(processMap,/^import\s/m);
  assert.match(shellLoader,/Promise\.allSettled/);
  assert.match(shellLoader,/addEventListener\(["']load["']/);
});

test('zero-result discovery guides the user without claiming companies were verified',()=>{
  const stage=Journey.buildJourneyModel({
    currentStep:5,availability:{5:true},
    discovery:{status:'no_results',targetCount:10,lastRunAt:'2026-09-22T13:00:00Z',rawResults:Array(20).fill({url:'https://evidence.example'})}
  })[3];
  const companies=stage.steps.find(step=>step.id==='companies');
  assert.equal(companies.complete,false);
  assert.equal(companies.label,'No qualified companies found');
  assert.equal(companies.action,'Review the strategy, then broaden the search');
  assert.equal(stage.nextAction,'Review the strategy, then broaden the search');
});

test('an empty latest search acknowledges previously saved companies without claiming new qualification',()=>{
 const stage=Journey.buildJourneyModel({currentStep:5,availability:{5:true},discovery:{status:'no_results',targetCount:5,selectedProspects:[{domain:'buyer.example',company:'Saved buyer'}]}})[3];
 const companies=stage.steps.find(step=>step.id==='companies');
 assert.equal(companies.complete,false);assert.equal(companies.label,'No new qualified companies · saved companies retained');assert.equal(companies.action,'Review saved companies or broaden the search');
});

test('approved profile may finish without optional paid market research',()=>{
 const answers={priority_offers:'Offer',ideal_customer:'Customer',buyer_roles:'CEO',exclusions:'None'};
 const main={website:'https://example.com',targetMarkets:['Sweden'],answers,profile:{companyName:'Example'},approved:true,market:{researchStatus:'idle'}};
 main.targetingConfirmation=require('../targeting-policy.js').confirm(main);
 const profileStage=Journey.buildJourneyModel({main,currentStep:4,availability:{1:true,2:true,3:true,4:true}})[1];
 const research=profileStage.steps.find(item=>item.id==='research');
 assert.equal(research.optional,true);assert.equal(research.complete,false);
 assert.equal(profileStage.requiredCompleted,profileStage.requiredTotal);
 assert.equal(profileStage.status,'complete');
});

test('finding a name cannot mark Buyers complete before its quality requirements pass',()=>{
 const input={currentStep:6,availability:{5:true,6:true},discovery:{selectedProspects:[{company:'Example',domain:'example.com',people:[{name:'Anna Buyer'}]}]}};
 const before=Journey.buildJourneyModel(input)[4];assert.notEqual(before.status,'complete');assert.match(before.nextAction,/quality/i);
 const after=Journey.buildJourneyModel({...input,buyerQualityPassed:true})[4];assert.equal(after.status,'complete');assert.equal(after.completed,after.total);
});
