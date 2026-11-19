const test=require('node:test'),assert=require('node:assert/strict'),M=require('../company-lists.js');
const now=Date.parse('2026-11-19T12:00:00Z');
const referenceQuote='Builds automated production equipment for factories';
const opportunityQuote='Automation investments create demand for production equipment and controls.';
function workspace(){return {website:'https://seller.example/',targetMarkets:['Sweden'],answers:{priority_offers:'Production equipment',ideal_customer:'Equipment manufacturers',exclusions:'Consumer retailers'},referenceCustomers:{rows:[{id:'r1',companyName:'Reference',website:'https://reference.example/'}],analyses:{r1:{sourceEvidence:[{url:'https://reference.example/',quote:referenceQuote}]}}},market:{icps:[
 {id:'icp-core',type:'core',name:'Core',active:true,description:'Manufacturers of production equipment'},
 {id:'icp-reference-lookalike',type:'lookalike-led',name:'Lookalike',active:true,description:'Substantive reference similarity'},
 {id:'icp-trigger-led',type:'trigger-led',name:'Trigger-led',active:true,description:'Equipment manufacturers with current triggers'},
 {id:'icp-opportunity-led',type:'opportunity-led',name:'Opportunity-led',active:true,description:'A specific automation application'}
 ],signals:[{id:'hiring',name:'Engineering hiring',active:true,keywords:'production engineers'},{id:'expansion',name:'New facility',active:true,keywords:'new facility'},{id:'funding',name:'Funding',active:false},{id:'deleted',name:'Deleted signal',active:true}],deletedSignalIds:['deleted'],opportunities:[{id:'opp-automation',title:'Automation opportunity',active:true,evidence:[{url:'https://industry.example/automation',text:opportunityQuote,date:'2026-11-01'}]}]}};}
function config(extra={},main=workspace()){return M.configuration({profileIds:['icp-reference-lookalike'],profileMode:'any',signalMode:'off',count:10,markets:['Sweden'],referenceIds:['current:r1'],...extra},M.options(main));}
const page={url:'https://factory.example/',text:'Factory builds automated production equipment. Factory operates in Stockholm, Sweden. Published 2026-11-01: Factory is hiring production engineers. Published 2026-11-02: Factory opens a new automation facility.',readAt:'2026-11-19T10:00:00Z'};
function candidate(){return {company:'Factory',website:page.url,identity:{url:page.url,quote:'Factory builds automated production equipment.'},location:{market:'Sweden',label:'Stockholm',url:page.url,quote:'Factory operates in Stockholm, Sweden.'},commercialFit:{status:'supported',url:page.url,quote:'Factory builds automated production equipment.',reason:'The documented operation uses the offered equipment.'},profileMatches:workspace().market.icps.map(p=>({profileId:p.id,url:page.url,quote:p.type==='opportunity-led'?'Factory opens a new automation facility.':'Factory builds automated production equipment.',date:'2026-11-02',strength:90,reason:'Specific documented operations support this profile.',referenceId:'current:r1',referenceQuote,opportunityId:'opp-automation',opportunityQuote})),signalMatches:[{signalId:'hiring',url:page.url,quote:'Factory is hiring production engineers.',date:'2026-11-01',strength:80,reason:'Current production engineering recruitment.'},{signalId:'expansion',url:page.url,quote:'Factory opens a new automation facility.',date:'2026-11-02',strength:90,reason:'A dated new facility announcement.'}]};}
function review(c,raw=candidate(),change={},pages=[page]){const result=M.assess(raw,c,pages,now);return M.reviewResult(result,{decision:'pass',identityConfirmed:true,marketConfirmed:true,commercialFitConfirmed:true,exclusionsChecked:true,supportedProfileIds:c.profiles.map(p=>p.id),supportedSignalIds:c.signals.map(s=>s.id),reason:'The cited operations and events support the selected criteria.',gaps:[],...change},c,now);}
test('each of the four saved profiles can independently produce an evidence-reviewed match',()=>{
 for(const id of workspace().market.icps.map(p=>p.id)){const c=config({profileIds:[id],signalMode:id==='icp-trigger-led'?'require':'off',signalIds:['hiring']});const r=review(c);assert.ok(r,id);assert.deepEqual(r.profileMatches.map(m=>m.profileId),[id]);assert.equal(r.quality.version,M.PROFILE_VERSION);assert.equal(r.fitScore,90);}
});
test('profile combinations use any/all without accepting signals as a substitute for profile fit',()=>{
 const ids=['icp-core','icp-reference-lookalike','icp-trigger-led','icp-opportunity-led'];
 const c=config({profileIds:ids,profileMode:'all',signalMode:'require',signalIds:['hiring','expansion'],mode:'all'});assert.equal(review(c).profileMatches.length,4);
 const raw=candidate();raw.profileMatches=raw.profileMatches.slice(0,1);assert.equal(review(c,raw),null);
 const any={...c,profileMode:'any'};assert.equal(review(any,raw).profileMatches.length,1);
 raw.profileMatches=[];assert.equal(review(any,raw),null);
 assert.equal(review(c,candidate(),{supportedProfileIds:['icp-core']}),null);
});
test('Off, Prioritize and Require have distinct inclusion and scoring with single or combined buying signals',()=>{
 const off=config({signalIds:['hiring','deleted'],weights:{hiring:5}});const a=review(off);assert.equal(a.score,90);assert.deepEqual(off.signals,[]);assert.equal(a.signalMatches.length,0);
 const boost=config({signalMode:'boost',signalIds:['hiring','expansion'],weights:{hiring:4,expansion:1}});const b=review(boost);assert.equal(b.fitScore,90);assert.equal(b.signalScore,82);assert.equal(b.score,98);
 const none={...candidate(),signalMatches:[]};assert.equal(review(boost,none).score,90);
 assert.equal(review({...boost,signalMode:'require'},none),null);
 const one={...candidate(),signalMatches:[candidate().signalMatches[0]]};assert.ok(review({...boost,signalMode:'require'},one));assert.equal(review({...boost,signalMode:'require',mode:'all'},one),null);
 assert.equal(review(boost,candidate(),{supportedSignalIds:[]}).score,90,'an unconfirmed optional signal cannot affect ranking');
});
test('Trigger-led always needs events; Opportunity-led needs an exact current company opportunity',()=>{
 assert.throws(()=>config({profileIds:['icp-trigger-led']}),/Trigger-led/);
 const trigger=config({profileIds:['icp-trigger-led'],signalMode:'boost',signalIds:['hiring']});assert.equal(review(trigger,{...candidate(),signalMatches:[]}),null);
 const opportunity=config({profileIds:['icp-opportunity-led']});
 for(const change of [{opportunityId:'invented'},{opportunityQuote:'An unsupported saved opportunity statement'},{date:'2020-01-01'}]){const raw=candidate();raw.profileMatches=raw.profileMatches.map(m=>({...m,...change}));assert.equal(review(opportunity,raw),null);}
});
test('switches, deletions, edits, canonical Lookalike and all-off settings affect only newly built criteria',()=>{
 const main=workspace(),old=config({},main);main.market.icps[1].active=false;main.market.icps.push({id:'icp-lookalike',type:'lookalike',active:true});
 assert.equal(M.options(main).profiles.find(p=>p.type==='lookalike').active,false);assert.throws(()=>config({},main),/profile is off/);assert.ok(review(old),'an already frozen list retains its original criteria');
 main.market.icps[0].description='Edited medical equipment manufacturers';main.market.icps[0].offers='Medical automation';
 const changed=config({profileIds:['icp-core']},main);assert.match(changed.profile.idealCustomer,/Edited medical/);assert.match(changed.profile.offers,/Medical automation/);assert.doesNotMatch(JSON.stringify(changed),/Substantive reference similarity/);
 main.market.deletedSignalIds.push('hiring');assert.throws(()=>config({profileIds:['icp-core'],signalMode:'require',signalIds:['hiring']},main),/no longer active/);
 main.market.signals.push({id:'new-project',name:'New project',active:true,keywords:'medical modernization'});assert.equal(config({profileIds:['icp-core'],signalMode:'boost',signalIds:['new-project']},main).signals[0].keywords[0],'medical modernization');
 main.market.icps.forEach(p=>p.active=false);assert.equal(M.options(main).profiles.filter(p=>p.active).length,0);main.market.icps=[];assert.equal(M.options(main).profiles.filter(p=>p.active).length,0);
});
test('all twenty supported active buying signals are selectable and stale opportunity context is blocked',()=>{
 const main=workspace();main.market.signals=Array.from({length:20},(_,i)=>({id:'s'+i,name:'Signal '+i,active:true}));
 assert.equal(config({signalMode:'boost',signalIds:main.market.signals.map(s=>s.id)},main).signals.length,20);
 main.market.researchContextStale=true;assert.throws(()=>config({profileIds:['icp-opportunity-led']},main),/missing required evidence/);
 main.market.researchContextStale=false;main.market.strategyApproval={researchBasis:'profile'};
 const available=M.options(main);
 assert.deepEqual(available.opportunities,[]);
 assert.equal(available.profiles.find(p=>p.type==='opportunity-led').active,false);
 assert.throws(()=>config({profileIds:['icp-opportunity-led']},main),/missing required evidence/);
 assert.equal(available.buyingSignals.length,20);assert.ok(main.market.opportunities.length);
 assert.throws(()=>config({profileMode:'unsupported'}),/any or all/);
});
test('saved/exported criteria retain separate profiles, events, scores and opportunity evidence',()=>{
 const c=config({profileIds:['icp-reference-lookalike','icp-opportunity-led'],signalMode:'boost',signalIds:['hiring']}),r=review(c),list={name:'Selected criteria',criteria:c,results:[r]};
 const rows=M.exportRows(list);assert.equal(rows[0].length,rows[1].length);assert.ok(rows[0].includes('Matched profiles'));assert.ok(rows[0].includes('Matched buying signals'));assert.ok(rows[0].includes('Profile fit'));assert.match(M.csv(list),/industry.example/);assert.match(M.csv(list),/Reference evidence/);assert.match(M.criteriaSummary(c),/Prioritize/);
});


test('the generated Trigger-led definition resolves Profile context without borrowing an inactive Strategy card',()=>{
 const main=workspace();main.market.icps[0].active=false;main.market.icps[0].description='Inactive definition must not leak';main.market.icps[2].description='Companies that fit the core profile and are currently showing relevant buying signals.';
 const c=config({profileIds:['icp-trigger-led'],signalMode:'require',signalIds:['hiring']},main);assert.match(c.profile.idealCustomer,/Equipment manufacturers/);assert.doesNotMatch(JSON.stringify(c),/Inactive definition must not leak/);
});


test('Any retains only reviewer-supported profile matches; All requires every selected profile',()=>{
 const c=config({profileIds:['icp-core','icp-reference-lookalike']});const result=review(c,candidate(),{supportedProfileIds:['icp-core']});assert.ok(result);assert.deepEqual(result.profileMatches.map(m=>m.profileId),['icp-core']);assert.equal(result.matches.length,1);assert.equal(review({...c,profileMode:'all'},candidate(),{supportedProfileIds:['icp-core']}),null);
});

test('rejecting an optional trigger removes only the dependent Trigger-led match and recomputes the score',()=>{
 const c=config({profileIds:['icp-core','icp-trigger-led'],signalMode:'boost',signalIds:['hiring','expansion'],mode:'all'});
 const raw=candidate();raw.profileMatches.find(m=>m.profileId==='icp-core').strength=71;
 const partial={supportedSignalIds:['hiring']};
 const result=review(c,raw,partial);
 assert.ok(result);assert.deepEqual(result.profileMatches.map(m=>m.profileId),['icp-core']);
 assert.deepEqual(result.signalMatches.map(m=>m.signalId),['hiring']);assert.equal(result.fitScore,71);assert.equal(result.signalBonus,4);assert.equal(result.score,75);
 const missing=review(c,raw,{supportedSignalIds:[]});assert.equal(missing.score,71);assert.equal(missing.matches.length,1);
 assert.equal(review({...c,profileMode:'all'},raw,partial),null);
 assert.equal(review({...c,signalMode:'require'},raw,partial),null);
 assert.equal(review(c,raw,{...partial,supportedProfileIds:['icp-trigger-led']}),null);
});

test('Lookalike with five references and no checked optional signals runs as Profiles only',()=>{
 const main=workspace();
 for(let i=2;i<=5;i++){
  main.referenceCustomers.rows.push({id:'r'+i,companyName:'Reference '+i,website:'https://reference'+i+'.example/'});
  main.referenceCustomers.analyses['r'+i]=main.referenceCustomers.analyses.r1;
 }
 const references=main.referenceCustomers.rows.map(r=>'current:'+r.id);
 const input={signalMode:'boost',signalIds:[],referenceIds:references,weights:{hiring:5}};
 const c=config(input,main);
 assert.equal(c.signalMode,'off');assert.deepEqual(c.referenceIds,references);
 assert.deepEqual(c.weights,{});assert.deepEqual(c.signals,[]);assert.equal(review(c).score,90);
 assert.throws(()=>config({...input,signalMode:'require'},main),/active buying signals/);
 assert.throws(()=>config({...input,profileIds:['icp-core','icp-trigger-led']},main),/Trigger-led/);
 assert.throws(()=>config({...input,signalIds:'hiring'},main),/active signal list/);
});

test('full-strength reviewed signals can earn the full ten-point bonus with source and age discounts retained',()=>{
 const c=config({signalMode:'require',signalIds:['hiring']});
 const raw=candidate();raw.signalMatches[0].strength=100;raw.profileMatches.forEach(m=>{m.strength=97;});
 const result=review(c,raw);assert.equal(result.signalScore,100);assert.equal(result.signalBonus,10);assert.equal(result.score,100);
 assert.equal(result.fitScore,90);assert.equal(result.profileMatches[0].strength,97);assert.equal(result.profileMatches[0].score,90);
 const trade={...page,url:'https://jobs.example/hiring',text:'Published 2026-05-01: Factory is hiring production engineers.'};
 raw.signalMatches[0]={...raw.signalMatches[0],url:trade.url,date:'2026-05-01'};
 const assessed=M.assess(raw,c,[page,trade],now);assert.equal(assessed.signalScore,64);assert.equal(assessed.signalBonus,6);
 assert.equal(assessed.signalMatches[0].strength,100);assert.equal(assessed.signalMatches[0].score,64);
});

test('older assessed checkpoints can be reviewed with retained scores when raw strength was never saved',()=>{
 const c=config({signalMode:'require',signalIds:['hiring']});
 const pending=M.assess(candidate(),c,[page],now);pending.matches.forEach(m=>{delete m.strength;});
 const verdict={decision:'pass',reason:'Verified selected evidence.',identityConfirmed:true,marketConfirmed:true,commercialFitConfirmed:true,exclusionsChecked:true,supportedProfileIds:[c.profiles[0].id],supportedSignalIds:['hiring']};
 const result=M.reviewResult(pending,verdict,c,now);
 assert.equal(result.score,98);assert.ok(result.matches.every(m=>!Object.hasOwn(m,'strength')));
 pending.signalMatches[0].score=0;assert.equal(M.reviewResult(pending,verdict,c,now),null);
});

test('an invalid assessment strength cannot qualify a profile or a required event',()=>{
 const c=config({signalMode:'require',signalIds:['hiring']});
 for(const invalid of [undefined,null,false,[],0,-1,101,'unknown']){
  const raw=candidate();raw.signalMatches[0].strength=invalid;assert.equal(review(c,raw),null);
  assert.equal(review({...c,signalMode:'boost'},raw).signalBonus,0);
  const badProfile=candidate();badProfile.profileMatches.forEach(m=>{m.strength=invalid;});assert.equal(review(c,badProfile),null);
 }
});

test('equally reviewed profile and event strength scores equally across seller industries and company names',()=>{
 for(const [company,domain,market,activity,event,signalId] of [
  ['North Forge','forge.example','Finland','builds metal presses','opened a new mill','mill-opening'],
  ['Aster Labs','aster.example','Germany','runs diagnostic laboratories','opened a pathology laboratory','lab-opening']
 ]){
  const main={profile:{website:'https://seller.example',idealCustomer:activity},market:{icps:[{id:'icp-core',type:'core',description:activity,active:true}],signals:[{id:signalId,name:event,active:true}]}};
  const c=config({profileIds:['icp-core'],referenceIds:[],markets:[market],signalMode:'require',signalIds:[signalId]},main);
  const url='https://'+domain+'/',identity={url,quote:company+' '+activity+'.'},location={url,market,label:market,quote:company+' operates in '+market+'.'};
  const signal={signalId,url,date:'2026-11-01',quote:company+' '+event+'.',strength:80,reason:event};
  const raw={company,website:url,identity,location,commercialFit:{...identity,status:'supported',reason:activity},profileMatches:[{...identity,profileId:'icp-core',strength:75,reason:activity}],signalMatches:[signal]};
  const source={url,text:[identity.quote,location.quote,signal.date,signal.quote].join(' '),readAt:page.readAt};
  const r=review(c,raw,{},[source]);assert.equal(r.score,83);assert.equal(r.domain,domain);assert.equal(r.market,market);
  assert.deepEqual(r.signalMatches.map(m=>m.signalId),[signalId]);assert.equal(review(c,raw,{supportedSignalIds:[]},[source]),null);
 }
});

test('year and month precision cannot establish a current buying signal or dated opportunity',()=>{
 const required=config({profileIds:['icp-core'],signalMode:'require',signalIds:['hiring']});
 const opportunity=config({profileIds:['icp-opportunity-led']});
 for(const date of ['2026','2026-11','November 2026','2026-11T12:00Z','November 1, 2026','1 Nov 2026','2026-11-01T12:00:00Z']){
  const raw=candidate();raw.signalMatches[0].date=date;raw.profileMatches.forEach(m=>{m.date=date;});
  const source={...page,text:page.text+' Published '+date+'.'};
  const exact=['November 1, 2026','1 Nov 2026','2026-11-01T12:00:00Z'].includes(date);
  assert.equal(Boolean(review(required,raw,{},[source])),exact,date);
  assert.equal(Boolean(review(opportunity,raw,{},[source])),exact,date);
 }
});
