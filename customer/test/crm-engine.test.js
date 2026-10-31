const test=require('node:test');
const assert=require('node:assert/strict');
const crm=require('../crm-engine.js');

test('discovery candidate maps into compact durable CRM payload',()=>{
  const candidate={company:'Acme',domain:'www.acme.example',website:'https://www.acme.example/',market:'Sweden',score:{fit:25,signal:20,evidence:18,timing:12,value:8,total:83},confidence:'High',matchedSignals:[{name:'Expansion',matchedTerms:['new factory']}],evidence:[{url:'https://acme.example/news',title:'Factory'}],people:[{id:'apollo-1',name:'Anna Buyer',title:'Procurement Director',email:'anna@acme.example'}]};
  const payload=crm.mapDiscoveryCandidateToCrm(candidate,{pipelineStage:'Discovered'});
  assert.equal(payload.company.company_name,'Acme');
  assert.equal(payload.company.domain,'acme.example');
  assert.equal(payload.company.pipeline_stage,'Discovered');
  assert.equal(payload.company.opportunity_score,83);
  assert.equal(payload.contacts[0].external_person_id,'apollo-1');
  assert.equal(payload.contacts[0].work_email,'anna@acme.example');
  assert.equal(payload.intelligence.matched_signals.length,1);
  assert.equal(payload.intelligence.evidence.length,1);
  assert.equal(payload.intelligence.confidence,'High');
});

test('legacy Contact Found stage migrates safely to Qualified',()=>{
  assert.equal(crm.normalizeCrmStage('Contact Found'),'Qualified');
  const payload=crm.mapLocalPipelineItemToCrm({company:'Acme',domain:'acme.example',stage:'Contact Found'});
  assert.equal(payload.company.pipeline_stage,'Qualified');
});

test('source-backed buyer details retain public evidence and unverified email status',()=>{
  const [contact]=crm.mapContacts([{id:'apollo-1',name:'Mikael',title:'CEO',publicName:'Mikael Example',publicNameUrl:'https://example.com/team',publicEmail:'mikael.example@example.com',publicEmailUrl:'https://example.com/team',publicLinkedinUrl:'https://www.linkedin.com/in/mikael-example'}]);
  assert.equal(contact.name,'Mikael Example');
  assert.equal(contact.work_email,'mikael.example@example.com');
  assert.equal(contact.email_status,'public_unverified');
  assert.equal(contact.public_name_url,'https://example.com/team');
  assert.equal(contact.public_email_url,'https://example.com/team');
  assert.equal(contact.linkedin_url,'https://www.linkedin.com/in/mikael-example');
  assert.equal(crm.mapContacts([{id:'apollo-2',name:'Anna Verified',publicName:'Anna Other',publicNameUrl:'https://example.com/team'}])[0].name,'Anna Verified');
});

test('CRM filtering supports lifecycle, pipeline and company/contact search projection',()=>{
  const companies=[
    {id:'1',company_name:'Acme',normalized_domain:'acme.example',lifecycle_status:'prospect',pipeline_stage:'Qualified',contact_search:'Anna Buyer anna@acme.example'},
    {id:'2',company_name:'Beta',normalized_domain:'beta.example',lifecycle_status:'customer',pipeline_stage:'Won',contact_search:'Bob CEO'}
  ];
  assert.equal(crm.filterCrmCompanies(companies,{q:'anna'}).length,1);
  assert.equal(crm.filterCrmCompanies(companies,{lifecycle:'customer'}).length,1);
  assert.equal(crm.filterCrmCompanies(companies,{pipeline:'active'}).length,2);
});

test('suppressed CRM companies are never considered normal outreach targets',()=>{
  assert.equal(crm.isSuppressed({lifecycle_status:'suppressed'}),true);
  assert.equal(crm.isSuppressed({lifecycle_status:'prospect'}),false);
});
test('CRM research snapshot preserves public phone provenance and buyer scope holds without claiming verification',()=>{
 const payload=crm.mapDiscoveryCandidateToCrm({company:'Example',domain:'example.com',people:[{name:'Anna Buyer',publicPhone:'+46 70 235 51 61',publicPhoneUrl:'https://example.com/jobs',publicEmail:'anna@example.com',publicEmailUrl:'https://example.com/jobs',opportunityScope:{status:'review_required',reason:'Subsidiary responsibility unknown',url:'https://linkedin.com/in/anna'}}]});
 const saved=JSON.parse(JSON.stringify(payload)).intelligence.research_snapshot.buyerResearch.buyers[0];
 assert.equal(saved.contactEvidence.phone,'+46 70 235 51 61');assert.equal(saved.contactEvidence.phoneUrl,'https://example.com/jobs');assert.equal(saved.contactEvidence.phoneStatus,'public_unverified');assert.equal(saved.opportunityScope.status,'review_required');
});

test('company CRM snapshot preserves every retained source, signal and material review input without aliases',()=>{
 const evidence=Array.from({length:28},(_,i)=>({url:`https://acme.example/news/${i}`,text:`Source quote ${i}`,sourceRead:true,extractedAt:'2026-10-31T08:00:00Z'}));
 const candidate={id:'company-stable',crmId:'crm-stable',company:'Acme',domain:'acme.example',evidence,matchedSignals:Array.from({length:24},(_,i)=>({id:`signal-${i}`})),score:{total:83},qualification:{version:2,eligible:true},exclusionCheck:{status:'clear'},qualificationGaps:['Timing unknown'],buyerRoles:'Engineering Director',buyerRolesChanged:true,buyerRolesSource:'manual',strategyFingerprint:'strategy-old',searchContextKey:'seller-old',buyerDiscovery:{companyDossier:{facts:[{quote:'Historical fact'}]},officialContactInventory:{channels:[{value:'info@acme.example'}]}},people:[{id:'anna',name:'Anna Buyer',contactResearch:{checks:{gmail:{status:'complete'}}}}]};
 const payload=crm.mapDiscoveryCandidateToCrm(candidate),snapshot=payload.intelligence.research_snapshot.companyResearch;
 assert.equal(payload.intelligence.evidence.length,28);assert.equal(payload.intelligence.matched_signals.length,24);
 assert.equal(snapshot.id,'company-stable');assert.equal(snapshot.buyerRolesSource,'manual');assert.deepEqual(snapshot.exclusionCheck,candidate.exclusionCheck);assert.equal(snapshot.strategyFingerprint,'strategy-old');assert.equal(snapshot.searchContextKey,'seller-old');
 candidate.evidence[0].text='Changed quote';candidate.qualification.eligible=false;candidate.buyerDiscovery.companyDossier.facts[0].quote='Changed fact';candidate.people[0].contactResearch.checks.gmail.status='failed';
 assert.equal(payload.intelligence.evidence[0].text,'Source quote 0');assert.equal(snapshot.qualification.eligible,true);assert.equal(payload.intelligence.research_snapshot.buyerResearch.discovery.companyDossier.facts[0].quote,'Historical fact');assert.equal(payload.intelligence.research_snapshot.buyerResearch.buyers[0].contactResearch.checks.gmail.status,'complete');
});

test('pure company CRM restore isolates identity, keeps newer/manual local inputs and retains historical evidence',()=>{
 const original={id:'company-stable',company:'Acme',domain:'acme.example',evidence:[{url:'https://acme.example/news',text:'Original quote'}],matchedSignals:[{id:'expansion'}],buyerRoles:'Engineering Director',buyerRolesSource:'manual',buyerRolesChanged:true,exclusionCheck:{status:'clear'},qualification:{version:2,eligible:true},strategyFingerprint:'old'};
 const pack=crm.mapDiscoveryCandidateToCrm(original),detail={company:{id:'crm-stable',workspace_id:'w1',normalized_domain:'acme.example'},intelligence:pack.intelligence};
 const recovered=crm.restoreCompanyResearch({domain:'acme.example'},detail,{workspaceId:'w1',strategyFingerprint:'new'});
 assert.equal(recovered.id,'company-stable');assert.equal(recovered.crmId,'crm-stable');assert.equal(recovered.buyerRoles,'Engineering Director');assert.equal(recovered.buyerRolesSource,'manual');assert.equal(recovered.needsRecheck,true);assert.equal(recovered.strategyFingerprint,'old');
 const local={domain:'acme.example',buyerRoles:'Custom role',buyerRolesSource:'manual',buyerRolesChanged:true,qualification:{version:2,eligible:false},exclusionCheck:{status:'blocked'},evidence:[{url:'https://acme.example/news',text:'New quote'}]};
 const merged=crm.restoreCompanyResearch(local,detail,{workspaceId:'w1'});
 assert.equal(merged.buyerRoles,'Custom role');assert.equal(merged.qualification.eligible,false);assert.equal(merged.exclusionCheck.status,'blocked');assert.equal(merged.evidence.length,2);assert.equal(local.evidence.length,1);merged.evidence[0].text='Mutation';assert.equal(local.evidence[0].text,'New quote');
 assert.equal(crm.restoreCompanyResearch({domain:'other.example'},detail),null);assert.equal(crm.restoreCompanyResearch({domain:'acme.example'},detail,{workspaceId:'w2'}),null);
});


test('company restore patch leaves buyer identity, research and in-flight owner references intact',()=>{
 const person={id:'anna',name:'Anna Buyer'},buyerDiscovery={checkedAt:'2026-10-31T08:00:00Z'},publicResearch={issues:['Pending source']};
 const candidate={domain:'acme.example',people:[person],buyerDiscovery,publicResearch};
 const detail={company:{id:'crm-company',normalized_domain:'acme.example'},intelligence:crm.mapDiscoveryCandidateToCrm({...candidate,buyerRoles:'Engineering Director'}).intelligence};
 const patch=crm.restoreCompanyResearch(candidate,detail);
 for(const key of ['people','buyerDiscovery','publicResearch'])assert.equal(Object.hasOwn(patch,key),false);
 Object.assign(candidate,patch);assert.equal(candidate.people[0],person);assert.equal(candidate.buyerDiscovery,buyerDiscovery);assert.equal(candidate.publicResearch,publicResearch);assert.equal(candidate.buyerRoles,'Engineering Director');
});
