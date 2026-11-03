const test=require('node:test'),assert=require('node:assert/strict'),D=require('../discovery-engine.js');

for(const sourceState of ['unread','failed','confirmed'])test(`mandatory email escalation uses accepted source evidence rather than a raw official address: ${sourceState}`,async()=>{
 const company={company:'Acme Labs',domain:'acme.example',buyerRoles:['Procurement Director']},url='https://acme.example/team',email='alex.morgan@acme.example',checkedAt=new Date().toISOString();
 const person={id:'alex',name:'Alex Morgan',publicName:'Alex Morgan',title:'Procurement Director',organization:company.company,identityStatus:'confirmed',nameVerification:'confirmed',publicNameUrl:url,publicEmail:email,publicEmailUrl:url,publicEmailEvidence:{version:2,url,quote:`Alex Morgan Procurement Director ${email} Acme Labs`,sourceKind:'official',sourceRead:sourceState!=='unread',checkedAt},...(sourceState==='failed'?{publicEmailSourceCheck:{version:2,status:'failed',email,url,checkedAt,reason:'The source no longer attributes this address'}}:{})};
 const candidate={...company,people:[person]},confirmed=sourceState==='confirmed',queries=[],reads=[],deep=D.buyerDeepContactQueries(candidate,person),baseCount=D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks.reduce((total,key)=>total+D.buyerResearchQueryPlan(candidate,person)[key].length,0);
 assert.equal(D.acceptedOfficialBuyerEmail(candidate,person),confirmed?email:'');assert.equal(deep.length,2,'The existing two-query escalation plan remains unchanged');
 const report=await D.runMandatoryBuyerResearch(candidate,{search:async query=>{queries.push(query);return [];},readPage:async source=>{reads.push(source);return {url:source,markdown:`### Alex Morgan\nProcurement Director\nAcme Labs${confirmed?'\n'+email:''}`,metadata:{sourceURL:source,source:'direct-fallback'}};}});
 assert.deepEqual(reads,[url],'The fixture actually reads the saved source once');
 assert.equal(queries.length,baseCount+(confirmed?0:2));
 for(const query of deep)assert.equal(queries.filter(value=>value===query).length,confirmed?0:1,'Only an accepted named read source can suppress mandatory deeper email discovery');
 assert.equal(person.contactResearch.checks.deep.status,confirmed?'not_needed':'complete');assert.equal(report.deepPeople,confirmed?0:1);
 assert.equal(D.acceptedOfficialBuyerEmail(candidate,person),confirmed?email:'');assert.equal(D.confirmedBuyerContactData(candidate,person).email,confirmed?email:'','Completed searches cannot confirm an unread or rejected email candidate');
 const legacy=structuredClone(candidate);legacy.people[0].contactResearch.checks.deep={status:'not_needed',checkedAt:new Date().toISOString(),attempts:0,queryLog:[],reason:'Published company email already found'};legacy.people[0].emailResearch.searches=baseCount;
 assert.equal(D.buyerResearchCoveragePassed(legacy),confirmed,'A saved no-deep checkpoint is complete only when its email source is actually accepted');
});
