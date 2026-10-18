const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const researchedAt=new Date().toISOString();
function fixture(offer='welded frames',name='Nordic'){
 const profile={website:'seller.example',priorityOffers:offer,idealCustomer:'equipment manufacturers'};
 const domain='nordic.se',evidence=[{url:`https://${domain}/products`,verifiedAt:researchedAt,text:`${name} manufactures equipment in Sweden and purchases ${offer} for its industrial production. Our specialist partners supply these products for assembly.`},{url:'https://journal.example/company',text:`${name} manufactures industrial equipment in Sweden and supplies business customers.`}];
 const raw={company:name,domain,market:'Sweden',evidence};
 const candidate=D.parseBuyerFit(JSON.stringify({companies:[{domain,fit:90,purchase:offer,reason:'Production requires purchased supplies.',buyerRole:'equipment manufacturer',evidence:[{url:evidence[0].url,quote:evidence[0].text}]}]}),[raw],profile)[0];
 return {candidate,profile};
}
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
test('manual shortlist preserves evidence, lifecycle, seller context and explicit signal priority gates',()=>{
 const {candidate,profile}=fixture(),check=(c,p=profile,settings={})=>D.assessCompanyQualification(c,p,{}, {minimumScore:80,researchedAt,...settings});
 assert.equal(check({...candidate,evidence:[candidate.evidence[0]]}).eligible,false);
 assert.equal(check({...candidate,lifecycle_status:'suppressed'}).eligible,false);
 assert.equal(check({...candidate,buyerFit:undefined}).eligible,false);
 assert.equal(check(candidate,{...profile,priorityOffers:'legal representation'}).eligible,false);
 assert.equal(check(candidate,profile,{researchPriority:'signals'}).eligible,false);
 assert.equal(check(candidate,profile,{minimumScore:90}).eligible,true);
 assert.equal(check(candidate,profile,{researchPriority:'lookalike'}).eligible,false);
});
test('company verification deliberately obtains independent company-attributed evidence',()=>{
 const queries=D.buildCandidateVerificationQueries([{company:'Nordic',domain:'nordic.se',market:'Sweden'}],{}, {},1);
 assert.equal(queries.length,2);assert.ok(queries.some(q=>q.kind==='verification'));
 const independent=queries.find(q=>q.kind==='corroboration');assert.ok(independent);assert.match(independent.query,/-site:nordic.se/);assert.match(independent.query,/Nordic/);
 const rows=D.normalizeCompanySearchResults({results:[{url:'https://journal.example/nordic',title:'Nordic company profile',text:'Nordic manufactures industrial equipment in Sweden.'},{url:'https://journal.example/other',title:'Other Company',text:'Other Company manufactures industrial equipment.'}]},independent);
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
