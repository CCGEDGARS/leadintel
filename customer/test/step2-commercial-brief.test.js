const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const ROOT=path.join(__dirname,'..');

test('Commercial Intelligence Brief exposes ten fields in three groups',()=>{
  const Brief=require('../step2-brief-schema.js');
  assert.deepEqual(Brief.GROUPS.map(group=>[group.id,group.fields.length]),[
    ['targeting',4],['signals',2],['message',4]
  ]);
  assert.deepEqual(Brief.FIELD_IDS,[
    'priority_offers','ideal_customer','buyer_roles','exclusions',
    'buying_outcomes','buying_triggers','value_proposition',
    'differentiation','proof_points','objections'
  ]);
});

test('migration preserves canonical and retired commercial data without reinterpretation',()=>{
  const Brief=require('../step2-brief-schema.js');
  const current={answers:{
    ideal_customer:'Approved manufacturers',growth_markets:'Furniture distributors',
    opportunity_value:'€20,000+',success_outcome:'20 qualified leads',
    differentiation:'Certified installation'
  },answerStatus:{ideal_customer:'accepted',differentiation:'user'}};
  const once=Brief.migrateState(current);
  const twice=Brief.migrateState(once);
  assert.equal(once.answers.ideal_customer,'Approved manufacturers');
  assert.equal(once.answerStatus.ideal_customer,'accepted');
  assert.equal(once.answers.differentiation,'Certified installation');
  assert.equal(once.legacyStrategyContext.growthMarkets,'Furniture distributors');
  assert.equal(once.advancedScoring.opportunityValue,'€20,000+');
  assert.equal(once.workspaceGoals.successOutcome,'20 qualified leads');
  assert.deepEqual(twice,once);
});

test('profile fields map the brief to one downstream contract',()=>{
  const Brief=require('../step2-brief-schema.js');
  const profile=Brief.profileFields({
    priority_offers:'Installation',ideal_customer:'Manufacturers',buyer_roles:'Operations Director',
    exclusions:'Private consumers',buying_outcomes:'Reduce downtime',buying_triggers:'New production line',
    value_proposition:'Fast installation',differentiation:'Certified specialists',
    proof_points:'ISO 9001',objections:'Implementation downtime'
  });
  assert.deepEqual(profile,{
    priorityOffers:'Installation',idealCustomer:'Manufacturers',decisionMakers:'Operations Director',
    exclusions:'Private consumers',customerPainPoints:'Reduce downtime',buyingOutcomes:'Reduce downtime',
    buyingTriggers:'New production line',valueProposition:'Fast installation',differentiation:'Certified specialists',
    proofPoints:'ISO 9001',commonObjections:'Implementation downtime'
  });
});

test('Step 2 entry point loads the versioned canonical schema first',()=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.match(html,/step2-brief-schema\.js\?v=20260916-commercial-brief-v1/);
  assert.ok(html.indexOf('step2-brief-schema.js')<html.indexOf('profile-engine.js'));
});

test('Step 2 is grouped as a Commercial Intelligence Brief',()=>{
  const Brief=require('../step2-brief-schema.js');
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const processMap=fs.readFileSync(path.join(ROOT,'process-map.js'),'utf8');
  assert.match(html,/Build your Commercial Intelligence Brief/);
  assert.match(html,/data-brief-group="targeting"/);
  assert.match(html,/data-brief-group="signals"/);
  assert.match(html,/data-brief-group="message"/);
  for(const id of Brief.FIELD_IDS)assert.match(html,new RegExp(`data-question="${id}"`));
  for(const retired of ['growth_markets','lookalike_customers','opportunity_value','success_outcome']){
    assert.doesNotMatch(html,new RegExp(`data-question="${retired}"`));
  }
  assert.doesNotMatch(processMap,/data-question="sales_motion"/);
  assert.doesNotMatch(processMap,/configureSalesMotionQuestion03/);
});

test('each brief group exposes a reviewed progress counter',()=>{
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  assert.match(html,/data-brief-progress="targeting">0\/4 reviewed/);
  assert.match(html,/data-brief-progress="signals">0\/2 reviewed/);
  assert.match(html,/data-brief-progress="message">0\/4 reviewed/);
  const readiness=fs.readFileSync(path.join(ROOT,'step2-readiness-engine.js'),'utf8');
  assert.match(readiness,/data-brief-progress/);
  assert.match(readiness,/group\.fields\.filter/);
});

test('research review names evidence drafts and AI hypotheses separately',()=>{
  const ui=fs.readFileSync(path.join(ROOT,'company-research-ui.js'),'utf8');
  assert.match(ui,/Evidence-backed draft/);
  assert.match(ui,/AI hypothesis/);
  assert.match(ui,/evidence_draft/);
  assert.match(ui,/hypothesis_draft/);
});

test('approved brief fields enter the Company Intelligence Profile',()=>{
  const Profile=require('../profile-engine.js');
  const Readiness=require('../step2-readiness-engine.js');
  Readiness.patchProfileEngine(Profile);
  const answers={
    priority_offers:'Installation',ideal_customer:'Industrial manufacturers',buyer_roles:'Operations Director',exclusions:'Private consumers',
    buying_outcomes:'Reduce production downtime and avoid costly installation delays',buying_triggers:'New production line',value_proposition:'Fast installation with limited disruption',
    differentiation:'Certified specialists',proof_points:'ISO 9001 and 120 completed projects',objections:'Concern about implementation downtime'
  };
  const answerStatus=Object.fromEntries(Object.keys(answers).map(id=>[id,'accepted']));
  const profile=Profile.buildCompanyIntelligenceProfile({website:'https://example.com',targetMarkets:['Sweden'],answers,answerStatus});
  assert.equal(profile.valueProposition,'Fast installation with limited disruption');
  assert.equal(profile.proofPoints,'ISO 9001 and 120 completed projects');
  assert.equal(profile.commonObjections,'Concern about implementation downtime');
  assert.equal(profile.customerPainPoints,'Reduce production downtime and avoid costly installation delays');
});

test('Core Outreach Scenario uses value proposition and invalidates when proof changes',()=>{
  const Outreach=require('../outreach-engine.js');
  const profile={idealCustomer:'Manufacturers',priorityOffers:'Installation',decisionMakers:'Operations Director',buyingTriggers:'New line',valueProposition:'Fast installation',proofPoints:'ISO 9001',commonObjections:'Downtime'};
  const scenario=Outreach.buildCoreScenario(profile,'en');
  assert.equal(scenario.valueProposition,'Fast installation');
  const approved={...scenario,status:'approved'};
  const changed=Outreach.normalizeCampaignStudio({coreScenario:approved},{...profile,proofPoints:'ISO 9001; 120 projects'},'en');
  assert.equal(changed.coreScenario.status,'needs_review');
});
