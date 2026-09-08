(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root){root.LeadIntelMarketQuerySafety=api;api.install(root.LeadIntelMarket);}
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const FIRECRAWL_QUERY_MAX_CHARS=480;
  const FIELD_LIMITS=Object.freeze({market:60,offer:90,marketFocus:40,idealCustomer:50,buyingTrigger:70,signalKeywords:70,instructions:30});

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function clip(value,max){
    const text=clean(value);const limit=Math.max(1,Number(max)||1);
    if(text.length<=limit)return text;
    const sample=text.slice(0,limit+1);const cut=sample.lastIndexOf(" ");
    return (cut>=Math.floor(limit*.55)?sample.slice(0,cut):text.slice(0,limit)).trim();
  }
  function clipList(value,maxItem,splitList){
    const items=typeof splitList==="function"?splitList(value):String(value??"").split(/\n|;|\|/).map(clean).filter(Boolean);
    return items.map(item=>clip(item,maxItem)).filter(Boolean).join("; ");
  }
  function boundQuery(value,max=FIRECRAWL_QUERY_MAX_CHARS){
    const text=clean(value);if(text.length<=max)return text;
    const sample=text.slice(0,max+1);const cut=sample.lastIndexOf(" ");
    return (cut>=Math.floor(max*.75)?sample.slice(0,cut):text.slice(0,max)).trim();
  }
  function compactInputs(profile={},signals=[],input={},market){
    const splitList=market?.splitList;
    const safeProfile={...profile};
    if(profile.researchMarkets)safeProfile.researchMarkets=clipList(profile.researchMarkets,FIELD_LIMITS.market,splitList);
    if(profile.targetMarkets)safeProfile.targetMarkets=clipList(profile.targetMarkets,FIELD_LIMITS.market,splitList);
    if(profile.currentMarkets)safeProfile.currentMarkets=clipList(profile.currentMarkets,FIELD_LIMITS.market,splitList);
    if(profile.priorityOffers)safeProfile.priorityOffers=clipList(profile.priorityOffers,FIELD_LIMITS.offer,splitList);
    safeProfile.marketFocus=clip(profile.marketFocus,FIELD_LIMITS.marketFocus);
    safeProfile.idealCustomer=clip(profile.idealCustomer,FIELD_LIMITS.idealCustomer);
    safeProfile.buyingTriggers=clip(profile.buyingTriggers,FIELD_LIMITS.buyingTrigger);
    const safeSignals=(Array.isArray(signals)?signals:[]).map(signal=>({...signal,keywords:clip(signal?.keywords,FIELD_LIMITS.signalKeywords)}));
    const safeInput={...input,instructions:clip(input?.instructions,FIELD_LIMITS.instructions)};
    return {profile:safeProfile,signals:safeSignals,input:safeInput};
  }
  function install(market){
    if(!market||market.__leadintelQuerySafetyPatched)return Boolean(market&&market.__leadintelQuerySafetyPatched);
    const original=market.buildResearchQueries;if(typeof original!=="function")return false;
    market.buildResearchQueries=function(profile={},signals=[],input={}){
      const compact=compactInputs(profile,signals,input,market);
      return original.call(this,compact.profile,compact.signals,compact.input).map(item=>({...item,query:boundQuery(item.query)}));
    };
    market.__leadintelQuerySafetyPatched=true;
    return true;
  }

  return {FIRECRAWL_QUERY_MAX_CHARS,FIELD_LIMITS,clip,boundQuery,compactInputs,install};
});
