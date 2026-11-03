const test=require('node:test'),assert=require('node:assert/strict');
const {requestInput,createClient}=require('../buyer-research-jobs.js');
const largeSnapshot=require('./fixtures/buyer-large-snapshot.cjs');
function owner(){return largeSnapshot({company:'Example',domain:'example.com',website:'https://example.com/',buyerRoles:['Head of Procurement'],buyerRolesChanged:true,buyerSearchMode:'user_selected_target',people:Array.from({length:10},(_,i)=>({id:'person-'+i,name:['Alex Berg','Bella Lind','Carl Holm','Diana Lund','Erik Dahl','Frida West','Gustav North','Hanna East','Ingrid South','Johan Lake'][i],title:'Head of Procurement',organization:'Example',publicNameUrl:'https://example.com/team'}))});}
test('Refresh transports identity and context without copying a large retained research history',()=>{
 const c=owner(),before=JSON.stringify(c);assert.ok(Buffer.byteLength(before)>1000000);
 const body=requestInput(c,{priorityOffers:'Industrial automation',idealCustomer:'Manufacturers',targetMarkets:'Sweden',website:'https://seller.example/',description:'Saved seller source material. '.repeat(2000)});
 assert.ok(Buffer.byteLength(JSON.stringify(body))<64000,'the control request must remain small even when retained research exceeds one megabyte');assert.equal(body.candidate.people.length,10);assert.equal(body.candidate.people[9].id,'person-9');assert.equal(body.candidate.people[9].publicNameUrl,'https://example.com/team');assert.equal(body.candidate.buyerRolesChanged,true);assert.equal(body.profile.priorityOffers,'Industrial automation');
 assert.ok(!JSON.stringify(body).includes('Retained source extraction receipt'));assert.ok(!JSON.stringify(body).includes('Saved source context and read diagnostics'));assert.equal(JSON.stringify(c),before,'building a research command cannot discard saved evidence');
});
test('resuming a matching incomplete job uses its revision and leaves the large snapshot out of the command',async()=>{
 const c=owner(),evidence=JSON.stringify(c.buyerDiscovery.companyContacts),calls=[],bridge={workspace:{id:'workspace'},session:{authenticated:true,user:{id:'owner'}}},job={id:'job-existing',domain:c.domain,revision:7,status:'needs_review',resumePhase:'official',phase:'official',candidate:structuredClone(c),input:{scope:'all_buyers',personIds:[]}};
 const client=createClient({getBridge:()=>bridge,fetchImpl:async(url,init)=>{calls.push({method:init.method,body:init.body&&JSON.parse(init.body)});return Response.json({job:init.method==='POST'?{...job,status:'canceled',revision:8}:job});}});
 await client.research(c,{force:true,resumeIncomplete:true});const command=calls.find(row=>row.method==='POST').body;
 assert.equal(command.action,'resume');assert.equal(command.jobId,'job-existing');assert.equal(command.expectedRevision,7);assert.equal(command.candidate,undefined);assert.equal(command.profile,undefined);assert.ok(Buffer.byteLength(JSON.stringify(command))<1000);assert.equal(JSON.stringify(c.buyerDiscovery.companyContacts),evidence);
});
test('compact identity inputs retain sourced decision authority and unresolved role holds',()=>{
 const c=owner(),p=c.people[0],quote='Alex Berg has full authority for the project delivery area and reports directly to the CEO.';p.title='Area Director';p.decisionEvidence=[{url:'https://example.com/team',quote,date:new Date().toISOString()}];p.roleReview={version:1,status:'conflict',reason:'Current employer needs review'};
 const body=requestInput(c,{});assert.equal(body.candidate.people[0].decisionEvidence?.[0].quote,quote);assert.equal(body.candidate.people[0].roleReview.status,'conflict');assert.equal(body.candidate.people[0].roleReview.reason,'Current employer needs review');
});
