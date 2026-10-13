(function(root){
 'use strict';
 function captureWritingContext({workspace,item,candidate,person,studio,facts,currentDraft,refs,usable,language}){
  const evidence=rows=>(rows||[]).slice(0,12).map(row=>({owner:row.owner,url:row.url||row.sourceUrl||row.source_url,title:row.title,status:row.status,verified:row.verified,extractedAt:row.extractedAt||row.extracted_at,excerpt:String(row.excerpt||row.text||row.markdown||row.content||'').slice(0,1800)}));
  const context={channel:item?.channel||'email',style:item?.channel==='linkedin'?studio.linkedinMode:studio.mode,appliedStyle:item?.messageStudioDraft?.mode||'',language:language||studio.essentials.language||'en',recipient:{id:person?.id||item?.selectedPersonId||'',name:person?.name||'',firstName:facts.firstName||'',role:person?.title||'',email:person?.email||'',company:candidate?.company||item?.company||'',domain:item?.domain||''},seller:{...studio.essentials,website:facts.sellerWebsite||''},reviewedSellerAnswers:facts.sellerAnswers||{},sellerAnswerStatus:facts.sellerAnswerStatus||{},trigger:facts.trigger||null,eventCampaign:facts.eventCampaign||null,buyerEvidence:facts.buyerEvidence||null,sellerEvidence:evidence(facts.sellerEvidence),profileEvidence:evidence(facts.profileEvidence),currentDraft:{subject:currentDraft.subject,message:currentDraft.message}};
  const sourceRefs=refs?.workspaceId===workspace?refs.sourceRefs||[]:[],referenceRevision=refs?.workspaceId===workspace?refs.referenceRevision:null;
  return {scope:JSON.stringify([workspace,item?.domain,item?.selectedPersonId,context.channel]),fingerprint:JSON.stringify(context),context,sourceRefs,referenceRevision,usable:Boolean(usable&&workspace&&person?.name&&referenceRevision!==null)};
 }
 function validateWritingDraft(draft,context={}){
  if(!draft||typeof draft.subject!=='string'||typeof draft.message!=='string'||!draft.message.trim()||draft.message.length>12000||/\{\{|\}\}/.test(draft.message))throw Error('Writing Assistant returned an invalid or unfilled draft. Your message is preserved.');
  if(context.channel!=='linkedin'&&(!draft.subject.trim()||[...draft.subject].length>60||/[\r\n]|https?:|^Subject:/i.test(draft.subject)))throw Error('Writing Assistant returned an invalid subject. Your message is preserved.');
  const links=text=>(String(text||'').match(/https?:\/\/[^\s<>"\])]+/g)||[]).map(url=>url.replace(/[.,;!?]+$/,''));
  const prior=context.currentDraft?.message||'',existing=links(prior),proposed=links(draft.message);
  const supplied=Object.values(context.seller||{}).filter(value=>typeof value==='string'&&/^https?:\/\//i.test(value.trim()));
  const allowed=new Set([...existing,...supplied.flatMap(links)]);
  if(existing.some(link=>!proposed.includes(link)))throw Error('Writing Assistant omitted an existing link. Your message is preserved.');
  if(proposed.some(link=>!allowed.has(link)))throw Error('Writing Assistant added an unapproved link. Your message is preserved.');
  const sender=context.seller?.sender;if(sender&&!draft.message.includes(sender))throw Error('Writing Assistant omitted the sender identity. Your message is preserved.');
  if(/20[ -]minute/i.test(prior)&&!/20[ -]minute/i.test(draft.message))throw Error('Writing Assistant changed the meeting duration. Your message is preserved.');
  return draft;
 }
 const api={captureWritingContext,validateWritingDraft};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelWritingAssistantContext=api;
})(typeof window==='object'?window:globalThis);
