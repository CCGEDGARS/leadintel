const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../script-contract.js'),S=require('../channel-scripts.js'),W=require('../writing-assistant-context.js');
test('character budgets count Unicode text, spaces, signature, URL and normalized newlines',()=>{
 assert.equal(C.count('Å\r\n😀 e\u0301'),5);
 const row={id:'email:friendly',channel:'email',style:'friendly',original:'Hi\n\nName\nhttps://example.test',body:'Hi [First name]'};
 assert.equal(C.contract(row).maximumCharacters,C.count(row.original));
 assert.equal(C.audit(row.original,C.contract(row)).ok,true);
 assert.equal(C.audit(row.original+'!',C.contract(row)).overBy,1);
});
test('each script uses its own original and the explicitly agreed NLP ceiling',()=>{
 for(const channel of ['email','linkedin','phone'])for(const style of ['professional','curiosity','friendly','brutal','storyselling']){
  const row={id:channel+':'+style,channel,style,original:'x'.repeat(1500),body:'[First name]'};
  assert.equal(C.contract(row).maximumCharacters,channel==='email'&&style==='curiosity'?1074:1500);
 }
 const core={id:'email:friendly',channel:'email',original:'a'.repeat(500),body:'[name]'};
 const stripped={...core,...C.contract(core)};delete stripped.original;
 assert.equal(C.contract(stripped).maximumCharacters,500,'public catalogue retains server-measured original ceiling');
});
test('over-limit personalizations are reported intact, never silently truncated',()=>{
 const row={id:'phone:professional',channel:'phone',body:'Hi [First name]',original:'Hi Alex'};
 const result=S.fillScript(row,{firstName:'Alexandra'});
 assert.equal(result.draft.message,'Hi Alexandra');assert.equal(result.length.ok,false);assert.equal(row.body,'Hi [First name]');
 assert.throws(()=>C.assertFits(result.draft.message,C.contract(row)),/12 characters.*7/);
});
test('team experience is attributed to the team, not corporate age',()=>{
 const row={channel:'email',body:'A company with [verified years of experience] in [industry].',subject:'Hello'};
 const result=S.fillScript(row,{experienceOwner:'team',experienceDuration:'more than thirty years',industry:'metalworking'});
 assert.equal(result.draft.message,'A company whose team has more than thirty years of experience in metalworking.');
 assert.equal(row.body,'A company with [verified years of experience] in [industry].');
});
test('cookie durations and whole Profile agendas cannot populate short factual slots',()=>{
 const values=S.readableValues({essentials:{offer:'Engineering and drawing development for industrial equipment and metal structures; custom manufacturing of conveyors, material-handling equipment and structural steel; assembly and installation.',meetingValue:'Review one planned project: drawings, delivery and constraints. Clarify the scope. Identify the stakeholders.',difference:'_ga cookie retention 2 years. Our team has more than thirty years of experience in the metalworking industry.'}},{});
 assert.equal(values.experienceDuration,'more than thirty years');assert.equal(values.experienceOwner,'team');
 assert.equal(values.meetingData,'');assert.ok((values.workPackages||'').length<=100);
 assert.doesNotMatch(values.workPackages||'',/Engineering and drawing development.*;/);
});
test('assistant rejects an oversize alternative without cutting a URL or changing the source',()=>{
 const draft={subject:'A short meeting',message:'Hi Alice, Bob here. https://example.test/a-long-url'};
 const context={channel:'email',maximumCharacters:20,seller:{sender:'Bob'},currentDraft:{...draft}};
 assert.throws(()=>W.validateWritingDraft(draft,context),/this script allows 20/);
 assert.equal(draft.message,context.currentDraft.message);
});
test('saved over-limit copies cannot become approved through the pure approval path',()=>{
 const O=require('../outreach-engine.js');
 const item={channel:'email',messageStudioDraft:{scriptContract:{maximumCharacters:8}},drafts:{},dossier:{}};
 const result=O.approveOutreachItem(item,{emailSubject:'Hello',emailBody:'A message exceeding eight characters'});
 assert.equal(result.approved,false);assert.match(result.error,/this script allows 8/);
});
test('template Undo restores its character contract with its exact draft',()=>{
 const E=require('../message-editor.js');
 const item={channel:'email',drafts:{emailSubject:'First',emailBody:'First message'},messageStudioDraft:{mode:'friendly',channelLibrarySource:'email:friendly',scriptContract:{maximumCharacters:500}}};
 const next=E.apply(item,{subject:'Second',message:'Second message'},{templateUpdate:true,origin:'manual',style:'professional'});
 next.messageStudioDraft.channelLibrarySource='email:professional';next.messageStudioDraft.scriptContract={maximumCharacters:800};
 const restored=E.undoTemplateUpdate(next);
 assert.equal(restored.drafts.emailBody,'First message');assert.equal(restored.messageStudioDraft.channelLibrarySource,'email:friendly');assert.equal(restored.messageStudioDraft.scriptContract.maximumCharacters,500);
});
