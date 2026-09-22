(function(root,factory){
  const extension=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=extension;
  if(root?.LeadIntelMarket)extension.install(root.LeadIntelMarket);
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const TYPE="opportunity-led";
  const ID="icp-opportunity-led";

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function isLv(language){return String(language||"en").toLowerCase()==="lv";}
  function currentMarkets(profile={}){
    if(Array.isArray(profile.currentMarkets))return profile.currentMarkets.map(clean).filter(Boolean).join("; ");
    return clean(profile.currentMarkets);
  }

  function hasVerifiedOpportunity(opportunities=[]){
    return (Array.isArray(opportunities)?opportunities:[]).some(item=>
      item?.active!==false&&item?.profileOnly!==true&&Array.isArray(item?.evidence)&&item.evidence.length>0
    );
  }

  function buildOpportunityIcp(profile={},language="en"){
    const lv=isLv(language);
    const targetMarkets=clean(profile.targetMarkets)||currentMarkets(profile)||(lv?"Prioritārie tirgi vēl nav definēti":"Priority markets not yet defined");
    return {
      id:ID,
      type:TYPE,
      name:lv?"Iespēju vadīts profils":"Opportunity-led ICP",
      targetMarkets,
      buyerRoles:clean(profile.decisionMakers),
      value:clean(profile.opportunityValue),
      exclusions:clean(profile.exclusions),
      offers:clean(profile.priorityOffers),
      active:false,
      opportunityDataAvailable:false,
      description:lv
        ?"Uzņēmumi, kuros LeadIntel identificē konkrētu komerciālu iespēju, pat ja tie pilnībā neatbilst pamata ideālā klienta profilam."
        :"Companies where LeadIntel identifies a specific commercial opportunity, even when they do not fully match the core ideal-customer profile.",
      rationale:lv
        ?"Prioritizēt uzņēmumus, kuros tirgus dati, uzņēmuma attīstība vai citi pierādījumi norāda uz konkrētu pārdošanas iespēju."
        :"Prioritize companies where market evidence, company development or other verified signals point to a specific sales opportunity."
    };
  }

  function sanitizeIcp(item={},fallback={}){
    return {
      id:clean(item.id)||fallback.id||ID,
      type:clean(item.type)||fallback.type||TYPE,
      name:clean(item.name)||fallback.name||"Opportunity-led ICP",
      active:item.active!==false,
      opportunityDataAvailable:Boolean(item.opportunityDataAvailable),
      description:clean(item.description)||fallback.description||"",
      targetMarkets:clean(item.targetMarkets)||fallback.targetMarkets||"",
      buyerRoles:clean(item.buyerRoles)||fallback.buyerRoles||"",
      value:clean(item.value)||fallback.value||"",
      exclusions:clean(item.exclusions)||fallback.exclusions||"",
      offers:clean(item.offers)||fallback.offers||"",
      rationale:clean(item.rationale)||fallback.rationale||""
    };
  }

  function install(Market){
    if(!Market||typeof Market.buildIcpCandidates!=="function")return Market;
    if(Market.__opportunityLedIcpInstalled)return Market;

    Market.hasVerifiedOpportunity=hasVerifiedOpportunity;
    const originalBuild=Market.buildIcpCandidates.bind(Market);
    const originalNormalize=Market.normalizeMarketState.bind(Market);
    const originalLocalize=Market.localizeGeneratedState.bind(Market);

    Market.buildIcpCandidates=(profile={},language="en")=>{
      const base=originalBuild(profile,language).filter(item=>item?.type!==TYPE&&item?.id!==ID);
      return [...base,buildOpportunityIcp(profile,language)].slice(0,4);
    };

    Market.normalizeMarketState=(value={})=>{
      const normalized=originalNormalize(value);
      const inputIcps=Array.isArray(value?.icps)?value.icps:[];
      const source=inputIcps.find(item=>item?.type===TYPE||item?.id===ID);
      const existing=(normalized.icps||[]).find(item=>item?.type===TYPE||item?.id===ID);
      if(source&&!existing){
        const fallback=buildOpportunityIcp({},value?.contentLanguage||"en");
        normalized.icps=[...(normalized.icps||[]),sanitizeIcp(source,fallback)].slice(0,4);
      }
      return normalized;
    };

    Market.localizeGeneratedState=(market={},profile={},language="en")=>{
      const localized=originalLocalize(market,profile,language);
      const generated=buildOpportunityIcp(profile,language);
      const source=(Array.isArray(market?.icps)?market.icps:[]).find(item=>item?.type===TYPE||item?.id===ID);
      const preserved=source?sanitizeIcp(source,generated):generated;
      const opportunityDataAvailable=hasVerifiedOpportunity(localized.opportunities);
      const next={
        ...generated,
        active:opportunityDataAvailable&&preserved.active,
        opportunityDataAvailable,
        targetMarkets:preserved.targetMarkets||generated.targetMarkets,
        buyerRoles:preserved.buyerRoles||generated.buyerRoles,
        value:preserved.value||generated.value,
        exclusions:preserved.exclusions||generated.exclusions,
        offers:preserved.offers||generated.offers
      };
      localized.icps=(localized.icps||[]).filter(item=>item?.type!==TYPE&&item?.id!==ID);
      localized.icps=[...localized.icps,next].slice(0,4);
      return localized;
    };

    Object.defineProperty(Market,"__opportunityLedIcpInstalled",{value:true,configurable:true});
    return Market;
  }

  return {ID,TYPE,hasVerifiedOpportunity,buildOpportunityIcp,install};
});
