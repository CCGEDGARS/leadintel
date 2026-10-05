const test=require('node:test'),assert=require('node:assert/strict'),Discovery=require('../discovery-engine.js');
for(const company of ['LKAB','Independent Factory'])test(`${company}: first search budget covers every planned role before aliases`,()=>{
 const plan=Discovery.buyerResearchPlan({company,domain:'factory.example',market:'Sweden',buyerFit:{purchase:'plant expansion equipment procurement production installation'}},{decisionMakers:'Procurement Director; Plant Manager'});
 const first=plan.queries.slice(0,18);
 for(const role of plan.roles)assert.ok(first.some(query=>Discovery.localBuyerRoleAliases(role,'Sweden').some(alias=>query.includes('"'+alias+'"'))),`missing ${role} in first search budget`);
 assert.ok(first.some(query=>/Inköpschef/.test(query)),'local procurement role must get initial coverage');
 assert.ok(first.some(query=>/Teknisk chef/.test(query)),'local engineering role must get initial coverage');
 assert.equal(new Set(plan.queries).size,plan.queries.length);
});
