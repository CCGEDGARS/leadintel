const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const now=()=>new Date().toISOString(),profile={decisionMakers:'Procurement Director; Chief Executive Officer'},company={company:'Acme Labs',domain:'acme.example'};
const person=(extra={})=>({id:'retained',name:'Alex Morgan',publicName:'Alex Morgan',title:'Head of Procurement',organization:company.company,publicNameUrl:'https://acme.example/team',identityStatus:'confirmed',nameVerification:'confirmed',...extra});
const url='https://linkedin.com/in/alex-morgan';
test('a directory profile bridges one retained identity and its local-language record without duplicate IDs or lost manual selection',()=>{
 const retained=person({publicLinkedinUrl:url,flowSelected:true,flowConfirmEmail:true,flowEmailCompletedFor:'alex@acme.example'}),local=person({id:'public-local',title:'Inköpschef',publicLinkedinUrl:''});
 let pool=D.mergeBuyerPool([retained,local],[{...local,publicLinkedinUrl:url}],profile);
 assert.equal(pool.length,1);assert.equal(pool[0].id,retained.id);assert.equal(pool[0].publicLinkedinUrl,url);assert.equal(pool[0].flowSelected,true);assert.equal(pool[0].flowEmailCompletedFor,retained.flowEmailCompletedFor);
 pool=D.mergeBuyerPool(pool,[local,{...local,publicLinkedinUrl:url}],profile);assert.equal(pool.length,1,'Replaying the same source cannot reintroduce its duplicate');
 const c={...company,buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director'],people:pool,buyerDiscovery:{pool}};
 const reopened=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({selectedProspects:[c]}))).selectedProspects[0];
 assert.equal(D.retainBuyerIdentities(reopened.people,profile,reopened).length,1);assert.equal(reopened.people[0].id,retained.id);assert.equal(reopened.people[0].flowSelected,true);
});
test('different exact profiles and same-name staff with unrelated roles cannot be collapsed by a bridge',()=>{
 const a=person({publicLinkedinUrl:url}),b=person({id:'other',title:'Communications Director',publicLinkedinUrl:'https://linkedin.com/in/alex-other'});
 const pool=D.mergeBuyerPool([a,b],[{...a,id:'public'}],{decisionMakers:'Procurement Director; Communications Director'});assert.equal(pool.length,2);assert.equal(pool.find(p=>p.id===b.id).publicLinkedinUrl,b.publicLinkedinUrl);
});
test('a changed full name on a secondary source ID cannot inherit the retained manual recipient',()=>{
 const retained=person({publicLinkedinUrl:url,linkedinConfirmedUrl:url,linkedinConfirmationMethod:'manual',linkedinConfirmedAt:now(),flowSelected:true}),local=person({id:'public-local',title:'Inköpschef',publicLinkedinUrl:''}),changed={...local,name:'Jamie Carter',publicName:'Jamie Carter',title:'Head of Procurement'};
 const pool=D.mergeBuyerPool([retained,local],[{...local,publicLinkedinUrl:url},changed],profile),old=pool.find(p=>p.id===retained.id),other=pool.find(p=>p.name===changed.name);
 assert.equal(pool.length,2);assert.equal(old.name,retained.name);assert.equal(old.linkedinConfirmedUrl,url);assert.ok(other);assert.notEqual(other.linkedinConfirmedUrl,url);assert.notEqual(other.flowSelected,true);
});
test('source ordering preserves the selected canonical ID and aliases survive a sparse replay after reload',()=>{
 const retained=person({publicLinkedinUrl:url,linkedinConfirmedUrl:url,linkedinConfirmationMethod:'manual',linkedinConfirmedAt:now(),flowSelected:true,kept:true}),local=person({id:'public-local',title:'Inköpschef',publicLinkedinUrl:''});
 const pool=D.mergeBuyerPool([local,retained],[{...local,publicLinkedinUrl:url}],profile);assert.equal(pool.length,1);assert.equal(pool[0].id,retained.id);
 const c={...company,buyerSearchMode:'user_selected_target',buyerRoles:['Procurement Director'],people:pool,buyerDiscovery:{pool}},restored=D.normalizeDiscoveryState(JSON.parse(JSON.stringify({selectedProspects:[c]}))).selectedProspects[0];
 const replay=D.mergeBuyerPool([local,...restored.people],[],profile);assert.equal(replay.length,1);assert.equal(replay[0].id,retained.id);assert.equal(replay[0].flowSelected,true);assert.equal(replay[0].linkedinConfirmedUrl,url);
});
function assess(body){const p=person({title:'Chief Executive Officer',contactResearch:{checks:{buyer_agent:{status:'complete'}}}}),c={...company,buyerRoles:['Chief Executive Officer'],people:[p]};return D.assessBuyerAgent(c,[{url:'https://acme.example/media/video-archive',markdown:body,sourceRead:true,extractedAt:now()}]).people[0];}
for(const gap of [' ', '\n\n'])test(`a neighbouring archive entry is not a named employment claim (${JSON.stringify(gap)})`,()=>{
 const row=assess('Q3 Highlight with CEO Alex Morgan'+gap+'The Journey of Water | Acme Labs'+gap+'The Inauguration of the Treatment Plant'+gap+'Right now at Acme Labs: Railyard by the main line');
 assert.equal(row.identity,'supported');assert.deepEqual(row.conflicts,[]);
});
test('another staff card cannot attribute its current employer to the named executive',()=>{
 const row=assess('Alex Morgan, Chief Executive Officer at Acme Labs\n\n## Jamie Carter\nCurrently Director at Other Business.');assert.equal(row.identity,'supported');assert.deepEqual(row.conflicts,[]);
});
for(const claim of ['Alex Morgan is now at Other Business.','Alex Morgan is currently CEO at Other Business.','Alex Morgan, Chief Executive Officer. Current employer: Other Business.','Former Executive Chairman, now CEO at Other Business | Alex Morgan'])test('actual named employment conflict stays blocked: '+claim,()=>{const row=assess(claim);assert.equal(row.identity,'conflict');assert.ok(row.conflicts.length);});
for(const claim of ['Alex Morgan is currently CEO at Other Business.','Alex Morgan is no longer CEO at Acme Labs.'])test('a later exact-person passage retains its real conflict: '+claim,()=>{
 const row=assess('Alex Morgan, Chief Executive Officer at Acme Labs\n\n'+claim);assert.equal(row.identity,'conflict');assert.ok(row.conflicts.length);
});
