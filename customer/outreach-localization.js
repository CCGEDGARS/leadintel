(function(root,factory){
  const contentLanguage=root?.LeadIntelContentLanguage||(typeof module!=='undefined'&&module.exports?require('./content-language.js'):null);
  const api=factory(contentLanguage);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  if(root)root.LeadIntelOutreachLocalization=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(DefaultLanguageService){
  'use strict';
  function clean(value){return String(value??'').trim();}
  async function prepareCampaignDrafts({root,workspace='',drafts={},scenario={},candidate={},dossier={},languageService=DefaultLanguageService}={}){
    const resolution={
      language:clean(drafts.resolvedLanguage)||languageService.resolveCampaignLanguage({requested:scenario.language,market:candidate.market||dossier.market,domain:candidate.domain||dossier.domain}).language,
      source:clean(drafts.languageSource)||'manual',confidence:clean(drafts.languageConfidence)||'confirmed',requiresConfirmation:Boolean(drafts.languageRequiresConfirmation)
    };
    const provenance={provider:'built-in',model:'LeadIntel native templates',language:resolution.language,selectionSource:resolution.source};
    if(resolution.requiresConfirmation)return {drafts,status:'confirmation_required',approvalBlocked:true,provenance,message:'Confirm the recipient language before approving this campaign.'};
    if(!drafts.requiresAiLocalization)return {drafts,status:'native',approvalBlocked:false,provenance,message:`Campaign generated in ${languageService.EMAIL_LANGUAGES?.[resolution.language]||resolution.language}.`};
    if(!workspace)return {drafts,status:'error',approvalBlocked:true,provenance,message:'Sign in and select an active AI provider to localize this campaign.'};
    try{
      const people=(dossier.people||[]).flatMap(person=>[person?.name,person?.firstName]).filter(Boolean);
      const company=candidate.company||dossier.company||'',domain=candidate.domain||dossier.domain||'';
      const result=await languageService.localizeCampaignPackage(root,workspace,resolution.language,drafts,{company,market:candidate.market||dossier.market||'',segment:scenario.segment||'',offer:scenario.offer||dossier.recommendedOffer||'',buyerRole:scenario.buyerRole||'',domain,people,protectedTerms:[company,domain,...people].filter(Boolean),tone:scenario.tone||drafts.tone||'consultative'});
      return {drafts:{...result.drafts,resolvedLanguage:resolution.language,languageSource:resolution.source,languageConfidence:resolution.confidence,languageRequiresConfirmation:false,requiresAiLocalization:false},status:'complete',approvalBlocked:false,provenance:{provider:result.provider,model:result.model,language:result.language,selectionSource:resolution.source},message:`Campaign localized to ${languageService.EMAIL_LANGUAGES?.[resolution.language]||resolution.language} with ${result.provider||'the active AI provider'}.`};
    }catch(error){return {drafts,status:'error',approvalBlocked:true,provenance,message:String(error?.message||'Campaign localization failed')};}
  }
  return {prepareCampaignDrafts};
});
