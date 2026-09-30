const {test}=require('node:test');
const assert=require('node:assert/strict');
const {targetResearchSummary}=require('../reference-customers.js');
const target={companyName:'Sandvik',website:'https://home.sandvik/'};
test('completed legacy target research is recovered without repeating the search',()=>{
  const result=targetResearchSummary(target,{lastRunAt:'2026-09-30',status:'no_results'},{lastTargetResearchNames:['sandvik']});
  assert.equal(result.completed,true);assert.equal(result.qualified,false);
  assert.match(result.label,/Research completed/);
  assert.equal(targetResearchSummary({companyName:'Komatsu',website:'https://komatsuforest.com/'},{lastRunAt:'2026-09-30'},{lastTargetResearchNames:['sandvik']}).completed,false);
});
test('saved outcome retains evidence gaps after another company is researched',()=>{
  const evidence=[{url:'https://home.sandvik/news/',title:'Company news'}];
  const result=targetResearchSummary(target,{lastRunAt:'later'},{lastTargetResearchNames:['komatsu'],targetResearchByDomain:{'home.sandvik':{completedAt:'earlier',qualified:false,gaps:['No active buying signal was confirmed'],evidence}}});
  assert.equal(result.completed,true);assert.equal(result.completedAt,'earlier');assert.deepEqual(result.evidence,evidence);assert.deepEqual(result.gaps,['No active buying signal was confirmed']);
});
