const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const S=require('../message-studio.js'),E=require('../message-editor.js'),O=require('../outreach-engine.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
const {mounted}=require('./helpers/message-runtime.js');
test('the assembled page retries selected NLP when the saved working draft is still Professional',()=>{
 const h=mounted();try{h.w.document.querySelector('[data-writing-style="curiosity"]').click();assert.equal(h.item().messageStudioDraft.mode,'curiosity');assert.match(h.q('outreach-email-body').value,/this is not another sales pitch/);assert.deepEqual(E.updateUndo(h.item()),h.before);assert.equal(E.savedDraft(h.item()),false);
 const snapshot=JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_outreach')),reopened=mounted({outreachSnapshot:snapshot});try{assert.equal(reopened.q('message-mode').value,'curiosity');assert.equal(reopened.q('outreach-email-body').value,h.q('outreach-email-body').value);reopened.q('mw-undo-rewrite').click();assert.deepEqual(E.workingDraft(reopened.item()),h.before);assert.equal(reopened.q('message-mode').value,'professional');}finally{reopened.w.close();}
 }finally{h.w.close();}
});
test('a style change aborts in-flight subject research and applies the new style without waiting for the old request',async()=>{
 const h=mounted({selected:'professional'});try{
 const pending=h.w.prepareSubjectEvidence({retry:true});assert.equal(h.requests.length,1);const old=h.requests[0];
 h.w.document.querySelector('[data-writing-style="curiosity"]').click();assert.equal(h.item().messageStudioDraft.mode,'curiosity');assert.equal(old.options.signal.aborted,true);assert.match(h.q('outreach-email-body').value,/this is not another sales pitch/);
 old.resolve({ok:true,json:async()=>({success:true,data:[]})});await pending;assert.equal(h.item().messageStudioDraft.mode,'curiosity');assert.deepEqual(E.updateUndo(h.item()),h.before);
 const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(h.item()),'buyer.example');assert.deepEqual(E.workingDraft(E.undoTemplateUpdate(restored)),h.before);
 }finally{h.w.close();}
});
test('failed field preparation releases the loading state and clicking selected NLP retries it',async()=>{
 const h=mounted();try{
 const key='leadintel_customer_v2_state',main=JSON.parse(h.w.localStorage.getItem(key));main.profile.priorityOffers='steel and installation '.repeat(8);h.w.localStorage.setItem(key,JSON.stringify(main));
 const choose=()=>h.w.document.querySelector('[data-writing-style="curiosity"]').click(),settle=()=>new Promise(resolve=>setImmediate(resolve));
 choose();assert.equal(h.requests.length,1);assert.equal(h.q('message-generate').textContent,'Updating…');
 h.requests[0].resolve({ok:false,json:async()=>({error:'Provider unavailable'})});await settle();assert.equal(h.item().messageStudioDraft.mode,'professional');assert.deepEqual(E.workingDraft(h.item()),h.before);assert.match(h.q('message-generation-status').textContent,/Provider unavailable/);assert.equal(h.q('message-generate').textContent,'Update message');
 choose();const request=h.requests.findLast(row=>row.url.includes('/api/ai/generate'));assert.notEqual(request,h.requests[0]);request.resolve({ok:true,json:async()=>({text:JSON.stringify({triggerSummary:'Buyer is investing in a new sorting plant at Northport.',offer:'steel and installation',value:'simplify project delivery',difference:'Our team supports industrial projects.',approach:'Project delivery to EN 1090 requirements',meetingValue:'relevant project lessons'})})});await settle();
 assert.equal(h.item().messageStudioDraft.mode,'curiosity');assert.match(h.q('outreach-email-body').value,/this is not another sales pitch/);assert.deepEqual(E.updateUndo(h.item()),h.before);assert.equal(h.q('message-generate').textContent,'Update message');
 }finally{h.w.close();}
});
test('clicking an already applied NLP style preserves an already applied manual NLP edit',()=>{
 const h=mounted();try{h.w.document.querySelector('[data-writing-style="curiosity"]').click();const next=E.apply(h.item(),{subject:'My chosen subject',message:'My exact NLP edit'},{style:'curiosity',origin:'manual'});h.w.upsertItem(next);h.w.renderAll();h.w.document.querySelector('[data-writing-style="curiosity"]').click();assert.equal(h.q('outreach-email-body').value,'My exact NLP edit');assert.equal(h.requests.filter(row=>row.url.includes('/api/ai/generate')).length,0);}finally{h.w.close();}
});
