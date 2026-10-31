const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),O=require('../outreach-engine.js');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
function harness({blocked=false,existing=false}={}){
 const person={id:'p1',name:'Anna Smith',title:'Procurement Director',organization:'Example',kept:true,linkedin_url:'https://linkedin.com/in/anna-smith',linkedinConfirmedUrl:'https://linkedin.com/in/anna-smith'};
 const candidate={domain:'example.com',company:'Example',crmId:'c1',people:[person]};
 const choice={domain:'example.com',personId:'p1',workspaceId:'w1',channel:'linkedin',linkedinUrl:person.linkedin_url};let generations=0;let item=existing?{channel:'linkedin',domain:'example.com',selectedPersonId:'p1',dossier:{people:[person]},drafts:{linkedinMessage:'Saved edit'}}:null,builds=0,steps=0,focus=0;
 choice.recipientIdentity=require('./helpers/recipient-identity.cjs')(candidate,person,'c1');
 const detail={ok:true,company:{id:'c1',normalized_domain:'example.com',lifecycle_status:blocked?'suppressed':'active'},contacts:[]};
 const ctx={crmDomain:x=>x,followUpCompanyIds:new Map(),LeadIntelMessageStudio:require('../message-studio.js'),readStudio:()=>({}),studioState:()=>({}),persistStudio(){},buyerHandoffRequest:0,crmBridge:()=>({ready:true,session:{authenticated:true},workspace:{id:'w1'},getCrmCompany:async()=>detail}),pipeline:()=>[candidate],window:{LeadIntelDiscovery:D},cancelPendingScriptGeneration(){},outreach:{selectedDomain:''},currentItem:()=>item,upsertItem:v=>{item=v;},LeadIntelOutreach:O,saveOutreach(){},showOutreachStep(){steps++;},buildDossier:async()=>{builds++;item={channel:'linkedin',selectedPersonId:'p1',dossier:{},drafts:{linkedinMessage:'Hello Anna'}};},generateStudioMessage:async()=>{generations++;},mainState:()=>({}),contentLanguage:()=> 'en',activeCampaignScenario:()=>({language:'en'}),renderAll(){},q:()=>({scrollIntoView(){},focus(){focus++;}})};
 vm.createContext(ctx);vm.runInContext("let personalPreparationRequest=0,personalPreparationController=null,personalPreparing=false;"+source.slice(source.indexOf('function closePersonalReview('),source.indexOf('function openPersonalReview(')),ctx);vm.runInContext(source.slice(source.indexOf('function prepareStudioBuyer('),source.indexOf('async function generateStudioMessage(')),ctx);vm.runInContext(source.slice(source.indexOf('async function savedBuyerCrmDraft('),source.indexOf("window.addEventListener('leadintel:buyer-for-scripts'")),ctx);
 return {ctx,person,candidate,choice,detail,get generations(){return generations;},get builds(){return builds;},get steps(){return steps;},get focus(){return focus;},get item(){return item;}};
}
test('confirmed LinkedIn opens the next step and automatically requests the first draft',async()=>{
 const h=harness();assert.equal(await h.ctx.openBuyerScripts(h.choice),true);assert.equal(h.builds,0);assert.equal(h.generations,1);assert.equal(h.item.drafts.linkedinMessage,undefined);assert.equal(h.item.localizationApprovalBlocked,true);assert.equal(h.steps,1);assert.equal(h.focus,1);assert.equal(h.item.selectedPersonId,'p1');assert.equal(h.item.channel,'linkedin');
});
test('reopening the same LinkedIn selection preserves edits without regenerating',async()=>{
 const h=harness({existing:true});assert.equal(await h.ctx.openBuyerScripts(h.choice),true);assert.equal(h.builds,0);assert.equal(h.item.drafts.linkedinMessage,'Saved edit');assert.equal(h.generations,0);
});
test('blocked company, profile substitution and workspace changes prevent draft generation',async()=>{
 for(const mode of ['company','profile','workspace','hold']){
  const h=harness({blocked:mode==='company'});
  if(mode==='profile')h.choice.linkedinUrl='https://linkedin.com/in/other';
  if(mode==='workspace')h.choice.workspaceId='w2';
  if(mode==='hold')h.person.opportunityScope={status:'review_required',reason:'Subsidiary mismatch'};
  assert.equal(await h.ctx.openBuyerScripts(h.choice),false);assert.equal(h.builds,0);assert.equal(h.steps,0);
 }
});
test('late CRM handoff cannot replace the more recently selected buyer',async()=>{const h=harness();const second={...h.person,id:'p2',name:'Bea Buyer',linkedin_url:'https://linkedin.com/in/bea-buyer',linkedinConfirmedUrl:'https://linkedin.com/in/bea-buyer'};h.candidate.people.push(second);let finish;let calls=0;h.ctx.crmBridge=()=>({ready:true,session:{authenticated:true},workspace:{id:'w1'},getCrmCompany:()=>{if(++calls===1)return new Promise(resolve=>finish=resolve);return Promise.resolve({ok:true,company:{id:'c1',normalized_domain:'example.com',lifecycle_status:'active'},contacts:[]});}});const first=h.ctx.openBuyerScripts(h.choice);assert.equal(await h.ctx.openBuyerScripts({...h.choice,personId:'p2',linkedinUrl:second.linkedin_url,recipientIdentity:require('./helpers/recipient-identity.cjs')(h.candidate,second,'c1')}),true);finish({ok:true,company:{id:'c1',normalized_domain:'example.com',lifecycle_status:'active'},contacts:[]});assert.equal(await first,false);assert.equal(h.item.selectedPersonId,'p2');});

test('an automatically verified LinkedIn profile is retained for the manual profile link',async()=>{const h=harness();delete h.person.linkedinConfirmedUrl;h.person.identitySource='apollo';assert.equal(await h.ctx.openBuyerScripts(h.choice),true);assert.equal(h.ctx.handoffContact.contact.linkedin_url,'https://linkedin.com/in/anna-smith');});

test('CRM handoff aborts before committing when sync or authentication changes during lookup',async()=>{for(const state of ['conflict','resolvingSync','signed-out']){const h=harness();let finish;const bridge={ready:true,session:{authenticated:true},workspace:{id:'w1'},getCrmCompany:()=>new Promise(r=>finish=r)};h.ctx.crmBridge=()=>bridge;const pending=h.ctx.openBuyerScripts(h.choice);if(state==='signed-out')bridge.session.authenticated=false;else bridge[state]=true;finish({ok:true,company:{id:'c1',normalized_domain:'example.com',lifecycle_status:'active'},contacts:[]});assert.equal(await pending,false);assert.equal(h.steps,0);assert.equal(h.generations,0);assert.equal(h.item,null);}});


test('an obsolete CRM contact ID cannot fall through to another LinkedIn identity',async()=>{
 const h=harness();h.choice.contactId='deleted-teemu';h.detail.contacts=[{id:'klas',external_person_id:'p1',name:h.person.name,linkedin_url:h.choice.linkedinUrl}];
 assert.equal(await h.ctx.openBuyerScripts(h.choice),false);assert.equal(h.generations,0);assert.equal(h.steps,0);
});
test('LinkedIn contact ID must retain exact company, name, external identity and profile',async()=>{
 for(const kind of ['company','name','external-id','profile','role']){
  const h=harness();h.choice.contactId='selected';const contact={id:'selected',company_id:'c1',external_person_id:'p1',name:h.person.name,title:h.person.title,linkedin_url:h.choice.linkedinUrl};
  if(kind==='company')contact.company_id='c2';
  if(kind==='name')contact.name='Different Buyer';
  if(kind==='external-id')contact.external_person_id='p2';
  if(kind==='profile')contact.linkedin_url='https://linkedin.com/in/different';
  if(kind==='role')contact.title='Former manager';
  h.detail.contacts=[contact];assert.equal(await h.ctx.openBuyerScripts(h.choice),false,kind);assert.equal(h.generations,0);assert.equal(h.steps,0);
 }
});
