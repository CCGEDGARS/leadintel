const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {JSDOM}=require('jsdom'),D=require('../discovery-engine.js');
async function fixture(choice=true,provider='treg',phoneEnabled=true){
 const dom=new JSDOM('<main/>',{url:'https://example.test',runScripts:'outside-only'}),w=dom.window,calls=[],prompts=[];
 const p={id:'p',name:'Anna Buyer',title:'Director'},c={company:'Example',domain:'example.com',people:[p]};
 w.LeadIntelDiscovery=D;w.AbortSignal=AbortSignal;w.LeadIntelServerBridge={workspace:{id:'w',role:'owner'},session:{authenticated:true}};
 w.LeadIntelAdditionalContactPolicy={readiness:(c,p,o)=>({eligible:!o.confirmedEmail,reason:'Confirmed email already available'}),targets:()=>[]};
 w.LeadIntelDialogs={confirm:async(message,options)=>{prompts.push({message,options});return choice;}};
 const result={contact:{external_person_id:p.id,name:p.name,id:'crm-p',company_id:'crm-c',work_email:'anna@example.com',email_status:'verified'},contactData:{version:1,domain:'example.com',personId:'p',status:'updated',checkedAt:new Date().toISOString(),profile:{status:'provider_reported',title:'Director',city:'Riga'},phone:{status:'provider_listed',number:'+37120000001'}},research:{status:'verified',costMicro:15000}};
 w.fetch=async(url,o={})=>{if(o.method==='POST'){calls.push(JSON.parse(o.body));return {ok:true,json:async()=>result};}return {ok:true,json:async()=>url.includes('/policy')?{policy:{enabled:true,phoneEnabled,provider,dailyLimit:5,monthlyLimit:30,maxPerCompany:1}}:{providers:[{provider:'treg',configured:true,source:'customer'}]}};};
 w.eval(fs.readFileSync(require.resolve('../additional-contact-services.js'),'utf8'));
 w.LeadIntelAdditionalContacts.register({rows:()=>[c],email:()=> 'anna@example.com',baseEmail:()=> 'anna@example.com',assessment:()=>({eligible:true}),prepare:async()=>({id:'crm-c'}),accept:async()=>{},saveOutcome(){},pending(){},render(){}});await w.LeadIntelAdditionalContacts.load();return {dom,w,c,p,calls,prompts};
}
test('Confirm data runs manually even with confirmed email and active automatic paid consent, following the saved phone preference',async()=>{
 const f=await fixture();await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.p,{dataLookup:true});assert.equal(f.prompts.length,1);assert.equal(f.prompts[0].options.title,'Confirm data');assert.match(f.prompts[0].message,/€0\.50/);assert.equal(f.calls.length,1);assert.equal(f.calls[0].data_lookup,true);assert.equal(f.calls[0].phone_approved,true);assert.equal(f.calls[0].automatic,false);assert.equal(f.p.contactData.status,'updated');f.dom.window.close();
});
test('Cancel spends nothing; email and profile only never requests phone',async()=>{
 for(const choice of [false,true]){const f=await fixture(choice,'treg',false);await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.p,{dataLookup:true});assert.equal(f.calls.length,choice===false?0:1);if(f.calls.length)assert.equal(f.calls[0].phone_approved,false);f.dom.window.close();}
});
test('contact data survives normalization without turning a listed phone into verified email',()=>{
 const input={company:'Example',domain:'example.com',buyerSearchMode:'user_selected_target',people:[{id:'p',name:'Anna Buyer',title:'Director',contactData:{version:1,domain:'example.com',personId:'p',status:'updated',checkedAt:new Date().toISOString(),profile:{status:'provider_reported',city:'Riga'},phone:{number:'+37120000001',status:'provider_listed',source:'Treg'}}}]};
 const p=D.normalizeDiscoveryState({selectedProspects:[input]}).selectedProspects[0].people[0];assert.equal(p.contactData.profile.city,'Riga');assert.equal(p.contactData.phone.status,'provider_listed');assert.equal(p.contactVerification,null);
});

test('manual Treg data confirmation requires its own saved Treg policy',async()=>{const f=await fixture(true,'apollo');await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.p,{dataLookup:true});assert.equal(f.calls.length,0);f.dom.window.close();});
test('Confirm phone explicitly excludes email and profile purchases',async()=>{
 const f=await fixture();await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.p,{dataLookup:true,phoneOnly:true});assert.equal(f.calls.length,1);assert.equal(f.calls[0].email_lookup,false);assert.equal(f.calls[0].phone_approved,true);assert.match(f.prompts[0].message,/€0\.20/);f.dom.window.close();
});
test('blocked paid phone checks retain scoped error metadata through reload and keep the newer error visible',async()=>{
 const f=await fixture();f.p.contactData={version:1,personId:'p',domain:'example.com',status:'partial',checkedAt:'2026-10-28T08:53:00Z',phone:{status:'error',reason:'Treg rejected the saved team token.'}};
 f.w.fetch=async()=>({ok:false,json:async()=>({error:'LeadIntel company lookup limit reached (1/1). No provider lookup was started.',code:'ADDITIONAL_CONTACT_COMPANY_LIMIT'})});
 await f.w.LeadIntelAdditionalContacts.confirm(f.c,f.p,{dataLookup:true,phoneOnly:true});
 assert.equal(f.p.contactVerification.lookup.code,'ADDITIONAL_CONTACT_COMPANY_LIMIT');assert.equal(f.p.contactVerification.lookup.phone,true);assert.equal(f.p.contactVerification.lookup.email,false);
 const restored=D.normalizeDiscoveryState({selectedProspects:[{...f.c,buyerSearchMode:'user_selected_target'}]}).selectedProspects[0].people[0];assert.equal(restored.contactVerification.lookup.code,'ADDITIONAL_CONTACT_COMPANY_LIMIT');
 assert.match(f.w.LeadIntelAdditionalContacts.card(f.c,f.p),/company lookup limit reached/);f.dom.window.close();
});
