import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildMandatorySourceQueries} from '../src/intelligence-sources-engine.js';
import {buildMonitoringQueries,monitoringTargetingProfile} from '../src/market-monitoring-engine.js';

const monitoringSource=fs.readFileSync(new URL('../src/market-monitoring.js',import.meta.url),'utf8');

test('mandatory Intelligence Sources augment normal monitoring instead of replacing it',()=>{
  const payload={main:{profile:{targetMarkets:'Finland',priorityOffers:'Steel'},market:{icps:[{id:'clinical',active:true,targetMarkets:'Norway',offers:'Clinical training'}],signals:[{id:'growth',active:true,keywords:'expansion'}]}}};
  const profile=monitoringTargetingProfile(payload.main);
  const base=buildMonitoringQueries(payload,{sourceTypes:['news']});
  const mandatory=buildMandatorySourceQueries([{id:'registry',host:'registry.example',mandatory:true,monitoringEnabled:true,accessStatus:'full',triggerIds:['growth']}],payload.main.market.signals,profile);
  assert.ok(base.length>0);assert.equal(mandatory.length,1);
  assert.ok([...mandatory,...base].every(row=>row.query.includes('Norway')&&row.query.includes('Clinical training')));
  assert.match(monitoringSource,/profile=monitoringTargetingProfile\(payload\?\.main\|\|\{\}\)/);
  assert.match(monitoringSource,/queries=\[\.\.\.buildMandatorySourceQueries\(mandatorySources,signals,profile\),\.\.\.buildMonitoringQueries\(payload,config\)\]\.slice\(0,limit\)/);
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
