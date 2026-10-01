const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
function harness(){
 const pending=[],items=[];const bridge={session:{authenticated:true},workspace:{id:'w1'}};
 const context={scriptGenerationRequest:0,outreach:{selectedDomain:'maker.se'},window:{},LeadIntelContentLanguage:{},crmBridge:()=>bridge,upsertItem:item=>items.push(item),renderDossier:()=>{},LeadIntelOutreachLocalization:{prepareCampaignDrafts:()=>new Promise(resolve=>pending.push(resolve))}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function prepareLocalizedItem('),source.indexOf('async function buildDossier(')),context);
 return {context,bridge,pending,items};
}
const item={domain:'maker.se',drafts:{requiresAiLocalization:true,emailBody:'Original'},dossier:{domain:'maker.se'}};
const result=text=>({drafts:{emailBody:text},provenance:{language:'sv',selectionSource:'market'},status:'complete',approvalBlocked:false,message:'Ready'});
test('older localization cannot replace a newer buyer or trigger generation',async()=>{
 const h=harness(),first=h.context.prepareLocalizedItem(item,{},{}),second=h.context.prepareLocalizedItem({...item,selectedPersonId:'new-buyer'},{},{});
 h.pending[1](result('New buyer script'));const latest=await second;assert.equal(latest.selectedPersonId,'new-buyer');assert.equal(latest.drafts.emailBody,'New buyer script');
 h.pending[0](result('Old buyer script'));assert.equal(await first,null);
});
test('company or workspace switch discards late script responses',async()=>{
 for(const change of [h=>h.context.outreach.selectedDomain='other.se',h=>h.bridge.workspace.id='w2']){
  const h=harness(),promise=h.context.prepareLocalizedItem(item,{},{});change(h);h.pending[0](result('Stale'));assert.equal(await promise,null);
 }
});
test('pending generation cannot save old message text with a new trigger to CRM',async()=>{
 const context={readDraftEdits:()=>({...item,localizationStatus:'running'}),selectedCandidate:()=>({domain:'maker.se'}),toast:message=>{context.message=message},syncCrmActivity:()=>{throw Error('pending scripts must not save')}};
 vm.createContext(context);vm.runInContext(source.slice(source.indexOf('async function saveScriptPackage('),source.indexOf('async function restoreScriptPackage(')),context);
 await context.saveScriptPackage();assert.match(context.message,/Wait for script generation/);
});
test('buyer selection regenerates and editing retains the source context',async()=>{
 let listener;const contact={addEventListener:(event,callback)=>{assert.equal(event,'change');listener=callback;}};
 const context={q:id=>id==='outreach-contact-select'?contact:null,regenerateDrafts:async()=>{context.generated=true},toast:()=>{}};vm.createContext(context);
 const binding=source.split('\n').find(line=>line.includes('q("outreach-contact-select")?.addEventListener'));vm.runInContext(binding,context);await listener();assert.equal(context.generated,true);
 const fields={'outreach-tone':'brief','outreach-email-subject':'Subject','outreach-email-body':'Edited','outreach-linkedin':'LinkedIn','outreach-call-opener':'Call','outreach-follow-up':'Follow up','outreach-objection-reply':'Reply'};
 context.currentItem=()=>({...item,drafts:{...item.drafts,scriptContext:{buyerId:'p1',trigger:{url:'https://maker.se/news'}}}});context.q=id=>({value:fields[id]});
 const start=source.indexOf('function readDraftEdits()');vm.runInContext(source.slice(start,source.indexOf('\n',start)),context);const edited=context.readDraftEdits();assert.equal(edited.drafts.emailBody,'Edited');assert.equal(edited.drafts.scriptContext.trigger.url,'https://maker.se/news');
});
