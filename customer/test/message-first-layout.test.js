const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom'),Studio=require('../message-studio.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function mounted(){
 const dom=new JSDOM(read('index.html'),{url:'https://example.com/customer/',runScripts:'outside-only'}),w=dom.window;
 w.LeadIntelMessageStudio=Studio;w.LeadIntelMessageFacts=require('../message-facts.js');w.eval(read('message-workspace.js'));w.eval(read('sender-identity-location.js'));
 w.eval("var messageEditor=null,subjectEditing=false,subjectBusy=false,messageTranslationBusy=false;var messageWorkspaceUsable=()=>true;var messageRecipientReady=()=>true;var crmBridge=()=>({});var renderMessageWorkspace=()=>{};var cancelPendingScriptGeneration=()=>{};var generateStudioMessage=()=>{};var repairLegacyEmailIdentity=()=>false;var synchronizeMessageSender=()=>false;var scriptGenerationRequest=0;var readDraftEdits=()=>null;var q=id=>document.getElementById(id);var asset=p=>p;var esc=v=>String(v);var studioState=()=>({essentials:{}});var readStudio=()=>LeadIntelMessageStudio.normalize({});var persistStudio=()=>{};var invalidateStudioDraft=()=>{};var renderMessageStudio=()=>{};var renderPersonalSaveButton=()=>{};var renderPersonalStyleEditor=()=>{};var closePersonalReview=()=>{};var selectMandatoryEmailStyle=()=>false;var currentItem=()=>null;var workingSuggestedSubject=()=>'';var selectedCandidate=()=>null;var toast=()=>{};");
 const src=read('outreach-ui.js');w.eval(src.slice(src.indexOf('function injectOutreachUI(){'),src.indexOf('function showStep(step)')));w.eval(src.slice(src.indexOf('function installMessageStudio(){'),src.indexOf("let personalChannel='email'")));
 w.eval('injectOutreachUI();installMessageStudio();');return {dom,document:w.document,w};
}

function installViewportStyles(document,width){
 // JSDOM does not evaluate media queries. Resolve the actual stylesheet's width
 // rules for the fixture viewport, then test their mounted selector effects.
 const source=document.createElement('style');source.textContent=read('message-workspace.css');document.head.append(source);
 const matches=condition=>{
  if(/prefers-reduced-motion/.test(condition))return false;
  return [...condition.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)].every(([,bound,size])=>bound==='min'?width>=Number(size):width<=Number(size));
 };
 const resolve=rules=>[...rules].map(rule=>rule.conditionText?matches(rule.conditionText)?resolve(rule.cssRules):'':rule.cssText).join('\n');
 const resolved=resolve(source.sheet.cssRules);source.remove();const applied=document.createElement('style');applied.textContent=resolved;document.head.append(applied);
}

test('message-first mounted workspace puts optional setup below its single editor and reserves immediate follow-up host',()=>{
 const {document,w}=mounted();const drafts=document.querySelector('.mw-editor .outreach-drafts'),tools=document.getElementById('mw-tools-drawer');
 assert.equal(drafts.nextElementSibling.id,'mw-follow-up-host');
 assert.equal(drafts.nextElementSibling.nextElementSibling.id,'mw-writing-assistant');
 assert.ok(drafts.compareDocumentPosition(tools)&4);assert.equal(tools.open,false);
 assert.ok(tools.contains(document.getElementById('mw-default-template')));
 assert.ok(tools.contains(document.querySelector('.message-advanced')));
 assert.equal(document.querySelector('#step-6 > .message-advanced'),null);
 for(const id of ['mw-writing-references','mw-content-materials']){
  assert.ok(tools.contains(document.getElementById(id)));assert.equal(document.getElementById(id).open,false);
  assert.equal(document.getElementById('mw-writing-assistant').contains(document.getElementById(id)),false);
 }
 for(const id of ['outreach-email-subject','outreach-email-body','message-mode','message-calendly','mw-rewrite-message','mw-shorten-message','mw-restore-original'])assert.equal(document.querySelectorAll('#'+id).length,1,id);
 let actions=0;document.getElementById('message-save-as-template').addEventListener('click',()=>actions++);tools.open=true;document.getElementById('message-save-as-template').click();assert.equal(actions,1);
 w.close();
});

for(const [width,columns] of [[1440,5],[768,5],[600,3],[390,2]])test(`mounted composer at ${width}px keeps draft dominant and setup controls aligned`,()=>{
 const {document,w}=mounted();w.LeadIntelMessageTranslations=require('../message-translations.js');w.eval(read('message-translation-ui.js'));w.LeadIntelMessageTranslationUI.mount(document,{save(){},target(){},activate(){},restore(){},translate(){}});
 installViewportStyles(document,width);
 const css=node=>w.getComputedStyle(node);
 assert.equal(css(document.querySelector('.mw-layout')).display,'flex');assert.equal(css(document.querySelector('.mw-layout')).flexDirection,'column');
 assert.equal(css(document.getElementById('mw-style-options')).gridTemplateColumns,`repeat(${columns},minmax(0,1fr))`);
 const settings=css(document.getElementById('mw-settings')),languages=css(document.getElementById('mw-language-tools'));
 assert.equal(settings.minHeight,languages.minHeight);assert.equal(settings.padding,languages.padding);assert.equal(settings.margin,languages.margin);
 assert.equal(css(document.getElementById('mw-sender-card')).gridTemplateColumns,'repeat(2,minmax(0,1fr))');
 assert.equal(css(document.getElementById('outreach-email-body')).maxHeight,'none');assert.equal(css(document.getElementById('outreach-email-body')).overflowY,'hidden');
 assert.equal(css(document.querySelector('.mw-tools-content')).display,'none');
 assert.equal(document.getElementById('mw-settings').open,false);assert.equal(document.getElementById('mw-language-tools').open,false);
 w.close();
});

test('mounted canonical email grows with draft changes, shrinks after Reset-sized input and retries on viewport resize',()=>{
 const {document,w}=mounted(),body=document.getElementById('outreach-email-body');let measured=720;
 Object.defineProperty(body,'scrollHeight',{get:()=>measured});let changes=0;body.addEventListener('input',()=>changes++);
 body.value='An exact manual draft\n\nWith preserved paragraphs';body.dispatchEvent(new w.Event('input',{bubbles:true}));
 assert.equal(body.style.height,'722px');assert.equal(body.style.overflowY,'hidden');assert.equal(changes,1);
 const exact=body.value;measured=880;w.dispatchEvent(new w.Event('resize'));assert.equal(body.style.height,'882px');assert.equal(body.value,exact);
 measured=380;body.dispatchEvent(new w.Event('input'));assert.equal(body.style.height,'382px');assert.equal(body.value,exact);assert.equal(changes,2);
 assert.equal(w.LeadIntelMessageWorkspace.mount(document),false);body.dispatchEvent(new w.Event('input'));assert.equal(changes,3);
 w.close();
});
