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
 assert.equal(q('mw-restore-original').textContent,'Reset');assert.equal(q('message-save-as-template').textContent,'Library');
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
