(function(root,factory){const D=typeof module==='object'&&module.exports?require('./discovery-engine.js'):root.LeadIntelDiscovery;const api=factory(D);if(typeof module==='object'&&module.exports)module.exports=api;root.LeadIntelAdditionalContactPolicy=api;})(typeof globalThis!=='undefined'?globalThis:this,function(D){
  'use strict';
  function readiness(candidate={},person={},options={}){
    const qualification=options.companyAssessment||candidate.qualification;
    const blocked=reason=>({eligible:false,reason});
    if(!qualification?.eligible||candidate.needsRecheck||['suppressed','archived'].includes(candidate.lifecycle_status))return blocked('Complete company qualification first.');
    const now=Date.parse(options.now||new Date().toISOString()),researched=Date.parse(qualification.researchedAt||'');
    if(!Number.isFinite(researched)||researched>now+300000||now-researched>30*86400000)return blocked('Refresh company verification before using additional services.');
    if(candidate.buyerRolesChanged||candidate.peopleStatus==='loading'||candidate.publicContactStatus==='loading')return blocked('Complete the current buyer and public research first.');
    const profile={decisionMakers:candidate.buyerDiscovery?.opportunityRoles||candidate.buyerRoles||[...new Set((candidate.people||[]).map(p=>p.matchedBuyerRole||p.title))]};
    const eligible=(candidate.people||[]).filter(p=>D.qualifyBuyer(p,profile,candidate,options).eligible&&D.buyerResearchAssessment(p,options).status==='complete');
    if(new Set(eligible.map(p=>D.buyerIdentity(p))).size<4)return blocked('Complete qualification and public research for four buyers first.');
    if(!eligible.some(p=>D.buyerIdentity(p)===D.buyerIdentity(person)))return blocked('Complete this buyer’s qualification and public research first.');
    if(options.confirmedEmail)return blocked('A confirmed company email is already available.');
    return {eligible:true,reason:'Qualified company and buyer; public contact research completed.',profile};
  }
  function targets(candidate={},options={}){
    const confirmedEmail=options.confirmedEmail||(()=>''),max=Math.max(1,Math.min(2,Number(options.maxPerCompany)||2));
    const ready=(candidate.people||[]).filter(person=>Boolean(confirmedEmail(person))).length;
    if(ready>=max)return [];
    return (candidate.people||[]).filter(person=>readiness(candidate,person,{...options,confirmedEmail:confirmedEmail(person)}).eligible)
      .sort((a,b)=>D.qualifyBuyer(b,{decisionMakers:b.matchedBuyerRole||b.title},candidate).total-D.qualifyBuyer(a,{decisionMakers:a.matchedBuyerRole||a.title},candidate).total).slice(0,max-ready);
  }
  return {readiness,targets};
});
