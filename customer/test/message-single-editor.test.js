const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),Workspace=require('../message-workspace.js'),Studio=require('../message-studio.js'),Editor=require('../message-editor.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function mounted(){
 const dom=new JSDOM(read('index.html'),{url:'https://example.com/customer/',runScripts:'outside-only'}),w=dom.window;
 w.LeadIntelMessageStudio=Studio;w.LeadIntelMessageFacts=require('../message-facts.js');w.eval(read('message-workspace.js'));w.eval(read('sender-identity-location.js'));
 w.eval("var repairLegacyEmailIdentity=()=>false;var scriptGenerationRequest=0;var readDraftEdits=()=>null;var q=id=>document.getElementById(id);var asset=p=>p;var esc=v=>String(v);var studioState=()=>({essentials:{}});var readStudio=()=>({});var persistStudio=()=>{};var invalidateStudioDraft=()=>{};var renderMessageStudio=()=>{};var renderPersonalSaveButton=()=>{};var renderPersonalStyleEditor=()=>{};var closePersonalReview=()=>{};var currentItem=()=>null;var toast=()=>{};");
 const src=read('outreach-ui.js');w.eval(src.slice(src.indexOf('function injectOutreachUI(){'),src.indexOf('function showStep(step)')));w.eval(src.slice(src.indexOf('function installMessageStudio(){'),src.indexOf("let personalChannel='email'")));
 w.eval('injectOutreachUI();installMessageStudio();');return {dom,document:w.document,w};
}
const ready={ready:true,authenticated:true,hasDraft:true,senderIdentityReady:true,channel:'email',templateSelected:true,selectedStyle:'professional',appliedStyle:'professional'};
test('single composer has subject immediately before body, one full message and no proposed second script',()=>{
 const {document,w}=mounted();const q=id=>document.getElementById(id);
 w.LeadIntelMessageWorkspace.render(document,{...ready,automaticUpdate:{draft:{subject:'New',message:'Proposed'}}});
 assert.equal(q('mw-auto-update'),null);assert.equal(q('mw-rewrite-preview'),null);
 assert.ok(q('mw-subject-options').compareDocumentPosition(q('outreach-email-body'))&w.Node.DOCUMENT_POSITION_FOLLOWING);
 assert.equal(q('mw-default-template').hidden,false);
 for(const id of ['mw-save-message','mw-edit-message','mw-rewrite-message','mw-restore-original','message-save-as-template','mw-mark-default','mw-add-flow'])assert.equal(document.querySelectorAll('#'+id).length,1);
 assert.equal(q('mw-restore-original').textContent,'Reset');assert.equal(q('message-save-as-template').textContent,'Add to library');
 assert.equal(q('mw-update-use'),null);assert.equal(q('mw-update-keep'),null);
});
test('flow and library actions stay disabled until exact current draft is durably saved; Save link is available',()=>{
 const {document,w}=mounted(),q=id=>document.getElementById(id);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:false});assert.equal(q('mw-add-flow').disabled,true);assert.equal(q('message-save-as-template').disabled,true);assert.equal(q('mw-save-required').hidden,false);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true});assert.equal(q('mw-add-flow').disabled,false);assert.equal(q('message-save-as-template').disabled,false);assert.equal(q('mw-save-required').hidden,true);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,editorState:{editing:true}});assert.equal(q('mw-add-flow').disabled,true);assert.equal(q('message-save-as-template').disabled,true);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,approvalBlocked:true});assert.equal(q('mw-add-flow').disabled,true);
});
test('default library pattern survives serialization, is independent of selected style and never leaks across workspaces',()=>{
 assert.equal(typeof Studio.markDefault,'function');let s=Studio.saveMyTemplate({},'template-1',{name:'Executive invitation',subject:'For {{buyerCompany}}',body:'Hello {{firstName}}, {{offer}}. {{calendly}}'});
 s=Studio.markDefault(s,'template-1');s.mode='friendly';const restored=Studio.normalize(JSON.parse(JSON.stringify(Studio.storageState(s))));assert.equal(Studio.defaultTemplate(restored).name,'Executive invitation');assert.equal(restored.mode,'friendly');assert.equal(Studio.defaultTemplate(Studio.normalize()),null);
 assert.throws(()=>Studio.markDefault({},'template-1'),/saved/i);
 const changed=Studio.saveMyTemplate(s,'template-1',{name:'Edited',subject:'New',body:'Different'},true);assert.equal(Studio.defaultTemplate(changed).body,'Hello {{firstName}}, {{offer}}. {{calendly}}');
 assert.equal(Studio.defaultTemplate(Studio.deleteMyTemplate(s,'template-1')),null);
});
test('saved readiness requires matching exact subject/body and failed or local-only saves never become ready',()=>{
 assert.equal(typeof Editor.savedDraft,'function');const item={channel:'email',drafts:{emailSubject:'S',emailBody:'B'},messageStudioDraft:{savedDraft:{subject:'S',message:'B'},scriptSavedAt:'2026-10-09'}};
 assert.equal(Editor.savedDraft(item),true);assert.equal(Editor.savedDraft({...item,drafts:{emailSubject:'Changed',emailBody:'B'}}),false);assert.equal(Editor.savedDraft({...item,messageStudioDraft:{scriptSavedAt:'2026-10-09'}}),false);assert.equal(Editor.savedDraft({...item,messageStudioDraft:{...item.messageStudioDraft,savePending:true}}),false);
 assert.equal(Editor.savedDraft(Editor.apply(item,{subject:'S',message:'New'})),false);
});
test('inline rewrite replaces only the working script after explicit request and preserves undo and Save boundary',async()=>{
 let draft={subject:'S',message:'Original'},saved=0;const c=Editor.createController({scope:()=> 'same',read:()=>draft,usable:()=>true,inlineRewrite:true,apply:value=>{draft=value},save:async()=>{saved++;return {ok:true}},rewrite:async()=>({subject:'S',message:'New working text'})});
 await c.rewrite();assert.equal(draft.message,'New working text');assert.equal(c.state().preview,null);assert.equal(saved,0);assert.equal(c.state().canUndo,true);c.undo();assert.equal(draft.message,'Original');
});

test('empty default offers library navigation without replacing the saved working message',()=>{
 const {document,w}=mounted(),q=id=>document.getElementById(id);q('outreach-email-body').value='Keep my current message';
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true});
 assert.equal(q('mw-open-default').hidden,true);assert.equal(q('mw-edit-default').hidden,true);assert.equal(q('mw-browse-templates').hidden,false);
 q('mw-tools-drawer').open=false;q('message-my-templates').open=false;q('mw-browse-templates').click();
 assert.equal(q('mw-tools-drawer').open,true);assert.equal(q('message-my-templates').open,true);assert.equal(q('outreach-email-body').value,'Keep my current message');
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,defaultTemplate:{id:'template-1',name:'My invitation',body:'Protected reference'}});
 assert.equal(q('mw-browse-templates').hidden,true);assert.equal(q('mw-open-default').hidden,false);assert.equal(q('mw-default-name').textContent,'My invitation');
 assert.match(q('mw-default-preview').textContent,/all qualified contacts/);
});

test('pending update has one notice and cannot apply over a manual edit; completed setup stays quiet',()=>{
 const {document,w}=mounted(),q=id=>document.getElementById(id);q('outreach-email-body').value='My manual text';
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,pendingSelections:true,automaticUpdate:{draft:{}},editorState:{editing:true}});
 assert.equal(q('mw-auto-settings').hidden,false);assert.equal(q('mw-auto-settings').contains(q('mw-readiness')),true);assert.equal(q('message-generate').disabled,true);
 assert.equal(q('outreach-email-body').readOnly,false);assert.equal(q('outreach-email-body').value,'My manual text');assert.equal(q('mw-save-message').disabled,false);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,pendingSelections:true,automaticUpdate:{draft:{}}});
 assert.equal(q('message-generate').disabled,false);assert.equal(q('mw-save-message').disabled,true);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true});
 assert.equal(q('mw-auto-settings').hidden,true);assert.equal(q('mw-readiness').hidden,true);assert.equal(q('mw-editor-status').hidden,true);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,syncConflict:true});
 assert.equal(q('mw-auto-settings').hidden,false);assert.equal(q('mw-readiness').hidden,false);assert.equal(q('message-generate').disabled,true);
});

test('default requires a saved library template and action labels explain their destinations',()=>{
 const {document,w}=mounted(),q=id=>document.getElementById(id);
 w.LeadIntelMessageWorkspace.render(document,{...ready,selectedLibraryId:'template-1',savedDraft:false});assert.equal(q('mw-mark-default').disabled,true);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true});assert.equal(q('mw-mark-default').disabled,true);assert.match(q('mw-mark-default').title,/library first/);
 w.LeadIntelMessageWorkspace.render(document,{...ready,selectedLibraryId:'template-1',savedDraft:true});assert.equal(q('mw-mark-default').disabled,false);
 assert.equal(q('message-save-as-template').textContent,'Add to library');assert.equal(q('mw-mark-default').textContent,'Set default');assert.equal(q('mw-add-flow').textContent,'Add to flow');
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,readinessError:'Replace [link] before adding to flow.',editorState:{error:'Save failed. Try again.'}});
 assert.equal(q('mw-editor-status').textContent,'Save failed. Try again.');assert.equal(q('mw-add-flow').disabled,true);
});

test('placeholder guidance names the missing fields without changing the message',()=>{
 const source=read('outreach-ui.js'),start=source.indexOf('function messagePlaceholderHelp('),end=source.indexOf('function seedMandatoryEmail(',start);
 const help=new Function(source.slice(start,end)+'return messagePlaceholderHelp;')();
 const body='Hi (First name Second name), see [link]. Book [Calendly link]. [link]';
 assert.equal(help(body),'Click Edit and replace (First name Second name), [link], [Calendly link] before adding to flow.');
 assert.equal(help('Hi Marta, https://example.com'),'');assert.equal(help('{{sender}}'),'Click Edit and replace {{sender}} before adding to flow.');
});

test('manual subject edits do not masquerade as changed facts or prevent a saved message proceeding',()=>{
 const source=read('outreach-ui.js'),start=source.indexOf('function pendingMessageSelections('),end=source.indexOf('function renderMessageWorkspace(',start);
 const pending=new Function(source.slice(start,end)+'return pendingMessageSelections;')();
 const item={channel:'email',drafts:{emailSubject:'My deliberate custom subject',emailBody:'My exact saved body'},dossier:{selectedTrigger:{url:'https://example.com/event'}},messageStudioDraft:{generatedAt:'2026-10-10',mode:'professional',triggerSourceUrl:'https://example.com/event',selectedSubject:'Original suggested subject'}};
 assert.equal(pending(item,{mode:'professional'}),false);assert.equal(item.drafts.emailSubject,'My deliberate custom subject');assert.equal(item.drafts.emailBody,'My exact saved body');
 assert.equal(pending(item,{mode:'friendly'}),true);
 assert.equal(pending({...item,dossier:{selectedTrigger:{url:'https://example.com/new'}}},{mode:'professional'}),true);
 assert.equal(pending({...item,messageStudioDraft:{...item.messageStudioDraft,pendingTemplateUpdate:{draft:{}}}},{mode:'professional'}),true);
 assert.equal(pending({...item,channel:'linkedin'},{mode:'professional'}),false);
 const {document,w}=mounted();w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,pendingSelections:pending(item,{mode:'professional'})});
 assert.equal(document.getElementById('mw-auto-settings').hidden,true);assert.equal(document.getElementById('mw-add-flow').disabled,false);
});

test('saved drafts retain booking and Profile readiness guidance when flow is unavailable',()=>{
 const {document,w}=mounted(),q=id=>document.getElementById(id);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,missing:['calendly']});
 assert.equal(q('mw-auto-settings').hidden,false);assert.equal(q('mw-readiness').hidden,false);assert.match(q('mw-readiness-detail').textContent,/booking link/);
 assert.equal(q('message-generate').hidden,true);assert.equal(q('mw-add-flow').disabled,true);assert.match(q('mw-add-flow').title,/booking link/);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,unconfirmed:['meeting_value']});
 assert.equal(q('mw-auto-settings').hidden,false);assert.equal(q('mw-resolve').hidden,false);assert.match(q('mw-resolve').textContent,/Profile/);assert.equal(q('mw-add-flow').disabled,true);
 w.LeadIntelMessageWorkspace.render(document,{...ready,savedDraft:true,pendingSelections:true});assert.match(q('mw-add-flow').title,/Apply the update/);
});
