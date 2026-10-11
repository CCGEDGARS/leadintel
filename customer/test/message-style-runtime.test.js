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
 h.requests[0].resolve({ok:false,json:async()=>({error:'Provider unavailable'})});await settle();assert.equal(h.item().messageStudioDraft.mode,'professional');assert.deepEqual(E.workingDraft(h.item()),h.before);assert.match(h.q('message-generation-status').textContent,/Provider unavailable/);assert.equal(h.q('message-generate').textContent,'Adjust message');
 choose();const request=h.requests.findLast(row=>row.url.includes('/api/ai/generate'));assert.notEqual(request,h.requests[0]);request.resolve({ok:true,json:async()=>({text:JSON.stringify({triggerSummary:'Buyer is investing in a new sorting plant at Northport.',offer:'steel and installation',value:'simplify project delivery',difference:'Our team supports industrial projects.',approach:'Project delivery to EN 1090 requirements',meetingValue:'relevant project lessons'})})});await settle();
 assert.equal(h.item().messageStudioDraft.mode,'curiosity');assert.match(h.q('outreach-email-body').value,/this is not another sales pitch/);assert.deepEqual(E.updateUndo(h.item()),h.before);assert.equal(h.q('message-generate').textContent,'Adjust message');
 }finally{h.w.close();}
});
test('clicking an already applied NLP style preserves an already applied manual NLP edit',()=>{
 const h=mounted();try{h.w.document.querySelector('[data-writing-style="curiosity"]').click();const next=E.apply(h.item(),{subject:'My chosen subject',message:'My exact NLP edit'},{style:'curiosity',origin:'manual'});h.w.upsertItem(next);h.w.renderAll();h.w.document.querySelector('[data-writing-style="curiosity"]').click();assert.equal(h.q('outreach-email-body').value,'My exact NLP edit');assert.equal(h.requests.filter(row=>row.url.includes('/api/ai/generate')).length,0);}finally{h.w.close();}
});
const preparedFacts={triggerSummary:'Buyer is investing in a new sorting plant at Northport.',offer:'steel and installation',value:'simplify project delivery',difference:'Our team supports industrial projects.',approach:'Project delivery to EN 1090 requirements',meetingValue:'relevant project lessons'};
function requirePreparation(h){const key='leadintel_customer_v2_state',main=JSON.parse(h.w.localStorage.getItem(key));main.profile.priorityOffers='steel and installation '.repeat(8);h.w.localStorage.setItem(key,JSON.stringify(main));}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
for(const style of ['professional','curiosity','friendly','brutal'])test(`writing-reference hydration and refresh cannot cancel ${style} field preparation`,async()=>{
 const h=mounted();try{
 if(style==='professional')h.w.document.querySelector('[data-writing-style="curiosity"]').click();const before=E.workingDraft(h.item());
 requirePreparation(h);h.w.document.querySelector(`[data-writing-style="${style}"]`).click();
 const request=h.requests.find(row=>row.url.includes('/api/ai/generate'));assert.ok(request);
 for(const referenceRevision of [1,2])h.w.dispatchEvent(new h.w.CustomEvent('leadintel:writing-references-changed',{detail:{workspaceId:'w1',referenceRevision}}));
 assert.equal(h.q('message-generate').textContent,'Updating…');assert.match(h.q('message-generation-status').textContent,/Preparing concise English fields/);
 request.resolve({ok:true,json:async()=>({text:JSON.stringify(style==='professional'?{...preparedFacts,value:'',difference:'',approach:'',meetingValue:''}:preparedFacts)})});await settle();
 assert.equal(h.item().messageStudioDraft.mode,style);assert.notDeepEqual(E.workingDraft(h.item()),before);assert.deepEqual(E.updateUndo(h.item()),before);
 const restored=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(h.item()),'buyer.example');assert.deepEqual(E.workingDraft(restored),E.workingDraft(h.item()));assert.deepEqual(E.workingDraft(E.undoTemplateUpdate(restored)),before);
 const reopened=mounted({outreachSnapshot:JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_outreach'))});try{assert.equal(reopened.q('message-mode').value,style);assert.equal(reopened.q('outreach-email-body').value,h.q('outreach-email-body').value);}finally{reopened.w.close();}
 }finally{h.w.close();}
});
test('a failed style application keeps its actual failure visible across background renders',async()=>{
 const h=mounted();try{requirePreparation(h);h.w.document.querySelector('[data-writing-style="curiosity"]').click();h.requests[0].resolve({ok:false,json:async()=>({error:'Provider unavailable'})});await settle();
 h.w.renderAll();assert.match(h.q('message-generation-status').textContent,/Provider unavailable/);assert.equal(h.q('message-generation-status').hidden,false);assert.match(h.q('mw-style-help').textContent,/NLP has not been applied/);assert.deepEqual(E.workingDraft(h.item()),h.before);
 for(let i=0;i<h.requests.length;i++){const request=h.requests[i];if(request.url.includes('/firecrawl/')){request.resolve({ok:true,json:async()=>({success:true,data:[]})});await settle();}}
 assert.match(h.q('message-generation-status').textContent,/Provider unavailable/);assert.equal(h.requests.filter(row=>row.url.includes('/api/ai/generate')).length,1);
 h.w.document.querySelector('[data-writing-style="curiosity"]').click();const retry=h.requests.findLast(row=>row.url.includes('/api/ai/generate'));retry.resolve({ok:true,json:async()=>({text:JSON.stringify(preparedFacts)})});await settle();h.w.renderAll();assert.equal(h.item().messageStudioDraft.mode,'curiosity');assert.doesNotMatch(h.q('message-generation-status').textContent,/Provider unavailable/);assert.equal(h.q('message-generation-status').hidden,true);
 }finally{h.w.close();}
});
test('changed source facts reject preparation with a visible retry explanation',async()=>{
 const h=mounted();try{requirePreparation(h);h.w.document.querySelector('[data-writing-style="curiosity"]').click();const key='leadintel_customer_v2_state',main=JSON.parse(h.w.localStorage.getItem(key));main.profile.valueProposition='simplify installation';h.w.localStorage.setItem(key,JSON.stringify(main));h.requests[0].resolve({ok:true,json:async()=>({text:JSON.stringify(preparedFacts)})});await settle();h.w.renderAll();
 assert.deepEqual(E.workingDraft(h.item()),h.before);assert.match(h.q('message-generation-status').textContent,/changed.*retry/i);assert.equal(h.q('message-generation-status').hidden,false);assert.equal(h.q('message-generate').textContent,'Adjust message');
 }finally{h.w.close();}
});
test('AI Generated still rejects a response prepared before writing references changed',async()=>{
 const h=mounted();try{h.w.document.querySelector('[data-writing-style="original"]').click();const run=h.w.generateStudioMessage();const request=h.requests.find(row=>row.url.includes('/api/ai/generate'));assert.ok(request);h.w.dispatchEvent(new h.w.CustomEvent('leadintel:writing-references-changed',{detail:{workspaceId:'w1',referenceRevision:2}}));request.resolve({ok:true,json:async()=>({text:JSON.stringify({subject:'Stale generation',message:'Old reference content'})})});await run;assert.deepEqual(E.workingDraft(h.item()),h.before);assert.equal(h.q('message-generate').textContent,'Adjust message');
 }finally{h.w.close();}
});
