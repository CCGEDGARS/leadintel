const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),P=require('../contact-confirmation-policy.js'),source=fs.readFileSync(require.resolve('../discovery-ui.js'),'utf8');
function install(ctx,name){const start=source.indexOf(`async function ${name}(`)>=0?source.indexOf(`async function ${name}(`):source.indexOf(`function ${name}(`),next=source.slice(start+1).search(/\n(?:async )?function /);vm.runInContext(source.slice(start,start+1+next),ctx);}
function fixture(){
 const person={id:'teemu',name:'Teemu Buyer',title:'COO',organization:'Example',kept:true,publicLinkedinUrl:'https://linkedin.com/in/teemu',linkedinConfirmedUrl:'https://linkedin.com/in/teemu'},candidate={domain:'example.com',company:'Example',crmId:'crm1',people:[person]},contact={id:'contact-teemu',company_id:'crm1',external_person_id:person.id,name:person.name,title:person.title,linkedin_url:person.publicLinkedinUrl,work_email:'teemu@example.com',email_status:'verified',verification_provider:'Apollo'};
 let meta={},saves=0;const events=[],b={ready:true,workspace:{id:'w1'},session:{authenticated:true,user:{id:'u1'}},saveNow:async()=>({saved:true}),getCrmCompany:async()=>({ok:true,company:{id:'crm1',normalized_domain:candidate.domain},contacts:[contact]}),saveCrmContacts:async()=>({ok:true}),recordCrmActivity:async()=>({ok:true})};
 const ctx={Date,LeadIntelDiscovery:D,discovery:{selectedProspects:[candidate],candidates:[],pipeline:[]},bridge:()=>b,discoveryOperationContext:()=>JSON.stringify([b.workspace.id,b.session.user.id]),canonicalDomain:D.canonicalDomain,crmAuthenticated:()=>b.session.authenticated,enrichmentPending:new Set(),enrichmentResults:new Map([[candidate.domain+'|'+person.id,{contact}]]),loadMeta:()=>meta,saveMeta:value=>{meta=value;},saveDiscovery(){saves++;},renderAll(){},renderSelectedEmailBuyer(){},showToast(){},renderDiscoveryFocus(){},ensureCrmCompany:async()=>({id:'crm1',normalized_domain:candidate.domain}),crmCompanyByDomain:()=>({id:'crm1'}),acceptedBuyerConfirmationLevel:()=> 'provider_verified',verifiedBuyerEmail:(_c,p,c)=>c.external_person_id===p.id&&P.accepted(c,candidate.domain,'provider_verified')?c.work_email:'',loadOutreachModules:async()=>{},window:{LeadIntelContactPolicy:P,LeadIntelCrm:{mapContacts:x=>x},dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},buyerSelectionRows:()=>[candidate]};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('const buyerActionPendingOwners='),source.indexOf('function crmToLocalPipeline(')),ctx);
 for(const name of ['addBuyerToFlow','startLinkedInBuyerMessage','saveBuyerLinkedInReview','selectedEmailBuyer','continueBuyerMessages'])install(ctx,name);
 return {ctx,person,candidate,contact,b,events,get meta(){return meta;},set meta(x){meta=x;},get saves(){return saves;}};
}
test('Email and LinkedIn handoffs preserve the original full recipient identity snapshot',async()=>{
 for(const channel of ['email','linkedin']){const h=fixture(),open=channel==='email'?'addBuyerToFlow':'startLinkedInBuyerMessage';assert.equal(await h.ctx[open](h.candidate.domain,0,{personId:h.person.id}),true);assert.equal(h.meta.scriptBuyer.recipientIdentity?.name,h.person.name);assert.equal(h.meta.scriptBuyer.recipientIdentity?.companyId,'crm1');}
});
test('lazy Messages loading cannot dispatch a buyer after identity, company or user changes',async()=>{
 for(const channel of ['email','linkedin'])for(const field of ['name','organization','profile','company','user']){
  const h=fixture();let finish;h.ctx.loadOutreachModules=()=>new Promise(resolve=>finish=resolve);const pending=h.ctx[channel==='email'?'addBuyerToFlow':'startLinkedInBuyerMessage'](h.candidate.domain,0,{personId:h.person.id});await new Promise(resolve=>setImmediate(resolve));assert.equal(typeof finish,'function');
  if(field==='name')h.person.name='Klas Replacement';if(field==='organization')h.person.organization='Other';if(field==='profile')h.person.publicLinkedinUrl='https://linkedin.com/in/klas';if(field==='company')h.candidate.crmId='crm2';if(field==='user')h.b.session.user.id='u2';
  finish();assert.equal(await pending,false,channel+'/'+field);assert.equal(h.events.length,0,channel+'/'+field);
 }
});
test('failed handoff synchronization preserves a newer recipient selection and flags',async()=>{
 for(const channel of ['email','linkedin']){const h=fixture();let finish;h.b.saveNow=()=>new Promise(resolve=>finish=resolve);const pending=h.ctx[channel==='email'?'addBuyerToFlow':'startLinkedInBuyerMessage'](h.candidate.domain,0,{personId:h.person.id});await new Promise(resolve=>setImmediate(resolve));h.meta={selectedEmailBuyer:{personId:'klas'},scriptBuyer:{personId:'klas'},activeJourneyStage:6};h.person.flowSelected=false;finish({saved:false});assert.equal(await pending,false);assert.equal(h.meta.scriptBuyer.personId,'klas');assert.equal(h.person.flowSelected,false);}
});
test('selectedEmailBuyer requires both original identity and exact confirmed CRM contact ID',async()=>{
 const h=fixture();assert.equal(await h.ctx.addBuyerToFlow(h.candidate.domain,0,{selectOnly:true,personId:h.person.id}),true);assert.ok(h.ctx.selectedEmailBuyer());h.meta.selectedEmailBuyer={...h.meta.selectedEmailBuyer,contactId:'obsolete'};assert.equal(h.ctx.selectedEmailBuyer(),null);
});
test('LinkedIn review rejects a same-ID replacement during CRM persistence',async()=>{
 for(const phase of ['company','contact','activity']){
  const h=fixture();let finish;if(phase==='company')h.ctx.ensureCrmCompany=()=>new Promise(resolve=>finish=resolve);if(phase==='contact')h.b.saveCrmContacts=()=>new Promise(resolve=>finish=resolve);if(phase==='activity')h.b.recordCrmActivity=()=>new Promise(resolve=>finish=resolve);
  const pending=h.ctx.saveBuyerLinkedInReview(h.candidate,h.person,h.person.publicLinkedinUrl,'w1');await new Promise(resolve=>setImmediate(resolve));h.person.name='Klas Replacement';finish(phase==='company'?{id:'crm1'}:{ok:true});await assert.rejects(pending,/context changed|Profile changed/);assert.equal(h.person.linkedinConfirmedAt,undefined,phase);
 }
});

test('an explicitly selected accepted manual recipient can continue while aggregate tasks remain open',async()=>{
 const h=fixture();assert.equal(await h.ctx.addBuyerToFlow(h.candidate.domain,0,{selectOnly:true,personId:h.person.id}),true);let blocked=0;h.ctx.buyerContinuationIssue=()=>({message:'Aggregate research pending'});h.ctx.pointToBuyerRequirement=()=>{blocked++;return false;};
 assert.equal(await h.ctx.continueBuyerMessages(),true);assert.equal(blocked,0);assert.equal(h.events[0].detail.personId,h.person.id);
});
test('message chooser resolves the original buyer by stable ID and rejects a changed identity',async()=>{
 for(const changed of [false,true]){
  const h=fixture();let handler,selected,closed=0;const button={dataset:{messageChoice:'0'},addEventListener:(_kind,fn)=>handler=fn},status={};h.ctx.esc=String;h.ctx.buyerContinuationIssue=()=>null;h.ctx.buyerReviewDialog=()=>({querySelectorAll:()=>[button],querySelector:()=>status,close(){closed++;}});h.ctx.addBuyerToFlow=async(...args)=>{selected=args;return true;};
  assert.equal(await h.ctx.continueBuyerMessages(),true);h.candidate.people.unshift({id:'klas',name:'Klas Buyer'});if(changed)h.person.name='Replacement Buyer';await handler();
  if(changed){assert.equal(selected,undefined);assert.equal(closed,0);}else{assert.equal(selected[2].personId,'teemu');assert.equal(closed,1);}
 }
});
test('an obsolete LinkedIn review dialog cannot confirm a same-ID replacement',async()=>{
 const h=fixture();let handler,writes=0;h.ctx.esc=String;h.ctx.buyerReviewDialog=()=>({querySelector:selector=>({addEventListener:(_event,fn)=>{if(selector==='[data-review-confirm]')handler=fn;}}),close(){}});h.ctx.saveBuyerLinkedInReview=async()=>{writes++;return true;};install(h.ctx,'reviewBuyerLinkedIn');
 await h.ctx.reviewBuyerLinkedIn(h.candidate.domain,0,{personId:h.person.id});h.person.name='Replacement Buyer';await handler({target:{disabled:false}});assert.equal(writes,0);
});
test('failed LinkedIn review sync preserves newer confirmation edits',async()=>{
 const h=fixture();let finish;h.b.saveNow=()=>new Promise(resolve=>finish=resolve);const pending=h.ctx.saveBuyerLinkedInReview(h.candidate,h.person,h.person.publicLinkedinUrl,'w1');await new Promise(resolve=>setImmediate(resolve));h.person.linkedinConfirmedAt='newer-manual-confirmation';finish({saved:false});await assert.rejects(pending,/could not be synced/);assert.equal(h.person.linkedinConfirmedAt,'newer-manual-confirmation');
});

test('CRM lookup cannot overwrite recipient metadata selected while the lookup was pending',async()=>{
 for(const channel of ['email','linkedin']){const h=fixture();let finish;h.b.getCrmCompany=()=>new Promise(resolve=>finish=resolve);const pending=h.ctx[channel==='email'?'addBuyerToFlow':'startLinkedInBuyerMessage'](h.candidate.domain,0,{personId:h.person.id});await new Promise(resolve=>setImmediate(resolve));h.meta={scriptBuyer:{personId:'klas'},selectedEmailBuyer:{personId:'klas'}};finish({ok:true,company:{id:'crm1',normalized_domain:h.candidate.domain},contacts:[h.contact]});assert.equal(await pending,false);assert.equal(h.meta.scriptBuyer.personId,'klas');assert.equal(h.events.length,0);}
});
