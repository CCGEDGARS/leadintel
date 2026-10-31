const test=require('node:test'),assert=require('node:assert/strict');
const {sellers,fixture}=require('./helpers/delivery-connected-fixture.cjs');
const P=require('../profile-engine.js'),A=require('../website-activation.js'),I=require('../strategy-integrity.js'),D=require('../discovery-engine.js'),O=require('../outreach-engine.js'),L=require('../delivery-engine.js');
for(const seller of sellers){
 test('composed seven-stage synthetic '+seller.id+': activated seller through researched CRM buyer to saved Delivery preparation',async()=>{
  const f=fixture(seller),now=new Date().toISOString(),c=f.candidate;
  const activated=A.buildActivatedState({targetMarkets:[seller.market]},{url:'https://'+seller.domain,title:seller.company,text:seller.company+' provides '+seller.offer+' for '+seller.target+'.'},now);
  activated.answers=Object.fromEntries(P.QUESTION_IDS.map(id=>[id,'User stated '+id]));Object.assign(activated.answers,{priority_offers:seller.offer,ideal_customer:seller.target,buyer_roles:seller.role,buying_triggers:seller.development});activated.answerStatus=Object.fromEntries(P.QUESTION_IDS.map(id=>[id,'user']));
  activated.profile=P.buildCompanyIntelligenceProfile(JSON.parse(JSON.stringify(activated)));assert.equal(activated.profile.priorityOffers,seller.offer);
  // Explicit synthetic user-review decision. Actual approval controls/persistence
  // are additionally exercised by profile-approval-integrity/strategy-app tests.
  activated.approved=true;activated.brandIdentity=f.main.brandIdentity;const Market=require('../market-engine.js');activated.market={icps:Market.buildIcpCandidates(activated.profile,'en'),signals:Market.normalizeSignals(activated.profile.recommendedSignals),strategyApproved:true};activated.market.strategyApproval=I.approval(activated,now);
  f.main=JSON.parse(JSON.stringify(activated));assert.equal(I.status(f.main).current,true);
  const operating=seller.id==='industrial'?c.company+' operates industrial assembly facilities and purchases structural steel fabrication for new production sites in Finland.':c.company+' operates regional hospital clinics and purchases clinical scheduling software for outpatient operations in Sweden.';
  c.evidence=[{url:c.website+'about',title:c.company+' operations',text:operating,sourceRead:true,evidenceKind:'page_read',extractedAt:now,verifiedAt:now},{url:c.website+'news',title:c.company+' expansion',text:c.company+' '+seller.development+' '+seller.market,date:now,dateSource:'published',sourceRead:true,evidenceKind:'page_read',extractedAt:now,verifiedAt:now}];
  const fit=D.parseBuyerFit(JSON.stringify({companies:[{domain:c.domain,fit:95,offerId:'offer-0',reason:'Specific operational application of '+seller.offer,buyerRole:seller.target,relationship:'buyer',evidence:[{url:c.evidence[0].url,quote:operating}]}]}),[c],f.main.profile)[0];
  fit.matchedSignals=D.matchedSignalsForEvidence(f.main.market.signals,fit.evidence,seller.market,c.company);fit.qualification=D.assessCompanyQualification(fit,f.main.profile,f.main.market,{researchedAt:now});
  assert.equal(fit.qualification.eligible,true,JSON.stringify(fit.qualification));
  assert.equal(fit.qualification.automaticEligible,false);assert.ok(fit.qualification.automaticGaps.includes('Obtain two independent credible source families'));
  fit.people=c.people;fit.buyerRoles=seller.role;fit.buyerDiscovery={opportunityRoles:[seller.role]};
  const receipts=[],team=fit.people.map(p=>p.publicName+' — '+p.title+' at '+c.company+'.').join(' ')+' Synthetic controlled source fixture.';
  await D.runMandatoryBuyerResearch(fit,{search:async query=>{receipts.push({kind:'search',query});return [];},readPage:async url=>{receipts.push({kind:'read',url});return {url,markdown:team,metadata:{sourceURL:url}};}});
  assert.equal(D.buyerResearchCoveragePassed(fit),true,JSON.stringify(fit.publicResearch.accountability));
  await D.runOfficialContactResearch(fit,{search:async()=>[],readPage:async url=>({url,markdown:team})});
  const normalized=D.normalizeDiscoveryState({pipeline:[JSON.parse(JSON.stringify(fit))]}).pipeline[0];
  const mapped=JSON.parse(JSON.stringify(require('../crm-engine.js').mapDiscoveryCandidateToCrm(normalized))),saved=mapped.intelligence.research_snapshot.buyerResearch;
  const reopened={...normalized,people:saved.buyers,buyerDiscovery:saved.discovery,publicResearch:saved.publicResearch};
  assert.ok(receipts.some(row=>row.kind==='search'));assert.ok(receipts.some(row=>row.kind==='read'));assert.equal(D.buyerResearchCoveragePassed(reopened),true);
  assert.equal(D.buyerQualityAssessment(reopened).passed,false);assert.equal(D.buyerQualityAssessment(reopened).aiReviewStatus,'not_assessed');
  const message=O.attachResearchBrief(f.item,reopened,f.main.profile,reopened.people.find(p=>p.id==='teemu'));
  assert.equal(message.dossier.researchBrief.domain,c.domain);assert.equal(message.selectedPersonId,'teemu');
  const normalizedMessage=O.normalizeOutreachState({items:[message]}).items[0];
  const approved=O.approveOutreachItem(normalizedMessage,normalizedMessage.drafts,now,{canonicalState:f.main,canonicalStudio:f.seed.leadintel_customer_v2_outreach.messageStudio});assert.equal(approved.approved,true,approved.error);
  const savedMessage=O.restoreCrmScriptSnapshot(JSON.parse(JSON.stringify(O.buildCrmScriptSnapshot(approved))),c.domain);assert.equal(O.sourceAuthorityCurrent(savedMessage,f.main,f.seed.leadintel_customer_v2_outreach.messageStudio),true);
  const savedPreparation=L.normalizeDeliveryState(JSON.parse(JSON.stringify({selectedDomain:c.domain,selectedPackageKey:L.packageKey(savedMessage)})));
  assert.equal(savedPreparation.selectedPackageKey,L.packageKey(savedMessage));assert.equal(new URL(L.buildGmailComposeUrl(savedMessage,f.contact.work_email)).searchParams.get('to'),f.contact.work_email);assert.equal(savedPreparation.opportunities.length,0);
 });
 test('connected synthetic '+seller.id+': Setup/Profile/Strategy gates reject, recover, reload and stale after evidence edit',()=>{
  assert.equal(P.canBuildProfile({website:'https://'+seller.domain,targetMarkets:[]}),false);
  const activated=A.buildActivatedState({targetMarkets:[seller.market]},{url:'https://'+seller.domain,title:seller.company,text:seller.company+' provides '+seller.offer+'.'},'2026-10-31T09:00:00Z');
  assert.equal(A.isWebsiteActive(activated,'https://'+seller.domain),true);assert.equal(activated.approved,false);assert.equal(activated.profile,null);
  const f=fixture(seller);assert.equal(P.canBuildProfile(f.main),true);assert.equal(I.status(f.main).current,true);
  const answers=Object.fromEntries(P.QUESTION_IDS.map(id=>[id,'User stated '+id]));Object.assign(answers,{priority_offers:seller.offer,ideal_customer:seller.target,buyer_roles:seller.role,buying_triggers:seller.development});
  const built=P.buildCompanyIntelligenceProfile({...activated,answers,answerStatus:Object.fromEntries(Object.keys(answers).map(id=>[id,'user']))});
  assert.equal(built.priorityOffers,seller.offer);assert.equal(built.idealCustomer,seller.target);assert.match(built.decisionMakers,new RegExp(seller.role));
  const saved=JSON.parse(JSON.stringify(f.main));assert.equal(I.status(saved).current,true);saved.approved=false;assert.equal(I.status(saved).code,'profile_unapproved');saved.approved=true;
  saved.scrapedSources[0].text+=' Corrected seller evidence.';assert.equal(I.status(saved).code,'strategy_stale');assert.equal(saved.profile.priorityOffers,seller.offer);
  saved.market.strategyApproval=I.approval(saved);assert.equal(I.status(saved).current,true);assert.equal(saved.market.icps[0].buyerRoles,seller.role);
 });
 test('connected synthetic '+seller.id+': Companies/Buyers CRM snapshot preserves Teemu/Klas identity into exact Delivery preparation',()=>{
  const f=fixture(seller),buyers=f.crm.intelligence.research_snapshot.buyerResearch.buyers;
  assert.equal(buyers.length,2);assert.deepEqual(buyers.map(p=>p.id).sort(),['klas','teemu']);
  for(const p of f.candidate.people)assert.equal(D.qualifyBuyer(p,{decisionMakers:seller.role},f.candidate,{now:'2026-10-31T09:00:00Z'}).eligible,true);
  const quality=D.buyerQualityAssessment(f.candidate);assert.equal(quality.passed,false); // Two names never establish four buyers / two priority work emails.
  const item=O.normalizeOutreachState({items:[JSON.parse(JSON.stringify(f.item))]}).items[0];item.dossier.people.reverse();
  const approved=O.approveOutreachItem(item,item.drafts,'2026-10-31T10:00:00Z',{canonicalState:f.main,canonicalStudio:f.seed.leadintel_customer_v2_outreach.messageStudio});assert.equal(approved.approved,true,approved.error);assert.equal(O.approvedRecipient(approved),f.contact.work_email);
  assert.equal(O.sourceAuthorityCurrent(approved,f.main,f.seed.leadintel_customer_v2_outreach.messageStudio),true);
  const changedMain=JSON.parse(JSON.stringify(f.main));changedMain.scrapedSources[0].text+=' Revised official seller claim.';changedMain.market.strategyApproval=I.approval(changedMain);
  assert.equal(I.status(changedMain).current,true);assert.equal(O.sourceAuthorityCurrent(approved,changedMain,f.seed.leadintel_customer_v2_outreach.messageStudio),false);assert.equal(approved.drafts.emailBody,f.copy.message);
  const reopened=O.restoreCrmScriptSnapshot(JSON.parse(JSON.stringify(O.buildCrmScriptSnapshot(approved))),f.candidate.domain);assert.equal(O.approvalCurrent(reopened),true);
  const url=new URL(L.buildGmailComposeUrl(reopened,f.contact.work_email));assert.equal(url.searchParams.get('to'),f.contact.work_email);assert.equal(url.searchParams.get('su'),f.copy.subject);assert.equal(url.searchParams.get('body'),f.copy.message);
  assert.equal(L.buildGmailComposeUrl(reopened,'klas@'+f.candidate.domain),'');
  reopened.dossier.selectedTrigger.excerpt+=' Corrected source.';assert.equal(O.approvalCurrent(reopened),false);assert.equal(L.buildGmailComposeUrl(reopened,f.contact.work_email),'');
 });
}
test('cross-industry connected context has no seller/role/offer leakage after reload',()=>{
 const a=fixture(sellers[0]),b=fixture(sellers[1]);assert.notEqual(I.signature(a.main),I.signature(b.main));
 for(const [own,other] of [[a,b],[b,a]]){const reloaded=JSON.parse(JSON.stringify(own.seed));assert.equal(reloaded.leadintel_customer_v2_state.profile.priorityOffers,own.seller.offer);assert.equal(reloaded.leadintel_customer_v2_outreach.items[0].messageStudioDraft.essentials.company,own.seller.company);assert.doesNotMatch(reloaded.leadintel_customer_v2_outreach.items[0].drafts.emailBody,new RegExp(other.seller.offer));}
});
