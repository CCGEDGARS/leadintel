const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');

// Live, 26 Nov 2026 (a Danish steel company): one CEO was shown seven times. The register ("Administrerende direktør"),
// a LinkedIn headline on dk.linkedin.com ("CEO"), the same profile on www.linkedin.com and the official About page in
// two languages ("CEO") stayed separate: a country host made one profile two identities, the Danish and English
// executive titles were not read as one role, and each further record matched two earlier ones and became another.
// Invented people and company.
const organization='Fjord Staal A/S';
const person=(id,title,extra={})=>({id,name:'Rasmus Dal',publicName:'Rasmus Dal',title,organization,...extra});

test('one LinkedIn profile on a country host and on www is one person',()=>{
 const merged=D.mergeBuyerPool([person('a','CEO',{publicLinkedinUrl:'https://dk.linkedin.com/in/rasmus-dal-1'})],[person('b','CEO',{publicLinkedinUrl:'https://www.linkedin.com/in/Rasmus-Dal-1'})],{});
 assert.equal(merged.length,1,JSON.stringify(merged.map(p=>[p.id,p.publicLinkedinUrl])));
});

test('the register, a profile headline and the official page in two languages make one CEO',()=>{
 const records=[
  person('linkedin-dk','CEO',{publicLinkedinUrl:'https://dk.linkedin.com/in/rasmus-dal-1',companyContactSource:'public_identity'}),
  person('registry-1','Administrerende direktør',{publicLinkedinUrl:'https://www.linkedin.com/in/rasmus-dal-1',companyContactSource:'registry'}),
  person('official-da','CEO',{publicNameUrl:'https://fjord-staal.example/om-os/',companyContactSource:'official_staff'}),
  person('official-da','CEO',{publicNameUrl:'https://fjord-staal.example/om-os/',companyContactSource:'official_staff'}),
  person('registry-1','CEO',{publicNameUrl:'https://fjord-staal.example/en/about-us/',companyContactSource:'official_staff'})
 ];
 const merged=D.mergeBuyerPool([],records,{});
 assert.equal(merged.length,1,JSON.stringify(merged.map(p=>[p.id,p.title])));
});

test('namesakes in two different roles that do not lead the company stay two people',()=>{
 const merged=D.mergeBuyerPool([],[{id:'w',name:'Peter Holm',publicName:'Peter Holm',title:'Lagermedarbejder',organization},{id:'p',name:'Peter Holm',publicName:'Peter Holm',title:'Projektleder',organization}],{});
 assert.equal(merged.length,2);
});

test('two different LinkedIn profiles with one name stay two people',()=>{
 const merged=D.mergeBuyerPool([],[person('x','CEO',{publicLinkedinUrl:'https://www.linkedin.com/in/rasmus-dal-1'}),person('y','CEO',{publicLinkedinUrl:'https://www.linkedin.com/in/rasmus-dal-2'})],{});
 assert.equal(merged.length,2);
});

test('the same name at another company stays another person',()=>{
 const merged=D.mergeBuyerPool([],[person('x','CEO'),{...person('y','CEO'),organization:'Harbour Steel A/S'}],{});
 assert.equal(merged.length,2);
});
