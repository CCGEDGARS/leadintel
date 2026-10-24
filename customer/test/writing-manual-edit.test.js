const test=require('node:test'),assert=require('node:assert/strict'),{JSDOM}=require('jsdom');
const {createWritingAssistant}=require('../writing-assistant.js');
const {mountWritingAssistant}=require('../writing-assistant-ui.js');
function fixture({general=false}={}){
 const dom=new JSDOM('<section id="mw-writing-assistant"></section>',{pretendToBeVisual:true}),d=dom.window.document,records=new Map();
 let scope='workspace:buyer',ui,requests=0,used,release;
 const original={subject:'Original subject',message:'Original\n\nmessage'};
 const capture=()=>({scope,fingerprint:scope,usable:true,referenceRevision:1,sourceRefs:[],context:{writingContext:general?'general':'customer',channel:general?'general':'email',style:'friendly',currentDraft:original}});
 const store={load:key=>records.get(key),save:(key,value)=>{records.set(key,structuredClone(value));return true;}};
 const make=()=>createWritingAssistant({workbench:true,capture,sessionStore:store,onChange:()=>ui?.render(),request:()=>{requests++;return new Promise(resolve=>release=resolve);}});
 const c=make();c.syncContext();ui=mountWritingAssistant(d,c,{writingContext:()=>general?'general':'customer',channel:()=>general?'general':'email',useDraft:draft=>{used=structuredClone(draft);}});ui.open();
 return {dom,d,c,ui,make,original,records,get used(){return used;},get requests(){return requests;},switchScope(){scope='other:buyer';},release:()=>release?.({reply:'Advice',draft:null,provenance:{referenceRevision:1}}),close(){ui.destroy();c.destroy();dom.window.close();}};
}
test('Edit is the first draft toolbar action and focuses the existing message without generating or changing text',()=>{
 const f=fixture();try{const button=f.d.querySelector('.wa-editor-heading [data-wa-edit]');assert.ok(button,'manual editing needs a visible top action');assert.equal(button.textContent,'Edit');assert.equal(button.parentElement.firstElementChild,button);const body=f.d.querySelector('[data-wa-edit-body]');button.click();assert.equal(f.d.activeElement,body);assert.equal(button.getAttribute('aria-controls'),body.id);assert.deepEqual(f.c.state().working,f.original);assert.equal(f.c.state().canUndo,false);assert.equal(f.requests,0);assert.match(f.d.querySelector('[data-wa-work-status]').textContent,/Edit the subject or message directly/);}finally{f.close();}
});
test('manual edits retain exact text through autosave and reopen while leaving the original and delivery separate',async()=>{
 const f=fixture();try{f.d.querySelector('[data-wa-edit]').click();const draft={subject:'My exact subject',message:'My own text\n\nSecond paragraph — unchanged.'};for(const [selector,key]of [['[data-wa-edit-subject]','subject'],['[data-wa-edit-body]','message']]){const el=f.d.querySelector(selector);el.value=draft[key];el.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));}
 assert.deepEqual(f.c.state().working,draft);assert.deepEqual(f.c.state().original,f.original);assert.equal(f.requests,0);assert.equal(f.used,undefined);const reopened=f.make();reopened.syncContext();assert.deepEqual(reopened.state().working,draft);reopened.destroy();f.d.querySelector('[data-wa-use-flow]').click();await new Promise(r=>setImmediate(r));assert.deepEqual(f.used,draft);assert.equal(f.requests,0);
 }finally{f.close();}
});
test('Edit follows busy/cancel state and remains available for an empty general-writing draft',async()=>{
 const f=fixture({general:true});try{f.d.querySelector('[data-wa-clear]').click();const edit=f.d.querySelector('[data-wa-edit]');assert.ok(edit);assert.equal(edit.disabled,false);edit.click();assert.equal(f.d.activeElement,f.d.querySelector('[data-wa-edit-body]'));const pending=f.c.ask('Give advice',{intent:'advice'});assert.equal(edit.disabled,true);f.c.cancel();assert.equal(edit.disabled,false);f.release();await pending;}finally{f.close();}
});
test('Edit refreshes changed context before focusing and never imports the previous customer draft',()=>{
 const f=fixture();try{f.c.setDraft({subject:'Private A',message:'Private A text'});f.switchScope();f.d.querySelector('[data-wa-edit]').click();assert.deepEqual(f.c.state().working,f.original);assert.equal(f.d.querySelector('[data-wa-edit-body]').value,f.original.message);assert.equal(f.requests,0);}finally{f.close();}
});
