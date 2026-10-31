const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
const T=require('../message-translations.js'),P=require('../translation-preview.js'),O=require('../outreach-engine.js');
const scope={workspaceId:'workspace-a'};
function item(){return {domain:'buyer.example',company:'Buyer',selectedPersonId:'p1',channel:'email',dossier:{domain:'buyer.example',people:[{id:'p1',name:'Sam Reed',title:'Director',organization:'Buyer',publicLinkedinUrl:'https://linkedin.com/in/sam-reed'}]},drafts:{emailSubject:'Buyer',emailBody:'Hello Sam Reed',emailBodyHtml:'<p>Hello <strong>Sam Reed</strong></p>'},localizationProvenance:{language:'en'}};}
const draft={subject:'Buyer',message:'Labdien Sam Reed',messageHtml:'<p>Labdien <strong>Sam Reed</strong></p>'};
test('translation cannot drop a populated subject or invent one for an empty source',()=>{
 for(const [source,translated] of [['A conversation',''],['A conversation','   '],['','An invented offer']]){
  const original=item();original.drafts.emailSubject=source;const before=JSON.stringify(original);
  assert.throws(()=>P.create(original,'lv',{...draft,subject:translated},{},scope),/subject|complete/i);assert.equal(JSON.stringify(original),before);
 }
 const original=item();original.drafts.emailSubject='';assert.doesNotThrow(()=>P.create(original,'lv',{...draft,subject:''},{},scope));
});
test('translation preview cannot apply after its template authority changes with identical English text',()=>{
 const before=item();before.messageStudioDraft={mode:'friendly',personalStyleRevision:2,triggerSourceUrl:'https://buyer.example/project',essentials:{company:'Seller'}};
 const preview=P.create(before,'lv',draft,{},scope);
 for(const mutate of [i=>i.messageStudioDraft.mode='professional',i=>i.messageStudioDraft.personalStyleRevision=3,i=>i.messageStudioDraft.triggerSourceUrl='https://buyer.example/other',i=>i.messageStudioDraft.essentials.company='Other Seller']){
  const changed=structuredClone(before);mutate(changed);assert.equal(P.isCurrent(changed,preview,scope),false);assert.throws(()=>P.apply(changed,preview,scope),/stale|changed/i);
 }
});
test('English formatting changes invalidate translated versions through CRM reopen',()=>{
 let current=P.apply(item(),P.create(item(),'lv',draft,{},scope),scope);
 current=T.activate(current,'en');current.drafts.emailBodyHtml='<p>Hello <em>Sam Reed</em></p>';current=T.capture(current);
 assert.equal(T.stale(current,'lv'),true);
 const restored=O.restoreCrmScriptSnapshot(JSON.parse(JSON.stringify(O.buildCrmScriptSnapshot(current))),current.domain);
 assert.equal(T.stale(restored,'lv'),true);assert.equal(T.book(restored).versions.lv.messageHtml,draft.messageHtml);
});
test('translation Undo rejects changed same-ID recipient identities and workspace after CRM reopen',()=>{
 const applied=P.apply(item(),P.create(item(),'lv',draft,{},scope),scope);
 const restored=O.restoreCrmScriptSnapshot(JSON.parse(JSON.stringify(O.buildCrmScriptSnapshot(applied))),applied.domain);
 for(const mutate of [i=>i.company='Other Buyer',i=>i.dossier.people[0].name='Other Reed',i=>i.dossier.people[0].title='New role',i=>i.dossier.people[0].organization='Other Buyer',i=>i.dossier.people[0].publicLinkedinUrl='https://linkedin.com/in/other',i=>i.dossier.people[0].work_email='other@buyer.example',i=>i.dossier.people[0].normalized_email='other@buyer.example',i=>i.dossier.people[0].linkedinConfirmedUrl='https://linkedin.com/in/other',i=>i.dossier.people[0].company_id='other-company']){
  const changed=structuredClone(restored);mutate(changed);const before=JSON.stringify(changed);assert.throws(()=>P.undo(changed,scope),/context|recipient/i);assert.equal(JSON.stringify(changed),before);
 }
 assert.throws(()=>P.undo(restored,{workspaceId:'workspace-b'}),/workspace|context/i);
 assert.equal(P.undo(restored,scope).drafts.emailBody,item().drafts.emailBody);
 const unbound=structuredClone(restored);delete unbound.messageStudioDraft.translationUndo.context.owner;const preserved=JSON.stringify(unbound);
 assert.throws(()=>P.undo(unbound,scope),/context|recipient/i);assert.equal(JSON.stringify(unbound),preserved);
});
test('manual translation target does not masquerade as a market shortcut over the saved default',()=>{
 const w=new JSDOM('<div class="mw-generate-bar"><label>Language<select id="message-language"></select></label></div>',{runScripts:'outside-only'}).window;
 try{w.LeadIntelMessageTranslations=T;w.LeadIntelLanguagePackCatalogue={languages:T.languages};w.eval(fs.readFileSync(require.resolve('../language-pack-ui.js'),'utf8'));w.eval(fs.readFileSync(require.resolve('../message-translation-ui.js'),'utf8'));
  const calls=[];w.LeadIntelMessageTranslationUI.mount(w.document,{translate:code=>calls.push(code)});
  for(const defaultLanguage of ['en','kk']){
   let prefs=T.changeSettings(T.settings({},item()),'add','kk',item());prefs=T.changeSettings(prefs,'default',defaultLanguage,item());prefs=T.changeSettings(prefs,'add','ru',item());
   const countrySuggestion=w.LeadIntelLanguagePacks.suggestion({...item(),country:'Kazakhstan'},[],prefs);assert.equal(countrySuggestion.source,'manual');assert.equal(countrySuggestion.language,'ru');
   w.LeadIntelMessageTranslationUI.render(w.document,item(),{usable:true,languageSettings:prefs,countrySuggestion});
   const quick=w.document.querySelector('.mw-language-quick');assert.equal(quick.hidden,defaultLanguage==='en');
   const translate=w.document.getElementById('message-translate');assert.equal(translate.dataset.language,defaultLanguage==='en'?'ru':'kk');
   if(defaultLanguage==='kk'){translate.click();assert.equal(calls.pop(),'kk');}
  }
 }finally{w.close();}
});
