(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelFollowUpAssistant=api;})(typeof window!=='undefined'?window:globalThis,function(){
'use strict';
const STYLES=Object.freeze(['Professional','Diplomatic','Direct','Consultative']);
function scopeKey(scope){return JSON.stringify([scope?.workspaceId,scope?.accountKey,scope?.recipientAuthorityKey,scope?.companyId,scope?.contactId,scope?.recipient]);}
function usable(scope){return Boolean(scope?.usable&&scope?.isPrivate&&scope.workspaceId&&scope.companyId&&scope.recipient);}
function blocked(context,result){return Boolean(context?.suppression?.optedOut||context?.suppression?.suppressed||result?.canSave===false||/opt.?out|unsubscribe|do.?not.?contact/i.test(result?.intent?.label||''));}
function validateInput(input,context){
 if(input.mode==='reply'&&!String(input.inboundReply||'').trim())return 'Paste the buyer’s reply before analyzing.';
 if(blocked(context))return 'This contact is suppressed. A follow-up cannot be drafted or saved.';
 if(!String(context?.previousSent?.body||'').trim()){const sent=input.manualSent;if(!sent?.confirmed||!String(sent.body||'').trim()||!sent.sentAt)return 'Confirm the actual previously sent message and its send date.';const time=Date.parse(sent.sentAt);if(!Number.isFinite(time)||time>Date.now())return 'Choose a valid actual send date that is not in the future.';}
 if(input.mode==='no_reply'){if(!context?.previousSent?.id||!context?.suppression||context?.frequency?.eligible!==true)return context?.frequency?.reason||'Verified sent chronology and current suppression/frequency checks are required for no-reply follow-up.';if(!input.confirmedLastContactDate)return 'Confirm the actual last contact date and that no reply has been received.';}
 return '';
}
return {STYLES,scopeKey,usable,blocked,validateInput};
});
