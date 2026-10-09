const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),Workspace=require('../message-workspace.js'),Studio=require('../message-studio.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function mounted(){
 const dom=new JSDOM(read('index.html'),{url:'https://example.com/customer/',runScripts:'outside-only'}),w=dom.window;
 w.LeadIntelMessageStudio=Studio;w.LeadIntelMessageFacts=require('../message-facts.js');w.eval(read('message-workspace.js'));w.eval(read('sender-identity-location.js'));
 w.eval("var repairLegacyEmailIdentity=()=>false;var scriptGenerationRequest=0;var readDraftEdits=()=>null;var q=id=>document.getElementById(id);var asset=p=>p;var esc=v=>String(v);var studioState=()=>({essentials:{}});var readStudio=()=>({});var persistStudio=()=>{};var invalidateStudioDraft=()=>{};var renderMessageStudio=()=>{};var renderPersonalSaveButton=()=>{};var renderPersonalStyleEditor=()=>{};var closePersonalReview=()=>{};var currentItem=()=>null;var toast=()=>{};");
 const src=read('outreach-ui.js');w.eval(src.slice(src.indexOf('function injectOutreachUI(){'),src.indexOf('function showStep(step)')));w.eval(src.slice(src.indexOf('function installMessageStudio(){'),src.indexOf("let personalChannel='email'")));
 w.eval('injectOutreachUI();installMessageStudio();');return {dom,document:w.document,w};
}
test('composer mounts once, preserves canonical fields/listeners and keeps settings and research collapsed',()=>{
 const {document,w}=mounted();assert.equal(w.LeadIntelMessageWorkspace.mount(document),false);
 const ids=['message-mode','message-language','message-calendly','outreach-email-body','outreach-linkedin','outreach-email-subject','brand-sender-name','message-generation-status'];
 for(const id of ids)assert.equal(document.querySelectorAll('#'+id).length,1,id);
 assert.ok(document.querySelector('.mw-editor #outreach-email-body'));assert.ok(document.querySelector('.mw-rail #outreach-trigger-select'));assert.ok(document.querySelector('#mw-settings #brand-sender-name'));
 for(const id of ['mw-settings','mw-writing-references'])assert.equal(document.getElementById(id).open,false);
 assert.equal(document.querySelector('.message-advanced').open,false);
 const input=document.getElementById('outreach-email-body');input.value='Preserve this draft';let edits=0;input.addEventListener('input',()=>edits++);w.LeadIntelMessageWorkspace.mount(document);input.dispatchEvent(new w.Event('input'));assert.equal(input.value,'Preserve this draft');assert.equal(edits,1);
});
test('readiness distinguishes restoration, missing Profile answers, existing drafts and available generation',()=>{
 const ready={ready:true,authenticated:true};assert.equal(Workspace.state({...ready,pending:true}).kind,'loading');
 const blocked=Workspace.state({...ready,unconfirmed:['delivery_approach','meeting_value'],hasDraft:true});assert.equal(blocked.canGenerate,false);assert.equal(blocked.action,'profile');assert.match(blocked.detail,/How you deliver/);assert.doesNotMatch(blocked.text,/Ready to generate/);
 assert.equal(Workspace.state({...ready,hasDraft:true}).kind,'draft');assert.equal(Workspace.state(ready).canGenerate,true);assert.equal(Workspace.state({...ready,approved:true}).canGenerate,false);
 assert.equal(Workspace.state({...ready,missing:['calendly']}).canGenerate,true);assert.equal(Workspace.state({...ready,missing:['sender']}).action,'settings');
});
test('channel changes show only the matching editor and actions; a draft is never described as empty',()=>{
 const {document,w}=mounted();const base={ready:true,authenticated:true,hasDraft:true,person:{name:'Sam Buyer',title:'Partner'},company:'Legal practice'};
 w.LeadIntelMessageWorkspace.render(document,{...base,channel:'linkedin'});assert.equal(document.querySelector('.outreach-approval').hidden,true);assert.equal(document.getElementById('mw-copy-email').hidden,true);assert.equal(document.getElementById('mw-empty').hidden,true);assert.match(document.getElementById('mw-readiness-text').textContent,/draft/);assert.equal(document.getElementById('message-recipient').textContent,'Sam Buyer');
 w.LeadIntelMessageWorkspace.render(document,{...base,channel:'email'});assert.equal(document.querySelector('.outreach-approval').hidden,false);assert.equal(document.getElementById('mw-copy-email').hidden,false);assert.equal(document.getElementById('approve-outreach').textContent,'Approve & continue →');
 w.LeadIntelMessageWorkspace.render(document,{...base,hasDraft:false});assert.equal(document.getElementById('mw-empty').hidden,true);assert.equal(document.querySelector('.script-grid').hidden,false);assert.match(document.getElementById('outreach-email-body').placeholder,/personalized email/);
});
test('style cards drive the canonical select with a change event and accessible selected state',()=>{
 const {document,w}=mounted();let changes=0;const select=document.getElementById('message-mode');select.addEventListener('change',()=>changes++);w.LeadIntelMessageWorkspace.paintStyles(document);document.querySelector('[data-writing-style="friendly"]').click();assert.equal(select.value,'friendly');assert.equal(changes,1);assert.equal(document.querySelector('[data-writing-style="friendly"]').getAttribute('aria-pressed'),'true');
});

test('subject previews use recipient and sender values while unknown events stay explicit',()=>{
 assert.equal(Workspace.subjectPreview('{{sender}}. {{company}}',{sender:'Alex',senderCompany:'Legal practice'}),'Alex. Legal practice');
 assert.equal(Workspace.subjectPreview('Regarding {{development}}',{}),'Regarding [select a company fact]');
 assert.equal(Workspace.subjectPreview('A practical idea for {{buyerCompany}}',{company:'Manufacturing team'}),'A practical idea for Manufacturing team');
});

test('a sync conflict takes priority over apparent missing Profile answers and blocks generation',()=>{
 const view=Workspace.state({ready:true,authenticated:true,syncConflict:true,unconfirmed:['meeting_value'],hasDraft:true});
 assert.equal(view.canGenerate,false);assert.equal(view.action,'sync');assert.match(view.text,/sync conflict/i);
});

test('template generation is distinct from original AI generation and retains protected originals',()=>{
 const {document,w}=mounted(),base={ready:true,authenticated:true,hasDraft:true,channel:'linkedin'};
 w.LeadIntelMessageWorkspace.render(document,{...base,templateSelected:true});assert.match(document.getElementById('message-generate').textContent,/Apply selected settings/i);
 w.LeadIntelMessageWorkspace.render(document,{...base,templateSelected:false});assert.match(document.getElementById('message-generate').textContent,/Generate message/i);
 assert.ok(document.getElementById('message-template-body').readOnly);
});
test('opening-only update is available only with a reviewed event and an unapproved draft',()=>{
 const {document,w}=mounted(),base={ready:true,authenticated:true,hasDraft:true,channel:'linkedin'};
 w.LeadIntelMessageWorkspace.render(document,base);assert.equal(document.getElementById('message-update-opening').disabled,true);
 w.LeadIntelMessageWorkspace.render(document,{...base,trigger:{verification:'user_reviewed',excerpt:'Acme is opening a new factory in Sweden in 2028.'}});assert.equal(document.getElementById('message-update-opening').disabled,false);
 w.LeadIntelMessageWorkspace.render(document,{...base,approved:true,trigger:{verification:'user_reviewed',excerpt:'Acme is opening a new factory in Sweden in 2028.'}});assert.equal(document.getElementById('message-update-opening').disabled,true);
});
test('manual LinkedIn copy and profile actions are grouped together',()=>{
 const {document}=mounted();const group=document.querySelector('.mw-linkedin-actions');assert.ok(group.querySelector('[data-copy-field="linkedin"]'));assert.ok(group.querySelector('#linkedin-open-profile'));assert.match(document.querySelector('#linkedin-manual-actions > p').textContent,/record/i);
});
test('sync review reveals canonical recovery buttons beside the warning and preserves their handlers',()=>{
 const {document,w}=mounted(),header=document.createElement('div');
 header.innerHTML='<div id="server-conflict-actions"><button id="server-use-server">Use server version</button><button id="server-keep-local">Keep my local changes</button></div><button id="server-sync-recovery">Download recovery copy</button>';document.body.prepend(header);
 let kept=0;const keep=document.getElementById('server-keep-local');keep.onclick=()=>kept++;
 w.LeadIntelMessageWorkspace.render(document,{ready:true,authenticated:true,syncConflict:true,hasDraft:true});document.getElementById('mw-resolve').click();
 const panel=document.getElementById('mw-sync-choices');assert.ok(panel);assert.equal(panel.hidden,false);assert.ok(panel.contains(keep));assert.ok(panel.contains(document.getElementById('server-sync-recovery')));assert.equal(document.querySelectorAll('#server-keep-local').length,1);assert.equal(kept,0);keep.click();assert.equal(kept,1);
 document.getElementById('mw-resolve').click();w.LeadIntelMessageWorkspace.render(document,{ready:true,authenticated:true,syncConflict:true});assert.equal(panel.hidden,false);assert.equal(document.querySelectorAll('#server-keep-local').length,1);
 w.LeadIntelMessageWorkspace.render(document,{ready:true,authenticated:true,syncConflict:false});assert.equal(panel.hidden,true);assert.equal(document.getElementById('server-conflict-actions').parentElement,header);assert.equal(document.getElementById('server-sync-recovery').parentElement,header);assert.deepEqual([...header.children].map(el=>el.id),['server-conflict-actions','server-sync-recovery']);
});
test('successful recovery clears the visible conflict warning and enables generation without a reload',()=>{
 const {document,w}=mounted(),header=document.createElement('div');header.innerHTML='<div id="server-conflict-actions"><button id="server-use-server">Use server version</button><button id="server-keep-local">Keep my local changes</button></div>';document.body.prepend(header);
 w.root=w;w.bridge={conflict:true};w.crmBridge=()=>w.bridge;w.cancelPendingScriptGeneration=()=>{};w.renderMessageWorkspace=()=>w.LeadIntelMessageWorkspace.render(document,{ready:true,authenticated:true,syncConflict:w.bridge.conflict,hasDraft:true});
 const server=read('server-bridge.js'),ui=read('outreach-ui.js');w.eval(server.slice(server.indexOf('function setConflictBusy('),server.indexOf('function resolveConflictUseServer(')));w.eval(ui.slice(ui.indexOf("for(const event of ['leadintel:server-conflict'")));
 const draft=document.getElementById('outreach-linkedin');draft.value='Keep my edited Latvian message';w.renderMessageWorkspace();document.getElementById('mw-resolve').click();w.setConflictBusy(true);w.bridge.conflict=false;w.setConflictBusy(false);
 assert.doesNotMatch(document.getElementById('mw-readiness-text').textContent,/conflict/i);assert.equal(document.getElementById('message-generate').disabled,false);assert.equal(document.getElementById('mw-sync-choices').hidden,true);assert.equal(document.getElementById('server-conflict-actions').parentElement,header);assert.equal(draft.value,'Keep my edited Latvian message');
});
test('LinkedIn editor renders protected core styles with body-only preview and manual sender context',()=>{
 const {document,w}=mounted();let studio=Studio.normalize({linkedinMode:'friendly'},{});const item={channel:'linkedin',domain:'buyer.example',selectedPersonId:'p1',dossier:{},drafts:{linkedinMessage:'Saved draft'}};
 w.studioState=()=>studio;w.currentItem=()=>item;w.selectedCandidate=()=>({company:'BuyerCo',domain:'buyer.example'});w.selectedContact=()=>({name:'Sam',title:'Partner'});w.handoffContact={domain:'buyer.example',personId:'p1',channel:'linkedin',contact:{name:'Sam'}};w.renderPersonalSlots=()=>{};w.mainState=()=>({});w.renderMessageWorkspace=()=>w.LeadIntelMessageWorkspace.render(document,{ready:true,authenticated:true,channel:'linkedin',hasDraft:true,person:{name:'Sam'},company:'BuyerCo'});
 const ui=read('outreach-ui.js');w.eval(ui.slice(ui.indexOf('function renderMessageStudio(){'),ui.indexOf('function renderMessageWorkspace(){')));w.renderMessageStudio();
 assert.deepEqual(Array.from(document.getElementById('message-mode').options,o=>o.value),['professional','curiosity','friendly','original']);assert.equal(document.getElementById('message-template-editor').hidden,false);assert.match(document.getElementById('message-template-origin').textContent,/Protected/);assert.equal(document.getElementById('message-template-body').readOnly,true);assert.equal(document.getElementById('message-template-subject').closest('label').hidden,true);assert.equal(document.getElementById('message-subject-choice-label').hidden,true);assert.match(document.getElementById('mw-channel').textContent,/LinkedIn · manual/);assert.equal(document.querySelector('[data-writing-style="brutal"]'),null);
 studio=Studio.normalize({...studio,linkedinMode:'original'});w.renderMessageStudio();assert.equal(document.getElementById('message-template-editor').hidden,true);assert.ok(Object.isFrozen(Studio.linkedinDefaults[2]));
});

test('approved subject aliases display current workspace facts and only a real score, including zero',()=>{
 const c={sender:'Alex Smith',senderCompany:'LegalCo',company:'ClientCo',value:'simplify contract review',trigger:{title:'New branch'},fitScore:0};
 assert.equal(Workspace.subjectPreview('{{senderFullName}}. {{senderCompany}}',c),'Alex Smith. LegalCo');
 assert.equal(Workspace.subjectPreview('{{recipientCompany}} — fit: {{fitScore}}/100',c),'ClientCo — fit: 0/100');
 assert.equal(Workspace.subjectPreview('Regarding {{verifiedProjectOrExpansion}}',c),'Regarding New branch');
 assert.equal(Workspace.subjectPreview('An opportunity to {{supportedBenefit}}',c),'An opportunity to [your business outcome]');
 assert.equal(Workspace.subjectPreview('{{senderName}} will join the call.',c),'Alex Smith will join the call.');
 assert.equal(Workspace.subjectPreview('{{recipientCompany}} — fit: {{fitScore}}/100',{...c,fitScore:null}),'ClientCo — fit: [real research score required]/100');
});

test('Outreach Studio presents trigger, style and subject before personalization and review',()=>{
 const {document,w}=mounted();
 const rail=document.querySelector('.mw-rail');
 const trigger=rail.querySelector('#mw-trigger-options');
 const styles=rail.querySelector('#mw-style-options');
 const subject=document.querySelector('.mw-editor #message-subject-choice');
 const personalize=document.querySelector('.mw-editor #message-generate');
 assert.ok(trigger&&styles&&subject&&personalize);
 assert.ok(trigger.compareDocumentPosition(styles)&4);
 assert.ok(styles.compareDocumentPosition(subject)&4);
 assert.ok(subject.compareDocumentPosition(personalize)&4);
 const view=w.LeadIntelMessageWorkspace.render(document,{ready:true,authenticated:true,hasDraft:true,channel:'email',pendingSelections:true,senderIdentityReady:true});
 assert.equal(view.canGenerate,true);
 assert.match(document.getElementById('mw-readiness-text').textContent,/Changes pending/);
 assert.equal(document.getElementById('approve-outreach').disabled,true);
 assert.ok(document.querySelector('[data-restore-email-version]'));
});

test('buying triggers are visible before collapsed legacy source review and unpersonalized emails cannot be approved',()=>{
 const {document,w}=mounted();
 const list=document.getElementById('mw-trigger-options'),review=document.getElementById('mw-source-editor')||document.querySelector('.mw-rail details');
 assert.ok(list&&review);assert.equal(document.querySelectorAll('#mw-trigger-options').length,1);
 assert.equal(review.open,false);
 w.LeadIntelMessageWorkspace.render(document,{ready:true,authenticated:true,channel:'email',hasDraft:true,unpersonalizedDraft:true,senderIdentityReady:true});
 assert.match(document.getElementById('mw-readiness-text').textContent,/personalize before approval/i);
 assert.equal(document.getElementById('approve-outreach').disabled,true);
});

test('Outreach Studio v2 puts decisions left, email composition right, and tools in one drawer',()=>{
 const {document}=mounted();
 const rail=document.querySelector('.mw-rail'),editor=document.querySelector('.mw-editor');
 assert.ok(rail.querySelector('#mw-trigger-options'));
 assert.ok(rail.querySelector('#mw-style-options'));
 assert.equal(rail.querySelector('#message-subject-choice'),null);
 assert.ok(editor.querySelector('#message-subject-choice'));
 assert.ok(editor.querySelector('#outreach-email-subject'));
 assert.ok(editor.querySelector('#outreach-email-body'));
 assert.ok(editor.querySelector('#message-generate'));
 const options=editor.querySelector('.mw-subject-options');
 const generate=editor.querySelector('.mw-generate-bar');
 assert.ok(options.compareDocumentPosition(generate)&4);
 assert.ok(generate.compareDocumentPosition(editor.querySelector('.script-grid'))&4);
 const tools=editor.querySelector('#mw-tools-drawer');
 assert.equal(tools.open,false);
 for(const id of ['message-template-editor','message-my-templates','mw-writing-references'])
   assert.equal(tools.querySelectorAll('#'+id).length,1,id);
 assert.equal(document.querySelectorAll('#message-generate').length,1);
 assert.equal(document.querySelectorAll('#outreach-email-subject').length,1);
 assert.equal(document.querySelectorAll('#outreach-email-body').length,1);
 assert.ok(tools.querySelector('#mw-value-proof'));
 assert.ok(document.querySelector('#mw-sender-line'));
 document.getElementById('mw-edit-sender').click();
 assert.equal(tools.open,false);
 assert.ok(document.querySelector('#mw-sender-card #mw-settings'));
 assert.equal(document.getElementById('mw-settings').open,true);
});

test('single strongest buying trigger replaces multi-option picker without losing style buttons',()=>{
 const {document,w}=mounted();
 w.LeadIntelMessageWorkspace.render(document,{ready:true,authenticated:true,channel:'email',hasDraft:true,selectedStyle:'professional',senderIdentityReady:true,company:'LKAB',triggers:[
 {url:'https://lkab.com/one',kind:'event',summary:'LKAB has announced a sorting plant investment.'},
 {url:'https://lkab.com/two',kind:'event',summary:'LKAB has announced another investment.'}]});
 assert.equal(document.querySelectorAll('#mw-trigger-options .mw-trigger-choice').length,1);
 assert.equal(document.querySelectorAll('#mw-style-options .mw-style').length,5);
 assert.ok(document.getElementById('mw-subject-options'));
 assert.ok(document.getElementById('mw-original-peek'));
 assert.ok(document.getElementById('mw-value-proof'));
 assert.equal(document.getElementById('outreach-email-body').closest('.script-grid')!==null,true);
});
test('working drawer retains easy access to library and sender and language tools are not in main generation area',()=>{
 const {document}=mounted();
 const links=[...document.querySelectorAll('.mw-library-shortcuts [data-open-tool]')];
 assert.deepEqual(links.map(x=>x.dataset.openTool),['mw-style-manager','mw-writing-references','mw-settings']);
 links.find(x=>x.dataset.openTool==='mw-settings').click();
 assert.equal(document.getElementById('mw-tools-drawer').open,true);
 assert.equal(document.getElementById('mw-settings').open,true);
});

test('email action centre shows one named Save as Template and gates direct send and flow by approval',()=>{
 const {document,w}=mounted();
 assert.ok(document.getElementById('message-save-as-template'));
 assert.equal(document.getElementById('message-save-draft').hidden,true);
 assert.ok(document.getElementById('mw-send-now'));
 assert.ok(document.getElementById('mw-add-flow'));
 assert.ok(document.getElementById('mw-flow-date'));
 assert.ok(document.getElementById('mw-flow-time'));
 assert.ok(document.getElementById('mw-flow-timezone'));
 assert.equal(Studio.Library.ids.length,20);
 w.LeadIntelMessageWorkspace.render(document,{channel:'email',ready:true,authenticated:true,hasDraft:true,approved:false});
 assert.equal(document.getElementById('mw-send-flow-actions').hidden,true);
 w.LeadIntelMessageWorkspace.render(document,{channel:'email',ready:true,authenticated:true,hasDraft:true,approved:true});
 assert.equal(document.getElementById('mw-send-flow-actions').hidden,false);
 assert.equal(document.getElementById('mw-flow-planner').hidden,true);
 w.LeadIntelMessageWorkspace.render(document,{channel:'email',ready:true,authenticated:true,hasDraft:true,approved:true,sentAlready:true});
 assert.equal(document.getElementById('mw-send-now').disabled,true);
 assert.equal(document.getElementById('mw-add-flow').disabled,false);
});

test('composer mounts the saved-draft control without querying it while its toolbar is detached',()=>{
 const {document}=mounted();const button=document.getElementById('message-save-draft');
 assert.ok(button?.isConnected);assert.equal(button.hidden,true);assert.equal(button.parentElement.id,'mw-draft-toolbar');assert.equal(typeof button.onclick,'function');assert.ok(!button.parentElement.textContent.includes('null'));
});

test('sender card shows saved contact details before the draft and clears previous workspace values',()=>{
 const {document,w}=mounted(),base={ready:true,authenticated:true,channel:'email',senderIdentityReady:true};
 w.LeadIntelMessageWorkspace.render(document,{...base,senderIdentity:{senderName:'Marta Kalna',senderTitle:'Partner',companyDisplayName:'North Legal',email:'marta@example.com',phone:'+123456789',linkedinUrl:'https://linkedin.com/in/marta'},calendly:'https://calendly.com/north/call'});
 const card=document.getElementById('mw-sender-card');assert.ok(card.compareDocumentPosition(document.getElementById('outreach-email-body'))&4);
 for(const text of ['Marta Kalna','Partner','North Legal','marta@example.com','+123456789','https://linkedin.com/in/marta','https://calendly.com/north/call'])assert.ok(card.textContent.includes(text),text);
 assert.equal(document.querySelector('#mw-tools-drawer #brand-identity'),null);
 assert.equal(document.querySelectorAll('#brand-email').length,1);
 w.LeadIntelMessageWorkspace.render(document,{...base,senderIdentity:{}});
 assert.doesNotMatch(document.getElementById('mw-sender-details').textContent,/Marta|North|marta@example/);
 assert.equal(document.querySelectorAll('#mw-sender-details [data-missing=true]').length,7);
});

test('Edit sender details opens canonical controls and saves email and phone through the existing identity controller',()=>{
 const {document,w}=mounted();w.eval(read('brand-identity.js'));w.eval(read('brand-identity-ui.js'));
 let identity={senderName:'Alex Smith',companyDisplayName:'South Services'};
 w.LeadIntelBrandIdentityUI.mount({getIdentity:()=>identity,setIdentity:next=>{identity=next}});
 document.getElementById('mw-edit-sender').click();
 assert.equal(document.getElementById('brand-identity-body').hidden,false);
 assert.equal(document.activeElement.id,'brand-sender-name');
 for(const [id,value] of [['brand-email','alex@example.com'],['brand-phone','+123456789']]){document.getElementById(id).value=value;document.getElementById(id).dispatchEvent(new w.Event('input',{bubbles:true}));}
 document.getElementById('brand-save').click();
 assert.equal(identity.status,'ready');assert.equal(identity.email,'alex@example.com');assert.equal(identity.phone,'+123456789');
 const restored=w.LeadIntelBrandIdentity.normalize(JSON.parse(JSON.stringify(identity)));assert.equal(restored.email,identity.email);
});
