const test=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
let M;try{M=require('../message-meeting-options.js');}catch{M={};}
function fixture(options={}){const dom=new JSDOM('<details id="mw-meeting-options"><summary>Meeting options</summary></details>',{url:'https://example.com/customer/'});let context={key:'workspace-a/person-a',message:'Hello\n\nAlex',subject:'Hello',booking:'https://calendly.com/example/call',usable:true};const inserts=[];return {dom,context,inserts,controller:typeof M.mount==='function'?M.mount(dom.window.document,{getContext:()=>context,onInsert:value=>{inserts.push(value);return true;},request:options.request||(async()=>({connected:false,configured:true})),connect:()=>{},...options}):null};}
test('meeting options start collapsed and booking insertion is explicit and deduplicated',()=>{
 assert.equal(typeof M.mount,'function');const {dom,inserts}=fixture(),q=id=>dom.window.document.getElementById(id);
 assert.equal(q('mw-meeting-options').open,false);assert.equal(inserts.length,0);q('meeting-insert-link').click();assert.equal(inserts.length,1);assert.match(inserts[0],/calendly/);
 assert.equal(M.insertBeforeSignature('Hello\n\nAlex','Choose a time: link','Alex'),'Hello\n\nChoose a time: link\n\nAlex');
 assert.equal(M.insertBeforeSignature('Hello\n\nChoose a time: link\n\nAlex','Choose a time: link','Alex'),'Hello\n\nChoose a time: link\n\nAlex');
});
test('calendar check preserves a draft and rejects late results from another recipient',async()=>{
 assert.equal(typeof M.mount,'function');let finish;const pending=new Promise(r=>finish=r);const f=fixture({request:async path=>path==='status'?{connected:true,email:'a@example.com'}:path==='calendars'?{calendars:[{id:'a',primary:true,timeZone:'Europe/Riga'}]}:pending});
 await f.controller.refresh();const p=f.controller.check();f.context.key='workspace-b/person-b';finish({slots:[{start:'2026-10-26T07:00:00Z',end:'2026-10-26T07:20:00Z'}],checkedAt:new Date().toISOString()});await p;
 assert.equal(f.dom.window.document.querySelectorAll('[data-meeting-slot]').length,0);assert.equal(f.inserts.length,0);
});
test('failed calendar checks clear prior suggestions and never claim availability',async()=>{
 assert.equal(typeof M.mount,'function');const f=fixture({request:async path=>path==='status'?{connected:true}:path==='calendars'?{calendars:[{id:'a',primary:true,timeZone:'Europe/Riga'}]}:Promise.reject(Error('Google unavailable'))});await f.controller.refresh();await f.controller.check();assert.equal(f.dom.window.document.querySelectorAll('[data-meeting-slot]').length,0);assert.match(f.dom.window.document.getElementById('meeting-status').textContent,/Google unavailable/);assert.equal(f.inserts.length,0);
});
test('switching workspace clears the previous calendar identity and selections',async()=>{
 const f=fixture({request:async path=>path==='status'?{connected:true,email:'private@example.com'}:{calendars:[{id:'private',name:'Private work',primary:true,timeZone:'Europe/Riga'}]}});await f.controller.refresh();assert.match(f.dom.window.document.getElementById('meeting-connection').textContent,/private@example.com/);f.context.key='other-workspace';f.controller.update();assert.doesNotMatch(f.dom.window.document.getElementById('meeting-connection').textContent,/private@example.com/);assert.equal(f.dom.window.document.getElementById('meeting-calendar').hidden,true);
});
test('meeting times respect the current message language without introducing English copy',()=>{
 assert.equal(typeof M.formatSuggestions,'function');const slots=[{start:'2026-10-26T08:00:00Z'}];
 for(const language of ['en','lv','ru','kk','de']){const value=M.formatSuggestions({slots,timeZone:'Europe/Riga',language});assert.match(value,/20 min · Europe\/Riga/);assert.doesNotMatch(value,/Would any|Timezone|work for you/);if(language==='ru')assert.match(value,/[а-я]/);}
});
test('calendar connection cannot navigate away while a manual edit is unfinished',()=>{
 let connections=0;const f=fixture({connect:()=>connections++});f.context.canConnect=false;f.dom.window.document.getElementById('meeting-connect').click();assert.equal(connections,0);assert.match(f.dom.window.document.getElementById('meeting-status').textContent,/Save or cancel/);
});
test('meeting insertion preserves existing rich formatting and keeps the previous draft recoverable',()=>{
 assert.equal(typeof M.insertDraft,'function');const Rich=require('../rich-text.js'),Editor=require('../message-editor.js');
 const before={subject:'Hello',message:'Hello Sam\n\nQuality\nDelivery\n\nAlex',messageHtml:'<p>Hello <strong>Sam</strong></p><ul><li>Quality</li><li>Delivery</li></ul><p>Alex</p>'};
 const draft=M.insertDraft(before,'20 min · Europe/Riga\n26 Oct 2026, 10:00','Alex');assert.match(draft.messageHtml,/<strong>Sam<\/strong>/);assert.match(draft.messageHtml,/<ul>/);assert.ok(Rich.matchingHtml(draft.message,draft.messageHtml));
 const item={channel:'email',domain:'example.com',drafts:{emailSubject:before.subject,emailBody:before.message,emailBodyHtml:before.messageHtml},messageStudioDraft:{}};const changed=Editor.apply(item,draft,{templateUpdate:true,origin:'manual'});assert.ok(changed.drafts.emailBodyHtml);const undo=Editor.undoTemplateUpdate(changed);assert.equal(undo.drafts.emailBody,before.message);assert.equal(undo.drafts.emailBodyHtml,Rich.sanitize(before.messageHtml));
});
