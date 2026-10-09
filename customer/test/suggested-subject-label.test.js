const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('all core styles use the agreed Suggested subjects chooser label',()=>{
 const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
 assert.match(source,/<span id="message-subject-choice-title">Suggested subjects<\/span>/);
 assert.match(source,/q\('message-subject-choice-title'\)\.textContent=[^;]*'Suggested subjects';/);
 assert.doesNotMatch(source,/Approved (Professional|NLP|Friendly|Brutal Honesty) subjects/);
 assert.doesNotMatch(source,/Choose a suggested subject|Custom subject · editable below/);
});

test('each approved dropdown keeps five approved options and visibly labels a custom working subject',()=>{
 const {JSDOM}=require('jsdom'),S=require('../message-studio.js');
 const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8'),start=source.indexOf('const subjectOptions=linkedin||item?.messageStudioDraft?.eventSnapshot?[]:');
 const block=source.slice(start,source.indexOf("q('message-pitch-preview').textContent",start));
 const render=new Function('q','studio','item','candidate','LeadIntelMessageStudio','workingSuggestedSubject','esc','linkedin',block);
 for(const mode of ['professional','curiosity','friendly','brutal']){
  const document=new JSDOM('<div id="message-approved-subjects"></div><pre id="message-approved-subjects-copy"></pre><label id="message-subject-choice-label"><span id="message-subject-choice-title"></span><select id="message-subject-choice"></select></label>').window.document;
  const q=id=>document.getElementById(id),studio=S.normalize({mode}),item={drafts:{emailSubject:'My manual subject'}};
  const resolve=s=>S.subjectsFor(mode).find(t=>t.id===s.subjectChoices[mode])?.pattern||'Default subject';
  render(q,studio,item,{},S,resolve,s=>s,false);
  assert.deepEqual([...q('message-subject-choice').options].map(o=>o.value),['custom',...S.subjectsFor(mode).map(o=>o.id)]);
  assert.equal(q('message-subject-choice').options.length,6);
  assert.equal(q('message-subject-choice').value,'custom');
  assert.equal(item.drafts.emailSubject,'My manual subject');
  studio.subjectChoices[mode]=S.subjectsFor(mode)[0].id;item.drafts.emailSubject=resolve(studio);
  render(q,studio,item,{},S,resolve,s=>s,false);
  assert.equal(q('message-subject-choice').value,studio.subjectChoices[mode]);
  studio.subjectChoices[mode]='';item.drafts.emailSubject='Default subject';
  render(q,studio,item,{},S,resolve,s=>s,false);
  assert.equal(q('message-subject-choice').value,'custom','a matching fallback subject without an explicit choice must stay visible');
  assert.equal(item.drafts.emailSubject,'Default subject');
 }
});
