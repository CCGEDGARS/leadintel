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
  assert.ok(queries.some(row=>row.sourceType==='tenders'));
});

test('custom public sources become domain-restricted monitoring queries',()=>{
  const payload={main:{profile:{targetMarkets:'Latvia',priorityOffers:'workplace equipment'},market:{signals:[{id:'move',active:true,weight:10,name:'Move',keywords:'new office'}]}}};
  const config=normalizeMonitoringConfig({research_depth:'deep',source_types:['news'],signal_ids:['move'],custom_sources:['https://example.com/industry/news']});
  const queries=buildMonitoringQueries(payload,config);
  assert.ok(queries.some(row=>row.sourceType==='custom'&&/site:example\.com/.test(row.query)));
});

test('evidence scoring rewards selected signal matches and recent dated evidence',()=>{
  const score=scoreMonitoringEvidence({title:'New office relocation announced',text:'Company opens a new office',date:'2026-09-05'},[{id:'move',weight:10,keywords:'new office; relocation'}],new Date('2026-09-06T10:00:00Z'));
  assert.ok(score.total>=70);
  assert.deepEqual(score.signalIds,['move']);
});
