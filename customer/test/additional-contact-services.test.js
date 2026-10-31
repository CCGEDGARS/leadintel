const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js');
function fixture(){const now=new Date().toISOString();const c={company:'Example',domain:'example.com',market:'Sweden',qualification:{eligible:true,researchedAt:now,version:2,qualificationKind:'company',companyScore:85},people:Array.from({length:4},(_,i)=>({id:'p'+i,name:['Anna Andersson','Bo Svensson','Cecilia Berg','David Lind'][i],title:i===0?'Head of Procurement':'Project Director',organization:'Example',publicNameUrl:'https://example.com/team/'+i,emailResearch:{status:'complete',searches:5,failed:0,checkedAt:now},contactResearch:{policyVersion:D.BUYER_CONTACT_RESEARCH_POLICY.version,checks:Object.fromEntries([...D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks,'deep'].map(k=>[k,{status:'complete',checkedAt:now,queryLog:Array.from({length:k==='gmail'?3:k==='direct_email'?2:1},(_,i)=>({query:k+' business source query '+i,status:'complete',checkedAt:now,resultCount:0}))}]))}}))};c.publicResearch={accountability:{...D.createBuyerResearchAccountability(),status:'complete',completedAt:now,totalPeople:4,checkedPeople:4,officialPages:1}};return require('./helpers/buyer-research-receipts.cjs')(c,now);}
test('additional services require a qualified company and four real researched eligible buyers',()=>{
 const P=require('../additional-contact-policy.js'),c=fixture();assert.equal(P.readiness(c,c.people[0]).eligible,true);
 for(const mutate of [c=>c.qualification.eligible=false,c=>c.people.pop(),c=>c.people[1].emailResearch.status='partial',c=>c.people[0].organization='Other employer',c=>c.buyerRolesChanged=true,c=>c.publicResearch={conflicts:[{person_id:'p0'}]}]){const x=fixture();mutate(x);assert.equal(P.readiness(x,x.people[0],{automatic:true}).eligible,false);}
});
test('already confirmed emails, stale research, pending source checks and blocked companies never request paid lookup',()=>{
 const P=require('../additional-contact-policy.js');for(const mutate of [c=>c.lifecycle_status='suppressed',c=>c.lifecycle_status='archived',c=>c.people[0].emailResearch.checkedAt='2001-01-01',c=>c.publicContactStatus='loading']){const c=fixture();mutate(c);assert.equal(P.readiness(c,c.people[0]).eligible,false);}
 const c=fixture();assert.equal(P.readiness(c,c.people[0],{confirmedEmail:'anna@example.com'}).eligible,false);
});
test('automatic targets are the best two qualified buyers and stop once two usable emails exist',()=>{
 const P=require('../additional-contact-policy.js'),c=fixture();assert.deepEqual(P.targets(c).map(p=>p.id),['p0','p1']);
 assert.equal(P.targets(c,{confirmedEmail:p=>p.id==='p0'?'anna@example.com':''}).length,1);
 assert.equal(P.targets(c,{confirmedEmail:p=>['p0','p1'].includes(p.id)?'anna@example.com':''}).length,0);
});
test('buyer card uses exact approved wording and never promises a found or verified email',()=>{
 const source=fs.readFileSync(require.resolve('../additional-contact-services.js'),'utf8');
 assert.ok(source.includes('Strong match. No confirmed public work email found.'));
 assert.ok(source.includes('Find email with additional services'));
});
module.exports={fixture};

function runtime({confirmed=false,enabled=false,connected=true,approve=true}={}){
 const {JSDOM}=require('jsdom');const dom=new JSDOM('<form id="additional-contact-preferences"><input name="enabled" type="checkbox"><input name="dailyLimit" value="3"><input name="monthlyLimit" value="30"><select name="maxPerCompany"><option value="2">2</option></select><button>Save</button></form><p id="additional-contact-status"></p>',{url:'https://leadintel.example',runScripts:'outside-only'}),w=dom.window,c=fixture(),calls=[];
 const contact=new Map(),policy={enabled,dailyLimit:3,monthlyLimit:30,maxPerCompany:2,updatedAt:'now'};
 w.LeadIntelAdditionalContactPolicy=require('../additional-contact-policy.js');w.AbortSignal=AbortSignal;w.LeadIntelServerBridge={workspace:{id:'w',role:'owner'},session:{authenticated:true}};w.LeadIntelDialogs={confirm:async()=>{calls.push('confirm');return approve;}};
 let release;const fetched=new Promise(r=>release=r);
 w.fetch=async(url,opts={})=>{calls.push([url,opts]);let value=url.includes('/policy')?{policy}:url.includes('/services/status')?{providers:[{provider:'apollo',configured:connected,source:connected?'customer':'none',metadata:{email_enrichment_enabled:true}}]}:{contact:{external_person_id:'p0',work_email:'anna@example.com',name:'Anna Andersson'}};return {ok:true,json:async()=>value};};
 w.eval(fs.readFileSync(require.resolve('../additional-contact-services.js'),'utf8'));
 const adapter={rows:()=>[c],assessment:()=>c.qualification,email:(candidate,p)=>confirmed||contact.get(p.id)?'anna@example.com':'',publicSource:()=>false,render(){release();},pending(){},prepare:async()=>({id:'company'}),accept:async(c,p,result)=>contact.set(p.id,result.contact)};w.LeadIntelAdditionalContacts.register(adapter);
 return {w,c,calls,contact,adapter,loaded:fetched,close:()=>dom.window.close()};
}
test('manual additional-service confirmation makes one lookup and preserves confirmed result',async()=>{
 const f=runtime();await f.loaded;assert.equal(await f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]),true);assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?')).length,1);assert.equal(f.contact.has('p0'),true);f.close();
});
test('canceling and unconnected services never issue a paid request',async()=>{
 for(const opts of [{approve:false},{connected:false}]){const f=runtime(opts);await f.loaded;assert.equal(await f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]),false);assert.equal(f.calls.some(c=>Array.isArray(c)&&c[0].includes('/email?')),false);f.close();}
});
test('upfront approval researches only the strongest two without per-person dialogs',async()=>{
 const f=runtime({enabled:true});await f.loaded;await f.w.LeadIntelAdditionalContacts.auto(f.c);await new Promise(r=>setTimeout(r,15));assert.equal(f.calls.includes('confirm'),false);assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?')).length,2);f.close();
});
test('workspace changes while awaiting confirmation prevent a provider request',async()=>{
 const f=runtime();await f.loaded;f.w.LeadIntelDialogs.confirm=async()=>{f.w.LeadIntelServerBridge.workspace={id:'other',role:'owner'};return true;};await f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]);assert.equal(f.calls.some(c=>Array.isArray(c)&&c[0].includes('/email?')),false);f.close();
});
test('public source confirmation can proceed to paid verification when the sending level remains unmet',async()=>{
 const f=runtime();await f.loaded;f.adapter.publicSource=()=>true;let free=0;
 assert.equal(await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{freeConfirm:async()=>{free++;return false;}}),true);
 assert.equal(free,1);assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?')).length,1);f.close();
});
test('enabled Hunter verifies an already attributable work email without another Apollo lookup',async()=>{
 const f=runtime();await f.loaded;f.w.LeadIntelServiceSettings={hunterEnabled:()=>true};f.adapter.baseEmail=()=> 'anna@example.com';
 let saved;f.adapter.saveHunter=async(c,p,email,result)=>{saved={email,result};};
 f.w.fetch=async(url)=>{f.calls.push([url]);return {ok:true,json:async()=>({email:'anna@example.com',status:'valid',deliverability:'deliverable',checked_at:new Date().toISOString()})};};
 assert.equal(f.w.LeadIntelAdditionalContacts.label(f.c,f.c.people[0]),'Verify email with Hunter');
 assert.equal(await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0]),true);
 assert.equal(saved.email,'anna@example.com');assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/hunter/verify-email')).length,1);assert.equal(f.calls.some(c=>Array.isArray(c)&&c[0].includes('/email?')),false);f.close();
});
test('removing a buyer while Hunter confirmation is open cancels the paid check',async()=>{
 const f=runtime();await f.loaded;f.w.LeadIntelServiceSettings={hunterEnabled:()=>true};f.adapter.baseEmail=()=> 'anna@example.com';f.adapter.saveHunter=async()=>{throw Error('Must not save');};
 f.w.LeadIntelDialogs.confirm=async()=>{f.adapter.rows=()=>[];return true;};
 await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0]);assert.equal(f.calls.some(c=>Array.isArray(c)&&c[0].includes('/hunter/')),false);f.close();
});
function discoveryAdapter(overrides={}){
 const candidate=fixture();let adapter;const writes=[],ctx={window:{LeadIntelAdditionalContacts:{register:x=>adapter=x},LeadIntelCrm:{mapDiscoveryCandidateToCrm:()=>({company:{domain:candidate.domain}})},dispatchEvent(){}},discovery:{selectedProspects:[candidate]},qualificationAssessment:()=>candidate.qualification,ensureCrmCompany:async()=>({id:'c'}),personKey:()=> 'p',verifiedBuyerEmail:()=>'',publicBuyerSource:()=>null,enrichmentResults:new Map(),enrichmentPending:new Set(),discoveryMounted:false,renderAll(){},showToast(){},saveDiscovery:()=>writes.push('local'),refreshCrmState:async()=>{},CustomEvent:class{},bridge:()=>ctx.b,...overrides};
 ctx.b={workspace:{id:'a'},session:{authenticated:true,user:{id:'u'}},saveCrmCompany:async()=>{writes.push(ctx.b.workspace.id);return {ok:true,company:{id:'c',normalized_domain:candidate.domain,workspace_id:ctx.b.workspace.id}};},saveNow:async()=>({saved:true})};
 Object.assign(ctx,{LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain,crmAuthenticated:()=>ctx.b.session.authenticated,discoveryOperationContext:()=>JSON.stringify([ctx.b.workspace.id,ctx.b.session.user.id,ctx.ticket||''])});
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),start=source.indexOf('window.LeadIntelAdditionalContacts?.register({'),end=source.indexOf('initDiscoveryWhenReady();',start);vm.runInNewContext(source.slice(source.indexOf('const companySelectionOperations=new Map();'),source.indexOf('function crmToLocalPipeline('))+source.slice(start,end),ctx);
 return {adapter,candidate,ctx,writes};
}
test('a workspace change during company preparation prevents a cross-workspace CRM write',async()=>{
 const f=discoveryAdapter();let release;f.ctx.ensureCrmCompany=()=>new Promise(r=>release=r);const run=f.adapter.prepare(f.candidate);f.ctx.b.workspace.id='b';release({id:'c'});await assert.rejects(run,/workspace|context/i);assert.deepEqual(f.writes,[]);
});
test('paid Hunter evidence is retained when CRM succeeds but workspace sync needs retry',async()=>{
 const f=discoveryAdapter();f.ctx.b.saveNow=async()=>({saved:false});const p=f.candidate.people[0];await f.adapter.saveHunter(f.candidate,p,'anna@example.com',{status:'valid',deliverability:'deliverable',checked_at:new Date().toISOString()});assert.equal(p.hunterChecks['anna@example.com'].status,'valid');
});
test('automatic approval resumes after a previously unavailable provider is connected',async()=>{
 const f=runtime({enabled:true,connected:false});await f.loaded;
 f.w.fetch=async(url,opts={})=>{f.calls.push([url,opts]);return {ok:true,json:async()=>url.includes('/policy')?{policy:{enabled:true,dailyLimit:3,monthlyLimit:30,maxPerCompany:2,updatedAt:'now'}}:url.includes('/services/status')?{providers:[{provider:'apollo',configured:true,source:'customer',metadata:{email_enrichment_enabled:true}}]}:{contact:{external_person_id:'p0',work_email:'anna@example.com',name:'Anna Andersson'}}};};
 await f.w.LeadIntelAdditionalContacts.load();await f.w.LeadIntelAdditionalContacts.auto(f.c);await new Promise(r=>setTimeout(r,10));assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?')).length,2);f.close();
});
test('stale company verification cannot authorize additional services despite a saved eligible flag',()=>{const P=require('../additional-contact-policy.js'),c=fixture();c.qualification.researchedAt='2001-01-01';assert.equal(P.readiness(c,c.people[0]).eligible,false);});
test('newer paid Hunter evidence restores from CRM without repeating equal-timestamp public research',()=>{
 const candidate=fixture(),stamp=new Date(Date.now()-60000).toISOString(),checked_at=new Date().toISOString();candidate.buyerDiscovery={checkedAt:stamp};
 const saved=JSON.parse(JSON.stringify(candidate.people));saved[0].hunterChecks={'anna@example.com':{status:'valid',deliverability:'deliverable',checked_at}};
 const detail={company:{id:'company',workspace_id:'hydration-workspace',normalized_domain:'example.com'},intelligence:{research_snapshot:{buyerResearch:{version:2,checkedAt:stamp,buyers:saved}}}},source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),ctx={Date,LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain};
 require('./helpers/crm-hydration-context.cjs')(ctx);
 vm.runInNewContext(source.slice(source.indexOf('function restoreNewerBuyerResearch('),source.indexOf('function hydrateLocalPipelineFromCrm(')),ctx);
 assert.equal(ctx.restoreNewerBuyerResearch(candidate,detail),true);assert.equal(candidate.people[0].hunterChecks['anna@example.com'].checked_at,checked_at);
});

test('Find email runs public confirmation even when no public address was saved beforehand',async()=>{
 const f=runtime();await f.loaded;let free=0;
 assert.equal(await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{freeConfirm:async()=>{free++;f.contact.set('p0',{});return true;}}),true);
 assert.equal(free,1);assert.equal(f.calls.some(c=>Array.isArray(c)&&c[0].includes('/email?')),false);f.close();
});
test('failed public research and workspace changes during it never fall through to provider credits',async()=>{
 for(const change of [()=>{throw Error('Public checks incomplete');},f=>{f.w.LeadIntelServerBridge.workspace.id='other';return false;}]){
  const f=runtime();await f.loaded;await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{freeConfirm:()=>change(f)});
  assert.equal(f.calls.some(c=>Array.isArray(c)&&c[0].includes('/email?')),false);f.close();
 }
});

test('manual email lookup is scoped to the selected qualified buyer while automation retains the four-buyer gate',()=>{
 const P=require('../additional-contact-policy.js'),c=fixture();c.publicResearch.conflicts=[{person_id:'p3',reason:'Other identity needs review'}];
 assert.equal(P.readiness(c,c.people[0]).eligible,true);
 assert.equal(P.readiness(c,c.people[0],{automatic:true}).eligible,false);
 assert.equal(P.readiness(c,c.people[3]).eligible,false);
 c.people[2].emailResearch.status='partial';assert.equal(P.readiness(c,c.people[0]).eligible,true);
 c.people[0].contactResearch.checks.gmail.queryLog.pop();assert.equal(P.readiness(c,c.people[0]).eligible,false);
});
test('a blocked paid lookup explains the actual reason and retains it on the buyer after rendering',async()=>{
 const f=runtime();await f.loaded;f.c.qualification.eligible=false;
 assert.equal(await f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]),false);
 assert.match(f.c.people[0].contactVerification.issues.join(' '),/company qualification/i);
 assert.match(f.w.LeadIntelAdditionalContacts.card(f.c,f.c.people[0]),/company qualification/i);
 assert.equal(f.calls.some(c=>Array.isArray(c)&&c[0].includes('/email?')),false);f.close();
});
test('no-result Apollo lookup offers separately approved Hunter finding and retains provider receipts',async()=>{
 const f=runtime();await f.loaded;let hunterCalls=0;
 f.w.fetch=async(url,options={})=>{f.calls.push([url,options]);let value;
 if(url.includes('/services/status'))value={providers:[{provider:'apollo',configured:true,source:'customer',metadata:{email_enrichment_enabled:true}},{provider:'hunter',configured:true,source:'customer',metadata:{additional_verification_enabled:true}}]};
 else if(url.includes('/policy'))value={policy:{enabled:false,dailyLimit:3,monthlyLimit:30,maxPerCompany:2}};
 else {const body=JSON.parse(options.body);if(body.provider==='hunter'){hunterCalls++;value={contact:{external_person_id:'p0',work_email:'anna@example.com',name:'Anna Andersson'},research:{provider:'hunter',status:'verified'}};}else value={contact:null,reason:'No verified work email returned',research:{provider:'apollo',status:'not_found'}};}
 return {ok:true,json:async()=>value};};
 await f.w.LeadIntelAdditionalContacts.load();assert.equal(await f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]),true);
 assert.equal(hunterCalls,1);assert.equal(f.calls.filter(c=>c==='confirm').length,2);
 assert.match(f.c.people[0].contactVerification.issues.join(' '),/Apollo.*not_found/i);assert.match(f.c.people[0].contactVerification.issues.join(' '),/Hunter.*verified/i);f.close();
});
test('saved blockers and provider receipts survive workspace normalization and CRM mapping',()=>{
 const c=fixture();c.people[0].contactVerification={status:'not_verified',checkedAt:new Date().toISOString(),issues:['Apollo · not_found','Hunter · error: credits exhausted']};
 const state=D.normalizeDiscoveryState({selectedProspects:[{...c,buyerSearchMode:'user_selected_target'}]});
 assert.deepEqual(state.selectedProspects[0].people[0].contactVerification.issues,c.people[0].contactVerification.issues);
 const C=require('../crm-engine.js'),saved=C.mapDiscoveryCandidateToCrm(state.selectedProspects[0]);
 assert.deepEqual(saved.intelligence.research_snapshot.buyerResearch.buyers[0].contactVerification.issues,c.people[0].contactVerification.issues);
});
test('one missing buyer cannot loosen the automatic full-roster research gate',()=>{
 const P=require('../additional-contact-policy.js'),c=fixture();c.people.pop();
 assert.equal(P.readiness(c,c.people[0]).eligible,true);assert.equal(P.readiness(c,c.people[0],{automatic:true}).eligible,false);assert.deepEqual(P.targets(c),[]);
});

for(const channel of ['email','phone'])test(`manual ${channel} searches only its requested Treg channel`,async()=>{
 const f=runtime();await f.loaded;
 f.w.fetch=async(url,options={})=>{f.calls.push([url,options]);return {ok:true,json:async()=>url.includes('/policy')?{policy:{provider:'treg',enabled:true,phoneEnabled:true,maxPerCompany:1,dailyLimit:5,monthlyLimit:150},role:'owner'}:url.includes('/status')?{providers:[{provider:'treg',configured:true,source:'customer'}]}:{contact:{external_person_id:'p0',name:'Anna Andersson',work_email:'anna@example.com',email_status:'verified'}}};};
 await f.w.LeadIntelAdditionalContacts.load();
 await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{channel,dataLookup:channel==='phone'});
 const requests=f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?'));assert.equal(requests.length,1);
 const body=JSON.parse(requests[0][1].body);assert.equal(body.phone_approved,channel==='phone');assert.equal(body.email_lookup,channel==='email');f.close();
});

for(const phoneEnabled of [false,true])test(`automatic Treg phone lookup follows Setup switch ${phoneEnabled?'ON':'OFF'}`,async()=>{
 const f=runtime();await f.loaded;f.w.LeadIntelDiscovery=D;f.w.LeadIntelOutreachAutomationUI={getPolicy:()=>({mode:'automatic'})};
 f.w.fetch=async(url,options={})=>{f.calls.push([url,options]);return {ok:true,json:async()=>url.includes('/policy')?{policy:{provider:'treg',enabled:true,phoneEnabled,maxPerCompany:1,dailyLimit:5,monthlyLimit:150},role:'owner'}:url.includes('/status')?{providers:[{provider:'treg',configured:true,source:'customer'}]}:{contact:{external_person_id:'p0',name:'Anna Andersson',work_email:'anna@example.com',email_status:'verified'}}};};
 await f.w.LeadIntelAdditionalContacts.load();f.c.publicResearch.aiReview={status:'complete',checkedAt:new Date().toISOString(),inputSignature:D.buyerReviewSignature(f.c),reviewedPersonIds:f.c.people.map(p=>p.id),conflicts:[],findings:[]};await f.w.LeadIntelAdditionalContacts.auto(f.c,{trigger:'research_completed'});
 const requests=f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?'));assert.equal(requests.length,1);
 const body=JSON.parse(requests[0][1].body);assert.equal(body.phone_approved,phoneEnabled);assert.equal(body.email_lookup,true);assert.equal(body.automatic,true);assert.equal(f.calls.includes('confirm'),false);f.close();
});


test('manual public confirmation prevents an automatic paid lookup for a different ranked buyer',async()=>{
 const f=runtime({enabled:true});await f.loaded;let release,started;const waiting=new Promise(r=>started=r);
 const selected=f.c.people[1],pending=f.w.LeadIntelAdditionalContacts.confirm(f.c,selected,{freeConfirm:async()=>{started();await new Promise(r=>release=r);}});
 await waiting;await f.w.LeadIntelAdditionalContacts.auto(f.c,{trigger:'research_completed'});
 assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?')).length,0);
 release();await pending;
 const posts=f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?'));assert.equal(posts.length,1);assert.equal(JSON.parse(posts[0][1].body).person_id,selected.id);f.close();
});
test('a paid result for another buyer is rejected before it reaches the acceptance adapter',async()=>{
 const f=runtime();await f.loaded;
 const original=f.w.fetch;f.w.fetch=async(url,opts)=>url.includes('/email?')?{ok:true,json:async()=>({contact:{external_person_id:'another-buyer',work_email:'wrong@example.com'}})}:original(url,opts);
 assert.equal(await f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]),false);assert.equal(f.contact.size,0);assert.match(f.c.people[0].contactVerification.issues.join(' '),/does not match/);f.close();
});

test('reusing a buyer ID for a different identity during free confirmation cannot authorize a paid lookup',async()=>{
 const f=runtime();await f.loaded;
 const result=await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{freeConfirm:async()=>{f.c.people[0]={...f.c.people[0],name:'Different Buyer'};}});
 assert.equal(result,false);assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?')).length,0);assert.equal(f.c.people[0].contactVerification,undefined);f.close();
});

test('a stale policy-load failure cannot erase a newer successful policy',async()=>{
 const f=runtime();await f.loaded;let rejectOld,count=0;
 f.w.fetch=async url=>{if(url.includes('/policy')&&++count===1)return new Promise((_r,reject)=>{rejectOld=reject;});return {ok:true,json:async()=>url.includes('/policy')?{policy:{enabled:true,provider:'apollo',dailyLimit:5,monthlyLimit:30,maxPerCompany:2}}:{providers:[]}};};
 const old=f.w.LeadIntelAdditionalContacts.load();await f.w.LeadIntelAdditionalContacts.load();rejectOld(Error('old request failed'));await old;
 assert.equal(f.w.LeadIntelAdditionalContacts.policy()?.enabled,true);f.close();
});
test('a replaced buyer releases the pending lookup marker without applying its late result',async()=>{
 const f=runtime();await f.loaded;let release,started;const entered=new Promise(r=>started=r),pending=new Set();f.adapter.pending=(_c,p,value)=>value?pending.add(p.id):pending.delete(p.id);
 const original=f.w.fetch;f.w.fetch=async(url,opts)=>url.includes('/email?')?(started(),await new Promise(r=>release=r)):original(url,opts);
 const person=f.c.people[0],run=f.w.LeadIntelAdditionalContacts.run(f.c,person);await entered;f.c.people=[];release({ok:true,json:async()=>({contact:{external_person_id:person.id,name:person.name,work_email:'anna@example.com'}})});await run;
 assert.equal(f.contact.size,0);assert.equal(pending.size,0);f.close();
});
test('same-workspace user replacement rejects a late paid result',async()=>{
 const f=runtime();await f.loaded;f.w.LeadIntelServerBridge.session.user={id:'first'};let release,started;const entered=new Promise(r=>started=r),original=f.w.fetch;
 f.w.fetch=async(url,opts)=>url.includes('/email?')?(started(),await new Promise(r=>release=r)):original(url,opts);
 const person=f.c.people[0],run=f.w.LeadIntelAdditionalContacts.run(f.c,person);await entered;f.w.LeadIntelServerBridge.session.user.id='second';release({ok:true,json:async()=>({contact:{external_person_id:person.id,name:person.name,work_email:'anna@example.com'}})});await run;
 assert.equal(f.contact.size,0);assert.equal(person.contactVerification,undefined);f.close();
});
test('another buyer saved contact-data profile is not displayed on the current card',async()=>{
 const f=runtime();await f.loaded;f.c.people[0].contactData={version:1,domain:f.c.domain,personId:'other',identityName:'Other Buyer',profile:{status:'provider_reported',title:'Private wrong role'},phone:{number:'+37120000001'}};
 const html=f.w.LeadIntelAdditionalContacts.card(f.c,f.c.people[0]);assert.doesNotMatch(html,/Private wrong role|37120000001/);assert.match(html,/different buyer|identity/i);f.close();
});

test('old pending cleanup cannot clear a newer operation on the same buyer',()=>{
 const f=discoveryAdapter(),p=f.candidate.people[0],first={},second={};
 f.adapter.pending(f.candidate,p,true,first);f.adapter.pending(f.candidate,p,true,second);f.adapter.pending(f.candidate,p,false,first);
 assert.equal(f.ctx.enrichmentPending.has(f.ctx.personKey(f.candidate,p)),true);
 f.adapter.pending(f.candidate,p,false,second);assert.equal(f.ctx.enrichmentPending.size,0);
});
test('automatic work rechecks manual ownership after awaiting policy loading',async()=>{
 const f=runtime({enabled:true});await f.loaded;let releasePolicy,enteredPolicy,releaseManual,enteredManual;const policyStarted=new Promise(r=>enteredPolicy=r),manualStarted=new Promise(r=>enteredManual=r),original=f.w.fetch;
 f.w.dispatchEvent(new f.w.Event('leadintel:workspace-reset'));
 f.w.fetch=async(url,opts)=>url.includes('/policy')?(enteredPolicy(),await new Promise(r=>releasePolicy=r)):original(url,opts);
 const automatic=f.w.LeadIntelAdditionalContacts.auto(f.c,{trigger:'research_completed'});await policyStarted;
 const selected=f.c.people[1],manual=f.w.LeadIntelAdditionalContacts.confirm(f.c,selected,{freeConfirm:async()=>{enteredManual();await new Promise(r=>releaseManual=r);}});await manualStarted;
 releasePolicy({ok:true,json:async()=>({policy:{enabled:true,provider:'apollo',dailyLimit:3,monthlyLimit:30,maxPerCompany:2}})});await automatic;
 const count=f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?')).length;releaseManual();await manual;
 assert.equal(count,0);f.close();
});

test('a changed LinkedIn identity cannot display a previous saved profile or phone',async()=>{
 const f=runtime();await f.loaded;f.w.LeadIntelDiscovery=D;const p=f.c.people[0];p.publicLinkedinUrl='https://linkedin.com/in/new-buyer';
 p.contactData={version:1,domain:f.c.domain,personId:p.id,identityName:p.name,identityLinkedinUrl:'https://linkedin.com/in/old-buyer',profile:{status:'provider_reported',title:'Previous role'},phone:{status:'provider_listed',number:'+37120000001'}};
 const html=f.w.LeadIntelAdditionalContacts.card(f.c,p);assert.doesNotMatch(html,/Previous role|37120000001/);assert.match(html,/different buyer identity/);f.close();
});

test('automatic research from an earlier user cannot spend using a newer loaded policy',async()=>{
 const f=runtime({enabled:true});await f.loaded;f.w.LeadIntelServerBridge.session.user={id:'first'};f.w.dispatchEvent(new f.w.Event('leadintel:workspace-reset'));
 let release,entered,count=0;const started=new Promise(r=>entered=r),original=f.w.fetch;
 f.w.fetch=async(url,opts)=>{if(url.includes('/policy')){if(++count===1){entered();return await new Promise(r=>release=r);}return {ok:true,json:async()=>({policy:{enabled:true,provider:'apollo',dailyLimit:3,monthlyLimit:30,maxPerCompany:2}})};}return original(url,opts);};
 const old=f.w.LeadIntelAdditionalContacts.auto(f.c,{trigger:'research_completed'});await started;f.w.LeadIntelServerBridge.session.user.id='second';await f.w.LeadIntelAdditionalContacts.load();
 release({ok:true,json:async()=>({policy:{enabled:true,provider:'apollo',dailyLimit:3,monthlyLimit:30,maxPerCompany:2}})});await old;
 assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?')).length,0);f.close();
});

function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function paidPosts(f){return f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?'));}
async function configureTreg(f,{enabled=true,phoneEnabled=true,configured=true}={}){
 const original=f.w.fetch;f.w.fetch=async(url,options)=>url.includes('/policy')?{ok:true,json:async()=>({policy:{provider:'treg',enabled,phoneEnabled,maxPerCompany:1,dailyLimit:5,monthlyLimit:150},role:'owner'})}:url.includes('/services/status')?{ok:true,json:async()=>({providers:[{provider:'treg',configured,source:'customer'}]})}:original(url,options);
 await f.w.LeadIntelAdditionalContacts.load();
}
for(const name of ['Teemu Kettunen','Klas Andersson'])for(const field of ['organization','title','publicLinkedinUrl','publicNameUrl'])test(`${name}: changed ${field} during provider await rejects a same-ID result`,async()=>{
 const f=runtime();await f.loaded;const p=f.c.people[0];p.name=name;require('./helpers/buyer-research-receipts.cjs')(f.c);const response=deferred(),started=deferred(),original=f.w.fetch;
 f.w.fetch=async(url,options)=>{if(!url.includes('/email?'))return original(url,options);started.resolve();return response.promise;};
 const run=f.w.LeadIntelAdditionalContacts.run(f.c,p);await started.promise;p[field]=field==='organization'?'Different employer':field==='title'?'Project Director':'https://example.com/replaced-profile';
 response.resolve({ok:true,json:async()=>({contact:{external_person_id:p.id,name,work_email:'buyer@example.com'}})});
 assert.equal(await run,false);assert.equal(f.contact.size,0);assert.equal(p.contactVerification,undefined);f.close();
});
test('manual enabled Treg email still requires its own explicit cost approval',async()=>{
 const f=runtime({approve:false});await f.loaded;await configureTreg(f);let costPrompt='';f.w.LeadIntelDialogs.confirm=async message=>{costPrompt=message;f.calls.push('confirm');return false;};
 assert.equal(await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{channel:'email'}),false);
 assert.equal(paidPosts(f).length,0);assert.equal(f.calls.includes('confirm'),true);assert.match(costPrompt,/\$0\.075/);f.close();
});
for(const revoke of ['channel','provider','connection'])test(`revoked ${revoke} during phone confirmation cannot submit a stale paid request`,async()=>{
 const f=runtime();await f.loaded;await configureTreg(f);const started=deferred(),approval=deferred();f.w.LeadIntelDialogs.confirm=()=>{started.resolve();return approval.promise;};
 const run=f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{channel:'phone',dataLookup:true});await started.promise;
 if(revoke==='provider'){
  const original=f.w.fetch;f.w.fetch=async(url,options)=>url.includes('/policy')?{ok:true,json:async()=>({policy:{provider:'apollo',enabled:true,phoneEnabled:true,maxPerCompany:1,dailyLimit:5,monthlyLimit:150}})}:original(url,options);await f.w.LeadIntelAdditionalContacts.load();
 }else await configureTreg(f,{phoneEnabled:revoke!=='channel',configured:revoke!=='connection'});
 approval.resolve(true);assert.equal(await run,false);assert.equal(paidPosts(f).length,0);f.close();
});
test('revoked provider connection during CRM preparation prevents submission',async()=>{
 const f=runtime();await f.loaded;const started=deferred(),prepared=deferred();f.adapter.prepare=()=>{started.resolve();return prepared.promise;};
 const run=f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]);await started.promise;
 const original=f.w.fetch;f.w.fetch=async(url,options)=>url.includes('/services/status')?{ok:true,json:async()=>({providers:[]})}:original(url,options);await f.w.LeadIntelAdditionalContacts.load();
 prepared.resolve({id:'company'});assert.equal(await run,false);assert.equal(paidPosts(f).length,0);f.close();
});
test('manual phone intent queued behind email submits phone once instead of reusing the email promise',async()=>{
 const f=runtime();await f.loaded;await configureTreg(f);const started=deferred(),response=deferred(),original=f.w.fetch;
 f.w.fetch=async(url,options)=>{if(url.includes('/email?')&&!paidPosts(f).length){f.calls.push([url,options]);started.resolve();return response.promise;}return original(url,options);};
 const email=f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{channel:'email'});await started.promise;
 const phone=f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{channel:'phone',dataLookup:true});
 response.resolve({ok:true,json:async()=>({contact:{external_person_id:'p0',name:'Anna Andersson',work_email:'anna@example.com'}})});await Promise.all([email,phone]);
 assert.equal(paidPosts(f).length,2);const body=JSON.parse(paidPosts(f)[1][1].body);assert.equal(body.phone_approved,true);assert.equal(body.email_lookup,false);f.close();
});
test('direct manual lookup owns the company while automatic research tries another buyer',async()=>{
 const f=runtime({enabled:true});await f.loaded;const started=deferred(),response=deferred(),original=f.w.fetch;
 f.w.fetch=async(url,options)=>{if(url.includes('/email?')){f.calls.push([url,options]);started.resolve();return response.promise;}return original(url,options);};
 const run=f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[1]);await started.promise;const automatic=f.w.LeadIntelAdditionalContacts.auto(f.c,{trigger:'research_completed'});
 await new Promise(r=>setTimeout(r,0));const count=paidPosts(f).length;response.resolve({ok:true,json:async()=>({contact:null,research:{status:'not_found'}})});await Promise.all([run,automatic]);assert.equal(count,1);f.close();
});
for(const contact of [{},[],{work_email:'wrong@example.com'},{external_person_id:'p0',name:'Anna Andersson',company_id:'company',linkedin_url:'https://linkedin.com/in/another-buyer',work_email:'anna@example.com'}])test(`malformed or conflicting paid contact cannot reach acceptance: ${JSON.stringify(contact)}`,async()=>{
 const f=runtime();await f.loaded;f.c.people[0].publicLinkedinUrl='https://linkedin.com/in/anna-buyer';require('./helpers/buyer-research-receipts.cjs')(f.c);let accepted=0;f.adapter.accept=async()=>{accepted++;};
 const original=f.w.fetch;f.w.fetch=async(url,options)=>url.includes('/email?')?{ok:true,json:async()=>({contact})}:original(url,options);
 assert.equal(await f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]),false);assert.equal(accepted,0);assert.match(f.c.people[0].contactVerification.issues.join(' '),/identity|invalid|match/i);f.close();
});

test('automatic work started before workspace-reset cannot adopt the reloaded policy',async()=>{
 const f=runtime({enabled:true});await f.loaded;const started=deferred(),response=deferred(),original=f.w.fetch;let count=0;
 f.w.dispatchEvent(new f.w.Event('leadintel:workspace-reset'));
 f.w.fetch=async(url,options)=>{if(url.includes('/policy')&&++count===1){started.resolve();return response.promise;}return original(url,options);};
 const old=f.w.LeadIntelAdditionalContacts.auto(f.c,{trigger:'research_completed'});await started.promise;
 f.w.dispatchEvent(new f.w.Event('leadintel:workspace-reset'));await f.w.LeadIntelAdditionalContacts.load();
 response.resolve({ok:true,json:async()=>({policy:{enabled:true,provider:'apollo',dailyLimit:3,monthlyLimit:30,maxPerCompany:2}})});await old;
 assert.equal(paidPosts(f).length,0);f.close();
});
test('Treg daily-limit changes during approval require a fresh review before submission',async()=>{
 const f=runtime();await f.loaded;await configureTreg(f);const started=deferred(),approval=deferred();f.w.LeadIntelDialogs.confirm=()=>{started.resolve();return approval.promise;};
 const run=f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{channel:'phone',dataLookup:true});await started.promise;
 const original=f.w.fetch;f.w.fetch=async(url,options)=>url.includes('/policy')?{ok:true,json:async()=>({policy:{provider:'treg',enabled:true,phoneEnabled:true,maxPerCompany:1,dailyLimit:1,monthlyLimit:150}})}:original(url,options);await f.w.LeadIntelAdditionalContacts.load();
 approval.resolve(true);assert.equal(await run,false);assert.equal(paidPosts(f).length,0);f.close();
});
test('Klas historical token rejection remains a saved attempt after successful settings refresh',async()=>{
 const f=runtime();await f.loaded;const p=f.c.people[0];p.name='Klas Andersson';require('./helpers/buyer-research-receipts.cjs')(f.c);
 p.contactVerification={status:'error',checkedAt:'2026-10-01T00:00:00Z',issues:['Treg rejected the saved team token']};await configureTreg(f);
 const html=f.w.LeadIntelAdditionalContacts.card(f.c,p);assert.match(html,/Saved lookup attempt/);assert.doesNotMatch(html,/new connection failed|connection is invalid|current token rejected/i);assert.equal(paidPosts(f).length,0);f.close();
});
test('reordering the active buyer while approval is open still requests the exact Teemu identity',async()=>{
 const f=runtime();await f.loaded;const selected=f.c.people[1];selected.name='Teemu Kettunen';require('./helpers/buyer-research-receipts.cjs')(f.c);
 f.w.LeadIntelDialogs.confirm=async()=>{f.c.people.reverse();return true;};const original=f.w.fetch;
 f.w.fetch=async(url,options)=>url.includes('/email?')?(f.calls.push([url,options]),{ok:true,json:async()=>({contact:{external_person_id:selected.id,name:selected.name,work_email:'teemu@example.com'}})}):original(url,options);
 assert.equal(await f.w.LeadIntelAdditionalContacts.confirm(f.c,selected),true);assert.equal(JSON.parse(paidPosts(f)[0][1].body).person_id,selected.id);assert.equal(f.contact.has(selected.id),true);f.close();
});
test('replaced bridge with equal user/workspace IDs cannot adopt an earlier automatic policy request',async()=>{
 const f=runtime({enabled:true});await f.loaded;const started=deferred(),response=deferred(),original=f.w.fetch;
 f.w.dispatchEvent(new f.w.Event('leadintel:workspace-reset'));
 f.w.fetch=async(url,options)=>{if(url.includes('/policy')){started.resolve();return response.promise;}return original(url,options);};
 const old=f.w.LeadIntelAdditionalContacts.auto(f.c,{trigger:'research_completed'});await started.promise;
 const bridge=f.w.LeadIntelServerBridge;f.w.LeadIntelServerBridge={...bridge,workspace:{...bridge.workspace},session:{...bridge.session}};
 response.resolve({ok:true,json:async()=>({policy:{enabled:true,provider:'apollo',dailyLimit:3,monthlyLimit:30,maxPerCompany:2}})});await old;
 assert.equal(paidPosts(f).length,0);f.close();
});
for(const contact of [{name:'Anna Andersson',work_email:'anna@example.com'},{external_person_id:'p0',work_email:'anna@example.com'}])test(`paid contact missing a required identity anchor is rejected: ${JSON.stringify(contact)}`,async()=>{
 const f=runtime();await f.loaded;let accepted=0;f.adapter.accept=async()=>{accepted++;};const original=f.w.fetch;
 f.w.fetch=async(url,options)=>url.includes('/email?')?{ok:true,json:async()=>({contact})}:original(url,options);
 assert.equal(await f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]),false);assert.equal(accepted,0);assert.match(f.c.people[0].contactVerification.issues.join(' '),/identity|match/i);f.close();
});
for(const change of ['workspace reset','same-ID replacement'])test(`stale ${change} lookup cannot block a fresh explicit request or clear its pending marker`,async()=>{
 const f=runtime();await f.loaded;const firstStarted=deferred(),oldResponse=deferred(),newResponse=deferred(),pending=new Map(),original=f.w.fetch;let count=0;
 f.adapter.pending=(_c,p,on,token)=>{if(on)pending.set(p.id,token);else if(pending.get(p.id)===token)pending.delete(p.id);};
 f.w.fetch=async(url,options)=>{if(!url.includes('/email?'))return original(url,options);f.calls.push([url,options]);if(++count===1){firstStarted.resolve();return oldResponse.promise;}return newResponse.promise;};
 const oldPerson=f.c.people[0],old=f.w.LeadIntelAdditionalContacts.run(f.c,oldPerson);await firstStarted.promise;
 if(change==='workspace reset'){f.w.dispatchEvent(new f.w.Event('leadintel:workspace-reset'));await f.w.LeadIntelAdditionalContacts.load();}else{f.c.people[0]={...oldPerson,name:'Klas Andersson'};require('./helpers/buyer-research-receipts.cjs')(f.c);}
 const selected=f.c.people[0],fresh=f.w.LeadIntelAdditionalContacts.run(f.c,selected);await new Promise(r=>setTimeout(r,0));const submittedBeforeOldCompletes=count;
 oldResponse.resolve({ok:true,json:async()=>({contact:{external_person_id:oldPerson.id,name:oldPerson.name,work_email:'old@example.com'}})});await old;
 const pendingAfterOld=pending.size;newResponse.resolve({ok:true,json:async()=>({contact:{external_person_id:selected.id,name:selected.name,work_email:'fresh@example.com'}})});await fresh;
 assert.equal(submittedBeforeOldCompletes,2);assert.equal(pendingAfterOld,1);assert.equal(pending.size,0);assert.equal(f.contact.get(selected.id).work_email,'fresh@example.com');f.close();
});
for(const result of [{},{contact:false},{contact:null,research:{}}])test(`empty malformed paid response remains an error rather than a completed zero result: ${JSON.stringify(result)}`,async()=>{
 const f=runtime();await f.loaded;const original=f.w.fetch;f.w.fetch=async(url,options)=>url.includes('/email?')?{ok:true,json:async()=>result}:original(url,options);
 assert.equal(await f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]),false);assert.equal(f.c.people[0].contactVerification.status,'error');assert.match(f.c.people[0].contactVerification.issues.join(' '),/invalid|unreadable|malformed/i);f.close();
});
for(const phase of ['provider','policy'])test(`paid operation pins the registered research context during ${phase} await`,async()=>{
 const f=runtime();await f.loaded;let revision='strategy-one';f.adapter.context=()=>revision;const started=deferred(),response=deferred(),original=f.w.fetch;
 if(phase==='policy')f.w.dispatchEvent(new f.w.Event('leadintel:workspace-reset'));
 f.w.fetch=async(url,options)=>{if(url.includes(phase==='provider'?'/email?':'/policy')){if(phase==='provider')f.calls.push([url,options]);started.resolve();return response.promise;}return original(url,options);};
 const run=f.w.LeadIntelAdditionalContacts.run(f.c,f.c.people[0]);await started.promise;revision='strategy-two';
 response.resolve({ok:true,json:async()=>phase==='provider'?{contact:{external_person_id:'p0',name:'Anna Andersson',work_email:'anna@example.com'}}:{policy:{provider:'apollo',enabled:false,dailyLimit:3,monthlyLimit:30,maxPerCompany:2}}});
 assert.equal(await run,false);assert.equal(f.contact.size,0);assert.equal(f.c.people[0].contactVerification,undefined);if(phase==='policy')assert.equal(paidPosts(f).length,0);f.close();
});
test('automatic paid follow-up cannot continue under a newer registered research context',async()=>{
 const f=runtime({enabled:true});await f.loaded;let revision='strategy-one';f.adapter.context=()=>revision;const started=deferred(),response=deferred(),original=f.w.fetch;
 f.w.fetch=async(url,options)=>{if(url.includes('/email?')){f.calls.push([url,options]);started.resolve();return response.promise;}return original(url,options);};
 const run=f.w.LeadIntelAdditionalContacts.auto(f.c,{trigger:'research_completed'});await started.promise;revision='strategy-two';response.resolve({ok:true,json:async()=>({contact:null,research:{status:'not_found'}})});await run;
 assert.equal(paidPosts(f).length,1);assert.equal(f.c.people[0].contactVerification,undefined);assert.equal(f.c.people[1].contactVerification,undefined);f.close();
});
