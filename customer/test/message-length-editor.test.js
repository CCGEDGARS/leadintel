const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../message-editor.js'),S=require('../message-studio.js'),O=require('../outreach-engine.js');
const {mounted}=require('./helpers/message-runtime.js');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function addProof(h){const key='leadintel_customer_v2_state',main=JSON.parse(h.w.localStorage.getItem(key));main.profile.proofPoints='https://north.example/projects';h.w.localStorage.setItem(key,JSON.stringify(main));}
test('the editor contains one adjustment action and three lengths, replacing visible legacy assistance',()=>{
 const h=mounted({selected:'professional'});try{
 const panel=h.q('mw-writing-assistant');assert.ok(panel.closest('.mw-editor'));
 assert.equal(h.q('message-generate').closest('#mw-writing-assistant'),panel);assert.equal(h.q('message-generate').textContent,'Adjust message');
 assert.deepEqual([...h.q('mw-message-length').options].map(o=>o.value),['original','short','very-short']);
 for(const id of ['mw-rewrite-message','mw-shorten-message','mw-improve-subject'])assert.equal(h.q(id).hidden,true);
 assert.ok(h.q('mw-undo-rewrite').closest('.mw-editor'));assert.ok(h.q('mw-save-message').closest('.mw-editor'));
 }finally{h.w.close();}
});
test('length planning derives targets from the full personalized source and rejects invalid presets',()=>{
 const source={subject:'A subject',message:Array(200).fill('word').join(' ')};
 assert.equal(E.lengthPlan(source,'short').maximumWords,150);assert.equal(E.lengthPlan(source,'very-short').maximumWords,100);
 assert.throws(()=>E.lengthPlan(source,'random'),/length/i);
});
test('length validation preserves identity, links, quantities and subject while rejecting oversize or fabricated responses',()=>{
 const source={subject:'Northport project',message:'Hi Alex,\n\nRobin Lane from North Works offers installation for Buyer. A 20-minute Zoom call: https://calendly.com/north/intro\n\n'+Array(120).fill('details').join(' ')};
 const result={subject:source.subject,message:source.message.replace(/details(?: details)*/,Array(20).fill('details').join(' '))};
 const studio=S.normalize({mode:'professional',essentials:{sender:'Robin Lane',company:'North Works'}}),context={firstName:'Alex',buyerCompany:'Buyer',channel:'email'};
 assert.deepEqual(E.validateAdjustment(result,source,'short',studio,context),result);
 for(const message of [source.message,result.message.replace('20-minute','30-minute'),result.message.replace('Robin Lane','Another sender'),result.message.replace('Buyer','Other Company'),result.message.replace('https://calendly.com/north/intro','https://other.example'),result.message+' Guaranteed 40% savings.'])assert.throws(()=>E.validateAdjustment({subject:source.subject,message},source,'short',studio,context));
 assert.throws(()=>E.validateAdjustment({...result,subject:'Changed subject'},source,'short',studio,context));
});
for(const length of ['short','very-short'])test(`${length} uses a fresh template source, preserves working subject, persists Undo and does not shorten the previous edit`,async()=>{
 const h=mounted({selected:'professional'});try{
 addProof(h);const original=JSON.stringify(require('../approved-reference-scripts.js').records),subject='My reviewed subject';
 h.w.upsertItem(E.apply(h.item(),{subject,message:'My manually changed draft Robin Lane'},{origin:'manual',style:'professional'}));h.w.renderAll();const before=E.workingDraft(h.item());
 h.q('mw-message-length').value=length;h.q('mw-message-length').dispatchEvent(new h.w.Event('change'));h.q('message-generate').click();
 const request=h.requests.find(r=>r.url.includes('/api/ai/generate'));assert.ok(request);const prompt=JSON.parse(JSON.parse(request.options.body).prompt);
 assert.match(prompt.source.message,/Hi Alex/);assert.doesNotMatch(prompt.source.message,/My manually changed draft/);assert.equal(prompt.source.subject,subject);assert.equal(prompt.length,length);
 const body='Hi Alex,\n\nRobin Lane from North Works offers steel and installation for Buyer’s project in Northport. Would you be open to a 20-minute Zoom call to compare requirements?\n\nhttps://north.example/projects\n\nhttps://calendly.com/north/intro';
 request.resolve({ok:true,json:async()=>({text:JSON.stringify({subject,message:body})})});await settle();
 assert.equal(h.q('outreach-email-body').value,body);assert.equal(h.item().approved,false);assert.equal(E.savedDraft(h.item()),false);assert.deepEqual(E.updateUndo(h.item()),before);assert.equal(h.item().messageStudioDraft.messageLength,length);
 const snapshot=O.buildCrmScriptSnapshot(h.item()),restored=O.restoreCrmScriptSnapshot(snapshot,'buyer.example');assert.equal(restored.messageStudioDraft.messageLength,length);assert.deepEqual(E.workingDraft(E.undoTemplateUpdate(restored)),before);
 h.q('message-generate').click();const second=h.requests.findLast(r=>r.url.includes('/api/ai/generate'));assert.equal(JSON.parse(JSON.parse(second.options.body).prompt).source.message,prompt.source.message);
 second.resolve({ok:false,json:async()=>({error:'Provider unavailable'})});await settle();assert.equal(h.q('outreach-email-body').value,body);assert.match(h.q('mw-editor-status').textContent,/Provider unavailable/);
 assert.equal(JSON.stringify(require('../approved-reference-scripts.js').records),original);
 }finally{h.w.close();}
});
test('adjustment rejects a late reply after source facts change and preserves the draft',async()=>{
 const h=mounted({selected:'professional'});try{
 addProof(h);h.q('mw-message-length').value='short';h.q('mw-message-length').dispatchEvent(new h.w.Event('change'));h.q('message-generate').click();const request=h.requests.find(r=>r.url.includes('/api/ai/generate'));assert.ok(request);
 const main=JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_state'));main.profile.priorityOffers='painting';h.w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));
 request.resolve({ok:true,json:async()=>({text:JSON.stringify({subject:h.before.subject,message:'Hi Alex, Robin Lane from North Works offers steel and installation for Buyer. A 20-minute Zoom call: https://north.example/projects https://calendly.com/north/intro'})})});await settle();assert.deepEqual(E.workingDraft(h.item()),h.before);assert.equal(h.q('message-generate').disabled,false);
 }finally{h.w.close();}
});
test('Original length restores the source template after a shorter manual alternative and offers Undo',()=>{
 const h=mounted({selected:'professional'});try{
 const before={subject:'My reviewed subject',message:'Hi Alex, my brief manual alternative. Robin Lane'};h.w.upsertItem(E.apply(h.item(),before,{origin:'manual',style:'professional'}));h.w.renderAll();h.q('mw-message-length').value='original';h.q('message-generate').click();assert.match(h.q('outreach-email-body').value,/Keeping a project of that scale/);assert.equal(h.requests.filter(r=>r.url.includes('/api/ai/generate')).length,0);assert.equal(h.w.undoMessageTemplateUpdate(),true);assert.deepEqual(E.workingDraft(h.item()),before);
 }finally{h.w.close();}
});
test('missing template facts explain why shortening is blocked without spending AI credits',async()=>{
 const h=mounted({selected:'professional'});try{h.q('mw-message-length').value='short';h.q('mw-message-length').dispatchEvent(new h.w.Event('change'));h.q('message-generate').click();await settle();assert.match(h.q('mw-editor-status').textContent,/missing facts/);assert.deepEqual(E.workingDraft(h.item()),h.before);assert.equal(h.requests.filter(r=>r.url.includes('/api/ai/generate')).length,0);assert.equal(h.q('message-generate').disabled,false);}finally{h.w.close();}
});
test('AI refusal and invalid length preserve the exact working draft and allow retry',async()=>{
 const h=mounted({selected:'professional'});try{addProof(h);h.q('mw-message-length').value='very-short';h.q('mw-message-length').dispatchEvent(new h.w.Event('change'));h.q('message-generate').click();const r=h.requests.find(r=>r.url.includes('/api/ai/generate'));r.resolve({ok:true,json:async()=>({text:JSON.stringify({error:'Essential content cannot fit this length. Choose a longer version.'})})});await settle();assert.deepEqual(E.workingDraft(h.item()),h.before);assert.match(h.q('mw-editor-status').textContent,/Choose a longer version/);assert.equal(h.q('message-generate').disabled,false);assert.equal(h.q('mw-message-length').disabled,false);}finally{h.w.close();}
});
for(const style of ['curiosity','friendly','brutal'])test(`${style} adjustment considers current evidence and keeps required links and disclosure`,async()=>{
 const h=mounted({selected:style});try{addProof(h);h.w.document.querySelector(`[data-writing-style="${style}"]`).click();for(let i=0;i<h.requests.length;i++){const r=h.requests[i];if(r.url.includes('/firecrawl/')){r.resolve({ok:true,json:async()=>({success:true,data:[]})});await settle();}}h.q('mw-message-length').value='short';h.q('mw-message-length').dispatchEvent(new h.w.Event('change'));h.q('message-generate').click();const request=h.requests.find(r=>r.url.includes('/api/ai/generate'));assert.ok(request);const p=JSON.parse(JSON.parse(request.options.body).prompt);assert.equal(p.style,style);assert.match(p.source.message,/Northport/);assert.match(p.source.message,/steel and installation/);
 const urls=[...new Set(p.source.message.match(/https?:\/\/[^\s<>"\])]+/g)||[])].map(u=>u.replace(/[.,;!?]+$/,''));const message='Hi Alex,\n\n'+(style==='brutal'?'I’m LeadIntel, an AI-powered system writing on behalf of Robin Lane. ':'I’m Robin Lane. ')+'North Works offers steel and installation for Buyer’s Northport project. If relevant, would you be open to a 20-minute Zoom call to compare your requirements and our approach?\n\n'+urls.join('\n');request.resolve({ok:true,json:async()=>({text:JSON.stringify({subject:p.source.subject,message})})});await settle();assert.equal(h.q('outreach-email-body').value,message);assert.equal(h.item().messageStudioDraft.mode,style);assert.equal(h.q('message-generate').disabled,false);h.q('mw-undo-rewrite').click();assert.notEqual(h.q('outreach-email-body').value,message);
 }finally{h.w.close();}
});
test('an adjustment timeout cannot apply a response that arrives after its deadline',async()=>{
 const h=mounted({selected:'professional'});try{addProof(h);let expire;const originalTimer=h.w.setTimeout;h.w.setTimeout=(fn,ms,...args)=>ms===45000?(expire=fn,123):originalTimer(fn,ms,...args);h.q('mw-message-length').value='short';h.q('mw-message-length').dispatchEvent(new h.w.Event('change'));h.q('message-generate').click();const r=h.requests.find(r=>r.url.includes('/api/ai/generate'));assert.ok(expire);expire();assert.equal(r.options.signal.aborted,true);r.resolve({ok:true,json:async()=>({text:JSON.stringify({subject:h.before.subject,message:'Hi Alex, Robin Lane from North Works offers steel and installation for Buyer’s Northport project. A 20-minute Zoom call: https://north.example/projects https://calendly.com/north/intro'})})});await settle();assert.deepEqual(E.workingDraft(h.item()),h.before);assert.match(h.q('mw-editor-status').textContent,/timed out|cancelled/);assert.equal(h.q('message-generate').disabled,false);
 }finally{h.w.close();}
});
test('AI Generated adjusts a fresh full source from current facts rather than the displayed old body',async()=>{
 const h=mounted({selected:'original'});try{addProof(h);h.q('mw-message-length').value='short';h.q('mw-message-length').dispatchEvent(new h.w.Event('change'));h.q('message-generate').click();const first=h.requests.find(r=>r.url.includes('/api/ai/generate'));assert.ok(first);assert.doesNotMatch(JSON.parse(first.options.body).prompt,/My manually changed draft/);
 const source='Hi Alex, Robin Lane from North Works offers steel and installation for Buyer’s project in Northport. Would you be open to a 20-minute Zoom call? https://north.example/projects https://calendly.com/north/intro\n\n'+Array(90).fill('Supported context.').join(' ');
 first.resolve({ok:true,json:async()=>({text:JSON.stringify({subject:'Project conversation',subjectOptions:['Project conversation','Discuss your project','A relevant introduction','Northport opportunity','Compare requirements'],message:source})})});await settle();const second=h.requests.findLast(r=>r.url.includes('/api/ai/generate'));assert.notEqual(second,first);assert.equal(JSON.parse(JSON.parse(second.options.body).prompt).source.message,source);
 const message=source.split('\n\n')[0];second.resolve({ok:true,json:async()=>({text:JSON.stringify({subject:h.before.subject,message})})});await settle();assert.equal(h.q('outreach-email-body').value,message);assert.equal(h.item().messageStudioDraft.mode,'original');assert.deepEqual(E.updateUndo(h.item()),h.before);
 }finally{h.w.close();}
});
