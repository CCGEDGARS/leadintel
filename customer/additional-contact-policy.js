(function(root,factory){const D=typeof module==='object'&&module.exports?require('./discovery-engine.js'):root.LeadIntelDiscovery;const api=factory(D);if(typeof module==='object'&&module.exports)module.exports=api;root.LeadIntelAdditionalContactPolicy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(D){
  'use strict';
  function readiness(candidate={},person={},options={}){
    const qualification=options.companyAssessment||candidate.qualification;
    const blocked=reason=>({eligible:false,reason});
    if(!qualification?.eligible||candidate.needsRecheck||['suppressed','archived'].includes(candidate.lifecycle_status))return blocked('Complete company qualification first.'+(qualification?.gaps?.length?' '+qualification.gaps.slice(0,2).join(' · '):''));
    if(options.automatic===true&&options.provider==='treg'&&!(Number(qualification.companyScore??qualification.score)>=80))return blocked('Automatic paid search requires checked company fit 80/100 or above.');
    const now=Date.parse(options.now||new Date().toISOString()),researched=Date.parse(qualification.researchedAt||'');
    if(!Number.isFinite(researched)||researched>now+300000||now-researched>30*86400000)return blocked('Refresh company verification before using additional services.');
    if(candidate.buyerRolesChanged||candidate.peopleStatus==='loading'||candidate.publicContactStatus==='loading')return blocked('Complete the current buyer and public research first.');
    const selected=(candidate.people||[]).find(p=>String(p.id)===String(person.id)&&D.buyerIdentity(p)===D.buyerIdentity(person));
    if(!selected)return blocked('This buyer is no longer in the current research. Refresh the buyer list.');
    const scope=options.automatic===true&&options.provider!=='treg'?candidate:{...candidate,people:[selected]};
    if(!D.buyerResearchCoveragePassed(scope,{...options,allowPartialRoster:options.provider==='treg'}))return blocked('Complete this buyer’s mandatory public research before using additional services.');
    const profile={decisionMakers:candidate.buyerDiscovery?.opportunityRoles||candidate.buyerRoles||[...new Set((candidate.people||[]).map(p=>p.matchedBuyerRole||p.title))]};
    const eligible=(candidate.people||[]).filter(p=>D.qualifyBuyer(p,profile,candidate,options).eligible&&D.buyerResearchAssessment(p,options).status==='complete');
    if(options.automatic===true&&options.provider!=='treg'&&new Set(eligible.map(p=>D.buyerIdentity(p))).size<4)return blocked('Complete qualification and public research for four buyers before automatic lookup.');
    if(!eligible.some(p=>D.buyerIdentity(p)===D.buyerIdentity(person))){const q=D.qualifyBuyer(selected,profile,candidate,options),research=D.buyerResearchAssessment(selected,options);return blocked('Complete this buyer’s qualification and public research first. '+(!q.eligible?q.gaps[0]:research.reason));}
    if(options.confirmedEmail)return blocked('A confirmed company email is already available.');
    return {eligible:true,reason:'Qualified company and buyer; public contact research completed.',profile};
  }
  function targets(candidate={},options={}){
    const confirmedEmail=options.confirmedEmail||(()=>''),max=Math.max(1,Math.min(2,Number(options.maxPerCompany)||2));
    const ready=(candidate.people||[]).filter(person=>Boolean(confirmedEmail(person))).length;
    if(ready>=max)return [];
    return (candidate.people||[]).filter(person=>readiness(candidate,person,{...options,automatic:true,confirmedEmail:confirmedEmail(person)}).eligible)
      .sort((a,b)=>D.qualifyBuyer(b,{decisionMakers:b.matchedBuyerRole||b.title},candidate).total-D.qualifyBuyer(a,{decisionMakers:a.matchedBuyerRole||a.title},candidate).total).slice(0,max-ready);
  }
  return {readiness,targets};
});
