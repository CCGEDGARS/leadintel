const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../message-editor.js'),O=require('../outreach-engine.js');
const {mounted}=require('./helpers/message-runtime.js');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('original editor retains Update, Edit and Save; the integrated assistant offers Shorten, Rewrite and Reset',()=>{
 const h=mounted({selected:'professional'});try{
 const panel=h.q('mw-writing-assistant');assert.ok(panel.closest('.mw-editor'));assert.equal(panel.querySelector('h3').textContent,'Writing Assistant');
 assert.deepEqual([...panel.querySelectorAll('button')].filter(b=>!b.hidden).map(b=>b.textContent),['Shorten','Rewrite','Reset']);
 assert.ok(h.q('message-generate').closest('.mw-header-actions'));assert.equal(h.q('message-generate').textContent,'Update message');
 for(const id of ['mw-edit-message','mw-save-message'])assert.ok(h.q(id).closest('.mw-editor-actions'));
 assert.equal(h.q('mw-message-length'),null);
 }finally{h.w.close();}
});
for(const [button,action] of [['mw-shorten-message','shorten'],['mw-rewrite-message','improve']])test(`${action} adjusts the displayed draft, preserves subject and protected original, and keeps Undo through CRM reopen`,async()=>{
 const h=mounted({selected:'professional'});try{
 const masters=JSON.stringify(require('../approved-reference-scripts.js').records),original=h.item().messageStudioDraft.tailoredOriginal;
 const before={subject:'My reviewed subject',message:h.before.message+'\n\nMy reviewed working wording.'};
 h.w.upsertItem(E.apply(h.item(),before,{origin:'manual',style:'professional'}));h.w.renderAll();h.q(button).click();
 const request=h.requests.find(r=>r.url.includes('/api/ai/generate'));assert.ok(request);const payload=JSON.parse(request.options.body),prompt=JSON.parse(payload.prompt);
 assert.equal(payload.editor_action,action);assert.deepEqual(prompt.source,before);
 const message='Hi Alex,\n\nRobin Lane from North Works offers steel and installation for Buyer. Would a 20-minute Zoom call help compare your project requirements?\n\nhttps://calendly.com/north/intro';
 request.resolve({ok:true,json:async()=>({text:JSON.stringify({subject:'Unwanted AI subject',message})})});await settle();
 assert.deepEqual(E.workingDraft(h.item()),{subject:before.subject,message});assert.equal(h.item().approved,false);assert.equal(E.savedDraft(h.item()),false);
 assert.deepEqual(h.item().messageStudioDraft.tailoredOriginal,original);assert.equal(JSON.stringify(require('../approved-reference-scripts.js').records),masters);
 const snapshot=O.buildCrmScriptSnapshot(h.item()),restored=O.restoreCrmScriptSnapshot(snapshot,'buyer.example');assert.deepEqual(E.workingDraft(E.undoTemplateUpdate(restored)),before);
 h.q('mw-undo-rewrite').click();assert.deepEqual(E.workingDraft(h.item()),before);
 }finally{h.w.close();}
});
test('repeated variations request fresh wording and reject a duplicate response',async()=>{
 const h=mounted({selected:'professional'});try{
 const message='Hi Alex, Robin Lane from North Works would like to discuss Buyer’s project on a 20-minute Zoom call: https://calendly.com/north/intro';
 h.q('mw-rewrite-message').click();h.requests.find(r=>r.url.includes('/api/ai/generate')).resolve({ok:true,json:async()=>({text:JSON.stringify({message})})});await settle();
 h.q('mw-rewrite-message').click();const second=h.requests.findLast(r=>r.url.includes('/api/ai/generate')),prompt=JSON.parse(JSON.parse(second.options.body).prompt);assert.ok(prompt.avoid.includes(message));
 second.resolve({ok:true,json:async()=>({text:JSON.stringify({message})})});await settle();assert.equal(h.q('outreach-email-body').value,message);assert.match(h.q('mw-editor-status').textContent,/repeated/i);assert.equal(h.q('mw-rewrite-message').disabled,false);
 }finally{h.w.close();}
});
test('Shorten rejects an unchanged or longer result and preserves the current body',async()=>{
 const h=mounted({selected:'professional'});try{h.q('mw-shorten-message').click();h.requests.find(r=>r.url.includes('/api/ai/generate')).resolve({ok:true,json:async()=>({text:JSON.stringify(h.before)})});await settle();assert.deepEqual(E.workingDraft(h.item()),h.before);assert.match(h.q('mw-editor-status').textContent,/not shorter/);assert.equal(h.q('mw-shorten-message').disabled,false);}finally{h.w.close();}
});
test('a response after the adjustment deadline preserves the draft and releases both controls',async()=>{
 const h=mounted({selected:'professional'});try{let expire;const timer=h.w.setTimeout;h.w.setTimeout=(fn,ms,...args)=>ms===45000?(expire=fn,123):timer(fn,ms,...args);
 h.q('mw-shorten-message').click();const request=h.requests.find(r=>r.url.includes('/api/ai/generate'));assert.ok(expire);expire();assert.equal(request.options.signal.aborted,true);
 request.resolve({ok:true,json:async()=>({text:JSON.stringify({message:'Late response'})})});await settle();assert.deepEqual(E.workingDraft(h.item()),h.before);assert.match(h.q('mw-editor-status').textContent,/timed out/);for(const id of ['mw-shorten-message','mw-rewrite-message'])assert.equal(h.q(id).disabled,false);
 }finally{h.w.close();}
});
test('changed source facts reject a stale variation without leaving a spinner',async()=>{
 const h=mounted({selected:'professional'});try{h.q('mw-rewrite-message').click();const request=h.requests.find(r=>r.url.includes('/api/ai/generate'));
 const main=JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_state'));main.profile.priorityOffers='painting';h.w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
 request.resolve({ok:true,json:async()=>({text:JSON.stringify({message:'Robin Lane proposes a 20-minute Zoom call: https://calendly.com/north/intro'})})});await settle();assert.deepEqual(E.workingDraft(h.item()),h.before);assert.equal(h.q('mw-updating-notice').hidden,true);for(const id of ['mw-shorten-message','mw-rewrite-message'])assert.equal(h.q(id).disabled,false);
 }finally{h.w.close();}
});
