(function(root,factory){const api=factory();if(typeof module!=="undefined"&&module.exports)module.exports=api;if(root)root.LeadIntelTargeting=api;})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const fields={priority_offers:"priorityOffers",ideal_customer:"idealCustomer",buyer_roles:"decisionMakers",exclusions:"exclusions"};
  const clean=value=>String(value??"").replace(/\s+/g," ").trim();
  function missing(state={}){return Object.keys(fields).filter(id=>!clean(state.answers?.[id])||/^(unknown|tbd|todo|to be confirmed|not sure|[-?]+)$/i.test(clean(state.answers?.[id])));}
  function signature(state={}){return JSON.stringify([1,clean(state.website).toLowerCase().replace(/\/$/,""),(state.targetMarkets||[]).map(clean).sort(),...Object.keys(fields).map(id=>clean(state.answers?.[id]))]);}
  function isConfirmed(state={}){return !missing(state).length&&state.targetingConfirmation?.version===1&&state.targetingConfirmation.signature===signature(state);}
  function profileFields(state={}){return Object.fromEntries(Object.entries(fields).map(([id,key])=>[key,clean(state.answers?.[id])]));}
  function confirm(state={},now=new Date().toISOString()){if(missing(state).length)return null;return {version:1,signature:signature(state),confirmedAt:now};}
  return {fields,missing,signature,isConfirmed,profileFields,confirm};
});
