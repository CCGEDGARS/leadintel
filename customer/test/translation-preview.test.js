const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const T=require('../message-translations.js'),O=require('../outreach-engine.js');
const previewPath=require('node:path').join(__dirname,'../translation-preview.js');
const P=fs.existsSync(previewPath)?require(previewPath):{};
const scope={workspaceId:'workspace-a'};
function item(){return O.normalizeOutreachState({items:[{domain:'buyer.example',company:'Acme',selectedPersonId:'p1',channel:'email',dossier:{domain:'buyer.example',people:[{id:'p1',name:'Sam'}]},drafts:{emailSubject:'Acme',emailBody:'Hi Sam, Acme offers 30% savings.\n\nMeet Alex: https://calendly.com/alex/call\nAlex'},localizationProvenance:{language:'en',provider:'source-provider',model:'source-model'},localizationStatus:'complete',campaignScenario:{language:'en',resolvedLanguage:'en'}}]}).items[0];}
const draft={subject:'Acme',message:'Sveiki, Sam, Acme piedāvā 30% ietaupījumu.\n\nTikšanās Alex: https://calendly.com/alex/call\nAlex'};
const metadata={provider:'google-cloud-translation',model:'general/nmt',reviewProvider:'gemini',reviewModel:'review-model',editorialReview:true,protectedTerms:['Sam','Acme','Alex'],languagePack:{language:'lv',revision:4,status:'ready',sources:[{url:'https://example.org/business'}]}};
function reload(i){return O.restoreCrmScriptSnapshot(JSON.parse(JSON.stringify(O.buildCrmScriptSnapshot(i))),i.domain);}
test('preview is pure; Apply and Undo preserve originals and provider evidence through actual CRM serialization',()=>{
 assert.equal(typeof P.create,'function');const original=item(),before=JSON.stringify(original),preview=P.create(original,'lv',draft,metadata,scope);
 assert.equal(JSON.stringify(original),before);assert.deepEqual(preview.source,T.source(original));assert.equal(preview.workspaceId,scope.workspaceId);
 const applied=P.apply(original,preview,scope);assert.equal(applied.drafts.emailBody,draft.message);assert.equal(applied.approved,false);assert.equal(T.book(applied).versions.en.message,original.drafts.emailBody);
 const restored=reload(applied),version=T.book(restored).versions.lv;assert.equal(version.provider,'google-cloud-translation');assert.equal(version.model,'general/nmt');assert.equal(version.reviewProvider,'gemini');assert.deepEqual(version.languagePack,metadata.languagePack);
 assert.equal(restored.messageStudioDraft.translationUndo.before,undefined);assert.equal(restored.messageStudioDraft.translationUndo.translationUndo,undefined);
 const undone=P.undo({...restored,approved:true,approvedAt:'must-not-return'});for(const key of ['emailSubject','emailBody','emailBodyHtml','linkedinMessage','callOpener','followUp','objectionReply'])assert.equal(undone.drafts[key],original.drafts[key]);assert.equal(T.book(undone).activeLanguage,'en');assert.equal(T.book(undone).versions.lv.message,draft.message);assert.equal(undone.approved,false);assert.equal(undone.approvedAt,'');assert.equal(reload(undone).drafts.emailBody,original.drafts.emailBody);
});
test('preview rejects changed source, working text, HTML, context, active language and workspace',()=>{
 assert.equal(typeof P.create,'function');const original=item(),preview=P.create(original,'lv',draft,metadata,scope);
 const changes=[i=>i.drafts.emailBody+=' edit',i=>i.drafts.emailSubject+=' edit',i=>i.drafts.callOpener='different',i=>i.drafts.emailBodyHtml='<p>changed</p>',i=>i.selectedPersonId='p2',i=>i.domain='other.example',i=>i.company='Other',i=>i.channel='linkedin',i=>i.dossier.people[0].name='Other'];
 for(const change of changes){const edited=structuredClone(original);change(edited);assert.equal(P.isCurrent(edited,preview,scope),false);assert.throws(()=>P.apply(edited,preview,scope),/changed|stale/i);}
 assert.equal(P.isCurrent(original,preview,{workspaceId:'workspace-b'}),false);assert.throws(()=>P.apply(original,preview,{workspaceId:'workspace-b'}),/changed|stale/i);
 let translated=T.translated(original,'lv',draft);const p=P.create(translated,'de',draft,metadata,scope);translated.messageStudioDraft.languageVersions.versions.en.message+=' changed source';assert.equal(P.isCurrent(translated,p,scope),false);
});
test('Apply rechecks protected terms and rejects draft corruption without mutating the item',()=>{
 assert.equal(typeof P.create,'function');const original=item(),preview=P.create(original,'lv',draft,metadata,scope),before=JSON.stringify(original);
 preview.draft.message=preview.draft.message.replace('Sam','Other');assert.throws(()=>P.apply(original,preview,scope),/protected name/);assert.equal(JSON.stringify(original),before);
 assert.throws(()=>P.create({...original,drafts:{...original.drafts,emailBody:''}},'lv',draft,metadata,scope),/English original/);
 assert.throws(()=>P.create({...original,messageStudioDraft:null,localizationProvenance:{language:'lv'}},'de',draft,metadata,scope),/English original/);
});
test('retranslation captures manual target edits; Undo restores exact prior working version without recursive snapshots',()=>{
 assert.equal(typeof P.create,'function');let i=P.apply(item(),P.create(item(),'lv',draft,metadata,scope),scope);i.drafts.emailBody+=' Paldies.';const edited=structuredClone(i.drafts);
 const nextDraft={...draft,message:draft.message.replace('Sveiki','Labdien')};i=P.apply(i,P.create(i,'lv',nextDraft,metadata,scope),scope);
 assert.ok(T.book(i).versions.lv.history.some(v=>v.message.endsWith('Paldies.')));
 assert.equal(i.messageStudioDraft.translationUndo.translationUndo,undefined);
 i=P.undo(reload(i));for(const key of ['emailSubject','emailBody','emailBodyHtml','linkedinMessage','callOpener','followUp','objectionReply'])assert.equal(i.drafts[key],edited[key]);assert.equal(T.book(i).activeLanguage,'lv');assert.ok(T.book(i).versions.lv.history.some(v=>v.message===nextDraft.message));assert.equal(T.book(i).versions.en.message,item().drafts.emailBody);
 assert.equal(P.undo(i),i);
});
test('browser module exposes the same preview API',()=>{assert.equal(typeof P.create,'function');const vm=require('node:vm'),context={window:{LeadIntelMessageTranslations:T}};vm.runInNewContext(fs.readFileSync(previewPath,'utf8'),context);assert.equal(typeof context.window.LeadIntelTranslationPreview.apply,'function');});
test('every preview uses existing English even when another translation is active',()=>{
 const original=item();let i=T.translated(original,'lv',draft,metadata);i.drafts.emailBody+=' Paldies.';
 const preview=P.create(i,'de',draft,metadata,scope);assert.equal(preview.source.message,original.drafts.emailBody);assert.notEqual(preview.source.message,i.drafts.emailBody);
 i=P.apply(i,preview,scope);assert.ok(T.book(i).versions.lv.message.endsWith('Paldies.'));assert.equal(T.book(i).versions.de.source.message,original.drafts.emailBody);
 const english=T.activate(i,'en');english.drafts.emailBody+=' Thank you.';const edited=P.create(english,'lv',{...draft,message:draft.message+' Paldies.'},metadata,scope);assert.equal(edited.source.message,english.drafts.emailBody);
});
test('rich text validation runs again on Apply and exact formatting returns after Undo',()=>{
 const original=item();original.drafts.emailBody='Hi Sam, Acme 30';original.drafts.emailBodyHtml='<p>Hi <strong>Sam</strong>, Acme 30</p>';
 const richDraft={subject:'Acme',message:'Sveiki Sam, Acme 30',messageHtml:'<p>Sveiki <strong>Sam</strong>, Acme 30</p>'};
 const preview=P.create(original,'lv',richDraft,metadata,scope),applied=P.apply(original,preview,scope);assert.equal(applied.drafts.emailBodyHtml,richDraft.messageHtml);assert.equal(P.undo(applied).drafts.emailBodyHtml,original.drafts.emailBodyHtml);
 preview.draft.messageHtml='<p>Sveiki <strong>Other</strong>, Acme 30</p>';assert.throws(()=>P.apply(original,preview,scope),/format|HTML|match/i);
});

test('translation Undo restores only its channel fields and preserves later auxiliary script edits',()=>{const T=require('../message-translations.js'),P=require('../translation-preview.js'),before={domain:'b.test',selectedPersonId:'p1',channel:'email',drafts:{emailSubject:'Hello',emailBody:'Hello Acme',linkedinMessage:'LinkedIn original',callOpener:'Call original'},localizationProvenance:{language:'en'}},preview=P.create(before,'sv',{subject:'Hej',message:'Hej Acme'},{},{workspaceId:'w1'}),applied=P.apply(before,preview,{workspaceId:'w1'});applied.drafts.callOpener='Call edited later';applied.drafts.linkedinMessage='LinkedIn edited later';const restored=P.undo(applied);assert.equal(restored.drafts.emailBody,'Hello Acme');assert.equal(restored.drafts.callOpener,'Call edited later');assert.equal(restored.drafts.linkedinMessage,'LinkedIn edited later');assert.throws(()=>P.undo({...applied,channel:'linkedin'}),/context|channel/i);});
test('Undo cannot overwrite a newer saved English source after returning from a translation',()=>{const original=item(),applied=P.apply(original,P.create(original,'lv',draft,metadata,scope),scope),english=T.activate(applied,'en');english.drafts.emailBody+=' New English decision.';const before=JSON.stringify(english);assert.throws(()=>P.undo(english),/English.*changed/i);assert.equal(JSON.stringify(english),before);});
