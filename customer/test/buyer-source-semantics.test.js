const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../company-dossier.js'),D=require('../discovery-engine.js');

const company={company:'Acme Labs',domain:'acme.example'},name='Alex Morgan';
const stamp=()=>new Date().toISOString();
const future=days=>new Date(Date.now()+days*86400000).toISOString().slice(0,10);

function sourcedDossier(claims){
 const plan=C.researchPlan(company);
 const passes=claims.map((claim,index)=>{
  const provider=['openai','gemini'][index],url=`https://acme.example/team/${provider}`;
  const quote=claim.quote||`${name} is ${claim.title} at Acme Labs.`;
  const validated=C.validatePass({provider,webSearch:true,people:[{name,title:claim.title,status:claim.status||'current',date:claim.date||'',sourceUrl:url,quote}]},[{url,text:quote}],company);
  assert.equal(validated.people.length,1,'Each provider claim has independently validated named source evidence');
  return {...validated,planSignature:plan.signature,searchFamilies:plan.families.map(f=>({name:f.name,kind:f.kind,query:(f.kind==='contacts'?'CONTACT ROUTES':'CURRENT LEADERSHIP AND PROJECT DOSSIER')+' for Acme Labs',status:'complete',attempts:1,completedAt:stamp(),results:[{url}]})),sourceReads:[{url,status:'succeeded',checkedAt:stamp()}],extractedSources:[url]};
 });
 return C.reconcile(passes,company);
}

for(const [left,right] of [
 ['Chief of Strategy, Procurement & Project Control','Chief of Strategy, Procurement and Project Control'],
 ['Head of Environment and Sustainability','Head of Environment & Sustainability'],
 ['Head of Logistics and Infrastructure','Head of Infrastructure & Logistics'],
 ['Head of Procurement and Project Control','Head of Project Control & Procurement']
])test(`equivalent source-backed responsibilities do not create a dossier conflict: ${left} / ${right}`,()=>{
 const dossier=sourcedDossier([{title:left},{title:right}]);
 assert.equal(dossier.status,'complete');
 assert.equal(dossier.people.length,1);assert.equal(dossier.conflicts.length,0);
 assert.notEqual(dossier.people[0].roleConflict,true);assert.equal(C.holdReason({name,title:left},dossier),'');
 const restored=C.safe(JSON.parse(JSON.stringify(dossier)),company.domain);
 assert.equal(restored.status,'complete');assert.equal(restored.conflicts.length,0);
 assert.equal(C.holdReason({name,title:left},restored),'','Save/reload cannot restore the false conflict');
 assert.deepEqual(new Set(restored.people[0].providers),new Set(['openai','gemini']));
});

for(const [left,right] of [
 ['Chief Executive Officer','Chief Operating Officer'],
 ['Head of Procurement and Engineering','Head of Procurement and Operations']
])test(`genuinely different current responsibilities remain held: ${left} / ${right}`,()=>{
 const dossier=sourcedDossier([{title:left},{title:right}]);
 assert.ok(dossier.conflicts.length);assert.equal(dossier.people[0].roleConflict,true);
 assert.match(C.holdReason({name,title:left},dossier),/conflict/i);
 const restored=C.safe(JSON.parse(JSON.stringify(dossier)),company.domain);
 assert.match(C.holdReason({name,title:left},restored),/conflict/i);
});

test('future incoming roles and conflicting future departure dates remain held',()=>{
 const date=future(30),later=future(60),title='Chief Executive Officer';
 const incoming=sourcedDossier(['openai','gemini'].map(()=>({title,status:'incoming',date,quote:`${name} will become ${title} at Acme Labs on ${date}.`})));
 assert.match(C.holdReason({name,title},incoming),/employment status/i);assert.equal(C.buyers(incoming,company.company).length,0);
 const departure=d=>({title,status:'departed',date:d,quote:`${name} is ${title} at Acme Labs and will leave on ${d}.`});
 const consistent=sourcedDossier([departure(date),departure(date)]);
 assert.equal(C.holdReason({name,title},consistent),'','A supported future departure does not prematurely remove the incumbent');
 assert.equal(C.buyers(consistent,company.company).length,1);
 const conflicting=sourcedDossier([departure(date),departure(later)]);
 assert.match(C.holdReason({name,title},conflicting),/conflict/i,'Different effective departure dates cannot be collapsed as a title alias');
});

function agentIdentity(title,body){
 const person={id:'alex',name,publicName:name,title,organization:company.company,publicNameUrl:'https://acme.example/team',identityStatus:'confirmed',nameVerification:'confirmed',contactResearch:{checks:{buyer_agent:{status:'complete'}}}};
 const candidate={...company,buyerRoles:[title],people:[person]};
 return D.assessBuyerAgent(candidate,[{url:person.publicNameUrl,markdown:body,sourceRead:true,extractedAt:stamp()}],{domain:company.domain,company:company.company,seller:'{}',briefKey:'source-semantics-fixture',facts:[],trigger:null,gaps:[]}).people[0];
}

test('a current official role is not contradicted by the same biography describing a previous employer',()=>{
 const row=agentIdentity('Head of Project Office',`# Acme Labs leadership\n## ${name}\nHead of Project Office at Acme Labs\nPreviously, she was a manager at Other Company.`);
 assert.equal(row.identity,'supported');assert.deepEqual(row.conflicts,[]);assert.ok(row.evidence.length);
});

test('a table distinguishing a former chair role from the current CEO supports the current role',()=>{
 const row=agentIdentity('Chief Executive Officer',`# Acme Labs governance\n| Role | Name |\n| Former Executive Chairman, now CEO | ${name} |`);
 assert.equal(row.identity,'supported');assert.deepEqual(row.conflicts,[]);assert.ok(row.evidence.length);
});

for(const body of [
 `## ${name}\nFormer Chief Executive Officer at Acme Labs.`,
 `## ${name}\n${name} is no longer Chief Executive Officer at Acme Labs.`,
 `## ${name}\nChief Executive Officer. Current employer: Other Company.`
])test(`actual current-employer or former-role conflicts remain held: ${body.split('\n').at(-1)}`,()=>{
 const row=agentIdentity('Chief Executive Officer',body);
 assert.equal(row.identity,'conflict');assert.ok(row.conflicts.length);
});

const profile={decisionMakers:'project engineer and quality lead. Operational owner: plant'};
function retainedPerson(id,personName,title){
 const linkedin=`https://www.linkedin.com/in/${id}`;
 return {id,name:personName,publicName:personName,title,organization:company.company,publicNameUrl:'https://acme.example/team',identityStatus:'confirmed',nameVerification:'confirmed',identitySource:'public',publicLinkedinUrl:linkedin,linkedin_url:linkedin,linkedinConfirmedUrl:linkedin,linkedinConfirmationMethod:'automatic',linkedinConfirmedAt:stamp(),linkedinIdentityEvidence:{url:linkedin,name:personName,organization:company.company,checkedAt:stamp()}};
}

test('source-backed known identities and exact LinkedIn evidence survive equivalent dossier title variants even while qualification needs reassessment',()=>{
 const previous=[retainedPerson('retained-1',name,'Head of Environment and Sustainability'),retainedPerson('retained-2','Jamie Carter','Head of Logistics and Infrastructure')];
 const incoming=previous.map((p,index)=>({id:'dossier-'+index,name:p.name,publicName:p.name,title:['Head of Environment & Sustainability','Head of Infrastructure & Logistics'][index],organization:company.company,publicNameUrl:p.publicNameUrl,identityStatus:'confirmed',nameVerification:'confirmed',identitySource:'public'}));
 const merged=D.mergeBuyerPool(previous,[...previous,...incoming],profile);
 for(const original of previous){
  const saved=merged.find(p=>p.id===original.id);
  assert.ok(saved,'A wording change cannot silently delete a retained full identity');
  assert.equal(saved.publicNameUrl,original.publicNameUrl);assert.equal(saved.publicLinkedinUrl,original.publicLinkedinUrl);
  assert.equal(saved.linkedinConfirmedUrl,original.linkedinConfirmedUrl);assert.deepEqual(saved.linkedinIdentityEvidence,original.linkedinIdentityEvidence);
 }
});

test('a conjunction alone cannot establish a requested buying function or qualify an unrelated role',()=>{
 const unrelated=retainedPerson('unrelated','Taylor Brown','Unrelated and Fictional');
 assert.equal(D.selectDecisionMakers([unrelated],profile,20).length,0,'The word and is not buying-function evidence');
 const qualification=D.qualifyBuyer(unrelated,profile,company);
 assert.equal(qualification.eligible,false);assert.ok(qualification.gaps.includes('Required role not matched'));
});

for(const body of [
 `${name} previously served as CEO.`,
 `${name} is no longer serving as CEO.`,
 `${name} retired as CEO.`,
 `${name} was previously a CEO.`,
 `Former Executive Chairman, now CEO at Other Company | ${name}`,
 `${name} formerly CEO at Acme Labs, now CEO at Other Company.`,
 `${name} is currently CEO at Other Company.`
])test(`employment history and current role at another employer cannot support the target CEO: ${body}`,()=>{
 const row=agentIdentity('Chief Executive Officer',body);
 assert.equal(row.identity,'conflict');assert.ok(row.conflicts.length);
});

function savedConflict(source,field='conflicts'){
 const person={id:'alex',name,publicName:name,title:'Head of Project Office',organization:company.company,publicNameUrl:'https://acme.example/team',identityStatus:'confirmed',nameVerification:'confirmed',contactResearch:{checks:{buyer_agent:{status:'complete'}}}};
 const candidate={...company,buyerRoles:[person.title],people:[person],publicResearch:{aiReview:{status:'complete',checkedAt:stamp()},buyerAgent:{version:D.BUYER_AGENT_VERSION,status:'needs_review',checkedAt:stamp(),context:{domain:company.domain,company:company.company,facts:[],gaps:[]},people:[{personId:person.id,name,identity:'conflict',opportunity:'supported',checks:'complete',evidence:[],conflicts:[],[field]:[source]}]}}};
 candidate.publicResearch.buyerAgent.inputSignature=D.buyerReviewSignature(candidate);
 return candidate;
}
const currentRoleQuote=`${name} is Head of Project Office at Acme Labs. Previously, she was a manager at Other Company.`;

test('only a trusted saved read passage may repair a derived Agent conflict without inventing fresh execution',()=>{
 const candidate=savedConflict({url:'https://acme.example/team',quote:currentRoleQuote}),before=JSON.stringify(candidate);
 assert.equal(D.reconcileBuyerEvidence(candidate).publicResearch.buyerAgent.people[0].identity,'conflict','A generic client projection cannot assert server-read authority');
 const repaired=D.reconcileBuyerEvidence(candidate,{trustedAgentSources:true});
 assert.equal(repaired.publicResearch.buyerAgent.people[0].identity,'supported');
 assert.equal(repaired.publicResearch.buyerAgent.checkedAt,candidate.publicResearch.buyerAgent.checkedAt);
 assert.deepEqual(repaired.people[0].contactResearch,candidate.people[0].contactResearch);
 assert.deepEqual(repaired.publicResearch.aiReview,candidate.publicResearch.aiReview);
 assert.equal(JSON.stringify(candidate),before,'Read-only projection cannot mutate its saved input');
});

for(const provenance of [{sourceRead:false},{evidenceKind:'model_summary',sourceRead:false},{evidenceKind:'search_snippet'},{evidenceKind:'snippet'},{evidenceKind:'search_excerpt'}])for(const field of ['evidence','conflicts'])test(`explicit non-read ${JSON.stringify(provenance)} in saved Agent ${field} cannot become read evidence after serialization`,()=>{
 const candidate=savedConflict({url:'https://acme.example/team',quote:currentRoleQuote,...provenance},field);
 const agent=D.safeBuyerAgent(JSON.parse(JSON.stringify(candidate.publicResearch.buyerAgent)),candidate.domain);
 for(const [key,value] of Object.entries(provenance))assert.equal(agent.people[0][field][0][key],value,'Sanitization must retain negative source provenance');
 const restored={...candidate,publicResearch:{...candidate.publicResearch,buyerAgent:agent}};
 restored.publicResearch.buyerAgent.inputSignature=D.buyerReviewSignature(restored);
 const result=D.reconcileBuyerEvidence(restored,{trustedAgentSources:true});
 assert.equal(result.publicResearch.buyerAgent.people[0].identity,'conflict');
 assert.equal(result.publicResearch.buyerAgent.status,'needs_review');
});
