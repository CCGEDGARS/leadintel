(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LeadIntelJourneyProgress=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const STAGES=Object.freeze([
    {id:1,name:'Company & Market',subtitle:'Source, identity and growth markets'},
    {id:2,name:'Commercial Context',subtitle:'Targeting, signals and campaign brief'},
    {id:3,name:'Intelligence Profile',subtitle:'Evidence-backed commercial profile'},
    {id:4,name:'Market Strategy',subtitle:'ICPs, signals and market opportunities'},
    {id:5,name:'Company Discovery',subtitle:'Qualified companies and decision-makers'},
    {id:6,name:'Campaign Studio',subtitle:'Approved scenarios and outreach scripts'},
    {id:7,name:'Delivery & Learning',subtitle:'Outreach, replies, outcomes and learning'}
  ]);

  const filled=value=>Boolean(String(value??'').trim());
  const list=value=>Array.isArray(value)?value:[];
  const activeItems=value=>list(value).filter(item=>item&&item.active!==false);
  const everyField=(source,fields)=>fields.every(field=>filled(source?.[field]));
  const step=(id,label,complete,{optional=false,action=label}={})=>({id,label,complete:Boolean(complete),optional,action});

  function stageSteps({main={},discovery={},outreach={},delivery={},websiteActivated=false}={}){
    const answers=main.answers&&typeof main.answers==='object'?main.answers:{};
    const market=main.market&&typeof main.market==='object'?main.market:{};
    const profile=main.profile&&typeof main.profile==='object'?main.profile:null;
    const campaign=main.campaignStudio&&typeof main.campaignStudio==='object'?main.campaignStudio:{};
    const candidates=list(discovery.candidates),pipeline=list(discovery.pipeline),items=list(outreach.items),opportunities=list(delivery.opportunities);
    const selectedItem=items.find(item=>item?.domain===outreach.selectedDomain)||items[0]||null;
    const selectedDelivery=opportunities.find(item=>item?.domain===delivery.selectedDomain)||opportunities[0]||null;
    const drafts=selectedItem?.drafts||{};
    const localized=['native','complete'].includes(selectedItem?.localizationStatus);
    return {
      1:[
        step('website','Website activated',websiteActivated||filled(main.website),{action:'Activate the main company website'}),
        step('markets','Target markets selected',list(main.targetMarkets).some(filled),{action:'Select at least one target market'}),
        step('brand','Brand and email identity configured',main.brandIdentity?.status==='ready',{optional:true,action:'Configure brand and email identity'}),
        step('evidence','Supporting evidence added',list(main.documents).length>0||list(main.additionalLinks).some(filled),{optional:true,action:'Add supporting files or links'})
      ],
      2:[
        step('offer-customer','Priority offers and best-fit customers',everyField(answers,['priority_offers','ideal_customer']),{optional:true,action:'Define priority offers and best-fit customers'}),
        step('decision-fit','Buyer roles and exclusions',everyField(answers,['buyer_roles','exclusions']),{optional:true,action:'Confirm buyer roles and exclusions'}),
        step('demand-signals','Demand and buying signals',everyField(answers,['buying_outcomes','buying_triggers']),{optional:true,action:'Define demand and observable buying signals'}),
        step('message-proof','Value, proof and objections',everyField(answers,['value_proposition','differentiation','proof_points','objections']),{optional:true,action:'Add value, proof and common objections'})
      ],
      3:[
        step('profile','Intelligence profile generated',Boolean(profile),{action:'Generate the intelligence profile'}),
        step('review','Evidence reviewed and gaps corrected',Boolean(profile&&main.approved),{action:'Review evidence and correct missing information'}),
        step('approval','Intelligence profile approved',Boolean(main.approved),{action:'Approve the intelligence profile'})
      ],
      4:[
        step('icps','Ideal customer profiles reviewed',activeItems(market.icps).length>0,{action:'Review and activate at least one ICP'}),
        step('signals','Buying signals activated',activeItems(market.signals).length>0,{action:'Activate at least one buying signal'}),
        step('research','Market research completed',filled(market.lastResearchAt)&&['complete','partial'].includes(market.researchStatus),{action:'Run market research'}),
        step('opportunities','Market opportunities selected',activeItems(market.opportunities).length>0,{action:'Select at least one market opportunity'}),
        step('strategy','Market strategy activated',Boolean(market.strategyApproved),{action:'Activate the market strategy'})
      ],
      5:[
        step('scope','Discovery amount selected',Boolean(discovery.targetCount||discovery.queries?.length||candidates.length),{action:'Choose how many companies to find'}),
        step('companies','Companies found and verified',['complete','partial'].includes(discovery.status)&&candidates.length>0,{action:'Find and verify matching companies'}),
        step('review','Qualified companies reviewed',candidates.some(item=>item?.company&&item?.domain),{action:'Review qualified companies'}),
        step('pipeline','Opportunity saved to pipeline',pipeline.length>0,{action:'Save at least one opportunity to the pipeline'}),
        step('people','Decision-makers found',candidates.some(item=>list(item?.people).length>0)||pipeline.some(item=>list(item?.people).length>0),{action:'Find decision-makers for a selected company'})
      ],
      6:[
        step('scenario','Core outreach scenario approved',campaign.coreScenario?.status==='approved',{action:'Review and save the core outreach scenario'}),
        step('company','Pipeline company selected',Boolean(selectedItem),{action:'Choose a saved pipeline company'}),
        step('dossier','Opportunity dossier built',Boolean(selectedItem?.dossier),{action:'Build the opportunity dossier'}),
        step('scripts','Scripts generated and localized',filled(drafts.emailSubject)&&filled(drafts.emailBody)&&localized,{action:'Generate and localize the campaign scripts'}),
        step('approval','Campaign package approved',Boolean(selectedItem?.approved),{action:'Review and approve the campaign package'})
      ],
      7:[
        step('package','Approved campaign selected',Boolean(selectedDelivery||items.some(item=>item?.approved)),{action:'Select an approved campaign package'}),
        step('sent','Outreach sent and confirmed',filled(selectedDelivery?.sentAt),{action:'Send the outreach and confirm delivery'}),
        step('reply','Customer reply recorded',list(selectedDelivery?.replies).length>0,{optional:true,action:'Record the customer reply when it arrives'}),
        step('outcome','Commercial outcome recorded',filled(selectedDelivery?.outcomeStage),{optional:true,action:'Record the commercial outcome'}),
        step('learning','Learning activity accumulated',list(delivery.activity).length>=3,{optional:true,action:'Continue recording activity to strengthen learning'})
      ]
    };
  }

  function buildJourneyModel(input={}){
    const currentStep=Math.min(7,Math.max(1,Number(input.currentStep)||1));
    const availability=input.availability&&typeof input.availability==='object'?input.availability:{};
    const stepsByStage=stageSteps(input);
    return STAGES.map(definition=>{
      const steps=stepsByStage[definition.id]||[];
      const completed=steps.filter(item=>item.complete).length;
      const required=steps.filter(item=>!item.optional);
      const requiredCompleted=required.filter(item=>item.complete).length;
      const requiredComplete=required.length?requiredCompleted===required.length:completed===steps.length&&steps.length>0;
      const available=Boolean(availability[definition.id]);
      let status=definition.id===currentStep?'current':requiredComplete?'complete':available?'available':'locked';
      if(definition.id===2&&definition.id<currentStep&&completed===0)status='skipped';
      const next=steps.find(item=>!item.complete&&!item.optional)||steps.find(item=>!item.complete);
      return {...definition,steps,total:steps.length,completed,requiredTotal:required.length,requiredCompleted,available,status,nextAction:next?.action||'Stage complete'};
    });
  }

  return {STAGES,buildJourneyModel};
});
