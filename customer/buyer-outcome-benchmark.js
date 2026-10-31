(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./discovery-engine.js'):root.LeadIntelDiscovery,typeof module==='object'&&module.exports?require('./contact-confirmation-policy.js'):root.LeadIntelContactPolicy);
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.LeadIntelBuyerOutcomes=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(D,Policy){
  'use strict';
  const text=value=>String(value||'').trim(),identity=value=>text(value).replace(/\s+/g,' ').toLowerCase();
  const number=value=>Number.isSafeInteger(value)&&value>0?value:null;
  function retainedReceiptCost(paid){
    const groups=new Map(),owners=new Map();
    for(const row of paid){
      const ids=[...row.paid.callIds].sort();if(!ids.length)continue;
      const group=JSON.stringify(ids),cost=row.paid.costMicro;
      for(const id of ids){if(owners.has(id)&&owners.get(id)!==group)return null;owners.set(id,group);}
      if(groups.has(group)&&groups.get(group)!==cost)return null;
      groups.set(group,cost);
    }
    const costs=[...groups.values()];
    if(!costs.length||costs.some(cost=>cost===null))return null;
    const total=costs.reduce((sum,cost)=>sum+cost,0);return Number.isSafeInteger(total)?total:null;
  }
  // Read-only projection of retained evidence. This module never starts research,
  // grants consent, verifies a mailbox, or changes recipient eligibility.
  function evaluate(candidate={},options={}){
    if(!D||!Policy)throw new Error('Discovery and contact policy must load before buyer outcomes');
    const now=options.now===undefined?Date.now():typeof options.now==='number'?options.now:Date.parse(options.now);
    if(!Number.isFinite(now))throw new TypeError('A valid evaluation time is required');
    const stamp=new Date(now).toISOString(),domain=D.companyIdentityDomain(candidate.domain),people=(candidate.people||[]).slice(0,D.BUYER_CONTACT_RESEARCH_POLICY.maxPeople);
    const ranked=options.ranked||D.rankedBuyerShortlist(people,{decisionMakers:D.effectiveBuyerRoles(candidate)},candidate);
    const priorityIds=new Set(ranked.priorityIds),key=person=>person.id||D.buyerIdentity(person),minimum=Policy.level(options.confirmationLevel);
    const fresh=value=>{const age=now-Date.parse(value||'');return age>=0&&age<30*86400000;};
    const conflicts=[...(candidate.publicResearch?.conflicts||[]),...(candidate.publicResearch?.aiReview?.conflicts||[])];
    const conflict=person=>conflicts.some(row=>String(row.person_id)===String(person.id));
    const result=people.map(person=>{
      const qualification=D.qualifyBuyer(person,{decisionMakers:D.effectiveBuyerRoles(candidate)},candidate,{now:stamp});
      const qualified=qualification.eligible&&!candidate.buyerRolesChanged&&!conflict(person)&&person.opportunityScope?.status!=='review_required';
      const check=person.publicEmailSourceCheck,email=text(person.publicEmail).toLowerCase();
      const sourceConfirmed=qualified&&check?.status==='confirmed'&&fresh(check.checkedAt)&&identity(check.email)===email&&text(check.url)===text(person.publicEmailUrl)&&Policy.publicSource(email,person.publicName||person.name,check.url,domain);
      const contact=options.contactForPerson?.(person,candidate)||{};
      // An email policy validates a contact record, not its association with the
      // selected person. Bind both before reporting a usable recipient.
      const matchingContact=identity(contact.name)===identity(person.publicName||person.name)&&(!text(contact.external_person_id)||String(contact.external_person_id)===String(person.id));
      const usable=qualified&&matchingContact&&Policy.accepted(contact,domain,minimum,now);
      const checks=D.BUYER_CONTACT_RESEARCH_POLICY.requiredChecks.map(name=>{
        const row=person.contactResearch?.checks?.[name];
        return {name,status:row?.status||'not_searched',fresh:fresh(row?.checkedAt),complete:D.buyerResearchCheckPassed(candidate,person,name,{now:stamp}),reason:text(row?.reason)};
      });
      const saved=person.contactData,profile=person.publicLinkedinUrl||person.linkedin_url,paid=saved?.version===1&&D.companyIdentityDomain(saved.domain)===domain&&String(saved.personId)===String(person.id)&&(!saved.identityName||identity(saved.identityName)===identity(person.publicName||person.name))&&(!saved.identityLinkedinUrl||!profile||D.normalizeLinkedInUrl(saved.identityLinkedinUrl)===D.normalizeLinkedInUrl(profile))?saved:null;
      return {personId:text(person.id),name:text(person.publicName||person.name),priority:priorityIds.has(key(person)),identityConfirmed:D.hasFullBuyerName(person.publicName||person.name)&&person.identityStatus!=='pending'&&person.nameVerification!=='pending',qualified,qualificationGaps:qualification.gaps||[],researchStatus:D.buyerResearchAssessment(person,{now:stamp}).status,checks,sourceConfirmedEmail:sourceConfirmed?email:'',usableEmail:usable?text(contact.normalized_email||contact.work_email||contact.email).toLowerCase():'',confirmation:usable?(contact.email_status==='verified'?'provider_verified':'public_confirmed'):'unconfirmed',paid:paid?{status:text(paid.status),checkedAt:text(paid.checkedAt),callIds:[...new Set((paid.callIds||[]).map(text).filter(Boolean))],costMicro:number(paid.costMicro),phoneStatus:text(paid.phone?.status)}:null};
    });
    const byId=new Map(people.map((person,index)=>[key(person),result[index]]));
    const quality=D.buyerQualityAssessment(candidate,{now:stamp,ranked,confirmedEmail:person=>byId.get(key(person))?.usableEmail||''});
    const accountability=D.safeBuyerResearchAccountability(candidate.publicResearch?.accountability),start=Date.parse(accountability?.startedAt||''),end=Date.parse(accountability?.completedAt||'');
    const paid=result.filter(row=>row.paid),priority=result.filter(row=>row.priority);
    const unstarted=!people.length&&!candidate.buyerDiscovery?.checkedAt&&!accountability&&!['error','empty','loading'].includes(candidate.peopleStatus);
    const blockers=quality.requirements.filter(row=>!row.passed).map(row=>({id:row.id,reason:row.reason,action:({official_contacts:'Refresh official contacts',research:'Resume mandatory public research',ai_review:'Review evidence conflicts and rerun AI supervision',four_buyers:'Research missing relevant buyer identities',committee:'Research missing buying functions',emails:'Confirm published priority work emails; use separately approved paid lookup only when eligible'})[row.id]}));
    return {version:1,company:text(candidate.company),domain,evaluatedAt:stamp,evidenceScope:'retained_state',status:unstarted?'not_started':quality.passed?'requirements_met':'needs_attention',quality,blockers,people:result,
      outcomes:{emailTarget:2,priorityTarget:4,retainedPeople:result.length,confirmedIdentities:result.filter(row=>row.identityConfirmed).length,qualifiedBuyers:result.filter(row=>row.qualified).length,priorityBuyers:priority.length,sourceConfirmedPriorityEmails:priority.filter(row=>row.sourceConfirmedEmail).length,usablePriorityEmails:priority.filter(row=>row.usableEmail).length,uniquePriorityEmailAddresses:new Set(priority.map(row=>row.usableEmail).filter(Boolean)).size,usableOtherEmails:result.filter(row=>!row.priority&&row.usableEmail).length,confirmationLevel:minimum},
      coverage:{researchPassed:quality.researchPassed,mandatoryPeopleChecked:result.filter(row=>row.checks.every(check=>check.complete)).length,retainedPeople:result.length,supervisorStatus:quality.aiReviewStatus,supervisorProvider:text(candidate.publicResearch?.aiReview?.provider),reviewedPeople:result.filter(row=>(candidate.publicResearch?.aiReview?.reviewedPersonIds||[]).map(String).includes(row.personId)).length,tools:accountability?.tools||[]},
      execution:{publicResearchElapsedMs:Number.isFinite(start)&&Number.isFinite(end)&&end>=start?end-start:null,stopReason:text(accountability?.stopReason),paidPeopleWithReceipts:paid.filter(row=>row.paid.callIds.length).length,paidCallIds:[...new Set(paid.flatMap(row=>row.paid.callIds))],recordedPaidCostMicro:retainedReceiptCost(paid),costCurrency:'USD',costScope:'Retained contactData receipts only; excludes public research, AI, other provider charges and subscriptions',totalCostKnown:false}};
  }
  return {evaluate};
});
