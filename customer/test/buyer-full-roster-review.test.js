const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js');
test('shared evidence cap preserves a source for each person and prefers the fully read page',()=>{
 const people=Array.from({length:10},(_,i)=>({id:'p'+i,name:'Ada Buyer'+i,publicNameUrl:'https://example.com/person-'+i}));
 const rows=[...Array.from({length:40},(_,i)=>({url:'https://example.com/noise-'+i,markdown:'Generic company background'})),...people.map(p=>({url:p.publicNameUrl,markdown:p.name+' appears here'}))];
 rows.push({url:people[9].publicNameUrl,markdown:'Ada Buyer9 current role is different',sourceRead:true});
 const selected=D.buyerReviewEvidence(people,rows,28);
 assert.ok(selected.length<=28);for(const person of people)assert.ok(selected.some(row=>row.url===person.publicNameUrl));
 assert.ok(selected.find(row=>row.url===people[9].publicNameUrl).sourceRead);
});
test('review evidence covers every retained person before generic company context',async()=>{
 const {contactReviewInput,parseContactReview}=await import('../../backend/src/contact-evidence-review.js');
 const people=Array.from({length:10},(_,i)=>({id:'p'+i,name:'Ada Buyer'+i,title:'Director',publicNameUrl:'https://example.com/person-'+i}));
 const rows=[...Array.from({length:40},(_,i)=>({url:'https://example.com/noise-'+i,markdown:'Generic company background'})),...people.map(p=>({url:p.publicNameUrl,markdown:p.name+' currently holds a different role'}))];
 let sent;const context={LeadIntelDiscovery:D,DISCOVERY_REQUEST_TIMEOUT_MS:25,crmAuthenticated:()=>true,bridge:()=>({workspace:{id:'w1'}}),LEADINTEL_API:'https://api.example',fetchBuyerResearch:async(url,options)=>{
  sent=contactReviewInput(JSON.parse(options.body));
  return {ok:true,json:async()=>parseContactReview(JSON.stringify({conflicts:[{person_id:'p7',reason:'Current role differs'}]}),sent)};
 }};
 vm.createContext(context);const source=fs.readFileSync(require('node:path').join(__dirname,'../discovery-ui.js'),'utf8');
 vm.runInContext(source.slice(source.indexOf('async function reviewBuyerPublicEvidence('),source.indexOf('async function runPublicProspectContacts('))+'\nthis.review=reviewBuyerPublicEvidence;',context);
 const result=await context.review({company:'Example',people},rows,new AbortController().signal);
 assert.equal(sent.people.length,10);for(const person of people)assert.ok(sent.evidence.some(e=>e.excerpt.includes(person.name)),person.name);
 assert.ok(result.conflicts.some(p=>p.person_id==='p7'));
});
test('a shared long staff directory supplies the actual passage for every person including the last six',async()=>{
 const {contactReviewInput,parseContactReview}=await import('../../backend/src/contact-evidence-review.js');
 const people=Array.from({length:10},(_,i)=>({id:'p'+i,name:'Ada Buyer'+i,title:'Director',publicNameUrl:'https://example.com/team'}));
 const rows=[{url:'https://example.com/team',markdown:people.map(p=>p.name+': current role differs. '+'Public biography details. '.repeat(70)).join('\n\n'),sourceRead:true}];
 let sent;const context={LeadIntelDiscovery:D,DISCOVERY_REQUEST_TIMEOUT_MS:25,crmAuthenticated:()=>true,bridge:()=>({workspace:{id:'w1'}}),LEADINTEL_API:'https://api.example',fetchBuyerResearch:async(url,options)=>{
  sent=contactReviewInput(JSON.parse(options.body));
  return {ok:true,json:async()=>parseContactReview(JSON.stringify({conflicts:[{person_id:'p7',reason:'Current role differs'}]}),sent)};
 }};
 vm.createContext(context);const source=fs.readFileSync(require('node:path').join(__dirname,'../discovery-ui.js'),'utf8');
 vm.runInContext(source.slice(source.indexOf('async function reviewBuyerPublicEvidence('),source.indexOf('async function runPublicProspectContacts('))+'\nthis.review=reviewBuyerPublicEvidence;',context);
 const result=await context.review({company:'Example',people},rows,new AbortController().signal);
 for(const person of people)assert.ok(sent.evidence.some(e=>e.excerpt.includes(person.name+': current role differs.')),person.id);
 assert.ok(result.conflicts.some(p=>p.person_id==='p7'));
});
