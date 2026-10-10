const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const E=require('../message-editor.js'),S=require('../message-studio.js'),T=require('../message-translations.js'),O=require('../outreach-engine.js'),A=require('../approved-reference-scripts.js');
const ui=fs.readFileSync(require.resolve('../outreach-ui.js'),'utf8');
function item(name='Anna Seller',channel='email'){
 const draft={subject:name+'. SellerCo',message:'Hi Anna Buyer,\n\nI’m '+name+' from SellerCo.\n\nA manual sentence — keep EXACTLY 12.10, €500 and EXC2.\n\nhttps://example.com/Anna-Seller\n\nBest regards,\n'+name.split(' ')[0]};
 return {domain:'buyer.test',company:'BuyerCo',channel,selectedPersonId:'p1',dossier:{domain:'buyer.test',company:'BuyerCo',people:[{id:'p1',name:'Anna Buyer'}]},drafts:channel==='email'?{emailSubject:draft.subject,emailBody:draft.message}:{linkedinMessage:draft.message},messageStudioDraft:{mode:'professional',essentials:{sender:name,company:'SellerCo'},selectedSubject:draft.subject,scriptSavedAt:'yesterday',savedDraft:draft,tailoredOriginal:{key:'immutable',draft}},approved:true,approvedSource:{emailBody:draft.message}};
}
test('sender reference updates subject, introduction and first-name signature while preserving exact other text and original',()=>{
 const before=item(),original=JSON.stringify(before.messageStudioDraft.tailoredOriginal),masters=JSON.stringify(A.records);
 const next=E.synchronizeSender(before,'Mārtiņš Ozols',{buyerName:'Anna Buyer'});
 assert.equal(next.drafts.emailSubject,'Mārtiņš Ozols. SellerCo');
 assert.equal(next.drafts.emailBody,before.drafts.emailBody.replace('Anna Seller','Mārtiņš Ozols').replace(/Anna$/,'Mārtiņš'));
 assert.equal(JSON.stringify(next.messageStudioDraft.tailoredOriginal),original);assert.equal(JSON.stringify(A.records),masters);
 assert.equal(before.approved,true);assert.equal(next.approved,false);assert.equal(next.approvedSource,null);assert.equal(Boolean(next.localizationApprovalBlocked),false);assert.equal(E.savedDraft(next),false);
 assert.equal(E.synchronizeSender(next,'Mārtiņš Ozols',{buyerName:'Anna Buyer'}),next);
});
test('legacy diacritics match the recorded sender without changing URLs, greeting, or words containing the old name',()=>{
 const before=item('Edgars Untals');before.drafts.emailSubject='Edgars Untāls. SellerCo';before.drafts.emailBody="Hi Edgars Buyer,\n\nI'm Edgars Untāls from SellerCo.\n\nUntalson is a project name. https://example.com/EdgarsUntals\n\nBest regards,\nEdgars";
 const next=E.synchronizeSender(before,'Anna Seller',{buyerName:'Edgars Buyer'});
 assert.equal(next.drafts.emailSubject,'Anna Seller. SellerCo');assert.match(next.drafts.emailBody,/Hi Edgars Buyer/);assert.match(next.drafts.emailBody,/I'm Anna Seller/);assert.match(next.drafts.emailBody,/Untalson is a project name\. https:\/\/example.com\/EdgarsUntals/);assert.match(next.drafts.emailBody,/Best regards,\nAnna$/);
});
test('translated copies, source stamps and archived versions update together; history text remains recoverable through CRM',()=>{
 let before=T.generated(item(),E.workingDraft(item()));before=T.translated(before,'lv',{subject:'Anna Seller. SellerCo',message:before.drafts.emailBody.replace('I’m','Esmu').replace('Best regards','Ar cieņu')});before=T.translated(before,'lv',{subject:'Anna Seller. SellerCo',message:before.drafts.emailBody});
 const history=before.messageStudioDraft.languageVersions.versions.lv.history[0].message;
 let next=E.synchronizeSender(before,'Mārtiņš Ozols',{buyerName:'Anna Buyer'});
 for(const code of ['en','lv'])assert.match(next.messageStudioDraft.languageVersions.versions[code].message,/Mārtiņš Ozols/);
 assert.equal(next.messageStudioDraft.languageVersions.versions.lv.history[0].message,history);assert.equal(T.stale(next,'lv'),false);
 next=O.restoreCrmScriptSnapshot(O.buildCrmScriptSnapshot(next),next.domain);assert.equal(next.messageStudioDraft.senderReference.name,'Mārtiņš Ozols');assert.match(next.drafts.emailBody,/Mārtiņš Ozols/);
 next=T.restorePrevious(next,'lv',0);next=E.synchronizeSender(next,'Mārtiņš Ozols',{buyerName:'Anna Buyer'});assert.match(next.drafts.emailBody,/Mārtiņš Ozols/);
});
test('LinkedIn and AI disclosure names update without altering channel content or recipient',()=>{
 const before=item('Anna Seller','linkedin');const next=E.synchronizeSender(before,'Jānis Bērziņš',{buyerName:'Anna Buyer'});assert.match(next.drafts.linkedinMessage,/I’m Jānis Bērziņš/);assert.equal(next.drafts.emailSubject,undefined);
 const ai=item();ai.drafts.emailSubject='LeadIntel. On behalf of Anna';ai.drafts.emailBody='Hi Anna Buyer,\n\nAnna Seller at SellerCo asked me.\n\nA conversation with Anna Seller.\n\nAnna Seller will be there.\n\nLeadIntel. On behalf of Anna Seller.';
 const updated=E.synchronizeSender(ai,'Jānis Bērziņš',{buyerName:'Anna Buyer'});assert.equal(updated.drafts.emailSubject,'LeadIntel. On behalf of Jānis');assert.match(updated.drafts.emailBody,/Jānis Bērziņš will be there/);assert.match(updated.drafts.emailBody,/Hi Anna Buyer/);
});
test('extended and repeatedly changed names do not grow on rerender; clearing blocks an old identity',()=>{
 const before=item();let next=E.synchronizeSender(before,'Anna Seller Junior');assert.equal(E.synchronizeSender(next,'Anna Seller Junior'),next);
 next=E.synchronizeSender(next,'Anna Seller');assert.equal(next.drafts.emailSubject,'Anna Seller. SellerCo');assert.equal(E.synchronizeSender(next,'Anna Seller'),next);
 next=E.synchronizeSender(next,'');assert.equal(next.drafts.emailSubject,'[Add sender name]. SellerCo');assert.equal(next.messageStudioDraft.essentials.sender,'');assert.equal(next.approved,false);
 next.drafts.emailBody='✨ '+next.drafts.emailBody;next=E.synchronizeSender(next,'Jānis Bērziņš');assert.equal(next.drafts.emailSubject,'Jānis Bērziņš. SellerCo');assert.match(next.drafts.emailBody,/I’m Jānis Bērziņš/);
});
test('sent history and another workspace item are not mutated',()=>{
 const sent={...item(),contactedAt:'yesterday'},other=item('Other Sender');assert.equal(E.synchronizeSender(sent,'Changed Sender'),sent);const copy=JSON.stringify(other);E.synchronizeSender(item(),'Changed Sender');assert.equal(JSON.stringify(other),copy);
});
test('actual sender event consumes the latest manual draft, cancels generation and does not launch AI',()=>{
 let current=item(),listener;const fields={'outreach-email-subject':{value:current.drafts.emailSubject},'outreach-email-body':{value:current.drafts.emailBody+'\n\nManual unsaved addition.'}};
 const ctx={window:{addEventListener:(name,fn)=>{listener=fn}},readDraftEdits:()=>({...current,drafts:{...current.drafts,emailBody:fields['outreach-email-body'].value}}),cancelPendingScriptGeneration:()=>{ctx.cancelled=true},currentItem:()=>current,messageWorkspaceUsable:()=>true,mainState:()=>({senderIdentityVersion:1,brandIdentity:{senderName:'Mārtiņš Ozols'}}),LeadIntelMessageEditor:E,LeadIntelOutreach:O,selectedContact:()=>({name:'Anna Buyer'}),upsertItem:v=>current=v,q:id=>fields[id],persistStudio:()=>{},studioState:()=>S.normalize({}),renderMessageStudio:()=>{},invalidateStudioDraft:()=>{throw Error('must not regenerate')},automaticallyPrepareMessage:()=>{throw Error('must not spend AI credits')},readStudio:()=>{throw Error('must not use stale fields')}};
 vm.createContext(ctx);vm.runInContext(ui.slice(ui.indexOf('function synchronizeMessageSender('),ui.indexOf('function repairLegacyEmailIdentity(')),ctx);vm.runInContext(ui.split('\n').find(l=>l.includes("window.addEventListener('leadintel:sender-identity-changed'")),ctx);
 listener({detail:{senderChanged:true,previousSender:'Anna Seller'}});assert.equal(ctx.cancelled,true);assert.equal(fields['outreach-email-subject'].value,'Mārtiņš Ozols. SellerCo');assert.match(fields['outreach-email-body'].value,/Manual unsaved addition/);
 const updated=fields['outreach-email-body'].value;listener({detail:{senderChanged:false,messageFieldsChanged:false,previousSender:'Mārtiņš Ozols'}});assert.equal(fields['outreach-email-body'].value,updated);
});
test('actual identity setter distinguishes name edits from Save-ready and branding-only changes',()=>{
 const source=fs.readFileSync(require.resolve('../app.js'),'utf8'),body=source.match(/setIdentity:\(identity, detail=\{\}\)=>\{([\s\S]*?)\n    \}/)[1],state={brandIdentity:{senderName:'Anna Seller',companyDisplayName:'SellerCo',status:'draft'}},events=[];
 const setter=new Function('state','globalThis','saveState','window','CustomEvent','identity','detail',body),invoke=identity=>setter(state,{LeadIntelBrandIdentity:{normalize:v=>v}},()=>{},{dispatchEvent:e=>events.push(e)},class{constructor(type,options){this.detail=options.detail;}},identity,{});
 invoke({...state.brandIdentity,senderName:'Mārtiņš Ozols'});assert.equal(events[0].detail.senderChanged,true);assert.equal(events[0].detail.messageFieldsChanged,true);
 invoke({...state.brandIdentity,status:'ready',revision:2});assert.equal(events[1].detail.senderChanged,false);assert.equal(events[1].detail.messageFieldsChanged,false);
 invoke({...state.brandIdentity,phone:'+123'});assert.equal(events[2].detail.messageFieldsChanged,false);
 invoke({...state.brandIdentity,companyDisplayName:'NewCo'});assert.equal(events[3].detail.messageFieldsChanged,true);
});
test('actual studio read cannot override the reference identity with obsolete hidden sender fields',()=>{
 const ctx={studioState:()=>S.normalize({essentials:{sender:'Current Sender',senderRole:'Partner',company:'CurrentCo'}}),mainState:()=>({senderIdentityVersion:1}),q:id=>({value:id==='message-mode'?'professional':'Old hidden value'}),currentItem:()=>({channel:'email'}),LeadIntelMessageStudio:S,globalThis:{LeadIntelMessageTranslations:T}};
 vm.createContext(ctx);vm.runInContext(ui.split('\n').find(l=>l.startsWith('function readStudio()')),ctx);const studio=ctx.readStudio();assert.equal(studio.essentials.sender,'Current Sender');assert.equal(studio.essentials.company,'CurrentCo');assert.equal(studio.essentials.senderRole,'Partner');
});
