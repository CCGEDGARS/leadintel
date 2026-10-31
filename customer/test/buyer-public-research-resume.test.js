const {test}=require('node:test'),assert=require('node:assert/strict');
const D=require('../discovery-engine.js'),CRM=require('../crm-engine.js');
const fixture=(company='Northstar Steel',domain='northstar.example',name='Francisco Veras',title='Project Director')=>({company,domain,buyerSearchMode:'user_selected_target',people:[{id:'buyer',name,publicName:name,title,organization:company,publicNameUrl:`https://${domain}/team`,identityStatus:'confirmed'}]});
const official=c=>({url:`https://${c.domain}/team`,markdown:`${c.people[0].name} — ${c.people[0].title} — ${c.company}`,sourceRead:true});

test('an unsourced full identity cannot be replaced by a same-first-name public profile across industries',()=>{
 for(const [company,name,other,title] of [['Northstar Steel','Alice Smith','Alice Jones','Procurement Director'],['Cloud Legal','Teemu Suursalmi','Teemu Virtanen','Managing Partner']]){
  const person={id:'original',name,title,organization:company},url='https://linkedin.com/in/other-person';
  const match=D.matchPublicLinkedInProfiles([person],[{url,title:`${other} – ${title} – ${company} | LinkedIn`}],company)[0];
  assert.deepEqual(match,person,'a shared first name, employer and role cannot replace the retained full identity');
  const exact=D.matchPublicLinkedInProfiles([person],[{url,title:`${name} – ${title} – ${company} | LinkedIn`}],company)[0];
  assert.equal(exact.publicName,name);assert.equal(exact.publicLinkedinUrl,url);
 }
});

test('mandatory reconciliation keeps the original full identity and its research receipts when another surname is found',async()=>{
 for(const [company,domain,name,other,title] of [['Northstar Steel','northstar.example','Alice Smith','Alice Jones','Procurement Director'],['Cloud Legal','cloudlegal.example','Teemu Suursalmi','Teemu Virtanen','Managing Partner']]){
  const c=fixture(company,domain,name,title),person=c.people[0];delete person.publicName;delete person.publicNameUrl;
  await D.runMandatoryBuyerResearch(c,{rows:[{url:`https://${domain}/`,markdown:`${company} official company website.`,sourceRead:true}],search:async q=>q.startsWith('site:linkedin.com/in/')?[{url:'https://linkedin.com/in/other-person',title:`${other} – ${title} – ${company} | LinkedIn`}]:[]});
  assert.equal(person.name,name);assert.equal(person.id,'buyer');assert.ok(!person.publicName||person.publicName===name);
  assert.ok(!person.publicLinkedinUrl);assert.ok(!person.linkedinIdentityEvidence);
  assert.ok(person.contactResearch.identityKey.includes(name.toLowerCase()));
  assert.ok(person.contactResearch.checks.linkedin.queryLog.every(row=>row.query.includes(`"${name}"`)&&row.status==='complete'));
 }
});

test('only a clearly incomplete first-name record permits a sourced surname extension',()=>{
 const url='https://linkedin.com/in/alice-smithson',row={url,title:'Alice Smithson – Procurement Director – Example | LinkedIn'};
 const firstOnly={name:'Alice',title:'Procurement Director',publicName:'Alice Smith',publicNameUrl:'https://example.com/team'};
 assert.equal(D.matchPublicLinkedInProfiles([firstOnly],[row],'Example')[0].publicName,'Alice Smithson');
 const full={...firstOnly,name:'Alice Smith'};
 assert.deepEqual(D.matchPublicLinkedInProfiles([full],[row],'Example')[0],full,'a complete surname is not a prefix-match identity');
});

test('refresh ambiguity holds an existing automatic profile match through workspace and CRM reload',async()=>{
 const c=fixture('Northstar Steel','northstar.example','Alice Smith','Procurement Director'),person=c.people[0],url='https://linkedin.com/in/alice-smith';
 const row={url,title:'Alice Smith – Procurement Director – Northstar Steel | LinkedIn'};
 Object.assign(person,D.matchPublicLinkedInProfiles([person],[row],c.company)[0]);
 assert.equal(D.linkedInVerification(person,c).status,'automatic');
 await D.runMandatoryBuyerResearch(c,{force:true,currentRows:[official(c)],search:async q=>q.startsWith('site:linkedin.com/in/')?[row,{...row,url:'https://se.linkedin.com/in/alice-smith-2'}]:[]});
 assert.equal(D.linkedInVerification(person,c).status,'review_required');
 assert.equal(person.publicLinkedinUrl,url,'the prior source remains available for explicit review');
 assert.ok(!person.linkedinIdentityEvidence,'ambiguity invalidates automatic public provenance');
 const saved=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0];
 assert.equal(D.linkedInVerification(saved.people[0],saved).status,'review_required');
 const sparse=D.normalizeDiscoveryState({selectedProspects:[{...c,people:[{...person,linkedinProfileReview:undefined,linkedinIdentityEvidence:undefined}]}]}).selectedProspects[0].people[0];
 const merged=D.mergeBuyerPool(saved.people,[sparse],{decisionMakers:['Procurement Director']})[0];
 assert.deepEqual(merged.linkedinProfileReview,saved.people[0].linkedinProfileReview);
 assert.equal(D.linkedInVerification(merged,c).status,'review_required','a sparse normalized refresh cannot discard the recorded ambiguity');
 const snapshot=CRM.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch;
 const restored=D.normalizeDiscoveryState({selectedProspects:[{...saved,people:snapshot.buyers}]}).selectedProspects[0];
 assert.equal(D.linkedInVerification(restored.people[0],restored).status,'review_required');
 const resolved=D.matchPublicLinkedInProfiles([saved.people[0]],[row],c.company)[0];
 assert.equal(D.linkedInVerification(resolved,c).status,'automatic','a unique new source may resolve the public ambiguity');
});

test('ambiguous public search keeps manual profile review and paid identity fields separate',()=>{
 const c=fixture('Cloud Legal','cloudlegal.example','Alice Smith','Managing Partner'),person=c.people[0],url='https://linkedin.com/in/alice-smith';
 const rows=[url,'https://linkedin.com/in/alice-smith-2'].map(url=>({url,title:'Alice Smith – Managing Partner – Cloud Legal | LinkedIn'}));
 const reviewed={...person,publicLinkedinUrl:url,linkedinConfirmedUrl:url,linkedinConfirmedAt:new Date().toISOString(),linkedinConfirmationMethod:'manual',publicEmail:'alice@cloudlegal.example',publicEmailUrl:person.publicNameUrl};
 const manual=D.matchPublicLinkedInProfiles([reviewed],rows,c.company)[0];
 assert.equal(D.linkedInVerification(manual,c).status,'manual');assert.equal(manual.linkedinConfirmedUrl,url);assert.equal(manual.publicEmail,reviewed.publicEmail);
 const paid={...reviewed,identitySource:'apollo',linkedin_url:url};
 assert.deepEqual(D.matchPublicLinkedInProfiles([paid],rows,c.company)[0],paid);
});

test('previous employment and contradictory current-employer claims cannot confirm a target-company profile',async()=>{
 for(const [company,domain,name,title] of [['Northstar Steel','northstar.example','Alice Smith','Procurement Director'],['Cloud Legal','cloudlegal.example','Teemu Suursalmi','Managing Partner']]){
  const c=fixture(company,domain,name,title),person=c.people[0],url='https://linkedin.com/in/current-employer';
  const current={url,title:`${name} – ${title} – ${company} | LinkedIn`};
  const rows=[{url,title:`${name} – ${title} – Other Company | LinkedIn`,description:`Currently at Other Company. Previously ${title} at ${company}.`},{url,title:`${name} – ${title} | LinkedIn`,description:`Current employer: Other Company. Experience includes ${company}.`}];
  for(const row of rows){
   const direct=D.matchPublicLinkedInProfiles([fixture(company,domain,name,title).people[0]],[row],company)[0];
   assert.ok(!direct.publicLinkedinUrl,'past or contradictory employment cannot create a public match');
   Object.assign(person,D.matchPublicLinkedInProfiles([person],[current],company)[0]);
   Object.assign(person,{publicEmail:`buyer@${domain}`,publicEmailUrl:person.publicNameUrl,publicEmailSourceCheck:{status:'confirmed',email:`buyer@${domain}`,url:person.publicNameUrl,checkedAt:new Date().toISOString()}});
   assert.equal(D.qualifyBuyer(person,{decisionMakers:[title]},c).eligible,true);
   await D.runMandatoryBuyerResearch(c,{force:true,currentRows:[official(c)],search:async q=>q.startsWith('site:linkedin.com/in/')?[row]:[]});
   assert.equal(D.linkedInVerification(person,c).status,'review_required','new contradictory evidence holds earlier automatic provenance');
   assert.ok(!person.linkedinIdentityEvidence);
   assert.equal(D.qualifyBuyer(person,{decisionMakers:[title]},c).eligible,false,'contradictory current employment also holds buyer selection even when an earlier company email was confirmed');
   assert.equal(person.publicEmail,`buyer@${domain}`,'the source-backed email remains evidence rather than being erased');
   const saved=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0];
   assert.equal(D.qualifyBuyer(saved.people[0],{decisionMakers:[title]},saved).eligible,false);
   const sparse={...saved.people[0],opportunityScope:null,linkedinProfileReview:null,linkedinIdentityEvidence:null};
   const merged=D.mergeBuyerPool(saved.people,[sparse],{decisionMakers:[title]})[0];
   assert.equal(D.qualifyBuyer(merged,{decisionMakers:[title]},saved).eligible,false,'a sparse refresh cannot discard the employer selection hold');
  }
 }
});

test('mandatory public research retains direct LinkedIn results across industries and names',async()=>{
 for(const [company,domain,name,title,path] of [['Northstar Steel','northstar.example','Francisco Veras','Project Director','francisco-veras'],['Cloud Legal','cloudlegal.example','Teemu Suursalmi','Managing Partner','teemu-suursalmi-56a12bbb']]){
  const c=fixture(company,domain,name,title),url=`https://se.linkedin.com/in/${path}`;
  await D.runMandatoryBuyerResearch(c,{rows:[official(c)],search:async q=>q.startsWith('site:linkedin.com/in/')?[{url,title:`${name} – ${company} | LinkedIn`}]:[]});
  assert.equal(c.people[0].publicLinkedinUrl,url);
  assert.equal(c.people[0].linkedinIdentityEvidence.organization,company);
  assert.ok(!c.people[0].publicEmail);
  assert.equal(c.people[0].linkedinConfirmedUrl,undefined,'public matching never fabricates manual confirmation');
  const saved=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0];
  assert.equal(saved.people[0].publicLinkedinUrl,url);
  assert.equal(CRM.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch.buyers[0].publicLinkedinUrl,url);
 }
});

test('separate successful searches cannot turn two distinct same-name profiles into a unique match',async()=>{
 const c=fixture(),name=c.people[0].name;
 await D.runMandatoryBuyerResearch(c,{rows:[official(c)],search:async q=>q.startsWith('site:linkedin.com/in/')?[{url:'https://se.linkedin.com/in/francisco-veras',title:`${name} – ${c.company} | LinkedIn`}]:q.includes('filetype:pdf')?[{url:'https://es.linkedin.com/in/francisco-veras-other',title:`${name} – ${c.company} | LinkedIn`}]:[]});
 assert.ok(!c.people[0].publicLinkedinUrl);
 assert.ok(!c.people[0].linkedinIdentityEvidence);
});

test('resume replays a legacy completed LinkedIn search whose profile evidence was never reconciled',async()=>{
 const c=fixture(),url='https://es.linkedin.com/in/francisco-veras',rows=[official(c)],search=async q=>q.startsWith('site:linkedin.com/in/')?[{url,title:`${c.people[0].name} – ${c.company} | LinkedIn`}]:[];
 await D.runMandatoryBuyerResearch(c,{rows,search});
 assert.equal(D.buyerResearchCoveragePassed(c),true);
 delete c.people[0].publicLinkedinUrl;delete c.people[0].linkedinIdentityEvidence;delete c.people[0].contactResearch.checks.linkedin.profileMatchVersion;
 // A legacy unresolved profile had no profile in its original identity binding.
 c.people[0].contactResearch.identityKey=D.buyerResearchIdentityKey(c,c.people[0]);
 assert.equal(D.buyerResearchCoveragePassed(c),false,'aggregate completion cannot conceal unreconciled legacy profile results');
 const saved=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0],queries=[];
 await D.runMandatoryBuyerResearch(saved,{search:async q=>{queries.push(q);return search(q);}});
 assert.equal(saved.people[0].publicLinkedinUrl,url);
 assert.equal(queries.length,1,'other successful query plans remain cached');
 assert.ok(queries[0].startsWith('site:linkedin.com/in/'));
 assert.equal(saved.people[0].contactResearch.checks.linkedin.profileMatchVersion,1);
 assert.equal(D.buyerResearchCoveragePassed(saved),true);
});

test('profile matching considers evidence after eight unrelated results and deduplicates localized hosts',()=>{
 const c=fixture(),person=c.people[0],url='https://es.linkedin.com/in/francisco-veras';
 const rows=Array.from({length:10},(_,i)=>({url:`https://news.example/${i}`,title:'Unrelated company news'}));
 rows.push({url,title:`${person.name} - ${c.company} | LinkedIn`},{url:'https://www.linkedin.com/in/francisco-veras?trk=search',title:`${person.name} - ${c.company} | LinkedIn`});
 assert.equal(D.matchPublicLinkedInProfiles([person],rows,c.company)[0].publicLinkedinUrl,url);
 rows.push({url:'https://se.linkedin.com/in/francisco-veras-different',title:`${person.name} - ${c.company} | LinkedIn`});
 assert.equal(D.matchPublicLinkedInProfiles([person],rows,c.company)[0].publicLinkedinUrl,undefined,'different profile paths remain ambiguous');
 assert.equal(D.matchPublicLinkedInProfiles([person],[{url,title:`${person.name} - Other Company | LinkedIn`}],c.company)[0].publicLinkedinUrl,undefined);
});

test('saved research resumes with actual official read receipts and preserves the extractor audit',async()=>{
 const c=fixture(),row=official(c);let calls=0;
 await D.runMandatoryBuyerResearch(c,{search:async()=>[],readPage:async url=>({...row,url,metadata:{sourceURL:url,source:'direct-fallback'}})});
 assert.equal(c.publicResearch.accountability.status,'complete');
 const saved=D.normalizeDiscoveryState({selectedProspects:[c]}).selectedProspects[0],before=structuredClone(saved.publicResearch.accountability.tools);
 await D.runMandatoryBuyerResearch(saved,{search:async()=>{calls++;return [];}});
 assert.equal(calls,0,'completed matching query plans are reused');
 assert.equal(saved.publicResearch.accountability.officialPages,1,'actual read evidence survives a reload without requiring another extraction');
 assert.equal(saved.publicResearch.accountability.status,'complete');
 assert.deepEqual(saved.publicResearch.accountability.tools,before,'resume cannot fabricate new successful extraction calls');
 assert.ok(saved.publicResearch.accountability.officialPageReads.some(receipt=>receipt.url===row.url&&receipt.sourceRead===true&&receipt.checkedAt));
 assert.deepEqual(CRM.mapDiscoveryCandidateToCrm(saved).intelligence.research_snapshot.buyerResearch.publicResearch.accountability.officialPageReads,saved.publicResearch.accountability.officialPageReads);
});

test('aggregate official counters and source URLs alone never become successful page reads',async()=>{
 const c=fixture();c.publicResearch={accountability:{...D.createBuyerResearchAccountability(),status:'complete',officialPages:9},sources:[`https://${c.domain}/team`]};
 await D.runMandatoryBuyerResearch(c,{search:async()=>[]});
 assert.equal(c.publicResearch.accountability.officialPages,0);
 assert.equal(c.publicResearch.accountability.status,'partial');
 assert.equal(c.publicResearch.accountability.tools.find(row=>row.provider==='direct').succeeded,0);
 const unchecked=fixture(),accountability={...D.createBuyerResearchAccountability(),officialPageReads:[{url:`https://${unchecked.domain}/team`,sourceRead:false,checkedAt:new Date().toISOString()}]};
 await D.runMandatoryBuyerResearch(unchecked,{accountability,search:async()=>[]});
 assert.equal(accountability.officialPages,0,'an unchecked page in caller-supplied accountability is not a read receipt');
});

test('official read receipts cannot cross domains, outlive thirty days or satisfy explicit refresh',async()=>{
 for(const mode of ['foreign','stale','force']){
  const c=fixture(),old=new Date(Date.now()-31*86400000).toISOString();
  c.publicResearch={accountability:{...D.createBuyerResearchAccountability(),officialPageReads:[{url:mode==='foreign'?'https://other.example/team':`https://${c.domain}/team`,sourceRead:true,checkedAt:mode==='stale'?old:new Date().toISOString()}]}};
  await D.runMandatoryBuyerResearch(c,{force:mode==='force',search:async()=>[]});
  assert.equal(c.publicResearch.accountability.officialPages,0,mode);
  assert.equal(c.publicResearch.accountability.status,'partial',mode);
 }
});
