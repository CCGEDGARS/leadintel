const test=require('node:test');
const assert=require('node:assert/strict');
const engine=require('../market-conditions-engine.js');

const source=(overrides={})=>({url:'https://example.com/report',title:'Report',organisation:'Example',researchCategory:'direction',...overrides});

test('one positive source remains insufficient evidence',()=>{
  const pack=engine.buildPack([source({direction:'growing',indicatorFamily:'output'})]);
  assert.equal(pack.direction.label,'Insufficient evidence');
});

test('independent official and labour indicators classify a growing market',()=>{
  const pack=engine.buildPack([
    source({url:'https://statistics.example/output',organisation:'Statistics Office',official:true,direction:'growing',indicatorFamily:'output'}),
    source({url:'https://jobs.example/vacancies',organisation:'Jobs Board',direction:'growing',indicatorFamily:'employment'})
  ]);
  assert.equal(pack.direction.label,'Growing');
  assert.equal(pack.direction.confidence,'Medium');
});

test('three aligned indicator families support accelerating with high confidence',()=>{
  const pack=engine.buildPack([
    source({url:'https://statistics.example/output',organisation:'Statistics Office',official:true,direction:'accelerating',indicatorFamily:'output'}),
    source({url:'https://industry.example/orders',organisation:'Industry Group',direction:'accelerating',indicatorFamily:'orders'}),
    source({url:'https://industry.example/investment',organisation:'Industry Group',direction:'growing',indicatorFamily:'investment'})
  ]);
  assert.equal(pack.direction.label,'Accelerating');
  assert.equal(pack.direction.confidence,'High');
});

test('conflicting indicators lower confidence',()=>{
  const pack=engine.buildPack([
    source({url:'https://statistics.example/output',organisation:'Statistics Office',official:true,direction:'growing',indicatorFamily:'output'}),
    source({url:'https://industry.example/orders',organisation:'Industry Group',direction:'contracting',indicatorFamily:'orders'})
  ]);
  assert.equal(pack.direction.label,'Mixed');
  assert.equal(pack.direction.confidence,'Low');
});

test('funding must have an official programme URL to appear as active',()=>{
  const pack=engine.buildPack([source({researchCategory:'funding',funding:{name:'Growth grant',status:'open',deadline:'2027-01-01'},official:false})]);
  assert.equal(pack.funding.active.length,0);
});

test('closed funding is kept out of active opportunities',()=>{
  const pack=engine.buildPack([source({url:'https://europa.eu/grant',organisation:'European Commission',researchCategory:'funding',official:true,funding:{name:'Growth grant',status:'closed',deadline:'2025-01-01'}})]);
  assert.equal(pack.funding.active.length,0);
  assert.equal(pack.funding.closed.length,1);
});

test('one pricing example is not presented as a market range',()=>{
  const pack=engine.buildPack([source({researchCategory:'pricing',pricing:{amount:75,currency:'EUR',unit:'hour'}})]);
  assert.equal(pack.pricing.range,null);
  assert.equal(pack.pricing.examples.length,1);
});

test('mixed currencies or units are not combined into a false range',()=>{
  const pack=engine.buildPack([
    source({url:'https://one.example',researchCategory:'pricing',pricing:{amount:75,currency:'EUR',unit:'hour'}}),
    source({url:'https://two.example',researchCategory:'pricing',pricing:{amount:900,currency:'SEK',unit:'day'}})
  ]);
  assert.equal(pack.pricing.range,null);
});

test('official funding text can produce a clearly sourced active programme',()=>{
  const pack=engine.buildPack([source({url:'https://commission.europa.eu/funding/call',organisation:'European Commission',researchCategory:'funding',title:'Manufacturing Innovation Call',text:'Applications are open. Deadline 30 June 2027.'})]);
  assert.equal(pack.funding.active.length,1);
  assert.match(pack.funding.active[0].name,/Manufacturing Innovation/);
});

test('comparable public price text produces a bounded observed range',()=>{
  const pack=engine.buildPack([
    source({url:'https://one.example',researchCategory:'pricing',text:'Engineering services: €65 per hour'}),
    source({url:'https://two.example',researchCategory:'pricing',text:'Typical consulting rate: 90 EUR/hour'})
  ]);
  assert.deepEqual(pack.pricing.range,{minimum:65,maximum:90,currency:'EUR',unit:'hour'});
});

test('evidence quality favours recent official sources and suppresses syndicated copies',()=>{
  const results=[
    source({url:'https://ec.europa.eu/call',organisation:'European Commission',official:true,date:'2026-08-01',title:'Manufacturing call opens',text:'Applications are open for manufacturing innovation.'}),
    source({url:'https://news-one.example/story',organisation:'News One',date:'2026-08-02',title:'Manufacturing call opens',text:'Applications are open for manufacturing innovation.'}),
    source({url:'https://news-two.example/repost',organisation:'News Two',date:'2026-08-02',title:'Manufacturing call opens',text:'Applications are open for manufacturing innovation.'})
  ];
  const assessed=engine.assessEvidence(results,{now:'2026-09-22T00:00:00Z'});
  assert.equal(assessed.results.length,2);
  assert.equal(assessed.results[0].url,'https://ec.europa.eu/call');
  assert.equal(assessed.duplicatesRemoved,1);
});

test('adaptive plan targets evidence gaps and is bounded by the selected mode',()=>{
  const plan=engine.buildAdaptivePlan({
    mode:'deep',market:'Sweden',offer:'industrial engineering',
    results:[source({researchCategory:'commercial'})]
  });
  assert.ok(plan.queries.length>0);
  assert.ok(plan.queries.length<=4);
  assert.ok(plan.gaps.includes('direction'));
  assert.match(plan.queries.map(item=>item.query).join(' '),/official statistics|funding|pricing/i);
  assert.deepEqual(engine.buildAdaptivePlan({mode:'quick',market:'Sweden',results:[]}).queries,[]);
});

test('quality gate reports missing coverage and prevents false high confidence',()=>{
  const gate=engine.buildQualityGate([source({researchCategory:'direction',official:true})],{mode:'deep'});
  assert.equal(gate.passed,false);
  assert.notEqual(gate.confidence,'High');
  assert.ok(gate.gaps.includes('source diversity'));
  assert.ok(gate.gaps.includes('pricing'));
});

test('structured extraction records official funding and comparable pricing facts',()=>{
  const extracted=engine.extractStructuredEvidence([
    source({url:'https://commission.europa.eu/funding/call',researchCategory:'funding',title:'Green Industry Fund',text:'Applications are open. Deadline 30 June 2027. Eligible SMEs may apply.'}),
    source({url:'https://pricing.example/rates',researchCategory:'pricing',text:'Industrial engineering services cost 85 EUR per hour.'})
  ]);
  assert.equal(extracted.funding[0].status,'open');
  assert.match(extracted.funding[0].deadline,/30 June 2027/);
  assert.equal(extracted.pricing[0].amount,85);
  assert.equal(extracted.pricing[0].unit,'hour');
});
