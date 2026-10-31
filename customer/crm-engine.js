(function(root,factory){const api=factory();if(typeof module!=='undefined'&&module.exports)module.exports=api;if(root)root.LeadIntelCrm=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const EvidencePolicy=typeof module==='object'&&module.exports?require('./evidence-policy.js'):globalThis.LeadIntelEvidencePolicy;
  const STAGES=['Discovered','Qualified','Ready for Outreach','Contacted','Replied','Meeting','Proposal','Won','Lost'];
  const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
  function canonicalDomain(value){if(EvidencePolicy)return EvidencePolicy.companyDomain(value);const raw=clean(value);if(!raw||/\s/.test(raw))return '';try{const url=new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)?raw:`https://${raw}`);return String(url.hostname||'').toLowerCase().replace(/^www\./,'').replace(/\.$/,'');}catch{return '';}}
  function normalizeEmail(value){const email=clean(value).toLowerCase();return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:'';}
  function normalizeCrmStage(value){const stage=clean(value)==='Contact Found'?'Qualified':clean(value);return STAGES.includes(stage)?stage:null;}
  function mapContacts(people=[]){return (Array.isArray(people)?people:[]).slice(0,20).map(person=>{const publicName=clean(person?.publicNameUrl)&&clean(person?.publicName),publicEmail=clean(person?.publicEmailUrl)&&normalizeEmail(person?.publicEmail);return {external_person_id:clean(person?.external_person_id||person?.id)||undefined,name:(clean(person?.name).includes(' ')?clean(person?.name):publicName||clean(person?.name))||undefined,title:clean(person?.title)||undefined,work_email:normalizeEmail(person?.work_email||person?.email)||publicEmail||undefined,email_status:clean(person?.email_status)||(publicEmail?'public_unverified':undefined),linkedin_url:clean(person?.linkedin_url||person?.linkedin||person?.publicLinkedinUrl)||undefined,public_name_url:publicName?clean(person.publicNameUrl):undefined,public_email_url:publicEmail?clean(person.publicEmailUrl):undefined,public_linkedin_url:clean(person?.publicLinkedinUrl)||undefined,source:clean(person?.source)||(person?.corporateRoleEvidence?'company_registry':person?.publicNameUrl?'public_research':'apollo')};}).filter(person=>person.external_person_id||person.work_email||person.name||person.title);}
  function mergeContactEvidence(people=[]){
    const contacts=new Map();
    for(const person of people){
      const key=clean(person.publicName||person.name).toLowerCase()+'|'+clean(person.organization).toLowerCase(),prior=contacts.get(key);
      if(!prior){contacts.set(key,{...person});continue;}
      // The selected buyer owns identity and verified fields; extra records fill gaps.
      for(const [field,value] of Object.entries(person))if((prior[field]===undefined||prior[field]===null||prior[field]==='')&&value!==undefined&&value!==null&&value!=='')prior[field]=value;
    }
    return [...contacts.values()];
  }
  // These are durable research records. Acquisition limits belong to the run,
  // not to serialization of previously retained sources or manual decisions.
  const COMPANY_RESEARCH_FIELDS=['id','crmId','company','website','country','industry','source','opportunity_hypothesis','hypothesis','buyerFit','buyerFitIssue','buyerFitIssueCode','previousNames','market','fitDescription','fitScore','score','priorityScore','confidence','qualification','exclusionCheck','qualificationGaps','needsRecheck','qualified','marketVerified','fitVerified','buyerVerified','buyerRoles','buyerRolesChanged','buyerRolesSource','lookalikeMatch','publicContacts','buyerSearchMode','peopleStatus','publicContactStatus','publicContactVersion','strategyFingerprint','searchContextKey'];
  function detached(value){return JSON.parse(JSON.stringify(value));}
  function companyResearchSnapshot(candidate,domain){
    const snapshot={version:1,domain};
    for(const key of COMPANY_RESEARCH_FIELDS)if(candidate[key]!==undefined)snapshot[key]=candidate[key];
    return snapshot;
  }
  function retainedRows(current,saved){
    const seen=new Set();return [...(Array.isArray(current)?current:[]),...(Array.isArray(saved)?saved:[])].filter(row=>{const key=JSON.stringify(row);if(seen.has(key))return false;seen.add(key);return true;});
  }
  // Pure company patch. A local value owns its decision; saved context fills gaps.
  // Historical evidence remains evidence, never an approval of today's Strategy.
  function restoreCompanyResearch(candidate={},detail={},options={}){
    const company=detail.company||{},domain=canonicalDomain(company.normalized_domain||company.domain||company.website);
    if(!domain||canonicalDomain(candidate.domain||candidate.website)!==domain||options.workspaceId&&company.workspace_id&&clean(options.workspaceId)!==clean(company.workspace_id))return null;
    const intelligence=detail.intelligence||{},snapshot=intelligence.research_snapshot||{},saved=snapshot.companyResearch;
    if(saved&&(!saved.domain||canonicalDomain(saved.domain)!==domain||saved.version!==1))return null;
    const source=saved||snapshot,restored={};
    for(const key of COMPANY_RESEARCH_FIELDS)if(source[key]!==undefined)restored[key]=source[key];
    for(const key of COMPANY_RESEARCH_FIELDS)if(candidate[key]!==undefined)restored[key]=candidate[key];
    Object.assign(restored,{domain,crmId:clean(company.id)||candidate.crmId||saved?.crmId});
    restored.evidence=retainedRows(candidate.evidence,intelligence.evidence);
    restored.matchedSignals=retainedRows(candidate.matchedSignals,intelligence.matched_signals);
    if(options.strategyFingerprint&&saved?.strategyFingerprint!==options.strategyFingerprint)restored.needsRecheck=true;
    return detached(restored);
  }
  function mapDiscoveryCandidateToCrm(candidate={},options={}){const domain=canonicalDomain(candidate.domain||candidate.website);const score=candidate.qualification?.version===2?{total:candidate.qualification.qualificationKind==='company'?candidate.qualification.opportunityScore:candidate.qualification.score,...(candidate.qualification.qualificationKind==='company'?{companyFit:candidate.qualification.companyScore}:{}),buyerFit:candidate.qualification.buyerFitPoints,signals:candidate.qualification.signalPoints}:candidate.score&&typeof candidate.score==='object'?candidate.score:{};const stage=normalizeCrmStage(options.pipelineStage??candidate.pipeline_stage??candidate.stage);return detached({company:{...(clean(candidate.crmId)?{id:clean(candidate.crmId)}:{}),company_name:clean(candidate.company||candidate.company_name||candidate.name)||domain,domain,website:clean(candidate.website)||(domain?`https://${domain}/`:''),country:clean(candidate.country)||undefined,industry:clean(candidate.industry)||undefined,opportunity_score:Number.isFinite(Number(score.total??candidate.opportunity_score))?Math.max(0,Math.min(100,Math.round(Number(score.total??candidate.opportunity_score)))):undefined,confidence:clean(candidate.confidence)||undefined,source:clean(candidate.source)||'discovery',...(stage?{pipeline_stage:stage}:{})},intelligence:{confidence:clean(candidate.qualification?.confidence||candidate.confidence)||undefined,matched_signals:(Array.isArray(candidate.matchedSignals)?candidate.matchedSignals:Array.isArray(candidate.matched_signals)?candidate.matched_signals:[]),evidence:(Array.isArray(candidate.evidence)?candidate.evidence:[]),opportunity_hypothesis:clean(candidate.opportunity_hypothesis||candidate.hypothesis)||undefined,score_breakdown:score,research_snapshot:{companyResearch:companyResearchSnapshot(candidate,domain),market:clean(candidate.market)||undefined,fitDescription:clean(candidate.fitDescription)||undefined,buyerRoles:candidate.buyerRoles,buyerRolesChanged:candidate.buyerRolesChanged===true,buyerFit:candidate.buyerFit,buyerFitIssue:clean(candidate.buyerFitIssue).slice(0,240)||undefined,buyerFitIssueCode:candidate.buyerFitIssueCode==='insufficient_evidence'?'insufficient_evidence':undefined,qualification:candidate.qualification,buyerResearch:{version:2,discovery:{phoneEnrichment:candidate.buyerDiscovery?.phoneEnrichment,companyDossier:candidate.buyerDiscovery?.companyDossier,officialContactInventory:candidate.buyerDiscovery?.officialContactInventory,companyContacts:candidate.buyerDiscovery?.companyContacts,executiveResearch:candidate.buyerDiscovery?.executiveResearch,found:candidate.buyerDiscovery?.found,target:candidate.buyerDiscovery?.target,sourceResults:candidate.buyerDiscovery?.sourceResults,apolloDiscoveryCount:candidate.buyerDiscovery?.apolloDiscoveryCount,resultDiagnostics:candidate.buyerDiscovery?.resultDiagnostics,researchVersion:candidate.buyerDiscovery?.researchVersion,roleSelectionContext:candidate.buyerDiscovery?.roleSelectionContext,opportunityRoles:candidate.buyerDiscovery?.opportunityRoles,expandedRoles:candidate.buyerDiscovery?.expandedRoles,opportunityTerms:candidate.buyerDiscovery?.opportunityTerms,lastError:candidate.buyerDiscovery?.lastError,providerStatus:candidate.buyerDiscovery?.providerStatus,issues:candidate.buyerDiscovery?.issues},publicResearch:candidate.publicResearch,researchIncomplete:candidate.buyerDiscovery?.researchIncomplete===true,checkedAt:candidate.buyerDiscovery?.checkedAt,coverageFollowUp:candidate.buyerDiscovery?.coverageFollowUp,unresolved:(candidate.buyerDiscovery?.pool||[]).filter(p=>p.identityStatus==='pending').slice(0,10).map(p=>({id:p.id,name:p.name,title:p.title,organization:p.organization})),buyers:(candidate.people||[]).slice(0,10).map(p=>({...p,id:p.id,name:p.publicName||p.name,title:p.title,qualification:p.buyerQualification,identitySourceUrl:p.publicNameUrl,identityEvidenceDate:p.identityEvidenceDate,contactVerification:p.contactVerification,emailResearch:p.emailResearch,organization:p.organization,country:p.country,opportunityScope:p.opportunityScope,contactEvidence:{email:p.publicEmail,emailUrl:p.publicEmailUrl,phone:p.publicPhone,phoneUrl:p.publicPhoneUrl,phoneStatus:p.publicPhone?'public_unverified':null,patternFindings:p.patternFindings}}))}}},contacts:mapContacts(mergeContactEvidence([...(candidate.people||candidate.contacts||[]),...(candidate.buyerDiscovery?.companyContacts||[]),...(candidate.buyerDiscovery?.officialContactInventory?.contacts||[])]))});}
  function mapLocalPipelineItemToCrm(item={}){return mapDiscoveryCandidateToCrm(item,{pipelineStage:normalizeCrmStage(item.stage)||'Discovered'});}
  function filterCrmCompanies(companies=[],filters={}){const q=clean(filters.q).toLowerCase(),lifecycle=clean(filters.lifecycle),pipeline=clean(filters.pipeline);return (Array.isArray(companies)?companies:[]).filter(company=>{if(lifecycle&&lifecycle!=='all'&&company.lifecycle_status!==lifecycle)return false;if(pipeline==='active'&&!company.pipeline_stage)return false;if(pipeline&&pipeline!=='active'&&company.pipeline_stage!==pipeline)return false;if(q){const hay=[company.company_name,company.normalized_domain,company.contact_search].map(clean).join(' ').toLowerCase();if(!hay.includes(q))return false;}return true;});}
  function buyerCrmSignature(candidate){
    const value=mapDiscoveryCandidateToCrm(candidate);delete value.company.pipeline_stage;
    const text=JSON.stringify(value);let a=2166136261,b=5381;
    for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}
    return `buyer-crm-v1:${(a>>>0).toString(16)}:${(b>>>0).toString(16)}:${text.length}`;
  }
  function removeBuyerCompanyRecords(bundle={},value){
    const domain=canonicalDomain(value);if(!domain)throw new Error('A company domain is required');
    function prune(value,key=''){
      if(Array.isArray(value))return value.map(item=>prune(item,key)).filter(item=>item!==undefined);
      if(!value||typeof value!=='object')return typeof value==='string'&&/domains?$/i.test(key)&&canonicalDomain(value)===domain?undefined:value;
      const identity=value.domain||value.normalized_domain||value.companyDomain||value.website||value.url;
      if(identity&&canonicalDomain(identity)===domain)return undefined;
      return Object.fromEntries(Object.entries(value).filter(([key])=>canonicalDomain(key)!==domain).map(([key,item])=>[key,prune(item,key)]).filter(([,item])=>item!==undefined));
    }
    const main={...(bundle.main||{})};
    if(Array.isArray(main.targetCompanies))main.targetCompanies=prune(main.targetCompanies);
    const next={main,discovery:prune(bundle.discovery)||{},meta:prune(bundle.meta)||{},outreach:prune(bundle.outreach)||{},delivery:prune(bundle.delivery)||{}};
    if(!next.meta.activeBuyerCompanyDomain)next.meta.activeBuyerCompanyDomain=next.discovery.selectedProspects?.at(-1)?.domain||'';
    return next;
  }
  function isSuppressed(company){return clean(company?.lifecycle_status)==='suppressed';}
  function lifecycleLabel(company){const value=clean(company?.lifecycle_status)||'prospect';return value.charAt(0).toUpperCase()+value.slice(1);}
  return {restoreCompanyResearch,buyerCrmSignature,removeBuyerCompanyRecords,STAGES,canonicalDomain,normalizeEmail,normalizeCrmStage,mapContacts,mapDiscoveryCandidateToCrm,mapLocalPipelineItemToCrm,filterCrmCompanies,isSuppressed,lifecycleLabel};
});
