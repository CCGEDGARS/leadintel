const {test}=require('node:test'),assert=require('node:assert/strict');
const S=require('../message-studio.js'),E=require('../message-editor.js'),O=require('../outreach-engine.js');
const essentials={sender:'Robin Lane',company:'North Works',offer:'steel manufacturing and installation',target:'industrial teams',problem:'supplier handoffs',value:'simplify delivery',difference:'Our team has more than 20 years of metalworking experience.',approach:'We turn drawings into steel.',meetingValue:'project lessons',calendly:'https://calendly.com/north/intro',nextAction:'Choose a time'};
const base={channel:'email',buyerDomain:'buyer.example',buyerCompany:'Buyer',buyerName:'Sam Buyer',firstName:'Sam',buyerRole:'Procurement Director',sellerWebsite:'https://seller.example',sellerEvidence:[],buyerFactEvidence:[],trigger:{verification:'source_verified',url:'https://buyer.example/news/directors',excerpt:'Buyer appointed new directors for its green steel project.',summary:'Buyer appointed new directors for its green steel project.'}};
test('all styles build a factual preparation report; incomplete project openings use only the declared no-event omission',()=>{
 for(const mode of ['professional','curiosity','friendly','brutal','original']){
  const studio=S.normalize({mode,essentials}),ctx=E.prepareFactContext(studio,base);
  assert.equal(ctx.factPreparation.version,'message-facts-20261022-v1');assert.equal(ctx.researchTrigger.url,base.trigger.url);
  if(['curiosity','friendly','brutal'].includes(mode)){
   assert.equal(ctx.bodyTrigger,null);assert.equal(ctx.trigger.url,base.trigger.url);assert.equal(ctx.factPreparation.opening,'approved-omission');
   const draft=E.tailor(studio,ctx);assert.doesNotMatch(draft.message,/\[Add verified (?:milestone|project|opening-year|project-type)/);assert.doesNotMatch(draft.message,/directors/);
  }
 }
});
test('complete project evidence retains its source frame and timeline, with source attribution',()=>{
 const text='Buyer is investing in a new sorting plant at Riverport. Foundation work is under way. The plant is due to run in 2029.';
 const trigger={...O.normalizeSelectedTrigger({verification:'source_verified',companyDomain:'buyer.example',url:'https://buyer.example/news/riverport',excerpt:text},{domain:'buyer.example',evidence:[{url:'https://buyer.example/news/riverport',text}]}),summary:text};
 const context={...base,trigger,buyerFactEvidence:[{url:trigger.url,text,extractedAt:'2026-10-22',verification:'source_verified'}]};
 for(const mode of ['curiosity','friendly','brutal']){const studio=S.normalize({mode,essentials}),ctx=E.prepareFactContext(studio,context);assert.equal(ctx.factPreparation.opening,'verified');assert.equal(ctx.trigger.url,trigger.url);assert.equal(E.factualValues(studio,ctx).openingYear,'2029');assert.ok(ctx.factPreparation.facts.some(f=>f.id==='openingYear'&&f.url===trigger.url&&f.value==='2029'));}
});
test('a selected event without a project still plans buyer research for every style',()=>{
 for(const mode of ['professional','curiosity','friendly','brutal','original']){
  const studio=S.normalize({mode,essentials}),ctx=E.prepareFactContext(studio,base),plan=E.factResearchPlan(studio,ctx);
  assert.ok(plan.some(p=>p.owner==='buyer'&&p.domain==='buyer.example'));
  assert.ok(plan.length<=4);assert.doesNotMatch(JSON.stringify(plan),/EXC3|Calendly|Robin Lane/);
 }
});
test('new schedule evidence invalidates the exact template scope even when the subject stays the same',()=>{
 const studio=S.normalize({mode:'curiosity',essentials}),item={domain:'buyer.example',selectedPersonId:'sam',channel:'email'};
 const trigger={verification:'source_verified',url:'https://buyer.example/news/riverport',excerpt:'Buyer is building a new sorting plant at Riverport.',summary:'Buyer is building a new sorting plant at Riverport.'};
 const first={...base,trigger,buyerFactEvidence:[{url:trigger.url,sourceRead:true,text:'Foundation work is under way for the new sorting plant at Riverport. The plant is due to run in 2029.'}]};
 const second={...first,buyerFactEvidence:[{url:trigger.url,sourceRead:true,text:'Foundation work is under way for the new sorting plant at Riverport. The plant is due to run in 2030.'}]};
 assert.notEqual(E.scope('w1',item,studio,first),E.scope('w1',item,studio,second));
});
test('unresolved required fields stay Needs information for every style; ordinary bracketed citations are allowed',()=>{
 for(const mode of ['professional','curiosity','friendly','brutal','original'])assert.deepEqual(E.draftFactGaps({subject:'Hello',message:'Hi Sam,\n\n[Add verified cost basis]\n\n{{missing}}'},mode),['cost basis','missing']);
 assert.deepEqual(E.draftFactGaps({subject:'Hello',message:'Reference [1].'}),[]);
});
test('fact preparation stays with the buyer through CRM save/reopen and does not change approved masters',()=>{
 const A=require('../approved-reference-scripts'),before=JSON.stringify(A.records),studio=S.normalize({mode:'curiosity',essentials}),ctx=E.prepareFactContext(studio,base);
 const item={domain:'buyer.example',company:'Buyer',selectedPersonId:'sam',channel:'email',dossier:{domain:'buyer.example',company:'Buyer',people:[{id:'sam',name:'Sam Buyer'}],evidence:[]},drafts:{emailSubject:'Hello',emailBody:'Working draft'},messageStudioDraft:{factPreparation:ctx.factPreparation}};
 const saved=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(item),'buyer.example');assert.deepEqual(saved.messageStudioDraft.factPreparation,ctx.factPreparation);assert.equal(JSON.stringify(A.records),before);
});
test('the assembled workspace never calls an incomplete draft ready, including AI Generated',()=>{
 const {mounted}=require('./helpers/message-runtime');
 for(const mode of ['professional','curiosity','friendly','brutal','original']){
  const h=mounted({selected:mode});try{const item=h.item();item.drafts.emailBody='Hi Alex,\n\n[Add verified cost basis]';item.messageStudioDraft.mode=mode;delete item.messageStudioDraft.scriptSavedAt;h.w.upsertItem(item);h.w.renderAll();
   assert.equal(h.q('mw-updating-notice').dataset.state,'needs-information',mode);assert.match(h.q('mw-updating-notice').textContent,/Needs information/);assert.doesNotMatch(h.q('mw-updating-notice').textContent,/Ready to review/);assert.equal(h.q('mw-add-flow').disabled,true);
  }finally{h.w.close();}
 }
});
test('research cache ownership stays bounded and changes with customer, recipient and Profile facts',()=>{
 const studio=S.normalize({mode:'curiosity',essentials}),item={domain:'buyer.example',selectedPersonId:'sam'},context={...base,profileEvidence:[{url:'https://seller.example/about',text:'Company facts. '.repeat(10000)}]};
 const first=E.factOwnerKey('w1',item,studio,context);assert.ok(first.length<300);assert.notEqual(first,E.factOwnerKey('w2',item,studio,context));assert.notEqual(first,E.factOwnerKey('w1',{...item,selectedPersonId:'alex'},studio,context));assert.notEqual(first,E.factOwnerKey('w1',item,studio,{...context,profileEvidence:[{url:'https://seller.example/about',text:'Changed facts.'}]}));
});
test('an obsolete or contradictory opening date never becomes a claimed project date',()=>{
 for(const schedule of ['The plant is due to run in 2020.','The plant is due to run in 2029. The plant is scheduled to open in 2030.']){
  const text='Buyer is investing in a new sorting plant at Riverport. Foundation work is under way. '+schedule;
  const ctx=E.prepareFactContext(S.normalize({mode:'curiosity',essentials}),{...base,trigger:{verification:'source_verified',url:'https://buyer.example/news/riverport',excerpt:text,summary:text},buyerFactEvidence:[]});
  assert.notEqual(ctx.factPreparation.opening,'verified');assert.ok(ctx.factPreparation.missingOpening.includes('openingYear'));assert.doesNotMatch(ctx.factPreparation.openingFact?.text||'',/20(?:20|29|30)/);
 }
});

test('missing mandatory experience facts request seller research even when generic evidence is complete',()=>{
 const studio=S.normalize({mode:'friendly',essentials:{...essentials,difference:'Our team supports industrial projects.',proof:'https://seller.example/projects'}}),text='Buyer is investing in a new sorting plant at Riverport. Foundation work is under way. The plant is due to run in 2029.';
 const ctx=E.prepareFactContext(studio,{...base,trigger:{verification:'source_verified',positive:true,url:'https://buyer.example/news/riverport',summary:text,excerpt:text},sellerEvidence:[{url:'https://seller.example/about',text:'We manufacture steel structures and installation. We are EN 1090 certified and use steel materials.'}]});
 assert.ok(E.coreFactGaps(studio,ctx).includes('experienceDuration'));assert.ok(E.factResearchPlan(studio,ctx).some(row=>row.owner==='seller'&&row.fields.includes('experienceDuration')));
});
test('fact preparation expiry changes the template scope',()=>{
 const studio=S.normalize({mode:'curiosity',essentials}),item={domain:'buyer.example',selectedPersonId:'sam',channel:'email'},text='Buyer is investing in a new sorting plant at Riverport. Foundation work is under way. The plant is due to run in 2028.',context={...base,trigger:{verification:'source_verified',url:'https://buyer.example/news/riverport',excerpt:text,summary:text}};
 const first=E.prepareFactContext(studio,{...context,now:'2028-01-01'}),expired=E.prepareFactContext(studio,{...context,now:'2029-01-01'});assert.notEqual(E.scope('w',item,studio,first),E.scope('w',item,studio,expired));
});
test('research completion preserves the original template action Undo through CRM reload',()=>{
 let item={channel:'email',domain:'buyer.example',drafts:{emailSubject:'Original',emailBody:'Original exact manual body'},messageStudioDraft:{mode:'professional'}};
 const before=E.workingDraft(item);item=E.apply(item,{subject:'Interim',message:'Interim fallback'},{templateUpdate:true,style:'curiosity'});item=E.apply(item,{subject:'Prepared',message:'Prepared body'},{templateUpdate:true,continueTemplateUpdate:true,style:'curiosity'});
 assert.deepEqual(E.updateUndo(item),before);assert.deepEqual(E.workingDraft(E.undoTemplateUpdate(item)),before);
});
test('fact research always shows Preparing while facts are still being checked',()=>{
 const {mounted}=require('./helpers/message-runtime'),h=mounted();try{h.w.LeadIntelMessageWorkspace.render(h.w.document,{ready:true,authenticated:true,channel:'email',hasDraft:true,selectedStyle:'professional',appliedStyle:'professional',busy:true,factResearchBusy:true});assert.match(h.q('mw-updating-notice').textContent,/Preparing verified facts/);assert.doesNotMatch(h.q('mw-updating-notice').textContent,/Ready to review/);}finally{h.w.close();}
});
test('automatic research preserves action Undo and reuses same buyer queries across styles and CRM reopen',async()=>{
 const {mounted,settleFactResearch}=require('./helpers/message-runtime'),h=mounted({selected:'professional'});
 try{
  h.w.document.querySelector('[data-writing-style="curiosity"]').click();await settleFactResearch(h);
  assert.deepEqual(E.updateUndo(h.item()),h.before);const research=h.item().messageStudioDraft.subjectResearch;assert.ok(research.queryReceipts.length);assert.ok(research.executions.length);
  const ownerReceipts=research.queryReceipts.filter(row=>row.owner==='buyer'),beforeCount=h.requests.length;
  h.w.document.querySelector('[data-writing-style="brutal"]').click();await settleFactResearch(h);
  const newSearches=h.requests.slice(beforeCount).filter(row=>/search/.test(row.url)).map(row=>JSON.parse(row.options.body).query);
  for(const receipt of ownerReceipts)assert.ok(!newSearches.includes(receipt.query),'completed buyer query must be reused');
  const snapshot=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(h.item()),'buyer.example');assert.deepEqual(snapshot.messageStudioDraft.subjectResearch.queryReceipts,h.item().messageStudioDraft.subjectResearch.queryReceipts);assert.deepEqual(E.updateUndo(snapshot),E.updateUndo(h.item()));
 }finally{h.w.close();}
});
