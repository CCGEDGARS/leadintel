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
const friendlyExpected=[
 'Hi Robin,',
 'Congratulations on Buyer’s investment in a new sorting plant at Northport.',
 "I'm Alex Lane from North Works ( https://north.example/ ).",
 'We are a metalworking team that has spent more than 30 years on the less glamorous part of projects like yours: turning drawings into steel that shows up on time and fits.',
 "I don't know yet whether you need us. You may be fully covered, and if so, good. But if an extra pair of reliable hands for drawing development, steel manufacturing, installation and qualified workforce would simplify delivery and control costs, I'd enjoy a conversation.",
 'Here are some of the projects we are proud of: https://north.example/projects/tower.',
 "Have a look when you have a coffee in hand. If something catches your eye, I'd enjoy a 20-minute Zoom conversation.",
 "I'll bring relevant production data and lessons, and you can share what your team needs.",
 'Choose a suitable time here: https://calendly.com/north/intro.',
 "And if steelwork sits with someone else, I'd appreciate a pointer in the right direction.",
 'Warm regards,\nAlex Lane'
].join('\n\n');
test('finished Friendly body retains approved experience and conditional voice instead of Profile prose',()=>{
 const studio=S.normalize({mode:'friendly',essentials}),draft=E.tailor(studio,context());
 assert.equal(draft.message,friendlyExpected);E.validateCoreDraft(studio,context(),draft);
 assert.doesNotMatch(draft.message,/Our team brings|2028|Arctic|LKAB|ERCON/);
 for(const company of ['Other Seller','Third Supplier']){
  const other=S.normalize({mode:'friendly',essentials:{...essentials,company}});
  assert.equal(E.tailor(other,context()).message,friendlyExpected.replace('North Works',company));
 }
});
const expectedBodies={
 curiosity:[
  'Hi Robin,',
  'As we know, Buyer is investing in a new sorting plant at Northport. Right?',
  "I'm Alex Lane from North Works.",
  'And by the way, this is not another sales pitch but an open invitation to a long-term partnership.',
  'For more than 30 years our team has taken steel from drawing to installed structure: drawing development, manufacturing, installation and the qualified people to do it. That means simplifying delivery and controlling costs.',
  "I'm not suggesting you change anything that works. Simply compare your current workflow with the opportunities we can provide.",
  'As you look through our approved project references here https://north.example/projects/tower, you may notice how close some of them are to what you are building now.',
  "My proposal: let's meet for a 20-minute Zoom call and see whether there is a fit.",
  'I bring relevant production data and lessons, you bring your requirements, and you will be ready to decide whether it is worth continuing.',
  'Would you be open to a 20-minute Zoom conversation this week or next?',
  'Please choose a suitable time here: https://calendly.com/north/intro.',
  'Best regards,\nAlex Lane',
  'https://www.linkedin.com/in/alexlane/'
 ].join('\n\n'),
 brutal:[
  'Hi Robin,',
  'I should say this first: I’m LeadIntel, an AI-powered system.',
  'Alex Lane at North Works asked me to research potential business partners and write to relevant people on his behalf.',
  'A research brought me to Buyer’s investment in a new sorting plant at Northport. I don’t know whether you need another steel partner. You may be fully covered. But if additional capabilities could simplify delivery and control costs, this may be worth a conversation.',
  'For more than 30 years North Works have taken steel from drawing to installed structure: development, manufacturing, installation and the qualified people to do it. That means – simplifying delivery and controlling costs. https://north.example/',
  'Here are some projects they are proud of: https://north.example/projects/tower.',
  'If something catches your eye, would you be open to a 20-minute Zoom conversation with Alex Lane?',
  'Alex Lane will bring relevant production data and lessons. You can share your requirements and explore how North Works could help simplify delivery and control costs.',
  'I’m writing the introduction. Alex Lane will be there for the conversation.',
  'Choose a suitable time here: https://calendly.com/north/intro.',
  'Warm regards,\nLeadIntel. On behalf of Alex Lane.',
  'https://www.linkedin.com/in/alexlane/'
 ].join('\n\n')
};
test('finished NLP and Brutal bodies retain every approved literal outside factual slots',()=>{
 for(const mode of ['curiosity','brutal']){
  const studio=S.normalize({mode,essentials}),draft=E.tailor(studio,context());
  assert.equal(draft.message,expectedBodies[mode]);E.validateCoreDraft(studio,context(),draft);
  assert.doesNotMatch(draft.message,/Our team brings|Their team brings|They provide|We provide/);
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
 assert.throws(()=>E.validateCoreDraft(s,c,{...draft,message:draft.message.replace('less glamorous','most exciting')}),/differs from the approved/);
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
