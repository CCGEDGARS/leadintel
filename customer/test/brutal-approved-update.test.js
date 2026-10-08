const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),M=require('../message-studio.js');
const e={sender:'Alex Lane',company:'LegalCo',calendly:'https://calendly.com/alex/30min'};
test('English original UI renders the exact approved original read-only',()=>{
 const {JSDOM}=require('jsdom'),vm=require('node:vm');
 const dom=new JSDOM('<div id="message-template-editor"></div>',{runScripts:'outside-only'}),w=dom.window;
 w.LeadIntelMessageStudio=M;w.LeadIntelOriginalScripts=require('../original-scripts.js');w.LeadIntelMessageTranslations={languages:{en:['English','English'],lv:['Latvian','Latvian']}};
 vm.runInContext(fs.readFileSync(require.resolve('../original-scripts-ui.js'),'utf8'),dom.getInternalVMContext());
 w.LeadIntelOriginalScriptsUI.mount(w.document,{render(){},save(){},unlock(){},restore(){},retry(){}});
 w.document.getElementById('original-script-language').value='en';
 w.LeadIntelOriginalScriptsUI.render(w.document,{studio:M.normalize({mode:'brutal'},e),channel:'email',style:'brutal',role:'owner'});
 const body=w.document.getElementById('original-script-body');assert.equal(body.value,M.originalText('brutal'));assert.equal(body.readOnly,true);assert.equal(w.document.getElementById('original-script-save').hidden,true);assert.equal(w.document.getElementById('original-script-unlock').hidden,true);dom.window.close();
});
test('protected Brutal original exactly preserves the supplied script, separate from reusable generation',()=>{
 const exact=fs.readFileSync(require.resolve('../../docs/templates/brutal-honesty-approved-2026-10-08.txt'),'utf8').trimEnd();
 assert.equal(M.originalText('brutal','email'),exact);
 const s=M.normalize({mode:'brutal'},e),t=s.templates.find(t=>t.id==='brutal');
 assert.equal(t.subject,'LeadIntel. On behalf of {{sender}}');assert.match(t.body,/\{\{senderLinkedInUrl\}\}/);
 assert.doesNotMatch(t.body,/No slides|no pressure|ERCON|Joakim|Malmberget|30 years/);
 const p=M.prompt(s,{buyerCompany:'ClientCo',senderLinkedInUrl:'https://www.linkedin.com/in/alex-lane/'});
 assert.doesNotMatch(p.prompt,/ERCON|Joakim|Malmberget/);assert.match(p.system,/relevant data and lessons/);assert.doesNotMatch(p.system,/No slides, no pressure are user-approved/);
 assert.equal(JSON.parse(p.prompt).authoritativeSubject,'LeadIntel. On behalf of Alex Lane');
});
test('sender LinkedIn profile is supplied from current context and arbitrary links stay blocked',()=>{
 const url='https://www.linkedin.com/in/alex-lane/',s=M.normalize({mode:'brutal'},e);
 const draft={subject:'LeadIntel. On behalf of Alex Lane',message:'30-minute Zoom '+e.calendly+' '+url};
 assert.equal(M.parse(JSON.stringify(draft),e,{studio:s,context:{senderLinkedInUrl:url}}).message,draft.message);
 for(const unsafe of ['https://linkedin.com.evil.test/in/alex/','javascript:alert(1)','https://www.linkedin.com/in/someone-else/'])assert.throws(()=>M.parse(JSON.stringify({...draft,message:'30-minute Zoom '+e.calendly+' '+unsafe}),e,{studio:s,context:{senderLinkedInUrl:url}}));
 assert.equal(JSON.parse(M.prompt(s,{senderLinkedInUrl:'https://evil.test/in/alex/'}).prompt).context.senderLinkedInUrl,'');
});
