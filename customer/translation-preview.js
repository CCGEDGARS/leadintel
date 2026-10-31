(function(root){
 'use strict';
 const translations=()=>typeof module==='object'&&module.exports?require('./message-translations.js'):root.LeadIntelMessageTranslations;
 const clone=value=>JSON.parse(JSON.stringify(value));
 // Stable strings compare all working drafts, including rich text and non-active channels.
 function stamp(value){if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(stamp).join(',')+']';return '{'+Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>JSON.stringify(key)+':'+stamp(value[key])).join(',')+'}';}
 function identity(item){const person=item.dossier?.people?.find(p=>p.id===item.selectedPersonId);return {domain:item.domain,company:item.company,channel:item.channel,selectedPersonId:item.selectedPersonId,person:person||null,dossierDomain:item.dossier?.domain,workspaceId:item.workspaceId||item.workspace_id||'',authority:undoContext(item),essentials:item.messageStudioDraft?.essentials||null,personalStyleSnapshot:item.messageStudioDraft?.personalStyleSnapshot||null,drafts:item.drafts||{},languageVersions:translations().book(translations().capture(item))};}
 // IDs can be reused. Undo must retain the actual recipient and template authority,
 // including all supplied identity aliases, while preserving other channel text.
 function undoContext(item){return {domain:item.domain,company:item.company,channel:item.channel,selectedPersonId:item.selectedPersonId,dossierDomain:item.dossier?.domain,workspaceId:item.workspaceId||item.workspace_id||'',people:(item.dossier?.people||[]).filter(p=>p.id===item.selectedPersonId),recipientIdentity:item.messageStudioDraft?.recipientIdentity||null,mode:item.messageStudioDraft?.mode||'',personalStyleRevision:item.messageStudioDraft?.personalStyleRevision||null,eventSnapshot:item.messageStudioDraft?.eventSnapshot||null,triggerSourceUrl:item.messageStudioDraft?.triggerSourceUrl||''};}
 function create(item,language,draft,metadata={},scope={}){
  const T=translations(),before=T.capture(clone(item)),source=T.source(before);
  if(language==='en'||!T.languages[language])throw Error('Choose a target language');
  const details=clone({...metadata,protectedTerms:[...new Set([...(metadata.protectedTerms||[]),...T.protectedTerms(item)])]});
  const checked=T.validate(source,draft,{channel:item.channel,protectedTerms:details.protectedTerms});
  return {language,draft:clone(checked),metadata:details,source:clone(source),sourceStamp:stamp(source),itemStamp:stamp(identity(item)),workspaceId:String(scope.workspaceId||''),before};
 }
 function isCurrent(item,preview,scope={}){
  if(!preview||preview.workspaceId!==String(scope.workspaceId||''))return false;
  try{return preview.itemStamp===stamp(identity(item))&&preview.sourceStamp===stamp(translations().source(translations().capture(item)));}catch{return false;}
 }
 function unapprove(item){return {...item,approved:false,approvedAt:'',approvedEventSnapshot:null,approvedSource:null,approvedEmail:null,brandSnapshot:null,campaignSnapshot:null,localizationSnapshot:null,contactedAt:'',reapprovalRequired:false};}
 function apply(item,preview,scope={}){
  if(!isCurrent(item,preview,scope))throw Error('Translation preview is stale: the message or context changed. Translate again.');
  const T=translations(),before=T.capture(item),source=T.source(before);
  const draft=T.validate(source,preview.draft,{channel:item.channel,protectedTerms:preview.metadata?.protectedTerms||[]});
  // Keep a bounded undo state; neither the whole item nor earlier undo records are nested.
  const translationUndo=clone({context:{domain:before.domain,selectedPersonId:before.selectedPersonId,channel:before.channel,owner:stamp(undoContext(before)),workspaceId:String(scope.workspaceId||'')},drafts:before.drafts,languageVersions:T.book(before),localizationProvenance:before.localizationProvenance||null,campaignScenario:before.campaignScenario||null});
  const next=T.translated(before,preview.language,draft,preview.metadata);
  return unapprove({...next,messageStudioDraft:{...next.messageStudioDraft,translationUndo}});
 }
 function historyEntry(version){const {history,...entry}=version;return clone(entry);}
 function undo(item,scope={}){
  const saved=item.messageStudioDraft?.translationUndo;if(!saved)return item;if(!saved.context?.owner||saved.context.owner!==stamp(undoContext(item))||Object.hasOwn(scope,'workspaceId')&&saved.context.workspaceId!==String(scope.workspaceId||''))throw Error('Translation Undo belongs to a different recipient, workspace, template context or channel. Your current draft is preserved.');
  const T=translations(),current=T.capture(item),book=T.book(current),prior=clone(saved.languageVersions);
  const savedEnglish=prior.versions?.en,currentEnglish=T.source(current);if(!savedEnglish||stamp(currentEnglish)!==stamp({subject:savedEnglish.subject||'',message:savedEnglish.message,...(savedEnglish.messageHtml?{messageHtml:savedEnglish.messageHtml}:{})}))throw Error('English source changed after translation. Undo is unavailable; your newer English is preserved.');
  // Preserve every applied/edited version while restoring the exact earlier working text.
  for(const [language,version] of Object.entries(book.versions)){
   if(!prior.versions[language])prior.versions[language]=version;
   else if(stamp(version)!==stamp(prior.versions[language]))prior.versions[language]={...prior.versions[language],history:[...(version.history||[]),historyEntry(version)]};
  }
  const messageStudioDraft={...current.messageStudioDraft,languageVersions:prior};delete messageStudioDraft.translationUndo;
  const drafts={...current.drafts};for(const key of item.channel==='linkedin'?['linkedinMessage']:['emailSubject','emailBody','emailBodyHtml']){if(Object.hasOwn(saved.drafts,key))drafts[key]=clone(saved.drafts[key]);else delete drafts[key];}
  return unapprove({...current,drafts,localizationProvenance:clone(saved.localizationProvenance),campaignScenario:clone(saved.campaignScenario),messageStudioDraft});
 }
 const api={create,isCurrent,apply,undo};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelTranslationPreview=api;
})(typeof window==='object'?window:globalThis);
