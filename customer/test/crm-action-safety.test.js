const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
function harness(overrides={}){
 const dom=new JSDOM('<!doctype html><head></head><body><div class="top-actions"></div><div id="toast"></div></body>',{url:'https://example.test/customer/',runScripts:'outside-only'}),w=dom.window;
 const company={id:'co',company_name:'Original Company',lifecycle_status:'prospect',pipeline_stage:'Qualified'};
 const events=[],calls=[];
 w.LeadIntelServerBridge={session:{authenticated:true,user:{id:'user-a'}},workspace:{id:'a',role:'owner'},listCrmCompanies:async()=>({ok:true,companies:[company]}),getCrmCompany:async id=>({ok:true,company:{...company,id,company_name:id==='co'?company.company_name:'Other Company'},contacts:[],activities:[],activity_next_cursor:null}),archiveCrmCompany:async id=>{calls.push(id);return {ok:true,company};},...overrides};
 w.LeadIntelDialogs={confirm:async()=>true};
 w.addEventListener('leadintel:crm-changed',event=>events.push(event.detail));
 const source=fs.readFileSync('customer/crm-ui.js','utf8').replace('})(window);','root.testAccess={state,loadCompanies,openCompany,action,archiveContact,findBuyersForSavedCompany};})(window);');
 w.eval(source);w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
 const flush=async()=>{for(let i=0;i<6;i++)await new Promise(r=>setImmediate(r));};
 async function select(){w.document.getElementById('open-crm').click();await flush();w.document.querySelector('[data-crm-view="all"]').click();await flush();await w.testAccess.openCompany('co');}
 return {dom,w,doc:w.document,company,events,calls,flush,select,h:w.testAccess,close:()=>w.close()};
}

for(const change of ['workspace','account','bridge','selection','closed','roundtrip','role'])test(`pending suppression is canceled after ${change} changes`,async()=>{
 let writes=0;const dialog=deferred(),r=harness({suppressCrmCompany:async()=>{writes++;return {ok:true};}});await r.select();let prompt;r.w.LeadIntelDialogs.confirm=message=>{prompt=message;return dialog.promise;};
 const pending=r.h.action('suppress');
 if(change==='workspace')r.w.LeadIntelServerBridge.workspace.id='b';
 if(change==='account')r.w.LeadIntelServerBridge.session.user.id='user-b';
 if(change==='bridge')r.w.LeadIntelServerBridge={...r.w.LeadIntelServerBridge};
 if(change==='selection')await r.h.openCompany('other');
 if(change==='closed')r.doc.querySelector('[data-crm-close]').click();
 if(change==='roundtrip'){r.w.LeadIntelServerBridge.workspace.id='b';r.w.dispatchEvent(new r.w.Event('leadintel:workspace-changed'));r.w.LeadIntelServerBridge.workspace.id='a';r.w.dispatchEvent(new r.w.Event('leadintel:workspace-changed'));}
 if(change==='role')r.w.LeadIntelServerBridge.workspace.role='viewer';
 dialog.resolve(true);await pending;
 assert.equal(writes,0,'an obsolete confirmation must never issue a mutation');assert.equal(r.events.length,0);assert.match(prompt,/Original Company/);r.close();
});

test('repeated company action is submitted once, reports pending and recovers after success',async()=>{
 const reply=deferred();let writes=0;const r=harness({archiveCrmCompany:()=>{writes++;return reply.promise;}});await r.select();
 const first=r.h.action('archive'),second=r.h.action('archive');
 assert.equal(writes,1);assert.equal(r.doc.querySelector('[data-crm-action="archive"]').disabled,true);assert.match(r.doc.getElementById('crm-company-detail').textContent,/Saving/);
 reply.resolve({ok:true,company:r.company});await Promise.all([first,second]);assert.equal(r.events.length,1);assert.equal(r.doc.querySelector('[data-crm-action="archive"]').disabled,false);r.close();
});

test('transport failure preserves the company, releases controls and offers explicit retry',async()=>{
 let writes=0;const r=harness({archiveCrmCompany:async()=>{writes++;if(writes===1)throw Error('offline');return {ok:true};}});await r.select();
 await assert.doesNotReject(r.h.action('archive'));assert.equal(r.h.state.detail.company.id,'co');assert.equal(r.events.length,0);
 const error=r.doc.querySelector('[data-crm-action-status]');assert.ok(error);assert.match(error.textContent,/could not confirm/i);assert.match(error.textContent,/refresh/i);assert.equal(r.doc.querySelector('[data-crm-action="archive"]').disabled,false);
 await r.h.action('archive');assert.equal(writes,2);assert.equal(r.events.length,1);r.close();
});

test('late mutation cannot replace the company the user opened afterwards',async()=>{
 const reply=deferred(),r=harness({archiveCrmCompany:()=>reply.promise});await r.select();const pending=r.h.action('archive');await r.h.openCompany('other');reply.resolve({ok:true,company:r.company});await pending;
 assert.equal(r.h.state.detail.company.id,'other');assert.equal(r.events.length,0);assert.doesNotMatch(r.doc.getElementById('toast').textContent,/CRM updated/);r.close();
});

for(const change of ['account','bridge','signed-out'])test(`late CRM reads cannot populate another ${change} context`,async()=>{
 const reply=deferred(),r=harness();await r.select();r.w.LeadIntelServerBridge.getCrmCompany=()=>reply.promise;const pending=r.h.openCompany('old');
 if(change==='account')r.w.LeadIntelServerBridge.session.user.id='new-user';
 if(change==='bridge')r.w.LeadIntelServerBridge={...r.w.LeadIntelServerBridge};
 if(change==='signed-out')r.w.LeadIntelServerBridge.session.authenticated=false;
 reply.resolve({ok:true,company:{id:'old',company_name:'Private old account'},activities:[],activity_next_cursor:null});await pending;
 assert.equal(r.h.state.detail,null);assert.doesNotMatch(r.doc.getElementById('crm-company-detail').textContent,/Private old account/);r.close();
});

test('same-workspace account activation clears already displayed CRM data before replacement read',async()=>{
 const reply=deferred(),r=harness();await r.select();r.w.LeadIntelServerBridge.session.user.id='new-user';r.w.LeadIntelServerBridge.listCrmCompanies=()=>reply.promise;r.w.dispatchEvent(new r.w.Event('leadintel:server-ready'));
 assert.equal(r.h.state.detail,null);assert.equal(r.h.state.companies.length,0);assert.doesNotMatch(r.doc.getElementById('crm-company-detail').textContent,/Original Company/);
 reply.resolve({ok:true,companies:[]});await r.flush();r.close();
});

test('viewer roles cannot submit company changes and suppressed restore remains owner-only',async()=>{
 const r=harness();await r.select();r.w.LeadIntelServerBridge.workspace.role='viewer';await r.h.action('archive');assert.equal(r.calls.length,0);
 r.w.LeadIntelServerBridge.workspace.role='sales';r.w.dispatchEvent(new r.w.Event('leadintel:server-ready'));await r.flush();await r.h.openCompany('co');r.h.state.detail.company.lifecycle_status='suppressed';let restores=0;r.w.LeadIntelServerBridge.restoreCrmCompany=async()=>{restores++;return {ok:true};};await r.h.action('restore');assert.equal(restores,0);r.close();
});

test('rejected backend result shows a record error without announcing success',async()=>{
 const r=harness({archiveCrmCompany:async()=>({ok:false,status:403,error:'Not permitted'})});await r.select();await r.h.action('archive');assert.equal(r.events.length,0);assert.match(r.doc.querySelector('[data-crm-action-status]').textContent,/Not permitted/);r.close();
});

test('failed action offers a real record refresh that does not repeat the mutation',async()=>{
 let writes=0,reads=0;const r=harness({archiveCrmCompany:async()=>{writes++;throw Error('connection lost');}});await r.select();
 r.w.LeadIntelServerBridge.getCrmCompany=async id=>{reads++;return {ok:true,company:{...r.company,id,lifecycle_status:'archived'},activities:[],activity_next_cursor:null};};
 await r.h.action('archive');const refresh=r.doc.querySelector('[data-crm-reload-record]');assert.ok(refresh,'unknown commit status needs a refresh action');refresh.click();await r.flush();
 assert.equal(reads,1);assert.equal(writes,1);assert.equal(r.h.state.detail.company.lifecycle_status,'archived');assert.equal(r.doc.querySelector('[data-crm-action-status]'),null);r.close();
});

test('permanent delete confirmation cannot continue after switching companies',async()=>{
 const dialog=deferred();let writes=0;const r=harness({deleteCrmCompany:async()=>{writes++;return {ok:true};}});await r.select();r.w.LeadIntelDialogs.confirm=()=>dialog.promise;const pending=r.h.action('delete-permanently');await r.h.openCompany('other');dialog.resolve(true);await pending;assert.equal(writes,0);assert.equal(r.h.state.detail.company.id,'other');r.close();
});

test('canceled confirmation unlocks the record without a write or an error',async()=>{
 let writes=0;const r=harness({suppressCrmCompany:async()=>{writes++;return {ok:true};}});await r.select();r.w.LeadIntelDialogs.confirm=async()=>false;await r.h.action('suppress');assert.equal(writes,0);assert.equal(r.doc.querySelector('[data-crm-action="suppress"]').disabled,false);assert.equal(r.doc.querySelector('[data-crm-action-status]'),null);r.close();
});

test('detecting account drift during a click also removes the displayed old record',async()=>{
 const r=harness();await r.select();r.w.LeadIntelServerBridge.session.user.id='other-user';await r.h.action('archive');assert.equal(r.calls.length,0);assert.doesNotMatch(r.doc.getElementById('crm-company-detail').textContent,/Original Company/);r.close();
});

test('late buyer lookup cannot save contacts after the same workspace changes account',async()=>{
 const reply=deferred();let saves=0;const r=harness({searchApolloPeople:()=>reply.promise,saveCrmContacts:async()=>{saves++;return {ok:true};}});await r.select();r.h.state.detail.company.normalized_domain='example.test';
 r.w.LeadIntelCrm={canonicalDomain:x=>x,lifecycleLabel:x=>x.lifecycle_status};r.w.LeadIntelDiscovery={buildApolloPeopleSearchPayload:()=>({person_titles:['Director']}),normalizeApolloPeople:x=>x.people,selectDecisionMakers:x=>x};
 const pending=r.h.findBuyersForSavedCompany();r.w.LeadIntelServerBridge.session.user.id='other';reply.resolve({ok:true,people:[{id:'person',name:'Buyer'}]});assert.equal(await pending,false);assert.equal(saves,0);r.close();
});

for(const navigation of ['same company','away and back','close and reopen'])test(`a dispatched save stays locked after ${navigation}`,async()=>{
 const reply=deferred();let writes=0;const r=harness({archiveCrmCompany:()=>{writes++;return reply.promise;}});await r.select();const first=r.h.action('archive');
 if(navigation==='away and back')await r.h.openCompany('other');
 if(navigation==='close and reopen'){r.doc.querySelector('[data-crm-close]').click();r.doc.getElementById('open-crm').click();await r.flush();}
 await r.h.openCompany('co');const disabled=r.doc.querySelector('[data-crm-action="archive"]').disabled,second=r.h.action('archive');reply.resolve({ok:true,company:r.company});await Promise.all([first,second]);
 assert.equal(writes,1);assert.equal(disabled,true);assert.equal(r.doc.querySelector('[data-crm-action="archive"]').disabled,false);r.close();
});

test('failed record refresh retains the original record and retry until a verified read succeeds',async()=>{
 const r=harness({archiveCrmCompany:async()=>{throw Error('offline');}});await r.select();await r.h.action('archive');r.w.LeadIntelServerBridge.getCrmCompany=async()=>{throw Error('still offline');};
 r.doc.querySelector('[data-crm-reload-record]').click();await r.flush();assert.equal(r.h.state.detail?.company.id,'co');assert.match(r.doc.querySelector('[data-crm-action-status]')?.textContent||'',/could not/i);assert.ok(r.doc.querySelector('[data-crm-reload-record]'));
 r.w.LeadIntelServerBridge.getCrmCompany=async()=>({ok:true,company:r.company,activities:[],activity_next_cursor:null});r.doc.querySelector('[data-crm-reload-record]').click();await r.flush();assert.equal(r.doc.querySelector('[data-crm-action-status]'),null);r.close();
});

test('a verified 404 after an uncertain delete reconciles the old row without another delete',async()=>{
 let writes=0;const r=harness({deleteCrmCompany:async()=>{writes++;throw Error('lost acknowledgement');}});await r.select();await r.h.action('delete-permanently');r.w.LeadIntelServerBridge.getCrmCompany=async()=>({ok:false,status:404,error:'CRM company not found'});r.w.LeadIntelServerBridge.listCrmCompanies=async()=>({ok:true,companies:[]});
 r.doc.querySelector('[data-crm-reload-record]').click();await r.flush();assert.equal(writes,1);assert.equal(r.h.state.detail,null);assert.equal(r.h.state.companies.length,0);assert.match(r.doc.getElementById('crm-company-detail').textContent,/no longer available/i);r.close();
});

test('a dispatched buyer-contact save also locks the company until its response settles',async()=>{
 const reply=deferred();let writes=0;const r=harness({searchApolloPeople:async()=>({ok:true,people:[{id:'person',name:'Buyer'}]}),saveCrmContacts:()=>reply.promise,archiveCrmCompany:async()=>{writes++;return {ok:true};}});await r.select();r.h.state.detail.company.normalized_domain='example.test';
 r.w.LeadIntelCrm={canonicalDomain:x=>x,lifecycleLabel:x=>x.lifecycle_status};r.w.LeadIntelDiscovery={buildApolloPeopleSearchPayload:()=>({person_titles:['Director']}),normalizeApolloPeople:x=>x.people,selectDecisionMakers:x=>x};
 const pending=r.h.findBuyersForSavedCompany();await r.flush();await r.h.openCompany('co');await r.h.action('archive');reply.resolve({ok:true});await pending;assert.equal(writes,0);assert.equal(r.doc.querySelector('[data-crm-action="archive"]').disabled,false);r.close();
});

test('confirmed permanent deletion emits the existing null-company event and removes the record',async()=>{
 let removed=false;const r=harness({deleteCrmCompany:async()=>{removed=true;return {ok:true};}});await r.select();r.w.LeadIntelServerBridge.listCrmCompanies=async()=>({ok:true,companies:removed?[]:[r.company]});
 await r.h.action('delete-permanently');assert.equal(r.h.state.detail,null);assert.equal(r.h.state.companies.length,0);assert.equal(r.events.length,1);assert.equal(r.events[0].company,null);r.close();
});
