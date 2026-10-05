const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const D=require('../discovery-engine.js'),O=require('../outreach-engine.js');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
function harness({blocked=false,existing=false}={}){
 const person={id:'p1',name:'Anna Smith',title:'Procurement Director',organization:'Example',kept:true,linkedin_url:'https://linkedin.com/in/anna-smith',linkedinConfirmedUrl:'https://linkedin.com/in/anna-smith'};
 const candidate={domain:'example.com',company:'Example',crmId:'c1',people:[person]};
 const choice={domain:'example.com',personId:'p1',workspaceId:'w1',channel:'linkedin',linkedinUrl:person.linkedin_url};let item=existing?{channel:'linkedin',domain:'example.com',selectedPersonId:'p1',dossier:{},drafts:{linkedinMessage:'Saved edit'}}:null,builds=0,steps=0,focus=0;
 const ctx={buyerHandoffRequest:0,crmBridge:()=>({workspace:{id:'w1'},getCrmCompany:async()=>({ok:true,company:{lifecycle_status:blocked?'suppressed':'active'},contacts:[]})}),pipeline:()=>[candidate],window:{LeadIntelDiscovery:D},cancelPendingScriptGeneration(){},outreach:{selectedDomain:''},currentItem:()=>item,upsertItem:v=>{item=v;},LeadIntelOutreach:O,saveOutreach(){},showOutreachStep(){steps++;},buildDossier:async()=>{builds++;item={channel:'linkedin',selectedPersonId:'p1',dossier:{},drafts:{linkedinMessage:'Hello Anna'}};},mainState:()=>({}),contentLanguage:()=> 'en',activeCampaignScenario:()=>({language:'en'}),renderAll(){},q:()=>({scrollIntoView(){},focus(){focus++;}})};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function prepareStudioBuyer('),source.indexOf('async function generateStudioMessage(')),ctx);vm.runInContext(source.slice(source.indexOf('async function openBuyerScripts('),source.indexOf("window.addEventListener('leadintel:buyer-for-scripts'")),ctx);
 return {ctx,person,candidate,choice,get builds(){return builds;},get steps(){return steps;},get focus(){return focus;},get item(){return item;}};
}
test('confirmed LinkedIn opens an empty draft workspace without automatic research or AI calls',async()=>{
 const h=harness();assert.equal(await h.ctx.openBuyerScripts(h.choice),true);assert.equal(h.builds,0);assert.equal(h.item.drafts.linkedinMessage,undefined);assert.equal(h.item.localizationApprovalBlocked,true);assert.equal(h.steps,1);assert.equal(h.focus,1);assert.equal(h.item.selectedPersonId,'p1');assert.equal(h.item.channel,'linkedin');
});
test('reopening the same LinkedIn selection preserves edits without regenerating',async()=>{
 const h=harness({existing:true});assert.equal(await h.ctx.openBuyerScripts(h.choice),true);assert.equal(h.builds,0);assert.equal(h.item.drafts.linkedinMessage,'Saved edit');
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
test('late CRM handoff cannot replace the more recently selected buyer',async()=>{const h=harness();const second={...h.person,id:'p2',name:'Bea Buyer',linkedin_url:'https://linkedin.com/in/bea-buyer',linkedinConfirmedUrl:'https://linkedin.com/in/bea-buyer'};h.candidate.people.push(second);let finish;let calls=0;h.ctx.crmBridge=()=>({workspace:{id:'w1'},getCrmCompany:()=>{if(++calls===1)return new Promise(resolve=>finish=resolve);return Promise.resolve({ok:true,company:{lifecycle_status:'active'},contacts:[]});}});const first=h.ctx.openBuyerScripts(h.choice);assert.equal(await h.ctx.openBuyerScripts({...h.choice,personId:'p2',linkedinUrl:second.linkedin_url}),true);finish({ok:true,company:{lifecycle_status:'active'},contacts:[]});assert.equal(await first,false);assert.equal(h.item.selectedPersonId,'p2');});
