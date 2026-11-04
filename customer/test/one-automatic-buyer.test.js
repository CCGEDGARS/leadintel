const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js'),P=require('../additional-contact-policy.js'),receipts=require('./helpers/buyer-research-receipts.cjs');
function fixture(){const stamp=new Date().toISOString(),c={company:'Example',domain:'example.com',buyerRoles:['Procurement Director'],qualification:{eligible:true,score:85,researchedAt:stamp},people:Array.from({length:4},(_,i)=>({id:'p'+i,name:'Anna '+['Andersson','Berg','Carlsson','Dahl'][i],title:'Procurement Director',organization:'Example',publicNameUrl:'https://example.com/team',emailResearch:{status:'complete',checkedAt:stamp,searches:9,failed:0}})),publicResearch:{accountability:{...D.createBuyerResearchAccountability(),status:'complete',totalPeople:4,checkedPeople:4,completedAt:stamp}}};receipts(c);return c;}
test('automatic targets one highest-ranked buyer even when saved capacity is ten',()=>{assert.deepEqual(P.targets(fixture(),{provider:'apollo',maxPerCompany:10}).map(p=>p.id),['p0']);});
test('a confirmed top buyer does not cause automatic spending on the other three',()=>{assert.deepEqual(P.targets(fixture(),{provider:'apollo',maxPerCompany:10,confirmedEmail:p=>p.id==='p0'?'confirmed':''}),[]);});
test('manual readiness remains available for all four qualified buyers',()=>{const c=fixture();for(const person of c.people)assert.equal(P.readiness(c,person,{provider:'apollo',automatic:false}).eligible,true);});

test('owner-selected automatic capacity permits only the top 1–4 buyers',()=>{
 for(const limit of [1,2,3,4]){const c=fixture();assert.deepEqual(P.targets(c,{provider:'apollo',automaticBuyerLimit:limit}).map(p=>p.id),c.people.slice(0,limit).map(p=>p.id));}
});
