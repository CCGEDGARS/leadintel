const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
async function fixture({email=true,phone=false,savedEmail=false,savedPhone=false}={}){
 const dom=new JSDOM('<section id="delivery-setup"><div class="delivery-settings-footer"><button id="delivery-setup-save">Save</button></div></section><section data-paid-contact-settings><div data-paid-settings-controls></div></section>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window,calls=[],pending=[];
 let policy={enabled:email,phoneEnabled:phone,provider:'treg',dailyLimit:5,monthlyLimit:150,maxPerCompany:1,updatedAt:'fixed'};
 const person={id:'p',name:'Anna Buyer',title:'Procurement Director',emailResearch:{checkedAt:'evidence'},contactData:savedPhone?{version:1,domain:'example.com',personId:'p',identityName:'Anna Buyer',phone:{status:'provider_listed',number:'+12025550142'}}:null},candidate={company:'Example',domain:'example.com',people:[person],qualification:{eligible:true,companyScore:85}};
 w.LeadIntelDiscovery=require('../discovery-engine.js');w.AbortSignal=AbortSignal;w.LeadIntelServerBridge={workspace:{id:'w',role:'owner'},session:{authenticated:true}};w.LeadIntelOutreachAutomationUI={getPolicy:()=>({mode:'manual'})};
 w.LeadIntelDialogs={confirm:async()=>true};w.LeadIntelAdditionalContactPolicy={readiness:()=>({eligible:true}),targets:(c,o)=>c.people.filter(p=>!o.confirmedEmail(p)).slice(0,1)};
 w.fetch=async(url,options={})=>{if(options.method==='PUT'){policy={...policy,...JSON.parse(options.body)};calls.push({kind:'policy',body:JSON.parse(options.body)});}if(options.method==='POST'){calls.push({kind:'lookup',body:JSON.parse(options.body)});return {ok:true,json:async()=>({contact:null,request:{status:'not_found'},research:{status:'not_found'}})};}return {ok:true,json:async()=>url.includes('/policy')?{policy,role:'owner'}:{providers:[{provider:'treg',configured:true,source:'customer'}]}};};
 w.eval(fs.readFileSync(require.resolve('../additional-contact-services.js'),'utf8'));
 w.LeadIntelAdditionalContacts.register({rows:()=>[candidate],assessment:c=>c.qualification,email:()=>savedEmail?'anna@example.com':'',baseEmail:()=>savedEmail?'anna@example.com':'',prepare:async()=>({id:'company'}),saveOutcome(){},render(){},pending:(c,p,on)=>pending.push(on)});await w.LeadIntelAdditionalContacts.load();return {dom,w,candidate,person,calls};
}
test('automatic paid research runs after research in manual delivery mode and does not run on load or render',async()=>{
 const f=await fixture();assert.equal(f.calls.filter(r=>r.kind==='lookup').length,0);
 await f.w.LeadIntelAdditionalContacts.auto(f.candidate);assert.equal(f.calls.filter(r=>r.kind==='lookup').length,0);
 await f.w.LeadIntelAdditionalContacts.auto(f.candidate,{trigger:'research_completed'});const rows=f.calls.filter(r=>r.kind==='lookup');assert.equal(rows.length,1);assert.equal(rows[0].body.automatic,true);assert.equal(rows[0].body.email_lookup,true);assert.equal(rows[0].body.phone_approved,false);
 await f.w.LeadIntelAdditionalContacts.auto(f.candidate,{trigger:'research_completed'});assert.equal(f.calls.filter(r=>r.kind==='lookup').length,1);f.dom.window.close();
});
test('main Settings and Step 1 share independent persisted phone controls',async()=>{
 const f=await fixture();assert.ok(f.w.document.querySelector('[data-paid-contact-settings] [data-paid-phone-toggle]'));
 f.w.document.querySelector('[data-paid-contact-settings] [data-paid-phone-toggle]').click();await new Promise(r=>setTimeout(r,10));assert.equal(f.w.LeadIntelAdditionalContacts.policy().enabled,true);assert.equal(f.w.LeadIntelAdditionalContacts.policy().phoneEnabled,true);assert.equal(f.w.document.querySelector('#delivery-setup [data-paid-phone-toggle]').getAttribute('aria-pressed'),'true');assert.equal(f.calls.filter(r=>r.kind==='lookup').length,0);f.dom.window.close();
});
test('manual data and phone buttons request only their own channel and respect phone OFF',async()=>{
 const f=await fixture({email:true,phone:true});await f.w.LeadIntelAdditionalContacts.confirm(f.candidate,f.person,{dataLookup:true,emailOnly:true});await f.w.LeadIntelAdditionalContacts.confirm(f.candidate,f.person,{dataLookup:true,phoneOnly:true});const rows=f.calls.filter(r=>r.kind==='lookup');assert.equal(rows[0].body.email_lookup,true);assert.equal(rows[0].body.phone_approved,false);assert.equal(rows[1].body.email_lookup,false);assert.equal(rows[1].body.phone_approved,true);f.dom.window.close();
 const off=await fixture();await off.w.LeadIntelAdditionalContacts.confirm(off.candidate,off.person,{dataLookup:true,phoneOnly:true});assert.equal(off.calls.filter(r=>r.kind==='lookup').length,0);off.dom.window.close();
});
test('Settings and paid-research entry scripts receive the new cache version together',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8');for(const file of ['ai-settings','additional-contact-services']){const match=html.match(new RegExp(file+'\\.js\\?([^"\\s]+)'));assert.ok(match);assert.ok(match[1].includes('paid-controls=20261029-v1'),file+' cache marker missing');}
});

test('automatic research reuses saved email and phone rather than buying completed channels again',async()=>{
 const phone=await fixture({email:true,phone:true,savedEmail:true});await phone.w.LeadIntelAdditionalContacts.auto(phone.candidate,{trigger:'research_completed'});const lookup=phone.calls.find(r=>r.kind==='lookup');assert.equal(lookup.body.email_lookup,false);assert.equal(lookup.body.phone_approved,true);phone.dom.window.close();
 const complete=await fixture({email:true,phone:true,savedEmail:true,savedPhone:true});await complete.w.LeadIntelAdditionalContacts.auto(complete.candidate,{trigger:'research_completed'});assert.equal(complete.calls.filter(r=>r.kind==='lookup').length,0);complete.dom.window.close();
});
test('blocked manual email research does not mark the separate phone channel as failed',async()=>{
 const f=await fixture({email:false,phone:true});await f.w.LeadIntelAdditionalContacts.confirm(f.candidate,f.person,{dataLookup:true,emailOnly:true});assert.equal(f.calls.filter(r=>r.kind==='lookup').length,0);assert.equal(f.person.contactVerification.lookup.phone,false);assert.equal(f.person.contactVerification.lookup.email,true);f.dom.window.close();
});
