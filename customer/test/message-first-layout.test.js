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

test('split workspace places only the Writing Assistant launcher directly below styles',()=>{
 const {document,w}=mounted();const drafts=document.querySelector('.mw-editor .outreach-drafts'),tools=document.getElementById('mw-tools-drawer');
 assert.equal(document.getElementById('mw-style-options').closest('section').nextElementSibling.id,'mw-writing-assistant-launcher');
 assert.ok(document.querySelector('.mw-rail').contains(document.getElementById('mw-writing-assistant-launcher')));assert.equal(document.getElementById('mw-writing-assistant').hidden,true);
 assert.equal(drafts.nextElementSibling.id,'mw-follow-up-host');
 assert.ok(drafts.compareDocumentPosition(tools)&4);assert.equal(tools.open,false);
 assert.ok(tools.contains(document.getElementById('mw-default-template')));
 assert.ok(tools.contains(document.querySelector('.message-advanced')));
 assert.equal(document.querySelector('#step-6 > .message-advanced'),null);
 for(const id of ['mw-content-materials']){
  assert.ok(tools.contains(document.getElementById(id)));assert.equal(document.getElementById(id).open,false);
  assert.equal(document.getElementById('mw-writing-assistant').contains(document.getElementById(id)),false);
 }
 for(const id of ['outreach-email-subject','outreach-email-body','message-mode','message-calendly','mw-rewrite-message','mw-shorten-message','mw-restore-original'])assert.equal(document.querySelectorAll('#'+id).length,1,id);
 const references=document.getElementById('mw-writing-references');assert.ok(document.getElementById('mw-writing-assistant').contains(references));assert.equal(document.querySelectorAll('#mw-writing-references').length,1);assert.match(references.querySelector('summary').textContent,/Content Library/);assert.ok(references.querySelector('#mw-writing-reference-host'));assert.equal(references.open,false);
 let actions=0;document.getElementById('message-save-as-template').addEventListener('click',()=>actions++);tools.open=true;document.getElementById('message-save-as-template').click();assert.equal(actions,1);
 w.close();
});

for(const [width,columns] of [[1440,1],[768,3],[600,3],[390,2]])test(`mounted composer at ${width}px keeps draft dominant and setup controls aligned`,()=>{
 const {document,w}=mounted();w.LeadIntelMessageTranslations=require('../message-translations.js');w.eval(read('message-translation-ui.js'));w.LeadIntelMessageTranslationUI.mount(document,{save(){},target(){},activate(){},restore(){},translate(){}});
 w.LeadIntelMessageWorkspace.paintStyles(document);installViewportStyles(document,width);
 const css=node=>w.getComputedStyle(node);
 assert.equal(css(document.querySelector('.mw-layout')).display,'grid');assert.equal(css(document.querySelector('.mw-layout')).gridTemplateColumns,width>900?'280px minmax(0,1fr)':'minmax(0,1fr)');
 assert.ok(document.querySelector('.mw-rail').contains(document.getElementById('mw-style-options')));assert.ok(document.querySelector('.mw-editor').contains(document.getElementById('outreach-email-body')));
 assert.equal(css(document.getElementById('mw-style-options')).gridTemplateColumns,columns===1?'minmax(0,1fr)':`repeat(${columns},minmax(0,1fr))`);
 assert.equal(css(document.querySelector('.mw-style')).textAlign,width>900?'left':'center');
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

test('the one Writing Assistant material host retains upload, activation, role and instruction handlers',async()=>{
 const {document,w}=mounted(),root=document.getElementById('mw-writing-reference-host');
 const {mountWritingReferences}=require('../writing-references-ui.js');let card={slot:1,id:'book',filename:'guide.txt',status:'Ready',active:false,revision:1,summary:'Ask useful questions',instruction:'',role:'guidance'},changes=[];
 const api={list:async()=>({cards:[card],referenceRevision:1}),patch:async(id,change)=>{changes.push(change);card={...card,...change};return {cards:[card],referenceRevision:2};}};
 const app=mountWritingReferences({root,api});await app.refresh();
 const refs=document.getElementById('mw-writing-references');refs.open=true;
 assert.equal(root.closest('#mw-writing-assistant')?.id,'mw-writing-assistant');assert.equal(document.querySelectorAll('#mw-writing-reference-host').length,1);
 assert.equal(root.querySelectorAll('[data-upload]').length,3);assert.ok(root.querySelector('[data-role]'));assert.ok(root.querySelector('[data-instruction]'));
 const active=root.querySelector('[data-active]');active.checked=true;active.dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(changes[0].active,true);
 const instruction=root.querySelector('[data-instruction]');instruction.value='Use concise questions';instruction.dispatchEvent(new w.Event('change',{bubbles:true}));await new Promise(resolve=>setImmediate(resolve));
 assert.equal(changes.at(-1).instruction,'Use concise questions');
 assert.ok(document.getElementById('mw-tools-drawer').contains(document.getElementById('mw-book-controls')));assert.equal(refs.contains(document.getElementById('mw-book-controls')),false);
 app.destroy();w.close();
});

for(const width of [1440,390])test(`mounted Follow-Up Assistant disclosure has consistent host-scoped padding at ${width}px`,()=>{
 const {document,w}=mounted();const {mountFollowUpAssistant}=require('../follow-up-assistant-ui.js');
 const view=mountFollowUpAssistant(document,{capture:()=>({})});
 const source=document.createElement('style');source.textContent=read('follow-up-assistant.css');document.head.append(source);
 const matches=condition=>[...condition.matchAll(/\((min|max)-width:\s*(\d+)px\)/g)].every(([,bound,size])=>bound==='min'?width>=Number(size):width<=Number(size));
 const resolve=rules=>[...rules].map(rule=>rule.conditionText?matches(rule.conditionText)?resolve(rule.cssRules):'':rule.cssText).join('\n');const cssText=resolve(source.sheet.cssRules);source.remove();
 installViewportStyles(document,width);const applied=document.createElement('style');applied.textContent=cssText;document.head.append(applied);
 const details=document.querySelector('#mw-follow-up-host>.fu-assistant'),summary=details.querySelector('summary'),content=details.querySelector('.fu-content');
 assert.equal(w.getComputedStyle(details).padding,'0px');assert.equal(w.getComputedStyle(summary).padding,width===390?'12px 14px':'14px 16px');
 assert.equal(w.getComputedStyle(content).padding,width===390?'0px 14px 14px':'0px 16px 16px');assert.equal(w.getComputedStyle(content).display,'none');assert.equal(details.open,false);
 assert.ok(document.getElementById('mw-writing-assistant-launcher').compareDocumentPosition(document.getElementById('mw-follow-up-host'))&4);
 view.destroy();w.close();
});

test('the explicit approved-template recovery stays visible and compact while hidden recovery takes no space',()=>{
 const {document,w}=mounted(),panel=document.createElement('section');panel.id='mw-approved-recovery';panel.className='mw-section';panel.innerHTML='<p id="mw-approved-recovery-copy">Working copy differs. Previous text stays recoverable.</p><button id="mw-restore-approved" class="secondary-btn" type="button">Restore approved Professional</button>';document.getElementById('mw-subject-options').before(panel);
 installViewportStyles(document,1440);assert.equal(w.getComputedStyle(panel).display,'flex');assert.equal(w.getComputedStyle(panel).padding,'12px 14px');assert.equal(panel.querySelector('button').type,'button');
 panel.hidden=true;assert.equal(w.getComputedStyle(panel).display,'none');w.close();
});

test('opening the sidebar launcher reveals the single dialog session and closing preserves it',()=>{
 const {document,w}=mounted();w.eval(read('writing-assistant-ui.js'));
 const controller={state:()=>({messages:[{role:'assistant',content:'Existing conversation'}],busy:false}),ask(){throw Error('opening must not generate')},applyPreview(){},discardPreview(){},cancel(){}};
 const panel=document.getElementById('mw-writing-assistant'),refs=document.getElementById('mw-writing-references');
 const view=w.LeadIntelWritingAssistantUI.mountWritingAssistant(document,controller);
 const launcher=document.getElementById('mw-writing-assistant-launcher');
 assert.equal(launcher.parentElement.className,'mw-rail');assert.equal(launcher.querySelectorAll('textarea,input,details,[data-wa-attach],.mw-assistant-actions').length,0);
 assert.equal(document.querySelector('.mw-rail #mw-writing-assistant'),null);assert.equal(panel.closest('dialog'),document.querySelector('.wa-dialog'));
 launcher.querySelector('[data-wa-open]').click();assert.equal(document.querySelector('.wa-dialog').hasAttribute('open'),true);assert.equal(panel.hidden,false);
 const instruction=document.querySelector('[data-wa-instruction]');instruction.value='Keep my instruction';document.querySelector('[data-wa-close]').click();
 assert.equal(document.querySelector('.wa-dialog').hasAttribute('open'),false);assert.equal(instruction.value,'Keep my instruction');
 launcher.querySelector('[data-wa-open]').click();assert.equal(document.getElementById('mw-writing-references'),refs);assert.match(document.querySelector('[data-wa-transcript]').textContent,/Existing conversation/);
 assert.equal(document.querySelectorAll('#mw-writing-assistant-launcher').length,1);assert.equal(document.querySelectorAll('#mw-writing-assistant').length,1);view.destroy();w.close();
});
