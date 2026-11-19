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
function review(c,raw=candidate(),change={}){const result=M.assess(raw,c,[page],now);return M.reviewResult(result,{decision:'pass',identityConfirmed:true,marketConfirmed:true,commercialFitConfirmed:true,exclusionsChecked:true,supportedProfileIds:c.profiles.map(p=>p.id),supportedSignalIds:c.signals.map(s=>s.id),reason:'The cited operations and events support the selected criteria.',gaps:[],...change},c,now);}
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
