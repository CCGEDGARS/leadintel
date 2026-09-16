(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelResearchVerification=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const clean=(value,limit=500)=>String(value??"").replace(/\s+/g," ").trim().slice(0,limit);
  function buildVerificationPayload({mode="deep",profile={},signals=[],results=[]}={}){
    return {mode,role:"verification",web_search:false,profile:{targetMarkets:clean(profile.targetMarkets,1200),priorityOffers:clean(profile.priorityOffers,1200),idealCustomer:clean(profile.idealCustomer,1200),buyingTriggers:clean(profile.buyingTriggers,1200)},signals:(signals||[]).filter(item=>item?.active!==false).slice(0,20).map(item=>({name:clean(item?.name,160),keywords:clean(item?.keywords,500)})),evidence:(results||[]).slice(0,60).map((item,index)=>({id:`evidence-${index+1}`,url:clean(item?.url,2048),title:clean(item?.title,240),description:clean(item?.description,400),text:clean(item?.text,400),date:clean(item?.date,80),market:clean(item?.market,160),query:clean(item?.query,300)}))};
  }
  function normalizeVerification(payload={}){
    const complete=payload?.status==="complete";
    return {status:complete?"complete":"unavailable",provider:"gemini",role:"verification",webSearch:false,reason:clean(payload?.reason,300),summary:clean(payload?.summary,1000),disagreements:Array.isArray(payload?.disagreements)?payload.disagreements.map(item=>clean(item,400)).filter(Boolean).slice(0,12):[],missingEvidence:Array.isArray(payload?.missing_evidence)?payload.missing_evidence.map(item=>clean(item,400)).filter(Boolean).slice(0,12):[],verifiedAt:complete?new Date().toISOString():""};
  }
  function applyVerification(results=[],payload={}){
    const verdicts=new Map((Array.isArray(payload?.verdicts)?payload.verdicts:[]).map(item=>[clean(item?.evidence_id,80),item]));
    const merged=(results||[]).map((item,index)=>{
      const verdict=verdicts.get(`evidence-${index+1}`);if(!verdict)return {...item};
      return {...item,verification:{provider:"gemini",role:"verification",relevance:["strong","moderate","weak","reject"].includes(verdict.relevance)?verdict.relevance:"weak",commercialFit:["strong","moderate","weak","unknown"].includes(verdict.commercial_fit)?verdict.commercial_fit:"unknown",contradiction:Boolean(verdict.contradiction),rationale:clean(verdict.rationale,600),missingEvidence:Array.isArray(verdict.missing_evidence)?verdict.missing_evidence.map(value=>clean(value,240)).filter(Boolean).slice(0,8):[]}};
    });
    return {results:merged,verification:normalizeVerification(payload)};
  }
  return {buildVerificationPayload,applyVerification,normalizeVerification};
});
