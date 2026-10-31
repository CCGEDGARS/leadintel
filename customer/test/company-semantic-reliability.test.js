const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../discovery-engine.js');
const P=require('../evidence-policy.js');
const now=new Date().toISOString();
const profile={website:'seller.example',priorityOffers:'assembly services',idealCustomer:'equipment operators',targetMarkets:'Sweden'};
const operating='Nordic operates equipment assembly facilities in Sweden. Our production teams integrate purchased components and commission complete machinery for industrial customers.';
function reviewed(source,overrides={}){
 const candidate={company:'Nordic',domain:'nordic.se',market:'Sweden',evidence:[source],...overrides};
 return D.parseBuyerFit(JSON.stringify({companies:[{domain:candidate.domain,fit:95,offerId:'offer-0',reason:'Equipment assembly requires a specific assembly service application.',buyerRole:'equipment operator',relationship:'buyer',evidence:[{url:source.url,quote:source.text}]}]}),[candidate],profile)[0];
}
test('unread search descriptions cannot become official purchasing evidence after normalization and merge',()=>{
 const raw={url:'https://nordic.se/about',title:'Nordic',description:operating,verifiedAt:now};
 const rows=D.normalizeCompanySearchResults({results:[raw]},{kind:'verification',domain:'nordic.se',company:'Nordic',market:'Sweden'});
 assert.equal(rows[0].sourceRead,false);
 const candidate=reviewed(rows[0]);
 assert.equal(D.assessCompanyQualification(candidate,profile,{}, {researchedAt:now}).eligible,false);
 assert.notEqual(D.buildPotentialCompanyCandidates(rows,profile,{})[0]?.fitVerified,true);
});
test('model summaries remain unverified through normalization and cannot qualify a company',()=>{
 const rows=D.normalizeCompanySearchResults({results:[{url:'https://nordic.se/about',title:'Nordic',text:operating,evidenceKind:'model_summary',sourceRead:false,verifiedAt:now}]},{kind:'verification',domain:'nordic.se',company:'Nordic',market:'Sweden'});
 const candidate=reviewed(rows[0]);
 assert.equal(candidate.buyerFit,undefined);
 assert.equal(D.assessCompanyQualification(candidate,profile,{}, {researchedAt:now}).eligible,false);
});
test('actual extracted operating evidence keeps its provenance through company grouping and reload',()=>{
 const rows=D.normalizeCompanySearchResults({results:[{url:'https://nordic.se/about',title:'Nordic',markdown:operating,verifiedAt:now}]},{kind:'verification',domain:'nordic.se',company:'Nordic',market:'Sweden'});
 assert.equal(rows[0].sourceRead,true);
 const [potential]=D.buildPotentialCompanyCandidates(rows,profile,{});
 const restored=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({qualityVersion:D.DISCOVERY_QUALITY_VERSION,potentialMatches:[potential]}))).potentialMatches[0];
 assert.equal(restored.evidence[0].sourceRead,true);
 assert.equal(D.assessCompanyQualification(reviewed(restored.evidence[0]),profile,{}, {researchedAt:now}).eligible,true);
});
test('detection timestamps cannot supply publication recency or dated buying signals',()=>{
 const source={url:'https://nordic.se/news',title:'Nordic investment',text:'Nordic announces investment in a new factory in Sweden.',date:now,dateSource:'detectedAt'};
 assert.equal(P.recency(source).status,'unknown');
 const matched=D.matchedSignalsForEvidence([{id:'s',name:'New factory',keywords:'new factory',active:true}],[source],'Sweden','Nordic');
 assert.equal(D.currentSignals(matched).length,0);
});
test('a company in an unselected market cannot qualify under a different selected market',()=>{
 const candidate=reviewed({url:'https://nordic.fi/about',text:operating.replace('Sweden','Finland'),verifiedAt:now},{domain:'nordic.fi',market:'Finland'});
 const result=D.assessCompanyQualification(candidate,profile,{}, {researchedAt:now});
 assert.equal(result.eligible,false);
 assert.ok(result.gaps.includes('Company market is outside the selected target markets'));
});
test('saved opportunity markets cannot broaden current active ICP search markets',()=>{
 const market={icps:[{id:'core',active:true,targetMarkets:'Sweden',description:'equipment operators'}],opportunities:[{market:'Finland',active:true}]};
 const queries=D.buildDiscoveryQueries(profile,market,6);
 assert.ok(queries.length>0);
 assert.deepEqual(new Set(queries.map(row=>row.market)),new Set(['Sweden']));
});
test('domain lookalikes cannot resolve the identity of an unrelated company',()=>{
 for(const domain of ['notacme.se','acmetools.se','fake-acme.se']){
  assert.equal(D.domainMatchesCompany(domain,'Acme'),false,domain);
  assert.deepEqual(D.normalizeCompanySearchResults({results:[{url:`https://${domain}/`,title:'Acme',description:operating}]},{kind:'resolution',company:'Acme',market:'Sweden'}),[]);
 }
 assert.equal(D.domainMatchesCompany('acme.se','Acme AB'),true);
 assert.equal(D.domainMatchesCompany('3m.com','3M'),true);
});
test('normalization retains all acquired company evidence and signals across save reload',()=>{
 const evidence=Array.from({length:17},(_,index)=>({url:`https://nordic.se/source-${index}`,text:`${operating} Operating source ${index}.`,verifiedAt:now,sourceRead:true}));
 const matchedSignals=Array.from({length:16},(_,index)=>({id:`signal-${index}`,name:`Signal ${index}`,evidence:[evidence[index]]}));
 const candidate={company:'Nordic',domain:'nordic.se',market:'Sweden',qualified:true,marketVerified:true,buyerVerified:true,evidence,matchedSignals};
 const potential={...candidate,qualified:false,fitVerified:true,buyerVerified:false,qualificationGaps:['No active buying signal was confirmed']};
 const state=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({qualityVersion:D.DISCOVERY_QUALITY_VERSION,candidates:[candidate],potentialMatches:[potential],pipeline:[candidate]})));
 for(const row of [state.candidates[0],state.potentialMatches[0],state.pipeline[0]]){
  assert.equal(row.evidence.length,17);
  assert.equal(row.matchedSignals.length,16);
  assert.equal(row.evidence.at(-1).url,evidence.at(-1).url);
 }
});
test('untagged search text is a discovery lead until its underlying page is actually read',()=>{
 const [row]=D.normalizeCompanySearchResults({results:[{url:'https://nordic.se/about',title:'Nordic',text:operating,verifiedAt:now}]},{kind:'verification',domain:'nordic.se',company:'Nordic',market:'Sweden'});
 assert.equal(row.sourceRead,false);
 assert.equal(D.assessCompanyQualification(reviewed(row),profile,{}, {researchedAt:now}).eligible,false);
});
test('raw research reload preserves read receipts and never launders unread or model evidence',()=>{
 const rows=[{url:'https://nordic.se/snippet',domain:'nordic.se',company:'Nordic',market:'Sweden',text:operating,sourceRead:false,evidenceKind:'search_snippet'}, {url:'https://journal.example/nordic',domain:'nordic.se',sourceDomain:'journal.example',company:'Nordic',market:'Sweden',text:operating,sourceRead:true,evidenceKind:'source_text',extractedAt:now,verifiedAt:now}];
 const restored=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({qualityVersion:D.DISCOVERY_QUALITY_VERSION,rawResults:rows})));
 assert.equal(restored.rawResults[0].sourceRead,false);
 assert.equal(restored.rawResults[0].evidenceKind,'search_snippet');
 assert.equal(restored.rawResults[1].sourceRead,true);
 assert.equal(restored.rawResults[1].verifiedAt,now);
 assert.equal(restored.rawResults[1].sourceDomain,'journal.example');
 const grouped=D.buildPotentialCompanyCandidates(restored.rawResults,profile,{});
 assert.ok(grouped[0].evidence.every(source=>source.url!==rows[0].url));
});
test('company Strategy identity and manual role authority survive normalization',()=>{
 const candidate={company:'Nordic',domain:'nordic.se',market:'Sweden',strategyFingerprint:'material-current-strategy',searchContextKey:'seller-targeting-context',buyerRoles:'CEO; Plant Manager',buyerRolesChanged:true,buyerRolesSource:'manual',qualified:true,marketVerified:true,buyerVerified:true,evidence:[{url:'https://nordic.se/about',text:operating,verifiedAt:now}],matchedSignals:[{id:'event',name:'Event'}]};
 const state=D.normalizeDiscoveryState({qualityVersion:D.DISCOVERY_QUALITY_VERSION,candidates:[candidate],potentialMatches:[{...candidate,qualified:false,fitVerified:true,qualificationGaps:['No active buying signal was confirmed']}]});
 for(const row of [state.candidates[0],state.potentialMatches[0]]){
  assert.equal(row.strategyFingerprint,candidate.strategyFingerprint);
  assert.equal(row.searchContextKey,candidate.searchContextKey);
  assert.equal(row.buyerRoles,candidate.buyerRoles);
  assert.equal(row.buyerRolesChanged,true);
  assert.equal(row.buyerRolesSource,'manual');
 }
});
test('a shared brand token cannot turn a parent or namesake domain into a subsidiary identity',()=>{
 assert.equal(D.domainMatchesCompany('acme.se','Acme Components'),false);
 const results=D.normalizeCompanySearchResults({results:[{url:'https://acme.se/',title:'Acme Group',markdown:'Acme Group operates a portfolio of equipment businesses in Sweden. Acme Components is one of our subsidiaries and produces components.'}]},{kind:'resolution',company:'Acme Components',market:'Sweden'});
 assert.deepEqual(results,[]);
 assert.equal(D.domainMatchesCompany('acmecomponents.se','Acme Components AB'),true);
});
test('failed underlying pages cannot be laundered into scored company evidence during grouping',()=>{
 const source={company:'Nordic',domain:'nordic.se',market:'Sweden',url:'https://nordic.se/news',title:'Nordic factory investment',text:operating+' Nordic announces investment in a new factory in Sweden.',date:now,sourceRead:true,verifiedAt:now,statusCode:403};
 assert.deepEqual(D.mergeCompanyCandidates([source],profile,{signals:[{id:'factory',name:'New factory',keywords:'new factory',active:true,weight:10}]}),[]);
 assert.notEqual(D.buildPotentialCompanyCandidates([source],profile,{})[0]?.fitVerified,true);
});
test('a customer plan on the official website cannot become the website owners buying event',()=>{
 const signals=[{id:'factory',name:'New factory',keywords:'new factory',active:true,weight:10}];
 for(const action of ['will build','plans','is building','has announced','invested in']){
  const source={url:'https://nordic.se/case-study',title:'Customer case study',text:`OtherCorp ${action} a new factory in Sweden.`,date:now,sourceRead:true};
  assert.deepEqual(D.matchedSignalsForEvidence(signals,[source],'Sweden','Nordic'),[],action);
 }
});
test('missing official operating evidence abstains before fit provider work, including mixed batches',async()=>{
 const good={company:'Nordic',domain:'nordic.se',market:'Sweden',evidence:[{url:'https://nordic.se/about',text:operating,verifiedAt:now,sourceRead:true}]};
 const unknown={company:'Other',domain:'other.se',market:'Sweden',evidence:[{url:'https://journal.example/other',text:'Other operates equipment assembly facilities in Sweden.',sourceRead:true,verifiedAt:now}]};
 const calls=[];
 const result=await D.researchBuyerFit([unknown,good],profile,async(prompt,batch)=>{
  calls.push(batch.map(row=>row.domain));
  return JSON.stringify({companies:[{domain:'nordic.se',fit:85,offerId:'offer-0',reason:'Assembly facilities need assembly services.',buyerRole:'equipment operator',evidence:[{sourceId:'source-0',quoteId:'quote-0'}]}]});
 });
 assert.deepEqual(calls,[['nordic.se']]);
 assert.equal(result[0].domain,'other.se');
 assert.equal(result[0].buyerFitIssueCode,'insufficient_evidence');
 assert.equal(result[0].buyerFit,undefined);
 assert.equal(result[1].buyerFit.fit,85);
 let called=false;
 const absent=await D.researchBuyerFit([unknown],profile,async()=>{called=true;throw Error('must not run');});
 assert.equal(called,false);
 assert.equal(absent[0].buyerFitIssueCode,'insufficient_evidence');
});
test('historical raw research survives normalization beyond one search incoming budget',()=>{
 const rawResults=Array.from({length:65},(_,index)=>({url:`https://nordic.se/source-${index}`,domain:'nordic.se',company:'Nordic',text:operating,sourceRead:true,verifiedAt:now}));
 const state=D.normalizeDiscoveryState({qualityVersion:D.DISCOVERY_QUALITY_VERSION,rawResults});
 assert.equal(state.rawResults.length,65);
 assert.equal(state.rawResults.at(-1).url,rawResults.at(-1).url);
});
test('actual publication metadata keeps its own provenance when a detection date is also present',()=>{
 const published=P.publication({date:now,dateSource:'detectedAt',metadata:{publishedTime:'2020-01-02'}});
 assert.equal(published.date,'2020-01-02');
 assert.equal(published.dateSource,'metadata.publishedTime');
 assert.equal(P.recency(published).status,'historical');
});
test('verification follows the actual extraction URL and rejects redirects to another owner',()=>{
 const meta={kind:'verification',domain:'nordic.se',company:'Nordic',market:'Sweden'};
 assert.deepEqual(D.normalizeCompanySearchResults({results:[{url:'https://nordic.se/about',metadata:{sourceURL:'https://unrelated.se/landing'},title:'Nordic',markdown:operating}]},meta),[]);
 const [source]=D.normalizeCompanySearchResults({results:[{url:'https://nordic.se/old',metadata:{sourceURL:'https://www.nordic.se/about'},title:'Nordic',markdown:operating}]},meta);
 assert.equal(source.url,'https://www.nordic.se/about');
 assert.equal(source.domain,'nordic.se');
});
test('potential company reload retains all sixteen manual buyer roles and resolved rename history',()=>{
 const roles=Array.from({length:16},(_,index)=>`Specific Buyer Role ${index}`).join('; ');
 const candidate={company:'Nordic',domain:'nordic.se',market:'Sweden',previousNames:['Old Nordic'],buyerRoles:roles,buyerRolesSource:'manual',buyerRolesChanged:true,evidence:[{url:'https://nordic.se/about',text:operating}],qualificationGaps:['No active buying signal was confirmed']};
 const restored=D.normalizeDiscoveryState({qualityVersion:D.DISCOVERY_QUALITY_VERSION,potentialMatches:[candidate]}).potentialMatches[0];
 assert.equal(restored.buyerRoles,roles);
 assert.deepEqual(restored.previousNames,['Old Nordic']);
});
test('historical company collections survive reload and a later run beyond the incoming fifty-company request limit',()=>{
 const candidates=Array.from({length:65},(_,index)=>({id:`company-${index}`,company:`Nordic${index}`,domain:`nordic${index}.se`,qualified:true,marketVerified:true,buyerVerified:true,matchedSignals:[{id:'event',name:'Factory'}],evidence:[{url:`https://nordic${index}.se/about`,text:operating,verifiedAt:now}]}));
 const potentialMatches=candidates.map(row=>({...row,qualified:false,buyerVerified:false,fitVerified:true,qualificationGaps:['No active buying signal was confirmed']}));
 const selectedProspects=potentialMatches.map(row=>({...row,buyerSearchMode:'user_selected_target'}));
 const state=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({qualityVersion:D.DISCOVERY_QUALITY_VERSION,candidates,potentialMatches,selectedProspects,pipeline:candidates})));
 for(const key of ['candidates','potentialMatches','selectedProspects','pipeline'])assert.equal(state[key].length,65,key);
 const added={...candidates[0],id:'new-company',domain:'newnordic.se',company:'New Nordic'};
 const updated=D.upsertPipelineItem(state.pipeline,added);
 assert.equal(updated.length,66);
 assert.equal(updated.at(-1).domain,candidates.at(-1).domain);
 assert.equal(D.retainLastSuccessfulDiscoveryCandidates(state,[added],now).candidates.length,66);
 assert.equal(D.retainLastSuccessfulDiscoveryCandidates(state,[],now).candidates.length,65);
 assert.equal(D.discoveryLimits(100).targetCount,50,'incoming acquisition cap remains unchanged');
});
test('the actual material Strategy fingerprint survives company normalization without truncation or whitespace changes',()=>{
 const install=require('./helpers/strategy-discovery-context.cjs');
 const main={profile:{companyName:'Seller',website:'seller.example'},answers:{offer:'precision  assembly services',customerDefinition:'Equipment operators with complex production needs. '.repeat(50)},market:{icps:[{id:'core',active:true,description:'Operators with  two production lines',targetMarkets:'Sweden',buyerRoles:'CEO; Procurement Director',offers:'assembly services'}],signals:[{id:'factory',active:true,weight:9,keywords:'new factory; capacity expansion'}]}};
 const context=install({mainState:()=>main,canonicalDomain:D.canonicalDomain});
 const fingerprint=context.fingerprint();
 assert.ok(fingerprint.length>1000);
 const candidate={company:'Nordic',domain:'nordic.se',strategyFingerprint:fingerprint,searchContextKey:D.searchContextKey(profile),qualified:true,marketVerified:true,buyerVerified:true,evidence:[{url:'https://nordic.se/about',text:operating}],matchedSignals:[{id:'event'}]};
 const state=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({qualityVersion:D.DISCOVERY_QUALITY_VERSION,candidates:[candidate],pipeline:[candidate],potentialMatches:[{...candidate,qualified:false,qualificationGaps:['No active buying signal was confirmed']}]})));
 for(const row of [state.candidates[0],state.pipeline[0],state.potentialMatches[0]]){
  assert.equal(row.strategyFingerprint,fingerprint);
  assert.equal(row.searchContextKey,D.searchContextKey(profile));
 }
});
test('event ownership binds to the acting company through customer framing and subsidiary names',()=>{
 const signals=[{id:'factory',name:'New factory',keywords:'new factory',active:true,weight:10}];
 for(const text of ['Our customer OtherCorp opened a new factory in Sweden.','Nordic supports OtherCorp, which plans a new factory in Sweden.','Our client OtherCorp, a Swedish manufacturer, has opened a new factory in Sweden.','Nordic Components opened a new factory in Sweden.']){
  const source={url:'https://nordic.se/news',text,date:now,sourceRead:true};
  assert.deepEqual(D.matchedSignalsForEvidence(signals,[source],'Sweden','Nordic'),[],text);
 }
});
test('locally denied and cancelled events cannot supply a positive active signal',()=>{
 const signals=[{id:'factory',name:'New factory',keywords:'new factory',active:true,weight:10}];
 for(const text of ['Nordic does not plan a new factory in Sweden.','Nordic has no plans to build a new factory in Sweden.','Nordic cancelled its planned new factory in Sweden.','Nordic will never build a new factory in Sweden.','Nordic has ruled out a new factory in Sweden.']){
  assert.deepEqual(D.matchedSignalsForEvidence(signals,[{url:'https://nordic.se/news',text,date:now,sourceRead:true}],'Sweden','Nordic'),[],text);
 }
 for(const text of ['Nordic opened a new factory in Sweden, using automation rather than manual assembly.','Nordic opened a new factory in Sweden that does not use fossil fuels.'])assert.equal(D.matchedSignalsForEvidence(signals,[{url:'https://nordic.se/news',text,date:now,sourceRead:true}],'Sweden','Nordic').length,1,text);
});
test('a fresh publication does not fabricate recent timing for explicitly historical or distant future events',()=>{
 const signals=[{id:'factory',name:'New factory',keywords:'new factory',active:true,weight:10}];
 for(const year of [new Date().getUTCFullYear()-1,new Date().getUTCFullYear()+4]){
  const publicationDate=now.slice(0,10),source={url:'https://nordic.se/news',text:`Nordic opened a new factory in Sweden in ${year}.`,date:publicationDate,sourceRead:true};
  const matched=D.matchedSignalsForEvidence(signals,[source],'Sweden','Nordic');
  assert.equal(D.currentSignals(matched).length,0);
  if(matched.length){assert.equal(matched[0].evidence[0].publicationDate,publicationDate);assert.equal(matched[0].evidence[0].eventYear,year);assert.equal(matched[0].evidence[0].date,'');}
 }
});
test('full event dates remain separate from later publication dates, including same-year retrospectives',()=>{
 const signals=[{id:'factory',name:'New factory',keywords:'new factory',active:true,weight:10}],publicationDate=now.slice(0,10);
 for(const year of [new Date().getUTCFullYear()-1,new Date().getUTCFullYear(),new Date().getUTCFullYear()+4]){
  const source={url:'https://nordic.se/news',text:`Nordic opened a new factory in Sweden on January 1, ${year}.`,date:publicationDate,sourceRead:true};
  const matched=D.matchedSignalsForEvidence(signals,[source],'Sweden','Nordic');
  assert.equal(matched[0].evidence[0].date,`${year}-01-01`);
  assert.equal(matched[0].evidence[0].publicationDate,publicationDate);
  if(year!==new Date().getUTCFullYear())assert.equal(D.currentSignals(matched).length,0);
 }
});
test('market presence requires sourced operations rather than a country-code domain or search label',()=>{
 const unlocated=operating.replace(' in Sweden','');
 for(const text of [unlocated,operating.replace('in Sweden','in Finland only')+' Nordic has no offices, manufacturing facilities or operations in Sweden.']){
  const candidate=reviewed({url:'https://nordic.se/about',text,verifiedAt:now,sourceRead:true});
  const result=D.assessCompanyQualification(candidate,profile,{}, {researchedAt:now});
  assert.equal(result.eligible,false,text);
  assert.ok(result.gaps.includes('Verify target-market presence'));
 }
 const candidate=reviewed({url:'https://nordic.fi/about',text:operating,verifiedAt:now,sourceRead:true},{domain:'nordic.fi'});
 assert.equal(D.assessCompanyQualification(candidate,profile,{}, {researchedAt:now}).eligible,true,'a foreign domain does not disprove actual Swedish operations');
});
test('customer operations on an official page cannot establish the website owners target-market presence',()=>{
 const text='Nordic operates equipment assembly facilities in Finland. Our production teams integrate purchased components and commission complete machinery for industrial customers. Our customer OtherCorp operates production facilities in Sweden.';
 const result=D.assessCompanyQualification(reviewed({url:'https://nordic.se/about',text,verifiedAt:now,sourceRead:true}),profile,{}, {researchedAt:now});
 assert.equal(result.eligible,false);
 assert.ok(result.gaps.includes('Verify target-market presence'));
});
