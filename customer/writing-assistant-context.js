(function(root){
 'use strict';
 function captureWritingContext({workspace,item,candidate,person,studio,facts,currentDraft,refs,usable,language}){
  const evidence=rows=>(rows||[]).slice(0,12).map(row=>({owner:row.owner,url:row.url||row.sourceUrl||row.source_url,title:row.title,status:row.status,verified:row.verified,extractedAt:row.extractedAt||row.extracted_at,excerpt:String(row.excerpt||row.text||row.markdown||row.content||'').slice(0,1800)}));
  const context={channel:item?.channel||'email',style:item?.channel==='linkedin'?studio.linkedinMode:studio.mode,appliedStyle:item?.messageStudioDraft?.mode||'',language:language||studio.essentials.language||'en',recipient:{id:person?.id||item?.selectedPersonId||'',name:person?.name||'',firstName:facts.firstName||'',role:person?.title||'',email:person?.email||'',company:candidate?.company||item?.company||'',domain:item?.domain||''},seller:{...studio.essentials,website:facts.sellerWebsite||''},reviewedSellerAnswers:facts.sellerAnswers||{},sellerAnswerStatus:facts.sellerAnswerStatus||{},trigger:facts.trigger||null,eventCampaign:facts.eventCampaign||null,buyerEvidence:facts.buyerEvidence||null,sellerEvidence:evidence(facts.sellerEvidence),profileEvidence:evidence(facts.profileEvidence),currentDraft:{subject:currentDraft.subject,message:currentDraft.message}};
  const sourceRefs=refs?.workspaceId===workspace?refs.sourceRefs||[]:[],referenceRevision=refs?.workspaceId===workspace?refs.referenceRevision:null;
  return {scope:JSON.stringify([workspace,item?.domain,item?.selectedPersonId,context.channel]),fingerprint:JSON.stringify(context),context,sourceRefs,referenceRevision,usable:Boolean(usable&&workspace&&person?.name&&referenceRevision!==null)};
 }
 const api={captureWritingContext};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelWritingAssistantContext=api;
})(typeof window==='object'?window:globalThis);
