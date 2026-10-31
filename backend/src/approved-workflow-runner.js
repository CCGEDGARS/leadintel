import {createBuyerSourceSearch} from './buyer-source-search.js';
import {lookupAdditionalEmail,readAdditionalContactPolicy} from './additional-contact-services.js';
import '../../customer/additional-contact-policy.js';
import {researchWorkspaceDossier} from './company-dossier.js';
import '../../customer/company-dossier-ui.js';
import '../../customer/research-brief.js';
import {readOwnedPayload} from './workspace-record-store.js';
import {confirmPublicWorkEmail} from './public-email-confirmation.js';
import '../../customer/contact-confirmation-policy.js';
// Reuse the same evidence, exclusion and role qualification engine as the customer journey.
import '../../customer/discovery-engine.js';
import '../../customer/crm-engine.js';
import '../../customer/lookalike-discovery.js';
import {WORKFLOW_STAGES,approvedContext,normalizeWorkflowConfig,freshEvidence,renderWorkflowMessage,renderDefaultWorkflowMessage} from './approved-workflow-engine.js';
import {parse,workflowMain,workflowAuthorized,workflowRunAuthority,workflowExecutionSnapshot} from './approved-workflow-store.js';
import {requireWorkspaceServiceCredential,resolveWorkspaceServiceCredential,apolloCapabilities,fetchDirectPublicPage,readPublicBuyerPage} from './service-integrations.js';
import {provenBusinessEmail,APOLLO_PEOPLE_SEARCH_URL,apolloSearchBody} from './enrichment.js';
import {upsertCrmCompany,upsertCrmContacts,upsertCrmIntelligence,appendCrmActivity,findCrmCompanyByDomain,getCrmCompany} from './crm.js';
import {reviewWorkspaceBuyerEvidence,searchWorkspaceWeb,searchWorkspaceBuyerContact,generateWorkspaceResearch} from './ai-routes.js';
import {enrichCrmContact} from './crm-routes.js';
import {enqueueApprovedSequence} from './outreach-automation-routes.js';
const discovery=globalThis.LeadIntelDiscovery;
const stop=()=>{throw new Error('Workflow paused, stopped, changed or approval no longer valid');};
async function providerJson(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`Research/enrichment provider returned ${response.status}. Review the connection or credits before retrying.`);return response.json();
}
async function search(env,workspaceId,query,guard){
  await guard();const credential=await requireWorkspaceServiceCredential(env,workspaceId,'firecrawl');
  const url='https://api.firecrawl.dev/v2/search';
  const headers={'Content-Type':'application/json',Accept:'application/json'};if(credential.source==='customer')headers.Authorization=`Bearer ${credential.apiKey}`;
  await guard();const payload=await providerJson(url,{method:'POST',headers,body:JSON.stringify({query:query.query,limit:5,...(query.kind==='market'&&query.market&&query.market!=='priority market'?{location:discovery.searchLocation(query.market)}:{}),scrapeOptions:{formats:['markdown']}})});await guard();
  // Snippets without an extracted page are insufficient for automatic qualification.
  const raw=Array.isArray(payload.data)?payload.data:payload.data?.web||payload.web||[];
  return discovery.normalizeCompanySearchResults({data:raw.filter(item=>String(item.markdown||item.content||item.text||'').trim().length>=120)},query).map(item=>({...item,verifiedAt:new Date().toISOString()}));
}
async function searchBuyerProfiles(env,workspaceId,candidate,roles,guard,accountability){
  const rows=[],issues=[],providerStatus={firecrawl:{status:'pending',results:0,queries:0,failures:[]},grounded:{status:'pending',results:0},identity:{status:'pending',results:0}};
  const sourceSearch=createBuyerSourceSearch(env,workspaceId,{guard,observe:entry=>{if(accountability.status==='running'&&!accountability.completedAt)discovery.recordBuyerResearchTool(accountability,entry);}});
  const plan=discovery.buyerResearchPlan(candidate,{decisionMakers:roles.join('; ')});
  for(const query of plan.queries.slice(0,6)){
    await guard();
    try{
      const found=await sourceSearch(query,{limit:10});rows.push(...found);providerStatus.firecrawl.results+=found.length;providerStatus.firecrawl.sources=[...new Set([...(providerStatus.firecrawl.sources||[]),...(found.searchProviders||[]),...found.map(row=>row.searchProvider)])];
    }catch(error){issues.push(error.message);providerStatus.firecrawl.failures.push({message:error.message,query});}
    providerStatus.firecrawl.queries++;await guard();
  }
  await guard();
  providerStatus.firecrawl.status=providerStatus.firecrawl.failures.length===Math.min(6,plan.queries.length)?'unavailable':providerStatus.firecrawl.failures.length?'partial':'complete';
  try{const grounded=await searchWorkspaceWeb(env,workspaceId,plan.followUp);discovery.recordBuyerResearchTool(accountability,{provider:'grounded',operation:'search',status:grounded.status==='complete'?'succeeded':'failed',results:(grounded.results||[]).length});rows.push(...(grounded.results||[]).map(row=>({...row,buyerSource:'grounded'})));providerStatus.grounded={status:grounded.status==='complete'?'complete':'unavailable',results:(grounded.results||[]).length};if(grounded.status!=='complete')issues.push('Grounded buyer discovery unavailable');}catch(error){discovery.recordBuyerResearchTool(accountability,{provider:'grounded',operation:'search',status:'failed',reason:'Grounded buyer discovery unavailable'});issues.push('Grounded buyer discovery unavailable');providerStatus.grounded={status:'failed',results:0,failures:[{message:error.message}]};}
  await guard();
  const searchIdentityRows=query=>sourceSearch(query,{limit:8});
  const buyerProfile={decisionMakers:plan.roles.join('; '),companyDomain:candidate.domain};
  const initial=discovery.tracePublicBuyers(rows,candidate.company,buyerProfile),coverage=discovery.buyerCoveragePlan(initial.people,buyerProfile,candidate);
  let coverageFailed=0,coverageResults=0;
  for(let i=0;i<coverage.queries.length;i+=2){await guard();const outcomes=await Promise.allSettled(coverage.queries.slice(i,i+2).map(searchIdentityRows));for(const outcome of outcomes){if(outcome.status==='fulfilled'){rows.push(...outcome.value.map(row=>({...row,buyerSource:row.searchProvider||'firecrawl'})));coverageResults+=outcome.value.length;}else{coverageFailed++;issues.push('Missing buyer-function follow-up unavailable');}}}
  const coverageFollowUp={status:coverageFailed?'partial':'complete',queries:coverage.queries.length,results:coverageResults,missing:coverage.missing,checkedAt:new Date().toISOString()};
  const trace=discovery.tracePublicBuyers(rows,candidate.company,buyerProfile);
  for(const source of ['firecrawl','grounded'])providerStatus[source].accepted=new Set(trace.diagnostics.filter(row=>row.source===source&&row.accepted).map(row=>row.parsedName)).size;
  return {coverageFollowUp,people:trace.people,resultDiagnostics:trace.diagnostics,providerStatus,rows,searchIdentityRows,roles:plan.roles,sourceResults:rows.length,issues};
}
export async function researchBuyerContacts(candidate,search,guard,readPage,rows=[],profile={},options={}){
  await discovery.runOfficialContactResearch(candidate,{search,guard,rows,readPage:async(...args)=>{const page=await readPage(...args);for(const entry of page?.researchTrace||[])discovery.recordBuyerResearchTool(candidate.publicResearch?.accountability,entry);return page;}});
  return discovery.runMandatoryBuyerResearch(candidate,{...options,buyerAgentContext:discovery.buyerAgentContext(candidate,profile),search,guard,readPage,rows,accountability:candidate.publicResearch?.accountability});
}

export async function persistWorkflowBuyerResearch(env,context,candidate,guard=async()=>{}){
  context={...context,guard,writeAuthority:guard.writeAuthority};
  await guard();const company=await findCrmCompanyByDomain(env.DB,context.workspaceId,candidate.domain);
  if(!company||company.lifecycle_status!=='prospect')return false;
  const detail=await getCrmCompany(env.DB,context,company.id);await guard();
  const mapped=globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(candidate).intelligence,signatureContext=mapped.research_snapshot;
  const research=signatureContext.buyerResearch,prior=detail.intelligence?.research_snapshot?.buyerResearch;
  if(Date.parse(prior?.checkedAt||'')>Date.parse(research.checkedAt||''))return false;
  if(Date.parse(prior?.discovery?.officialContactInventory?.checkedAt||'')>Date.parse(research.discovery?.officialContactInventory?.checkedAt||''))research.discovery.officialContactInventory=prior.discovery.officialContactInventory;
  await upsertCrmIntelligence(env.DB,context,company.id,{...(detail.intelligence||{}),evidence:Array.isArray(candidate.evidence)?mapped.evidence:detail.intelligence?.evidence||[],research_snapshot:{...(detail.intelligence?.research_snapshot||{}),fitDescription:signatureContext.fitDescription,buyerRoles:signatureContext.buyerRoles,buyerRolesChanged:signatureContext.buyerRolesChanged,...(candidate.qualification?{qualification:candidate.qualification}:{}),...(candidate.buyerFit?{buyerFit:candidate.buyerFit}:{}),buyerResearch:research}});await guard();return true;
}

async function buyer(env,workspaceId,candidate,config,guard,userId,seller={},researchDossier=researchWorkspaceDossier){
  const company=await findCrmCompanyByDomain(env.DB,workspaceId,candidate.domain);
  if(company&&company.lifecycle_status!=='prospect')return null;
  const state=await env.DB.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();
  const saved=((await readOwnedPayload(env,workspaceId,state)).payload).discovery||{};
  const priorRecords=[...(saved.selectedProspects||[]),...(saved.candidates||[]),...(saved.pipeline||[])].filter(item=>discovery.canonicalDomain(item.domain)===candidate.domain);
  const priorPeople=priorRecords.flatMap(item=>[...(item.buyerDiscovery?.pool||[]),...(item.people||[])]);
  const accountability=discovery.createBuyerResearchAccountability();candidate.publicResearch={...(candidate.publicResearch||{}),accountability};
  const dossierPlan=discovery.buyerResearchPlan(candidate,{...seller,decisionMakers:config.buyers.roles.join('; ')});
  const companyDossier=await researchDossier(env,workspaceId,{company:candidate.company,domain:candidate.domain,seller:JSON.parse(discovery.buyerFitContext(seller)),roles:dossierPlan.roles,formulas:dossierPlan.queries,opportunity:candidate.buyerFit?.purchase||candidate.fitDescription||''},{guard});
  await guard();candidate.buyerDiscovery={...(candidate.buyerDiscovery||{}),companyDossier};
  if(companyDossier.status!=='complete'){candidate.buyerDiscovery.researchIncomplete=true;return null;}
  const research=await searchBuyerProfiles(env,workspaceId,candidate,config.buyers.roles,guard,accountability);
  const profile={decisionMakers:research.roles.join('; '),companyDomain:candidate.domain};
  research.rows.push(...globalThis.LeadIntelCompanyDossierUi.evidenceRows(companyDossier));
  let pool=discovery.mergeBuyerPool(priorPeople,[...research.people,...globalThis.LeadIntelCompanyDossier.buyers(companyDossier,candidate.company)],profile);
  candidate.buyerDiscovery={companyDossier,coverageFollowUp:research.coverageFollowUp,researchVersion:"20261004-research-state-v1",target:20,found:pool.length,pool,providerStatus:research.providerStatus,resultDiagnostics:research.resultDiagnostics,sourceResults:research.sourceResults,issues:research.issues,checkedAt:new Date().toISOString()};
  candidate.people=discovery.recommendedBuyers(pool,profile);
  // Identity discovery is allowed before paid/contact confirmation. Use Apollo people search
  // alongside public research; no email/phone reveal or waterfall flags are requested here.
  let directoryPeople=[];
  {
    try{
      await guard();const identityCredential=await resolveWorkspaceServiceCredential(env,workspaceId,'apollo');
      if(identityCredential.configured&&(await apolloCapabilities(env,workspaceId)).discovery){
        const identityHeaders={'Content-Type':'application/json','X-Api-Key':identityCredential.apiKey,Accept:'application/json'};
        await guard();const identityPayload=await providerJson(APOLLO_PEOPLE_SEARCH_URL,{method:'POST',headers:identityHeaders,body:JSON.stringify(apolloSearchBody({domain:candidate.domain,roles:discovery.opportunityBuyerRoles?.(candidate,profile)||config.buyers.roles}))});await guard();
        discovery.recordBuyerResearchTool(accountability,{provider:'apollo',operation:'identity',status:'succeeded',results:(identityPayload.people||[]).length,reason:'Identity-only discovery; no contact reveal'});
        const identityTrace=discovery.traceIdentityBuyers(identityPayload,candidate,profile);
        const identityPeople=identityTrace.people;directoryPeople=identityPeople;
        const expanded=discovery.mergeBuyerPool(pool,identityPeople,profile);
        pool=expanded;candidate.buyerDiscovery={...candidate.buyerDiscovery,found:expanded.length,pool:expanded,identityFallback:'apollo_search',resultDiagnostics:[...candidate.buyerDiscovery.resultDiagnostics,...identityTrace.diagnostics]};candidate.buyerDiscovery.providerStatus.identity={status:'complete',results:identityTrace.diagnostics.length,accepted:identityPeople.length};
        candidate.people=discovery.recommendedBuyers(expanded,profile);
      }else{candidate.buyerDiscovery.issues.push('Identity-provider discovery not configured');candidate.buyerDiscovery.providerStatus.identity.status='not_configured';}
    }catch(error){candidate.buyerDiscovery.issues=[...(candidate.buyerDiscovery.issues||[]),'Identity-provider discovery unavailable'];candidate.buyerDiscovery.providerStatus.identity={status:'failed',results:0,failures:[{message:error.message}]};}
  }
  if(pool.some(person=>person.identityStatus==='pending')){
    const resolved=await discovery.resolvePendingBuyerIdentities(pool,research.rows,candidate,profile,research.searchIdentityRows);
    pool=discovery.mergeBuyerPool([],resolved.people,profile);
    candidate.buyerDiscovery={...candidate.buyerDiscovery,pool,found:pool.length,resultDiagnostics:[...(candidate.buyerDiscovery.resultDiagnostics||[]),...resolved.diagnostics],issues:[...candidate.buyerDiscovery.issues,...resolved.issues]};
    candidate.people=discovery.recommendedBuyers(pool,profile);
  }
  await researchBuyerContacts(candidate,research.searchIdentityRows,guard,async url=>{const result=await readPublicBuyerPage(env,workspaceId,url);return {...result.data,researchTrace:result.researchTrace};},research.rows,profile,{crossCheck:async person=>{await guard();const result=await searchWorkspaceBuyerContact(env,workspaceId,{company:candidate.company,domain:candidate.domain,person:{name:person.publicName||person.name,title:person.title}});await guard();return result;}});
  candidate.publicResearch={...candidate.publicResearch,checkedAt:new Date().toISOString(),patternSearches:candidate.people.reduce((count,person)=>count+(person.emailResearch?.searches||0),0),issues:candidate.people.some(person=>person.emailResearch?.failed)?['Public email evidence searches incomplete']:[]};
  candidate.publicContactStatus=candidate.publicResearch.accountability?.status!=='complete'||candidate.people.some(person=>person.emailResearch?.failed)?'error':'complete';
  await guard();
  if(candidate.publicResearch.buyerAgent)candidate.publicResearch.buyerAgent.inputSignature=discovery.buyerReviewSignature(candidate);
  const review=await reviewWorkspaceBuyerEvidence(env,workspaceId,{buyerAgent:candidate.publicResearch?.buyerAgent,company:candidate.company,people:candidate.people.map(p=>({employer:p.organization,linkedin:p.publicLinkedinUrl||p.linkedin_url,id:p.id,name:p.publicName||p.name,role:p.title,email:p.publicEmail,email_source:p.publicEmailUrl,checks:p.contactResearch?.checks})),evidence:discovery.buyerSupervisorEvidence(candidate.people,research.rows),quality:{depth:discovery.BUYER_CONTACT_RESEARCH_POLICY.version,research_status:accountability.status,checked_people:accountability.checkedPeople,official_pages:accountability.officialPages}},{userId});
  await guard();
  candidate.publicResearch.aiReview=discovery.safeBuyerAiReview({status:review.supervisor?.status||'unavailable',provider:review.provider,checkedAt:new Date().toISOString(),inputSignature:discovery.buyerReviewSignature(candidate),reviewedPersonIds:review.supervisor?.reviewedPersonIds,conflicts:review.conflicts,findings:review.supervisor?.findings,summary:review.summary,reason:review.reason});
  candidate.publicResearch.conflicts=review.conflicts||[];
  pool=discovery.mergeBuyerPool(pool,candidate.people,profile);candidate.buyerDiscovery.pool=pool;
  if(candidate.people.some(person=>['partial','unavailable'].includes(person.emailResearch?.status)))candidate.buyerDiscovery.issues.push('Public email evidence searches incomplete');
  candidate.buyerDiscovery.researchIncomplete=candidate.buyerDiscovery.issues.length>0||pool.some(person=>person.identityStatus==='pending');
  const verified=company?(await env.DB.prepare("SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND LOWER(email_status) IN ('verified','public_confirmed') AND archived_at IS NULL").bind(workspaceId,company.id).all()).results||[]:[];
  // Explicitly kept buyers rank first, but saving alone never bypasses role/email gates.
  const buyerName=person=>String(person.publicName||person.name||'').trim().toLowerCase();
  const knownPeople=[...priorPeople.filter(person=>!pool.some(current=>buyerName(current)===buyerName(person))),...pool];
  const eligible=discovery.selectDecisionMakers(verified,profile,20).filter(p=>String(p.name||'').trim().split(/\s+/).length>=2&&globalThis.LeadIntelContactPolicy.accepted(p,candidate.domain,config.buyers.confirmationLevel)&&!knownPeople.some(person=>buyerName(person)===buyerName(p)&&!discovery.qualifyBuyer(person,profile,candidate).eligible));
  // A user may explicitly select a published company contact as a routing recipient.
  // Keep the actual role; a confirmed email never invents purchasing authority.
  const selectedCompanyContacts=priorPeople.filter(person=>discovery.isSelectedCompanyContact(person,candidate));
  for(const contact of verified){
    if(!selectedCompanyContacts.some(person=>buyerName(person)===buyerName(contact)&&String(person.publicEmail).toLowerCase()===String(contact.normalized_email||contact.work_email).toLowerCase()))continue;
    if(!globalThis.LeadIntelContactPolicy.accepted(contact,candidate.domain,config.buyers.confirmationLevel)||eligible.some(row=>row.id===contact.id))continue;
    eligible.push(contact);
  }
  const pinned=new Set([...candidate.people.filter(p=>p.kept),...selectedCompanyContacts].map(discovery.buyerIdentity));
  eligible.sort((a,b)=>Number(pinned.has(discovery.buyerIdentity(b)))-Number(pinned.has(discovery.buyerIdentity(a))));
  const crmContext={workspaceId,userId,role:'owner',guard,writeAuthority:guard.writeAuthority};
  const paidPolicy=await readAdditionalContactPolicy(env,workspaceId);
  const agentIdentityReady=person=>{const agent=discovery.safeBuyerAgent(candidate.publicResearch?.buyerAgent,candidate.domain),row=agent?.people.find(row=>row.personId===String(person.id));return Boolean(agent&&agent.inputSignature===discovery.buyerReviewSignature(candidate)&&row?.identity==='supported'&&row.checks==='complete');};
  // The Buyer Agent owns the identity gate; providers may enrich but never waive it.
  // Keep a trace for every selected buyer, including policy skips and provider failures.
  const complete=async initialContact=>{
    let contact=initialContact;
    const trace=[];
    const samePeople=candidate.people.filter(p=>String(p.id)===String(contact.external_person_id)||buyerName(p)===buyerName(contact));
    const selected=samePeople.length===1?samePeople[0]:null;
    const identityReady=Boolean(selected&&agentIdentityReady(selected));
    const hasUsablePhone=()=>Boolean(String(contact.phone_number||'').trim())&&['verified','provider_listed'].includes(String(contact.phone_status||'').toLowerCase());
    const record=(provider,status,reason,requestId='')=>trace.push({provider,status,reason,requestId,checkedAt:new Date().toISOString()});
    const commitTrace=()=>{
      candidate.buyerDiscovery.phoneEnrichment={contactId:contact.id,personId:selected?.id||'',identityName:selected?.publicName||selected?.name||'',identityLinkedinUrl:selected?.publicLinkedinUrl||selected?.linkedin_url||'',events:trace,status:hasUsablePhone()?'available':trace.some(t=>t.status==='requested')?'pending':trace.some(t=>t.status==='failed')?'failed':'unavailable',checkedAt:new Date().toISOString()};
    };
    if(hasUsablePhone()){
      record('existing','available','Retained verified or provider-listed number');
    }else if(!identityReady){
      record('buyer_agent','skipped','Current buyer identity evidence is incomplete or ambiguous');
    }else if(paidPolicy.provider==='treg'&&paidPolicy.phoneEnabled){
      if(!selected||!contact.company_id){
        record('treg','skipped','Buyer identity or company reference unavailable');
      }else{
        try{
          await guard();
          await persistWorkflowBuyerResearch(env,crmContext,candidate,guard);
          const result=await lookupAdditionalEmail(env,crmContext,contact.company_id,{person_id:selected.id,contact_id:contact.id,provider:'treg',automatic:true,data_lookup:true,email_lookup:false,phone_approved:true},{guard});
          await guard();
          if(result.contactData)selected.contactData=result.contactData;
          if(result.contact)contact={...contact,phone_number:result.contact.phone_number||contact.phone_number,phone_status:result.contact.phone_status||contact.phone_status};
          record('treg',hasUsablePhone()?'available':'not_found',hasUsablePhone()?'Phone evidence returned':'Provider returned no usable number');
        }catch(error){
          record('treg','failed',error.code||'provider_error');
          candidate.buyerDiscovery.issues.push(error.message||'Treg phone lookup needs attention');
        }
      }
    }else{
      record('treg','skipped','Treg phone enrichment not enabled');
    }
    // Apollo fallback is an independent, explicit phone approval, even if Treg is
    // selected for first-pass discovery. CRM enforces capability, credits and webhook.
    if(!hasUsablePhone()&&identityReady){
      if(config.buyers.confirmPhone!==true||paidPolicy.provider==='treg'&&!paidPolicy.phoneEnabled){
        record('apollo','skipped',paidPolicy.provider==='treg'&&!paidPolicy.phoneEnabled?'Paid phone research is OFF in Settings':'Phone lookup not approved in workflow');
      }else{
        const selectedProfile=discovery.normalizeLinkedInUrl(selected.publicLinkedinUrl||selected.linkedin_url||contact.public_linkedin_url||contact.linkedin_url);
        const matches=directoryPeople.filter(p=>buyerName(p)===buyerName(contact)&&String(p.organization||p.company||'').trim().toLowerCase()===String(candidate.company).trim().toLowerCase()&&(!selectedProfile||!discovery.normalizeLinkedInUrl(p.publicLinkedinUrl||p.linkedin_url)||selectedProfile===discovery.normalizeLinkedInUrl(p.publicLinkedinUrl||p.linkedin_url)));
        const directoryIds=[...new Set(matches.map(p=>String(p.id||p.external_person_id||'').trim()).filter(id=>id&&!/^(public-|person-)/.test(id)))];
        const existingApolloId=String(contact.source||'').toLowerCase()==='apollo'?String(contact.external_person_id||''):'';
        const personId=directoryIds.length===1?directoryIds[0]:directoryIds.length===0&&existingApolloId&&!/^(public-|person-)/.test(existingApolloId)?existingApolloId:'';
        if(!personId){
          record('apollo','skipped',directoryIds.length>1?'Ambiguous Apollo identity match':'No verified Apollo person ID');
        }else{
          try{
            await guard();
            const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'apollo');
            if(!credential.configured){
              record('apollo','skipped','Apollo is not configured');
            }else{
              const runtime=Object.create(env);runtime.APOLLO_WEBHOOK_SECRET=env.APOLLO_WEBHOOK_SECRET||env.APOLLO_API_KEY||'';runtime.APOLLO_WEBHOOK_SERVER_BOUND=true;runtime.APOLLO_API_KEY=credential.apiKey;
              const response=await enrichCrmContact(new Request('https://leadintel.invalid/internal-phone',{method:'POST',body:JSON.stringify({person_id:personId,contact_id:contact.id,name:contact.name,title:contact.title,phone_lookup:true})}),runtime,{}, {context:crmContext,guard},contact.company_id);
              await guard();
              const payload=await response.json();
              if(response.ok){
                if(payload.contact)contact={...contact,...payload.contact};
                record('apollo',hasUsablePhone()?'available':['processing','pending_phone'].includes(payload.request?.status)?'requested':payload.request?.status==='failed'?'failed':'not_found',payload.request?.status||'Apollo request completed',payload.request?.id);
              }else{
                record('apollo','failed',payload.code||'provider_rejected');
                candidate.buyerDiscovery.issues.push(payload.error||'Apollo phone enrichment unavailable');
              }
            }
          }catch(error){
            record('apollo','failed',error.code||'provider_error');
            candidate.buyerDiscovery.issues.push(error.message||'Apollo phone enrichment unavailable');
          }
        }
      }
    }
    commitTrace();
    // Keep the Buyer Agent's provider outcomes in the workspace CRM snapshot.
    // Enrichment request status and later webhook results remain authoritative.
    try{
      await guard();
      await persistWorkflowBuyerResearch(env,crmContext,candidate,guard);
    }catch(error){
      candidate.buyerDiscovery.issues.push('Phone diagnostics could not be saved');
    }
    return {...contact,email:contact.normalized_email||contact.work_email};
  };
  if(eligible[0])return complete(eligible[0]);

  if((paidPolicy.enabled||paidPolicy.phoneEnabled)&&paidPolicy.provider==='treg'){
    const targets=globalThis.LeadIntelAdditionalContactPolicy.targets(candidate,{provider:'treg',maxPerCompany:1}).filter(agentIdentityReady);
    const targetPerson=targets[0],review=candidate.publicResearch.aiReview;
    const affects=entry=>!entry.person_id||String(entry.person_id)===String(targetPerson?.id);
    if(targetPerson&&review?.status==='complete'&&review.reviewedPersonIds?.includes(String(targetPerson.id))&&!review.findings?.some(affects)&&!review.conflicts?.some(affects)){
      await guard();const paidCompany=company||(await upsertCrmCompany(env.DB,crmContext,{...candidate,source:'approved_workflow_qualified'})).company;await persistWorkflowBuyerResearch(env,crmContext,candidate,guard);
      const result=await lookupAdditionalEmail(env,crmContext,paidCompany.id,{person_id:targetPerson.id,provider:'treg',automatic:true,data_lookup:paidPolicy.phoneEnabled,phone_approved:paidPolicy.phoneEnabled,email_lookup:paidPolicy.enabled},{guard});await guard();
      candidate.buyerDiscovery.paidResearch=result.research;
      if(result.contactData)targetPerson.contactData=result.contactData;
      if(result.contact&&globalThis.LeadIntelContactPolicy.accepted(result.contact,candidate.domain,config.buyers.confirmationLevel))return complete(result.contact);
      candidate.buyerDiscovery.issues.push(result.reason||'Treg did not confirm a usable work email.');
    }else candidate.buyerDiscovery.issues.push(targetPerson?'AI review for the strongest buyer needs attention.':'Complete the strongest buyer’s required public checks before paid search.');
    candidate.buyerDiscovery.contactConfirmationRequired=true;return null;
  }
  if(candidate.publicResearch.aiReview?.status!=='complete'||candidate.publicResearch.aiReview.findings.length){candidate.buyerDiscovery.contactConfirmationRequired=true;candidate.buyerDiscovery.issues.push('AI supervisor review is incomplete or has unresolved evidence gaps; review before choosing a new automatic recipient');return null;}
  if(config.buyers.confirmationLevel==='public_confirmed'){
    const target=company||(await upsertCrmCompany(env.DB,crmContext,{...candidate,source:'approved_workflow_qualified'})).company;
    for(const person of candidate.people.slice(0,10)){
        if(!agentIdentityReady(person))continue;
      await guard();
      if(!discovery.qualifyBuyer(person,profile,candidate).eligible)continue;
      const findings=[...(person.patternFindings||[]),...(person.publicEmail?[{email:person.publicEmail,url:person.publicEmailUrl}]:[])];
      const source=findings.find(item=>globalThis.LeadIntelContactPolicy.publicSource(item.email,person.publicName||person.name,item.url,candidate.domain));if(!source)continue;
      try{const contact=await confirmPublicWorkEmail(env,crmContext,target.id,{name:person.publicName||person.name,title:person.title,person_id:person.id,email:source.email,source_url:source.url},{guard});await guard();if(globalThis.LeadIntelContactPolicy.accepted(contact,candidate.domain,config.buyers.confirmationLevel))return complete(contact);}catch(error){candidate.buyerDiscovery.issues.push(error.message);}
    }
  }
  if(paidPolicy.provider==='treg'){candidate.buyerDiscovery.contactConfirmationRequired=true;return null;}
  if(accountability.status!=='complete'){candidate.buyerDiscovery.contactConfirmationRequired=true;candidate.buyerDiscovery.issues.push('Mandatory public contact research is incomplete; resume checks before additional services');return null;}
  // Owner-approved automatic confirmation uses the same cache and credit
  // policy as manual Apollo enrichment. Phone requires its own approval; personal email remains excluded.
  if(config.buyers.confirmContacts===true&&(await apolloCapabilities(env,workspaceId)).email){
    const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'apollo');
    if(credential.configured){
      const crmContext={workspaceId,userId,role:'owner',guard,writeAuthority:guard.writeAuthority};
      const target=company||(await upsertCrmCompany(env.DB,crmContext,{...candidate,source:'approved_workflow_qualified'})).company;
      await env.DB.prepare('INSERT OR IGNORE INTO enrichment_policies(workspace_id) VALUES(?)').bind(workspaceId).run();
      const runtime=Object.create(env);runtime.APOLLO_WEBHOOK_SECRET=env.APOLLO_WEBHOOK_SECRET||env.APOLLO_API_KEY||'';runtime.APOLLO_WEBHOOK_SERVER_BOUND=true;runtime.APOLLO_API_KEY=credential.apiKey;
      for(const person of candidate.people.slice(0,10)){
        if(!agentIdentityReady(person))continue;
        await guard();
        if(person.identityStatus==='pending'||!discovery.hasFullBuyerName(person.publicName||person.name)||!discovery.qualifyBuyer(person,profile,candidate).eligible)continue;
        // Public-derived IDs cannot be sent to Apollo. Resolve an attributable
        // directory identity first using the existing identity trace.
        const matches=directoryPeople.filter(item=>String(item.publicName||item.name).trim().toLowerCase()===String(person.publicName||person.name).trim().toLowerCase()||Boolean(person.publicLinkedinUrl&&item.linkedin_url===person.publicLinkedinUrl));
        const publicId=/^(public-|person-)/.test(String(person.id));
        const personId=publicId?(matches.length===1?matches[0].id:null):person.id;
        if(!personId||String(personId).startsWith('public-'))continue;
        const request=new Request('https://leadintel.invalid/internal-enrich',{method:'POST',body:JSON.stringify({person_id:personId,name:person.publicName||person.name,title:person.title,phone_lookup:false,allow_personal_email:false})});
        const response=await enrichCrmContact(request,runtime,{}, {context:crmContext,guard},target.id);await guard();
        const value=await response.json();
        const email=provenBusinessEmail({email:value.contact?.normalized_email,email_status:value.contact?.email_status},candidate.domain);
        if(response.ok&&email){candidate.buyerDiscovery.contactConfirmationRequired=false;return complete(value.contact);}
        candidate.buyerDiscovery.issues.push(value.error||'Apollo did not return an attributable verified company email');
        if(response.status===429)break;
      }
    }
  }
  candidate.buyerDiscovery.contactConfirmationRequired=true;

  return null;
}
export async function executeWorkflowStage(stage,{env,row,run,result,context,config,guard,generateResearch=generateWorkspaceResearch,researchDossier=researchWorkspaceDossier}){
  await guard();const market={icps:context.icps,signals:context.signals},profile={...discovery.effectiveTargetingProfile({...context.profile,website:context.website||context.profile?.website},market),discoveryPriority:config.companies.researchPriority,decisionMakers:config.buyers.roles.join('; ')};
  if(stage==='profile'||stage==='strategy')return {...result,contextValidated:true};
  if(stage==='companies'){
    const state=await env.DB.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').bind(row.workspace_id).first();
    const savedDiscovery=(await readOwnedPayload(env,row.workspace_id,state)).payload.discovery||{};
    profile.searchFeedback=discovery.searchFeedbackForProfile(savedDiscovery.searchFeedback,discovery.effectiveTargetingProfile(profile,market));await guard();
    if(config.companies.researchPriority==='signals')profile.referenceSimilarityModel=null;
    const baseQueries=discovery.buildDiscoveryQueries(profile,market,config.companies.queries);
    const customSources=(context.researchCustomSources||[]).map(item=>{try{return new URL(typeof item==='string'?item:item.url).hostname;}catch{return '';}}).filter(Boolean).slice(0,3);
    const sourceTerms={news:'news announcement',jobs:'careers hiring',investments:'investment expansion',company:'company newsroom',registries:'business registry'};
    const queries=baseQueries.map((query,index)=>({...query,query:[query.query,customSources[index]?'site:'+customSources[index]:sourceTerms[(context.researchSourceTypes||[])[index%(context.researchSourceTypes?.length||1)]]||'',String(context.researchInstructions||'').slice(0,500)].filter(Boolean).join(' ')}));
    const results=(context.knownEvidence||[]).flatMap(item=>discovery.normalizeCompanySearchResults({data:[item]},{id:'approved-research',market:item.market||profile.targetMarkets.split(/[,;]/)[0]}));if(!queries.length)throw new Error('Approved targeting did not produce research queries');
    for(const query of queries)results.push(...await search(env,row.workspace_id,query,guard));
    // Follow up at company level before the automatic evidence/fit gate.
    const mentions=discovery.prioritizeCompanyMentions(discovery.extractCompanyMentions(results,60),results,profile,30);
    const resolutions=[];
    for(const query of discovery.buildCompanyResolutionQueries(mentions,profile,Math.min(10,config.companies.limit*2)))resolutions.push(...await search(env,row.workspace_id,query,guard));
    const linked=discovery.attachSourceEvidenceToResolvedCompanies(resolutions,mentions,results);results.unshift(...linked);
    const initialQualified=discovery.mergeCompanyCandidates(results,profile,market,30);
    const provisional=[...initialQualified,...discovery.buildPotentialCompanyCandidates(results,profile,market,initialQualified,30)];
    for(const query of discovery.buildCandidateVerificationQueries(provisional,profile,market,Math.min(10,config.companies.limit*2)))results.push(...await search(env,row.workspace_id,query,guard));
    // Research additional candidates when the first pass cannot meet the requested qualified count.
    const firstPass=discovery.mergeCompanyCandidates(results,profile,market,30);
    if(firstPass.filter(c=>discovery.assessAutomaticCompanyQualification(c,profile,market,{...config.companies,...config.triggers,researchedAt:new Date().toISOString()}).eligible).length<config.companies.limit){
      const adaptive=discovery.buildDiscoveryFollowUpQueries({...profile,discoveryResearchOutcome:{checkedDomains:resolutions.map(r=>r.domain),matchedCount:0}},market,queries,4);queries.push(...adaptive);
      const extra=[];for(const query of adaptive)extra.push(...await search(env,row.workspace_id,query,guard));
      const known=new Set(mentions.map(item=>discovery.companyMentionKey(item.company)));
      const names=discovery.prioritizeCompanyMentions(discovery.extractCompanyMentions(extra,60),extra,profile,10).filter(item=>!known.has(discovery.companyMentionKey(item.company))),resolved=[];
      for(const query of discovery.buildCompanyResolutionQueries(names,profile,10))resolved.push(...await search(env,row.workspace_id,query,guard));
      results.push(...discovery.attachSourceEvidenceToResolvedCompanies(resolved,names,extra),...extra);
      for(const query of discovery.buildCandidateVerificationQueries(resolved,profile,market,10,{excludeDomains:provisional.map(r=>r.domain)}))results.push(...await search(env,row.workspace_id,query,guard));
    }
    const signalCandidates=discovery.mergeCompanyCandidates(results,profile,market,30);
    let pool=[...signalCandidates,...discovery.buildPotentialCompanyCandidates(results,profile,market,signalCandidates,30)];
    const rejected=new Set(profile.searchFeedback.filter(row=>row.decision!=='good_fit').map(row=>row.domain));
    pool=pool.filter(candidate=>!rejected.has(discovery.companyIdentityDomain(candidate.domain)));
    if(profile.referenceSimilarityModel)pool=await discovery.researchEvidenceSimilarity({candidates:pool,model:profile.referenceSimilarityModel,workspaceId:row.workspace_id,fetchImpl:async(url,options)=>{await guard();const body=JSON.parse(options.body),text=await generateResearch(env,row.workspace_id,body.prompt);await guard();return {ok:true,json:async()=>({text})};}});
    pool=await discovery.researchBuyerFit(pool,profile,async prompt=>{await guard();const text=await generateResearch(env,row.workspace_id,prompt);await guard();return text;});
    const researchedAt=new Date().toISOString();
    const assessed=pool.map(candidate=>({...candidate,qualification:discovery.assessAutomaticCompanyQualification(candidate,profile,market,{...config.companies,...config.triggers,researchedAt})}));
    const candidates=[];
    for(const candidate of discovery.rankQualifiedCompanies(assessed.filter(c=>c.qualification.eligible))){
      const saved=await findCrmCompanyByDomain(env.DB,row.workspace_id,candidate.domain);if(saved&&saved.lifecycle_status!=='prospect')continue;
      candidates.push({...candidate,qualified:true,buyerVerified:true,qualificationGaps:[],score:{total:candidate.qualification.score,fit:candidate.qualification.buyerFitPoints,signal:candidate.qualification.signalPoints},matchedSignals:candidate.qualification.matchedSignals});if(candidates.length>=config.companies.limit)break;
    }
    // Automatic mode owns the qualified-company handoff: every candidate here has already
    // passed score >= approved minimum plus every mandatory evidence/identity/fit gate.
    // Persist it immediately so a later buyer/provider failure cannot lose a qualified opportunity.
    if(config.crm.saveQualified){
      const crmContext={workspaceId:row.workspace_id,userId:row.approved_by,role:'owner',guard,writeAuthority:guard.writeAuthority};
      for(const candidate of candidates){
        await guard();
        const existing=await findCrmCompanyByDomain(env.DB,row.workspace_id,candidate.domain);
        if(existing&&existing.lifecycle_status!=='prospect')continue;
        await guard();const saved=await upsertCrmCompany(env.DB,crmContext,{...candidate,pipeline_stage:'Discovered',source:'approved_workflow_qualified'});
        await guard();await upsertCrmIntelligence(env.DB,crmContext,saved.company.id,{matched_signals:candidate.matchedSignals,evidence:candidate.evidence,score_breakdown:{...candidate.score,qualification:candidate.qualification},confidence:candidate.qualification?.confidence||candidate.confidence,research_snapshot:{flowId:row.id||null,runId:run.id,revision:row.revision,researchAt:researchedAt,buyerFit:candidate.buyerFit,qualification:candidate.qualification,automaticQualifiedSave:true}});
      }
    }
    return {...result,requestedCount:config.companies.limit,qualifiedCount:candidates.length,shortfall:Math.max(0,config.companies.limit-candidates.length),queries,candidates,reviewCompanies:assessed.filter(c=>!c.qualification.eligible),researchedAt,sourceCount:new Set(results.map(r=>r.url)).size};
  }
  if(stage==='buyers'){
    const candidates=[],reviewBuyers=[];for(const candidate of discovery.rankQualifiedCompanies(result.candidates||[])){await guard();const contact=await buyer(env,row.workspace_id,candidate,config,guard,row.approved_by,profile,researchDossier);if(candidate.buyerDiscovery)await persistWorkflowBuyerResearch(env,{workspaceId:row.workspace_id,userId:row.approved_by,role:'owner'},candidate,guard);if(contact)candidates.push({...candidate,contact});else reviewBuyers.push({...candidate,reason:'No verified eligible business contact'});}
    return {...result,candidates,reviewBuyers,skippedWithoutVerifiedBuyer:reviewBuyers.length};
  }
  if(stage==='triggers')return {...result,candidates:(result.candidates||[]).filter(c=>discovery.assessAutomaticCompanyQualification(c,profile,market,{...config.companies,...config.triggers,researchedAt:result.researchedAt}).eligible)};
  if(stage==='messages'){
    const reviewMessages=[];const candidates=(result.candidates||[]).flatMap(candidate=>{try{if(context.outreachDefault)return [{...candidate,message:{...renderDefaultWorkflowMessage(context,candidate),followup_body:''}}];const evidence=freshEvidence(candidate,config.triggers.maxEvidenceAgeDays)[0]||(candidate.evidence||[]).find(e=>{const checked=Date.parse(e.verifiedAt),age=Date.now()-checked;return discovery.companyIdentityDomain(e.url)===discovery.companyIdentityDomain(candidate.domain)&&Number.isFinite(checked)&&age>=-300000&&age<=config.triggers.maxEvidenceAgeDays*86400000;}),values={firstName:candidate.contact.first_name||String(candidate.contact.name||'').split(' ')[0],company:candidate.company,sender:profile.companyName,offer:profile.priorityOffers,evidenceUrl:evidence?.url};return [{...candidate,message:{subject:renderWorkflowMessage(config.messages.subject,values),body:renderWorkflowMessage(config.messages.body,values),followup_body:renderWorkflowMessage(config.messages.followup,values)}}];}catch(error){reviewMessages.push({domain:candidate.domain,contactId:candidate.contact?.id||null,reason:String(error?.message||'Message generation failed').slice(0,500),code:'MESSAGE_REVIEW_REQUIRED'});return [];}});return {...result,candidates,reviewMessages};
  }
  const crmContext={workspaceId:row.workspace_id,userId:row.approved_by,role:'owner',guard,writeAuthority:guard.writeAuthority};
  if(stage==='crm'){
    const candidates=[];for(const candidate of result.candidates||[]){await guard();const old=await findCrmCompanyByDomain(env.DB,row.workspace_id,candidate.domain);if(old&&old.lifecycle_status!=='prospect')continue;
      await guard();const saved=await upsertCrmCompany(env.DB,crmContext,{...candidate,pipeline_stage:'Ready for Outreach',source:'approved_workflow'});await guard();
      const contacts=await upsertCrmContacts(env.DB,crmContext,saved.company.id,[{...candidate.contact,work_email:candidate.contact.email,email_status:'verified'}]);await guard();
      await upsertCrmIntelligence(env.DB,crmContext,saved.company.id,{matched_signals:candidate.matchedSignals,evidence:candidate.evidence,score_breakdown:{...candidate.score,qualification:candidate.qualification},confidence:candidate.confidence,research_snapshot:{flowId:row.id||null,runId:run.id,revision:row.revision,researchAt:result.researchedAt,buyerFit:candidate.buyerFit,qualification:candidate.qualification,...(candidate.buyerDiscovery?{buyerResearch:globalThis.LeadIntelCrm.mapDiscoveryCandidateToCrm(candidate).intelligence.research_snapshot.buyerResearch}:{})}});await guard();
      await appendCrmActivity(env.DB,crmContext,{id:`workflow-message-${run.id}-${saved.company.id}`,companyId:saved.company.id,type:'dossier.built',summary:'Message generated under approved workflow template',metadata:{flow_id:row.id||null,run_id:run.id,revision:row.revision,subject:candidate.message.subject,body:candidate.message.body,approval:'workflow_template',script_package:{version:1,savedAt:new Date().toISOString(),item:{domain:candidate.domain,company:candidate.company,researchStatus:'complete',researchAt:result.researchedAt,selectedPersonId:contacts[0]?.id||candidate.contact.id,approved:false,dossier:{company:candidate.company,domain:candidate.domain,website:candidate.website,market:candidate.market,recommendedOffer:profile.priorityOffers,buyerRoles:config.buyers.roles,evidence:candidate.evidence,matchedSignals:candidate.matchedSignals,people:[{...candidate.contact,id:contacts[0]?.id||candidate.contact.id}]},drafts:{emailSubject:candidate.message.subject,emailBody:candidate.message.body,followUp:candidate.message.followup_body}}}}});
      candidates.push({...candidate,contact:{...candidate.contact,id:contacts[0]?.id||candidate.contact.id},crmId:saved.company.id});}return {...result,candidates};
  }
  if(stage==='delivery'){
    let queued=0,skipped=0;for(const candidate of result.candidates||[]){await guard();const response=await enqueueApprovedSequence(env,{},row.workspace_id,{user:{id:row.approved_by},member:{role:'owner'},guard},{...candidate.message,domain:candidate.domain,recipient:candidate.contact.email,contact_identity:candidate.contact.id||candidate.contact.name,recipient_snapshot:{id:candidate.contact.id,contactId:candidate.contact.id,name:candidate.contact.name||'',title:candidate.contact.title||'',email:candidate.contact.email||'',linkedin:candidate.contact.linkedin_url||candidate.contact.linkedin||'',companyDomain:candidate.domain},approved:true,approved_at:row.approved_at},{runId:run.id,revision:row.revision});const value=await response.json();if(!response.ok){if(value.code==='AUTOMATION_RECIPIENT_ALREADY_CONTACTED'||value.code==='CRM_COMPANY_SUPPRESSED'||value.code==='CONTACT_SUPPRESSED'){skipped++;continue;}throw new Error(value.error||'Could not queue approved message');}if(!value.duplicate)queued++;}
    return {...result,queued,skipped};
  }
  throw new Error('No executor for workflow stage');
}
export async function runApprovedWorkflows(env,{workspaceId='',maxWorkspaces=3,execute=executeWorkflowStage,now=new Date()}={}){
  const sql=workspaceId?"SELECT * FROM approved_workflows WHERE workspace_id=? AND status='automatic'":"SELECT w.* FROM approved_workflows w WHERE w.status='automatic' AND NOT EXISTS (SELECT 1 FROM approved_workflow_runs r WHERE r.workspace_id=w.workspace_id AND r.flow_id IS NULL AND r.revision=w.revision AND r.status='blocked') ORDER BY w.next_run_at LIMIT ?";
  const {results:rows=[]}=await env.DB.prepare(sql).bind(workspaceId||maxWorkspaces).all();const summary={completed:0,blocked:0,skipped:0};
  for(const row of rows){
    if(!await workflowAuthorized(env,row.workspace_id,row.revision)){summary.skipped++;continue;}
    let run=await env.DB.prepare("SELECT * FROM approved_workflow_runs WHERE workspace_id=? AND flow_id IS NULL AND revision=? AND status IN ('running','blocked') ORDER BY created_at DESC LIMIT 1").bind(row.workspace_id,row.revision).first();
    if(run?.status==='blocked'){summary.skipped++;continue;}
    if(!run){if(row.next_run_at&&new Date(row.next_run_at)>now){summary.skipped++;continue;}const id=crypto.randomUUID();await env.DB.prepare("INSERT OR IGNORE INTO approved_workflow_runs(id,workspace_id,revision,status) VALUES(?,?,?,'running')").bind(id,row.workspace_id,row.revision).run();run=await env.DB.prepare('SELECT * FROM approved_workflow_runs WHERE id=?').bind(id).first();if(!run){summary.skipped++;continue;}}
    if(run.lease_token){if(new Date(run.lease_until)>now){summary.skipped++;continue;}await env.DB.prepare("UPDATE approved_workflow_runs SET status='blocked',error_message='Execution was interrupted. Review before retrying; provider usage may already have occurred.',lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=? AND lease_until<=?").bind(run.id,run.lease_token,now.toISOString()).run();summary.blocked++;continue;}
    const token=crypto.randomUUID(),claim=await env.DB.prepare("UPDATE approved_workflow_runs SET lease_token=?,lease_until=? WHERE id=? AND status='running' AND lease_token IS NULL").bind(token,new Date(now.getTime()+15*60000).toISOString(),run.id).run();if(!claim.meta?.changes){summary.skipped++;continue;}
    const leaseStartedAt=Date.now(),executionTime=()=>new Date(now.getTime()+Math.max(0,Date.now()-leaseStartedAt)).toISOString();
    let authoritySnapshot=null;
    const guard=async()=>{for(let attempt=0;attempt<3;attempt++){
      const snapshot=await workflowExecutionSnapshot(env,row,run);if(!snapshot.valid){if(snapshot.retry)continue;stop();}
      const lease=await env.DB.prepare('SELECT status,lease_token,lease_until FROM approved_workflow_runs WHERE id=?').bind(run.id).first();if(lease?.status!=='running'||lease.lease_token!==token||!(Date.parse(lease.lease_until)>Date.parse(executionTime())))stop();
      const authority=workflowRunAuthority(row,run,token,executionTime(),snapshot),current=await env.DB.prepare('SELECT lease_until FROM approved_workflow_runs WHERE id=? AND '+authority.sql).bind(run.id,...authority.args).first();if(current&&Date.parse(current.lease_until)>Date.parse(executionTime())){authoritySnapshot=snapshot;return;}
    }stop();};
    guard.writeAuthority=()=>{const authority=workflowRunAuthority(row,run,token,executionTime(),authoritySnapshot);return {sql:'EXISTS(SELECT 1 FROM approved_workflow_runs WHERE id=? AND '+authority.sql+')',args:[run.id,...authority.args]};};
    let result=parse(run.result_json);try{
      const context=approvedContext(await workflowMain(env,row.workspace_id)),config=normalizeWorkflowConfig(parse(row.config_json),context);
      for(let index=run.stage_index;index<WORKFLOW_STAGES.length;index++){
        result=await execute(WORKFLOW_STAGES[index],{env,row,run,result,context,config,guard});await guard();
        let checkpoint;for(let attempt=0;attempt<3;attempt++){const authority=workflowRunAuthority(row,run,token,executionTime(),authoritySnapshot);checkpoint=await env.DB.prepare('UPDATE approved_workflow_runs SET stage_index=?,result_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND '+authority.sql).bind(index+1,JSON.stringify(result),run.id,...authority.args).run();if(checkpoint.meta?.changes)break;await guard();}if(!checkpoint?.meta?.changes)stop();
      }
      let completed;for(let attempt=0;attempt<3;attempt++){await guard();const authority=workflowRunAuthority(row,run,token,executionTime(),authoritySnapshot);completed=await env.DB.batch([env.DB.prepare("UPDATE approved_workflow_runs SET status='completed',lease_token=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND "+authority.sql).bind(run.id,...authority.args),env.DB.prepare("UPDATE approved_workflows SET next_run_at=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=? AND status='automatic' AND approved_by=? AND EXISTS(SELECT 1 FROM workspace_members WHERE workspace_id=approved_workflows.workspace_id AND user_id=approved_workflows.approved_by AND role='owner') AND EXISTS(SELECT 1 FROM approved_workflow_runs WHERE id=? AND status='completed')").bind(new Date(now.getTime()+(config.delivery.frequency==='weekly'?7:1)*86400000).toISOString(),row.workspace_id,row.revision,row.approved_by,run.id)]);if(completed[0]?.meta?.changes)break;}if(!completed?.[0]?.meta?.changes)stop();summary.completed++;
    }catch(cause){await env.DB.prepare("UPDATE approved_workflow_runs SET status='blocked',error_message=?,lease_token=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=?").bind(String(cause.message||'Execution failed').slice(0,500),run.id,token).run();summary.blocked++;}
  }return summary;
}
