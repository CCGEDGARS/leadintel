(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelNextAction=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  function count(value){return Math.max(0,Number(value)||0);}
  function forStage(stage,state={}){
    if(Number(stage)===5){
      if(count(state.pipelineCount)===0)return {label:"Save a Company First",enabled:false,visible:false,journeyStage:5};
      return count(state.buyerCount)>0
        ?{label:"Continue to Messages →",enabled:true,visible:true,journeyStage:6}
        :{label:"Continue to Buyers →",enabled:true,visible:true,journeyStage:5};
    }
    if(Number(stage)===6)return count(state.approvedCampaignCount)>0
      ?{label:"Continue to Delivery →",enabled:true}
      :{label:"Approve a Message First",enabled:false};
    if(Number(stage)===7){
      if(count(state.approvedCampaignCount)===0)return {label:"Approve a Message First",enabled:false};
      if(!state.sent)return {label:"Send an Approved Message First",enabled:false};
      if(!state.outcome)return {label:"Record the Outcome",enabled:false};
      return {label:"Workflow Complete ✓",enabled:false};
    }
    return {label:"Continue →",enabled:false};
  }
  function applyStageVisibility(document,stage,state={}){
    const action=forStage(stage,state);
    if(Number(stage)!==5)return action;
    const pipelineEmpty=count(state.pipelineCount)===0;
    const pipeline=document?.querySelector?.(".pipeline-panel");
    if(pipeline)pipeline.hidden=pipelineEmpty;
    const gate=document?.getElementById?.("continue-to-outreach");
    const footer=gate?.closest?.(".workflow-next-action");
    if(footer)footer.hidden=pipelineEmpty||(state.focus==="buyers"&&count(state.buyerCount)===0);
    if(gate){
      const blocked=!action.enabled||(state.focus==="buyers"&&count(state.buyerCount)===0);
      gate.textContent=action.label;
      gate.disabled=blocked;
      gate.setAttribute?.("aria-disabled",String(blocked));
    }
    if(gate?.dataset&&action.journeyStage)gate.dataset.journeyStage=String(action.journeyStage);
    return action;
  }
  return {forStage,applyStageVisibility};
});
