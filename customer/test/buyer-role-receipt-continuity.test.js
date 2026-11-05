const test=require('node:test'),assert=require('node:assert/strict');
const D=require('../discovery-engine.js'),C=require('../company-dossier.js');
const stamp=()=>new Date().toISOString();
function fixture(){
 const person={id:'buyer-1',name:'Alex Morgan',title:'Head of Procurement',organization:'Example Works',publicNameUrl:'https://example.com/team'};
 const candidate={company:'Example Works',domain:'example.com',people:[person]};
 require('./helpers/buyer-research-receipts.cjs')(candidate,stamp());
 return {candidate,person};
}
for(const title of ['Inköpschef','Procurement Director'])test('equivalent role '+title+' preserves actual free-check receipts through serialization and resume',async()=>{
 const {candidate,person}=fixture();person.title=title;
 const restored=JSON.parse(JSON.stringify(candidate));
 for(const channel of ['phone','gmail','direct_email','official','public'])assert.equal(D.buyerResearchCheckPassed(restored,restored.people[0],channel),true,channel);
});
for(const mutation of [{title:'Finance Director'},{organization:'Another Employer'},{name:'Another Person'},{publicLinkedinUrl:'https://www.linkedin.com/in/another-person'}])test('real identity change invalidates retained research '+JSON.stringify(mutation),()=>{
 const {candidate,person}=fixture();Object.assign(person,mutation);
 assert.equal(D.buyerResearchCheckPassed(candidate,person,'phone'),false);assert.equal(D.buyerResearchCheckPassed(candidate,person,'gmail'),false);
});
test('translated procurement titles reconcile with literal sources and clear only the obsolete equivalent-title conflict',()=>{
 const company={company:'Example Works',domain:'example.com'},name='Alex Morgan';
 const passes=['Head of Procurement','Inköpschef'].map((title,i)=>{
  const sourceUrl='https://example.com/team/'+i,quote=name+(i?' är ':' is ')+title+(i?' på ':' at ')+'Example Works.';
  return C.validatePass({provider:i?'anthropic':'openai',webSearch:true,people:[{name,title,status:'current',sourceUrl,quote}]},[{url:sourceUrl,text:quote}],company);
 });
 assert.deepEqual(passes.map(p=>p.people.length),[1,1]);
 const dossier=C.reconcile(passes,company);
 assert.equal(dossier.conflicts.length,0);
 dossier.conflicts=[{name,reason:'Different role or employment status in source-backed research',sources:passes.flatMap(p=>p.sources),titles:['Head of Procurement','Inköpschef']}];
 const saved=C.safe(JSON.parse(JSON.stringify(dossier)),company.domain);
 assert.equal(C.holdReason({name},saved),'');
 assert.equal(C.resolveBuyerRoleHold({name,title:'Head of Procurement',opportunityScope:{status:'review_required',reason:'Dossier role conflict requires review'}},saved).opportunityScope,null);
 const departed=JSON.parse(JSON.stringify(dossier));departed.passes[1].people[0].status='departed';
 assert.notEqual(C.holdReason({name},C.safe(departed,company.domain)),'');
});

test('four retained buyers resume missing Gmail work without resetting translated-role phone and email receipts',async()=>{
 const {candidate}=fixture();candidate.people=['Alex Morgan','Jordan Blake','Casey Taylor','Robin Cooper'].map((name,i)=>({...candidate.people[0],id:'buyer-'+i,name}));
 require('./helpers/buyer-research-receipts.cjs')(candidate,stamp());
 candidate.people[0].title='Inköpschef';delete candidate.people[3].contactResearch.checks.gmail;
 const queries=[];await D.runMandatoryBuyerResearch(candidate,{search:async query=>{queries.push(query);return [];}});
 for(const person of candidate.people)for(const channel of ['phone','gmail','direct_email'])assert.equal(D.buyerResearchCheckPassed(candidate,person,channel),true,person.name+' '+channel);
 assert.ok(queries.some(q=>q.includes('Robin Cooper')&&q.includes('gmail')));
 for(const person of candidate.people.slice(0,3))assert.equal(queries.some(q=>q.includes(person.name)&&q.includes('gmail')),false,'no repeat of completed Gmail queries');
 const reopened=JSON.parse(JSON.stringify(candidate));
 for(const person of reopened.people)assert.equal(D.buyerResearchCheckPassed(reopened,person,'gmail'),true);
});

test('receipt recovery accepts a translated title but not a changed employer or another buyer',()=>{
 const {candidate,person}=fixture(),saved=JSON.parse(JSON.stringify(person));delete person.contactResearch;person.title='Inköpschef';
 assert.equal(D.restoreBuyerResearchReceipts(candidate,[saved]),true);
 assert.equal(D.buyerResearchCheckPassed(candidate,person,'gmail'),true);
 const other=JSON.parse(JSON.stringify(candidate));other.people[0].organization='Other Works';delete other.people[0].contactResearch;
 assert.equal(D.restoreBuyerResearchReceipts(other,[saved]),false);
});
