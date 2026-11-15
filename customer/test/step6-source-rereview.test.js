const test=require('node:test'),assert=require('node:assert/strict');
const {mounted}=require('./helpers/message-runtime.js'),identity=require('./helpers/recipient-identity.cjs'),E=require('../message-editor.js');
const priorSource='https://careers.buyer.example/people/alex-buyer',currentSource='https://buyer.example/team';
function fixture({reselected=true,changedPerson=false}={}){
 const h=mounted({selected:'professional'}),key='leadintel_customer_v2_discovery',state=JSON.parse(h.w.localStorage.getItem(key)),c=state.pipeline[0],p=c.people[0];
 h.w.scrollTo=()=>{};c.crmId='crm1';p.publicName=p.name;p.organization=c.company;p.publicNameUrl=priorSource;
 const originalIdentity=identity(c,p,'crm1'),item=h.item();Object.assign(item.dossier.people[0],p);item.messageStudioDraft.recipientIdentity=originalIdentity;item.messageStudioDraft.editorOrigin='manual';item.messageStudioDraft.scriptSavedAt='2026-11-01T09:00:00.000Z';item.messageStudioDraft.savedDraft=E.workingDraft(item);h.w.upsertItem(item);
 p.publicNameUrl=currentSource;if(changedPerson)p.name=p.publicName='Different Buyer';h.w.localStorage.setItem(key,JSON.stringify(state));
 const choice={workspaceId:'w1',domain:c.domain,personId:p.id,channel:'email',contactId:'contact-1',email:p.email,recipientIdentity:reselected?identity(c,p,'crm1'):originalIdentity};h.w.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({scriptBuyer:choice}));
 let reads=0;Object.assign(h.w.LeadIntelServerBridge,{getCrmCompany:async()=>{reads++;return {ok:true,company:{id:'crm1',normalized_domain:c.domain,lifecycle_status:'prospect'},contacts:[{id:'contact-1',company_id:'crm1',external_person_id:p.id,name:p.name,title:p.title,work_email:p.email,email_status:'verified',verification_provider:'Apollo'}]};}});
 return {h,choice,before:h.item(),reads:()=>reads};
}
test('reselecting the same verified recipient after a source URL changes reopens exact saved text and provenance',async()=>{
 const f=fixture();try{assert.equal(await f.h.w.openBuyerScripts(f.choice),true);assert.equal(f.reads(),1);assert.deepEqual(E.workingDraft(f.h.item()),E.workingDraft(f.before));assert.deepEqual(f.h.item().messageStudioDraft.recipientIdentity,f.before.messageStudioDraft.recipientIdentity,'the older source remains attached to the saved draft');assert.deepEqual(f.h.item().messageStudioDraft.tailoredOriginal,f.before.messageStudioDraft.tailoredOriginal);assert.equal(f.h.item().approved,false);}finally{f.h.w.close();}
});
for(const options of [{reselected:false},{changedPerson:true}])test('source refresh still blocks an unreviewed selection or changed person '+JSON.stringify(options),async()=>{
 const f=fixture(options);try{assert.equal(await f.h.w.openBuyerScripts(f.choice),false);assert.equal(f.reads(),0);assert.deepEqual(E.workingDraft(f.h.item()),E.workingDraft(f.before));}finally{f.h.w.close();}
});
const O=require('../outreach-engine.js');
function owner(source=priorSource){return {version:1,personId:'p1',companyDomain:'buyer.example',companyId:'crm1',companyName:'Buyer',name:'Alex Buyer',title:'Operations Director',organization:'Buyer',linkedinUrl:'',identitySourceUrl:source,researchKey:'buyer.example|buyer|alex buyer|operations director|buyer|'};}
test('only a valid citation change may differ in complete saved-recipient identities',()=>{
 const saved=owner(),current=owner(currentSource),before=JSON.stringify({saved,current});assert.equal(O.sameSavedRecipientIdentity(saved,current),true);assert.equal(JSON.stringify({saved,current}),before);
 for(const field of Object.keys(current).filter(key=>key!=='identitySourceUrl')){const changed={...current,[field]:typeof current[field]==='number'?2:'changed'};assert.equal(O.sameSavedRecipientIdentity(saved,changed),false,field);}
 for(const value of ['',undefined,'not a URL','http://buyer.example/team','javascript:alert(1)','https://user:password@buyer.example/team'])assert.equal(O.sameSavedRecipientIdentity(saved,{...current,identitySourceUrl:value}),false,String(value));
 for(const field of ['companyId','name','title','organization','researchKey','linkedinUrl']){const left={...saved},right={...current};delete left[field];delete right[field];assert.equal(O.sameSavedRecipientIdentity(left,right),false,field);}
 assert.equal(O.sameSavedRecipientIdentity(saved,{...current,workspaceId:'another-workspace'}),false);
});
test('newer acknowledged CRM copies reconcile across a citation update while preserving local edits',()=>{
 const h=fixture();try{const local=h.before,remote=JSON.parse(JSON.stringify(local));remote.messageStudioDraft.recipientIdentity=owner(currentSource);local.messageStudioDraft.recipientIdentity=owner();remote.messageStudioDraft.scriptSavedAt='2026-11-02T09:00:00.000Z';assert.equal(O.preferNewerSavedBuyerDraft(local,remote),true);local.drafts.emailBody+=' My unsaved change.';assert.equal(O.preferNewerSavedBuyerDraft(local,remote),false);}finally{h.h.w.close();}
});
