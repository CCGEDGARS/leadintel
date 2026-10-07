const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),Workspace=require('../message-workspace.js'),Studio=require('../message-studio.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function mounted(){
 const dom=new JSDOM(read('index.html'),{url:'https://example.com/customer/',runScripts:'outside-only'}),w=dom.window;
 w.LeadIntelMessageStudio=Studio;w.LeadIntelMessageFacts=require('../message-facts.js');w.eval(read('message-workspace.js'));w.eval(read('sender-identity-location.js'));
 w.eval("var scriptGenerationRequest=0;var readDraftEdits=()=>null;var q=id=>document.getElementById(id);var asset=p=>p;var esc=v=>String(v);var studioState=()=>({essentials:{}});var readStudio=()=>({});var persistStudio=()=>{};var invalidateStudioDraft=()=>{};var renderMessageStudio=()=>{};var renderPersonalSaveButton=()=>{};var closePersonalReview=()=>{};var currentItem=()=>null;var toast=()=>{};");
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
 w.LeadIntelMessageWorkspace.render(document,{...base,hasDraft:false});assert.equal(document.getElementById('mw-empty').hidden,false);assert.equal(document.querySelector('.script-grid').hidden,true);
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
 w.LeadIntelMessageWorkspace.render(document,{...base,templateSelected:true});assert.match(document.getElementById('message-generate').textContent,/Apply selected style/i);
 w.LeadIntelMessageWorkspace.render(document,{...base,templateSelected:false});assert.match(document.getElementById('message-generate').textContent,/Apply selected style/i);
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
