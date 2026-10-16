const test=require('node:test'),assert=require('node:assert/strict');
const S=require('../message-studio.js'),E=require('../message-editor.js'),O=require('../outreach-engine.js'),F=require('../message-facts.js');
const {mounted}=require('./helpers/message-runtime.js');
const excerpt='Buyer is investing in a new sorting plant at Northport.';
const dossier={domain:'buyer.example',evidence:[{url:'https://buyer.example/news',text:excerpt}]};
const selected={companyDomain:dossier.domain,url:dossier.evidence[0].url,verification:'source_verified',excerpt};
const essentials={sender:'Alex Lane',company:'North Works',offer:'drawing development, steel manufacturing, installation and qualified workforce',value:'simplify delivery and control costs',difference:'Our team brings more than 30 years of metalworking experience.',approach:'Project delivery',meetingValue:'relevant production data and lessons',proof:'https://north.example/projects/tower',calendly:'https://calendly.com/north/intro',language:'en'};
const context=()=>({channel:'email',firstName:'Robin',buyerName:'Robin Buyer',buyerCompany:'Buyer',sellerWebsite:'https://north.example/',senderLinkedInUrl:'https://www.linkedin.com/in/alexlane/',trigger:{...O.normalizeSelectedTrigger(selected,dossier),summary:excerpt},fitScore:80});
test('real dossier normalization retains a source-derived positive milestone and yields five Friendly subjects',()=>{
 const t=O.normalizeSelectedTrigger(selected,dossier);assert.equal(t.positive,true);
 const audit=S.subjectAudit(S.normalize({mode:'friendly',essentials}),context());assert.equal(audit.ready,5);assert.equal(audit.rows[4].subject,'Congratulations on Northport');
 assert.deepEqual(O.normalizeSelectedTrigger({...selected,positive:false,projectName:'Invented place'},dossier),t);
 assert.equal(O.normalizeSelectedTrigger({...selected,excerpt:'Invented milestone',positive:true},dossier),null);
 const negative='Buyer announced a cancelled investment in a new sorting plant at Northport.';
 const n=O.normalizeSelectedTrigger({...selected,excerpt:negative,positive:true},{...dossier,evidence:[{url:selected.url,text:negative}]});assert.equal(n.positive,false);
 assert.equal(S.subjectAudit(S.normalize({mode:'friendly',essentials}),{...context(),trigger:{...n,summary:negative}}).ready,4);
 assert.match(S.subjectAudit(S.normalize({mode:'friendly',essentials}),{...context(),trigger:n}).rows[4].reason,/positive business milestone/);
});
test('milestone classification rejects cancellation, hypotheticals, negation and context-only prose',()=>{
 for(const text of ['Buyer is not investing in a new sorting plant at Northport.','Buyer has delayed construction of a new plant at Northport.','Buyer could expand its factory at Northport.','Buyer offers investment services for industrial customers.'])assert.equal(F.positiveEvent(text),false,text);
 assert.equal(F.positiveEvent(excerpt),true);
});
const friendlyExpected="Hi Robin,\n\nCongratulations on Buyer’s investment in a new sorting plant at Northport.\n\nI’m Alex from North Works, a company providing drawing development, steel manufacturing, installation and qualified workforce. Our team brings more than 30 years of metalworking experience.\n\nhttps://north.example/projects/tower\n\nI don’t know whether you need us. You may be fully covered, and if so, good. But if an extra pair of reliable hands for drawing development, steel manufacturing, installation and qualified workforce would make your project a little calmer, we would be happy to assist.\n\nWould you be open to a 20-minute chat on Zoom?\n\nI’ll bring relevant production data and lessons, and you can share what your team needs. https://calendly.com/north/intro\n\nWarm regards,\nAlex Lane\nNorth Works\nhttps://north.example/ | https://www.linkedin.com/in/alexlane/\n\nP.S. If steelwork sits with someone else, I’d be grateful for a pointer in the right direction.";
test('finished Friendly body retains approved experience and conditional voice instead of Profile prose',()=>{
 const studio=S.normalize({mode:'friendly',essentials}),draft=E.tailor(studio,context());
 assert.equal(draft.message,friendlyExpected);E.validateCoreDraft(studio,context(),draft);
 assert.doesNotMatch(draft.message,/2028|Arctic|LKAB|ERCON/);
 for(const company of ['Other Seller','Third Supplier']){
  const other=S.normalize({mode:'friendly',essentials:{...essentials,company}});
  assert.equal(E.tailor(other,context()).message,friendlyExpected.replaceAll('North Works',company));
 }
});
const expectedBodies={"curiosity": "Hi Robin,\n\nBuyer is investing in a new sorting plant at Northport.\n\nThis is what we stand for. I’m Alex Lane from North Works, a company providing drawing development, steel manufacturing, installation and qualified workforce.\n\nhttps://north.example/projects/tower\n\nYou may already be fully covered, and I’m not suggesting you change anything that works. Many project teams simply like to have one more qualified option ready before the drawing development, steel manufacturing, installation and qualified workforce packages go out, and that is what we would like to be.\n\nIf it makes sense, let’s take 20 minutes on Zoom.\n\nYou bring your requirements, I bring relevant production data and lessons, and you can judge for yourself whether there is a fit. https://calendly.com/north/intro\n\nBest regards,\nAlex Lane\nNorth Works\nhttps://north.example/ | https://www.linkedin.com/in/alexlane/\n\nP.S. If this isn’t on your desk, I’d be grateful if you could point me to the right person.", "brutal": "Hi Robin,\n\nI should say this first: I’m LeadIntel, an AI-powered system. Alex Lane at North Works asked me to find projects where their work could be genuinely useful, and to write to the people behind them.\n\nBuyer is investing in a new sorting plant at Northport.\n\nNorth Works is a company providing drawing development, steel manufacturing, installation and qualified workforce.\n\nhttps://north.example/projects/tower\n\nI don’t know whether you need them. You may be fully covered. If not, here are three values North Works stands for: simplify delivery and control costs.\n\nIf it makes sense, let’s schedule 20 minutes on Zoom with Alex.\n\nHe’ll bring relevant production data and lessons, and you can share your requirements. https://calendly.com/north/intro\n\nI wrote the introduction. The conversation would be with a real human.\n\nLeadIntel, on behalf of Alex Lane\nNorth Works\nhttps://north.example/ | https://www.linkedin.com/in/alexlane/\n\nP.S. If steelwork isn’t on your desk, a pointer to the right person would be much appreciated. Alex will follow up personally."};
test('finished NLP and Brutal bodies retain every approved literal outside factual slots',()=>{
 for(const mode of ['curiosity','brutal']){
  const studio=S.normalize({mode,essentials}),draft=E.tailor(studio,context());
  assert.equal(draft.message,expectedBodies[mode]);E.validateCoreDraft(studio,context(),draft);
  assert.doesNotMatch(draft.message,/ERCON|LKAB|2028/);
 }
});
test('approved factual frame never leaks metalworking, steel or thirty years into another industry',()=>{
 for(const mode of ['professional','curiosity','friendly','brutal']){
  const s=S.normalize({mode,essentials:{...essentials,offer:'business advisory',difference:'Our team has fourteen years of advisory experience.'}}),draft=E.tailor(s,context());
  assert.doesNotMatch(draft.message,/metalworking|steel|30 years|ERCON|LKAB/);
 }
});
test('final update gate rejects a changed body or an incomplete five-subject set',()=>{
 const s=S.normalize({mode:'friendly',essentials}),c=context(),draft=E.tailor(s,c);
 assert.throws(()=>E.validateCoreDraft(s,c,{...draft,message:draft.message.replace('we would be happy to assist','we guarantee success')}),/differs from the approved/);
 assert.throws(()=>E.validateCoreDraft(s,{...c,trigger:{...c.trigger,positive:false}},E.tailor(s,{...c,trigger:{...c.trigger,positive:false}})),/all five subjects/);
});
test('mounted production context produces 5/5 Friendly subjects and persists explicit restoration through reopen',()=>{
 const h=mounted({selected:'friendly'});try{
  const ctx=h.w.studioMessageContext(),studio=h.w.studioState();assert.equal(ctx.trigger.positive,true);assert.equal(S.subjectAudit(studio,ctx).ready,5);
  const before=h.item();assert.equal(h.w.applyApprovedTemplate(before,studio,ctx,'restored',{templateUpdate:true}),true);
  const next=h.item();assert.equal(next.messageStudioDraft.tailoringVersion,7);assert.ok(next.messageStudioDraft.templateUpdateUndo);
  const snapshot=JSON.parse(h.w.localStorage.getItem('leadintel_customer_v2_outreach')),reopened=mounted({outreachSnapshot:snapshot});try{
   assert.equal(reopened.q('outreach-email-body').value,next.drafts.emailBody);
   assert.equal(S.subjectAudit(reopened.w.studioState(),reopened.w.studioMessageContext()).ready,5);
   assert.ok(reopened.item().messageStudioDraft.originalHistory.some(original=>original.draft.message===before.messageStudioDraft.tailoredOriginal.draft.message));
   assert.equal(reopened.item().messageStudioDraft.templateUpdateUndo.draft.message,before.drafts.emailBody);
  }finally{reopened.w.close();}
 }finally{h.w.close();}
});

test('mounted incomplete update cannot overwrite the working copy or report completion',()=>{
 const h=mounted({selected:'friendly'});try{
  const before=JSON.stringify(h.item()),context={...h.w.studioMessageContext(),trigger:{...h.w.studioMessageContext().trigger,positive:false}};
  assert.equal(h.w.applyApprovedTemplate(h.item(),h.w.studioState(),context,'incomplete',{templateUpdate:true}),false);
  assert.equal(JSON.stringify(h.item()),before);assert.match(h.q('message-generation-status').textContent,/all five subjects.*positive business milestone/);
 }finally{h.w.close();}
});

test('approved Brutal wording budgets factual fields and uses the benefit once',()=>{
 const raw={...essentials,sender:'Edgars Untals',company:'ERCON',offer:'drawing development, metal manufacturing, installation and qualified workforce solutions',difference:'Our team brings more than 30 years of metalworking experience, including international projects in Scandinavia.',value:'reduce coordination burden through one full-service industrial project partner',meetingValue:'relevant production data and lessons from previous projects'};
 const studio=S.normalize({mode:'brutal',essentials:raw}),c={...context(),sellerEvidence:[{url:'https://north.example/projects/tower',text:'We manufacture steel structures and provide installation for industrial projects.'}],trigger:{...context().trigger,summary:'Buyer is investing six billion kronor in a new sorting plant at Northport.'}};
 assert.ok(E.preparationWordLimits(studio,c).value<=E.fieldWords.value);
 const limits=E.preparationWordLimits(studio,c);assert.ok(limits.value<=E.fieldWords.value);
 const prepared=E.preparedResponse({triggerSummary:'Buyer’s investment in a sorting plant at Northport',offer:'metal manufacturing and installation',value:'reduce coordination burden',difference:'Our team has more than 30 years of experience.',approach:'Project delivery',meetingValue:'relevant production data and lessons'},studio,c);
 const ctx=E.preparedContext(studio,c,prepared),draft=E.tailor(studio,ctx);E.validateCoreDraft(studio,ctx,draft);
 assert.ok(draft.message.split(/\s+/).length<=require('../approved-reference-scripts').coreContract('brutal').maximumMessageWords);assert.equal(draft.message.split('reduce coordination burden').length-1,1);assert.match(draft.message,/ERCON is a company providing/);
 assert.equal(prepared.fields.difference,raw.difference);assert.equal(prepared.fields.approach,raw.approach);
});

test('investing a supported quantity becomes a grammatical event noun without dropping its facts',()=>{
 for(const mode of ['professional','friendly','brutal']){
  const studio=S.normalize({mode,essentials:{...essentials,meetingValue:'project data'}}),ctx={...context(),trigger:{...context().trigger,summary:'Buyer is investing six billion kronor in a plant at Northport.'}};
  const draft=E.tailor(studio,ctx);assert.match(draft.message,mode==='professional'?/Northport/:/six billion kronor/);assert.doesNotMatch(draft.message,/investment six/);
 }
});
test('source fingerprints retain rendering facts without duplicating official page corpora in draft history',()=>{
 const studio=S.normalize({mode:'friendly',essentials}),source={url:'https://north.example/projects/tower',text:'We manufacture steel and provide installation. '+ 'Official project source '.repeat(400)};
 const ctx={...context(),sellerEvidence:[source]},key=E.scope('w1',{domain:'buyer.example'},studio,ctx);
 assert.ok(key.length<4000);assert.ok(!key.includes('Official project source'));
 const changed={...ctx,sellerEvidence:[{...source,text:'We provide business advisory for commercial customers.'}]};
 const nonSteel=S.normalize({mode:'friendly',essentials:{...essentials,offer:'drawing development, metal manufacturing, installation and qualified workforce'}});
 assert.notEqual(E.scope('w1',{},nonSteel,ctx),E.scope('w1',{},nonSteel,changed));
});

test('Professional combined budget can shorten one otherwise-valid field for a grammatical investment quantity',()=>{
 const studio=S.normalize({mode:'professional',essentials:{...essentials,sender:'Edgars Untals',company:'ERCON',offer:'drawing development, metal manufacturing, installation and qualified workforce solutions',difference:'Our team brings more than 30 years of metalworking experience, including international projects in Scandinavia.'}}),ctx={...context(),firstName:'Joakim',buyerName:'Joakim Winsa',trigger:{...context().trigger,summary:'LKAB is investing six billion kronor in a new sorting plant at Malmberget.'}};
 assert.ok(E.preparationWordLimits(studio,ctx).offer<=E.fieldWords.offer);const limits=E.preparationWordLimits(studio,ctx);assert.ok(limits.offer<=E.fieldWords.offer);
 const sources=E.fieldSources(studio,ctx),prepared=E.preparedResponse({...sources,difference:'Our team brings more than 30 years of metalworking experience, including projects in Scandinavia.'},studio,ctx),draft=E.tailor(studio,E.preparedContext(studio,ctx,prepared));
 assert.match(draft.message,/Malmberget|six billion kronor/);assert.ok(draft.message.split(/\s+/).length<=require('../approved-reference-scripts').coreContract('professional').maximumMessageWords);assert.equal(prepared.fields.offer,sources.offer);assert.equal(prepared.fields.triggerSummary,sources.triggerSummary.replace(/[.!?]+$/,''));
});

test('approved shorter Brutal master preserves the investment quantity through field preparation',()=>{
 const studio=S.normalize({mode:'brutal',essentials}),ctx={...context(),trigger:{...context().trigger,summary:'Buyer is investing six billion kronor in a plant at Northport.'}};
 assert.ok(E.preparationWordLimits(studio,ctx).offer<=E.fieldWords.offer);
 const prepared=E.preparedResponse({...E.fieldSources(studio,ctx),triggerSummary:'Buyer’s investment of six billion kronor at Northport',value:'simplify delivery',meetingValue:'project data'},studio,ctx);
 const next=E.preparedContext(studio,ctx,prepared),draft=E.tailor(studio,next);
 E.validateCoreDraft(studio,next,draft);assert.match(draft.message,/Malmberget|six billion kronor/);assert.ok(draft.message.split(/\s+/).length<=require('../approved-reference-scripts').coreContract('brutal').maximumMessageWords);
});
