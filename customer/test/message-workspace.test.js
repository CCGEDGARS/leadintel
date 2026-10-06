const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),Workspace=require('../message-workspace.js'),Studio=require('../message-studio.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function mounted(){
 const dom=new JSDOM(read('index.html'),{url:'https://example.com/customer/',runScripts:'outside-only'}),w=dom.window;
 w.LeadIntelMessageStudio=Studio;w.eval(read('message-workspace.js'));w.eval(read('sender-identity-location.js'));
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
