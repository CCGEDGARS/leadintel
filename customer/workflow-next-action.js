(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelNextAction=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  function count(value){return Math.max(0,Number(value)||0);}
  function forStage(stage,state={}){
    if(Number(stage)===5)return count(state.pipelineCount)>0
      ?{label:"Continue to Campaign Studio →",enabled:true}
      :{label:"Save an Opportunity First",enabled:false};
    if(Number(stage)===6)return count(state.approvedCampaignCount)>0
      ?{label:"Continue to Delivery & Learning →",enabled:true}
      :{label:"Approve a Campaign First",enabled:false};
    if(Number(stage)===7){
      if(count(state.approvedCampaignCount)===0)return {label:"Approve a Campaign First",enabled:false};
      if(!state.sent)return {label:"Send an Approved Campaign First",enabled:false};
      if(!state.outcome)return {label:"Record the Campaign Outcome",enabled:false};
      return {label:"Workflow Complete ✓",enabled:false};
    }
    return {label:"Continue →",enabled:false};
  }
  return {forStage};
});
