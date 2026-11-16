const test=require('node:test'),assert=require('node:assert/strict'),B=require('../research-brief.js'),D=require('../company-dossier.js'),O=require('../outreach-engine.js');
const source='https://people.buyer.example/team/alex-morgan';
function fixture(status='current'){
 const person={id:'alex',name:'Alex Morgan',title:'Chief Commercial Officer',organization:'Buyer',publicEmail:'alex@buyer.example',publicEmailUrl:source,publicEmailEvidence:{version:2,url:source,quote:'Alex Morgan Chief Commercial Officer – Sales Email alex@buyer.example',sourceKind:'official',sourceRead:true,checkedAt:new Date().toISOString()}};
 const dossier=D.reconcile([{provider:'openai',webSearch:true,status:'partial',facts:[],people:[{name:person.name,title:'CCO',status,...(status==='incoming'?{date:'2099-01-01'}:{}),sourceUrl:'https://buyer.example/team',quote:'Alex Morgan CCO'}],sources:['https://buyer.example/team'],extractedSources:['https://buyer.example/team'],gaps:['Independent second-provider research remains incomplete.']}],{company:'Buyer',domain:'buyer.example'});
 return {person,candidate:{company:'Buyer',domain:'buyer.example',buyerDiscovery:{companyDossier:dossier}}};
}
test('a fresh read of the exact named official role verifies the brief without expanding an ambiguous acronym',()=>{
 const {person,candidate}=fixture(),brief=B.build(candidate,{},person);
 assert.equal(brief.buyer.verified,true);assert.equal(brief.buyer.url,source);assert.equal(brief.buyer.quote,person.publicEmailEvidence.quote);
 assert.notEqual(brief.researchStatus,'complete');assert.ok(brief.gaps.some(gap=>/incomplete/.test(gap)));assert.equal(brief.facts.length,0,'a role contact card is not a company development');
 const item={domain:candidate.domain,company:candidate.company,selectedPersonId:person.id,drafts:{emailSubject:'Reviewed subject',emailBody:'Exact reviewed wording'},dossier:{}};
 const baseline=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(item),candidate.domain),attached=O.attachResearchBrief(item,candidate,{},person),reopened=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(attached),candidate.domain);
 assert.deepEqual(attached.drafts,item.drafts);assert.deepEqual(reopened.drafts,baseline.drafts);assert.equal(reopened.dossier.researchBrief.buyer.verified,true);assert.equal(reopened.dossier.researchBrief.buyer.url,source);
});
test('ambiguous acronyms, unbound, stale and unread quotes never become verified role evidence',()=>{
 for(const change of [p=>delete p.publicEmailEvidence,p=>p.publicEmailEvidence.sourceRead=false,p=>p.publicEmailEvidence.checkedAt='2020-01-01',p=>p.publicEmailEvidence.checkedAt='2099-01-01',p=>p.publicEmailEvidence.url='https://unrelated.example/team',p=>p.publicEmailEvidence.sourceKind='public_listing',p=>p.publicEmailEvidence.quote='Jordan Smith Chief Commercial Officer alex@buyer.example',p=>p.publicEmailEvidence.quote='Alex Morgan Chief Compliance Officer alex@buyer.example',p=>p.publicEmailEvidence.quote='Alex Morgan is not Chief Commercial Officer',p=>p.publicEmailUrl='https://buyer.example/another-source']){
  const {person,candidate}=fixture();change(person);assert.equal(B.build(candidate,{},person).buyer.verified,false);
 }
});
test('a contact role quote cannot waive a dossier employment hold or unresolved identity',()=>{
 for(const hold of ['departed','incoming','conflict','identity']){
  const {person,candidate}=fixture(['departed','incoming'].includes(hold)?hold:'current'),d=candidate.buyerDiscovery.companyDossier;
  if(hold==='conflict')d.conflicts=[{name:person.name,reason:'Conflicting current employment'}];if(hold==='identity')person.identityStatus='pending';
  assert.equal(B.build(candidate,{},person).buyer.verified,false,hold);
 }
});
test('negative, former and future role qualifiers cannot expand an ambiguous acronym into a current role',()=>{
 for(const suffix of ['(former)','– no longer with the company','; appointed starting 2099','– not the current officer','; will join in 2099','– not employed','– employment ended in 2024','– left the company in 2024']){
  const {person,candidate}=fixture();person.publicEmailEvidence.quote='Alex Morgan Chief Commercial Officer '+suffix+' Email alex@buyer.example';
  assert.equal(B.build(candidate,{},person).buyer.verified,false,suffix);
 }
});
