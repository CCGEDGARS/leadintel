const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js');
function fixture(){const now=new Date().toISOString();const c={company:'Example',domain:'example.com',market:'Sweden',qualification:{eligible:true,researchedAt:now,version:2,qualificationKind:'company',companyScore:85},people:Array.from({length:4},(_,i)=>({id:'p'+i,name:'Anna Buyer'+i,title:i===0?'Head of Procurement':'Project Director',organization:'Example',publicNameUrl:'https://example.com/team/'+i,emailResearch:{status:'complete',searches:5,failed:0,checkedAt:now},contactResearch:{policyVersion:D.BUYER_CONTACT_RESEARCH_POLICY.version,checks:Object.fromEntries([...D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks,'deep'].map(k=>[k,{status:'complete',checkedAt:now,queryLog:Array.from({length:k==='gmail'?3:k==='direct_email'?2:1},(_,i)=>({query:k+' business source query '+i,status:'complete',checkedAt:now,resultCount:0}))}]))}}))};c.publicResearch={accountability:{...D.createBuyerResearchAccountability(),status:'complete',completedAt:now,totalPeople:4,checkedPeople:4,officialPages:1}};return c;}
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
 w.fetch=async(url,opts={})=>{calls.push([url,opts]);let value=url.includes('/policy')?{policy}:url.includes('/services/status')?{providers:[{provider:'apollo',configured:connected,source:connected?'customer':'none',metadata:{email_enrichment_enabled:true}}]}:{contact:{work_email:'anna@example.com',name:'Anna Buyer0'}};return {ok:true,json:async()=>value};};
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
 ctx.b={workspace:{id:'a'},saveCrmCompany:async()=>{writes.push(ctx.b.workspace.id);return {ok:true};},saveNow:async()=>({saved:true})};
 const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),start=source.indexOf('window.LeadIntelAdditionalContacts?.register({'),end=source.indexOf('initDiscoveryWhenReady();',start);vm.runInNewContext(source.slice(start,end),ctx);
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
 f.w.fetch=async(url,opts={})=>{f.calls.push([url,opts]);return {ok:true,json:async()=>url.includes('/policy')?{policy:{enabled:true,dailyLimit:3,monthlyLimit:30,maxPerCompany:2,updatedAt:'now'}}:url.includes('/services/status')?{providers:[{provider:'apollo',configured:true,source:'customer',metadata:{email_enrichment_enabled:true}}]}:{contact:{work_email:'anna@example.com',name:'Anna Buyer0'}}};};
 await f.w.LeadIntelAdditionalContacts.load();await f.w.LeadIntelAdditionalContacts.auto(f.c);await new Promise(r=>setTimeout(r,10));assert.equal(f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?')).length,2);f.close();
});
test('stale company verification cannot authorize additional services despite a saved eligible flag',()=>{const P=require('../additional-contact-policy.js'),c=fixture();c.qualification.researchedAt='2001-01-01';assert.equal(P.readiness(c,c.people[0]).eligible,false);});
test('newer paid Hunter evidence restores from CRM without repeating equal-timestamp public research',()=>{
 const candidate=fixture(),stamp=new Date(Date.now()-60000).toISOString(),checked_at=new Date().toISOString();candidate.buyerDiscovery={checkedAt:stamp};
 const saved=JSON.parse(JSON.stringify(candidate.people));saved[0].hunterChecks={'anna@example.com':{status:'valid',deliverability:'deliverable',checked_at}};
 const detail={company:{normalized_domain:'example.com'},intelligence:{research_snapshot:{buyerResearch:{version:2,checkedAt:stamp,buyers:saved}}}},source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8'),ctx={Date,LeadIntelDiscovery:D,canonicalDomain:D.canonicalDomain};
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
 else {const body=JSON.parse(options.body);if(body.provider==='hunter'){hunterCalls++;value={contact:{work_email:'anna@example.com',name:'Anna Buyer0'},research:{provider:'hunter',status:'verified'}};}else value={contact:null,reason:'No verified work email returned',research:{provider:'apollo',status:'not_found'}};}
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
 f.w.fetch=async(url,options={})=>{f.calls.push([url,options]);return {ok:true,json:async()=>url.includes('/policy')?{policy:{provider:'treg',enabled:true,phoneEnabled:true,maxPerCompany:1,dailyLimit:5,monthlyLimit:150},role:'owner'}:url.includes('/status')?{providers:[{provider:'treg',configured:true,source:'customer'}]}:{contact:{name:'Anna Buyer0',work_email:'anna@example.com',email_status:'verified'}}};};
 await f.w.LeadIntelAdditionalContacts.load();
 await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.c.people[0],{channel,dataLookup:channel==='phone'});
 const requests=f.calls.filter(c=>Array.isArray(c)&&c[0].includes('/email?'));assert.equal(requests.length,1);
 const body=JSON.parse(requests[0][1].body);assert.equal(body.phone_approved,channel==='phone');assert.equal(body.email_lookup,channel==='email');f.close();
});

for(const phoneEnabled of [false,true])test(`automatic Treg phone lookup follows Setup switch ${phoneEnabled?'ON':'OFF'}`,async()=>{
 const f=runtime();await f.loaded;f.w.LeadIntelDiscovery=D;f.w.LeadIntelOutreachAutomationUI={getPolicy:()=>({mode:'automatic'})};
 f.w.fetch=async(url,options={})=>{f.calls.push([url,options]);return {ok:true,json:async()=>url.includes('/policy')?{policy:{provider:'treg',enabled:true,phoneEnabled,maxPerCompany:1,dailyLimit:5,monthlyLimit:150},role:'owner'}:url.includes('/status')?{providers:[{provider:'treg',configured:true,source:'customer'}]}:{contact:{name:'Anna Buyer0',work_email:'anna@example.com',email_status:'verified'}}};};
 await f.w.LeadIntelAdditionalContacts.load();await f.w.LeadIntelAdditionalContacts.auto(f.c,{trigger:'research_completed'});
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
