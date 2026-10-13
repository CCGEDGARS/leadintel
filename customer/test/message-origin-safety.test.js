const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function read(state,body='Canonical text'){
 const item={channel:'email',drafts:{tone:'consultative',emailSubject:'Subject',emailBody:'Canonical text',linkedinMessage:'',callOpener:'',followUp:'',objectionReply:''},messageStudioDraft:{editorOrigin:'tailored'}};
 const fields={'outreach-tone':'consultative','outreach-email-subject':'Subject','outreach-email-body':body,'outreach-linkedin':'','outreach-call-opener':'','outreach-follow-up':'','outreach-objection-reply':''};
 const context={currentItem:()=>item,q:id=>({value:fields[id]}),messageEditor:{state:()=>state}};vm.createContext(context);
 const source=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8'),start=source.indexOf('function readDraftEdits()');vm.runInContext(source.slice(start,source.indexOf('\n',start)),context);return context.readDraftEdits();
}
test('system busy, saving and previews cannot manufacture manual draft provenance',()=>{for(const state of [{busy:true},{saving:true},{preview:{}},{editing:true}])assert.equal(read(state).messageStudioDraft.editorOrigin,'tailored');});
test('actual typed changes in Edit retain manual provenance',()=>{assert.equal(read({editing:true},'My typed text').messageStudioDraft.editorOrigin,'manual');});
