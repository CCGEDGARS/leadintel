const test=require('node:test'),assert=require('node:assert/strict');
const Brain=require('../company-brain.js'),Market=require('../market-engine.js'),Review=require('../market-research-review-ux.js');
const cases=[
 {offer:'Industrial engineering and installation',market:'Sweden',trigger:'Production facility expansion',expected:'industrial-project'},
 {offer:'Corporate sales training',market:'Germany',trigger:'New sales director',expected:'sales-team-hiring'},
 {offer:'Executive leadership coaching',market:'Finland',trigger:'Leadership development',expected:'leadership-development'},
 {offer:'Digital marketing consulting',market:'Denmark',trigger:'New market entry',expected:'market-entry'},
 {offer:'SaaS software platform',market:'Netherlands',trigger:'New market entry',expected:'market-entry'}
];
test('signals, queries and preview themes adapt to five seller profiles and markets',()=>{
 for(const c of cases){
  const profile={companyName:'Example seller',priorityOffers:c.offer,idealCustomer:'Relevant B2B customers',targetMarkets:c.market,buyingTriggers:c.trigger};
  const signals=Brain.recommendSignals({profile});assert.ok(signals.some(s=>s.id===c.expected),c.offer);
  if(!c.offer.includes('sales training'))assert.equal(signals.some(s=>s.id==='sales-team-hiring'),false,c.offer);
  const plan=Market.buildResearchPlan(profile,signals,{mode:'deep',sourceTypes:['news']});
  assert.ok(plan.every(q=>q.market===c.market));assert.ok(plan.every(q=>q.query.includes(c.market)));
  const themes=Review.themesFromPlan(plan.map(q=>q.signalName||q.researchCategory));
  assert.ok(themes.includes(signals.find(s=>s.id===c.expected).name));
  if(c.offer.includes('software')||c.offer.includes('marketing'))assert.doesNotMatch(plan.map(q=>q.query).join(' '),/facility investment|production expansion|industrial project/i);
 }
});
test('business names and websites never determine seller signal selection',()=>{
 for(const c of cases){
  const profile={priorityOffers:c.offer,targetMarkets:c.market,buyingTriggers:c.trigger};
  const expected=Brain.recommendSignals({profile});
  for(const companyName of ['Ercon','Unrelated seller','New user'])assert.deepEqual(Brain.recommendSignals({website:'https://different.example',profile:{...profile,companyName}}),expected);
 }
});
