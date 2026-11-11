const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
test('independent indexed contacts retain non-buying professional roles without widening ordinary Buyer or official staff scope',()=>{
 const rows=[{url:'https://www.linkedin.com/in/maria-olsen',title:'Maria Olsen - Compliance Specialist - Finance Group',description:'Maria Olsen works at Finance Group.'},{url:'https://www.linkedin.com/in/other-person',title:'Other Person - CEO - Other Group',description:'Other Person works at Other Group.'}],profile={companyDomain:'finance.example',decisionMakers:'Head of Procurement'};
 assert.equal(D.tracePublicBuyers(rows,'Finance Group',{...profile,collectAllCompanyContacts:true}).people.length,0);
 assert.equal(D.tracePublicBuyers(rows,'Finance Group',profile).people.length,0);
 const independent=D.tracePublicBuyers(rows,'Finance Group',{...profile,collectAllCompanyContacts:true,includeIndexedCompanyContacts:true});assert.equal(independent.people.length,1);assert.equal(independent.people[0].name,'Maria Olsen');assert.equal(independent.people[0].title,'Compliance Specialist');assert.equal(independent.people[0].companyContactSource,'public_identity');assert.equal(independent.people[0].publicNameUrl,rows[0].url);
});
test('profile activity and article authors cannot inherit another named subject’s employment',()=>{
 const rows=[
  {url:'https://www.linkedin.com/in/aleksandra-cudova/posts',title:'Aleksandra Čudova - Sun Finance',description:'Toms Jurjevs is Founder & CEO at Sun Finance.'},
  {url:'https://www.linkedin.com/in/aleksandra-cudova/recent-activity/all/',title:'Aleksandra Čudova - Sun Finance',description:'Toms Jurjevs is Founder & CEO at Sun Finance.'},
  {url:'https://news.example/posts/aleksandra-cudova',title:'Aleksandra Čudova - Sun Finance',description:'Toms Jurjevs is Founder & CEO at Sun Finance.'},
  {url:'https://www.linkedin.com/in/aleksandra-cudova',title:'Aleksandra Čudova - Sun Finance',description:'Toms Jurjevs is Founder & CEO at Sun Finance.'},
  {url:'https://www.linkedin.com/in/another-author',title:'Another Author - Sun Finance',description:'Toms Jurjevs, Founder & CEO at Sun Finance.'},
  {url:'https://www.linkedin.com/in/aleksandra-cudova',title:'Aleksandra Čudova - Sun Finance',description:'Aleksandra Čudova, CFO at Sun Finance.'},
  {url:'https://news.example/bios/toms-jurjevs',title:'Toms Jurjevs - Sun Finance',description:'Toms Jurjevs is Founder & CEO at Sun Finance.'},
  {url:'https://www.linkedin.com/in/eva-post',title:'Eva Post - Sun Finance',description:'CFO at Sun Finance.'}
 ];
 const result=D.tracePublicBuyers(rows,'Sun Finance',{companyDomain:'sunfinance.group',collectAllCompanyContacts:true,includeIndexedCompanyContacts:true});assert.deepEqual(result.people.map(p=>[p.name,p.title]),[['Aleksandra Čudova','CFO'],['Toms Jurjevs','Founder & CEO'],['Eva Post','CFO']]);
});
test('LinkedIn posts cannot turn a post author or quoted executive into a company identity',()=>{
 const rows=[{url:'https://www.linkedin.com/posts/aleksandra-cudova-finance',title:"Aleksandra Čudova's Post",description:'Toms Jurjevs is Founder & CEO at Sun Finance.'},{url:'https://www.linkedin.com/pulse/sun-finance-founders',title:'Toms Jurjevs - CEO - Sun Finance',description:'Toms Jurjevs is CEO at Sun Finance.'},{url:'https://www.linkedin.com/in/eoin-oconnor',title:"Eoin O'Connor - Compliance Specialist - Sun Finance",description:"Eoin O'Connor works at Sun Finance."},{url:'https://www.linkedin.com/in/eva-post',title:'Eva Post - CFO - Sun Finance',description:'Eva Post works at Sun Finance.'}];
 const result=D.tracePublicBuyers(rows,'Sun Finance',{companyDomain:'sunfinance.group',collectAllCompanyContacts:true,includeIndexedCompanyContacts:true});assert.deepEqual(result.people.map(p=>p.name),["Eoin O'Connor",'Eva Post']);assert.ok(result.diagnostics.filter(p=>/posts|pulse/.test(p.url)).every(p=>p.accepted===false));
});
