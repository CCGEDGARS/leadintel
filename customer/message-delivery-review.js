(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.LeadIntelDeliveryReview=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const snapshot=(item,draft,context)=>({version:1,workspaceId:context.workspaceId||'',userId:context.userId||'',domain:context.domain||'',personId:String(context.personId||''),contextKey:context.contextKey||'',subject:draft.subject||'',message:draft.message||'',messageHtml:draft.messageHtml||''});
 function belongs(item,context){return item?.channel==='email'&&Boolean(context.workspaceId&&context.userId&&context.contextKey&&context.domain&&context.personId)&&item.domain===context.domain&&String(item.selectedPersonId)===String(context.personId);}
 function sourceMatches(item,context){
  const prior=item.messageStudioDraft?.deliveryReview;if(prior&&(prior.workspaceId!==context.workspaceId||prior.domain!==context.domain||prior.personId!==String(context.personId)))return false;
  let original;try{original=JSON.parse(item.messageStudioDraft?.tailoredOriginal?.key||'null');}catch{}
  return !Array.isArray(original)||original.length<4||(original[0]===context.workspaceId&&original[1]===context.domain&&String(original[2])===String(context.personId));
 }
 function capture(item,draft,context){
  if(!belongs(item,context)||!sourceMatches(item,context))throw Error('The message recipient or workspace changed. Select the recipient again.');
  if(item.drafts?.emailSubject!==draft.subject||item.drafts?.emailBody!==draft.message)throw Error('Save the current message before continuing.');
  if(!draft.subject?.trim()||!draft.message?.trim())throw Error('Add a subject and message before continuing.');
  return {...item,messageStudioDraft:{...item.messageStudioDraft,deliveryReview:{...snapshot(item,draft,context),reviewedAt:new Date().toISOString()}}};
 }
 function accepted(item,draft,context){
  if(!belongs(item,context)||!sourceMatches(item,context)||item.drafts?.emailSubject!==draft.subject||item.drafts?.emailBody!==draft.message)return false;
  const receipt=item.messageStudioDraft?.deliveryReview;if(!receipt?.reviewedAt)return false;
  const expected=snapshot(item,draft,context);return Object.keys(expected).every(key=>receipt[key]===expected[key]);
 }
 return {capture,accepted};
});
