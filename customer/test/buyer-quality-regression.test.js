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
