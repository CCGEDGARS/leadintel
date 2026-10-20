const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function runtime(background=false){
  let builds=0,checks=0,raw=JSON.stringify({website:'https://seller.example',profile:{priorityOffers:'Training'},market:{signals:[]}});
  const c={console,URL,setTimeout,clearTimeout,addEventListener(){},document:{getElementById(){return null;}},
    localStorage:{getItem:()=>raw},
    LeadIntelDiscovery:{canonicalDomain:value=>value,effectiveTargetingProfile:p=>{builds++;return p;},assessCompanyQualification:(candidate,profile,market,rules)=>{checks++;return {offer:profile.priorityOffers,lifecycle:candidate.lifecycle_status,minimum:rules.minimumScore,researchedAt:rules.researchedAt};}},
    LeadIntelServerBridge:{workspace:{id:'one'},session:{user:{id:'user'}}},
    LeadIntelQualificationSettings:{get:()=>({minimumScore:80})}};
  if(background)c.LeadIntelQualificationDisplay=require('../qualification-display.js');
  c.window=c;
  const source=fs.readFileSync(path.join(__dirname,'../discovery-ui.js'),'utf8').replace(/\ninitDiscoveryWhenReady\(\);\s*$/,'');
  vm.createContext(c);vm.runInContext(source,c);
  return {c,setRaw:value=>{raw=JSON.stringify(value);},builds:()=>builds,checks:()=>checks,assess:()=>c.qualificationAssessment({domain:'buyer.example',researchedAt:'2026-10-20'})};
}

test('repeated company checks prepare the shared context once but still verify each company',()=>{
  const r=runtime();
  for(let i=0;i<200;i++)assert.equal(r.assess().offer,'Training');
  assert.equal(r.builds(),1,'sidebar and cards must not rebuild the same qualification profile per row');
  assert.equal(r.checks(),200,'evidence and freshness checks are never cached');
});

test('qualification context follows saved edits, workspace changes and late-loaded reference models',()=>{
  const r=runtime();r.assess();
  r.setRaw({profile:{priorityOffers:'Logistics'},market:{signals:[]}});
  assert.equal(r.assess().offer,'Logistics');assert.equal(r.builds(),2);
  r.c.LeadIntelServerBridge.workspace.id='two';r.assess();assert.equal(r.builds(),3);
  r.c.LeadIntelReferenceCustomerPortfolio={getCombinedActiveModel:()=>({active:true})};r.assess();assert.equal(r.builds(),4);
  r.c.LeadIntelQualificationSettings.get=()=>({minimumScore:90});assert.equal(r.assess().minimum,90);
  vm.runInContext("crmCompanies=[{normalized_domain:'buyer.example',lifecycle_status:'suppressed'}]",r.c);
  assert.equal(r.assess().lifecycle,'suppressed');
});

test('one presentation pass checks each unchanged company once; actions still check afresh',()=>{
  const r=runtime();
  r.c.withQualificationPresentation(()=>{for(let i=0;i<40;i++)r.assess();});
  assert.equal(r.checks(),1);
  r.assess();assert.equal(r.checks(),2,'an action must not reuse presentation eligibility');
  r.c.withQualificationPresentation(()=>{
    r.c.qualificationAssessment({domain:'buyer.example',researchedAt:'2026-10-20',evidence:[{text:'Changed evidence'}]});
    r.c.LeadIntelQualificationSettings.get=()=>({minimumScore:95});
    assert.equal(r.assess().minimum,95);
  });
  assert.equal(r.checks(),4,'evidence and rule changes invalidate presentation results');
});


test('background display never runs scoring on the UI call stack, while actions remain fresh',()=>{
  const r=runtime(true);
  const shown=r.c.withQualificationPresentation(()=>r.assess());
  assert.equal(shown.pending,true);assert.equal(r.checks(),0);
  assert.equal(r.assess().offer,'Training');assert.equal(r.checks(),1);
});
