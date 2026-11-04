(function(root,factory){const D=typeof module==='object'&&module.exports?require('./discovery-engine.js'):root.LeadIntelDiscovery;const api=factory(D);if(typeof module==='object'&&module.exports)module.exports=api;root.LeadIntelAdditionalContactPolicy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(D){
  'use strict';
  function companyReadiness(candidate={},options={}){
    const q=options.companyAssessment||candidate.qualification;
    const gaps=Array.isArray(q?.gaps)?q.gaps:[];
    // Explicit manual enrichment may acquire contact data while purchasing-fit
    // reasoning is pending. Never promote the company to qualified or grant
    // automation; identity, market, exclusions, lifecycle and freshness remain.
    const manualFitPending=options.automatic!==true&&q?.version===2&&q.qualificationKind==='company'&&gaps.length>0&&gaps.every(gap=>gap==='Verify a specific purchasing application for a confirmed offer');
    if((!q?.eligible&&!manualFitPending)||candidate.needsRecheck||['suppressed','archived'].includes(candidate.lifecycle_status))return {eligible:false,reason:'Review company qualification in Companies before a paid lookup.'+(gaps.length?' '+gaps.slice(0,2).join(' · '):''),code:'ADDITIONAL_CONTACT_COMPANY_REQUIRED'};
    const now=Date.parse(options.now||new Date().toISOString()),researched=Date.parse(q.researchedAt||'');
    if(!Number.isFinite(researched)||researched>now+300000||now-researched>30*86400000)return {eligible:false,reason:'Refresh company verification in Companies before a paid lookup.',code:'ADDITIONAL_CONTACT_COMPANY_REQUIRED'};
    return {eligible:true,manualFitPending};
  }
  function readiness(candidate={},person={},options={}){
    const qualification=options.companyAssessment||candidate.qualification;
    const blocked=(reason,code)=>({eligible:false,reason,...(code?{code}:{})});
    const company=companyReadiness(candidate,options);if(!company.eligible)return company;
    if(options.automatic===true&&options.provider==='treg'&&!(Number(qualification.companyScore??qualification.score)>=80))return blocked('Automatic paid search requires checked company fit 80/100 or above.');
    const now=Date.parse(options.now||new Date().toISOString()),researched=Date.parse(qualification.researchedAt||'');
    if(!Number.isFinite(researched)||researched>now+300000||now-researched>30*86400000)return blocked('Refresh company verification before using additional services.');
    if(candidate.buyerRolesChanged||candidate.peopleStatus==='loading'||candidate.publicContactStatus==='loading')return blocked('Complete the current buyer and public research first.');
    const selected=(candidate.people||[]).find(p=>String(p.id)===String(person.id)&&D.buyerIdentity(p)===D.buyerIdentity(person));
    if(!selected)return blocked('This buyer is no longer in the current research. Refresh the buyer list.');
    if(options.automatic===true){
      const priorities=D.mandatoryBuyerResearchPriorities(candidate.people||[],candidate,{forExecution:true});
      if(priorities.length<4||!D.buyerResearchCoveragePassed(candidate,{...options,researchPeople:priorities,allowPartialRoster:true}))return blocked('Complete free research for all four priority buyers before automatic paid search.','ADDITIONAL_CONTACT_PRIORITY_RESEARCH_REQUIRED');
    }
    const scoped=options.automatic!==true||options.provider==='treg';
    if(!D.buyerResearchCoveragePassed(candidate,{...options,...(scoped?{researchPeople:[selected]}:{}),allowPartialRoster:scoped}))return blocked('Complete this buyer’s mandatory public research before using additional services.');
    const profile={decisionMakers:D.effectiveBuyerRoles(candidate)||[...new Set((candidate.people||[]).map(p=>p.matchedBuyerRole||p.title))]};
    const eligible=(candidate.people||[]).filter(p=>D.qualifyBuyer(p,profile,candidate,options).eligible&&D.buyerResearchAssessment(p,options).status==='complete');
    if(options.automatic===true&&options.provider!=='treg'&&new Set(eligible.map(p=>D.buyerIdentity(p))).size<4)return blocked('Complete qualification and public research for four buyers before automatic lookup.');
    if(!eligible.some(p=>D.buyerIdentity(p)===D.buyerIdentity(person))){const q=D.qualifyBuyer(selected,profile,candidate,options),research=D.buyerResearchAssessment(selected,options);return blocked('Complete this buyer’s qualification and public research first. '+(!q.eligible?q.gaps[0]:research.reason));}
    if(options.automatic===true&&options.provider==='treg'){
      const ai=D.safeBuyerAiReview(candidate.publicResearch?.aiReview),age=now-Date.parse(ai?.checkedAt||''),conflicts=[...(candidate.publicResearch?.conflicts||[]),...(ai?.conflicts||[]),...(ai?.findings||[])];
      if(!String(selected.id||'').trim()||(candidate.people||[]).filter(person=>String(person.id)===String(selected.id)).length!==1||ai?.status!=='complete'||ai.inputSignature!==D.buyerReviewSignature(candidate)||!(age>=0&&age<30*86400000)||!ai.reviewedPersonIds.includes(String(selected.id))||conflicts.some(row=>String(row.person_id)===String(selected.id)))return blocked('Complete this buyer’s current AI evidence review before automatic paid search.','ADDITIONAL_CONTACT_REVIEW_REQUIRED');
    }
    if(options.confirmedEmail)return blocked('A confirmed company email is already available.');
    return {eligible:true,manualFitPending:company.manualFitPending,reason:company.manualFitPending?'Company identity and buyer checked; manual lookup approved separately from purchasing-fit review.':'Qualified company and buyer; public contact research completed.',profile};
  }
  const automaticLimit=value=>Number.isInteger(value)&&value>=1&&value<=4?value:1;
  function targets(candidate={},options={}){
    const limit=automaticLimit(options.automaticBuyerLimit);
    const confirmedEmail=options.confirmedEmail||(()=>'' );
    // Choose the approved priority group before checking channels: free/paid success must not
    // silently move automatic spending to the next person in the roster.
    return D.mandatoryBuyerResearchPriorities(candidate.people||[],candidate,{forExecution:true})
      .sort((a,b)=>D.qualifyBuyer(b,{decisionMakers:b.matchedBuyerRole||b.title},candidate).total-D.qualifyBuyer(a,{decisionMakers:a.matchedBuyerRole||a.title},candidate).total||String(a.id).localeCompare(String(b.id))).slice(0,limit)
      .filter(person=>readiness(candidate,person,{...options,automatic:true,confirmedEmail:false}).eligible&&!confirmedEmail(person));
  }
  return {readiness,companyReadiness,targets,automaticLimit};
});

