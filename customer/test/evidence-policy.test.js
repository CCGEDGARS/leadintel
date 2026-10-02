const test=require('node:test');const assert=require('node:assert/strict');
const P=require('../evidence-policy.js');const D=require('../discovery-engine.js');const Look=require('../lookalike-discovery.js');const Crm=require('../crm-engine.js');
const date=new Date().toISOString().slice(0,10);
const profile={website:'seller.example',idealCustomer:'industrial manufacturers',priorityOffers:'metal structures; industrial automation'};
const market={signals:[{id:'factory',name:'New factory',keywords:'new factory; investment; funding',active:true}]};
const row=(extra={})=>({company:'Polestar',domain:'media.polestar.com',market:'Sweden',url:'https://media.polestar.com/news/factory',title:'Polestar announces a new factory',text:'Polestar announces a new factory in Sweden requiring metal structures and industrial automation.',date,...extra});
test('corporate publishing channels share company identity while hosted customer sites remain distinct',()=>{
 assert.equal(P.companyDomain('media.polestar.com'),'polestar.com');assert.equal(P.companyDomain('investors.polestar.com'),'polestar.com');
 assert.equal(P.companyDomain('news.customer.github.io'),'news.customer.github.io');
 assert.equal(Crm.canonicalDomain('investors.polestar.com'),'polestar.com');
 const candidates=D.mergeCompanyCandidates([row(),row({domain:'investors.polestar.com',url:'https://investors.polestar.com/news/factory'})],profile,market);
 assert.equal(candidates.length,1);assert.equal(candidates[0].domain,'polestar.com');
});
test('publication comes from target metadata and article datelines, never scrape time or copyright',()=>{
 assert.equal(P.publication({metadata:{publishedTime:'2020-09-26T09:00:00Z'}}).date,'2020-09-26');
 assert.equal(P.publication({text:'October 10, 2002\nAtlas Copco to strengthen mining business'}).date,'2002-10-10');
 assert.equal(P.recency({url:'https://example.com/2002/mining',text:'Copyright 2026'}).status,'historical');
 assert.equal(P.publication({fetchedAt:date,text:'Copyright 2026'}).date,'');
 assert.equal(P.publication({date:'2026-02-30'}).date,'');
});
test('successful scraper responses with blocked target content or HTTP errors are not evidence',()=>{
 for(const invalid of [{text:'OUR SERVICES is blocked ERR_BLOCKED_BY_CLIENT'},{text:'Example products',metadata:{statusCode:403}},{text:'Example products',metadata:{statusCode:404}}]){
 assert.equal(P.usable(invalid),false);assert.deepEqual(D.normalizeCompanySearchResults({results:[{...invalid,url:'https://norck.com',title:'Norck'}]},{market:'Sweden'}),[]);
 }
});
test('actual legal funding disclaimers and historical factory announcements never qualify',()=>{
 const disclaimer='For example, projections of revenue, volumes, margins, cash flow break-even and other financial or operating metrics and statements regarding expectations of future needs for funding and plans related thereto are forward-looking statements.';
 assert.deepEqual(D.mergeCompanyCandidates([row({title:'Polestar financial statements',text:disclaimer})],profile,market),[]);
 assert.deepEqual(D.mergeCompanyCandidates([row({date:'',text:'26 September 2020. Polestar announces plans for Precept to enter production in a new factory in China using metal structures.'})],profile,market),[]);
 for(const country of ['China','Finland','Germany'])assert.deepEqual(D.mergeCompanyCandidates([row({text:`Polestar announces a new factory in ${country} requiring metal structures and automation.`})],profile,market),[]);
});
test('generic language cannot manufacture commercial fit and factual overlap cannot imply confirmed demand',()=>{
 const generic=row({text:'Currently relevant development and structure for strategic growth.',title:'Polestar company'});
 assert.equal(D.commercialFit({evidence:[generic]},profile).fit,0);
 const candidate=D.mergeCompanyCandidates([row()],profile,market)[0];assert.ok(candidate.fitScore<=75);assert.ok(candidate.score.fit<=18);
});
test('historical mining traits and blocked pages cannot validate AI similarity quotes',()=>{
 const model={referenceProfiles:[{rowId:'ref',companyName:'Epiroc',dimensions:[{values:['mining equipment']}]}]};
 for(const source of [{url:'https://atlascopco.com/2002/mining',text:'Atlas Copco manufactures mining equipment.',date:'2002-10-10'},{url:'https://atlascopco.com/services',text:'mining equipment is blocked ERR_BLOCKED_BY_CLIENT'}]){
 const candidate={domain:'atlascopco.com',evidence:[source]};const result={matches:[{domain:candidate.domain,referenceId:'ref',score:100,matchedTraits:[{trait:'mining equipment',quote:source.text,url:source.url}]}]};
 assert.equal(Look.parseEvidenceSimilarity(JSON.stringify(result),[candidate],model).size,0);
 }
});
