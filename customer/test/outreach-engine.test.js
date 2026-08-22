const test=require('node:test');
const assert=require('node:assert/strict');
const Outreach=require('../outreach-engine.js');

const profile={
  companyName:'SellerCo',
  priorityOffers:'industrial automation; engineering services',
  idealCustomer:'manufacturers with 50–500 employees',
  decisionMakers:'COO; Procurement Director',
  targetMarkets:'Sweden; Finland',
  differentiation:'fast engineering and custom delivery',
  buyingTriggers:'new facility; modernization; tender',
  commercialObjective:'Build a €2M qualified pipeline'
};
const market={
  strategyApproved:true,
  signals:[
    {id:'modernization',name:'Equipment modernization',active:true,weight:9,keywords:'modernization; automation upgrade'},
    {id:'tender',name:'Tender activity',active:true,weight:8,keywords:'tender; procurement'}
  ],
  opportunities:[{id:'opp-sweden',market:'Sweden',active:true,score:{total:82}}]
};
const candidate={
  company:'Nordic Factory AB',domain:'nordicfactory.example',website:'https://nordicfactory.example/',market:'Sweden',
  confidence:'High',score:{fit:26,signal:20,evidence:16,timing:12,value:8,total:82},stage:'Qualified',
  matchedSignals:[{id:'modernization',name:'Equipment modernization',weight:9,matchedTerms:['modernization']}],
  people:[{id:'p1',name:'Anna Andersson',firstName:'Anna',lastName:'Andersson',title:'COO',organization:'Nordic Factory AB'}],
  evidence:[{url:'https://nordicfactory.example/news',title:'Modernization program',description:'The company announced a modernization program for production equipment.',text:'modernization program for production equipment',date:'2026-08-10'}]
};

test('buildDossierSearchQueries caps public search at two and uses company context',()=>{
  const queries=Outreach.buildDossierSearchQueries(candidate,profile,market,9);
  assert.ok(queries.length>0&&queries.length<=2);
  assert.ok(queries.every(q=>q.query&&q.domain==='nordicfactory.example'));
  assert.ok(queries.some(q=>/Nordic Factory AB/i.test(q.query)));
  assert.ok(queries.some(q=>/industrial automation/i.test(q.query)));
});

test('normalizeDossierResearchResults keeps source URLs and classifies official vs public evidence',()=>{
  const official=Outreach.normalizeDossierResearchResults({data:[{url:'https://nordicfactory.example/about',title:'About',description:'Official company profile',markdown:'Official information'}]},{domain:'nordicfactory.example',sourceType:'search'});
  const external=Outreach.normalizeDossierResearchResults({data:[{url:'https://industry.example/story',title:'Industry report',description:'Public report'}]},{domain:'nordicfactory.example',sourceType:'search'});
  assert.equal(official[0].sourceType,'Official');
  assert.equal(external[0].sourceType,'Public');
  assert.ok(official[0].url.startsWith('https://'));
});

test('recommendOffer selects only from approved priority offers',()=>{
  const research=[{url:'https://nordicfactory.example/news',title:'Automation upgrade',description:'automation modernization',text:'industrial automation upgrade',sourceType:'Official'}];
  const offer=Outreach.recommendOffer(candidate,profile,research);
  assert.equal(offer,'industrial automation');
  assert.ok(profile.priorityOffers.includes(offer));
});

test('buildOpportunityDossier separates evidence from hypotheses and grounds why-now in observed signals',()=>{
  const research=[{url:'https://nordicfactory.example/news2',title:'New automation line',description:'The company describes an automation modernization project.',text:'automation modernization project',date:'2026-08-20',sourceType:'Official'}];
  const dossier=Outreach.buildOpportunityDossier(candidate,profile,market,research);
  assert.equal(dossier.domain,'nordicfactory.example');
  assert.ok(dossier.evidence.length>=2);
  assert.ok(dossier.evidence.every(e=>e.url));
  assert.match(dossier.whyNow,/modernization/i);
  assert.ok(Array.isArray(dossier.hypotheses));
  assert.ok(dossier.hypotheses.every(h=>/^Hypothesis:/i.test(h)));
  assert.ok(!/confirmed budget|guaranteed purchase/i.test(dossier.whyNow));
});

test('buildOutreachDrafts creates grounded editable email and LinkedIn drafts without unsupported budget claims',()=>{
  const dossier=Outreach.buildOpportunityDossier(candidate,profile,market,[]);
  const drafts=Outreach.buildOutreachDrafts(dossier,candidate.people[0],profile,'consultative');
  assert.match(drafts.emailSubject,/Nordic Factory AB/i);
  assert.match(drafts.emailBody,/Anna/);
  assert.match(drafts.emailBody,/modernization/i);
  assert.match(drafts.linkedinMessage,/Nordic Factory AB/i);
  assert.ok(drafts.linkedinMessage.length<900);
  assert.doesNotMatch(drafts.emailBody,/€2M|budget is|confirmed purchase/i);
});

test('approveOutreachItem requires non-empty edited drafts and records approval',()=>{
  const dossier=Outreach.buildOpportunityDossier(candidate,profile,market,[]);
  const item={domain:candidate.domain,dossier,drafts:Outreach.buildOutreachDrafts(dossier,null,profile,'brief'),approved:false};
  const bad=Outreach.approveOutreachItem(item,{emailSubject:'',emailBody:'',linkedinMessage:''},'2026-08-22T17:00:00.000Z');
  assert.equal(bad.approved,false);
  assert.ok(bad.error);
  const good=Outreach.approveOutreachItem(item,{emailSubject:'A subject',emailBody:'A grounded body',linkedinMessage:'A LinkedIn note'},'2026-08-22T17:00:00.000Z');
  assert.equal(good.approved,true);
  assert.equal(good.approvedAt,'2026-08-22T17:00:00.000Z');
});

test('normalizeOutreachState caps items and sanitizes research state',()=>{
  const items=Array.from({length:80},(_,i)=>({domain:`company${i}.example`,company:`Company ${i}`,researchStatus:'nonsense',drafts:{emailSubject:'x',emailBody:'y',linkedinMessage:'z'}}));
  const state=Outreach.normalizeOutreachState({items,selectedDomain:'company1.example'});
  assert.ok(state.items.length<=50);
  assert.equal(state.items[0].researchStatus,'idle');
  assert.equal(state.selectedDomain,'company1.example');
});