(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LeadIntelJourneyProgress=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const STAGES=Object.freeze([
    {id:1,name:'Setup',subtitle:'Your company and target markets'},
    {id:2,name:'Profile',subtitle:'Company evidence and customer context'},
    {id:3,name:'Strategy',subtitle:'Who to pursue and what to watch for'},
    {id:4,name:'Companies',subtitle:'Find companies that fit your strategy'},
    {id:5,name:'Buyers',subtitle:'Identify and qualify the relevant buyers'},
    {id:6,name:'Messages',subtitle:'Turn company evidence into relevant messages'},
    {id:7,name:'Delivery',subtitle:'Send, record outcomes and learn'}
  ]);

  const filled=value=>Boolean(String(value??'').trim());
  const list=value=>Array.isArray(value)?value:[];
  const activeItems=value=>list(value).filter(item=>item&&item.active!==false);
  const everyField=(source,fields)=>fields.every(field=>filled(source?.[field]));
  const step=(id,label,complete,{optional=false,action=label}={})=>({id,label,complete:Boolean(complete),optional,action});
  const STATUS_LABELS=Object.freeze({current:'In progress',complete:'Complete',available:'Available',locked:'Locked',skipped:'Skipped · optional'});

  function stageStatusLabel(stage={}){
    if(stage.status==='current'&&Number(stage.completed)===0)return 'Not started';
    return STATUS_LABELS[stage.status]||'Available';
  }

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
        step('offer-customer','Priority offers and best-fit customers',everyField(answers,['priority_offers','ideal_customer']),{optional:true,action:'Describe the customers you help and outcomes they need'}),
        step('decision-fit','Buyer roles and exclusions',everyField(answers,['buyer_roles','exclusions']),{optional:true,action:'Confirm buyer roles and exclusions'}),
        step('demand-signals','Demand and buying signals',everyField(answers,['buying_outcomes','buying_triggers']),{optional:true,action:'Describe the outcomes and events that create demand'}),
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
        step('research',market.researchStatus==='running'?'Market research in progress':filled(market.lastResearchAt)&&['complete','partial'].includes(market.researchStatus)?'Market research completed':'Market research not run',filled(market.lastResearchAt)&&['complete','partial'].includes(market.researchStatus),{action:market.researchStatus==='running'?'Wait for market research to finish':'Run market research'}),
        step('opportunities','Market opportunities selected',activeItems(market.opportunities).length>0,{action:'Select at least one market opportunity'}),
        step('strategy','Strategy approved',Boolean(market.strategyApproved),{action:'Review and approve the strategy'})
      ],
      5:[
        step('scope','Discovery amount selected',Boolean(discovery.targetCount||discovery.queries?.length||candidates.length),{action:'Choose how many companies to find'}),
        step('companies',discovery.status==='no_results'?'No qualified companies found':'Companies found and verified',['complete','partial'].includes(discovery.status)&&candidates.length>0,{action:discovery.status==='no_results'?'Review the strategy, then broaden the search':'Find and verify matching companies'}),
        step('review','Qualified companies reviewed',candidates.some(item=>item?.company&&item?.domain),{action:'Review qualified companies'}),
        step('pipeline','Opportunity saved to pipeline',pipeline.length>0,{action:'Save at least one opportunity to the pipeline'}),
        step('people','Relevant buyers identified',candidates.some(item=>list(item?.people).length>0)||pipeline.some(item=>list(item?.people).length>0),{action:'Find and qualify buyers for a selected company'})
      ],
      6:[
        step('scenario','Core message approach approved',campaign.coreScenario?.status==='approved',{action:'Review and save the core message approach'}),
        step('company','Pipeline company selected',Boolean(selectedItem),{action:'Choose a saved pipeline company'}),
        step('dossier','Opportunity dossier built',Boolean(selectedItem?.dossier),{action:'Build the opportunity dossier'}),
        step('scripts','Messages prepared and localized',filled(drafts.emailSubject)&&filled(drafts.emailBody)&&localized,{action:'Create and localize the message scripts'}),
        step('approval','Message package approved',Boolean(selectedItem?.approved),{action:'Review and approve the message package'})
      ],
      7:[
        step('package','Approved message selected',Boolean(selectedDelivery||items.some(item=>item?.approved)),{action:'Select an approved message package'}),
        step('sent','Message sent and confirmed',filled(selectedDelivery?.sentAt),{action:'Send the message and confirm delivery'}),
        step('reply','Buyer reply recorded',list(selectedDelivery?.replies).length>0,{optional:true,action:'Record the buyer reply when it arrives'}),
        step('outcome','Commercial outcome recorded',filled(selectedDelivery?.outcomeStage),{optional:true,action:'Record the commercial outcome'}),
        step('learning','Learning activity accumulated',list(delivery.activity).length>=3,{optional:true,action:'Continue recording activity to strengthen learning'})
      ]
    };
  }

  function buildJourneyModel(input={}){
    const currentStep=Math.min(7,Math.max(1,Number(input.currentStep)||1));
    const availability=input.availability&&typeof input.availability==='object'?input.availability:{};
    const internal=stageSteps(input);
    const discovery=input.discovery&&typeof input.discovery==='object'?input.discovery:{};
    const candidates=list(discovery.candidates),pipeline=list(discovery.pipeline);
    const groups={
      1:internal[1]||[],
      2:[...(internal[2]||[]),...(internal[3]||[])],
      3:internal[4]||[],
      4:(internal[5]||[]).filter(item=>item.id!=='people'),
      5:(internal[5]||[]).filter(item=>item.id==='people'),
      6:internal[6]||[],
      7:internal[7]||[]
    };
    const activeJourneyStage=Number(input.activeJourneyStage)||journeyStageForModuleStep(currentStep,input.journeyFocus);
    return STAGES.map(definition=>{
      const steps=groups[definition.id]||[];
      const completed=steps.filter(item=>item.complete).length;
      const required=steps.filter(item=>!item.optional);
      const requiredCompleted=required.filter(item=>item.complete).length;
      const requiredComplete=required.length?requiredCompleted===required.length:completed===steps.length&&steps.length>0;
      const available=definition.id===1?Boolean(availability[1])
        :definition.id===2?Boolean(availability[2]||availability[3])
        :definition.id===3?Boolean(availability[4])
        :definition.id===4?Boolean(availability[5])
        :definition.id===5?Boolean(availability[5]&&(candidates.length||pipeline.length))
        :Boolean(availability[definition.id]);
      let status=definition.id===activeJourneyStage?'current':requiredComplete?'complete':available?'available':'locked';
      const answers=input.main?.answers&&typeof input.main.answers==='object'?input.main.answers:{};
      const profile=input.main?.profile;
      if(definition.id===2&&activeJourneyStage>2&&!profile&&!Object.values(answers).some(filled))status='skipped';
      const next=steps.find(item=>!item.complete&&!item.optional)||steps.find(item=>!item.complete);
      return {...definition,steps,total:steps.length,completed,requiredTotal:required.length,requiredCompleted,available,status,nextAction:next?.action||'Stage complete'};
    });
  }

  function journeyStageForModuleStep(step,focus=''){
    const moduleStep=Math.min(7,Math.max(1,Number(step)||1));
    if(moduleStep<=3)return moduleStep===1?1:2;
    if(moduleStep===4)return 3;
    if(moduleStep===5)return focus==='buyers'?5:4;
    return moduleStep;
  }

  function routeForJourneyStage(stage,main={}){
    const id=Math.min(7,Math.max(1,Number(stage)||1));
    if(id===1)return {moduleStep:1,focus:'setup'};
    if(id===2)return {moduleStep:main.profile?3:2,focus:'profile'};
    if(id===3)return {moduleStep:4,focus:'strategy'};
    if(id===4)return {moduleStep:5,focus:'companies'};
    if(id===5)return {moduleStep:5,focus:'buyers'};
    if(id===6)return {moduleStep:6,focus:'messages'};
    return {moduleStep:7,focus:'delivery'};
  }

  function visibleStageIds(model=[]){
    const visible=[];
    let includedNext=false;
    const currentId=Math.max(1,...list(model).filter(stage=>stage?.status==='current').map(stage=>Number(stage.id)||1));
    for(const stage of list(model)){
      if(Number(stage?.id)<=currentId||['complete','skipped','current'].includes(stage?.status)){
        visible.push(stage.id);
        continue;
      }
      if(!includedNext&&stage?.status==='available'){
        visible.push(stage.id);
        includedNext=true;
      }
    }
    return visible;
  }

  return {STAGES,buildJourneyModel,journeyStageForModuleStep,routeForJourneyStage,visibleStageIds,stageStatusLabel};
});
