(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.LeadIntelFlowState=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MAX_SAVED_FLOWS=10,MAX_ACTIVE_FLOWS=2;
  const copy=v=>JSON.parse(JSON.stringify(v||{}));
  const flowMainKeys=['targetMarkets','profile','approved','targetingConfirmation','market','referenceCustomers','referenceCustomerPortfolio','targetCompanies','scriptBuyer','eventCampaigns','activeJourneyStage','visibleStep','step','myFlow'];
  const flowAnswers=['priority_offers','ideal_customer','buyer_roles','exclusions','buying_triggers'];
  const flowProfile=['targetMarkets','priorityOffers','idealCustomer','decisionMakers','exclusions','buyingTriggers','referenceSimilarityModel','referenceDomains','researchMarkets','marketFocus','recommendedSignals'];
  function sharedBusiness(payload={}){
    const main=payload.main||{},answers={...main.answers};for(const key of flowAnswers)delete answers[key];
    const profile=Object.fromEntries(['companyName','companyOverview','valueProposition','differentiation','proofPoints','evidenceDigest','evidenceSources','evidenceCoverage','sourceSummary','mission','capabilities','services'].filter(key=>main.profile?.[key]!==undefined).map(key=>[key,copyValue(main.profile[key])]));
    return {website:main.website||'',answers,profile,brandIdentity:main.brandIdentity||null,scrapedSources:main.scrapedSources||[],websiteActivation:main.websiteActivation||null};
  }
  function composePayload(saved={},current={},flow={}){
    const out=copy(saved),main=copy(current.main);for(const key of flowMainKeys)if(Object.prototype.hasOwnProperty.call(saved.main||{},key))main[key]=copyValue(saved.main[key]);else delete main[key];
    const answers={...(current.main?.answers||{})};for(const key of flowAnswers)if(Object.prototype.hasOwnProperty.call(saved.main?.answers||{},key))answers[key]=saved.main.answers[key];else delete answers[key];main.answers=answers;
    if(saved.main?.profile){main.profile={...saved.main.profile,...sharedBusiness(current).profile};for(const key of flowProfile)if(Object.prototype.hasOwnProperty.call(saved.main.profile,key))main.profile[key]=copyValue(saved.main.profile[key]);}
    main.myFlow={id:flow.id,name:flow.name,stateVersion:flow.state_version};out.main=main;
    // Approved originals and personal libraries belong to the workspace. Drafts belong to this flow.
    const common=current.outreach?.messageStudio||{},studio=out.outreach?.messageStudio;
    if(studio)for(const key of ['originalScripts','myTemplates','linkedinTemplates','essentials'])if(common[key]!==undefined)studio[key]=key==='essentials'?{...copyValue(common[key]),language:studio.essentials?.language||common[key].language}:copyValue(common[key]);
    out.meta={...(out.meta||{}),persistence:{explicit_saved:true}};return out;
  }
  function copyValue(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));}
  function duplicatePayload(payload={},markets){
    const out=copy(payload),main=out.main||{};out.main=main;delete main.myFlow;delete main.scriptBuyer;
    main.targetingConfirmation=null;main.activeJourneyStage=1;main.visibleStep=1;main.step=1;
    main.targetCompanies=[];main.eventCampaigns={};
    if(Array.isArray(markets)&&markets.length){main.targetMarkets=markets.map(x=>String(x).trim()).filter(Boolean);if(main.legacyStrategyContext)main.legacyStrategyContext.growthMarkets=main.targetMarkets.join('; ');if(main.profile){main.profile.targetMarkets=main.targetMarkets.join('; ');main.profile.researchMarkets=main.targetMarkets.slice();main.profile.marketFocus=main.targetMarkets.join('; ');}}
    const market=main.market||{};main.market={...market,strategyApproved:false,researchResults:[],researchReports:[],researchHistory:[],researchRuns:[],monitoringAlerts:[]};
    for(const key of Object.keys(main.market))if(/(?:result|report|history|run|progress|error|alert|selectedCompany|researchAt|researchStatus|monitoring)/i.test(key)&&!['researchInstructions','researchSourceTypes','researchCustomSources'].includes(key))delete main.market[key];
    main.market.researchResults=[];
    out.discovery={};out.delivery={};out.meta={discovery:{},persistence:{explicit_saved:true}};
    const studio=out.outreach?.messageStudio||{};
    out.outreach={messageStudio:Object.fromEntries(['mode','essentials','originalScripts','myTemplates','linkedinTemplates','defaultTemplates','defaultSelection','personalStyles','subjectChoices','linkedinMode','aiLength'].filter(k=>studio[k]!==undefined).map(k=>[k,studio[k]]))};
    return out;
  }
  function reviewChecklist(payload={}){
    return [{id:'markets',label:'Confirm target markets',step:1},{id:'targeting',label:'Confirm customer criteria and buyer roles',step:2},{id:'sources',label:'Review reference companies and scanning websites',step:3},{id:'triggers',label:'Review buying signals for this market',step:4},{id:'language',label:'Confirm outreach language and template',step:6},{id:'schedule',label:'Confirm schedule, volume and shared spending controls',step:7}];
  }
  function summary(payload={},config={}){
    const main=payload.main||{},studio=payload.outreach?.messageStudio||{},market=main.market||{},pipeline=payload.discovery?.pipeline||[];
    return {markets:main.targetMarkets?.length?main.targetMarkets:main.profile?.targetMarkets?[main.profile.targetMarkets]:[],triggers:(market.signals||[]).filter(s=>s.active).map(s=>s.name||s.id),roles:config.buyers?.roles?.length?config.buyers.roles:String(main.answers?.buyer_roles||main.profile?.decisionMakers||'').split(/[,;\n]/).filter(Boolean),template:studio.mode||'Not selected',language:studio.essentials?.language||studio.language||studio.contentLanguage||'Not selected',sources:(market.researchCustomSources||[]).map(s=>typeof s==='string'?s:s.url||s.website||s.name).filter(Boolean),companies:pipeline.length,buyers:pipeline.reduce((n,c)=>n+(c.people||c.buyers||[]).length,0),dailyLimit:config.delivery?.dailyLimit||null};
  }
  function rate(n,d){return d>0?`${Math.round(n/d*1000)/10}%`:'—';}
  return {MAX_SAVED_FLOWS,MAX_ACTIVE_FLOWS,sharedBusiness,composePayload,duplicatePayload,reviewChecklist,summary,rate,flowMainKeys,flowAnswers};
});
