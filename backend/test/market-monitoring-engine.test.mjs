import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeMonitoringConfig,nextMonitoringRun,buildMonitoringQueries,scoreMonitoringEvidence} from '../src/market-monitoring-engine.js';

test('monitoring configuration is normalized and cost-bounded',()=>{
  const config=normalizeMonitoringConfig({enabled:true,frequency:'weekly',research_depth:'deep',minimum_score:150,source_types:['news','tenders','unsafe'],signal_ids:['one','two'],custom_sources:['https://example.com','javascript:bad']});
  assert.equal(config.enabled,true);
  assert.equal(config.frequency,'weekly');
  assert.equal(config.researchDepth,'deep');
  assert.equal(config.minimumScore,100);
  assert.deepEqual(config.sourceTypes,['news','tenders']);
  assert.deepEqual(config.customSources,['https://example.com/']);
});

test('next run follows daily, weekly and monthly cadence',()=>{
  const start='2026-09-06T10:00:00.000Z';
  assert.equal(nextMonitoringRun(start,'daily'),'2026-09-07T10:00:00.000Z');
  assert.equal(nextMonitoringRun(start,'weekly'),'2026-09-13T10:00:00.000Z');
  assert.equal(nextMonitoringRun(start,'monthly'),'2026-10-06T10:00:00.000Z');
});

test('monitoring query builder uses selected signals and source categories',()=>{
  const payload={main:{profile:{companyName:'AJ Produkti',targetMarkets:'Latvia',priorityOffers:'office furniture'},market:{signals:[{id:'move',active:true,weight:10,name:'Office move',keywords:'new office; relocation'},{id:'hire',active:true,weight:7,name:'Hiring',keywords:'vacancies'}]}}};
  const config=normalizeMonitoringConfig({research_depth:'deep',source_types:['news','tenders'],signal_ids:['move']});
  const queries=buildMonitoringQueries(payload,config);
  assert.ok(queries.length>=2&&queries.length<=12);
  assert.ok(queries.every(row=>/Latvia/.test(row.query)&&/new office|relocation/i.test(row.query)));
  assert.ok(queries.every(row=>row.sourceType!=='tenders')); // non-tender signals cannot authorize procurement research
});

test('custom public sources become domain-restricted monitoring queries',()=>{
  const payload={main:{profile:{targetMarkets:'Latvia',priorityOffers:'workplace equipment'},market:{signals:[{id:'move',active:true,weight:10,name:'Move',keywords:'new office'}]}}};
  const config=normalizeMonitoringConfig({research_depth:'deep',source_types:['news'],signal_ids:['move'],custom_sources:['https://example.com/industry/news']});
  const queries=buildMonitoringQueries(payload,config);
  assert.ok(queries.some(row=>row.sourceType==='custom'&&/site:example\.com/.test(row.query)));
});

test('evidence scoring rewards selected signal matches and recent dated evidence',()=>{
  const score=scoreMonitoringEvidence({title:'New office relocation announced',text:'Company opens a new office',date:'2026-09-05',url:'https://example.com/news'},[{id:'move',weight:10,keywords:'new office; relocation'}],new Date('2026-09-06T10:00:00Z'));
  assert.ok(score.total>=70);
  assert.deepEqual(score.signalIds,['move']);
});

test('explicitly empty source selection stays empty and does not generate default-category searches',()=>{
 const config=normalizeMonitoringConfig({enabled:true,source_types:[],custom_sources:['https://example.com']});
 assert.deepEqual(config.sourceTypes,[]);
 const queries=buildMonitoringQueries({main:{profile:{targetMarkets:'Sweden',priorityOffers:'Training'},market:{signals:[{id:'hiring',active:true,name:'Hiring'}]}}},config);
 assert.ok(queries.length>0);assert.ok(queries.every(query=>query.sourceType==='custom'));
});

test('monthly UTC cadence clamps month-end rather than overflowing into another month',()=>{
 assert.equal(nextMonitoringRun('2026-01-31T10:00:00Z','monthly'),'2026-02-28T10:00:00.000Z');
});

test('inactive and absent signals never generate research and tenders require an explicit active tender signal',()=>{
 const payload={main:{profile:{targetMarkets:'Finland',priorityOffers:'Training'},market:{signals:[{id:'hire',active:false,name:'Hiring'}]}}};
 assert.deepEqual(buildMonitoringQueries(payload,{sourceTypes:['news','tenders']}),[]);
 payload.main.market.signals[0].active=true;
 assert.ok(buildMonitoringQueries(payload,{sourceTypes:['news','tenders']}).every(query=>query.sourceType!=='tenders'));
 payload.main.market.signals.push({id:'tender',active:true,name:'Tenders',keywords:'procurement'});
 assert.ok(buildMonitoringQueries(payload,{sourceTypes:['tenders']}).some(query=>query.sourceType==='tenders'));
 assert.ok(!normalizeMonitoringConfig({}).sourceTypes.includes('tenders'));
});

test('unsafe custom sources are rejected and tracking variants have one canonical identity',()=>{
 const config=normalizeMonitoringConfig({customSources:['http://127.0.0.1/private','http://192.168.1.1','https://user:pass@example.com','file:///etc/passwd','https://example.com/story?utm_source=x#section','https://example.com/story']});
 assert.deepEqual(config.customSources,['https://example.com/story']);
});

test('future or missing dates do not manufacture freshness and unsafe evidence cannot score',()=>{
 const signals=[{id:'move',weight:10,keywords:'relocation'}],now=new Date('2026-10-30T10:00:00Z');
 const future=scoreMonitoringEvidence({title:'relocation',url:'https://example.com',date:'2099-01-01'},signals,now);
 const absent=scoreMonitoringEvidence({title:'relocation',url:'https://example.com'},signals,now);
 assert.equal(future.recency,0);assert.equal(absent.recency,0);
 assert.equal(scoreMonitoringEvidence({title:'relocation',url:'javascript:alert(1)'},signals,now).total,0);
 assert.equal(scoreMonitoringEvidence({title:'generic article',url:'https://example.com',date:'2026-10-29'},signals,now).total,0);
});

test('monitoring queries use current markets, confirmed targeting answers and active ICP projection across industries',()=>{
 for(const [market,offer]of [['Norway','Clinical training'],['Estonia','Renewable storage']]){
  const payload={main:{targetMarkets:['Sweden'],answers:{priority_offers:'Reviewed offer',ideal_customer:'Reviewed buyers'},profile:{targetMarkets:'Finland',priorityOffers:'Steel'},market:{icps:[{id:'active',active:true,targetMarkets:market,offers:offer},{id:'old',active:false,targetMarkets:'France',offers:'Furniture'}],signals:[{id:'move',active:true,keywords:'relocation'}]}}};
  let queries=buildMonitoringQueries(payload,{sourceTypes:['news']});assert.ok(queries.length);assert.ok(queries.every(row=>row.query.includes(market)&&row.query.includes(offer)&&!row.query.includes('Finland')&&!row.query.includes('Steel')&&!row.query.includes('France')));
  payload.main.market.icps=[];queries=buildMonitoringQueries(payload,{sourceTypes:['news']});assert.ok(queries.every(row=>row.query.includes('Sweden')&&row.query.includes('Reviewed offer')));
 }
});
