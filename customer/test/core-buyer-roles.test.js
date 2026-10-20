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

test('approved industrial core leadership roles remain valid in the expanded research selection',()=>{
 const roles='CEO/Owner; Team Leadership; Project Director; Operations; Production; Procurement; Engineering Director';
 const main={profile:{priorityOffers:'Metal manufacturing and installation',decisionMakers:roles},market:{icps:[{id:'icp-core',type:'core',active:true,buyerRoles:roles}]}};
 const candidate={company:'Example',domain:'example.com',buyerRoles:roles,buyerFit:{purchase:'procurement contracts'}};
 const expanded=Discovery.buyerResearchPlan(candidate,{decisionMakers:roles}).roles.join('; ');
 assert.equal(Discovery.buyerRolesForTarget(main,{...candidate,buyerRoles:expanded}),expanded);
});

test('a pending company-specific role edit remains authoritative even when its function differs from the industrial core',()=>{
 const edited='HR Director; Procurement Director';
 assert.equal(Discovery.buyerRolesForTarget(main,{buyerRoles:edited,buyerRolesChanged:true}),edited);
});

test('buyer role context normalizes array and string roles and binds only roles, offers and event roles',()=>{
 const main={profile:{companyName:'Seller One',priorityOffers:'Metal manufacturing; Installation',decisionMakers:'CEO/Owner; Team Leadership; Procurement'},market:{icps:[{id:'icp-core',type:'core',active:true,buyerRoles:'Project Director; Procurement'}]},eventCampaigns:{activeId:'event-one',campaigns:[{id:'event-one',name:'Conference One',roles:'Operations; Engineering Director'}]}};
 const context=Discovery.buyerRoleSelectionContext(main);
 const same=JSON.parse(JSON.stringify(main));same.profile.companyName='Seller Two';same.profile.updatedAt='2030-01-01';same.profile.priorityOffers=['Metal manufacturing','Installation'];same.profile.decisionMakers=['CEO/Owner','Team Leadership','Procurement'];same.market.icps[0].buyerRoles=['Project Director','Procurement'];same.eventCampaigns.campaigns[0].roles=['Operations','Engineering Director'];same.eventCampaigns.campaigns[0].name='Different conference';
 assert.equal(Discovery.buyerRoleSelectionContext(same),context);
 for(const change of [state=>state.market.icps[0].buyerRoles.push('Maintenance Director'),state=>state.profile.decisionMakers.push('HR Director'),state=>state.profile.priorityOffers='Document automation',state=>state.eventCampaigns.campaigns[0].roles.push('Facilities Director')]){
  const changed=JSON.parse(JSON.stringify(same));change(changed);assert.notEqual(Discovery.buyerRoleSelectionContext(changed),context);
 }
});
