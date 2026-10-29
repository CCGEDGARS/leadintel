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
test('draft is directly editable without a separate Edit action or generation',()=>{
 const f=fixture();try{const body=f.d.querySelector('[data-wa-edit-body]');assert.equal(body.disabled,false);assert.equal(body.readOnly,false);body.focus();assert.equal(f.d.activeElement,body);assert.deepEqual(f.c.state().working,f.original);assert.equal(f.c.state().canUndo,false);assert.equal(f.requests,0);}finally{f.close();}
});
test('manual edits retain exact text through autosave and reopen while leaving the original and delivery separate',async()=>{
 const f=fixture();try{const draft={subject:'My exact subject',message:'My own text\n\nSecond paragraph — unchanged.'};for(const [selector,key]of [['[data-wa-edit-subject]','subject'],['[data-wa-edit-body]','message']]){const el=f.d.querySelector(selector);el.value=draft[key];el.dispatchEvent(new f.dom.window.Event('input',{bubbles:true}));}
 assert.deepEqual(f.c.state().working,draft);assert.deepEqual(f.c.state().original,f.original);assert.equal(f.requests,0);assert.equal(f.used,undefined);const reopened=f.make();reopened.syncContext();assert.deepEqual(reopened.state().working,draft);reopened.destroy();f.d.querySelector('[data-wa-continue]').click();await new Promise(r=>setImmediate(r));assert.deepEqual(f.used,draft);assert.equal(f.requests,0);
 }finally{f.close();}
});
test('direct editing follows busy/cancel state and works for an empty general-writing draft',async()=>{
 const f=fixture({general:true});try{f.d.querySelector('[data-wa-clear]').click();const body=f.d.querySelector('[data-wa-edit-body]');assert.equal(body.disabled,false);body.focus();assert.equal(f.d.activeElement,body);const pending=f.c.ask('Give advice',{intent:'advice'});assert.equal(body.disabled,true);f.c.cancel();assert.equal(body.disabled,false);f.release();await pending;}finally{f.close();}
});
test('changed context restores the selected customer draft without importing previous edits',()=>{
 const f=fixture();try{f.c.setDraft({subject:'Private A',message:'Private A text'});f.switchScope();f.c.syncContext();assert.deepEqual(f.c.state().working,f.original);assert.equal(f.d.querySelector('[data-wa-edit-body]').value,f.original.message);assert.equal(f.requests,0);}finally{f.close();}
});
