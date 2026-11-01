const test=require('node:test'),assert=require('node:assert/strict');
const M=require('../market-engine.js');
test('headlines connect the active signal to the current workspace offer and update with edits',()=>{
 const p={priorityOffers:'Engineering services',buyingTriggers:'Old signal'},icp={type:'trigger-led'};
 const market={signals:[{name:'Inactive hiring',active:false},{name:'Plant expansion',active:true}]};
 const h=M.profilePurposeHeadline(icp,p,market);assert.match(h,/Engineering services/);assert.match(h,/Plant expansion/);assert.doesNotMatch(h,/Old signal|Inactive hiring/);
 assert.match(M.profilePurposeHeadline({...icp,offers:'Legal advice'},p,market),/Legal advice/);
 assert.doesNotMatch(M.profilePurposeHeadline(icp,p,{signals:[{name:'Plant expansion',active:false}]}),/Plant expansion|Old signal/);
});
test('each profile purpose uses its own targeting without inventing customer facts',()=>{
 assert.match(M.profilePurposeHeadline({type:'core',description:'Independent clinics',offers:'Scheduling software'}),/Scheduling software among Independent clinics/);
 assert.match(M.profilePurposeHeadline({type:'opportunity-led',offers:'Office furniture'}),/Office furniture.*researched commercial opportunities/);
 for(const type of ['lookalike','lookalike-led'])assert.match(M.profilePurposeHeadline({type,offers:'Logistics'}),/Logistics.*active reference customers/);
 assert.doesNotMatch(M.profilePurposeHeadline(),/Ercon|Sweden|manufactur/i);
});
