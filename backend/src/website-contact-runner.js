import {sha256} from './security.js';
import {managementShortlist,searchManagementIndex,managementDirectoryPeople,managementChannels,MANAGEMENT_RESEARCH_VERSION} from './website-management.js';
import {websiteSourceChunks as sourceChunks,websiteStaffCards as localStaffCards} from './website-contact-staff.js';
import {reviewWebsiteLinkedIn,websiteLinkedInMatchRows,websiteLinkedInQueries,websiteLinkedInReviewCurrent,WEBSITE_LINKEDIN_REVIEW_VERSION} from './website-linkedin-review.js';
import {websiteFreeResearchComplete,websiteContactRole,websiteContactIdentity,websiteNameKey,websiteProfileKey,websiteIdentitySupport,websiteIdentityCheckKey} from './website-contact-evidence.js';
import {reconcileWebsiteContactIdentities} from './website-contact-identity.js';
import {storageFailure} from './workspace-storage.js';
import {contactSql as sql,contactParse as parse,contactAuthority as authority,contactError,contactActive} from './website-contact-store.js';
import {createBuyerSourceSearch} from './buyer-source-search.js';
import {apolloCapabilities,resolveWorkspaceServiceCredential,fetchDirectPublicPage,readPublicBuyerPage,searchWorkspaceApolloPeople} from './service-integrations.js';
import {searchWorkspaceBuyerContact} from './ai-routes.js';
import '../../customer/discovery-engine.js';
import S from '../../customer/website-scanning.js';
const D=globalThis.LeadIntelDiscovery;
const leadership=title=>{
 if(/assistant|associate|advis[eo]r|former|previous|retired|chief of staff/i.test(title))return 3;
 if(D.isExecutiveBuyer({title})||/\b(?:CEO|CFO|COO|CTO|CIO|CMO|CHRO|chief|president|founder|owner)\b|administrerende\s+direktør|adm\.?\s*direktør|verkställande\s+direktör|valdes\s+priekšsēdētāj/i.test(title))return 0;
 if(/director|direktør|direktör|direktor|head|partner|vice.president|board|bestyrelse/i.test(title))return 1;
 return /manager|chef|leder|vadītāj/i.test(title)?2:3;
};
const sameHost=(url,domain)=>D.canonicalDomain(url)===domain;
const clean=v=>String(v||'').replace(/\s+/g,' ').trim();
const contactPage=url=>/contact|kontakt|team|management|leadership|about|om-oss?|ledelse|medarbejder|people|board|staff|company|governance/i.test(url);
const companyDescription=page=>page.markdown.split(/\n/).filter(line=>!/^\s*#{1,6}\s/.test(line)).map(line=>clean(line.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_]/g,''))).find(line=>line.length>=30&&line.split(/\s+/).length>=5&&!/cookie|privacy|copyright|all rights reserved|^©|^read more|^click here|^learn more/i.test(line))?.slice(0,320)||'';
const reads=state=>(state.tasks||[]).filter(t=>t.kind==='read'&&t.status==='complete').map(t=>t.result);
const candidateFor=(input,people=[])=>({company:input.company,domain:input.domain,website:input.website,people});

function acquire(state,input){
 const pages=reads(state).filter(p=>p.markdown&&!p.archived),candidate=candidateFor(input),roster=[...(state.people||[])];
 const add=(p,origin)=>{
  if(!websiteContactIdentity({...p,identityOrigin:origin}))return;
  const name=clean(p.publicName||p.name),title=clean(p.title),profile=websiteProfileKey(p.publicLinkedinUrl||p.linkedin_url);if(!D.hasFullBuyerName(name))return;
  const matches=roster.filter(old=>websiteNameKey(old.publicName||old.name)===websiteNameKey(name)&&websiteContactRole(old.title)===websiteContactRole(title)&&(!profile||!websiteProfileKey(old.publicLinkedinUrl||old.linkedin_url)||websiteProfileKey(old.publicLinkedinUrl||old.linkedin_url)===profile));
  const prior=matches.length===1?matches[0]:null;
  if(!prior){roster.push({...p,id:'web-'+crypto.randomUUID(),name,organization:input.company,identityOrigin:origin,...(origin==='apollo'?{identityStatus:p.directoryRosterUrl?'confirmed':'directory_listing',identitySourceIds:[p.id].filter(Boolean)}:{})});return;}
  if(origin==='apollo'&&profile&&profile===websiteProfileKey(prior.publicLinkedinUrl||prior.linkedin_url))prior.identitySourceIds=[...new Set([...(prior.identitySourceIds||[]),p.id].filter(Boolean))];
  if(origin!=='official'&&prior.identityOrigin==='official'){
   if(profile&&!websiteProfileKey(prior.publicLinkedinUrl||prior.linkedin_url)){prior.linkedin_url=p.publicLinkedinUrl||p.linkedin_url;delete prior.contactResearch;delete prior.emailResearch;delete prior.freeResearchStatus;}
   return;
  }
  const oldProfile=websiteProfileKey(prior.publicLinkedinUrl||prior.linkedin_url),receipt=prior.contactResearch,done=prior.freeResearchStatus;
  Object.assign(prior,{...p,id:prior.id,name,organization:input.company,identityOrigin:origin==='official'?'official':prior.identityOrigin,identityStatus:origin==='apollo'&&prior.identityOrigin!=='official'&&!p.directoryRosterUrl?'directory_listing':p.identityStatus||prior.identityStatus});
  if(profile&&oldProfile!==profile){delete prior.contactResearch;delete prior.emailResearch;delete prior.freeResearchStatus;}else if(done){prior.contactResearch=receipt;prior.freeResearchStatus=done;}
 };
 const channels=new Map(),routes=new Map();
 for(const page of pages.filter(p=>sameHost(p.url,input.domain)))for(const chunk of sourceChunks(page)){
  const contacts=D.discoverCompanyContacts([chunk],candidate,[]);if(contacts.length===60)state.coverage.parserLimitReached=true;
  for(const p of [...contacts,...localStaffCards(chunk,input)])add(p,'official');
  const inventory=D.officialCompanyContactInventory([chunk],candidate);if(inventory.channels.length===80||inventory.routes.length===60)state.coverage.parserLimitReached=true;
  for(const c of inventory.channels||[])channels.set(c.value,c);for(const r of inventory.routes||[])routes.set(r.kind+'|'+r.value,r);
 }
 for(const p of state.apolloPeople||[])for(const person of D.traceIdentityBuyers({people:[p]},candidate,{companyDomain:input.domain,collectAllCompanyContacts:true}).people)add(person,'apollo');
 for(const person of state.managementDirectoryPeople||[])add(person,'apollo');
 const namedProfileQueries=new Set(roster.flatMap(p=>[...websiteLinkedInQueries(input,p),...(p.linkedinReview?.queries||[]).map(q=>q.query)]));
 for(const task of state.tasks.filter(t=>t.kind==='search'&&t.status==='complete'&&!t.archived&&!namedProfileQueries.has(t.value)))for(const person of D.tracePublicBuyers(task.result,input.company,{companyDomain:input.domain,collectAllCompanyContacts:true,includeIndexedCompanyContacts:true}).people)add(person,'public_listing');
 const nameCounts=new Map();for(const person of roster)nameCounts.set(person.name.toLocaleLowerCase(),(nameCounts.get(person.name.toLocaleLowerCase())||0)+1);
 for(const person of roster){person.identityConflict=nameCounts.get(person.name.toLocaleLowerCase())>1;if(person.identityConflict&&person.freeResearchStatus==='complete')delete person.freeResearchStatus;}
 const all=roster.sort((a,b)=>leadership(a.title)-leadership(b.title)||a.name.localeCompare(b.name));
 state.coverage.peopleTruncated=all.length>300;state.people=all.slice(0,300);state.coverage.channelLimitReached=channels.size>300||routes.size>300;state.channels=[...channels.values()].slice(0,300);state.routes=[...routes.values()].slice(0,300);
 reconcileWebsiteContactIdentities(state,input);
 if(input.managementLimit)state.people=managementShortlist(state.people,input.managementLimit,input.buyerRoles);
}
function compact(state){
 // Completed person receipts and exact source quotes live on the roster. Rotate
 // old response bodies, retaining URL/read/time/count receipts; a future need
 // for an archived body triggers a fresh read, never a fabricated cache hit.
 const completed=state.tasks.filter(t=>t.status==='complete'),keepReads=new Set(completed.filter(t=>t.kind==='read').slice(-60)),keepSearches=new Set(completed.filter(t=>t.kind==='search').slice(-60));
 for(const task of completed){if(task.kind==='read'&&state.phase==='contacts'&&state.coverage.peopleLimit===300)delete task.result.links;if(task.kind==='read'&&!keepReads.has(task)&&!task.archived){const {markdown,links,...receipt}=task.result;task.result={...receipt,archived:true};task.archived=true;task.attempts=0;state.coverage.rotatedBodies=true;}if(task.kind==='search'&&!keepSearches.has(task)&&!task.archived){task.resultCount=task.result.length;task.result=task.result.map(({url,title})=>({url,title}));task.archived=true;task.attempts=0;state.coverage.rotatedBodies=true;}}
}
function queries(input){const domain=input.domain,name=input.company.replaceAll('"','');
 const localLeadership=domain.endsWith('.dk')?' OR direktør OR produktionsdirektør OR bestyrelse':'';
 return [
 `site:${domain} (CEO OR chief OR management OR leadership OR directors OR board${localLeadership})`,
 `site:${domain} (contact OR contacts OR kontakt OR team OR staff OR people) (email OR phone OR LinkedIn)`,
 `"${name}" (executive OR director OR manager OR head${localLeadership}) (email OR contact OR LinkedIn)`,
 `site:${domain} (press OR procurement OR sales OR engineering) (email OR telephone OR filetype:pdf)`,
 `site:${domain} (leadership OR management OR contact) filetype:pdf`,
 `"${name}" (association OR conference OR speaker) (email OR contact)`];}

// A separate semantic owner reuses public-source transports, identity attribution,
// mandatory contact query plans and the shared cron budget. It never calls the
// Buyer fit/quality shortlister, paid intent builder or chat operation boundary.
export async function runWebsiteContactJobs(env,{jobId,now=Date.now(),windowMs=45000,services={},clock=Date.now}={}){
 const budget=env.bookInvocationBudget;if(budget&&!budget.admit(130))return [];
 try{
 const lease=crypto.randomUUID(),start=clock(),claim=await sql(env,`UPDATE website_contact_jobs SET status='running',lease_token=?,lease_until=?,updated_at=CURRENT_TIMESTAMP WHERE id=(SELECT id FROM website_contact_jobs WHERE status IN ('queued','running') AND lease_until<? ${jobId?'AND id=?':''} ORDER BY updated_at,id LIMIT 1) RETURNING *`,lease,start+Math.max(90000,windowMs+30000),now,...(jobId?[jobId]:[])).first();
 if(!claim)return [];
 const row=claim,input=parse(row.input_json),state=parse(row.state_json),controller=new AbortController(),timer=setTimeout(()=>controller.abort(),windowMs);let status='queued',valid=true;
 const focused=state.personCheck;
 const excluded=focused?[]:(state.people||[]).filter(p=>!websiteContactIdentity(p));
 if(excluded.length){state.excludedIdentities=[...(state.excludedIdentities||[]),...excluded.map(p=>({...p,exclusionReason:'Indexed publication or unsupported professional identity'}))].slice(-300);state.people=state.people.filter(websiteContactIdentity);}
 if(!focused)reconcileWebsiteContactIdentities(state,input);
 if(input.managementLimit)state.people=managementShortlist(state.people,input.managementLimit,input.buyerRoles);
 if(!input.managementLimit&&!focused&&!services.checkPerson&&state.linkedinReviewVersion!==WEBSITE_LINKEDIN_REVIEW_VERSION){for(const person of state.people||[])if(!websiteLinkedInReviewCurrent(input,person))delete person.freeResearchStatus;state.linkedinReviewVersion=WEBSITE_LINKEDIN_REVIEW_VERSION;}
 const guard=async()=>{
  if(controller.signal.aborted)throw Object.assign(Error('Processing slice ended'),{code:'TIME_BUDGET'});
  if(clock()>=row.deadline_at)throw Object.assign(Error('Research pass time limit reached; results are saved. Continue unfinished checks when needed.'),{code:'PASS_LIMIT'});
  if(budget&&!budget.hasRoom(15))throw Object.assign(Error('Shared processing budget reached'),{code:'TIME_BUDGET'});
  const owned=await sql(env,`SELECT id FROM website_contact_jobs WHERE id=? AND lease_token=? AND status='running' AND lease_until>? AND ${authority}`,row.id,lease,clock()).first();
  if(!owned){valid=false;throw contactError('Company identity or research authority changed.');}
 };
 const observe=entry=>{state.tools=[...(state.tools||[]),{...entry,at:new Date().toISOString()}].slice(-150);};
 const searchSource=services.search||createBuyerSourceSearch(env,row.workspace_id,{purpose:'website_contacts',guard,signal:controller.signal,observe,scrapeResults:false,primaryTimeoutMs:6000});
 const inFlight=new Map();let checkpointTail=Promise.resolve();
 state.performance={sourceRequests:0,sourceReuses:0,...state.performance,concurrency:3};
 const checkpoint=()=>{checkpointTail=checkpointTail.then(async()=>{
  const saved=await sql(env,`UPDATE website_contact_jobs SET state_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND status='running' AND ${authority}`,JSON.stringify(state),row.id,lease).run();
  if(!saved.meta.changes){valid=false;throw contactError('Research authority changed before saving its source receipt.');}
 });return checkpointTail;};
 function task(kind,value,operation){
  const key=kind+'|'+value;
  if(inFlight.has(key)){state.performance.sourceReuses++;return inFlight.get(key);}
  const pending=executeTask(kind,value,operation).finally(()=>inFlight.delete(key));inFlight.set(key,pending);return pending;
 }
 async function executeTask(kind,value,operation){
  await guard();let saved=state.tasks.find(t=>t.kind===kind&&t.value===value);
  if(saved?.status==='complete'&&!saved.archived){
   const acquired=Date.parse(saved.checkedAt||saved.result?.extractedAt||''),age=Date.now()-acquired;
   if(age>=0&&age<30*86400000){state.performance.sourceReuses++;return saved.result;}
   state.expiredSources=[...(state.expiredSources||[]),{kind:saved.kind,value:saved.value,checkedAt:saved.checkedAt||saved.result?.extractedAt||'',reason:'Source freshness expired; current evidence must be acquired'}].slice(-50);saved.archived=true;saved.attempts=0;
  }
  if(saved?.attempts>=2)throw Object.assign(Error(saved.reason||'Source unavailable after two attempts'),{code:'SOURCE_UNAVAILABLE'});
  // Finish a source attempt before the invocation expires. Otherwise a slow
  // page is interrupted at every slice, refunds its attempt and blocks forever.
  const remaining=Math.min(windowMs-(clock()-start),row.deadline_at-clock()),reserve=Math.min(2000,windowMs*.2);
  if(remaining<Math.min(5000,windowMs*.25))throw Object.assign(Error('Processing slice is ready to checkpoint'),{code:'TIME_BUDGET'});
  if(!saved){if(state.tasks.length>=(state.operationLimit||600))throw Object.assign(Error('This research batch reached its operation limit'),{code:'BATCH_LIMIT'});saved={kind,value,status:'pending',attempts:0};state.tasks.push(saved);}
  saved.attempts++;saved.status='running';delete saved.archived;state.performance.sourceRequests++;const sourceStart=clock();
  const operationMs=Math.max(1,Math.min(30000,remaining-reserve)),operationController=new AbortController();let operationTimer;
  const canceled=()=>operationController.abort(Object.assign(Error('Processing slice ended'),{code:'TIME_BUDGET'}));controller.signal.addEventListener('abort',canceled,{once:true});
  try{const expired=new Promise((_,reject)=>{operationTimer=setTimeout(()=>{const error=Object.assign(Error('Public source operation timed out; other saved checks can continue'),{code:'SOURCE_TIMEOUT'});operationController.abort(error);reject(error);},operationMs);});const result=await Promise.race([Promise.resolve().then(()=>operation(operationController.signal,operationMs)),expired]);if(operationController.signal.aborted)throw operationController.signal.reason;await guard();saved.result=result;saved.status='complete';saved.checkedAt=new Date().toISOString();compact(state);saved.durationMs=Math.max(0,clock()-sourceStart);state.performance.lastProgressAt=new Date().toISOString();await checkpoint();return result;}
  catch(error){saved.status='failed';saved.reason=error.code==='TIME_BUDGET'?'Processing slice ended':clean(error.message).slice(0,180);if(error.code==='TIME_BUDGET'||controller.signal.aborted)saved.attempts--;throw error;}
  finally{clearTimeout(operationTimer);controller.signal.removeEventListener('abort',canceled);operationController.abort();}
 }
 const managementIndex=query=>task('public_index',query,signal=>(services.publicIndex||services.search||searchManagementIndex)(query,signal,fetchDirectPublicPage));
 const search=async query=>task('search',query,async signal=>{const raw=await searchSource(query,{signal});if(signal.aborted)throw signal.reason;const rows=(Array.isArray(raw)?raw:raw?.results||[]).slice(0,8).map(r=>({url:S.safeUrl(r.url),title:clean(r.title).slice(0,300),description:String(r.description||r.text||'').slice(0,1800),evidenceKind:'search_excerpt'})).filter(r=>r.url);if(services.search)observe({provider:'controlled-public-search',operation:'search',status:'succeeded',results:rows.length});return rows;});
 let fullJob;
 async function priorFullTask(kind,value){
  if(!input.managementLimit)return null;
  fullJob??=sql(env,`SELECT id FROM buyer_research_jobs WHERE workspace_id=? AND domain=? AND json_extract(input_json,'$.fullResearch')=1
   AND json_extract(input_json,'$.candidate.company')=? AND updated_at>=datetime('now','-30 days') ORDER BY rowid DESC LIMIT 1`,row.workspace_id,input.domain,input.company).first();
  const job=await fullJob;
  if(!job)return null;
  const receipt=await sql(env,`SELECT result_json FROM buyer_research_tasks WHERE job_id=? AND task_key=? AND status='complete'
   AND updated_at BETWEEN datetime('now','-30 days') AND datetime('now')`,job.id,await sha256(kind+'|'+value)).first();
  return receipt?parse(receipt.result_json):null;
 }
 const establishes=(page,officialContactPage=false)=>page&&sameHost(page.url,input.domain)&&S.assessIdentity({name:input.company,website:input.website},{url:page.url,text:page.markdown,title:page.title},{officialContactPage}).verified;
 const read=async (url,{confirmCompany=false}={})=>task('read',S.safeUrl(url),async(signal,operationMs)=>{
  const saved=sameHost(url,input.domain)?await priorFullTask('read',S.safeUrl(url)):null;
  const age=Date.now()-Date.parse(saved?.extractedAt);
  if(age>=0&&age<=30*86400000&&saved.sourceRead&&saved.markdown&&D.buyerSourceReadLocation(candidateFor(input),url,saved)&&(!confirmCompany||establishes(saved,true))){
   observe({provider:'saved',operation:'extract',status:'reused',results:1});
   return saved;
  }
  let raw;try{raw=await (services.read||(input.managementLimit?((url,signal)=>fetchDirectPublicPage(url,{signal})):null)||((url,signal)=>readPublicBuyerPage(env,row.workspace_id,url,{purpose:'website_contacts',signal,totalTimeoutMs:Math.min(18000,operationMs)})))(url,signal);}catch(error){
   for(const entry of error.researchTrace||[])observe(entry);
   const details=(error.researchTrace||[]).map(entry=>[entry.provider,entry.reason].filter(Boolean).join(' · ')).join(', ');
   if(details&&!signal.aborted)error.message=error.message+' ('+details+')';
   throw error;
  }
  if(signal.aborted)throw signal.reason;const page=raw?.data||raw||{};
  const actual=S.safeUrl(page.url||page.metadata?.sourceURL||url),text=String(page.markdown||page.text||page.content||'');
  if(raw?.success===false||page.error||page.metadata?.statusCode>=400||!actual||!text.trim()||!D.buyerSourceReadLocation(candidateFor(input),url,page,{move:true}))throw Error('Page unreadable or source attribution changed');
  for(const entry of raw.researchTrace||page.researchTrace||[])observe(entry);
  const result={url:actual,title:clean(page.title||page.metadata?.title||text.match(/^#\s+([^\n]+)/m)?.[1]).slice(0,300),markdown:text.slice(0,60000),textTruncated:text.length>60000,sourceRead:true,evidenceKind:'page_extract',metadata:{sourceURL:actual,statusCode:200},extractedAt:new Date().toISOString(),links:(page.links||[]).map(l=>S.safeUrl(typeof l==='string'?l:l.href)).filter(Boolean).slice(0,160)};
  if(confirmCompany&&!establishes(result,true))throw Error('Official contact page did not establish this company identity');
  return result;
 });
 const apollo=(key,payload)=>task('apollo',key,signal=>(services.apollo||((payload,options)=>searchWorkspaceApolloPeople(env,row.workspace_id,payload,{userId:row.requested_by,guard,...options})))(payload,{signal}));
 const optional=async operation=>{try{return await operation();}catch(error){if(!valid||controller.signal.aborted||['TIME_BUDGET','BATCH_LIMIT','PASS_LIMIT'].includes(error.code))throw error;state.gaps=[...new Set([...(state.gaps||[]),clean(error.message).slice(0,180)])].slice(-30);return null;}};
 const waitingPeople=()=>{
  const pending=state.people.filter(p=>!p.freeResearchStatus),finished=state.people.length-pending.length,allowed=pending.slice(0,Math.max(0,state.batchLimit-finished)),last=state.people.findIndex(p=>p.id===state.contactCursor);
  return [...allowed.filter(p=>state.people.indexOf(p)>last),...allowed.filter(p=>state.people.indexOf(p)<=last)].slice(0,3);
 };
 const recordIdentity=(candidate,person,review,page)=>{
  const official=page&&person.identityOrigin==='official'&&sameHost(page.url,input.domain)&&page.url===person.publicNameUrl&&[...D.discoverCompanyContacts([page],candidate,[]),...localStaffCards(page,input)].some(p=>websiteNameKey(p.publicName||p.name)===websiteNameKey(person.publicName||person.name)&&websiteContactRole(p.title)===websiteContactRole(person.title));
  const confirmed=websiteIdentitySupport(candidate,person).eligible&&(input.managementLimit&&official||websiteLinkedInReviewCurrent(candidate,person)&&(review.matchStatus==='double_checked'||official));
  person.identityCheck={version:1,status:confirmed?'confirmed':'needs_review',checkedAt:new Date().toISOString(),identityKey:websiteIdentityCheckKey(candidate,person),evidenceKind:official?'official':'professional_profile',...(official?{sourceUrl:page.url,sourceCheckedAt:state.tasks.find(t=>t.kind==='read'&&t.result?.url===page.url&&!t.archived)?.result?.extractedAt}:{})};
  return confirmed;
 };
 const applyProfile=(candidate,person,review)=>{
  const indexed=websiteLinkedInMatchRows(person,review.queries.flatMap(q=>q.rows||[]),candidate);
  const matched=D.matchPublicLinkedInProfiles([{...person,identitySource:'public',linkedinIdentityEvidence:null,linkedinConfirmedUrl:'',linkedinConfirmationMethod:'automatic'}],indexed,input.company)[0];
  Object.assign(person,matched,{linkedinReview:review});
 };
 const checkContacts=async()=>{
  const selected=waitingPeople();if(!selected.length)return;
  state.contactCursor=selected.at(-1).id;state.label='Check public email, phone and profiles · '+selected.map(p=>p.name).join(', ');
  const outcomes=await Promise.allSettled(selected.map(async person=>{
    const candidate=candidateFor(input,[person]);let complete=false;
    if(services.checkPerson){complete=(await services.checkPerson(candidate,person,{search,read,guard,signal:controller.signal})).complete===true;}
    else{
     if(!websiteLinkedInReviewCurrent(candidate,person)){person.linkedinReview=await reviewWebsiteLinkedIn(candidate,person,{search,guard,receipt:query=>state.tasks.find(t=>t.kind==='search'&&t.value===query&&!t.archived)});if(person.contactResearch?.checks?.linkedin)person.contactResearch.checks.linkedin.profileMatchVersion=0;}
     applyProfile(candidate,person,person.linkedinReview);
     recordIdentity(candidate,person,person.linkedinReview,reads(state).find(page=>page.url===person.publicNameUrl));
     await checkpoint();
     const linkedinQuery=D.buyerResearchQueryPlan(candidate,person).linkedin[0],profileRows=websiteLinkedInMatchRows(person,person.linkedinReview.queries.flatMap(q=>q.rows||[]),candidate);
     const report=await D.runMandatoryBuyerResearch(candidate,{search:query=>query===linkedinQuery?Promise.resolve(profileRows):search(query),readPage:read,rows:reads(state),guard,signal:controller.signal,maxDurationMs:Math.max(1000,windowMs-(clock()-start)-1000),observeTools:false,crossCheck:async p=>task('independent',String(p.id),signal=>services.independent?services.independent(p,{signal}):searchWorkspaceBuyerContact(env,row.workspace_id,{company:input.company,domain:input.domain,person:p,signal}))});
     Object.assign(person,candidate.people[0]);state.linkedinReviewVersion=WEBSITE_LINKEDIN_REVIEW_VERSION;complete=websiteFreeResearchComplete(candidate,person);
     if(!complete&&(report.stopReason==='time_budget'||controller.signal.aborted))throw Object.assign(Error('Public contact checks continue in the next slice'),{code:'TIME_BUDGET'});
    }
    if(person.identityOrigin!=='official'){const pages=reads(state).filter(p=>p.markdown),supported=[...D.discoverCompanyContacts(pages,candidate,[]),...pages.filter(p=>sameHost(p.url,input.domain)).flatMap(p=>localStaffCards(p,input))].find(p=>clean(p.name).toLowerCase()===clean(person.name).toLowerCase()&&websiteContactRole(p.title)===websiteContactRole(person.title));if(supported){person.identityOrigin='official';person.publicNameUrl=supported.publicNameUrl;}}
    await guard();complete=complete&&!person.identityConflict;person.freeResearchStatus=complete?'complete':'needs_review';person.freeCheckedAt=new Date().toISOString();state.freeRevision=(state.freeRevision||1)+1;state.performance.firstCheckedAt||=new Date().toISOString();
  }));
  await checkpoint();const failed=outcomes.find(result=>result.status==='rejected');if(failed)throw failed.reason;
 };
 const checkIdentity=async()=>{
  const person=state.people.find(p=>String(p.id)===focused.personId);
  if(!person)throw contactError('The selected contact changed.');
  const candidate=candidateFor(input,[person]);state.label='Checking identity · '+(person.publicName||person.name);
  const officialOnly=input.managementLimit&&person.identityOrigin==='official'&&sameHost(person.publicNameUrl,input.domain);
  const review=officialOnly?{matchStatus:'not_checked'}:await reviewWebsiteLinkedIn(candidate,person,{search:input.managementLimit?managementIndex:search,guard,receipt:query=>state.tasks.find(t=>t.kind===(input.managementLimit?'public_index':'search')&&t.value===query&&!t.archived)});
  // Fresh matching may clear an older derived profile hold; a namesake/role
  // conflict in the saved roster remains authoritative and is never overridden.
  if(!officialOnly)applyProfile(candidate,person,review);
  const page=review.matchStatus!=='double_checked'&&person.identityOrigin==='official'&&sameHost(person.publicNameUrl,input.domain)?await optional(()=>read(person.publicNameUrl)):null;
  await guard();const confirmed=recordIdentity(candidate,person,review,page);
  state.freeRevision=(state.freeRevision||1)+1;delete state.personCheck;
  status=state.phase==='contacts'&&state.people.every(p=>p.freeResearchStatus==='complete')?'complete':'incomplete';
  state.stopReason='identity_checked';state.label=confirmed?'Identity confirmed. Paid email and phone research are ready for separate approval.':'Identity check saved. The person or current company still needs review.';
  await checkpoint();
 };
 const leadershipSearch=async()=>{
  state.label='Apollo free leadership search · decision-makers first';
  const leaders=await optional(()=>apollo('leadership',{domain:input.domain,person_titles:['CEO','Chief Executive Officer','Managing Director','President','Founder','Director','Head']}));
  state.apolloPeople=[...(state.apolloPeople||[]),...(leaders?.people||[])].slice(0,110);state.apolloLeadershipDone=true;
  observe({provider:'apollo',operation:'leadership_identity_search',status:leaders?'succeeded':'unavailable',results:leaders?.people?.length||0,paidReveal:false});
 };
 const plannedPages=()=>{
  const found=new Set(state.tasks.filter(t=>t.kind==='read'&&t.status==='complete').flatMap(t=>[t.value,t.result.url]));
  return [...new Set([...state.tasks.filter(t=>t.kind==='search'&&t.status==='complete'&&!t.archived).flatMap(t=>t.result.map(r=>r.url)),...reads(state).flatMap(p=>p.links||[])])].filter(url=>sameHost(url,input.domain)&&!found.has(url)&&!state.tasks.some(t=>t.kind==='read'&&t.value===url&&t.attempts>=2)).sort((a,b)=>Number(contactPage(b))-Number(contactPage(a)));
 };
 // The saved company still has to establish its identity on its own domain.
 // Search excerpts and directory listings can locate a page but cannot authorize it.
 const readCompanyIdentity=async()=>{
  const attempted=(kind,value)=>state.tasks.some(t=>t.kind===kind&&t.value===value&&t.status==='failed'&&t.attempts>0);
  const home=attempted('read',input.website)?null:await optional(()=>read(input.website));
  if(home){
   if(establishes(home,true))return home;
   throw Error('The website does not establish this saved company identity. Review its name and website.');
  }
  state.label='Finding an official contact page after the homepage could not be read';
  const query=queries(input)[1],results=attempted('search',query)?[]:await optional(()=>search(query));
  const paths=input.domain.endsWith('.dk')?['/kontakt-os/','/kontakt/']:['/contact/','/contact-us/'];
  const urls=[...new Set([...(results||[]).map(row=>row.url).filter(url=>sameHost(url,input.domain)&&contactPage(new URL(url).pathname)),...paths.map(path=>new URL(path,input.website).href)])].slice(0,3);
  for(const url of urls){
   if(attempted('read',url))continue;
   const page=await optional(()=>read(url,{confirmCompany:true}));
   if(establishes(page,true))return page;
  }
  throw Error('The homepage could not be read and no official contact page confirmed the company. See Access and research gaps for the sources checked.');
 };
 const readBatch=async urls=>{
  const outcomes=await Promise.allSettled(urls.map(url=>optional(()=>read(url))));
  const failed=outcomes.find(result=>result.status==='rejected');if(failed)throw failed.reason;
 };

 try{
  for(let stepInSlice=0;stepInSlice<8&&status==='queued';stepInSlice++){
  await guard();if(clock()>row.deadline_at){state.label='Research pass time limit reached; results are saved. Continue unfinished checks when needed.';state.stopReason='time_limit';status='incomplete';}
  else if(input.managementLimit&&focused){await checkIdentity();}
  else if(input.managementLimit){
   const pages=reads(state).filter(p=>p.markdown&&sameHost(p.url,input.domain));
   if(!state.identityVerifiedAt){
    let home=await optional(()=>read(input.website));
    if(!establishes(home,true)){
     const query='site:'+input.domain+' (contact OR team OR management OR kontakt)';
     const found=await managementIndex(query);
     for(const hit of found.filter(hit=>sameHost(hit.url,input.domain)).slice(0,2)){
      home=await optional(()=>read(hit.url,{confirmCompany:true}));if(establishes(home,true))break;
     }
     if(!establishes(home,true))throw Error('Official website did not confirm the saved company.');
    }
    state.identityVerifiedAt=new Date().toISOString();state.description=companyDescription(home);state.descriptionSourceUrl=home.url;
   }else{
    const seen=new Set(state.tasks.filter(t=>t.kind==='read'&&t.status!=='pending').map(t=>t.value));
    const available=[...new Set(pages.flatMap(p=>p.links||[]))].filter(url=>sameHost(url,input.domain)&&!seen.has(url));
    const contactLinks=available.filter(url=>contactPage(new URL(url).pathname)&&!state.people.some(p=>websiteNameKey(p.name).split(' ').every(word=>websiteNameKey(url).includes(word)))).sort((a,b)=>Number(/staff|team|medarbejder|leadership/i.test(b))-Number(/staff|team|medarbejder|leadership/i.test(a)));
    if(!state.managementDiscoveryDone){
     const urls=contactLinks.slice(0,Math.min(3,Math.max(0,8-(state.managementReads||0))));
     if(urls.length){await readBatch(urls);state.managementReads=(state.managementReads||0)+urls.length;}
     else state.managementDiscoveryDone=true;
     acquire(state,input);
    }else{
     const priorities=state.people.slice(0,4);
     const deeper=available.filter(url=>priorities.some(p=>{
      if(p.publishedStaffCard?.email&&p.publishedStaffCard?.phone&&p.publicLinkedinUrl&&p.gmailMatches?.length)return false;
      const name=websiteNameKey(p.publicName||p.name).split(' ').filter(w=>w.length>2);
      return name.length>=2&&name.every(word=>websiteNameKey(url).includes(word));
     }));
     const urls=deeper.slice(0,Math.min(3,Math.max(0,8-(state.managementDetailReads||0))));
     if(urls.length){await readBatch(urls);state.managementDetailReads=(state.managementDetailReads||0)+urls.length;acquire(state,input);}
     else{
      const index=async query=>{
       if(state.managementIndexUnavailable)return undefined;
       const hits=await optional(()=>managementIndex(query));
       if(!hits)state.managementIndexUnavailable=true;
       return hits;
      };
      const readResult=url=>optional(()=>read(url));
      if(!state.managementDirectoryDone){
       if(services.apollo||(await apolloCapabilities(env,row.workspace_id)).discovery&&(await resolveWorkspaceServiceCredential(env,row.workspace_id,'apollo')).configured){
        const directory=await optional(()=>task('apollo','management-company-identities',async signal=>{
         for(const attempt of [1,2]){
          const retained=await priorFullTask('search','Apollo people search · '+input.domain+' · domain · attempt '+attempt);
          if(retained?.status==='succeeded'&&Array.isArray(retained.people))return {people:retained.people,reused:true};
         }
         const lookup=services.apollo||((payload,options)=>searchWorkspaceApolloPeople(env,row.workspace_id,payload,{userId:row.requested_by,guard,...options}));
         return lookup({domain:input.domain,discovery_scope:'company',page:1},{signal});
        }));
        observe({provider:'apollo',operation:'identity_search',status:directory?.reused?'reused':directory?'succeeded':'unavailable',results:directory?.people?.length||0,paidReveal:false});
        if(directory)state.managementDirectoryPeople=await managementDirectoryPeople(input,directory.people||[],{index,read:readResult,sourceRows:()=>reads(state)});
        await guard();acquire(state,input);
       }else observe({provider:'apollo',operation:'identity_search',status:'skipped',reason:'Apollo Free discovery is unavailable for this workspace',results:0,paidReveal:false});
       state.managementDirectoryDone=true;
       await checkpoint();
      }
      for(const person of state.people){
       if(person.managementChecks&&person.freeResearchStatus==='complete')continue;
       person.managementChecks=await managementChannels(input,person,pages,{index,read:readResult});
       person.publicSourcesChecked=pages.length>0;person.freeCheckedAt=new Date().toISOString();
       person.freeResearchStatus=Object.values(person.managementChecks).every(c=>c.status==='complete')?'complete':'needs_review';
       const page=pages.find(p=>p.url===person.publicNameUrl);
       recordIdentity(input,person,{matchStatus:'not_checked'},page);
       await checkpoint();
      }
      state.managementResearchVersion=MANAGEMENT_RESEARCH_VERSION;
      const unfinished=state.people.filter(person=>person.freeResearchStatus==='needs_review').length;
      delete state.personCheck;state.phase='contacts';status=unfinished||state.gaps.length?'incomplete':'complete';state.stopReason='sources_checked';
      state.label=unfinished?'Company pages checked. Additional public contact searches remain incomplete for '+unfinished+' of '+state.people.length+' people.':'Published contact details checked for '+state.people.length+' decision-makers.';
     }
    }
   }
  }
  else if(focused){await checkIdentity();}
  else if(state.phase==='discovery'){
   if(state.people.filter(p=>p.freeResearchStatus).length>=state.batchLimit){
    state.stopReason='contact_batch';state.label='Public checks saved for this contact batch. Continue for more contacts and deeper company sources';state.coverage.pendingSourceUrls=plannedPages().slice(0,120);state.coverage.discoveryIncomplete=true;status='incomplete';break;
   }
   const step=state.discoveryStep||0;
   if(state.identityVerifiedAt&&!state.apolloLeadershipDone){await leadershipSearch();acquire(state,input);continue;}
   if(state.identityVerifiedAt&&!state.fastSourcesDone){
    await readBatch(plannedPages().filter(contactPage).slice(0,3));state.fastSourcesDone=true;acquire(state,input);continue;
   }
   // Alternate useful contact work with broader source discovery. A large
   // corporate site must not make its known leaders wait for every page.
   if(state.apolloLeadershipDone&&state.contactsDue!==false&&waitingPeople().length){state.contactsDue=false;await checkContacts();continue;}
   state.contactsDue=true;
   if(step===0){state.label='Read the company website';const page=await readCompanyIdentity();state.identityVerifiedAt=new Date().toISOString();state.description=companyDescription(page);state.descriptionSourceUrl=page.url;state.discoveryStep++;}
   else if(step<=6){state.label=step===1?'Find decision-makers and senior management':'Discover staff and published company contact pages';await optional(()=>search(queries(input)[step-1]));state.discoveryStep++;}
   else if(step===7){
    const planned=plannedPages();
    if(planned.length&&reads(state).length<40){state.label='Read company contact and leadership sources';await readBatch(planned.slice(0,Math.min(3,40-reads(state).length)));}else{state.coverage.pendingSourceUrls=planned.slice(0,120);state.coverage.sourceLimitReached=planned.length>0;state.discoveryStep++;}
   }else if(step===8){
    if(!state.apolloLeadershipDone){await leadershipSearch();continue;}
    const page=state.apolloPage||1;state.label='Apollo free identity search · no email or phone reveal';
    const result=await optional(()=>apollo('company-page-'+page,{domain:input.domain,discovery_scope:'company',page}));
    state.apolloPeople=[...(state.apolloPeople||[]),...(result?.people||[])].slice(0,110);observe({provider:'apollo',operation:'identity_search',status:result?'succeeded':'unavailable',results:result?.people?.length||0,paidReveal:false});
    if(result?.people?.length===25&&page<4)state.apolloPage=page+1;else{state.coverage.apolloLimitReached=result?.people?.length===25;state.discoveryStep++;}
   }else{
    // Free Apollo can return only a first name. Use those professional hints
    // for bounded public follow-up, rather than discarding their value or
    // revealing contacts. Only supported full identities enter the roster.
    const hints=[...new Set((state.apolloPeople||[]).filter(p=>!D.hasFullBuyerName(p.name)&&clean(p.name).length>=2&&clean(p.title)).map(p=>'"'+clean(p.name).replaceAll('"','')+'" "'+input.company.replaceAll('"','')+'" "'+clean(p.title).replaceAll('"','')+'" (LinkedIn OR contact OR team)'))].slice(0,8);
    state.coverage.apolloUnresolved=[...new Set((state.apolloPeople||[]).filter(p=>!D.hasFullBuyerName(p.name)).map(p=>p.id||p.name+'|'+p.title))].length;
    if((state.hintStep||0)<hints.length){state.label='Resolve incomplete directory identities using public sources';await optional(()=>search(hints[state.hintStep||0]));state.hintStep=(state.hintStep||0)+1;}
    else{acquire(state,input);state.phase='contacts';state.coverage.discoveryIncomplete=false;state.label='Check published contact details · management first';}
   }
   if(state.identityVerifiedAt)acquire(state,input);
  }else if(state.phase==='contacts'){
   if(!waitingPeople().length){
    const pending=state.people.filter(p=>!p.freeResearchStatus);status=!pending.length&&!state.people.some(p=>p.freeResearchStatus==='needs_review')?'complete':'incomplete';state.stopReason=pending.length?'contact_batch':status==='complete'?'sources_checked':'needs_review';state.label=pending.length?'Public checks saved. Continue with the next 10 contacts':status==='complete'?'Public research complete for the discovered contacts':'Some public checks need review; completed evidence is saved';
   }else await checkContacts();
  }
  if(clock()-start>windowMs-Math.min(3000,windowMs*.15))break;
  }
 }catch(error){if(!valid){status='canceled';}else if(error.code==='PASS_LIMIT'){status='incomplete';state.stopReason='time_limit';state.label=error.message;}else if(controller.signal.aborted||error.code==='TIME_BUDGET'){status='queued';}else{status='incomplete';state.stopReason=error.code==='BATCH_LIMIT'?'operation_limit':'source_unavailable';state.label=clean(error.message).slice(0,220);}}
 finally{
  clearTimeout(timer);controller.abort();await Promise.allSettled([...inFlight.values()]);await checkpointTail.catch(()=>{});compact(state);state.sources=reads(state).map(({markdown,links,...source})=>source);
  let updated;try{updated=valid?await sql(env,`UPDATE website_contact_jobs SET status=?,state_json=?,revision=revision+1,lease_token=NULL,lease_until=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND status='running' AND ${authority}`,status,JSON.stringify(state),row.id,lease).run():{meta:{changes:0}};}catch(error){if(!storageFailure(error))throw error;status='incomplete';updated=await sql(env,"UPDATE website_contact_jobs SET status='incomplete',lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND status='running'",row.id,lease).run();}
  if(!updated.meta.changes)await sql(env,"UPDATE website_contact_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1 WHERE id=? AND lease_token=? AND status='running'",row.id,lease).run();
 }
 return [{id:row.id,status}];
 }finally{budget?.release(130);}
}
