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

// Live, 26 Nov 2026 (two control companies): one person printed as "Søren V. Andersen" on the contact page and
// "Søren Vestergaard Andersen" in the register, or "Kasper Nohns" on a profile and "Kasper Vedam Nohns" on the
// contact page, was shown twice. Invented people.
const at=(id,name,title,extra={})=>({id,name,publicName:name,title,organization,...extra});
test('a middle initial or a missing middle name is one person in a compatible role',()=>{
 assert.equal(D.mergeBuyerPool([],[at('a','Bent V. Mørk','Direktør - Salg - Adm'),at('b','Bent Vestergaard Mørk','Direktør')],{}).length,1);
 assert.equal(D.mergeBuyerPool([],[at('c','Ivar Nohn','Technical Manager Electronic',{publicLinkedinUrl:'https://www.linkedin.com/in/ivar-nohn-1'}),at('d','Ivar Vedel Nohn','Technical Manager Steering')],{}).length,1);
 assert.equal(D.mergeBuyerPool([],[at('e','Boerge Mørk','Manager / Owner'),at('f','Børge Vestergaard Mørk','Direktør')],{}).length,1,'a transliterated letter (oe = ø) is the same name');
 // Live order: the register's "Direktør" and a profile's "Owner" merge first, then the contact page's variant arrives.
 assert.equal(D.mergeBuyerPool([],[at('o','Bent Vestergaard Mørk','Direktør'),at('p','Bent Vestergaard Mørk','Owner'),at('q','Bent V. Mørk','Direktør - Salg - Adm')],{}).length,1);
});

test('name variants in unrelated roles, with another first name or another profile stay apart',()=>{
 assert.equal(D.mergeBuyerPool([],[at('g','Bent Mørk','Lagermedarbejder'),at('h','Bent V. Mørk','Salgschef')],{}).length,2);
 assert.equal(D.mergeBuyerPool([],[at('i','Kim Lund','Warehouse Manager'),at('j','Kim L. Lund','Sales Manager')],{}).length,2);
 assert.equal(D.mergeBuyerPool([],[at('k','Bent Mørk','Direktør'),at('l','Jens Mørk','Direktør')],{}).length,2);
 assert.equal(D.mergeBuyerPool([],[at('m','Bent Mørk','Direktør',{publicLinkedinUrl:'https://www.linkedin.com/in/bent-1'}),at('n','Bent V. Mørk','Direktør',{publicLinkedinUrl:'https://www.linkedin.com/in/bent-2'})],{}).length,2);
});

test('the same name at another company stays another person',()=>{
 const merged=D.mergeBuyerPool([],[person('x','CEO'),{...person('y','CEO'),organization:'Harbour Steel A/S'}],{});
 assert.equal(merged.length,2);
});
