const test=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const {createWritingAssistant}=require('../writing-assistant.js'),{mountWritingAssistant}=require('../writing-assistant-ui.js'),Context=require('../writing-assistant-context.js'),Rich=require('../rich-text.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function mounted({draft={subject:'Invitation',message:'Bob Seller invites Alice to talk.'},request,uiOptions={},validatePreview=async(p,c)=>Context.validateWritingDraft(p.draft,c)}={}){
 const dom=new JSDOM('<section id="mw-writing-assistant"></section><button id="mw-add-flow">Delivery</button>',{pretendToBeVisual:true}),w=dom.window;w.LeadIntelRichText=Rich;
 let snapshot={scope:'account-a:workspace-a:alice:email',fingerprint:'same-facts',referenceRevision:1,sourceRefs:[],skillRefs:[],usable:true,context:{writingContext:'customer',channel:'email',style:'original',seller:{sender:'Bob Seller'},currentDraft:draft}},ui;
 const controller=createWritingAssistant({workbench:true,capture:()=>snapshot,sessionStore:null,request:request||(async()=>({reply:'Revised.',draft:{subject:'Updated',message:'Bob Seller proposes a call.'},provenance:{referenceRevision:1}})),validatePreview,onChange:()=>ui?.render()});
 ui=mountWritingAssistant(w.document,controller,{usable:()=>snapshot.usable,assistantContext:()=>snapshot.context,...uiOptions});ui.open();
 const q=s=>w.document.querySelector(s),submit=async()=>{q('[data-wa-instruction]').value='Improve this draft';q('form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();};
 return {w,controller,ui,q,submit,change:patch=>snapshot={...snapshot,...patch},close(){ui.destroy();controller.destroy();w.close();}};
}
test('mounted improvement preserves hidden hyperlink targets when wording changes',async()=>{
 const draft={subject:'Invitation',message:'Bob Seller: book our call.',messageHtml:'Bob Seller: <a href="https://calendar.example/private">book our call</a>.'};
 const f=mounted({draft,request:async()=>({reply:'Revised.',draft:{subject:'Updated',message:'Bob Seller: let us meet.'},provenance:{referenceRevision:1}})});
 await f.submit();assert.equal(f.controller.state().working.message,draft.message);assert.equal(f.controller.state().working.messageHtml,draft.messageHtml);assert.match(f.q('[data-wa-status]').textContent,/link/i);assert.equal(f.controller.state().busy,false);f.close();
});
test('mounted apply rejects a same-text account/workspace switch during source validation',async()=>{
 let resolve;const f=mounted({validatePreview:()=>new Promise(r=>resolve=r)});
 await f.controller.ask('Rewrite',{intent:'preview'});const original=f.controller.state().working;
 f.q('[data-wa-apply]').click();await tick();f.change({scope:'account-b:workspace-b:alice:email'});resolve();await tick();await tick();
 assert.deepEqual(f.controller.state().working,original);assert.equal(f.controller.state().busy,false);assert.match(f.q('[data-wa-status]').textContent,/context changed/i);f.close();
});
test('malformed provider metadata is rejected before mounted transcript or preview mutation',async()=>{
 for(const bad of [{draft:{subject:'Updated',message:[]}}, {citations:{}}, {warnings:{}}, {reply:42}]){
  const f=mounted({request:async()=>({reply:'Revised.',draft:{subject:'Updated',message:'Bob Seller proposes a call.'},citations:[],warnings:[],provenance:{referenceRevision:1},...bad})});
  assert.equal(await f.controller.ask('Rewrite',{intent:'preview'}),false);assert.equal(f.controller.state().preview,null);assert.equal(f.controller.state().messages.length,0);assert.equal(f.controller.state().busy,false);assert.equal(f.q('[data-wa-edit-body]').value,'Bob Seller invites Alice to talk.');f.close();
 }
});
test('mounted formatting-only improvement is reversible without touching source draft',async()=>{
 const draft={subject:'Invitation',message:'Bob Seller invites Alice to talk.'},formatted={...draft,messageHtml:'<strong>Bob Seller</strong> invites Alice to talk.'};const f=mounted({draft,request:async()=>({reply:'Emphasized the sender.',draft:formatted,provenance:{referenceRevision:1}})});
 await f.submit();assert.equal(f.controller.state().working.messageHtml,formatted.messageHtml);assert.equal(f.controller.state().canUndo,true);f.q('[data-wa-undo]').click();assert.deepEqual(f.controller.state().working,draft);f.close();
});

test('mounted Continue cannot acknowledge a malformed successful general-library save',async()=>{
 const {createWritingWorkspaceApi}=require('../writing-workspace.js'),payload={kind:'draft',title:'Invitation',subject:'Invitation',message:'Bob Seller invites Alice to talk.',expectedRevision:0};
 for(const response of [{},{record:null},{record:{...payload,id:'different',revision:1}},{record:{...payload,id:'mine',revision:2}},{record:{...payload,id:'mine',revision:1,message:'Another draft'}}]){
  const api=createWritingWorkspaceApi({workspaceId:'w',fetchImpl:async()=>({ok:true,json:async()=>response})});
  const f=mounted({uiOptions:{useDraft:async()=>{await api.save('mine',payload);return true;}}});f.q('[data-wa-continue]').click();await tick();await tick();
  assert.equal(f.q('dialog').hasAttribute('open'),true);assert.match(f.q('[data-wa-work-status]').textContent,/invalid|saved|preserved/i);assert.equal(f.q('[data-wa-continue]').disabled,false);f.close();
 }
});
test('mounted source check cancellation releases controls and ignores late validation',async()=>{
 let resolve;const f=mounted({validatePreview:()=>new Promise(r=>resolve=r)});await f.controller.ask('Rewrite',{intent:'preview'});const before=f.controller.state().working;
 f.q('[data-wa-apply]').click();await tick();assert.equal(f.q('[data-wa-cancel]').hidden,false);f.q('[data-wa-cancel]').click();assert.equal(f.controller.state().busy,false);assert.equal(f.q('[data-wa-edit-body]').disabled,false);assert.equal(f.w.document.activeElement,f.q('[data-wa-instruction]'));resolve();await tick();assert.deepEqual(f.controller.state().working,before);f.close();
});
test('mounted Reload confirmation cannot replace a reopened assistant session',async()=>{
 let confirm;const f=mounted({uiOptions:{confirmReplace:()=>new Promise(resolve=>confirm=resolve)}});f.controller.setDraft({subject:'My subject',message:'My unsaved manual draft'});f.q('[data-wa-load]').click();await tick();f.ui.close();f.ui.open();confirm(true);await tick();assert.equal(f.controller.state().working.message,'My unsaved manual draft');f.close();
});
test('closing between book deselection and selection prevents the late selection',async()=>{
 let resolve,calls=[];const rows=[{id:'a',slot:1,status:'Ready',active:true,filename:'A.pdf'},{id:'b',slot:2,status:'Ready',active:false,filename:'B.pdf'}];
 const f=mounted({uiOptions:{books:()=>rows,activateBook:async id=>{calls.push(id);if(id==='a')await new Promise(r=>resolve=r);return true;},resetBooks:()=>{for(const row of rows)row.active=false;}}});rows[0].active=true;f.ui.render();f.q('[data-wa-book-slot="2"]').click();await tick();f.ui.close();f.ui.open();resolve();await tick();await tick();assert.deepEqual(calls,['a']);assert.equal(f.q('[data-wa-generate]').disabled,false);f.close();
});
test('source attribution follows exact HTML as well as plain subject and body',()=>{
 const draft={subject:'Invitation',message:'Alice, Bob Seller here.'},assistant={workspaceId:'w',referenceRevision:1},input={workspace:'w',item:{domain:'buyer.test',selectedPersonId:'alice',channel:'email',messageStudioDraft:{writingAssistant:assistant,writingAssistantDraft:draft}},candidate:{company:'Buyer'},person:{id:'alice',name:'Alice'},studio:{mode:'original',essentials:{}},facts:{},refs:{workspaceId:'w',referenceRevision:1},usable:true,currentDraft:draft};
 assert.deepEqual(Context.captureWritingContext(input).draftAssistant,assistant);assert.equal(Context.captureWritingContext({...input,currentDraft:{...draft,messageHtml:'<strong>Alice</strong>, Bob Seller here.'}}).draftAssistant,null);
});
test('source revisions, identity/fact edits and language changes reject pending mounted requests',async()=>{
 for(const patch of [{referenceRevision:2},{skillRefs:[{id:'skill',revision:2}]},{sourceRefs:[{id:'book',revision:2}]},{fingerprint:'recipient-email-or-sender-or-trigger-revised'},{fingerprint:'language-ru'},{usable:false}]){
  let resolve,calls=0;const f=mounted({request:()=>{calls++;return new Promise(r=>resolve=r);}}),before=f.controller.state().working,pending=f.controller.ask('Improve',{intent:'preview'});assert.equal(await f.controller.ask('Duplicate',{intent:'preview'}),false);assert.equal(calls,1);f.change(patch);resolve({reply:'Late result.',draft:{subject:'Late',message:'Bob Seller late result.'},provenance:{referenceRevision:1}});assert.equal(await pending,false);assert.deepEqual(f.controller.state().working,before);assert.equal(f.controller.state().preview,null);assert.equal(f.controller.state().busy,false);f.close();
 }
});
test('a pending save owns its original scope and cannot lock another account editor',async()=>{
 let resolve;const f=mounted({uiOptions:{useDraft:()=>new Promise(r=>resolve=r)}});f.q('[data-wa-continue]').click();await tick();assert.equal(f.q('[data-wa-continue]').disabled,true);f.change({scope:'account-b:workspace-b:alice:email'});f.controller.syncContext();assert.equal(f.q('[data-wa-continue]').disabled,false);assert.equal(f.q('[data-wa-edit-body]').disabled,false);resolve(true);await tick();assert.equal(f.q('dialog').hasAttribute('open'),true);assert.equal(f.q('[data-wa-work-status]').textContent,'');f.close();
});
test('mounted provider timeout preserves manual text and releases request controls',async t=>{
 let signal;const f=mounted({request:(_payload,options)=>{signal=options.signal;return new Promise(()=>{});}});f.controller.setDraft({subject:'My pending title',message:'My exact manual text'});const before=f.controller.state().working;
 t.mock.timers.enable({apis:['setTimeout']});const pending=f.controller.ask('Improve',{intent:'preview'});t.mock.timers.tick(60000);assert.equal(await pending,false);assert.equal(signal.aborted,true);assert.deepEqual(f.controller.state().working,before);assert.equal(f.controller.state().busy,false);assert.equal(f.q('[data-wa-edit-body]').disabled,false);assert.match(f.q('[data-wa-status]').textContent,/timed out|cancelled/i);t.mock.timers.reset();f.close();
});
