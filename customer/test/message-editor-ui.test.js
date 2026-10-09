const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const S=require('../message-studio.js'),E=require('../message-editor.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function mounted(){
 const w=new JSDOM(read('index.html'),{url:'https://example.com/customer/',runScripts:'outside-only'}).window;
 w.LeadIntelMessageStudio=S;w.LeadIntelMessageEditor=E;w.LeadIntelMessageFacts=require('../message-facts.js');w.LeadIntelOutreach=require('../outreach-engine.js');w.eval(read('message-workspace.js'));w.eval(read('sender-identity-location.js'));
 const studio=S.normalize({mode:'friendly',essentials:{sender:'Marta Kalna',company:'North Advisory',offer:'Advisory services',value:'Clear decisions',difference:'Experienced advisers',meetingValue:'Discuss a practical next step',calendly:'https://calendly.com/north/20'}},{});
 let item={domain:'buyer.example',selectedPersonId:'p1',channel:'email',dossier:{},drafts:{emailSubject:'Hello Alex',emailBody:'Existing working message'}},saved=[];
 w.currentItem=()=>item;w.studioState=()=>studio;w.readStudio=()=>studio;w.upsertItem=next=>{item=next};w.crmBridge=()=>({workspace:{id:'w1'}});w.messageWorkspaceUsable=()=>true;w.selectedCandidate=()=>({domain:'buyer.example',company:'Example'});w.studioMessageContext=()=>({channel:'email',buyerName:'Alex Buyer',firstName:'Alex',buyerCompany:'Example'});w.saveScriptPackage=async next=>{item=next;saved.push(JSON.parse(JSON.stringify(next)));return {ok:true}};
 w.eval("var scriptGenerationRequest=0,studioGenerationBusy=false,messageTranslationBusy=false,messageFactResearchBusy=false;var readDraftEdits=()=>currentItem();var q=id=>document.getElementById(id);var asset=p=>p;var esc=v=>String(v);var persistStudio=()=>{};var invalidateStudioDraft=()=>{};var renderMessageStudio=()=>{};var renderPersonalSaveButton=()=>{};var renderPersonalStyleEditor=()=>{};var closePersonalReview=()=>{};var toast=()=>{};var cancelPendingScriptGeneration=()=>{};");
 const src=read('outreach-ui.js');w.eval(src.slice(src.indexOf('function injectOutreachUI(){'),src.indexOf('function showStep(step)')));w.eval(src.slice(src.indexOf('function restorePrePersonalizationDraft(){'),src.indexOf('function pendingMessageSelections')).replace('let messageEditor=null','var messageEditor=null'));
 w.renderMessageWorkspace=()=>w.LeadIntelMessageWorkspace.render(w.document,{ready:true,authenticated:true,hasDraft:true,senderIdentityReady:true,channel:'email',templateSelected:true,selectedStyle:'friendly',appliedStyle:'friendly',editorState:w.eval('messageEditor?.state()'),originalAvailable:true});
 w.renderAll=()=>{w.document.getElementById('outreach-email-subject').value=item.drafts.emailSubject;w.document.getElementById('outreach-email-body').value=item.drafts.emailBody;w.renderMessageWorkspace();};
 w.eval(src.slice(src.indexOf('function installMessageStudio(){'),src.indexOf("let personalChannel='email'")));w.eval('injectOutreachUI();installMessageStudio();');w.renderAll();
 return {w,document:w.document,studio,item:()=>item,saved};
}
const settle=()=>new Promise(r=>setImmediate(r));
test('top actions mount once; Edit unlocks fields, Save persists exact text, Cancel restores baseline',async()=>{
 const {w,document,item,saved}=mounted(),q=id=>document.getElementById(id);
 for(const id of ['mw-save-message','mw-edit-message','mw-rewrite-message','mw-restore-original'])assert.equal(document.querySelectorAll('#'+id).length,1);
 assert.ok(q('mw-save-message').compareDocumentPosition(q('outreach-email-body'))&w.Node.DOCUMENT_POSITION_FOLLOWING);
 assert.equal(q('outreach-email-body').readOnly,true);q('mw-edit-message').click();assert.equal(q('outreach-email-body').readOnly,false);assert.equal(q('approve-outreach').disabled,true);
 q('outreach-email-subject').value='  Subject spacing  ';q('outreach-email-body').value='  Exact message\n\nTrailing spaces  ';q('outreach-email-body').dispatchEvent(new w.Event('input'));
 assert.equal(saved.length,0);assert.equal(item().drafts.emailBody,'Existing working message');q('mw-save-message').click();await settle();assert.equal(saved.length,1);assert.equal(saved[0].drafts.emailBody,'  Exact message\n\nTrailing spaces  ');assert.equal(saved[0].drafts.emailSubject,'  Subject spacing  ');assert.equal(q('outreach-email-body').readOnly,true);assert.equal(q('approve-outreach').disabled,false);
 q('mw-edit-message').click();q('outreach-email-body').value='Discard';q('mw-cancel-edit').click();assert.equal(q('outreach-email-body').value,'  Exact message\n\nTrailing spaces  ');assert.equal(saved.length,1);
});
test('explicit Rewrite uses the single editor, preserves subject, allows Undo and requires Save',async()=>{
 const {w,document,item,saved}=mounted(),q=id=>document.getElementById(id);let calls=0;
 w.fetch=async()=>({ok:true,json:async()=>({text:JSON.stringify({subject:'AI unwanted subject',message:'Fresh alternative '+(++calls)+'\nMarta Kalna'})})});
 q('mw-rewrite-message').click();await settle();assert.equal(q('mw-rewrite-preview'),null);assert.equal(item().drafts.emailBody,'Fresh alternative 1\nMarta Kalna');assert.equal(item().drafts.emailSubject,'Hello Alex');assert.equal(saved.length,0);
 q('mw-undo-rewrite').click();assert.equal(item().drafts.emailBody,'Existing working message');assert.equal(saved.length,0);
 q('mw-rewrite-message').click();await settle();assert.equal(item().drafts.emailBody,'Fresh alternative 2\nMarta Kalna');q('mw-save-message').click();await settle();assert.equal(saved.length,1);
});
test('Restore original replaces edits with initial tailored snapshot and does not use latest history or master sample',()=>{
 const {w,document,studio,item}=mounted();const context=w.studioMessageContext(),key=E.scope('w1',item(),studio,context),original=E.tailor(studio,context);
 w.upsertItem(E.apply(item(),original,{key,original:true,style:'friendly',origin:'tailored'}));w.upsertItem(E.apply(item(),{subject:'Edited subject',message:'Manual edit'},{origin:'manual'}));w.renderAll();document.getElementById('mw-restore-original').click();assert.equal(item().drafts.emailBody,original.message);assert.equal(item().drafts.emailSubject,original.subject);assert.equal(item().approved,false);assert.doesNotMatch(item().drafts.emailBody,/Joakim|LKAB|ERCON/);
});
