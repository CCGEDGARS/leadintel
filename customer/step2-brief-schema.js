(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelStep2Brief=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const SCHEMA_VERSION=3;
  const GROUPS=Object.freeze([
    Object.freeze({id:"targeting",label:"Targeting",fields:Object.freeze(["priority_offers","ideal_customer","buyer_roles","exclusions"])}),
    Object.freeze({id:"signals",label:"Buying Signals",fields:Object.freeze(["buying_outcomes","buying_triggers"])}),
    Object.freeze({id:"message",label:"Commercial Message",fields:Object.freeze(["value_proposition","differentiation","proof_points","objections"])})
  ]);
  const FIELD_IDS=Object.freeze(GROUPS.flatMap(group=>group.fields));

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function validStatus(value,hasAnswer){
    const status=clean(value).toLowerCase();
    if(!hasAnswer)return "missing";
    return ["user","accepted","draft","evidence_draft","hypothesis_draft"].includes(status)?status:"user";
  }
  function migrateState(input={}){
    const source=input&&typeof input==="object"?input:{};
    const sourceAnswers=source.answers&&typeof source.answers==="object"?source.answers:{};
    const sourceStatus=source.answerStatus&&typeof source.answerStatus==="object"?source.answerStatus:{};
    const state={...source};
    state.legacyStrategyContext={
      ...(source.legacyStrategyContext||{}),
      growthMarkets:clean(source.legacyStrategyContext?.growthMarkets||sourceAnswers.growth_markets)
    };
    state.advancedScoring={
      ...(source.advancedScoring||{}),
      opportunityValue:clean(source.advancedScoring?.opportunityValue||sourceAnswers.opportunity_value)
    };
    state.workspaceGoals={
      ...(source.workspaceGoals||{}),
      successOutcome:clean(source.workspaceGoals?.successOutcome||sourceAnswers.success_outcome)
    };
    const answers={};const answerStatus={};
    for(const id of FIELD_IDS){
      answers[id]=clean(sourceAnswers[id]);
      answerStatus[id]=validStatus(sourceStatus[id],Boolean(answers[id]));
    }
    state.answers=answers;
    state.answerStatus=answerStatus;
    state.step2BriefSchemaVersion=SCHEMA_VERSION;
    return state;
  }
  function profileFields(answers={}){
    return {
      priorityOffers:clean(answers.priority_offers),
      idealCustomer:clean(answers.ideal_customer),
      decisionMakers:clean(answers.buyer_roles),
      exclusions:clean(answers.exclusions),
      customerPainPoints:clean(answers.buying_outcomes),
      buyingOutcomes:clean(answers.buying_outcomes),
      buyingTriggers:clean(answers.buying_triggers),
      valueProposition:clean(answers.value_proposition),
      differentiation:clean(answers.differentiation),
      proofPoints:clean(answers.proof_points),
      commonObjections:clean(answers.objections)
    };
  }

  return {SCHEMA_VERSION,GROUPS,FIELD_IDS,migrateState,profileFields};
});
