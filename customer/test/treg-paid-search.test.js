const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const D=require('../discovery-engine.js'),P=require('../additional-contact-policy.js');
test('Treg automatic research accepts one qualified researched buyer without an unrelated incomplete buyer veto',()=>{
 const now=new Date().toISOString(),person={id:'p1',name:'Anna Buyer',title:'Head of Procurement',organization:'Example',publicNameUrl:'https://example.com/team',emailResearch:{status:'complete',searches:5,failed:0,checkedAt:now},contactResearch:{policyVersion:D.BUYER_CONTACT_RESEARCH_POLICY.version,checks:Object.fromEntries([...D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks,'deep'].map(k=>[k,{status:'complete',checkedAt:now,queryLog:Array.from({length:k==='gmail'?3:k==='direct_email'?2:1},(_,i)=>({query:k+' query '+i,status:'complete',checkedAt:now,resultCount:0}))}]))}};
 const candidate={company:'Example',domain:'example.com',qualification:{eligible:true,score:85,researchedAt:now},people:[person,{id:'pending',name:'Another Buyer'}],publicResearch:{accountability:{...D.createBuyerResearchAccountability(),status:'partial',officialPages:1,completedAt:now}}};
 require('./helpers/buyer-research-receipts.cjs')({...candidate,people:[person]},now);candidate.publicResearch.aiReview={status:'complete',checkedAt:now,inputSignature:D.buyerReviewSignature(candidate),reviewedPersonIds:[person.id],conflicts:[],findings:[]};
 const ready=P.readiness(candidate,person,{automatic:true,provider:'treg'});assert.equal(ready.eligible,true,ready.reason+' '+JSON.stringify(D.buyerResearchAssessment(person)));
 person.contactResearch.checks.gmail.status='partial';assert.equal(P.readiness(candidate,person,{automatic:true,provider:'treg'}).eligible,false);
});
test('Workflow settings mounts the paid toggle beside Save and removes the additional research accordion',async()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');assert.doesNotMatch(html,/Additional email research/);
 const dom=new JSDOM('<section id="delivery-setup"><div class="delivery-settings-footer"><button id="delivery-setup-save">Save settings</button></div></section>',{url:'https://leadintel.example',runScripts:'outside-only'}),w=dom.window;
 w.AbortSignal=AbortSignal;w.LeadIntelAdditionalContactPolicy=P;w.LeadIntelServerBridge={workspace:{id:'w',role:'owner'},session:{authenticated:true}};
 let policy={enabled:false,provider:'treg',dailyLimit:5,monthlyLimit:150,maxPerCompany:1},writes=[];
 w.LeadIntelDialogs={confirm:async()=>true};w.fetch=async(url,options={})=>{if(options.method==='PUT'){writes.push(JSON.parse(options.body));policy={...policy,...JSON.parse(options.body)};}return {ok:true,json:async()=>url.includes('/policy')?{policy,role:'owner'}:{providers:[{provider:'treg',configured:true,source:'customer'}]}};};
 w.eval(fs.readFileSync(require.resolve('../additional-contact-services.js'),'utf8'));await w.LeadIntelAdditionalContacts.load();
 const button=w.document.querySelector('[data-paid-search-toggle]');assert.ok(button);assert.equal(button.parentElement,w.document.querySelector('#delivery-setup-save').parentElement);assert.match(w.document.body.textContent,/€0\.30/);assert.match(w.document.body.textContent,/AI/);
 button.click();await new Promise(r=>setTimeout(r,20));assert.equal(writes.at(-1).provider,'treg');assert.equal(writes.at(-1).enabled,true);assert.equal(w.document.querySelector('[data-paid-search-toggle]').getAttribute('aria-pressed'),'true');
 w.document.querySelector('[data-paid-search-toggle]').click();await new Promise(r=>setTimeout(r,20));assert.equal(writes.at(-1).enabled,false);dom.window.close();
});

async function controlsFixture(){
 const dom=new JSDOM('<section id="delivery-setup"><div class="delivery-settings-footer"><button id="delivery-setup-save">Save settings</button></div></section>',{url:'https://leadintel.example',runScripts:'outside-only'}),w=dom.window;
 w.AbortSignal=AbortSignal;w.LeadIntelAdditionalContactPolicy=P;w.LeadIntelServerBridge={workspace:{id:'w',role:'owner'},session:{authenticated:true}};
 let policy={enabled:false,phoneEnabled:false,provider:'treg',dailyLimit:5,monthlyLimit:150,maxPerCompany:1};const requests=[];
 w.LeadIntelDialogs={confirm:async()=>true};w.fetch=async(url,options={})=>{requests.push({url,options});if(options.method==='PUT')policy={...policy,...JSON.parse(options.body)};return {ok:true,json:async()=>url.includes('/policy')?{policy,role:'owner'}:{providers:[{provider:'treg',configured:true,source:'customer'}]}};};
 w.eval(fs.readFileSync(require.resolve('../additional-contact-services.js'),'utf8'));await w.LeadIntelAdditionalContacts.load();
 return {dom,w,requests,click:async selector=>{w.document.querySelector(selector).click();await new Promise(r=>setTimeout(r,20));}};
}
test('email and phone controls save independently, retain each other, reload and never execute paid lookups',async()=>{
 const f=await controlsFixture(),{w}=f;const email='[data-paid-search-toggle]',phone='[data-paid-phone-toggle]';
 assert.ok(w.document.querySelector(phone),'Setup needs a separate phone control');
 assert.match(w.document.querySelector(email).textContent,/Activate paid email search/);assert.match(w.document.querySelector(phone).textContent,/Activate paid phone search/);
 assert.match(w.document.body.textContent,/€0\.30/);assert.match(w.document.body.textContent,/€0\.20/);
 await f.click(phone);assert.equal(w.LeadIntelAdditionalContacts.policy().enabled,false);assert.equal(w.LeadIntelAdditionalContacts.policy().phoneEnabled,true);
 await f.click(email);assert.match(w.document.body.textContent,/€0\.50/);assert.equal(w.document.querySelector(phone).getAttribute('aria-pressed'),'true');
 await f.click(email);assert.equal(w.LeadIntelAdditionalContacts.policy().phoneEnabled,true);assert.equal(w.LeadIntelAdditionalContacts.policy().enabled,false);
 await w.LeadIntelAdditionalContacts.load();assert.equal(w.document.querySelector(phone).getAttribute('aria-pressed'),'true');
 w.document.getElementById('delivery-setup-save').click();assert.ok(f.requests.every(r=>/\/policy|\/status/.test(r.url)),'Preferences must not start paid lookup or sending');
 await f.click(phone);assert.equal(w.LeadIntelAdditionalContacts.policy().phoneEnabled,false);f.dom.window.close();
});
test('cancelled activation and workspace reset cannot retain paid phone consent',async()=>{
 const f=await controlsFixture();f.w.LeadIntelDialogs.confirm=async()=>false;
 assert.ok(f.w.document.querySelector('[data-paid-phone-toggle]'));await f.click('[data-paid-phone-toggle]');assert.equal(f.requests.filter(r=>r.options.method==='PUT').length,0);
 f.w.LeadIntelServerBridge.workspace.id='other';f.w.dispatchEvent(new f.w.Event('leadintel:workspace-reset'));
 assert.equal(f.w.document.querySelector('[data-paid-phone-toggle]').disabled,true);assert.equal(f.w.document.querySelector('[data-paid-phone-toggle]').getAttribute('aria-pressed'),'false');f.dom.window.close();
});

test('activating a paid preference never launches research through the buyer render callback',async()=>{
 const f=await controlsFixture(),{w}=f,now=new Date().toISOString();
 const person={id:'p1',name:'Anna Buyer',title:'Head of Procurement',organization:'Example',publicNameUrl:'https://example.com/team',emailResearch:{status:'complete',searches:5,failed:0,checkedAt:now},contactResearch:{policyVersion:D.BUYER_CONTACT_RESEARCH_POLICY.version,checks:Object.fromEntries([...D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks,'deep'].map(k=>[k,{status:'complete',checkedAt:now,queryLog:Array.from({length:k==='gmail'?3:k==='direct_email'?2:1},(_,i)=>({query:k+' query '+i,status:'complete',checkedAt:now,resultCount:0}))}]))}};
 const candidate={company:'Example',domain:'example.com',qualification:{eligible:true,score:85,researchedAt:now},people:[person],publicResearch:{accountability:{...D.createBuyerResearchAccountability(),status:'complete',officialPages:1,completedAt:now}}};
 w.LeadIntelDiscovery=D;w.LeadIntelOutreachAutomationUI={getPolicy:()=>({mode:'automatic'})};
 w.LeadIntelAdditionalContacts.register({rows:()=>[candidate],assessment:()=>candidate.qualification,email:()=>'',prepare:async()=>({id:'c'}),pending(){},render(){queueMicrotask(()=>w.LeadIntelAdditionalContacts.auto(candidate));}});
 await w.LeadIntelAdditionalContacts.load();await f.click('[data-paid-phone-toggle]');await new Promise(r=>setTimeout(r,30));
 assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0,'Activation is only a preference save, even with an automatic buyer view mounted');f.dom.window.close();
});

test('paid permissions do not claim remaining budget and historical holds respect the current sync gate',async()=>{
 const f=await controlsFixture();try{
 await f.click('[data-paid-search-toggle]');const note=f.w.document.querySelector('[data-paid-search-status]');assert.match(note.textContent,/permission, not remaining budget/);
 const person={id:'p',contactVerification:{status:'error',issues:['Treg · error: Additional-services lookup limit reached or approval was revoked']}};
 f.w.LeadIntelServerBridge.conflict=true;
 const blocked=f.w.LeadIntelAdditionalContacts.card({domain:'example.com'},person);assert.match(blocked,/Saved lookup attempt/);assert.match(blocked,/That paid lookup was blocked/);assert.doesNotMatch(blocked,/Paid lookup is paused/);assert.match(blocked,/Resolve workspace sync before using Recheck/);assert.doesNotMatch(blocked,/Recheck remains available/);
 f.w.LeadIntelServerBridge.conflict=false;assert.match(f.w.LeadIntelAdditionalContacts.card({domain:'example.com'},person),/Recheck remains available/);
 assert.equal(f.requests.filter(r=>r.options.method==='POST').length,0);
 }finally{f.dom.window.close();}
});
