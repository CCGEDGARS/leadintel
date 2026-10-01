const test=require('node:test');
const assert=require('node:assert/strict');
const Market=require('../market-engine.js');
const Conditions=require('../market-conditions-engine.js');
test('richer extracted article replaces search snippet, including metadata',()=>{
 const url='https://example.com/project';
 const [result]=Market.mergeResearchResults([{url,text:'Search snippet',sourceProviders:['openai']}],[{url,text:'Verified article '.repeat(80),extractedBy:'firecrawl',extractedAt:'2026-10-01',sourceProviders:['firecrawl']}]);
 assert.match(result.text,/Verified article/);assert.equal(result.extractedBy,'firecrawl');assert.deepEqual(result.sourceProviders,['openai','firecrawl']);
 const [preserved]=Market.mergeResearchResults([result],[{url,text:'Short',extractedAt:'2026-10-02',extractedBy:'other'}]);
 assert.equal(preserved.text,result.text);assert.equal(preserved.extractedAt,'2026-10-01');
});
test('quick automatic plan balances markets and priorities without overriding explicit sources',()=>{
 const profile={targetMarkets:'Sweden; Finland',priorityOffers:'Drawing development; steel fabrication; installation',idealCustomer:'Machinery manufacturers; construction contractors'};
 const plan=Market.buildResearchPlan(profile,[],{mode:'quick',sourceTypes:['news'],sourceTypesCustomized:false});
 assert.ok(plan.every(item=>item.query.includes(item.offer)));assert.equal(plan.length,4);assert.equal(new Set(plan.map(x=>x.market)).size,2);assert.equal(new Set(plan.map(x=>x.offer)).size,3);assert.equal(new Set(plan.map(x=>x.sourceType)).size,3);
 assert.ok(Market.buildResearchPlan(profile,[],{mode:'quick',sourceTypes:['news'],sourceTypesCustomized:true}).every(x=>x.sourceType==='news'));
});
test('rank before cap prefers recent relevant evidence over early generic hits',()=>{
 const old={url:'https://old.example/a',title:'Generic overview',date:'2020-01-01',text:'old overview'};
 const fresh={url:'https://buyer.example/project',title:'Steel fabrication expansion',date:'2026-10-01',text:'Steel fabrication new plant '.repeat(50)};
 assert.equal(Conditions.assessEvidence([old,fresh],{now:'2026-10-01',profile:{priorityOffers:'steel fabrication'}}).results.slice(0,1)[0].url,fresh.url);
 assert.ok(Conditions.buildQualityGate([old],{mode:'quick'}).gaps.includes('evidence quality'));
});
