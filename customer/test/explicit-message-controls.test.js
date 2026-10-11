const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../message-editor.js'),S=require('../message-studio.js'),A=require('../approved-reference-scripts.js'),O=require('../outreach-engine.js');
const {mounted}=require('./helpers/message-runtime.js');
const settle=()=>new Promise(r=>setImmediate(r));
const click=(h,style)=>h.w.document.querySelector(`[data-writing-style="${style}"]`).click();
const visibleButtons=host=>[...host.querySelectorAll('button')].filter(b=>!b.hidden).map(b=>b.textContent);
test('header owns green Update and Add to flow with the exact helper; lower actions have no Undo',()=>{
 const h=mounted({selected:'professional'});try{
 assert.deepEqual(visibleButtons(h.q('mw-header-actions')),['Update message','Add to flow']);assert.ok(h.q('message-generate').classList.contains('primary-btn'));
 assert.equal(h.q('mw-update-help').textContent,'Choose the style and update your message.');
 assert.equal(h.q('mw-update-help').parentElement,h.q('mw-header-actions'));assert.equal(h.q('message-generate').getAttribute('aria-describedby'),'mw-update-help');
 assert.deepEqual(visibleButtons(h.w.document.querySelector('.mw-editor-actions')),['Edit','Save','Reset','Add to templates','Set as default']);assert.equal(h.q('mw-undo-rewrite').hidden,true);
 }finally{h.w.close();}
});
test('opening a new message leaves subject and body empty; only a deliberate style click fills them',()=>{
 const h=mounted({selected:'professional'});try{
 const item=h.item();item.drafts.emailBody='';item.drafts.emailSubject='';delete item.messageStudioDraft;h.w.upsertItem(item);h.w.renderAll();h.w.prepareMessageOnOpen();
 assert.deepEqual(E.workingDraft(h.item()),{subject:'',message:''});assert.equal(h.q('outreach-email-body').value,'');assert.equal(h.q('mw-empty').hidden,false);assert.equal(h.requests.filter(r=>r.url.includes('/api/ai/generate')).length,0);
 click(h,'professional');assert.ok(h.q('outreach-email-body').value);assert.equal(h.q('mw-empty').hidden,true);
 }finally{h.w.close();}
});
for(const style of ['professional','curiosity','friendly','brutal'])test(`every ${style} click restores its approved body, including after editing and CRM reopen`,()=>{
 const h=mounted({selected:style});try{
 const master=A.originalText(style);click(h,style);const first=E.workingDraft(h.item());assert.equal(h.item().messageStudioDraft.mode,style);assert.match(first.message,/Northport/);
 E.validateCoreDraft(S.normalize(h.w.studioState()),h.w.studioMessageContext(),first);
 h.w.upsertItem(E.apply(h.item(),{subject:first.subject,message:'My manually edited '+style+' draft'},{style,origin:'manual'}));h.w.renderAll();click(h,style);
 assert.deepEqual(E.workingDraft(h.item()),first);assert.equal(E.savedDraft(h.item()),false);assert.equal(A.originalText(style),master);
 const snapshot=O.buildCrmScriptSnapshot(h.item()),restored=O.restoreCrmScriptSnapshot(snapshot,'buyer.example');assert.deepEqual(E.workingDraft(restored),first);
 h.q('mw-restore-original').click();assert.deepEqual(E.workingDraft(h.item()),first);
 }finally{h.w.close();}
});
test('reference-style clicks use the protected reference even when a saved personal revision was active',()=>{
 const h=mounted({selected:'professional'});try{
 let studio=S.savePersonalStyle(h.w.studioState(),'professional',{subject:'My revision',body:'My custom body for {{firstName}} from {{sender}}.'});h.w.persistStudio(studio);h.w.renderAll();assert.equal(h.q('mw-use-my-style').checked,true);
 click(h,'professional');assert.match(h.q('outreach-email-body').value,/Keeping a project of that scale/);assert.equal(h.w.studioState().personalStyles.professional.active,false);assert.equal(h.w.studioState().personalStyles.professional.body,studio.personalStyles.professional.body);
 }finally{h.w.close();}
});
test('AI Generated creates a fresh draft on each click and clears the old saved marker',async()=>{
 const h=mounted({selected:'original'});try{
 const source='Hi Alex,\n\nI’m Robin Lane from North Works. We provide steel and installation for industrial teams. I noticed Buyer’s new sorting plant at Northport. If relevant, would you be open to a 20-minute Zoom conversation to compare your project requirements and discuss our approach? I can bring relevant project lessons and hear what matters to your team.\n\nChoose a suitable time: https://calendly.com/north/intro\n\nBest regards,\nRobin Lane';
 const respond=async(message)=>{const request=h.requests.findLast(r=>r.url.includes('/api/ai/generate'));assert.ok(request);request.resolve({ok:true,json:async()=>({text:JSON.stringify({subject:'Northport project discussion',message,subjectOptions:['Northport project discussion','A relevant introduction','Compare project requirements','Discuss your sorting plant','North Works and Buyer']})})});await settle();};
 click(h,'original');await respond(source);assert.equal(h.q('outreach-email-body').value,source);assert.equal(h.item().messageStudioDraft.mode,'original');assert.equal(E.savedDraft(h.item()),false);
 click(h,'original');await respond(source.replace('I noticed','Your update highlighted'));assert.match(h.q('outreach-email-body').value,/Your update highlighted/);assert.equal(h.requests.filter(r=>r.url.includes('/api/ai/generate')).length,2);
 }finally{h.w.close();}
});
test('a blocked style click cannot change the selected style or pretend a different email was applied',()=>{
 const h=mounted({selected:'professional'});try{
 h.w.LeadIntelServerBridge.conflict=true;h.w.renderAll();const before=E.workingDraft(h.item());click(h,'friendly');assert.equal(h.q('message-mode').value,'professional');assert.deepEqual(E.workingDraft(h.item()),before);
 assert.equal(h.q('mw-resolve').textContent,'Resolve');assert.match(h.q('mw-readiness-text').textContent,/two versions/i);assert.doesNotMatch(h.q('mw-readiness').textContent,/Review sync choices|workspace sync conflict/i);
 }finally{h.w.close();}
});

const aiDraft={subject:'Discuss Northport',message:'Hi Alex,\n\nI’m Robin Lane from North Works. We provide steel and installation for industrial teams. I noticed Buyer’s new sorting plant at Northport. If relevant, would you be open to a 20-minute Zoom conversation to compare your project requirements and discuss our approach? I can bring relevant project lessons and hear what matters to your team.\n\nChoose a suitable time: https://calendly.com/north/intro\n\nBest regards,\nRobin Lane',subjectOptions:['Discuss Northport','A relevant introduction','Compare project requirements','Discuss your sorting plant','North Works and Buyer']};
test('AI failure preserves the working message and stays visible after rendering',async()=>{
 const h=mounted({selected:'professional'});try{const before=E.workingDraft(h.item());click(h,'original');const request=h.requests.find(r=>r.url.includes('/api/ai/generate'));request.resolve({ok:false,json:async()=>({error:'Provider unavailable'})});await settle();h.w.renderAll();assert.deepEqual(E.workingDraft(h.item()),before);assert.equal(h.q('message-generation-status').hidden,false);assert.match(h.q('message-generation-status').textContent,/Draft unchanged.*Provider unavailable/);assert.equal(h.q('message-generate').disabled,false);}finally{h.w.close();}
});
for(const change of ['style','body','facts','sync'])test(`late AI result cannot replace a newer ${change} change`,async()=>{
 const h=mounted({selected:'professional'});try{click(h,'original');const request=h.requests.find(r=>r.url.includes('/api/ai/generate'));
 if(change==='style'){click(h,'friendly');assert.equal(request.options.signal.aborted,true);}
 if(change==='body'){h.w.upsertItem(E.apply(h.item(),{subject:'My subject',message:'My new edit'},{origin:'manual'}));h.w.renderAll();}
 if(change==='facts'){const key='leadintel_customer_v2_state',main=JSON.parse(h.w.localStorage.getItem(key));main.profile.valueProposition='simplify installation';h.w.localStorage.setItem(key,JSON.stringify(main));}
 if(change==='sync'){h.w.LeadIntelServerBridge.conflict=true;h.w.renderAll();}
 const before=E.workingDraft(h.item());request.resolve({ok:true,json:async()=>({text:JSON.stringify(aiDraft)})});await settle();assert.deepEqual(E.workingDraft(h.item()),before);assert.equal(h.q('message-generate').textContent,'Update message');if(change==='style')assert.equal(h.item().messageStudioDraft.mode,'friendly');
 }finally{h.w.close();}
});
test('a saved draft reopens exactly; a newly confirmed recipient starts with an empty draft',()=>{
 const h=mounted({selected:'professional'});try{click(h,'friendly');const saved=h.item();saved.messageStudioDraft.scriptSavedAt='today';saved.messageStudioDraft.savedDraft=E.workingDraft(saved);h.w.upsertItem(saved);const before=E.workingDraft(saved),snapshot=JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_outreach'));const reopened=mounted({outreachSnapshot:snapshot});try{reopened.w.prepareMessageOnOpen();assert.deepEqual(E.workingDraft(reopened.item()),before);assert.equal(E.savedDraft(reopened.item()),true);}finally{reopened.w.close();}
 h.w.eval("handoffContact={domain:'buyer.example',personId:'new-person',channel:'email',contact:{work_email:'new@buyer.example'}}");h.w.prepareStudioBuyer({domain:'buyer.example',company:'Buyer',people:[]},{id:'new-person',name:'New Buyer'});assert.deepEqual(E.workingDraft(h.item()),{subject:'',message:''});assert.equal(h.item().selectedPersonId,'new-person');assert.equal(h.q('mw-empty').hidden,false);
 }finally{h.w.close();}
});
