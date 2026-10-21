const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom');
const D=require('../discovery-engine.js'),P=require('../additional-contact-policy.js');
test('Treg automatic research accepts one qualified researched buyer without an unrelated incomplete buyer veto',()=>{
 const now=new Date().toISOString(),person={id:'p1',name:'Anna Buyer',title:'Head of Procurement',organization:'Example',publicNameUrl:'https://example.com/team',emailResearch:{status:'complete',searches:5,failed:0,checkedAt:now},contactResearch:{policyVersion:D.BUYER_CONTACT_RESEARCH_POLICY.version,checks:Object.fromEntries([...D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks,'deep'].map(k=>[k,{status:'complete',checkedAt:now,queryLog:Array.from({length:k==='gmail'?3:k==='direct_email'?2:1},(_,i)=>({query:k+' query '+i,status:'complete',checkedAt:now,resultCount:0}))}]))}};
 const candidate={company:'Example',domain:'example.com',qualification:{eligible:true,score:85,researchedAt:now},people:[person,{id:'pending',name:'Another Buyer'}],publicResearch:{accountability:{...D.createBuyerResearchAccountability(),status:'partial',officialPages:1,completedAt:now}}};
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
 const button=w.document.querySelector('[data-paid-search-toggle]');assert.ok(button);assert.equal(button.parentElement,w.document.querySelector('#delivery-setup-save').parentElement);assert.match(w.document.body.textContent,/\$0\.30/);assert.match(w.document.body.textContent,/AI/);
 button.click();await new Promise(r=>setTimeout(r,20));assert.equal(writes.at(-1).provider,'treg');assert.equal(writes.at(-1).enabled,true);assert.equal(w.document.querySelector('[data-paid-search-toggle]').getAttribute('aria-pressed'),'true');
 w.document.querySelector('[data-paid-search-toggle]').click();await new Promise(r=>setTimeout(r,20));assert.equal(writes.at(-1).enabled,false);dom.window.close();
});
