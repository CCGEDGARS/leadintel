const test=require('node:test');
const assert=require('node:assert/strict');
const Discovery=require('../discovery-engine.js');
require('../lookalike-discovery.js').install(Discovery);

test('inactive reference model does not affect discovery scoring',()=>{
  const candidate={company:'Nordic Machines',domain:'nordic.example',market:'Germany',industry:'industrial manufacturing',sizeBand:'100-500',businessModel:'B2B'};
  const without=Discovery.scoreLookalikeMatch(candidate,null);
  assert.deepEqual(without,{active:false,total:0,dimensions:[],reasons:[]});
});

test('an active model with no recurring dimensions does not create a generic lookalike query',()=>{
  const profile={targetMarkets:'Sweden',priorityOffers:'Industrial engineering',idealCustomer:'manufacturing companies'};
  const queries=Discovery.buildLookalikeDiscoveryQueries(profile,{active:true,profileName:'Reference customer profile',dimensions:[]},4);
  assert.deepEqual(queries,[]);
  const score=Discovery.scoreLookalikeMatch({company:'A Swedish manufacturer'},{active:true,dimensions:[]});
  assert.equal(score.active,false);
});

test('active Reference Customer DNA produces explainable lookalike score',()=>{
  const dna={active:true,dimensions:[
    {key:'industry',values:['industrial manufacturing'],weight:1,confidence:'high'},
    {key:'sizeBand',values:['100-500'],weight:1,confidence:'medium'},
    {key:'businessModel',values:['B2B'],weight:1,confidence:'high'}
  ]};
  const candidate={company:'Nordic Machines',market:'Germany',industry:'industrial manufacturing',sizeBand:'100-500',businessModel:'B2B'};
  const score=Discovery.scoreLookalikeMatch(candidate,dna);
  assert.equal(score.active,true);
  assert.ok(score.total>=80);
  assert.ok(score.dimensions.length>=3);
  assert.ok(score.reasons.some(x=>/industry/i.test(x)));
});

test('low-confidence customer hypotheses influence ranking less than repeated high-confidence patterns',()=>{
  const candidate={company:'Nordic Machines',industry:'industrial manufacturing'};
  const high=Discovery.scoreLookalikeMatch(candidate,{active:true,dimensions:[{key:'industry',values:['industrial manufacturing'],weight:1,confidence:'high'}]});
  const low=Discovery.scoreLookalikeMatch(candidate,{active:true,dimensions:[{key:'industry',values:['industrial manufacturing'],weight:1,confidence:'low'}]});

  assert.ok(low.total<high.total);
});

test('Step 1 target markets constrain lookalike queries country by country',()=>{
  const profile={website:'https://seller.example',targetMarkets:'Germany; Poland',priorityOffers:'Industrial automation',idealCustomer:'manufacturers',buyingTriggers:'factory expansion'};
  const dna={active:true,profileName:'Industrial manufacturing customers',dimensions:[{key:'industry',values:['industrial manufacturing'],weight:1,confidence:'high'}]};
  const queries=Discovery.buildLookalikeDiscoveryQueries(profile,dna,6);
  assert.ok(queries.length>=2);
  assert.ok(queries.some(q=>q.market==='Germany'));
  assert.ok(queries.some(q=>q.market==='Poland'));
  assert.equal(queries.some(q=>q.market==='Sweden'),false);
  assert.ok(queries.every(q=>q.query.includes('industrial manufacturing')&&q.query.includes('factory expansion')));
});

test('verified opportunity score outranks resemblance, with reference context only breaking ties',()=>{
  const dna={active:true,dimensions:[{key:'industry',values:['sawmill'],weight:1,confidence:'high'}]};
  const candidates=[
    {company:'Strong signal',industry:'pulp mill',score:{total:80}},
    {company:'Resembles customer',industry:'sawmill',score:{total:65}}
  ];
  const ranked=Discovery.rankCandidatesWithLookalike(candidates,{},dna);
  assert.equal(ranked[0].company,'Strong signal');
  assert.equal(ranked[0].priorityScore,80);
  assert.equal(ranked[1].priorityScore,65);
});

test('seller and known customers cannot be returned as new opportunities',()=>{
  const candidates=[
    {company:'Seller',domain:'seller.example',score:{total:95}},
    {company:'Existing customer',domain:'buyer.example',score:{total:90}},
    {company:'New prospect',domain:'prospect.example',score:{total:80}}
  ];
  const model={activeRows:[{website:'https://buyer.example/'}],dna:{active:true,dimensions:[]}};
  assert.deepEqual(Discovery.rankCandidatesWithLookalike(candidates,{website:'https://seller.example/'},model).map(c=>c.company),['New prospect']);
});

test('hard exclusion blocks candidate even with strong lookalike similarity',()=>{
  const profile={exclusions:'private consumers; Russia'};
  const candidate={company:'Perfect Match',market:'Russia',description:'industrial manufacturing B2B company'};
  assert.equal(Discovery.isHardExcluded(candidate,profile),true);
});
