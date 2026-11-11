import {websiteFreeResearchComplete,websiteContactRole,websiteContactIdentity} from './website-contact-evidence.js';
import {storageFailure} from './workspace-storage.js';
import {contactSql as sql,contactParse as parse,contactAuthority as authority,contactError,contactActive} from './website-contact-store.js';
import {createBuyerSourceSearch} from './buyer-source-search.js';
import {readPublicBuyerPage,searchWorkspaceApolloPeople} from './service-integrations.js';
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
const contactPage=url=>/contact|kontakt|team|management|leadership|about|people|board|staff|company|governance/i.test(url);
const companyDescription=page=>page.markdown.split(/\n/).filter(line=>!/^\s*#{1,6}\s/.test(line)).map(line=>clean(line.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/[*_]/g,''))).find(line=>line.length>=30&&line.split(/\s+/).length>=5&&!/cookie|privacy|copyright|all rights reserved|^©|^read more|^click here|^learn more/i.test(line))?.slice(0,320)||'';
const reads=state=>(state.tasks||[]).filter(t=>t.kind==='read'&&t.status==='complete').map(t=>t.result);
const candidateFor=(input,people=[])=>({company:input.company,domain:input.domain,website:input.website,people});
function sourceChunks(page){
 const blocks=String(page.markdown||'').split(/\n(?=#{2,6}\s)/);if(blocks.length<=30)return [page];
 const header=blocks.shift(),chunks=[];for(let i=0;i<blocks.length;i+=30)chunks.push({...page,markdown:header+'\n'+blocks.slice(i,i+30).join('\n')});return chunks;
}
function localStaffCards(page,input){
 const found=[],role=/direktør|direktör|koncernchef|bestyrels|afdelingschef|vadītāj|priekšsēdētāj|valdes locekl/i;
 // Neutral website research also accepts local-language staff cards. Require
 // a named company-domain email or an explicit official leadership/team page;
 // a name mentioned on a homepage alone does not establish employment.
 const staffPage=/ledelse|medarbejd|bestyrelse|ledning|management|leadership|team|vadiba|komanda/i.test(page.url)||/^#{1,4}\s*(?:ledelse|medarbejdere|bestyrelse|ledning|management|leadership|team|vadība|komanda)\s*$/imu.test(page.markdown);
 for(const match of page.markdown.matchAll(/^#{2,5}\s+([^\n]+)\n+([^\n]{3,120})/gm)){
  const name=clean(match[1]),title=clean(match[2]);if(!D.hasFullBuyerName(name)||!role.test(title)||/contact|kontakt|privacy|company|management|leadership|team|group/i.test(name)||/former|previous|retired|tidigare/i.test(title))continue;
  const person={name,publicName:name,title,organization:input.company,publicNameUrl:page.url,identitySource:'public',identityStatus:'confirmed',nameVerification:'confirmed',companyContactSource:'official_staff'};
  const named=D.sourcedBuyerEmails(person,input.domain,[page],input.company).some(row=>row.email.endsWith('@'+input.domain));
  if(!named&&!staffPage)continue;
  found.push(D.matchPublicBuyerDetails([person],[page],input.domain,input.company)[0]);
 }
 return found;
}
function acquire(state,input){
 const pages=reads(state).filter(p=>p.markdown&&!p.archived),candidate=candidateFor(input),roster=[...(state.people||[])];
 const add=(p,origin)=>{
  if(!websiteContactIdentity({...p,identityOrigin:origin}))return;
  const name=clean(p.publicName||p.name),title=clean(p.title),profile=D.normalizeLinkedInUrl(p.publicLinkedinUrl||p.linkedin_url);if(!D.hasFullBuyerName(name))return;
  const matches=roster.filter(old=>clean(old.name).toLocaleLowerCase()===name.toLocaleLowerCase()&&websiteContactRole(old.title)===websiteContactRole(title)&&(!profile||!D.normalizeLinkedInUrl(old.publicLinkedinUrl||old.linkedin_url)||D.normalizeLinkedInUrl(old.publicLinkedinUrl||old.linkedin_url)===profile));
  const prior=matches.length===1?matches[0]:null;
  if(!prior){roster.push({...p,id:'web-'+crypto.randomUUID(),name,organization:input.company,identityOrigin:origin,...(origin==='apollo'?{identityStatus:'directory_listing'}:{})});return;}
  if(origin!=='official'&&prior.identityOrigin==='official'){
   if(profile&&!D.normalizeLinkedInUrl(prior.publicLinkedinUrl||prior.linkedin_url)){prior.linkedin_url=p.publicLinkedinUrl||p.linkedin_url;delete prior.contactResearch;delete prior.emailResearch;delete prior.freeResearchStatus;}
   return;
  }
  const oldProfile=D.normalizeLinkedInUrl(prior.publicLinkedinUrl||prior.linkedin_url),receipt=prior.contactResearch,done=prior.freeResearchStatus;
  Object.assign(prior,{...p,id:prior.id,name,organization:input.company,identityOrigin:origin==='official'?'official':prior.identityOrigin,identityStatus:origin==='apollo'&&prior.identityOrigin!=='official'?'directory_listing':p.identityStatus||prior.identityStatus});
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
 for(const task of state.tasks.filter(t=>t.kind==='search'&&t.status==='complete'&&!t.archived))for(const person of D.tracePublicBuyers(task.result,input.company,{companyDomain:input.domain,collectAllCompanyContacts:true,includeIndexedCompanyContacts:true}).people)add(person,'public_listing');
 const nameCounts=new Map();for(const person of roster)nameCounts.set(person.name.toLocaleLowerCase(),(nameCounts.get(person.name.toLocaleLowerCase())||0)+1);
 for(const person of roster){person.identityConflict=nameCounts.get(person.name.toLocaleLowerCase())>1;if(person.identityConflict)delete person.freeResearchStatus;}
 const all=roster.sort((a,b)=>leadership(a.title)-leadership(b.title)||a.name.localeCompare(b.name));
 state.coverage.peopleTruncated=all.length>300;state.people=all.slice(0,300);state.coverage.channelLimitReached=channels.size>300||routes.size>300;state.channels=[...channels.values()].slice(0,300);state.routes=[...routes.values()].slice(0,300);
}
function compact(state){
 // Completed person receipts and exact source quotes live on the roster. Rotate
 // old response bodies, retaining URL/read/time/count receipts; a future need
 // for an archived body triggers a fresh read, never a fabricated cache hit.
 const completed=state.tasks.filter(t=>t.status==='complete'),keepReads=new Set(completed.filter(t=>t.kind==='read').slice(-60)),keepSearches=new Set(completed.filter(t=>t.kind==='search').slice(-60));
 for(const task of completed){if(task.kind==='read'&&state.phase==='contacts')delete task.result.links;if(task.kind==='read'&&!keepReads.has(task)&&!task.archived){const {markdown,links,...receipt}=task.result;task.result={...receipt,archived:true};task.archived=true;task.attempts=0;state.coverage.rotatedBodies=true;}if(task.kind==='search'&&!keepSearches.has(task)&&!task.archived){task.resultCount=task.result.length;task.result=task.result.map(({url,title})=>({url,title}));task.archived=true;task.attempts=0;state.coverage.rotatedBodies=true;}}
}
function queries(input){const domain=input.domain,name=input.company.replaceAll('"','');return [
 `site:${domain} (CEO OR chief OR management OR leadership OR directors OR board)`,
 `site:${domain} (contact OR contacts OR kontakt OR team OR staff OR people) (email OR phone OR LinkedIn)`,
 `"${name}" (executive OR director OR manager OR head) (email OR contact OR LinkedIn)`,
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
 const excluded=(state.people||[]).filter(p=>!websiteContactIdentity(p));
 if(excluded.length){state.excludedIdentities=[...(state.excludedIdentities||[]),...excluded.map(p=>({...p,exclusionReason:'Indexed publication or unsupported professional identity'}))].slice(-300);state.people=state.people.filter(websiteContactIdentity);}
 const guard=async()=>{
  if(controller.signal.aborted)throw Object.assign(Error('Processing slice ended'),{code:'TIME_BUDGET'});
  if(budget&&!budget.hasRoom(15))throw Object.assign(Error('Shared processing budget reached'),{code:'TIME_BUDGET'});
  const owned=await sql(env,`SELECT id FROM website_contact_jobs WHERE id=? AND lease_token=? AND status='running' AND lease_until>? AND ${authority}`,row.id,lease,clock()).first();
  if(!owned){valid=false;throw contactError('Company identity or research authority changed.');}
 };
 const observe=entry=>{state.tools=[...(state.tools||[]),{...entry,at:new Date().toISOString()}].slice(-150);};
 const searchSource=services.search||createBuyerSourceSearch(env,row.workspace_id,{guard,signal:controller.signal,observe});
 async function task(kind,value,operation){
  await guard();let saved=state.tasks.find(t=>t.kind===kind&&t.value===value);
  if(saved?.status==='complete'&&!saved.archived)return saved.result;
  if(saved?.attempts>=2)throw Object.assign(Error(saved.reason||'Source unavailable after two attempts'),{code:'SOURCE_UNAVAILABLE'});
  if(!saved){if(state.tasks.length>=(state.operationLimit||600))throw Object.assign(Error('This research batch reached its operation limit'),{code:'BATCH_LIMIT'});saved={kind,value,status:'pending',attempts:0};state.tasks.push(saved);}
  saved.attempts++;saved.status='running';delete saved.archived;
  try{const result=await operation();await guard();saved.result=result;saved.status='complete';saved.checkedAt=new Date().toISOString();compact(state);const checkpoint=await sql(env,`UPDATE website_contact_jobs SET state_json=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND status='running' AND ${authority}`,JSON.stringify(state),row.id,lease).run();if(!checkpoint.meta.changes){valid=false;throw contactError('Research authority changed before saving its source receipt.');}return result;}
  catch(error){saved.status='failed';saved.reason=error.code==='TIME_BUDGET'?'Processing slice ended':clean(error.message).slice(0,180);if(error.code==='TIME_BUDGET'||controller.signal.aborted)saved.attempts--;throw error;}
 }
 const search=async query=>task('search',query,async()=>{const raw=await searchSource(query),rows=(Array.isArray(raw)?raw:raw?.results||[]).slice(0,8).map(r=>({url:S.safeUrl(r.url),title:clean(r.title).slice(0,300),description:String(r.description||r.text||'').slice(0,1800),evidenceKind:'search_excerpt'})).filter(r=>r.url);if(services.search)observe({provider:'controlled-public-search',operation:'search',status:'succeeded',results:rows.length});return rows;});
 const read=async url=>task('read',S.safeUrl(url),async()=>{
  const raw=await (services.read||((url)=>readPublicBuyerPage(env,row.workspace_id,url,{signal:controller.signal,totalTimeoutMs:18000})))(url,controller.signal),page=raw?.data||raw||{};
  const actual=S.safeUrl(page.url||page.metadata?.sourceURL||url),text=String(page.markdown||page.text||page.content||'');
  if(raw?.success===false||page.error||page.metadata?.statusCode>=400||!actual||!text.trim()||!D.buyerSourceReadLocation(candidateFor(input),url,page,{move:true}))throw Error('Page unreadable or source attribution changed');
  for(const entry of raw.researchTrace||page.researchTrace||[])observe(entry);
  return {url:actual,title:clean(page.title||page.metadata?.title||text.match(/^#\s+([^\n]+)/m)?.[1]).slice(0,300),markdown:text.slice(0,60000),textTruncated:text.length>60000,sourceRead:true,evidenceKind:'page_extract',metadata:{sourceURL:actual,statusCode:200},extractedAt:new Date().toISOString(),links:(page.links||[]).map(l=>S.safeUrl(typeof l==='string'?l:l.href)).filter(Boolean).slice(0,160)};
 });
 const optional=async operation=>{try{return await operation();}catch(error){if(!valid||controller.signal.aborted||['TIME_BUDGET','BATCH_LIMIT'].includes(error.code))throw error;state.gaps=[...new Set([...(state.gaps||[]),clean(error.message).slice(0,180)])].slice(-30);return null;}};
 try{
  for(let stepInSlice=0;stepInSlice<8&&status==='queued';stepInSlice++){
  await guard();if(clock()>row.deadline_at){state.label='Research paused after 30 minutes; completed contacts are saved';status='incomplete';}
  else if(state.phase==='discovery'){
   const step=state.discoveryStep||0;
   if(step===0){state.label='Read the company website';const page=await read(input.website);const identity=S.assessIdentity({name:input.company,website:input.website},{url:page.url,text:page.markdown,title:page.title});if(!identity.verified)throw Error('The website does not establish this saved company identity. Review its name and website.');state.identityVerifiedAt=new Date().toISOString();state.description=companyDescription(page);state.descriptionSourceUrl=page.url;state.discoveryStep++;}
   else if(step<=6){state.label=step===1?'Find decision-makers and senior management':'Discover staff and published company contact pages';await optional(()=>search(queries(input)[step-1]));state.discoveryStep++;}
   else if(step===7){
    const found=new Set(reads(state).map(p=>p.url)),planned=[...new Set([...(state.tasks.filter(t=>t.kind==='search'&&t.status==='complete').flatMap(t=>t.result.map(r=>r.url))),...reads(state).flatMap(p=>p.links||[])])].filter(url=>sameHost(url,input.domain)&&!found.has(url)&&!state.tasks.some(t=>t.kind==='read'&&t.value===url&&t.attempts>=2)).sort((a,b)=>Number(contactPage(b))-Number(contactPage(a)));
    if(planned.length&&reads(state).length<40){state.label='Read company contact and leadership sources';await optional(()=>read(planned[0]));}else{state.coverage.pendingSourceUrls=planned.slice(0,120);state.coverage.sourceLimitReached=planned.length>0;state.discoveryStep++;}
   }else if(step===8){
    if(!state.apolloLeadershipDone){state.label='Apollo free leadership search · decision-makers first';const leaders=await optional(()=>task('apollo','leadership',()=>(services.apollo||((payload)=>searchWorkspaceApolloPeople(env,row.workspace_id,payload,{userId:row.requested_by,guard,signal:controller.signal})))({domain:input.domain,person_titles:['CEO','Chief Executive Officer','Managing Director','President','Founder','Director','Head']})));state.apolloPeople=[...(state.apolloPeople||[]),...(leaders?.people||[])].slice(0,110);state.apolloLeadershipDone=true;observe({provider:'apollo',operation:'leadership_identity_search',status:leaders?'succeeded':'unavailable',results:leaders?.people?.length||0,paidReveal:false});continue;}
    const page=state.apolloPage||1;state.label='Apollo free identity search · no email or phone reveal';
    const result=await optional(()=>task('apollo','company-page-'+page,()=> (services.apollo||((payload)=>searchWorkspaceApolloPeople(env,row.workspace_id,payload,{userId:row.requested_by,guard,signal:controller.signal})))({domain:input.domain,discovery_scope:'company',page})));
    state.apolloPeople=[...(state.apolloPeople||[]),...(result?.people||[])].slice(0,110);observe({provider:'apollo',operation:'identity_search',status:result?'succeeded':'unavailable',results:result?.people?.length||0,paidReveal:false});
    if(result?.people?.length===25&&page<4)state.apolloPage=page+1;else{state.coverage.apolloLimitReached=result?.people?.length===25;state.discoveryStep++;}
   }else{
    // Free Apollo can return only a first name. Use those professional hints
    // for bounded public follow-up, rather than discarding their value or
    // revealing contacts. Only supported full identities enter the roster.
    const hints=[...new Set((state.apolloPeople||[]).filter(p=>!D.hasFullBuyerName(p.name)&&clean(p.name).length>=2&&clean(p.title)).map(p=>'"'+clean(p.name).replaceAll('"','')+'" "'+input.company.replaceAll('"','')+'" "'+clean(p.title).replaceAll('"','')+'" (LinkedIn OR contact OR team)'))].slice(0,8);
    state.coverage.apolloUnresolved=[...new Set((state.apolloPeople||[]).filter(p=>!D.hasFullBuyerName(p.name)).map(p=>p.id||p.name+'|'+p.title))].length;
    if((state.hintStep||0)<hints.length){state.label='Resolve incomplete directory identities using public sources';await optional(()=>search(hints[state.hintStep||0]));state.hintStep=(state.hintStep||0)+1;}
    else{acquire(state,input);state.phase='contacts';state.label='Check published contact details · management first';}
   }
   if(state.identityVerifiedAt)acquire(state,input);
  }else if(state.phase==='contacts'){
   const person=state.people.find(p=>!p.freeResearchStatus);
   if(!person||state.people.filter(p=>p.freeResearchStatus).length>=state.batchLimit){status=!person&&!state.people.some(p=>p.freeResearchStatus==='needs_review')?'complete':'incomplete';state.label=person?'Public checks saved. Continue with the next 10 contacts':status==='complete'?'Public research complete for the discovered contacts':'Some public checks need review; completed evidence is saved';}
   else{
    state.label='Check public email, phone and profiles · '+person.name;
    const candidate=candidateFor(input,[person]);let complete=false;
    if(services.checkPerson){complete=(await services.checkPerson(candidate,person,{search,read,guard,signal:controller.signal})).complete===true;}
    else{
     const report=await D.runMandatoryBuyerResearch(candidate,{search,readPage:read,rows:reads(state),guard,signal:controller.signal,maxDurationMs:Math.max(1000,windowMs-(clock()-start)-1000),observeTools:false,crossCheck:async p=>task('independent',String(p.id),()=>services.independent?services.independent(p):searchWorkspaceBuyerContact(env,row.workspace_id,{company:input.company,domain:input.domain,person:p,signal:controller.signal}))});
     Object.assign(person,candidate.people[0]);complete=websiteFreeResearchComplete(candidate,person);
     if(!complete&&(report.stopReason==='time_budget'||controller.signal.aborted))throw Object.assign(Error('Public contact checks continue in the next slice'),{code:'TIME_BUDGET'});
    }
    if(person.identityOrigin!=='official'){const pages=reads(state).filter(p=>p.markdown),supported=[...D.discoverCompanyContacts(pages,candidate,[]),...pages.filter(p=>sameHost(p.url,input.domain)).flatMap(p=>localStaffCards(p,input))].find(p=>clean(p.name).toLowerCase()===clean(person.name).toLowerCase()&&websiteContactRole(p.title)===websiteContactRole(person.title));if(supported){person.identityOrigin='official';person.publicNameUrl=supported.publicNameUrl;}}
    await guard();complete=complete&&!person.identityConflict;person.freeResearchStatus=complete?'complete':'needs_review';person.freeCheckedAt=new Date().toISOString();state.freeRevision=(state.freeRevision||1)+1;
   }
  }
  if(clock()-start>windowMs-Math.min(3000,windowMs*.15))break;
  }
 }catch(error){if(!valid){status='canceled';}else if(controller.signal.aborted||error.code==='TIME_BUDGET'){status='queued';}else{status='incomplete';state.label=clean(error.message).slice(0,220);}}
 finally{
  clearTimeout(timer);controller.abort();compact(state);state.sources=reads(state).map(({markdown,links,...source})=>source);
  let updated;try{updated=valid?await sql(env,`UPDATE website_contact_jobs SET status=?,state_json=?,revision=revision+1,lease_token=NULL,lease_until=0,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND status='running' AND ${authority}`,status,JSON.stringify(state),row.id,lease).run():{meta:{changes:0}};}catch(error){if(!storageFailure(error))throw error;status='incomplete';updated=await sql(env,"UPDATE website_contact_jobs SET status='incomplete',lease_token=NULL,lease_until=0,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE id=? AND lease_token=? AND status='running'",row.id,lease).run();}
  if(!updated.meta.changes)await sql(env,"UPDATE website_contact_jobs SET status='canceled',lease_token=NULL,lease_until=0,revision=revision+1 WHERE id=? AND lease_token=? AND status='running'",row.id,lease).run();
 }
 return [{id:row.id,status}];
 }finally{budget?.release(130);}
}
