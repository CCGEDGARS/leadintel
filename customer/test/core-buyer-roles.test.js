const test=require('node:test');
const assert=require('node:assert/strict');
const Discovery=require('../discovery-engine.js');
const main={profile:{priorityOffers:'Full-service industrial project delivery',decisionMakers:'CEO/Owner; Sales/Commercial Leadership; HR/L&D; Team Leadership'},market:{icps:[{id:'icp-core',type:'core',active:true,buyerRoles:'Project Director; Operations Director; Production Director; Engineering Director; Procurement Director'},{id:'icp-reference-lookalike',type:'lookalike-led',active:true,buyerRoles:'CEO/Owner; Sales/Commercial Leadership; HR/L&D; Team Leadership'}]}};
test('saved target defaults to the active core ICP, never unrelated lookalike roles',()=>{
  assert.match(Discovery.buyerRolesForTarget(main,{}),/^Project Director/);
  assert.equal(Discovery.buyerRolesForTarget(main,{buyerRoles:main.profile.decisionMakers}),main.market.icps[0].buyerRoles);
  assert.equal(Discovery.buyerRolesForTarget(main,{buyerRoles:'CEO/Owner; Sales/Commercial Leadership; HR/L&D; Team Leadership'}),main.market.icps[0].buyerRoles);
});
test('company-specific industrial role edits stay in place',()=>{
  assert.equal(Discovery.buyerRolesForTarget(main,{buyerRoles:'Plant Manager; Procurement Director'}),'Plant Manager; Procurement Director');
  assert.equal(Discovery.buyerRolesForTarget({profile:{decisionMakers:'CEO'},market:{}},{buyerRoles:'Technical Director'}),'Technical Director');
});
