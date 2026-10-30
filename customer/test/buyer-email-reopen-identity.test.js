const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
function harness(change={}){
 const person={id:'anna',name:'Anna Buyer',kept:true},candidate={domain:'example.com',crmId:'company',people:[person]},choice={channel:'email',workspaceId:'w1',domain:candidate.domain,personId:person.id,contactId:'contact-anna',email:'anna@example.com'};
 const contact={id:choice.contactId,external_person_id:person.id,name:person.name,work_email:choice.email,email_status:'verified',verification_provider:'Apollo',...change};
 const item={domain:candidate.domain,channel:'email',selectedPersonId:person.id,drafts:{emailBody:'Manually saved draft'}};
 let opened=0,saves=0,prepared=0,meta={scriptBuyer:choice};
 const detail={ok:true,company:{id:'company'},contacts:[contact]},b={workspace:{id:'w1'},session:{authenticated:true,user:{id:'u1'}},ready:true,getCrmCompany:async()=>detail};
 const ctx={buyerHandoffRequest:0,DISCOVERY_META_KEY:'meta',readJson:()=>meta,crmBridge:()=>b,pipeline:()=>[candidate],followUpCompanyIds:new Map(),crmDomain:x=>x,window:{LeadIntelContactPolicy:require('../contact-confirmation-policy.js')},outreach:{items:[item]},LeadIntelOutreach:{savedBuyerDraft:()=>item},currentItem:()=>null,cancelPendingScriptGeneration(){},saveOutreach(){saves++;},prepareStudioBuyer(){prepared++;},showOutreachStep(){opened++;},prepareMessageOnOpen(){}};
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
