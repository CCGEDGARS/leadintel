// Reuse the same evidence, exclusion and role qualification engine as the customer journey.
import '../../customer/discovery-engine.js';
import '../../customer/lookalike-discovery.js';
import {WORKFLOW_STAGES,approvedContext,normalizeWorkflowConfig,freshEvidence,renderWorkflowMessage} from './approved-workflow-engine.js';
import {parse,workflowMain,workflowAuthorized} from './approved-workflow-store.js';
import {resolveWorkspaceServiceCredential} from './service-integrations.js';
import {provenBusinessEmail,APOLLO_PEOPLE_SEARCH_URL,apolloSearchBody} from './enrichment.js';
import {upsertCrmCompany,upsertCrmContacts,upsertCrmIntelligence,appendCrmActivity,findCrmCompanyByDomain} from './crm.js';
import {searchWorkspaceWeb,generateWorkspaceResearch} from './ai-routes.js';
import {enrichCrmContact} from './crm-routes.js';
import {enqueueApprovedSequence} from './outreach-automation-routes.js';
const discovery=globalThis.LeadIntelDiscovery;
const stop=()=>{throw new Error('Workflow paused, stopped, changed or approval no longer valid');};
async function providerJson(url,options={}){
  const response=await fetch(url,{...options,signal:AbortSignal.timeout(60000)});if(!response.ok)throw new Error(`Research/enrichment provider returned ${response.status}. Review the connection or credits before retrying.`);return response.json();
}
async function search(env,workspaceId,query,guard){
  await guard();const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'firecrawl');
  const url=credential.source==='customer'?'https://api.firecrawl.dev/v2/search':`${env.FIRECRAWL_PROXY_URL||'https://apollo-proxy.edgars-7e7.workers.dev'}/firecrawl-search`;
  const headers={'Content-Type':'application/json',Accept:'application/json'};if(credential.source==='customer')headers.Authorization=`Bearer ${credential.apiKey}`;
  const payload=await providerJson(url,{method:'POST',headers,body:JSON.stringify({query:query.query,limit:5,scrapeOptions:{formats:['markdown']}})});await guard();
  // Snippets without an extracted page are insufficient for automatic qualification.
  const raw=Array.isArray(payload.data)?payload.data:payload.data?.web||payload.web||[];
  return discovery.normalizeCompanySearchResults({data:raw.filter(item=>String(item.markdown||item.content||item.text||'').trim().length>=120)},query).map(item=>({...item,verifiedAt:new Date().toISOString()}));
}
async function searchBuyerProfiles(env,workspaceId,candidate,roles,guard){
  const rows=[],issues=[],providerStatus={firecrawl:{status:'pending',results:0,queries:0,failures:[]},grounded:{status:'pending',results:0},identity:{status:'pending',results:0}};
  const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'firecrawl');
  const url=credential.source==='customer'?'https://api.firecrawl.dev/v2/search':`${env.FIRECRAWL_PROXY_URL||'https://apollo-proxy.edgars-7e7.workers.dev'}/firecrawl-search`;
  const headers={'Content-Type':'application/json',Accept:'application/json'};if(credential.source==='customer')headers.Authorization=`Bearer ${credential.apiKey}`;
  const plan=discovery.buyerResearchPlan(candidate,{decisionMakers:roles.join('; ')});
  for(const query of plan.queries){
    await guard();
    try{
      const payload=await providerJson(url,{method:'POST',headers,body:JSON.stringify({query,limit:10,scrapeOptions:{formats:['markdown']}})});
      const found=Array.isArray(payload.data)?payload.data:payload.data?.web||payload.web||[];rows.push(...found.map(row=>({...row,buyerSource:'firecrawl'})));providerStatus.firecrawl.results+=found.length;
    }catch(error){issues.push(error.message);providerStatus.firecrawl.failures.push({message:error.message,query});}
    providerStatus.firecrawl.queries++;await guard();
  }
  await guard();
  providerStatus.firecrawl.status=providerStatus.firecrawl.failures.length===plan.queries.length?'unavailable':providerStatus.firecrawl.failures.length?'partial':'complete';
  try{const grounded=await searchWorkspaceWeb(env,workspaceId,plan.followUp);rows.push(...(grounded.results||[]).map(row=>({...row,buyerSource:'grounded'})));providerStatus.grounded={status:grounded.status==='complete'?'complete':'unavailable',results:(grounded.results||[]).length};if(grounded.status!=='complete')issues.push('Grounded buyer discovery unavailable');}catch(error){issues.push('Grounded buyer discovery unavailable');providerStatus.grounded={status:'failed',results:0,failures:[{message:error.message}]};}
  await guard();
  const searchIdentityRows=async query=>{
    await guard();
    const payload=await providerJson(url,{method:'POST',headers,body:JSON.stringify({query,limit:8,scrapeOptions:{formats:['markdown']}})});
    await guard();return Array.isArray(payload.data)?payload.data:payload.data?.web||payload.web||[];
  };
  const trace=discovery.tracePublicBuyers(rows,candidate.company,{decisionMakers:plan.roles.join('; '),companyDomain:candidate.domain});
  for(const source of ['firecrawl','grounded'])providerStatus[source].accepted=new Set(trace.diagnostics.filter(row=>row.source===source&&row.accepted).map(row=>row.parsedName)).size;
  return {people:trace.people,resultDiagnostics:trace.diagnostics,providerStatus,rows,searchIdentityRows,roles:plan.roles,sourceResults:rows.length,issues};
}
export async function researchBuyerContacts(candidate,search,guard){
  for(let offset=0;offset<candidate.people.length;offset+=2){
    await guard();
    await Promise.all(candidate.people.slice(offset,offset+2).map(async person=>{
      const name=String(person.publicName||person.name||'').trim();
      if(name.split(/\s+/).length<2||person.identityStatus==='pending'){person.emailResearch={status:'not_searched',searches:0,failed:0,checkedAt:''};return;}
      const queries=[`"${name}" "${candidate.company}" (email OR phone OR kontakt)`,`"${name}" "${candidate.company}" "@${candidate.domain}"`,`"${name}" "${candidate.company}" "@gmail.com"`];
      const settled=await Promise.allSettled(queries.map(query=>search(query)));
      const rows=settled.flatMap(row=>row.status==='fulfilled'?row.value:[]),failed=settled.filter(row=>row.status==='rejected').length;
      const matched=discovery.matchPublicBuyerDetails([person],rows,candidate.domain)[0];Object.assign(person,matched);
      for(const row of rows){
        const text=[row.title,row.description,row.markdown,row.content].filter(Boolean).join(' ');
        let source;try{source=new URL(row.url);}catch{continue;}
        if(!['http:','https:'].includes(source.protocol)||source.username||source.password)continue;
        for(const match of text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)){
          const email=match[0].toLowerCase(),near=text.slice(Math.max(0,match.index-220),match.index+match[0].length+220).toLowerCase();
          if(!email.endsWith('@'+candidate.domain)&&!email.endsWith('@gmail.com'))continue;
          if(!near.includes(name.toLowerCase())||!near.includes(candidate.company.toLowerCase())||/predicted|guessed|email pattern/i.test(near))continue;
          if(email.endsWith('@gmail.com')){
            const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
            const attribution=new RegExp(escape(name)+'(?:\\s+(?:at|hos|på)\\s+|\\s*[,|·]\\s*)'+escape(candidate.company)+'[\\s:·,|-][^\\n]{0,100}'+escape(match[0]),'iu');
            if(!attribution.test(near))continue;
          }
          person.patternFindings=[...(person.patternFindings||[]).filter(item=>item.email!==email),{email,url:source.href,status:'public_unverified'}];
        }
      }
      person.emailResearch={status:failed===queries.length?'unavailable':failed?'partial':'complete',searches:queries.length,failed,checkedAt:new Date().toISOString()};
    }));
    await guard();
  }
}
async function buyer(env,workspaceId,candidate,config,guard,userId){
  const company=await findCrmCompanyByDomain(env.DB,workspaceId,candidate.domain);
  if(company&&company.lifecycle_status!=='prospect')return null;
  const state=await env.DB.prepare('SELECT payload_json FROM customer_workspace_state WHERE workspace_id=?').bind(workspaceId).first();
  const saved=parse(state?.payload_json).discovery||{};
  const prior=[...(saved.selectedProspects||[]),...(saved.candidates||[]),...(saved.pipeline||[])].find(item=>discovery.canonicalDomain(item.domain)===candidate.domain);
  const research=await searchBuyerProfiles(env,workspaceId,candidate,config.buyers.roles,guard);
  const profile={decisionMakers:research.roles.join('; '),companyDomain:candidate.domain};
  let pool=discovery.mergeBuyerPool([...(prior?.buyerDiscovery?.pool||[]),...(prior?.people||[])],research.people,profile);
  candidate.buyerDiscovery={researchVersion:"20261004-research-state-v1",target:20,found:pool.length,pool,providerStatus:research.providerStatus,resultDiagnostics:research.resultDiagnostics,sourceResults:research.sourceResults,issues:research.issues,checkedAt:new Date().toISOString()};
  candidate.people=discovery.recommendedBuyers(pool,profile);
  // Identity discovery is allowed before paid/contact confirmation. Use Apollo people search
  // alongside public research; no email/phone reveal or waterfall flags are requested here.
  let directoryPeople=[];
  {
    try{
      await guard();const identityCredential=await resolveWorkspaceServiceCredential(env,workspaceId,'apollo');
      if(identityCredential.configured){
        const identityHeaders={'Content-Type':'application/json','X-Api-Key':identityCredential.apiKey,Accept:'application/json'};
        const identityPayload=await providerJson(APOLLO_PEOPLE_SEARCH_URL,{method:'POST',headers:identityHeaders,body:JSON.stringify(apolloSearchBody({domain:candidate.domain,roles:discovery.opportunityBuyerRoles?.(candidate,profile)||config.buyers.roles}))});await guard();
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
  await researchBuyerContacts(candidate,research.searchIdentityRows,guard);
  candidate.publicResearch={checkedAt:new Date().toISOString(),patternSearches:candidate.people.reduce((count,person)=>count+(person.emailResearch?.searches||0),0),issues:candidate.people.some(person=>person.emailResearch?.failed)?['Public email evidence searches incomplete']:[]};
  candidate.publicContactStatus=candidate.people.some(person=>person.emailResearch?.failed)?'error':'complete';
  pool=discovery.mergeBuyerPool(pool,candidate.people,profile);candidate.buyerDiscovery.pool=pool;
  if(candidate.people.some(person=>['partial','unavailable'].includes(person.emailResearch?.status)))candidate.buyerDiscovery.issues.push('Public email evidence searches incomplete');
  candidate.buyerDiscovery.researchIncomplete=candidate.buyerDiscovery.issues.length>0||pool.some(person=>person.identityStatus==='pending');
  const verified=company?(await env.DB.prepare("SELECT * FROM crm_contacts WHERE workspace_id=? AND company_id=? AND LOWER(email_status)='verified' AND archived_at IS NULL").bind(workspaceId,company.id).all()).results||[]:[];
  // Explicitly kept buyers rank first, but saving alone never bypasses role/email gates.
  const eligible=discovery.selectDecisionMakers(verified,profile,20).filter(p=>String(p.name||'').trim().split(/\s+/).length>=2&&provenBusinessEmail({email:p.normalized_email,email_status:p.email_status},candidate.domain));
  const pinned=new Set(candidate.people.filter(p=>p.kept).map(discovery.buyerIdentity));
  eligible.sort((a,b)=>Number(pinned.has(discovery.buyerIdentity(b)))-Number(pinned.has(discovery.buyerIdentity(a))));
  if(eligible[0])return {...eligible[0],email:eligible[0].normalized_email};
  // Owner-approved automatic confirmation uses the same cache and credit
  // policy as manual Apollo enrichment. Never reveal phones or personal email.
  if(config.buyers.confirmContacts===true){
    const credential=await resolveWorkspaceServiceCredential(env,workspaceId,'apollo');
    if(credential.configured){
      const crmContext={workspaceId,userId,role:'owner'};
      const target=company||(await upsertCrmCompany(env.DB,crmContext,{...candidate,source:'approved_workflow_qualified'})).company;
      await env.DB.prepare('INSERT OR IGNORE INTO enrichment_policies(workspace_id) VALUES(?)').bind(workspaceId).run();
      const runtime=Object.create(env);runtime.APOLLO_API_KEY=credential.apiKey;
      for(const person of candidate.people.slice(0,6)){
        await guard();
        if(person.identityStatus==='pending'||!discovery.hasFullBuyerName(person.publicName||person.name))continue;
        // Public-derived IDs cannot be sent to Apollo. Resolve an attributable
        // directory identity first using the existing identity trace.
        const matches=directoryPeople.filter(item=>String(item.publicName||item.name).trim().toLowerCase()===String(person.publicName||person.name).trim().toLowerCase()||Boolean(person.publicLinkedinUrl&&item.linkedin_url===person.publicLinkedinUrl));
        const publicId=/^(public-|person-)/.test(String(person.id));
        const personId=publicId?(matches.length===1?matches[0].id:null):person.id;
        if(!personId||String(personId).startsWith('public-'))continue;
        const request=new Request('https://leadintel.invalid/internal-enrich',{method:'POST',body:JSON.stringify({person_id:personId,name:person.publicName||person.name,title:person.title,phone_lookup:false,allow_personal_email:false})});
        const response=await enrichCrmContact(request,runtime,{}, {context:crmContext},target.id);await guard();
        const value=await response.json();
        const email=provenBusinessEmail({email:value.contact?.normalized_email,email_status:value.contact?.email_status},candidate.domain);
        if(response.ok&&email){candidate.buyerDiscovery.contactConfirmationRequired=false;return {...value.contact,email};}
        candidate.buyerDiscovery.issues.push(value.error||'Apollo did not return an attributable verified company email');
        if(response.status===429)break;
      }
    }
  }
  candidate.buyerDiscovery.contactConfirmationRequired=true;

  return null;
}
export async function executeWorkflowStage(stage,{env,row,run,result,context,config,guard,generateResearch=generateWorkspaceResearch}){
  await guard();const profile={...context.profile,discoveryPriority:config.companies.researchPriority,decisionMakers:config.buyers.roles.join('; ')},market={icps:context.icps,signals:context.signals};
  if(stage==='profile'||stage==='strategy')return {...result,contextValidated:true};
  if(stage==='companies'){
    if(config.companies.researchPriority==='signals')profile.referenceSimilarityModel=null;
    const baseQueries=discovery.buildDiscoveryQueries(profile,market,config.companies.queries);
    const customSources=(context.researchCustomSources||[]).map(item=>{try{return new URL(typeof item==='string'?item:item.url).hostname;}catch{return '';}}).filter(Boolean).slice(0,3);
    const sourceTerms={news:'news announcement',jobs:'careers hiring',investments:'investment expansion',company:'company newsroom',registries:'business registry'};
    const queries=baseQueries.map((query,index)=>({...query,query:[query.query,customSources[index]?'site:'+customSources[index]:sourceTerms[(context.researchSourceTypes||[])[index%(context.researchSourceTypes?.length||1)]]||'',String(context.researchInstructions||'').slice(0,500)].filter(Boolean).join(' ')}));
    const results=(context.knownEvidence||[]).flatMap(item=>discovery.normalizeCompanySearchResults({data:[item]},{id:'approved-research',market:item.market||profile.targetMarkets.split(/[,;]/)[0]}));if(!queries.length)throw new Error('Approved targeting did not produce research queries');
    for(const query of queries)results.push(...await search(env,row.workspace_id,query,guard));
    // Follow up at company level before the automatic evidence/fit gate.
    const mentions=results.flatMap(item=>discovery.extractCompanyMentions([item],2)).slice(0,30);
    const resolutions=[];
    for(const query of discovery.buildCompanyResolutionQueries(mentions,profile,Math.min(10,config.companies.limit*2)))resolutions.push(...await search(env,row.workspace_id,query,guard));
    const linked=discovery.attachSourceEvidenceToResolvedCompanies(resolutions,mentions,results);results.unshift(...linked);
    const initialQualified=discovery.mergeCompanyCandidates(results,profile,market,30);
    const provisional=[...initialQualified,...discovery.buildPotentialCompanyCandidates(results,profile,market,initialQualified,30)];
    for(const query of discovery.buildCandidateVerificationQueries(provisional,profile,market,Math.min(10,config.companies.limit*2)))results.push(...await search(env,row.workspace_id,query,guard));
    // Research additional candidates when the first pass cannot meet the requested qualified count.
    const firstPass=discovery.mergeCompanyCandidates(results,profile,market,30);
    if(firstPass.filter(c=>discovery.assessAutomaticQualification(c,profile,market,{...config.companies,...config.triggers,researchedAt:new Date().toISOString()}).eligible).length<config.companies.limit){
      const adaptive=discovery.buildDiscoveryFollowUpQueries(profile,market,queries,4);queries.push(...adaptive);
      const extra=[];for(const query of adaptive)extra.push(...await search(env,row.workspace_id,query,guard));
      const names=extra.flatMap(item=>discovery.extractCompanyMentions([item],2)).slice(0,10),resolved=[];
      for(const query of discovery.buildCompanyResolutionQueries(names,profile,10))resolved.push(...await search(env,row.workspace_id,query,guard));
      results.push(...discovery.attachSourceEvidenceToResolvedCompanies(resolved,names,extra),...extra);
      for(const query of discovery.buildCandidateVerificationQueries(resolved,profile,market,10))results.push(...await search(env,row.workspace_id,query,guard));
    }
    const signalCandidates=discovery.mergeCompanyCandidates(results,profile,market,30);
    let pool=[...signalCandidates,...discovery.buildPotentialCompanyCandidates(results,profile,market,signalCandidates,30)];
    if(profile.referenceSimilarityModel)pool=await discovery.researchEvidenceSimilarity({candidates:pool,model:profile.referenceSimilarityModel,workspaceId:row.workspace_id,fetchImpl:async(url,options)=>{await guard();const body=JSON.parse(options.body),text=await generateResearch(env,row.workspace_id,body.prompt);await guard();return {ok:true,json:async()=>({text})};}});
    pool=await discovery.researchBuyerFit(pool,profile,async prompt=>{await guard();const text=await generateResearch(env,row.workspace_id,prompt);await guard();return text;});
    const researchedAt=new Date().toISOString();
    const assessed=pool.map(candidate=>({...candidate,qualification:discovery.assessAutomaticQualification(candidate,profile,market,{...config.companies,...config.triggers,researchedAt})}));
    const candidates=[];
    for(const candidate of discovery.rankQualifiedCompanies(assessed.filter(c=>c.qualification.eligible))){
      const saved=await findCrmCompanyByDomain(env.DB,row.workspace_id,candidate.domain);if(saved&&saved.lifecycle_status!=='prospect')continue;
      candidates.push({...candidate,qualified:true,buyerVerified:true,qualificationGaps:[],score:{total:candidate.qualification.score,fit:candidate.qualification.buyerFitPoints,signal:candidate.qualification.signalPoints},matchedSignals:candidate.qualification.matchedSignals});if(candidates.length>=config.companies.limit)break;
    }
    // Automatic mode owns the qualified-company handoff: every candidate here has already
    // passed score >= approved minimum plus every mandatory evidence/identity/fit gate.
    // Persist it immediately so a later buyer/provider failure cannot lose a qualified opportunity.
    if(config.crm.saveQualified){
      const crmContext={workspaceId:row.workspace_id,userId:row.approved_by,role:'owner'};
      for(const candidate of candidates){
        await guard();
        const existing=await findCrmCompanyByDomain(env.DB,row.workspace_id,candidate.domain);
        if(existing&&existing.lifecycle_status!=='prospect')continue;
        const saved=await upsertCrmCompany(env.DB,crmContext,{...candidate,pipeline_stage:'Discovered',source:'approved_workflow_qualified'});
        await upsertCrmIntelligence(env.DB,crmContext,saved.company.id,{matched_signals:candidate.matchedSignals,evidence:candidate.evidence,score_breakdown:{...candidate.score,qualification:candidate.qualification},confidence:candidate.qualification?.confidence||candidate.confidence,research_snapshot:{runId:run.id,revision:row.revision,researchAt:researchedAt,buyerFit:candidate.buyerFit,qualification:candidate.qualification,automaticQualifiedSave:true}});
      }
    }
    return {...result,requestedCount:config.companies.limit,qualifiedCount:candidates.length,shortfall:Math.max(0,config.companies.limit-candidates.length),queries,candidates,reviewCompanies:assessed.filter(c=>!c.qualification.eligible),researchedAt,sourceCount:new Set(results.map(r=>r.url)).size};
  }
  if(stage==='buyers'){
    const candidates=[],reviewBuyers=[];for(const candidate of result.candidates||[]){await guard();const contact=await buyer(env,row.workspace_id,candidate,config,guard,row.approved_by);if(contact)candidates.push({...candidate,contact});else reviewBuyers.push({...candidate,reason:'No verified eligible business contact'});}
    return {...result,candidates,reviewBuyers,skippedWithoutVerifiedBuyer:reviewBuyers.length};
  }
  if(stage==='triggers')return {...result,candidates:(result.candidates||[]).filter(c=>discovery.assessAutomaticQualification(c,profile,market,{...config.companies,...config.triggers,researchedAt:result.researchedAt}).eligible)};
  if(stage==='messages'){
    const candidates=(result.candidates||[]).map(candidate=>{const evidence=candidate.qualification?.route==='lookalike'?candidate.evidence.find(e=>discovery.companyIdentityDomain(e.url)===candidate.domain):freshEvidence(candidate,config.triggers.maxEvidenceAgeDays)[0],values={firstName:candidate.contact.first_name||String(candidate.contact.name||'').split(' ')[0],company:candidate.company,sender:profile.companyName,offer:profile.priorityOffers,evidenceUrl:evidence?.url};return {...candidate,message:{subject:renderWorkflowMessage(config.messages.subject,values),body:renderWorkflowMessage(config.messages.body,values),followup_body:renderWorkflowMessage(config.messages.followup,values)}};});return {...result,candidates};
  }
  const crmContext={workspaceId:row.workspace_id,userId:row.approved_by,role:'owner'};
  if(stage==='crm'){
    const candidates=[];for(const candidate of result.candidates||[]){await guard();const old=await findCrmCompanyByDomain(env.DB,row.workspace_id,candidate.domain);if(old&&old.lifecycle_status!=='prospect')continue;
      const saved=await upsertCrmCompany(env.DB,crmContext,{...candidate,pipeline_stage:'Ready for Outreach',source:'approved_workflow'});await guard();
      const contacts=await upsertCrmContacts(env.DB,crmContext,saved.company.id,[{...candidate.contact,work_email:candidate.contact.email,email_status:'verified'}]);await guard();
      await upsertCrmIntelligence(env.DB,crmContext,saved.company.id,{matched_signals:candidate.matchedSignals,evidence:candidate.evidence,score_breakdown:{...candidate.score,qualification:candidate.qualification},confidence:candidate.confidence,research_snapshot:{runId:run.id,revision:row.revision,researchAt:result.researchedAt,buyerFit:candidate.buyerFit,qualification:candidate.qualification}});await guard();
      await appendCrmActivity(env.DB,crmContext,{id:`workflow-message-${run.id}-${saved.company.id}`,companyId:saved.company.id,type:'dossier.built',summary:'Message generated under approved workflow template',metadata:{run_id:run.id,revision:row.revision,subject:candidate.message.subject,body:candidate.message.body,approval:'workflow_template',script_package:{version:1,savedAt:new Date().toISOString(),item:{domain:candidate.domain,company:candidate.company,researchStatus:'complete',researchAt:result.researchedAt,selectedPersonId:contacts[0]?.id||candidate.contact.id,approved:false,dossier:{company:candidate.company,domain:candidate.domain,website:candidate.website,market:candidate.market,recommendedOffer:profile.priorityOffers,buyerRoles:config.buyers.roles,evidence:candidate.evidence,matchedSignals:candidate.matchedSignals,people:[{...candidate.contact,id:contacts[0]?.id||candidate.contact.id}]},drafts:{emailSubject:candidate.message.subject,emailBody:candidate.message.body,followUp:candidate.message.followup_body}}}}});
      candidates.push({...candidate,crmId:saved.company.id});}return {...result,candidates};
  }
  if(stage==='delivery'){
    let queued=0,skipped=0;for(const candidate of result.candidates||[]){await guard();const response=await enqueueApprovedSequence(env,{},row.workspace_id,{user:{id:row.approved_by},member:{role:'owner'}},{...candidate.message,domain:candidate.domain,recipient:candidate.contact.email,contact_identity:candidate.contact.id||candidate.contact.name,approved:true,approved_at:row.approved_at},{runId:run.id,revision:row.revision});const value=await response.json();if(!response.ok){if(value.code==='AUTOMATION_RECIPIENT_ALREADY_CONTACTED'||value.code==='CRM_COMPANY_SUPPRESSED'||value.code==='CONTACT_SUPPRESSED'){skipped++;continue;}throw new Error(value.error||'Could not queue approved message');}if(!value.duplicate)queued++;}
    return {...result,queued,skipped};
  }
  throw new Error('No executor for workflow stage');
}
export async function runApprovedWorkflows(env,{workspaceId='',maxWorkspaces=3,execute=executeWorkflowStage,now=new Date()}={}){
  const sql=workspaceId?"SELECT * FROM approved_workflows WHERE workspace_id=? AND status='automatic'":"SELECT w.* FROM approved_workflows w WHERE w.status='automatic' AND NOT EXISTS (SELECT 1 FROM approved_workflow_runs r WHERE r.workspace_id=w.workspace_id AND r.revision=w.revision AND r.status='blocked') ORDER BY w.next_run_at LIMIT ?";
  const {results:rows=[]}=await env.DB.prepare(sql).bind(workspaceId||maxWorkspaces).all();const summary={completed:0,blocked:0,skipped:0};
  for(const row of rows){
    if(!await workflowAuthorized(env,row.workspace_id,row.revision)){summary.skipped++;continue;}
    let run=await env.DB.prepare("SELECT * FROM approved_workflow_runs WHERE workspace_id=? AND revision=? AND status IN ('running','blocked') ORDER BY created_at DESC LIMIT 1").bind(row.workspace_id,row.revision).first();
    if(run?.status==='blocked'){summary.skipped++;continue;}
    if(!run){if(row.next_run_at&&new Date(row.next_run_at)>now){summary.skipped++;continue;}const id=crypto.randomUUID();await env.DB.prepare("INSERT OR IGNORE INTO approved_workflow_runs(id,workspace_id,revision,status) VALUES(?,?,?,'running')").bind(id,row.workspace_id,row.revision).run();run=await env.DB.prepare('SELECT * FROM approved_workflow_runs WHERE id=?').bind(id).first();if(!run){summary.skipped++;continue;}}
    if(run.lease_token){if(new Date(run.lease_until)>now){summary.skipped++;continue;}await env.DB.prepare("UPDATE approved_workflow_runs SET status='blocked',error_message='Execution was interrupted. Review before retrying; provider usage may already have occurred.',lease_token=NULL,lease_until=NULL WHERE id=? AND lease_token=? AND lease_until<=?").bind(run.id,run.lease_token,now.toISOString()).run();summary.blocked++;continue;}
    const token=crypto.randomUUID(),claim=await env.DB.prepare("UPDATE approved_workflow_runs SET lease_token=?,lease_until=? WHERE id=? AND status='running' AND lease_token IS NULL").bind(token,new Date(now.getTime()+15*60000).toISOString(),run.id).run();if(!claim.meta?.changes){summary.skipped++;continue;}
    const guard=async()=>{if(!await workflowAuthorized(env,row.workspace_id,row.revision))stop();const lease=await env.DB.prepare('SELECT status,lease_token FROM approved_workflow_runs WHERE id=?').bind(run.id).first();if(lease?.status!=='running'||lease?.lease_token!==token)stop();};
    let result=parse(run.result_json);try{
      const context=approvedContext(await workflowMain(env,row.workspace_id)),config=normalizeWorkflowConfig(parse(row.config_json));
      for(let index=run.stage_index;index<WORKFLOW_STAGES.length;index++){
        result=await execute(WORKFLOW_STAGES[index],{env,row,run,result,context,config,guard});await guard();
        await env.DB.prepare('UPDATE approved_workflow_runs SET stage_index=?,result_json=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=?').bind(index+1,JSON.stringify(result),run.id,token).run();
      }
      await guard();await env.DB.batch([env.DB.prepare("UPDATE approved_workflow_runs SET status='completed',lease_token=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=?").bind(run.id,token),env.DB.prepare('UPDATE approved_workflows SET next_run_at=?,updated_at=CURRENT_TIMESTAMP WHERE workspace_id=? AND revision=?').bind(new Date(now.getTime()+(config.delivery.frequency==='weekly'?7:1)*86400000).toISOString(),row.workspace_id,row.revision)]);summary.completed++;
    }catch(cause){await env.DB.prepare("UPDATE approved_workflow_runs SET status='blocked',error_message=?,lease_token=NULL,lease_until=NULL,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=?").bind(String(cause.message||'Execution failed').slice(0,500),run.id,token).run();summary.blocked++;}
  }return summary;
}
