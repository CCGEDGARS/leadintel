const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');
const candidate={company:'LKAB',domain:'lkab.com',market:'Sweden'},profile={decisionMakers:'Procurement Director; Project Manager'};
const pending={id:'apollo-anna',name:'Anna',firstName:'Anna',title:'Inköpschef',organization:'LKAB',identityStatus:'pending',kept:true};
const row=(name,company='LKAB',title='Inköpschef')=>({title:`${name} | ${title} | ${company}`,url:`https://linkedin.com/in/${name.toLowerCase().replace(/ /g,'-')}`});
test('pending Apollo identity resolves from a unique current employer/role public match and retains ID',async()=>{
 const queries=[];const result=await D.resolvePendingBuyerIdentities([pending],[],candidate,profile,async query=>{queries.push(query);return [row('Anna Andersson')];});
 assert.equal(queries.length,2);assert.ok(queries.every(q=>q.includes('Anna')&&q.includes('LKAB')));
 assert.equal(result.people[0].name,'Anna Andersson');assert.equal(result.people[0].id,'apollo-anna');assert.equal(result.people[0].identityStatus,'confirmed');assert.equal(result.people[0].kept,true);
 assert.equal(result.diagnostics[0].accepted,true);
});
test('ambiguous names, wrong employer and wrong role remain pending',async()=>{
 for(const rows of [[row('Anna Andersson'),row('Anna Lind')],[row('Anna Andersson','Other Company')],[row('Anna Andersson','LKAB','Marketing Manager')]]){
 const result=await D.resolvePendingBuyerIdentities([pending],[],candidate,profile,async()=>rows);assert.equal(result.people[0].identityStatus,'pending');assert.equal(result.diagnostics[0].accepted,false);
 }
});
test('a failed identity query keeps provider failure visible and does not confirm on partial evidence',async()=>{
 let count=0;const result=await D.resolvePendingBuyerIdentities([pending],[],candidate,profile,async()=>{if(++count===1)throw new Error('provider unavailable');return [row('Anna Andersson')];});
 assert.equal(result.people[0].identityStatus,'pending');assert.equal(result.issues.length,1);
});
test('duplicate directory identities cannot both acquire the same public name',async()=>{
 const result=await D.resolvePendingBuyerIdentities([pending,{...pending,id:'second'}],[],candidate,profile,async()=>[row('Anna Andersson')]);
 assert.ok(result.people.every(p=>p.identityStatus==='pending'));
});
test('confirmed public and directory identities deduplicate and retain kept state',()=>{
 const pool=D.mergeBuyerPool([{...pending,name:'Anna Andersson',identityStatus:'confirmed'}],[{id:'public-anna',name:'Anna Andersson',title:'Inköpschef',publicNameUrl:row('Anna Andersson').url,publicLinkedinUrl:row('Anna Andersson').url}],profile);
 assert.equal(pool.length,1);assert.equal(pool[0].id,'apollo-anna');assert.equal(pool[0].kept,true);
});
test('same full name with two distinct profile URLs stays ambiguous',async()=>{
 const result=await D.resolvePendingBuyerIdentities([pending],[],candidate,profile,async()=>[row('Anna Andersson'),{...row('Anna Andersson'),url:'https://linkedin.com/in/another-anna'}]);assert.equal(result.people[0].identityStatus,'pending');
});
test('legal seller resolves the configured legal role without industrial defaults',async()=>{
 const person={...pending,id:'legal',title:'General Counsel',organization:'Example Legal Buyer'};
 const result=await D.resolvePendingBuyerIdentities([person],[],{company:'Example Legal Buyer',domain:'legal.example'},{decisionMakers:'General Counsel'},async()=>[{title:'Anna Andersson | General Counsel | Example Legal Buyer',url:'https://legal.example/team/anna'}]);
 assert.equal(result.people[0].identityStatus,'confirmed');assert.equal(result.people[0].title,'General Counsel');
});
test('recommendations include relevant role families before repeated project roles',()=>{
 const people=[...Array.from({length:7},(_,i)=>({id:'project-'+i,name:`Project Person${i}`,title:'Project Director'})),{id:'procurement',name:'Anna Andersson',title:'Procurement Director'},{id:'engineering',name:'Engineer Person',title:'Engineering Director'}];
 const selected=D.recommendedBuyers(people,{decisionMakers:'Project Director; Procurement Director; Engineering Director'});
 assert.equal(selected.length,6);assert.ok(selected.some(p=>p.id==='procurement'));assert.ok(selected.some(p=>p.id==='engineering'));
});
test('confirmed user roles remain in opportunity plan even with many inferred roles',()=>{
 assert.ok(D.buyerResearchPlan({buyerFit:{purchase:'plant equipment installation expansion procurement production'}},{decisionMakers:'COO'}).roles.includes('COO'));
});
test('refresh with obfuscated directory identity preserves an already sourced full name',()=>{
 const old={...pending,name:'Anna Andersson',publicName:'Anna Andersson',publicNameUrl:row('Anna Andersson').url,identityStatus:'confirmed'};
 const pool=D.mergeBuyerPool([old],[pending],profile);assert.equal(pool.length,1);assert.equal(pool[0].name,'Anna Andersson');assert.equal(pool[0].identityStatus,'confirmed');assert.equal(pool[0].kept,true);
 assert.equal(D.recommendedBuyers([{...old,identityStatus:'pending'}],profile).length,0);
});
test('surname research uses local title aliases when the directory title is English',async()=>{
 const queries=[];await D.resolvePendingBuyerIdentities([{...pending,title:'Project Manager'}],[],candidate,profile,async query=>{queries.push(query);return [];});
 assert.ok(queries.every(query=>query.includes('Project Manager')&&query.includes('Projektledare')));
});
test('official contact-page body can resolve a name when the page title is generic',async()=>{
 const person={...pending,title:'Procurement Director'};
 const result=await D.resolvePendingBuyerIdentities([person],[],candidate,profile,async()=>[{title:'Contacts',url:'https://lkab.com/contact',markdown:'Anna Andersson — Procurement Director. LKAB contact details.'}]);
 assert.equal(result.people[0].name,'Anna Andersson');assert.equal(result.people[0].publicNameUrl,'https://lkab.com/contact');
 const former=await D.resolvePendingBuyerIdentities([person],[],candidate,profile,async()=>[{title:'Contacts',url:'https://lkab.com/contact',markdown:'Anna Andersson — former Procurement Director at LKAB.'}]);assert.equal(former.people[0].identityStatus,'pending');
});
