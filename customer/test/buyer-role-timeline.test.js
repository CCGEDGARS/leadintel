const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../company-dossier.js');
const company={company:'Acme Labs',domain:'acme.example'},name='Alex Morgan',title='Chief of Strategy, Procurement and Project Control';
const iso=days=>new Date(Date.now()+days*86400000).toISOString().slice(0,10),stamp=()=>new Date().toISOString();

function dossierFor(groups){
 const plan=C.researchPlan(company);
 const passes=groups.map((claims,index)=>{
  const provider=['openai','anthropic','gemini'][index],people=claims.map(row=>({name,title,status:'current',...row}));
  const pages=[...new Set(people.map(row=>row.sourceUrl))].map(url=>({url,text:people.filter(row=>row.sourceUrl===url).map(row=>row.quote).join('\n')}));
  const validated=C.validatePass({provider,webSearch:true,people},pages,company);
  assert.equal(validated.people.length,people.length,'Every fixture claim must pass named literal source validation');
  return {...validated,planSignature:plan.signature,searchFamilies:plan.families.map(family=>({name:family.name,kind:family.kind,query:(family.kind==='contacts'?'CONTACT ROUTES':'CURRENT LEADERSHIP AND PROJECT DOSSIER')+' for '+company.company,status:'complete',attempts:1,completedAt:stamp(),results:pages.map(row=>({url:row.url}))})),sourceReads:pages.map(row=>({url:row.url,status:'succeeded',checkedAt:stamp()})),extractedSources:pages.map(row=>row.url)};
 });
 return C.reconcile(passes,company);
}
function heldPerson(){return {id:'alex',name,publicName:name,title,organization:company.company,opportunityScope:{status:'review_required',reason:'Dossier role conflict requires review',checkedAt:stamp()}};}
function officialEffective(date=iso(-30)){return {date,sourceUrl:'https://acme.example/news/effective-role',quote:`${name} is ${title} at Acme Labs effective ${date}.`};}
function officialRoster(){return {sourceUrl:'https://acme.example/team',quote:`${name} is ${title} at Acme Labs.`};}
function incoming(extra={}){return {status:'incoming',date:'',sourceUrl:'https://industry.example/appointment',quote:`${name} will become ${title} at Acme Labs.`,...extra};}
function timeline({effective=officialEffective(),roster=officialRoster(),appointment=incoming()}={}){return dossierFor([[effective],[roster],[appointment]]);}
function restored(value){return C.safe(JSON.parse(JSON.stringify(value)),company.domain);}

for(const alias of ['vd','VD','verkställande direktör'])test(`Swedish CEO label ${alias} is equivalent to a current Chief Executive Officer through save/reload`,()=>{
 const dossier=dossierFor([[{title:'Chief Executive Officer',sourceUrl:'https://acme.example/team/en',quote:`${name} is Chief Executive Officer at Acme Labs.`}],[{title:alias,sourceUrl:'https://acme.example/team/sv',quote:`${name} är ${alias} på Acme Labs.`}]]);
 assert.equal(C.roleKey(alias),C.roleKey('Chief Executive Officer'));
 for(const value of [dossier,restored(dossier)]){
  assert.equal(value.conflicts.length,0);assert.equal(C.holdReason({name,title:'Chief Executive Officer'},value),'');
  assert.equal(C.resolveBuyerRoleHold({...heldPerson(),title:'Chief Executive Officer'},value).opportunityScope,null);
 }
});

test('a deputy Swedish CEO remains a different current role',()=>{
 const dossier=dossierFor([[{title:'Chief Executive Officer',sourceUrl:'https://acme.example/team/en',quote:`${name} is Chief Executive Officer at Acme Labs.`}],[{title:'vice vd',sourceUrl:'https://acme.example/team/sv',quote:`${name} är vice vd på Acme Labs.`}]]);
 assert.notEqual(C.roleKey('vice vd'),C.roleKey('Chief Executive Officer'));
 for(const value of [dossier,restored(dossier)])assert.match(C.holdReason({name,title:'Chief Executive Officer'},value),/conflict/i);
});

test('a validated effective official appointment plus a separate current official roster supersedes only an undated incoming status',()=>{
 const dossier=timeline(),original=JSON.stringify(dossier.passes);
 for(const value of [dossier,restored(dossier),restored(restored(dossier))]){
  assert.equal(value.status,'complete');assert.equal(value.conflicts.length,0);assert.equal(value.people[0].status,'current');
  assert.equal(C.holdReason({name,title},value),'');assert.equal(C.resolveBuyerRoleHold(heldPerson(),value).opportunityScope,null);
  const savedIncoming=value.passes.find(pass=>pass.provider==='gemini').people[0];
  assert.equal(savedIncoming.status,'incoming');assert.equal(savedIncoming.date,'');assert.equal(savedIncoming.sourceUrl,incoming().sourceUrl);assert.equal(savedIncoming.quote,incoming().quote,'Supersession retains the original appointment evidence');
 }
 assert.equal(JSON.stringify(dossier.passes),original,'Projection cannot rewrite the independent provider extraction');
});

test('reload removes the old aggregate incoming/current conflict only after the official timeline is established',()=>{
 const dossier=timeline();dossier.conflicts=[{name,reason:'Different role or employment status in source-backed research',sources:[officialEffective().sourceUrl,incoming().sourceUrl],titles:[title,title]}];
 const value=restored(dossier);
 assert.equal(value.conflicts.length,0);assert.equal(C.resolveBuyerRoleHold(heldPerson(),value).opportunityScope,null);
 assert.equal(value.passes.find(pass=>pass.provider==='gemini').people[0].status,'incoming');
});

test('a literal supported appointment date that has already passed reconciles with the same current official role without rewriting its recorded status',()=>{
 const date=iso(-30),appointment=incoming({date,quote:`${name} will become ${title} at Acme Labs on ${date}.`});
 const dossier=dossierFor([[officialEffective(date)],[appointment]]);
 for(const value of [dossier,restored(dossier),restored(restored(dossier))]){
  assert.equal(value.conflicts.length,0);assert.equal(value.people[0].status,'current');assert.equal(C.holdReason({name,title},value),'');
  assert.equal(C.resolveBuyerRoleHold(heldPerson(),value).opportunityScope,null);
  const source=value.passes[1].people[0];assert.equal(source.status,'incoming');assert.equal(source.date,date);assert.equal(source.quote,appointment.quote);
  const assignment=value.assignments.find(row=>row.sourceUrl===appointment.sourceUrl);assert.equal(assignment.status,'incoming');assert.equal(assignment.date,date);
 }
});

test('two providers retain dated and undated incoming duplicates as history after an effective official appointment and official roster corroborate the current role',()=>{
 const date=iso(-30),dated=incoming({date,sourceUrl:'https://industry.example/dated-appointment',quote:`${name} will become ${title} at Acme Labs on ${date}.`}),undated=incoming();
 const dossier=dossierFor([[officialEffective(date),officialRoster()],[dated,undated]]);
 for(const value of [dossier,restored(dossier),restored(restored(dossier))]){
  assert.equal(value.conflicts.length,0);assert.equal(value.people[0].status,'current');assert.equal(C.resolveBuyerRoleHold(heldPerson(),value).opportunityScope,null);
  assert.deepEqual(value.passes[1].people.map(row=>[row.status,row.date,row.sourceUrl]),[['incoming',date,dated.sourceUrl],['incoming','',undated.sourceUrl]]);
 }
});

const unresolved=[
 ['no literal effective date',{effective:{...officialEffective(),date:'',quote:`${name} is ${title} at Acme Labs.`}}],
 ['claimed date absent from the literal source',{effective:{...officialEffective(),quote:`${name} is ${title} at Acme Labs.`}}],
 ['dated appointment is third party',{effective:{...officialEffective(),sourceUrl:'https://industry.example/current-role'}}],
 ['current roster is third party',{roster:{...officialRoster(),sourceUrl:'https://industry.example/roster'}}],
 ['both official claims come from the same article',{roster:{...officialRoster(),sourceUrl:officialEffective().sourceUrl}}],
 ['official effective date is still future',{effective:officialEffective(iso(30))}],
 ['incoming date is explicitly future',{appointment:incoming({date:iso(30),quote:`${name} will become ${title} at Acme Labs on ${iso(30)}.`})}],
 ['incoming role genuinely differs',{appointment:incoming({title:'Chief Operating Officer',quote:`${name} will become Chief Operating Officer at Acme Labs.`})}]
];
for(const [reason,options] of unresolved)test(`an incoming/current review hold stays when ${reason}`,()=>{
 const dossier=timeline(options);
 for(const value of [dossier,restored(dossier)])assert.equal(C.resolveBuyerRoleHold(heldPerson(),value).opportunityScope.status,'review_required');
});

test('a claimed effective date without a matching literal source date gains no authority on reload',()=>{
 const dossier=timeline({effective:{...officialEffective(),quote:`${name} is ${title} at Acme Labs.`}});
 for(const value of [dossier,restored(dossier)])assert.equal(value.passes[0].people[0].date,'');
});

test('future-only appointments cannot create a current buyer or clear an employment hold',()=>{
 const date=iso(30),appointment=incoming({date,quote:`${name} will become ${title} at Acme Labs on ${date}.`});
 const dossier=dossierFor([[{...appointment,sourceUrl:'https://acme.example/news/future-role'}],[appointment]]);
 for(const value of [dossier,restored(dossier)]){
  assert.equal(C.buyers(value,company.company).length,0);assert.match(C.holdReason({name,title},value),/employment status/i);
  assert.equal(C.resolveBuyerRoleHold(heldPerson(),value).opportunityScope.status,'review_required');
 }
});

test('genuinely conflicting current roles survive canonical projection and reload',()=>{
 const other={title:'Chief Operating Officer',sourceUrl:'https://acme.example/team/other',quote:`${name} is Chief Operating Officer at Acme Labs.`};
 const dossier=dossierFor([[officialRoster()],[other]]);
 for(const value of [dossier,restored(dossier)]){
  assert.match(C.holdReason({name,title},value),/conflict/i);assert.equal(C.resolveBuyerRoleHold(heldPerson(),value).opportunityScope.status,'review_required');
 }
});

test('conflicting explicit future departure dates remain held while original source claims survive',()=>{
 const departure=days=>({status:'departed',date:iso(days),sourceUrl:`https://acme.example/news/departure-${days}`,quote:`${name} is ${title} at Acme Labs and will leave on ${iso(days)}.`});
 const dossier=dossierFor([[departure(30)],[departure(60)]]);
 for(const value of [dossier,restored(dossier)]){
  assert.match(C.holdReason({name,title},value),/conflict/i);assert.equal(C.resolveBuyerRoleHold(heldPerson(),value).opportunityScope.status,'review_required');
  assert.deepEqual(value.assignments.map(row=>row.departureDate).sort(),[iso(30),iso(60)].sort());
 }
});
