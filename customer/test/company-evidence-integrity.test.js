const test=require('node:test');
const assert=require('node:assert/strict');
const D=require('../discovery-engine.js');
const Look=require('../lookalike-discovery.js');
const profile={website:'https://seller.example',priorityOffers:'industrial automation; metal structures',idealCustomer:'manufacturers operating production plants'};
const market={signals:[{id:'investment',name:'Factory investment',keywords:'investment; new factory; capacity expansion',active:true,weight:8}]};
const event=(overrides={})=>({company:'Nordic Machines',domain:'nordicmachines.se',market:'Sweden',url:'https://nordicmachines.se/news/factory',title:'Nordic Machines announces a new factory',text:'Nordic Machines announces a new factory and investment in industrial automation and metal structures for its production plant in Sweden.',date:new Date().toISOString().slice(0,10),...overrides});

test('language subdomains cannot turn publishers into official company identities',()=>{
 assert.equal(D.domainMatchesCompany('en.highnorthnews.com','H2 Green Steel'),false);
 assert.equal(D.domainMatchesCompany('news.anypublisher.com','Green Energy'),false);
 assert.equal(D.domainMatchesCompany('nordicnews.se','Nordic Machines'),false);
 assert.equal(D.domainMatchesCompany('greensteelnews.com','Green Steel'),false);
 assert.equal(D.domainMatchesCompany('www.nordicmachines.se','Nordic Machines'),true);
 assert.equal(D.domainMatchesCompany('www.sodra.com','Södra'),true);
 assert.equal(D.domainMatchesCompany('3m.com','3M'),true);
 const bad=event({company:'H2 Green Steel',domain:'en.highnorthnews.com',url:'https://en.highnorthnews.com/steel'});
 assert.deepEqual(D.mergeCompanyCandidates([bad],profile,market),[]);
 assert.deepEqual(D.buildPotentialCompanyCandidates([bad],profile,market),[]);
});

test('unrelated articles are excluded even when attached to a resolved company domain',()=>{
 const unrelated=event({url:'https://publisher.example/russia-vostok',sourceDomain:'publisher.example',title:'Vostok Oil invests in new factory',text:'Vostok Oil invests in a new factory and metal structures in Russia.'});
 const candidates=D.mergeCompanyCandidates([event(),unrelated],profile,market);
 assert.equal(candidates.length,1);
 assert.equal(candidates[0].evidence.length,1);
 assert.equal(candidates[0].matchedSignals[0].evidence[0].url,event().url);
 assert.equal(JSON.stringify(candidates).includes('Vostok'),false);
});

test('only a concrete company event matches a buying signal, not marketing investment language',()=>{
 for(const text of ['Investment solutions for industrial automation and metal structures.','Our continuous investment in production supports manufacturing in Sweden.','We invest throughout the year in industrial automation and metal structures.']){
  assert.deepEqual(D.mergeCompanyCandidates([event({title:'Nordic Machines products',url:'https://nordicmachines.se/products',text,date:''})],profile,market),[]);
 }
 assert.equal(D.mergeCompanyCandidates([event()],profile,market).length,1);
 const oldDate=new Date(Date.now()-400*86400000).toISOString().slice(0,10);
 assert.deepEqual(D.mergeCompanyCandidates([event({date:oldDate})],profile,market),[]);
});

test('undated concrete events retain explicit date uncertainty and earn no timing points',()=>{
 const candidate=D.mergeCompanyCandidates([event({date:''})],profile,market)[0];
 assert.equal(candidate.confidence,'Low');
 assert.equal(candidate.score.timing,0);
 assert.equal(candidate.matchedSignals[0].evidence[0].recency,'unverified');
 const restored=D.normalizeDiscoveryState({qualityVersion:D.DISCOVERY_QUALITY_VERSION,candidates:[candidate]}).candidates[0];
 assert.deepEqual(restored.matchedSignals[0].evidence,candidate.matchedSignals[0].evidence);
});

test('tracking URLs and syndicated duplicate stories cannot inflate source counts',()=>{
 const article=event({url:'https://publisher.example/nordic-factory',title:'Nordic Machines announces its new factory investment'});
 const copies=[article,{...article,url:article.url+'?utm_source=feed'},{...article,url:'https://anotherpublisher.example/syndicated'}];
 assert.equal(D.dedupeCompanyEvidence(copies).length,1);
 const candidate=D.mergeCompanyCandidates([event(),...copies],profile,market)[0];
 // The same substantive story copied to a second host adds no independent corroboration.
 assert.ok(candidate.evidence.length<=2);
});

test('first-party customer stories cannot assign another company event to the website owner',()=>{
 const source=event({title:'Our customer wins investment',text:'OtherCorp announced an investment in industrial automation and metal structures in Sweden.'});
 assert.deepEqual(D.mergeCompanyCandidates([source],profile,market),[]);
});

test('shared event gates work across industries and are invariant to the seller name',()=>{
 const hospitality=event({company:'Nordic Hotels',domain:'nordichotels.se',url:'https://nordichotels.se/news',title:'Nordic Hotels announces investment',text:'Nordic Hotels announces investment in a new hotel and office furniture in Sweden.'});
 const seller={website:'https://hotel-supplier.example',idealCustomer:'hotels',priorityOffers:'office furniture; hotel furnishing'};
 const a=D.mergeCompanyCandidates([hospitality],{...seller,companyName:'Ercon'},market);
 const b=D.mergeCompanyCandidates([hospitality],{...seller,companyName:'Unrelated Seller'},market);
 assert.equal(a.length,1);assert.deepEqual(a,b);
});

test('similarity validation rejects boilerplate and oversized quotations',()=>{
 const ref={rowId:'ref',companyName:'Reference',dimensions:[{values:['equipment manufacturer']}]};
 const model={referenceProfiles:[ref]};
 for(const quote of ['Chinese customer services contact list '+ 'equipment '.repeat(6),'equipment '.repeat(80)]){
  const candidate={company:'Nordic Machines',domain:'nordicmachines.se',evidence:[{url:'https://nordicmachines.se/about',text:quote}]};
  const response={matches:[{domain:candidate.domain,referenceId:'ref',score:90,matchedTraits:[{trait:'equipment manufacturer',quote,url:candidate.evidence[0].url}]}]};
  assert.equal(Look.parseEvidenceSimilarity(JSON.stringify(response),[candidate],model).size,0);
 }
});

test('explicit first-party renames resolve a new official identity and retain old-name event attribution',()=>{
 const date=new Date().toISOString().slice(0,10);
 const primary={url:'https://newbrand.se/about',title:'NewBrand',markdown:'NewBrand (formerly OldBrand) manufactures industrial automation and metal structures in Sweden.'};
 const meta={kind:'resolution',company:'OldBrand',market:'Sweden',sourceUrl:'https://publisher.example/oldbrand-investment'};
 const resolved=D.normalizeCompanySearchResults({results:[primary]},meta);
 assert.equal(resolved.length,1);assert.equal(resolved[0].company,'NewBrand');assert.deepEqual(resolved[0].previousNames,['OldBrand']);
 const source={url:meta.sourceUrl,title:'OldBrand announces investment',text:'OldBrand announces investment in a new factory in Sweden using industrial automation and metal structures.',date};
 const linked=D.attachSourceEvidenceToResolvedCompanies(resolved,[{company:'OldBrand',sourceUrl:source.url,market:'Sweden'}],[source]);
 const candidate=D.mergeCompanyCandidates(linked,profile,market)[0];
 assert.equal(candidate.company,'NewBrand');assert.equal(candidate.domain,'newbrand.se');
 assert.ok(candidate.matchedSignals[0].evidence.some(e=>e.url===source.url));
 assert.deepEqual(D.normalizeCompanySearchResults({results:[{...primary,url:'https://publisher.example/article'}]},meta),[]);
});
