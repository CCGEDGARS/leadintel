const test=require("node:test");
const assert=require("node:assert/strict");
const profile=require("../profile-engine.js");

test("legacy profiles receive recommended buying signals",()=>{
  const signals=profile.recommendedSignalsForProfile({companyOverview:"Office furniture and ergonomic equipment for commercial buyers.",priorityOffers:"Office furniture; storage systems",idealCustomer:"Companies, schools and warehouses in Latvia",buyingTriggers:""});
  assert.ok(signals.length>=3);
  assert.ok(signals.some(item=>item.id==="facility-expansion"));
  assert.ok(signals.some(item=>item.id==="capital-investment"));
  assert.ok(!signals.some(item=>item.id==="tender"));
  assert.ok(signals.every(item=>item.name&&item.priority));
});
