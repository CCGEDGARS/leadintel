const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
test('independent indexed contacts retain non-buying professional roles without widening ordinary Buyer or official staff scope',()=>{
 const rows=[{url:'https://www.linkedin.com/in/maria-olsen',title:'Maria Olsen - Compliance Specialist - Finance Group',description:'Maria Olsen works at Finance Group.'},{url:'https://www.linkedin.com/in/other-person',title:'Other Person - CEO - Other Group',description:'Other Person works at Other Group.'}],profile={companyDomain:'finance.example',decisionMakers:'Head of Procurement'};
 assert.equal(D.tracePublicBuyers(rows,'Finance Group',{...profile,collectAllCompanyContacts:true}).people.length,0);
 assert.equal(D.tracePublicBuyers(rows,'Finance Group',profile).people.length,0);
 const independent=D.tracePublicBuyers(rows,'Finance Group',{...profile,collectAllCompanyContacts:true,includeIndexedCompanyContacts:true});assert.equal(independent.people.length,1);assert.equal(independent.people[0].name,'Maria Olsen');assert.equal(independent.people[0].title,'Compliance Specialist');assert.equal(independent.people[0].companyContactSource,'public_identity');assert.equal(independent.people[0].publicNameUrl,rows[0].url);
});
