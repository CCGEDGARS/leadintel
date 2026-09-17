const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const modulePath=path.join(__dirname,'..','journey-progress.js');
const Journey=fs.existsSync(modulePath)?require(modulePath):{};

test('commercial journey exposes one canonical seven-stage model',()=>{
  assert.equal(typeof Journey.buildJourneyModel,'function');
  const model=Journey.buildJourneyModel({currentStep:1,availability:{1:true}});
  assert.deepEqual(model.map(stage=>stage.name),[
    'Company & Market','Commercial Context','Intelligence Profile','Market Strategy',
    'Company Discovery','Campaign Studio','Delivery & Learning'
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
  const discovery={status:'complete',candidates:[{company:'Buyer AB',domain:'buyer.example',people:[{name:'Buyer'}]}],pipeline:[{domain:'buyer.example'}]};
  const outreach={selectedDomain:'buyer.example',items:[{domain:'buyer.example',dossier:{company:'Buyer'},drafts:{emailSubject:'Subject',emailBody:'Body'},localizationStatus:'complete',approved:true}]};
  const delivery={selectedDomain:'buyer.example',activity:[{type:'message.sent'},{type:'reply.received'},{type:'outcome.recorded'}],opportunities:[{domain:'buyer.example',sentAt:'2026-09-17T00:00:00Z',replies:[{text:'Yes'}],outcomeStage:'Meeting'}]};
  const availability=Object.fromEntries([1,2,3,4,5,6,7].map(step=>[step,true]));

  const model=Journey.buildJourneyModel({main,discovery,outreach,delivery,currentStep:7,availability,websiteActivated:true});

  assert.deepEqual(model.map(stage=>[stage.completed,stage.total]),[[4,4],[4,4],[3,3],[5,5],[5,5],[5,5],[5,5]]);
  assert.equal(model[6].status,'current');
  assert.equal(model[6].nextAction,'Stage complete');
});

test('current stage names the next required action without blocking on optional work',()=>{
  const model=Journey.buildJourneyModel({
    main:{website:'https://example.com',targetMarkets:[],documents:[],additionalLinks:[],brandIdentity:{}},
    currentStep:1,availability:{1:true},websiteActivated:true
  });

  assert.equal(model[0].nextAction,'Select at least one target market');
  assert.equal(model[0].requiredCompleted,1);
  assert.equal(model[0].requiredTotal,2);
  assert.equal(model[0].steps.find(step=>step.id==='brand').optional,true);
});

test('skipped optional context is distinguished from completed work',()=>{
  const model=Journey.buildJourneyModel({main:{answers:{}},currentStep:3,availability:{1:true,2:true,3:true}});
  assert.equal(model[1].status,'skipped');
  assert.equal(model[1].completed,0);
});

test('customer shell contains seven permanent sidebar destinations and the active-stage guide',()=>{
  const html=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
  const sidebar=html.match(/<ol class="steps">([\s\S]*?)<\/ol>/)?.[1]||'';
  const markers=[...sidebar.matchAll(/data-step-marker="(\d)"/g)].map(match=>Number(match[1]));
  assert.deepEqual(markers,[1,2,3,4,5,6,7]);
  assert.match(html,/id="journey-stage-guide"/);
  assert.match(html,/data-stage-mini-steps/);
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
