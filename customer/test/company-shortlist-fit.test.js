const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const researchedAt=new Date().toISOString();
test('company extraction cannot join the title and body into a repeated invented company name',()=>{
 const rows=D.extractCompanyMentions([{url:'https://journal.example/nordic',market:'Sweden',title:'Nordic Machines',text:'Nordic Machines manufactures industrial machinery in Sweden for international business customers.'}],5);
 assert.deepEqual(rows.map(c=>c.company),['Nordic Machines']);
});
test('a fresh website read replaces the earlier unverified snippet for the same URL in research review',()=>{
 const snippet={company:'Nordic',domain:'nordic.se',market:'Sweden',url:'https://nordic.se/',title:'Nordic manufacturer',text:'Nordic manufactures industrial equipment in Sweden.'};
 const fresh={...snippet,verifiedAt:researchedAt,text:'Nordic manufactures industrial equipment in Sweden. Our production facilities assemble machinery for industrial customers and use welded frames supplied by specialist partners.'};
 const [candidate]=D.buildPotentialCompanyCandidates([snippet,fresh,{...snippet,url:'https://journal.example/nordic',text:'Nordic is a manufacturer of machinery and equipment in Sweden.'}],{},{});
 const official=candidate.evidence.find(e=>e.url===fresh.url);
 assert.equal(official.verifiedAt,researchedAt,'verification freshness must survive the snippet-to-page merge');
 assert.equal(official.text,fresh.text,'the full page supplies the purchasing evidence');
 const restored=D.normalizeDiscoveryState({qualityVersion:D.DISCOVERY_QUALITY_VERSION,potentialMatches:[candidate]}).potentialMatches[0];
 assert.equal(restored.evidence.find(e=>e.url===fresh.url).verifiedAt,researchedAt);
});
test('tracking parameters cannot make an old snippet discard the freshly verified canonical page',()=>{
 const base={company:'Nordic',domain:'nordic.se',market:'Sweden',title:'Nordic manufacturer',text:'Nordic manufactures industrial equipment in Sweden.'};
 const fresh={...base,url:'https://nordic.se/',verifiedAt:researchedAt,text:'Nordic manufactures industrial equipment in Sweden. Our production facilities assemble machinery for industrial customers and use welded frames supplied by specialist partners.'};
 for(const rows of [[{...base,url:'https://nordic.se/?utm_source=search'},fresh],[fresh,{...base,url:'https://nordic.se/?utm_source=search'}]]){
 const [candidate]=D.buildPotentialCompanyCandidates(rows,{},{});
 assert.equal(candidate.evidence.length,1);
 assert.equal(candidate.evidence[0].url,fresh.url);
 assert.equal(candidate.evidence[0].verifiedAt,researchedAt);
 }
});
function fixture(offer='welded frames',name='Nordic',fit=90,domain='nordic.se'){
 const profile={website:'seller.example',priorityOffers:offer,idealCustomer:'equipment manufacturers'};
 const evidence=[{url:`https://${domain}/products`,verifiedAt:researchedAt,text:`${name} manufactures equipment in Sweden and purchases ${offer} for its industrial production. Our specialist partners supply these products for assembly.`},{url:'https://journal.example/company',text:`${name} manufactures industrial equipment in Sweden and supplies business customers.`}];
 const raw={company:name,domain,market:'Sweden',evidence};
 const candidate=D.parseBuyerFit(JSON.stringify({companies:[{domain,fit,purchase:offer,reason:'Production requires purchased supplies.',buyerRole:'equipment manufacturer',evidence:[{url:evidence[0].url,quote:evidence[0].text}]}]}),[raw],profile)[0];
 return {candidate,profile};
}
test('checked companies remain ranked at different scores while only 80+ passes the automatic company gate',()=>{
 for(const offer of ['welded frames','financial reporting']){
 const rows=[95,81,79,63,45].map((score,index)=>{
  const {candidate,profile}=fixture(offer,`Nordic${index}`,score,`nordic${index}.se`);
  const qualification=D.assessCompanyQualification(candidate,profile,{}, {minimumScore:80,researchedAt});
  assert.equal(qualification.eligible,true,`checked ${score}/100 must remain on the manual list`);
  assert.equal(qualification.score,score);
  return {...candidate,qualification,qualified:true,marketVerified:true,buyerVerified:true};
 });
 assert.deepEqual(D.rankQualifiedCompanies(rows).map(c=>c.qualification.score),[95,81,79,63,45]);
 assert.deepEqual(rows.map(c=>c.qualification.automaticEligible),[true,true,false,false,false]);
 const restored=D.recoverInterruptedDiscoveryState({status:'running',qualityVersion:D.DISCOVERY_QUALITY_VERSION,lastRunAt:researchedAt,candidates:rows});
 assert.equal(restored.candidates.length,5);
 assert.deepEqual(restored.candidates.map(c=>c.qualification.score),[95,81,79,63,45]);
 }
});
test('automatic company flow uses the checked company score at the 80 boundary, independently of event timing',()=>{
 assert.equal(typeof D.assessAutomaticCompanyQualification,'function');
 for(const score of [45,79,80,81,100]){
  const {candidate,profile}=fixture('welded frames','Nordic',score);
  const q=D.assessAutomaticCompanyQualification(candidate,profile,{}, {minimumScore:70,researchedAt});
  assert.equal(q.eligible,score>=80);assert.equal(q.score,score);
 }
 const {candidate,profile}=fixture();
 for(const c of [{...candidate,evidence:[candidate.evidence[0]]},{...candidate,buyerFit:undefined},{...candidate,lifecycle_status:'suppressed'},{...candidate,evidence:candidate.evidence.map(e=>({...e,verifiedAt:''}))}]){
  assert.equal(D.assessAutomaticCompanyQualification(c,profile,{}, {researchedAt}).eligible,false);
 }
});
test('verified company fit can enter the manual shortlist without claiming a buying opportunity',()=>{
 for(const offer of ['welded frames','financial reporting']){
 const {candidate,profile}=fixture(offer);const q=D.assessCompanyQualification(candidate,profile,{}, {minimumScore:80,researchedAt});
 assert.equal(q.eligible,true);assert.equal(q.score,90);assert.equal(q.opportunityEligible,false);assert.equal(q.opportunityScore,null);assert.equal(q.signalPoints,0);assert.deepEqual(q.gaps,[]);
 assert.equal(D.assessAutomaticQualification(candidate,profile,{}, {minimumScore:80,researchedAt}).eligible,false);
 const restored=D.normalizeDiscoveryState({qualityVersion:D.DISCOVERY_QUALITY_VERSION,candidates:[{...candidate,qualified:true,marketVerified:true,buyerVerified:true,matchedSignals:[],qualification:q}]}).candidates[0];
 assert.equal(D.assessCompanyQualification(restored,profile,{}, {minimumScore:80,researchedAt}).eligible,true);
 assert.equal(D.assessCompanyQualification(candidate,{...profile,companyName:'Unrelated Seller'},{},{minimumScore:80,researchedAt}).eligible,true);
 }
});
test('manual shortlist preserves evidence, lifecycle and seller context while research modes do not hide checked results',()=>{
 const {candidate,profile}=fixture(),check=(c,p=profile,settings={})=>D.assessCompanyQualification(c,p,{}, {minimumScore:80,researchedAt,...settings});
 const singleOfficial={...candidate,evidence:[candidate.evidence[0]]};
 assert.equal(check(singleOfficial).eligible,true);
 assert.equal(check(singleOfficial).confidence,'Medium');
 assert.equal(check(singleOfficial).automaticEligible,false);
 assert.equal(D.assessAutomaticCompanyQualification(singleOfficial,profile,{}, {researchedAt}).eligible,false);
 assert.equal(check({...candidate,lifecycle_status:'suppressed'}).eligible,false);
 assert.equal(check({...candidate,buyerFit:undefined}).eligible,false);
 assert.equal(check(candidate,{...profile,priorityOffers:'legal representation'}).eligible,false);
 assert.equal(check(candidate,profile,{researchPriority:'signals'}).eligible,true);
 assert.equal(check(candidate,profile,{minimumScore:90}).eligible,true);
 assert.equal(check(candidate,profile,{researchPriority:'lookalike'}).eligible,true);
});
test('company verification deliberately obtains independent company-attributed evidence',()=>{
 const queries=D.buildCandidateVerificationQueries([{company:'Nordic',domain:'nordic.se',market:'Sweden'}],{}, {},1);
 assert.equal(queries.length,2);assert.ok(queries.some(q=>q.kind==='verification'));
 const independent=queries.find(q=>q.kind==='corroboration');assert.ok(independent);assert.match(independent.query,/-site:nordic.se/);assert.match(independent.query,/Nordic/);
 const rows=D.normalizeCompanySearchResults({results:[{url:'https://journal.example/nordic',title:'Nordic company profile',sourceRead:true,verifiedAt:researchedAt,text:'Nordic manufactures industrial equipment in Sweden.'},{url:'https://journal.example/other',title:'Other Company',text:'Other Company manufactures industrial equipment.'}]},independent);
 assert.equal(rows.length,1);assert.equal(rows[0].domain,'nordic.se');assert.equal(rows[0].sourceDomain,'journal.example');assert.match(rows[0].text,/Nordic/);
 const pool=D.buildPotentialCompanyCandidates(rows,{},{});assert.equal(pool.length,1);assert.equal(pool[0].company,'Nordic');
});

test('saving company fit to CRM never inflates opportunity scoring',()=>{
 const C=require('../crm-engine.js'),{candidate,profile}=fixture();const qualification=D.assessCompanyQualification(candidate,profile,{}, {minimumScore:80,researchedAt});
 const mapped=C.mapDiscoveryCandidateToCrm({...candidate,qualification});
 assert.equal(mapped.company.opportunity_score,undefined);assert.equal(mapped.intelligence.score_breakdown.companyFit,90);
});
test('evidence page cap retains independent corroboration alongside official pages',()=>{
 const official=Array.from({length:6},(_,i)=>({domain:'nordic.se',company:'Nordic',market:'Sweden',url:`https://nordic.se/page${i}`,title:`Nordic page ${i}`,text:`Nordic manufactures equipment in Sweden. Product category ${i} has a distinct specification ${i}.`}));
 const independent={domain:'nordic.se',company:'Nordic',market:'Sweden',url:'https://journal.example/nordic',title:'Nordic business profile',text:'Nordic operates industrial manufacturing facilities in Sweden and supplies equipment to export markets.'};
 const [c]=D.buildPotentialCompanyCandidates([...official,independent],{},{});
 assert.ok(c.evidence.some(e=>e.url===independent.url));assert.ok(c.evidence.some(e=>e.url.startsWith('https://nordic.se/')));assert.ok(c.evidence.length<=5);
});
test('logo file extensions and URL tokens cannot become technology buying signals',()=>{
 const signals=[{name:'AI transformation',keywords:'ai',active:true,weight:10}];
 const source={url:'https://nordic.se/media',date:new Date().toISOString().slice(0,10),text:'Here you will find our company logos in .png, .pdf and .ai formats. Our files follow the brand guidelines.'};
 assert.equal(D.matchedSignalsForEvidence(signals,[source],'Sweden','Nordic').length,0);
 const real={...source,url:'https://nordic.se/news/technology',text:'Nordic announces AI adoption to improve industrial production in Sweden.'};
 assert.equal(D.matchedSignalsForEvidence(signals,[real],'Sweden','Nordic').length,1);
});

test('checked low-fit presentation keeps the score without claiming commercial fit',()=>{
 const value=D.companyQualificationPresentation({company:'Policy Office',market:'Sweden'},{eligible:true,score:0,automaticEligible:false,matchedSignals:[]});
 assert.match(value.explanation,/Company fit 0\/100/);assert.doesNotMatch(value.explanation,/verified commercial fit/);
});
