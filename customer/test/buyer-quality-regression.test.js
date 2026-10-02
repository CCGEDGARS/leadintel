const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
test('industrial production excludes content production while content sellers retain it',()=>{
 const people=[{id:'content',name:'Ulrika',title:'Content Production Manager'},{id:'plant',name:'Jon',title:'Production Manager'},{id:'buying',name:'Monika',title:'Procurement Director'}];
 assert.deepEqual(D.selectDecisionMakers(people,{decisionMakers:'Production; Procurement'},4).map(p=>p.id),['plant','buying']);
 assert.deepEqual(D.selectDecisionMakers(people,{decisionMakers:'Content Production'},4).map(p=>p.id),['content']);
});
test('public profile identity accepts sourced multi-part names and extracted Markdown',()=>{
 const person={name:'Anna',title:'Procurement Director'};
 const result=D.matchPublicLinkedInProfiles([person],[{url:'https://linkedin.com/in/anna-maria-lind',title:'Anna Maria Lind – LinkedIn',markdown:'Anna Maria Lind is Procurement Director at Example Automotive.'}],'Example Automotive');
 assert.equal(result[0].publicName,'Anna Maria Lind');assert.equal(result[0].publicLinkedinUrl,'https://linkedin.com/in/anna-maria-lind');
 const wrong=D.matchPublicLinkedInProfiles([person],[{url:'https://linkedin.com/in/anna-maria-lind',title:'Anna Maria Lind – LinkedIn',markdown:'Anna Maria Lind is Procurement Director at Other Company.'}],'Example Automotive');
 assert.equal(wrong[0].publicLinkedinUrl,undefined);
});
test('public discovery keeps twenty relevant sourced candidates and excludes former and media roles',()=>{
 const rows=Array.from({length:24},(_,i)=>({url:`https://linkedin.com/in/person-${i}`,title:`Anna Lind${String.fromCharCode(65+i)} – Procurement Director at Example Automotive`}));
 rows.push({url:'https://linkedin.com/in/former',title:'Former Person – Former Procurement Director at Example Automotive'},{url:'https://linkedin.com/in/media',title:'Media Person – Content Production Manager at Example Automotive'},{url:'https://linkedin.com/in/wrong',title:'Wrong Person – Procurement Director at Another Company'});
 const pool=D.discoverPublicBuyers(rows,'Example Automotive',{decisionMakers:'Procurement Director; Production Manager'});
 assert.equal(pool.length,20);assert.ok(pool.every(p=>p.publicNameUrl&&p.publicLinkedinUrl));
 const saved=D.normalizeDiscoveryState({selectedProspects:[{company:'Example Automotive',domain:'example.com',buyerSearchMode:'user_selected_target',people:pool.slice(0,6),buyerDiscovery:{found:20,pool,checkedAt:'2026-10-02T12:00:00Z'}}]}).selectedProspects[0];
 assert.equal(saved.people.length,6);assert.equal(saved.buyerDiscovery.pool.length,20);
});
test('public discovery adapts to legal buyer roles without seller-specific routing',()=>{
 const rows=[{url:'https://linkedin.com/in/legal',title:'Anna Lind – General Counsel at Other Industries'},{url:'https://linkedin.com/in/plant',title:'Erik Lind – Plant Manager at Other Industries'}];
 assert.deepEqual(D.discoverPublicBuyers(rows,'Other Industries',{decisionMakers:'General Counsel'}).map(p=>p.name),['Anna Lind']);
});
test('refresh merges twenty candidates, keeps pinned buyers and never erases sourced details',()=>{
 const profile={decisionMakers:'Procurement Director'};
 const prior=[{id:'original',name:'Anna Buyer',title:'Procurement Director',publicLinkedinUrl:'https://linkedin.com/in/anna',publicEmail:'anna@example.com',publicEmailUrl:'https://example.com/team',kept:true,keptAt:'2026-10-02',patternFindings:[{email:'anna@gmail.com',url:'https://association.test'}]}];
 const incoming=Array.from({length:25},(_,i)=>({id:`new${i}`,name:`Buyer Person ${i}`,title:'Procurement Director',publicLinkedinUrl:`https://linkedin.com/in/buyer-${i}`}));
 incoming.push({name:'Anna Buyer',title:'Procurement Director',publicLinkedinUrl:'https://linkedin.com/in/anna',publicEmail:''});
 const pool=D.mergeBuyerPool(prior,incoming,profile);
 assert.equal(pool.length,20);assert.equal(pool[0].id,'original');assert.equal(pool[0].publicEmail,'anna@example.com');assert.equal(pool[0].patternFindings[0].email,'anna@gmail.com');
 const visible=D.recommendedBuyers(pool,profile);assert.equal(visible.length,6);assert.equal(visible[0].kept,true);
 const saved=D.normalizeDiscoveryState({selectedProspects:[{company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:visible,buyerDiscovery:{pool,found:20}}]}).selectedProspects[0];
 assert.equal(saved.people[0].kept,true);assert.equal(saved.buyerDiscovery.pool[0].publicEmail,'anna@example.com');assert.equal(saved.buyerDiscovery.pool[0].patternFindings[0].email,'anna@gmail.com');
});
test('saved irrelevant roles remain retained but are ineligible for automatic recommendations',()=>{
 const person={name:'Anna Creative',title:'Content Production Manager',kept:true};
 const profile={decisionMakers:'Production Manager'};
 const pool=D.mergeBuyerPool([person],[],profile);assert.equal(pool.length,1);assert.equal(D.recommendedBuyers(pool,profile).length,0);
});
test('first-name-only unpinned records cannot displace sourced full identities',()=>{
 const pool=D.mergeBuyerPool([{name:'Jon',title:'Production Manager'}],[{name:'Erik Buyer',title:'Production Manager',publicLinkedinUrl:'https://linkedin.com/in/erik'}],{decisionMakers:'Production Manager'});
 assert.deepEqual(pool.map(p=>p.name),['Erik Buyer']);
});
