const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{JSDOM}=require('jsdom');
const S=require('../message-studio.js'),E=require('../message-editor.js'),O=require('../outreach-engine.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function mounted({selected='curiosity',outreachSnapshot=null}={}){
 const w=new JSDOM(read('index.html'),{url:'https://example.test/customer/',runScripts:'outside-only'}).window;
 const essentials={sender:'Robin Lane',company:'North Works',offer:'steel and installation',target:'industrial teams',problem:'supplier handoffs',value:'simplify project delivery',difference:'Our team supports industrial projects.',approach:'Project delivery to EN 1090 requirements',meetingValue:'relevant project lessons',calendly:'https://calendly.com/north/intro',nextAction:'Choose a suitable time here: {{calendly}}'};
 const main={step:1,website:'https://north.example',brandIdentity:{senderName:essentials.sender,companyDisplayName:essentials.company},profile:{companyName:essentials.company,priorityOffers:essentials.offer,idealCustomer:essentials.target,customerProblem:essentials.problem,valueProposition:essentials.value,differentiation:essentials.difference,deliveryApproach:essentials.approach,meetingValue:essentials.meetingValue}};
 const person={id:'p1',name:'Alex Buyer',title:'Operations Director',kept:true,email:'alex@buyer.example'},candidate={domain:'buyer.example',website:'https://buyer.example',company:'Buyer',people:[person]},trigger={url:'https://buyer.example/news',companyDomain:candidate.domain,excerpt:'Buyer is investing in a new sorting plant at Northport.',verification:'source_verified'};
 const studio=S.foundation(S.normalize({mode:'professional',essentials}),main),context={channel:'email',buyerName:person.name,firstName:'Alex',buyerCompany:candidate.company,buyerRole:person.title,trigger};
 let item=E.apply({domain:candidate.domain,company:candidate.company,selectedPersonId:person.id,channel:'email',drafts:{},dossier:{domain:candidate.domain,company:candidate.company,people:[person],evidence:[{url:trigger.url,text:trigger.excerpt}],selectedTrigger:trigger}},E.tailor(studio,context),{original:true,key:'first',style:'professional',essentials:studio.essentials,origin:'tailored'});
 item.messageStudioDraft.scriptSavedAt='today';item.messageStudioDraft.savedDraft=E.workingDraft(item);studio.mode=selected;
 w.localStorage.setItem('leadintel_customer_v2_state',JSON.stringify(main));w.localStorage.setItem('leadintel_customer_v2_discovery',JSON.stringify({pipeline:[candidate]}));w.localStorage.setItem('leadintel_customer_v2_discovery_meta',JSON.stringify({scriptBuyer:{workspaceId:'w1',domain:candidate.domain,personId:person.id,channel:'email'}}));w.localStorage.setItem('leadintel_customer_v2_outreach',JSON.stringify(outreachSnapshot||{selectedDomain:candidate.domain,items:[item],messageStudio:S.storageState(studio)}));
 Object.assign(w,{LeadIntelMessageStudio:S,LeadIntelMessageEditor:E,LeadIntelOutreach:O,LeadIntelDiscovery:require('../discovery-engine.js'),LeadIntelMessageFacts:require('../message-facts.js'),LeadIntelMessageTranslations:require('../message-translations.js'),LeadIntelMessageEvidence:require('../message-evidence.js'),LeadIntelTriggerPreview:require('../trigger-preview.js'),LeadIntelContentLanguage:{workspaceContentLanguage:()=> 'en'},LeadIntelServerBridge:{ready:true,session:{authenticated:true,user:{name:essentials.sender}},workspace:{id:'w1'}}});
 w.eval(read('message-workspace.js'));w.eval(read('message-translation-ui.js'));w.eval(read('sender-identity-location.js'));
 const requests=[];w.fetch=(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}));
 w.eval(read('outreach-ui.js').replace(/^import .*;\s*$/gm,'')+"\nhandoffContact={domain:'buyer.example',personId:'p1',channel:'email',contact:{work_email:'alex@buyer.example'}};renderAll();");
 return {w,q:id=>w.document.getElementById(id),requests,item:()=>JSON.parse(w.localStorage.getItem('leadintel_customer_v2_outreach')).items[0],before:E.workingDraft(item)};
}
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
