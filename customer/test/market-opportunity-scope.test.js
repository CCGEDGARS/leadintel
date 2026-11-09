const test=require('node:test');
const assert=require('node:assert/strict');
const Market=require('../market-engine.js');
const seller={targetMarkets:'Denmark',priorityOffers:'Drawing development',idealCustomer:'Industrial manufacturers'};
const signals=[{name:'Factory expansion',keywords:'expansion',active:true,weight:8}];
const source=(extra={})=>({market:'Denmark',url:'https://news.example/expansion',title:'Ulbrich expands its Wallingford factory',text:'Ulbrich announces a new factory expansion in Connecticut, United States.',extractedAt:new Date().toISOString(),...extra});

test('a query country is not evidence that the returned article concerns that country',()=>{
 const wrong=source({query:'Denmark factory expansion'});
 const opportunity=Market.buildMarketOpportunities(seller,[],signals,[wrong])[0];
 assert.equal(opportunity.profileOnly,true);assert.deepEqual(opportunity.evidence,[]);assert.equal(opportunity.score.total,0);
 assert.equal(wrong.market,'Denmark','raw research must be retained');
});
test('market aliases come from page content, not the publisher domain or query',()=>{
 for(const word of ['Denmark','Danish','Danmark']){
  const result=source({title:`${word} manufacturer expands its factory`,text:`A ${word} manufacturing project is expanding.`,url:'https://publisher.example/story'});
  assert.equal(Market.buildMarketOpportunities(seller,[],signals,[result])[0].evidence.length,1);
 }
 assert.equal(Market.buildMarketOpportunities(seller,[],signals,[source({url:'https://publisher.dk/story'})])[0].evidence.length,0);
});
test('the same market scope rule works for other industries and custom markets',()=>{
 const p={targetMarkets:'Canada',priorityOffers:'Legal advice',idealCustomer:'Software companies'};
 const rows=[source({market:'Canada',title:'Software business in Sweden',text:'A Swedish software business expands.'}),source({market:'Canada',title:'Canada software business',text:'A software business expands in Canada.',url:'https://other.example/article'})];
 const opportunity=Market.buildMarketOpportunities(p,[],[],rows)[0];
 assert.deepEqual(opportunity.evidence.map(x=>x.url),['https://other.example/article']);
 assert.equal(opportunity.title,'Canada: Legal advice');
});
test('reopening a saved opportunity rechecks evidence while preserving its manual selections',()=>{
 const good=source({title:'New factory in Denmark',url:'https://factory.example/news'}),wrong=source();
 const saved={id:'opp-denmark',market:'Denmark',title:'My saved opportunity',active:false,hypothesis:'My manual note',evidence:[wrong,good],score:{total:100},confidence:'High'};
 const [rechecked]=Market.revalidateMarketOpportunities(seller,signals,[saved]);
 assert.deepEqual(rechecked.evidence,[good]);assert.equal(rechecked.active,false);assert.equal(rechecked.title,saved.title);assert.equal(rechecked.hypothesis,saved.hypothesis);assert.notEqual(rechecked.confidence,'High');assert.equal(saved.evidence.length,2);
});
