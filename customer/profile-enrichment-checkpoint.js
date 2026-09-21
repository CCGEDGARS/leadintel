(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelProfileEnrichmentCheckpoint=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  function domain(value){
    const raw=String(value||"").trim();
    if(!raw)return "";
    try{return new URL(/^https?:\/\//i.test(raw)?raw:`https://${raw}`).hostname.replace(/^www\./i,"").toLowerCase();}
    catch{return raw.replace(/^https?:\/\//i,"").replace(/^www\./i,"").split("/")[0].toLowerCase();}
  }

  function researchComplete(state={}){
    return Boolean(state.researchMeta?.generatedAt&&domain(state.website)&&domain(state.website)===domain(state.researchMeta?.website));
  }

  function lookalikeComplete(state={}){
    const reference=state.referenceCustomers||{};
    return Boolean(reference.activated&&reference.dna&&Number(reference.dna.activeCount)>0);
  }

  function pending(state={}){
    const items=[];
    if(!researchComplete(state))items.push("company-research");
    if(!lookalikeComplete(state))items.push("lookalike-audience");
    return items;
  }

  return {domain,researchComplete,lookalikeComplete,pending};
});
