import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildMandatorySourceQueries} from '../src/intelligence-sources-engine.js';

const monitoringSource=fs.readFileSync(new URL('../src/market-monitoring.js',import.meta.url),'utf8');

test('mandatory Intelligence Sources augment normal monitoring instead of replacing it',()=>{
  assert.match(monitoringSource,/const baseQueries=buildMonitoringQueries\(payload,config\)/);
  assert.match(monitoringSource,/const mandatoryQueries=buildMandatorySourceQueries\(mandatorySources,signals,profile\)/);
  assert.match(monitoringSource,/const queries=\[\.\.\.baseQueries,\.\.\.mandatoryQueries\]/);
});

test('mandatory source queries are site-scoped and limited to mapped active signals',()=>{
  const queries=buildMandatorySourceQueries([
    {id:'src-1',name:'Registry',host:'registry.example',mandatory:true,monitoringEnabled:true,accessStatus:'full',triggerIds:['growth']}
  ],[
    {id:'growth',name:'Expansion',keywords:'new factory, expansion',active:true},
    {id:'jobs',name:'Hiring',keywords:'hiring',active:true}
  ],{targetMarkets:'Latvia',priorityOffers:'industrial equipment'});
  assert.equal(queries.length,1);
  assert.match(queries[0].query,/^site:registry\.example /);
  assert.deepEqual(queries[0].signalIds,['growth']);
  assert.match(queries[0].query,/new factory expansion/);
  assert.doesNotMatch(queries[0].query,/hiring/);
});
