const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
function harness(change={}){
 const person={id:'anna',name:'Anna Buyer',kept:true},candidate={domain:'example.com',crmId:'company',people:[person]},choice={channel:'email',workspaceId:'w1',domain:candidate.domain,personId:person.id,contactId:'contact-anna',email:'anna@example.com'};
 choice.recipientIdentity=require('./helpers/recipient-identity.cjs')(candidate,person,'company');
 const contact={company_id:'company',id:choice.contactId,external_person_id:person.id,name:person.name,work_email:choice.email,email_status:'verified',verification_provider:'Apollo',...change};
 const item={domain:candidate.domain,channel:'email',selectedPersonId:person.id,dossier:{people:[{id:person.id,name:person.name}]},drafts:{emailBody:'Manually saved draft'}};
 let opened=0,saves=0,prepared=0,meta={scriptBuyer:choice};
 const detail={ok:true,company:{id:'company',normalized_domain:'example.com'},contacts:[contact]},b={workspace:{id:'w1'},session:{authenticated:true,user:{id:'u1'}},ready:true,getCrmCompany:async()=>detail};
 const ctx={buyerHandoffRequest:0,DISCOVERY_META_KEY:'meta',readJson:()=>meta,crmBridge:()=>b,pipeline:()=>[candidate],followUpCompanyIds:new Map(),crmDomain:x=>x,window:{LeadIntelDiscovery:require('../discovery-engine.js'),LeadIntelContactPolicy:require('../contact-confirmation-policy.js')},outreach:{items:[item]},LeadIntelOutreach:{savedBuyerDraft:()=>item},currentItem:()=>null,cancelPendingScriptGeneration(){},saveOutreach(){saves++;},prepareStudioBuyer(){prepared++;},showOutreachStep(){opened++;},prepareMessageOnOpen(){}};
 vm.createContext(ctx);const start=source.indexOf('async function openVerifiedBuyerScripts('),end=source.indexOf('\n}',start)+2;vm.runInContext(source.slice(start,end),ctx);
 return {ctx,choice,contact,person,candidate,b,detail,get meta(){return meta;},set meta(value){meta=value;},get opened(){return opened;},get saves(){return saves;},get prepared(){return prepared;}};
}
test('reopening a saved email choice retains the exact accepted buyer and manual draft',async()=>{
 const h=harness();assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),true);assert.equal(h.ctx.handoffContact.contact.work_email,h.choice.email);assert.equal(h.opened,1);assert.equal(h.ctx.outreach.items[0].drafts.emailBody,'Manually saved draft');
});
test('a saved contact ID reassigned to a different identity cannot reopen as the selected buyer',async()=>{
 const h=harness({external_person_id:'bob',name:'Bob Buyer',work_email:'bob@example.com'});
 assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false);assert.equal(h.opened,0);assert.equal(h.ctx.handoffContact,undefined);
});
test('a saved contact whose email changed requires explicit recipient selection again',async()=>{
 const h=harness({work_email:'new-address@example.com'});
 assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false);assert.equal(h.opened,0);assert.equal(h.ctx.handoffContact,undefined);
});
test('same-name contact with conflicting external identity cannot reopen a saved email draft',async()=>{
 const h=harness({external_person_id:'bob'});assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false);assert.equal(h.saves,0);assert.equal(h.prepared,0);
});
test('blocked and role-held saved recipients cannot reopen even with an accepted CRM email',async()=>{
 for(const mode of ['suppressed','archived','role-changed','identity-pending','hold','conflict']){
  const h=harness();
  if(['suppressed','archived'].includes(mode))h.detail.company.lifecycle_status=mode;
  if(mode==='role-changed')h.candidate.buyerRolesChanged=true;
  if(mode==='identity-pending')h.person.identityStatus='pending';
  if(mode==='hold')h.person.opportunityScope={status:'review_required'};
  if(mode==='conflict')h.candidate.publicResearch={conflicts:[{person_id:h.person.id}]};
  assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false,mode);assert.equal(h.saves,0);assert.equal(h.prepared,0);
 }
});
test('late CRM responses cannot save or open a changed workspace, user, selection or identity',async()=>{
 for(const mode of ['workspace','user','selection','removed','identity','unkept']){
  const h=harness();let finish;h.b.getCrmCompany=()=>new Promise(resolve=>finish=resolve);
  const pending=h.ctx.openVerifiedBuyerScripts(h.choice);
  if(mode==='workspace')h.b.workspace.id='w2';
  if(mode==='user')h.b.session.user.id='u2';
  if(mode==='selection')h.meta={scriptBuyer:{...h.choice,personId:'bob'}};
  if(mode==='removed')h.candidate.people=[];
  if(mode==='identity')h.person.name='Bob Buyer';
  if(mode==='unkept')h.person.kept=false;
  finish(h.detail);assert.equal(await pending,false,mode);assert.equal(h.opened,0);assert.equal(h.saves,0);assert.equal(h.prepared,0);assert.equal(h.ctx.handoffContact,undefined);
  assert.equal(h.ctx.outreach.items[0].drafts.emailBody,'Manually saved draft');
 }
});
test('a changed selection while loading a saved CRM draft cannot commit the old recipient',async()=>{
 const h=harness();h.ctx.outreach.items[0].drafts.emailBody='';let finish;h.ctx.savedBuyerCrmDraft=()=>new Promise(resolve=>finish=resolve);
 const pending=h.ctx.openVerifiedBuyerScripts(h.choice);await new Promise(resolve=>setImmediate(resolve));h.meta={scriptBuyer:{...h.choice,personId:'bob'}};
 finish({domain:'example.com',selectedPersonId:'anna',drafts:{emailBody:'Old CRM draft'}});assert.equal(await pending,false);assert.equal(h.opened,0);assert.equal(h.saves,0);assert.equal(h.prepared,0);assert.equal(h.ctx.handoffContact,undefined);
});
test('a delayed handoff event cannot open a previously selected recipient',async()=>{
 const h=harness();h.meta={scriptBuyer:{...h.choice,personId:'bob'}};
 assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false);assert.equal(h.opened,0);assert.equal(h.saves,0);assert.equal(h.prepared,0);
});

test('CRM company/domain/contact ownership must match the selected buyer company',async()=>{
 for(const kind of ['domain','company','contact']){
  const h=harness();h.detail.company.normalized_domain=h.choice.domain;h.contact.company_id='company';
  if(kind==='domain')h.detail.company.normalized_domain='other.example';
  if(kind==='company')h.detail.company.id='other-company';
  if(kind==='contact')h.contact.company_id='other-company';
  assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false,kind);assert.equal(h.opened,0);
 }
});
test('conflicting CRM email columns cannot reopen a different delivery address',async()=>{
 const h=harness({normalized_email:'someone-else@example.com'});assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false);assert.equal(h.opened,0);
});
test('Messages fails closed when the email verification policy is unavailable',async()=>{
 const h=harness();delete h.ctx.window.LeadIntelContactPolicy;
 assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false);assert.equal(h.opened,0);
});
test('a changed CRM role or public profile requires buyer review before reopening',async()=>{
 for(const kind of ['role','profile']){
  const h=harness();h.person.title='Procurement Director';h.contact.title='Procurement Director';h.person.linkedin_url='https://www.linkedin.com/in/anna-buyer';h.contact.linkedin_url=h.person.linkedin_url;h.choice.recipientIdentity=require('./helpers/recipient-identity.cjs')(h.candidate,h.person,'company');
  if(kind==='role')h.contact.title='Former director';else h.contact.linkedin_url='https://www.linkedin.com/in/other-buyer';
  assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false,kind);assert.equal(h.opened,0);
 }
});
test('a pending CRM lookup cannot reopen after the selected company or email changes',async()=>{
 for(const kind of ['company','email','confirmed-profile']){
  const h=harness();let finish;h.b.getCrmCompany=()=>new Promise(resolve=>finish=resolve);
  const pending=h.ctx.openVerifiedBuyerScripts(h.choice);
  if(kind==='company')h.candidate.crmId='other-company';
  if(kind==='email')h.person.email='replacement@example.com';
  if(kind==='confirmed-profile')h.person.linkedinConfirmedUrl='https://linkedin.com/in/other';
  finish(h.detail);assert.equal(await pending,false,kind);assert.equal(h.opened,0);
 }
});
test('obsolete selected person IDs do not select the first dossier contact',()=>{
 const ctx={selectedCandidate:()=>({domain:'example.com',people:[]}),handoffContact:null};vm.createContext(ctx);
 const start=source.indexOf('function selectedContact('),end=source.indexOf('\n}',start)+2;vm.runInContext(source.slice(start,end),ctx);
 assert.equal(ctx.selectedContact({domain:'example.com',selectedPersonId:'deleted-teemu',dossier:{people:[{id:'klas',name:'Klas Buyer'}]}}),null);
});

test('an opened message loses recipient readiness when its exact choice or buyer identity changes',async()=>{
 for(const kind of ['contact','email','name','role','profile','company','removed','unkept','crm-email','crm-suppressed']){
  const h=harness();const item=h.ctx.outreach.items[0];item.dossier={people:[{id:h.person.id,name:h.person.name}]};h.ctx.currentItem=()=>item;h.ctx.selectedCandidate=()=>h.candidate;h.ctx.LeadIntelOutreach.rememberBuyerDraft=state=>state;
  assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),true);
  const start=source.indexOf('function messageRecipientReady('),end=source.indexOf('\n}',start)+2;vm.runInContext(source.slice(start,end),h.ctx);
  assert.equal(h.ctx.messageRecipientReady(),true,kind);
  if(kind==='contact')h.meta.scriptBuyer={...h.choice,contactId:'other-contact'};
  if(kind==='email')h.meta.scriptBuyer={...h.choice,email:'other@example.com'};
  if(kind==='name')h.person.name='Other Buyer';
  if(kind==='role')h.person.title='Other role';
  if(kind==='profile')h.person.linkedinConfirmedUrl='https://linkedin.com/in/other';
  if(kind==='company')h.candidate.crmId='other-company';
  if(kind==='removed')h.candidate.people=[];
  if(kind==='unkept')h.person.kept=false;
  if(kind==='crm-email')h.contact.work_email='other@example.com';
  if(kind==='crm-suppressed')h.detail.company.lifecycle_status='suppressed';
  assert.equal(h.ctx.messageRecipientReady(),false,kind);assert.equal(item.drafts.emailBody,'Manually saved draft');
 }
});


test('a legacy saved choice without its original identity must be explicitly reselected',async()=>{
 const h=harness();delete h.choice.recipientIdentity;
 assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false);assert.equal(h.opened,0);assert.equal(h.ctx.outreach.items[0].drafts.emailBody,'Manually saved draft');
});
test('saved identity snapshots reject same-ID replacement even when CRM was replaced too',async()=>{
 for(const field of ['name','title','organization','linkedin_url','publicNameUrl','company','crmId']){
  const h=harness();
  if(field==='company')h.candidate.company='Other Company';
  else if(field==='crmId'){h.candidate.crmId='other-company';h.detail.company.id='other-company';h.contact.company_id='other-company';}
  else {h.person[field]=field.includes('Url')||field==='linkedin_url'?'https://linkedin.com/in/other':'Different Value';if(field==='name'||field==='title')h.contact[field]=h.person[field];if(field==='linkedin_url')h.contact.linkedin_url=h.person.linkedin_url;}
  assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false,field);assert.equal(h.opened,0);
 }
});

test('a reselected replacement identity cannot inherit the prior person’s saved manual draft',async()=>{
 const h=harness();h.ctx.outreach.items[0].dossier={people:[{id:h.person.id,name:h.person.name,email:h.choice.email}]};
 h.person.name='Replacement Buyer';h.contact.name=h.person.name;h.choice.recipientIdentity=require('./helpers/recipient-identity.cjs')(h.candidate,h.person,'company');
 assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false);assert.equal(h.opened,0);assert.equal(h.ctx.outreach.items[0].drafts.emailBody,'Manually saved draft');
});
test('explicit provider-verified personal email remains distinct from company-email evidence',async()=>{
 const h=harness({email_type:'personal',work_email:'anna@gmail.com'});h.choice.email='anna@gmail.com';
 assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),true);assert.equal(h.ctx.handoffContact.contact.work_email,'anna@gmail.com');
});

test('every explicit CRM and saved-person profile alias must match the original recipient',async()=>{
 for(const owner of ['contact','person','draft'])for(const alias of ['public_linkedin_url','linkedinUrl','publicLinkedinUrl','linkedin','profile']){
  const h=harness();h.person.linkedin_url='https://linkedin.com/in/anna-buyer';h.contact.linkedin_url=h.person.linkedin_url;h.choice.recipientIdentity=require('./helpers/recipient-identity.cjs')(h.candidate,h.person,'company');
  const row=owner==='contact'?h.contact:owner==='person'?h.person:h.ctx.outreach.items[0].dossier.people[0];if(alias==='profile')row.profile={linkedinUrl:'https://linkedin.com/in/wrong-buyer'};else row[alias]='https://linkedin.com/in/wrong-buyer';
  assert.equal(await h.ctx.openVerifiedBuyerScripts(h.choice),false,owner+'/'+alias);assert.equal(h.opened,0);
 }
});
