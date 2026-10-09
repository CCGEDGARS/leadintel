const {test}=require('node:test'),assert=require('node:assert/strict');
const M=require('../message-studio.js'),T=require('../message-translations.js'),E=require('../message-editor.js');
const e={sender:'Alex Smith',company:'LegalCo',language:'en',calendly:'https://calendly.com/alex/call',value:'Reduce admin time',offer:'Contract review'};
const context={buyerCompany:'ClientCo',fitScore:87,trigger:{title:'Project Alpha',summary:'A long research paragraph '.repeat(20),verification:'source_verified',url:'https://example.com/news',positive:true}};
test('every approved generated subject is one clean line within 60 characters across all message languages',()=>{
 for(const language of Object.keys(T.languages))for(const mode of ['professional','curiosity','friendly','brutal'])for(const choice of M.subjectsFor(mode)){
  const studio=M.chooseSubject(M.normalize({mode},e),mode,choice.id),subject=M.resolvedSubject(studio,{...context,subjectLanguage:language},e);
  assert.ok(subject&&M.validSubject(subject),`${language}/${mode}/${choice.id}: ${subject}`);
  assert.ok(Array.from(subject).length<=60);
  assert.doesNotMatch(subject,/research paragraph|needs verified|Error:|Subject:/);
 }
});
test('approved English wording remains exact and source paragraphs never become subject facts',()=>{
 const s=M.chooseSubject(M.normalize({mode:'professional'},e),'professional','development');
 assert.equal(M.resolvedSubject(s,context,e),'Alex Smith. LegalCo');
 assert.equal(M.resolvedSubject(s,{...context,trigger:{...context.trigger,title:'A long source title '.repeat(10)}},e),'Alex Smith. LegalCo');
 const b=M.chooseSubject(s,'professional','benefit');
 assert.equal(M.resolvedSubject(b,context,e),'Alex Smith. LegalCo');
 assert.equal(M.resolvedSubject(b,context,{...e,value:'We provide many services and reduce coordination burden across projects. '.repeat(5)}),'Alex Smith. LegalCo');
 for(const text of ['Error: provider unavailable','undefined','Subject: Something','{"error":"failed"}','A title\nProvider error'])assert.equal(M.subjectFact(text),'');
});
test('localized fixed wording preserves literal names and real scores, without importing English benefit prose',()=>{
 let s=M.chooseSubject(M.normalize({mode:'brutal'},e),'brutal','human');
 assert.equal(M.resolvedSubject(s,{...context,subjectLanguage:'sv'},e),'Alex Smith deltar i samtalet.');
 s=M.chooseSubject(s,'brutal','fit');assert.equal(M.resolvedSubject(s,{...context,subjectLanguage:'lv'},e),'ClientCo — atbilstība: 87/100');
 const b=M.chooseSubject(M.normalize({mode:'professional'},e),'professional','benefit');
 assert.equal(M.resolvedSubject(b,{...context,subjectLanguage:'sv'},e),'Alex Smith. LegalCo');
});
test('evidence-specific options can be disabled without substituting a different approved pattern',()=>{
 const s=M.chooseSubject(M.normalize({mode:'professional'},e),'professional','development');
 assert.equal(M.resolvedSubject(s,{buyerCompany:'ClientCo',strictSubjectChoice:true},e),null);
 assert.equal(M.subjectPattern('professional','development','sv'),'{{subjectProject}} {{subjectMaterial}} – vem ska jag fråga?');
});
test('generated and translated subjects reject paragraphs, prefixes and overlong output before applying it',()=>{
 const message='Would you be open to a 20-minute Zoom conversation? '+e.calendly;
 for(const subject of ['x'.repeat(61),'Subject: Hello','Error: unavailable','First line\nSecond line','{"error":"failed"}']){
  assert.throws(()=>M.parse(JSON.stringify({subject,message}),e),/Subject must/);
  assert.throws(()=>T.validate({subject:'Hello',message},{subject,message}),/length limit/);
 }
 const s=M.normalize({mode:'professional'},e),ctx={...context,channel:'email'};assert.throws(()=>E.tailor(s,ctx),/Prepare concise English/);const prepared=E.parsePrepared({triggerSummary:'A long research paragraph',offer:e.offer,value:'reduce admin time',difference:'',approach:'',meetingValue:''},s,ctx);assert.ok(M.validSubject(E.tailor(s,E.preparedContext(s,ctx,prepared)).subject));
});

test('oversized generated subjects repair once with history while manual and approved drafts stay exact',()=>{
 const s=M.chooseSubject(M.normalize({mode:'professional'},e),'professional','development');
 const bad='Regarding '+context.trigger.summary,item={channel:'email',drafts:{emailSubject:bad,emailBody:'Exact body'},messageStudioDraft:{mode:'professional',editorOrigin:'tailored',selectedSubject:bad,essentials:s.essentials}};
 const repaired=E.repairSubject(item,s,context);assert.equal(repaired.drafts.emailSubject,'Alex Smith. LegalCo');assert.equal(repaired.drafts.emailBody,'Exact body');assert.equal(repaired.messageStudioDraft.subjectCorrections[0].subject,bad);
 assert.equal(E.repairSubject(repaired,s,context),repaired);
 const restored=JSON.parse(JSON.stringify(repaired));assert.equal(restored.messageStudioDraft.subjectCorrections[0].subject,bad);
 for(const preserved of [{...item,approved:true},{...item,messageStudioDraft:{...item.messageStudioDraft,editorOrigin:'manual'}},{...item,drafts:{...item.drafts,emailSubject:'My manual subject'}},{...item,messageStudioDraft:{...item.messageStudioDraft,essentials:{...s.essentials,company:'Previous workspace'}}}])assert.equal(E.repairSubject(preserved,s,context),preserved);
});
