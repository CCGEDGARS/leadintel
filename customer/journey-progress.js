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

  const Targeting=globalThis.LeadIntelTargeting||(typeof require==='function'?require('./targeting-policy.js'):null);
  const Strategy=globalThis.LeadIntelStrategyIntegrity||(typeof require==='function'?require('./strategy-integrity.js'):null);
  const filled=value=>Boolean(String(value??'').trim());
  const list=value=>Array.isArray(value)?value:[];
  const activeItems=value=>list(value).filter(item=>item&&item.active!==false);
  const everyField=(source,fields)=>fields.every(field=>filled(source?.[field]));
  const checkedCompanies=discovery=>(discovery.needsRefresh?[]:list(discovery.candidates)).filter(item=>item?.company&&item?.domain&&!item.needsRecheck&&item.qualification?.eligible===true&&Number.isFinite(item.qualification.score)&&item.qualification.score>0);
  const step=(id,label,complete,{optional=false,action=label}={})=>({id,label,complete:Boolean(complete),optional,action});
  const STATUS_LABELS=Object.freeze({'in-progress':'In progress','not-started':'Not started',complete:'Complete',locked:'Locked'});

  function stageStatusLabel(stage={}){
    return STATUS_LABELS[stage.status]||'Not started';
  }

  function companyRecoveryAction(status,main,websiteActivated){
    const action=(nextAction,stageId,itemId)=>({nextAction,nextTarget:{stageId,itemId}});
    if(!status)return null;
    const targetingMissing=main&&Targeting&&!Targeting.isConfirmed(main);
    if(status.current&&!targetingMissing)return null;
    // Restored Companies work can be viewed before Setup is completed. Its
    // recovery links must still reach a stage the website gate will allow.
    if(websiteActivated===undefined&&typeof window!=='undefined')websiteActivated=window.LeadIntelWebsiteActivation?.isCurrentWebsiteActive?.();
    if(websiteActivated===false)return filled(main?.website||main?.profile?.website)?action('Activate your company website in Setup',1,'activate-website'):action('Add your company website in Setup',1,'website');
    if(status.recovery==='research')return action('Update market research in Profile',2,'research');
    if(status.recovery==='profile'&&main){
      if(!filled(main.website||main.profile?.website))return action('Add your company website in Setup',1,'website');
      if(!filled(main.targetMarkets)&&!filled(main.profile?.targetMarkets))return action('Choose your target markets in Setup',1,'markets');
      if(!main.profile)return action('Review your company Profile',2,'build-profile');
    }
    if(targetingMissing)return action('Confirm targeting in Profile',2,'targeting');
    if(status.recovery==='profile'){
      if(status.code==='strategy_incomplete')return action('Review your priority offer in Profile',2,'offer-customer');
      return action('Review and approve your Profile',2,'approval');
    }
    if(status.code==='strategy_incomplete'&&main&&!activeItems(main.market?.icps).length)return action('Activate a customer profile in Strategy',3,'icps');
    if(status.code==='strategy_invalid'||status.code==='strategy_incomplete'&&main&&!activeItems(main.market?.signals).length)return action('Review buying signals in Strategy',3,'signals');
    return action('Review and approve Strategy',3,'strategy');
  }

  function stageSteps({companyOutcome,strategyStatus,main={},discovery={},discoveryMeta={},outreach={},delivery={},websiteActivated=false,buyerQualityPassed=false}={}){
    const answers=main.answers&&typeof main.answers==='object'?main.answers:{};
    const market=main.market&&typeof main.market==='object'?main.market:{};
    const profile=main.profile&&typeof main.profile==='object'?main.profile:null;
    const campaign=main.campaignStudio&&typeof main.campaignStudio==='object'?main.campaignStudio:{};
    const candidates=checkedCompanies(discovery),pipeline=list(discovery.pipeline),prospects=list(discovery.selectedProspects),items=list(outreach.items),opportunities=list(delivery.opportunities);
    const requested=Math.max(1,Math.min(50,Number(discoveryMeta.targetCount||discovery.targetCount)||1));
    const selectedItem=items.find(item=>item?.domain===outreach.selectedDomain)||items[0]||null;
    const selectedDelivery=opportunities.find(item=>item?.domain===delivery.selectedDomain)||opportunities[0]||null;
    const drafts=selectedItem?.drafts||{};
    const localized=['native','complete'].includes(selectedItem?.localizationStatus);
    const studio=outreach.messageStudio;
    const retainedCompanies=candidates.length+pipeline.length+prospects.length>0;
    const researchComplete=filled(market.lastResearchAt)&&['complete','partial'].includes(market.researchStatus)&&strategyStatus?.recovery!=='research';
    let researchLabel='Market research not run';
    if(market.researchStatus==='running')researchLabel='Market research in progress';
    else if(strategyStatus?.recovery==='research')researchLabel='Market research needs updating';
    else if(researchComplete)researchLabel=market.researchStatus==='partial'?'Research saved · partial coverage':'Market research completed';
    const studioReady=studio&&everyField(studio.essentials,['offer','target','value','sender','company','meetingValue','calendly']);
    return {
      1:[
        step('website','Website activated',websiteActivated,{action:'Activate the main company website'}),
        step('markets','Target markets selected',list(main.targetMarkets).some(filled),{action:'Select at least one target market'}),
        step('evidence','Supporting evidence added',list(main.documents).length>0||list(main.additionalLinks).some(filled),{optional:true,action:'Add supporting files or links'})
      ],
      2:[
        step('offer-customer','Priority offers and best-fit customers',everyField(answers,['priority_offers','ideal_customer']),{action:'Describe the customers you help and outcomes they need'}),
        step('decision-fit','Buyer roles, exclusions and targeting confirmed',everyField(answers,['buyer_roles','exclusions'])&&Targeting?.isConfirmed(main),{action:'Complete buyer roles and exclusions, then confirm targeting'}),
        step('demand-signals','Demand and buying signals',everyField(answers,['buying_outcomes','buying_triggers']),{optional:true,action:'Describe the outcomes and events that create demand'}),
        step('message-proof','Value, proof and objections',everyField(answers,['value_proposition','differentiation','proof_points','objections']),{optional:true,action:'Add value, proof and common objections'})
      ],
      3:[
        step('profile','Intelligence profile generated',Boolean(profile),{action:'Generate the intelligence profile'}),
        step('review','Evidence reviewed and gaps corrected',Boolean(profile&&main.approved),{action:'Review evidence and correct missing information'}),
        step('approval','Intelligence profile approved',Boolean(main.approved),{action:'Approve the intelligence profile'}),
        step('research',researchLabel,researchComplete,{optional:true,action:market.researchStatus==='running'?'Wait for market research to finish':'Run market research'})
      ],
      4:[
        step('icps','Customer definition configured',activeItems(market.icps).length>0,{action:'Review and activate at least one ICP'}),
        step('signals','Buying signals activated',activeItems(market.signals).length>0,{action:'Activate at least one buying signal'}),
        step('opportunities','Target markets configured',filled(main.profile?.targetMarkets)||filled(main.profile?.currentMarkets)||filled(main.targetMarkets),{action:'Choose a target market'}),
        step('strategy','Strategy approved',strategyStatus?.current??Boolean(market.strategyApproved),{action:'Review and approve the strategy'})
      ],
      5:[
        step('scope','Discovery amount selected',Boolean(discoveryMeta.targetCount||discovery.targetCount||discovery.queries?.length||candidates.length),{action:'Choose how many companies to find'}),
        step('companies',discovery.status==='no_results'?(retainedCompanies?'No new checked companies · saved companies retained':'No checked companies found'):'Companies found and verified',['complete','partial'].includes(discovery.status)&&(companyOutcome?companyOutcome.targetMet:(discoveryMeta.companyGoal==='strong_fit'?candidates.filter(c=>Number(c.qualification?.score)>=80).length:candidates.length)>=requested),{action:discovery.status==='no_results'?(retainedCompanies?'Review saved companies or broaden the search':'Review the strategy, then broaden the search'):'Find and verify matching companies'}),
        step('review','Checked companies reviewed',candidates.some(item=>item?.company&&item?.domain),{action:'Review checked companies'}),
        step('pipeline','Companies selected for Buyers',pipeline.length+prospects.length>0,{action:'Select at least one company for Buyers'}),
        step('people','Relevant buyers identified',candidates.some(item=>list(item?.people).length>0)||pipeline.some(item=>list(item?.people).length>0)||prospects.some(item=>list(item?.people).length>0),{action:'Find and qualify buyers for a selected company'}),
        step('buyer-quality',buyerQualityPassed?'Buyer research quality requirements met':'Buyer research quality needs review',buyerQualityPassed,{action:'Complete the buyer quality check and resolve its unmet requirements'})
      ],
      6:[
        step('brand','Sender identity configured',main.brandIdentity?.status==='ready',{optional:true,action:'Configure sender identity in Messages'}),
        step('scenario',studio?'Core information and Calendly configured':'Core message approach approved',studio?studioReady:campaign.coreScenario?.status==='approved',{action:studio?'Review core information and add your Calendly link':'Review and save the core message approach'}),
        step('company','Company selected',Boolean(selectedItem),{action:'Choose a company selected for Buyers'}),
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
    const strategyStatus=input.strategyStatus??(input.main&&Strategy?.status(input.main));
    const internal=stageSteps({...input,strategyStatus});
    const discovery=input.discovery&&typeof input.discovery==='object'?input.discovery:{};
    const candidates=checkedCompanies(discovery),pipeline=list(discovery.pipeline);
    const recovery=companyRecoveryAction(strategyStatus,input.main,input.websiteActivated);
    const groups={
      1:internal[1]||[],
      2:[...(internal[2]||[]),...(internal[3]||[])],
      3:internal[4]||[],
      4:(internal[5]||[]).filter(item=>!['people','buyer-quality'].includes(item.id)),
      5:(internal[5]||[]).filter(item=>['people','buyer-quality'].includes(item.id)),
      6:internal[6]||[],
      7:internal[7]||[]
    };
    const activeJourneyStage=Number(input.activeJourneyStage)||journeyStageForModuleStep(currentStep,input.journeyFocus);
    const model=STAGES.map(definition=>{
      const steps=groups[definition.id]||[];
      const completed=steps.filter(item=>item.complete).length;
      const required=steps.filter(item=>!item.optional);
      const requiredCompleted=required.filter(item=>item.complete).length;
      const optional=steps.filter(item=>item.optional);
      const optionalCompleted=optional.filter(item=>item.complete).length;
      const requiredComplete=required.length?requiredCompleted===required.length:completed===steps.length&&steps.length>0;
      const available=definition.id===1?Boolean(availability[1])
        :definition.id===2?Boolean(availability[2]||availability[3])
        :definition.id===3?Boolean(availability[4])
        :definition.id===4?Boolean(availability[5])
        :definition.id===5?Boolean(availability[5]&&(candidates.length||pipeline.length||list(discovery.selectedProspects).length))
        :Boolean(availability[definition.id]);
      // Selection describes where the customer is looking; completion describes
      // retained outcomes. Opening a finished stage must not reopen its work.
      const active=definition.id===activeJourneyStage;
      const status=requiredComplete?'complete':!available&&!active?'locked':requiredCompleted?'in-progress':'not-started';
      const next=required.find(item=>!item.complete);
      let guidance={nextAction:next?.action||'Required steps complete',nextTarget:next?{stageId:definition.id,itemId:next.id}:null};
      if(definition.id===3&&next?.id==='strategy'&&recovery)guidance=recovery;
      if(definition.id===4&&steps.some(item=>item.id==='companies'&&!item.complete)){
        if(discovery.status==='running')guidance={nextAction:'View company search progress',nextTarget:{stageId:4,itemId:'search-progress'}};
        else if(recovery)guidance=recovery;
        else if(input.companyOutcome?.pendingCount>0&&!input.companyOutcome.targetMet)guidance={nextAction:'Review saved companies',nextTarget:{stageId:4,itemId:'saved-review'}};
      }
      return {...definition,steps,total:steps.length,completed,requiredTotal:required.length,requiredCompleted,requiredComplete,optionalTotal:optional.length,optionalCompleted,available,active,status,...guidance};
    });
    for(const stage of model){
      if(!stage.requiredComplete)continue;
      const next=model.find(candidate=>candidate.id>stage.id&&candidate.available&&!candidate.requiredComplete);
      if(next){stage.nextAction=next.nextTarget?.stageId===next.id?`Continue to ${next.name}`:next.nextAction;stage.nextTarget=next.nextTarget;}
    }
    if(input.syncConflict)for(const stage of model)if(stage.active){stage.nextAction='Resolve workspace synchronization';stage.nextTarget={stageId:stage.id,itemId:'sync-review'};}
    return model;
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
    const currentId=Math.max(1,...list(model).filter(stage=>stage?.active||stage?.status==='current').map(stage=>Number(stage.id)||1));
    for(const stage of list(model)){
      if(Number(stage?.id)<=currentId||stage?.active||['complete','skipped','current'].includes(stage?.status)){
        visible.push(stage.id);
        continue;
      }
      if(!includedNext&&(stage?.available||stage?.status==='available')){
        visible.push(stage.id);
        includedNext=true;
      }
    }
    return visible;
  }

  return {STAGES,buildJourneyModel,companyRecoveryAction,journeyStageForModuleStep,routeForJourneyStage,visibleStageIds,stageStatusLabel};
});
