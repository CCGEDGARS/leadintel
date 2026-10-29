const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const Editor=require('../message-editor.js');
const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8'),helper=source.slice(source.indexOf('function isAssistantDraftSaved('),source.indexOf('function setAssistantDraftLength('));
test('actual save detection requires confirmed exact text, HTML and source provenance',()=>{
 const draft={subject:'Subject',message:'Hi Alex',messageHtml:'<p>Hi <strong>Alex</strong></p>'},assistant={workspaceId:'w',referenceRevision:2};
 const item={messageStudioDraft:{scriptSavedAt:'2026-10-29T18:00:00Z',savedDraft:draft,writingAssistant:assistant}};
 const saved=new Function('currentItem','LeadIntelMessageEditor','globalThis',"const writingContextMode='customer';"+helper+';return isAssistantDraftSaved;')(()=>item,Editor,{});
 assert.equal(saved(draft,'friendly',assistant),true);
 assert.equal(saved({...draft,message:'Hi Ben'},'friendly',assistant),false);
 assert.equal(saved({...draft,messageHtml:'<p>Hi Alex</p>'},'friendly',assistant),false);
 assert.equal(saved(draft,'friendly',null),false);
 item.messageStudioDraft.savePending=true;assert.equal(saved(draft,'friendly',assistant),false);
});
test('general save detection cannot reuse a template or another workspace record',()=>{
 const draft={subject:'General',message:'Independent writing'},record={...draft,scope:'w:u:general',kind:'draft'};
 const saved=new Function('generalWritingRecord','writingScopeIdentity',"const writingContextMode='general';"+helper+';return isAssistantDraftSaved;')(record,()=> 'w:u:general');
 assert.equal(saved(draft,'original',null),true);record.kind='template';assert.equal(saved(draft,'original',null),false);record.kind='draft';record.scope='other:u:general';assert.equal(saved(draft,'original',null),false);
});
