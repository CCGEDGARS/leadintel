const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const S=require('../message-studio.js'),A=require('../approved-reference-scripts.js'),T=require('../message-translations.js');
const exact=['Steel and installation for Malmberget','Edgars Untals. Ercon','Room for one more steel supplier?','Malmberget steel – who should I ask?','Malmberget: EXC2 or EXC3?'];
const e={sender:'Edgars Untals',company:'Ercon',offer:'steel manufacturing and installation',language:'en'};
const context={buyerCompany:'LKAB',trigger:{summary:'LKAB is investing in a new sorting plant at Malmberget mine.',verification:'source_verified',url:'https://buyer.test/update'}};
const resolve=(id,ctx=context,essentials=e)=>S.resolvedSubject(S.chooseSubject(S.normalize({mode:'professional'},essentials),'professional',id),{...ctx,strictSubjectChoice:true},essentials);
test('user-confirmed five subjects are exact, ordered and shared by reference and working chooser',()=>{
 assert.deepEqual(S.professionalSubjects.map(t=>t.original),exact);assert.deepEqual(A.records.professional.subjects,exact);
 assert.deepEqual(S.professionalSubjects.map(t=>resolve(t.id)),exact);
 assert.equal(S.approvedSubjectsText('professional'),exact.map((t,i)=>(i+1)+'. '+t).join('\n'));
});
test('NLP, Friendly and Brutal subjects match their recorded approval sets',()=>{
 const expected={curiosity:['{{projectMilestone}}: {{deliveryAngle}}','Keep what works. Compare what’s possible.','{{senderFullName}}. {{senderCompany}}','If everything is on track, why talk?','{{projectMilestone}}: another success story?'],friendly:['A friendly hello about {{verifiedProject}}','{{senderCompany}}. A long-term partnership?','{{senderFullName}}. {{senderCompany}}','What could we build together?','Congratulations on {{verifiedMilestone}}'],brutal:['{{verifiedProject}}. On behalf of {{senderName}}','{{senderName}} will join the call.','{{recipientCompany}} — fit: {{fitScore}}/100','{{verifiedProject}}','{{senderFullName}}. {{senderCompany}}']};
 for(const [mode,patterns] of Object.entries(expected))assert.deepEqual(S.subjectsFor(mode).map(t=>t.pattern),patterns);
});
test('approved subject wording localizes in every supported language and never imports research prose',()=>{
 for(const subjectLanguage of Object.keys(T.languages))for(const t of S.professionalSubjects){const subject=resolve(t.id,{...context,subjectLanguage});assert.ok(S.validSubject(subject),subjectLanguage+'/'+t.id);assert.doesNotMatch(subject,/investing|mine\.|\{\{|error|undefined/i);}
 assert.equal(resolve('relevance',{...context,subjectLanguage:'sv'}),'Stål och installation för Malmberget');
 assert.equal(resolve('benefit',{...context,subjectLanguage:'lv'}),'Malmberget: EXC2 vai EXC3?');
});
test('unreviewed evidence, unrelated sellers and missing facts never inherit steel or previous project details',()=>{
 for(const id of ['relevance','development','benefit'])assert.equal(resolve(id,{...context,trigger:{...context.trigger,verification:'unreviewed'}}),null);
 const legal={...e,sender:'Robin Lane',company:'LawCo',offer:'Contract review'};
 for(const id of ['development','benefit'])assert.equal(resolve(id,context,legal),null);
 assert.equal(resolve('relevance',{trigger:{title:'Project Alpha',verification:'user_reviewed'}},legal),'Contract review for Project Alpha');
 assert.equal(resolve('introduction',{},legal),'Robin Lane. LawCo');
 assert.doesNotMatch(resolve('relevance',{trigger:{title:'Project Alpha',verification:'user_reviewed'}},legal),/Ercon|Malmberget|steel/i);
});
test('chooser never reveals placeholders when evidence is missing and keeps manual subject/body on reload',()=>{
 const {JSDOM}=require('jsdom'),source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8'),start=source.indexOf('const subjectOptions=linkedin||item?.messageStudioDraft?.eventSnapshot?[]:');
 const render=new Function('q','studio','item','candidate','LeadIntelMessageStudio','workingSuggestedSubject','esc','linkedin',source.slice(start,source.indexOf("q('message-pitch-preview').textContent",start)));
 const dom=new JSDOM('<div id="message-approved-subjects"></div><pre id="message-approved-subjects-copy"></pre><label id="message-subject-choice-label"><span id="message-subject-choice-title"></span><select id="message-subject-choice"></select></label>'),q=id=>dom.window.document.getElementById(id);
 const item=JSON.parse(JSON.stringify({drafts:{emailSubject:'My exact manual subject',emailBody:'My exact manual body'}})),studio=S.normalize({mode:'professional'},e);
 const missing=(s,i,c,strict)=>S.resolvedSubject(s,{strictSubjectChoice:strict},e);
 render(q,studio,item,{},S,missing,v=>String(v),false);assert.equal(q('message-subject-choice').options.length,5);assert.doesNotMatch(q('message-subject-choice').textContent,/\{\{|\}\}/);
 assert.equal(item.drafts.emailSubject,'My exact manual subject');assert.equal(item.drafts.emailBody,'My exact manual body');assert.equal(q('message-subject-choice').selectedIndex,-1);dom.window.close();
});

test('real selector context resolves project with an article and uses approved full seller answers',()=>{
 const ctx={...context,trigger:{...context.trigger,summary:'LKAB is investing six billion in a new sorting plant at the Malmberget mine to secure stable, efficient production.'},sellerAnswers:{priority_offers:'Steel structures, equipment manufacturing and installation'},sellerAnswerStatus:{priority_offers:'accepted'}};
 const compact={...e,offer:'Integrated manufacturing services'};
 assert.deepEqual(S.professionalSubjects.map(t=>resolve(t.id,ctx,compact)),exact);
 for(const status of ['draft','evidence_draft','hypothesis_draft','missing']){
  const unapproved={...ctx,sellerAnswerStatus:{priority_offers:status}};
  assert.equal(resolve('curiosity',unapproved,compact),null);
  assert.equal(resolve('benefit',unapproved,compact),null);
 }
 const other={...ctx,trigger:{...ctx.trigger,summary:'Buyer is investing in a new sorting plant at the Northport mine.'}};
 assert.equal(resolve('development',other,compact),'Northport steel – who should I ask?');
 assert.equal(resolve('development',{...ctx,trigger:{...ctx.trigger,verification:'unreviewed'}},compact),null);
});
