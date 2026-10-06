(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelStep2Brief=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const SCHEMA_VERSION=4;
  const GROUPS=Object.freeze([
    Object.freeze({id:"targeting",label:"Targeting",fields:Object.freeze(["priority_offers","ideal_customer","buyer_roles","exclusions"])}),
    Object.freeze({id:"signals",label:"Buying Signals",fields:Object.freeze(["buying_outcomes","buying_triggers"])}),
    Object.freeze({id:"message",label:"Commercial Message",fields:Object.freeze(["value_proposition","differentiation","proof_points","objections","delivery_approach","meeting_value"])})
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
      commonObjections:clean(answers.objections),
      deliveryApproach:clean(answers.delivery_approach),
      meetingValue:clean(answers.meeting_value)
    };
  }

  function applyAnswers(state={},changed=FIELD_IDS){
    if(!state.profile||!changed.length)return state;
    const mapped=profileFields(state.answers||{}), changedFields=profileFields(Object.fromEntries(changed.map(id=>[id,'changed']))),keys=Object.keys(changedFields).filter(key=>changedFields[key]);
    const profile={...state.profile,canonical:state.profile.canonical?JSON.parse(JSON.stringify(state.profile.canonical)):undefined};
    for(const key of keys){profile[key]=mapped[key];if(profile.canonical?.fields?.[key])Object.assign(profile.canonical.fields[key],{value:mapped[key],status:mapped[key]?'user_confirmed':'unknown',provenance:'user',confidence:mapped[key]?'high':'low'});}
    if(changed.includes('buying_outcomes'))profile.customerPainPointsStatus='User confirmed';
    const icps=(state.market?.icps||[]).map(icp=>icp.type==='core'||icp.id==='icp-core'?{...icp,...(changed.includes('ideal_customer')?{description:profile.idealCustomer}:{}),...(changed.includes('priority_offers')?{offers:profile.priorityOffers}:{}),...(changed.includes('buyer_roles')?{buyerRoles:profile.decisionMakers}:{}),...(changed.includes('exclusions')?{exclusions:profile.exclusions}:{})}:icp);
    return {...state,profile,approved:false,market:{...(state.market||{}),icps,strategyApproved:false,strategyApprovedAt:''}};
  }
  function confirmationMissing(state={},scope="message"){const migrated=migrateState(state);return FIELD_IDS.slice(0,scope==="research"?6:12).filter(id=>!migrated.answers[id]||!["user","accepted"].includes(migrated.answerStatus[id]));}
  return {confirmationMissing,applyAnswers,SCHEMA_VERSION,GROUPS,FIELD_IDS,migrateState,profileFields};
});
