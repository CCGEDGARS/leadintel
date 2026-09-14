const test=require("node:test");
const assert=require("node:assert/strict");
const discovery=require("./discovery-engine.js");

test("discovery target presets map to bounded search and result limits",()=>{
  assert.deepEqual(discovery.discoveryLimits(),{targetCount:12,queryCount:4,resultsPerQuery:5});
  assert.deepEqual(discovery.discoveryLimits(10),{targetCount:10,queryCount:4,resultsPerQuery:5});
  assert.deepEqual(discovery.discoveryLimits(25),{targetCount:25,queryCount:8,resultsPerQuery:5});
  assert.deepEqual(discovery.discoveryLimits(50),{targetCount:50,queryCount:10,resultsPerQuery:5});
  assert.deepEqual(discovery.discoveryLimits(999),{targetCount:12,queryCount:4,resultsPerQuery:5});
});

test("expanded discovery targets create unique buyer-oriented queries",()=>{
  const queries=discovery.buildDiscoveryQueries(
    {website:"https://example.lv",targetMarkets:["Latvia"],priorityOffers:"Office furniture",idealCustomer:"commercial organizations"},
    {signals:[{id:"s1",name:"Expansion",keywords:"expansion",weight:8,active:true}],icps:[]},
    10
  );
  assert.equal(queries.length,10);
  assert.equal(new Set(queries.map(item=>item.query)).size,10);
  assert.ok(queries.every(item=>/buyer|customer|official website/i.test(item.query)));
  assert.ok(queries.every(item=>!/tender|procurement|manufacturer/i.test(item.query)));
});

test("candidate merge honors a requested target count",()=>{
  const results=Array.from({length:30},(_,index)=>({
    domain:`company-${index}.lv`,
    url:`https://company-${index}.lv/`,
    company:`Company ${index}`,
    market:"Latvia",
    title:`Company ${index} expansion`,
    description:"Office expansion and commercial furniture project",
    text:"Company expansion signal and new office project"
  }));
  const candidates=discovery.mergeCompanyCandidates(
    results,
    {website:"https://example.lv",priorityOffers:"Office furniture"},
    {signals:[{id:"s1",name:"Expansion",keywords:"expansion",weight:8,active:true}]},
    25
  );
  assert.equal(candidates.length,25);
});
