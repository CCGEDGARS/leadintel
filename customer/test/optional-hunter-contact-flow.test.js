const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function flow({enabled=false,cached=false,automatic=false,approved=true}={}){
 const calls=[],person={id:'apollo-anna',name:'Anna Buyer',publicNameUrl:'https://example.com/team',publicEmail:'anna@example.com',publicEmailUrl:'https://example.com/team'},candidate={domain:'example.com',people:[person]},results=new Map();
 if(cached)results.set('p',{contact:{work_email:'anna@example.com',email_status:'verified'}});
 const ctx={LEADINTEL_API:'https://api.example',console,Date,Promise,CONTACT_CONFIRM_VERSION:'v11',enrichmentPending:new Set(),enrichmentResults:results,LeadIntelDiscovery:{qualifyBuyer:()=>({eligible:true})},crmCompanyByDomain:()=>null,crmAuthenticated:()=>true,personKey:()=> 'p',renderAll(){},buyerAutomaticMode:()=>false,verifiedBuyerEmail:(c,p,x)=>x.email_status==='verified'?x.work_email:'',resolveApolloBuyer:async(c,p)=>p,ensureCrmCompany:async()=>({id:'c'}),canonicalDomain:x=>x,saveDiscovery(){},refreshCrmState:async()=>{},showToast(){},CustomEvent:class{},window:{dispatchEvent(){},LeadIntelCrm:{mapContacts:()=>[{}]}},bridge:()=>({workspace:{id:'w'},enrichCrmContact:async()=>{calls.push('apollo');return {ok:true,contact:{work_email:'anna@example.com',email_status:'verified'}};},saveCrmContacts:async()=>({ok:true})}),fetch:async url=>{calls.push(String(url));return {ok:true,json:async()=>String(url).includes('approved-workflow')?{status:approved?'automatic':'manual',config:{buyers:{confirmContacts:true}}}:String(url).includes('verify-email')?{status:'valid',deliverability:'deliverable',checked_at:new Date().toISOString()}:{providers:[{provider:'hunter',source:'customer',metadata:{additional_verification_enabled:enabled}}]}};}};
 vm.runInNewContext(source.slice(source.indexOf('async function confirmBuyerContact('),source.indexOf('const contactFlowPromises=')),ctx);
 return {ctx,calls,run:()=>ctx.confirmBuyerContact(candidate,0,{automatic}),person};
}
test('connected Hunter stays unused by default and Apollo runs first',async()=>{const f=flow();assert.equal(await f.run(),true);assert.equal(f.calls[0],'apollo');assert.equal(f.calls.some(c=>c.includes('/hunter/')),false);assert.equal(f.person.contactVerification.status,'verified');});
test('verified cached contacts avoid another Apollo lookup',async()=>{const f=flow({cached:true});await f.run();assert.equal(f.calls.includes('apollo'),false);assert.equal(f.calls.some(c=>c.includes('/hunter/')),false);});
test('explicit Hunter option checks one sourced address after Apollo',async()=>{const f=flow({enabled:true});await f.run();assert.equal(f.calls.filter(c=>c.includes('/hunter/verify-email')).length,1);assert.equal(f.calls.some(c=>c.includes('/hunter/find-email')),false);assert.equal(f.calls[0],'apollo');});
test('automatic Apollo enrichment requires saved owner approval',async()=>{const f=flow({automatic:true});assert.equal(await f.run(),true);assert.equal(f.calls.includes('apollo'),true);const blocked=flow({automatic:true,approved:false});assert.equal(await blocked.run(),false);assert.equal(blocked.calls.includes('apollo'),false);assert.equal(blocked.calls.some(c=>c.includes('/hunter/')),false);});

test('official source check precedes Apollo and an accepted public confirmation avoids paid enrichment',async()=>{
 const f=flow();f.ctx.publicBuyerSource=()=>({email:'anna@example.com'});
 f.ctx.confirmPublicBuyerSource=async()=>{f.calls.push('public-source');f.ctx.enrichmentResults.set('p',{contact:{work_email:'anna@example.com',email_status:'public_confirmed'}});return true;};
 f.ctx.verifiedBuyerEmail=(c,p,x)=>['verified','public_confirmed'].includes(x.email_status)?x.work_email:'';
 await f.run();assert.equal(f.calls[0],'public-source');assert.equal(f.calls.includes('apollo'),false);
});
test('strict delivery requirements still use Apollo after public identity confirmation',async()=>{
 const f=flow();f.ctx.publicBuyerSource=()=>({email:'anna@example.com'});
 f.ctx.confirmPublicBuyerSource=async()=>{f.calls.push('public-source');f.ctx.enrichmentResults.set('p',{contact:{work_email:'anna@example.com',email_status:'public_confirmed'}});return true;};
 await f.run();assert.deepEqual(f.calls.slice(0,2),['public-source','apollo']);
});
test('saved verified CRM contact is loaded before any paid enrichment',async()=>{
 const f=flow();f.ctx.crmCompanyByDomain=()=>({id:'c'});
 const old=f.ctx.bridge();f.ctx.bridge=()=>({...old,getCrmCompany:async()=>{f.calls.push('crm');return {ok:true,contacts:[{external_person_id:'apollo-anna',work_email:'anna@example.com',email_status:'verified'}]};}});
 await f.run();assert.equal(f.calls[0],'crm');assert.equal(f.calls.includes('apollo'),false);
});
test('qualification holds block both paid providers',async()=>{
 const f=flow({enabled:true});f.ctx.LeadIntelDiscovery.qualifyBuyer=()=>({eligible:false,gaps:['Employer mismatch']});
 assert.equal(await f.run(),false);assert.equal(f.calls.length,0);
});
