import {websiteLinkedInMatchRows} from './website-linkedin-review.js';
import {websiteContactIdentity,websiteNameKey} from './website-contact-evidence.js';

export function managementLimit(value){
 if(!Number.isInteger(value)||value<1||value>10)throw Object.assign(Error('Choose between 1 and 10 decision-makers.'),{status:400});
 return value;
}
function roleScore(person,roles){
 const title=websiteNameKey(person.title);
 const operational=/production|operations|procurement|purchasing|sourcing|manufacturing|plant|workshop|produktion|indkøb|værkfør|driftschef/.test(title);
 const manager=/\b(manager|director|head|chief|partner|founder|owner|president|executive|chair|lead|supervisor|ceo|cfo|coo|cto|cio|chro)\b|direkt[øo]r|direktor|chef\b|leder\b|værkfører|bestyrels|chairman/i.test(title);
 const authority=/\b(?:responsible for|leads?|manages?)\s+(?:staffing|procurement|purchasing|suppliers)\b|indkøbsansvarlig/i.test(title+' '+websiteNameKey(person.roleEvidence||''));
 if(!manager&&!authority||/former|retired|assistant to|executive assistant|assistent for/.test(title))return 0;
 if(/payroll|bookkeep|boghold|reception|løn|administration|administrative assistant/.test(title)&&!authority&&!operational)return 0;
 const preferred=roles.some(role=>role.length>=3&&title.includes(role));
 return (preferred?60:0)+(operational?50:/board|bestyrels|chair/.test(title)?12:/direktør|director|chief|ceo|owner|founder/.test(title)?42:/project|projekt/.test(title)?35:25)+(person.identityOrigin==='official'?4:0);
}
export function managementShortlist(people,limit,roles=''){
 const requested=websiteNameKey(roles).split(/[;,\n]/).map(x=>x.trim()).filter(Boolean);
 return people.filter(websiteContactIdentity).map(person=>({person,score:roleScore(person,requested)})).filter(row=>row.score)
  .sort((a,b)=>b.score-a.score||a.person.name.localeCompare(b.person.name)).slice(0,limit).map(row=>row.person);
}

// The HTML index can return a challenge or be unavailable. Surface that gap
// once per pass and keep the company's published contacts.
export async function searchManagementIndex(query,signal,read){
 const url=new URL('https://html.duckduckgo.com/html/');
 url.searchParams.set('q',query);
 const result=await read(url.href,{signal});
 const markdown=result.data?.markdown||'';
 const rows=[];
 for(const block of markdown.split(/\n(?=#{1,5} )/)){
  const match=block.match(/^#{1,5}\s+\[([^\]\n]{5,250})\]\((https?:\/\/[^)\s]+)\)/);
  if(!match)continue;
  let target;
  try{
   target=new URL(match[2]);
   if(target.hostname.endsWith('.duckduckgo.com')||target.hostname==='duckduckgo.com'){
    if(!target.searchParams.has('uddg'))continue;
    target=new URL(target.searchParams.get('uddg'));
   }
  }catch{continue;}
  if(!['https:','http:'].includes(target.protocol)||rows.some(row=>row.url===target.href))continue;
  const snippet=block.slice(match[0].length).slice(0,550);
  rows.push({url:target.href,title:match[1],description:snippet,evidenceKind:'search_excerpt'});
  if(rows.length===8)break;
 }
 if(!rows.length&&!/no results found/i.test(markdown))throw Error('Public web index unavailable. Company sources were checked.');
 return rows;
}

// Search excerpts locate pages. Only acquired page bodies enter the shared
// identity and contact checks. Save the first-party roster before this pass.
export async function findPublicBuyerContactPages(candidate,{index,read,refresh,interrupted,profile,addIdentities,resolveDirectoryNames}){
 const D=globalThis.LeadIntelDiscovery;
 let checked=0,readFailures=0,indexUnavailable=false;
 const searchIndex=async query=>{
  try{
   const {hits}=await index(query);
   checked++;return hits;
  }catch(error){
   if(interrupted(error))throw error;
   indexUnavailable=true;return [];
  }
 };
 const lookup=async(query,name='',addresses=[])=>{
  const hits=await searchIndex(query);
  const targets=hits.filter(hit=>{
   const host=D.canonicalDomain(hit.url);
   if(!host||D.isBlockedDomain(host))return false;
   if(host===candidate.domain)return true;
   const text=(hit.title+' '+hit.description).toLowerCase();
   if(addresses.some(email=>text.includes(email)))return true;
   return name&&text.includes(name.toLowerCase());
  });
  // Directory searches often rank policy PDFs before the company's staff page.
  // For named searches prefer the result that actually mentions the person.
  const priority=hit=>{
   const text=(hit.title+' '+hit.description).toLowerCase();
   if(addresses.some(email=>text.includes(email)))return 3;
   if(name)return text.includes(name.toLowerCase())?2:0;
   return /(?:team|leadership|management team|our people|staff|medarbejdere|ledelse|contact|kontakt)/i.test(hit.title+' '+new URL(hit.url).pathname)&&!/\.pdf$/i.test(new URL(hit.url).pathname)?2:0;
  };
  targets.sort((a,b)=>priority(b)-priority(a));
  for(const hit of targets.slice(0,2)){
   try{const page=await read(hit.url);if(!page?.sourceRead)readFailures++;}
   catch(error){if(interrupted(error))throw error;readFailures++;}
  }
 };
 if(!candidate.people?.length){
  await lookup('site:'+candidate.domain+' (management OR leadership OR team OR ledelse OR kontakt)');
  await refresh();
 }
 if(!indexUnavailable&&addIdentities&&(candidate.people||[]).filter(p=>D.sourcedBuyerIdentity(p,candidate)).length<4){
  const plan=D.buyerResearchPlan(candidate,profile);
  const queries=plan.queries.filter(query=>query.startsWith('site:linkedin.com/in/')).slice(0,2);
  for(const query of queries){
   const hits=await searchIndex(query);
   if(indexUnavailable)break;
   const profiles=hits.filter(hit=>D.normalizeLinkedInUrl(hit.url)).map(hit=>({...hit,evidenceKind:'search_excerpt'}));
   const trace=D.tracePublicBuyers(profiles,candidate.company,{...profile,companyDomain:candidate.domain});
   if(trace.people.length)await addIdentities(trace.people);
  }
 }
 const masked=(candidate.buyerDiscovery?.pool||[]).filter(p=>p.identityStatus==='pending'&&p.identitySource==='apollo'&&p.surnameMask);
 if(!indexUnavailable&&resolveDirectoryNames&&D.selectDecisionMakers(masked,profile,1).length){
  const hits=await searchIndex('site:linkedin.com/company/ "'+candidate.domain+'"');
  for(const hit of hits.filter(h=>/^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/[\w%-]+\/?(?:[?#].*)?$/i.test(h.url)).slice(0,2)){
   try{const page=await read(hit.url);if(!page?.sourceRead)readFailures++;}
   catch(error){if(interrupted(error))throw error;readFailures++;}
  }
  await refresh();
 }
 if(!indexUnavailable&&resolveDirectoryNames)await resolveDirectoryNames(async query=>{
  if(indexUnavailable)throw Error('Public index unavailable');
  const hits=await searchIndex(query);
  if(indexUnavailable)throw Error('Public index unavailable');
  return hits.map(hit=>({...hit,evidenceKind:'search_excerpt'}));
 });
 const missing=(candidate.people||[]).filter(person=>D.sourcedBuyerIdentity(person,candidate)&&!D.confirmedBuyerContactData(candidate,person).email).slice(0,4);
 for(const person of missing){
  if(indexUnavailable)break;
  const name=person.publicName||person.name;
  await lookup('"'+name+'" "'+candidate.domain+'" email',name);
 }
 if(missing.length&&checked)await refresh();
 const colleagues=[...(candidate.people||[]),...(candidate.buyerDiscovery?.companyContacts||[])];
 for(const person of missing){
  if(indexUnavailable)break;
  const current=candidate.people?.find(p=>p.id===person.id);
  if(!current||D.listedBuyerEmailSource(candidate,current)?.email||D.confirmedBuyerContactData(candidate,current).email)continue;
  const addresses=D.rankedEmailGuesses(current,candidate.domain,colleagues).slice(0,3).map(row=>row.email);
  if(!addresses.length)continue;
  await lookup(addresses.map(email=>'"'+email+'"').join(' OR '),current.publicName||current.name,addresses);
 }
 if(missing.length&&checked)await refresh();
 const notes=[];
 if(checked)notes.push('Free public index: '+checked+' completed '+(checked===1?'query.':'queries.'));
 if(indexUnavailable)notes.push('Free public index unavailable.');
 if(readFailures)notes.push(readFailures+' linked source checks unavailable.');
 return notes.join(' ')||'Free website and register checks finished.';
}

export const MANAGEMENT_RESEARCH_VERSION=1;
const employerRoster=url=>/^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/company\/[\w%-]+\/?(?:[?#].*)?$/i.test(url);

// A directory hint is never a name. Only the shared employer/role resolver
// can turn it into a person, after reading evidence and checking ambiguity.
export async function managementDirectoryPeople(input,rows,{index,read,sourceRows}){
 const D=globalThis.LeadIntelDiscovery,profile={companyDomain:input.domain,collectAllCompanyContacts:true};
 const directory=D.traceIdentityBuyers({people:rows},input,profile).people;
 const pending=directory.filter(p=>p.identityStatus==='pending'&&p.surnameMask&&roleScore(p,[])).slice(0,10);
 const complete=directory.filter(p=>p.identityStatus==='confirmed');
 if(!pending.length)return complete;
 const hits=await index('site:linkedin.com/company/ "'+input.domain+'"');
 for(const hit of (hits||[]).filter(hit=>employerRoster(hit.url)).slice(0,2))await read(hit.url);
 let interruption;
 const resolved=await D.resolvePendingBuyerIdentities(pending,sourceRows(),input,profile,async query=>{
  let rows;try{rows=await index(query);}catch(error){interruption=error;throw error;}
  if(!rows)throw Error('Public index unavailable');
  return rows;
 });
 if(interruption)throw interruption;
 for(const p of resolved.people.filter(p=>p.identityStatus==='confirmed')){
  complete.push({...p,...(employerRoster(p.publicNameUrl)?{directoryRosterUrl:p.publicNameUrl}:{})});
 }
 return complete;
}

// Source receipts belong to the person and channel. An unrelated failed page
// must not erase a completed check or turn an unread search hit into a contact.
export async function managementChannels(input,person,pages,{index,read}){
 const D=globalThis.LeadIntelDiscovery,plan=D.buyerResearchQueryPlan(input,person);
 const checked=new Map(pages.map(page=>[page.url,page])),checks={};
 const apply=rows=>{
  Object.assign(person,D.matchPublicBuyerDetails([person],rows,input.domain,input.company)[0]);
  const gmail=D.gmailResearchMatches(person,input,rows);
  person.gmailMatches=[...new Map([...(person.gmailMatches||[]),...gmail].map(m=>[m.email,m])).values()];
 };
 apply(pages);
 const card=person.publishedStaffCard||{},name=websiteNameKey(person.publicName||person.name);
 const channels=[
  ['direct_email',()=>card.email||person.publicEmail,plan.direct_email.slice(0,2)],
  ['phone',()=>card.phone||person.publicPhone,plan.phone],
  ['gmail',()=>person.gmailMatches.length,plan.gmail],
  ['linkedin',()=>person.publicLinkedinUrl||person.linkedin_url,plan.linkedin]
 ];
 for(const [key,found,queries] of channels){
  const queryLog=[];let incomplete=false;
  for(const query of queries){
   if(found())break;
   const hits=await index(query);
   if(!hits){
    incomplete=true;
    queryLog.push({query,status:hits===undefined?'skipped':'incomplete',reason:hits===undefined?'Skipped after the public index became unavailable':'Public index unavailable'});
    break;
   }
   const receipt={query,status:'complete',sourceReads:[]};queryLog.push(receipt);
   if(key==='linkedin'){
    const matched=D.matchPublicLinkedInProfiles([person],websiteLinkedInMatchRows(person,hits,input),input.company)[0];
    if(matched.linkedinIdentityEvidence?.url)Object.assign(person,matched);
    continue;
   }
   const targets=hits.filter(hit=>D.canonicalDomain(hit.url)===input.domain||websiteNameKey(hit.title+' '+hit.description).includes(name))
    .sort((a,b)=>Number(websiteNameKey(b.title+' '+b.description).includes(name))-Number(websiteNameKey(a.title+' '+a.description).includes(name)));
   for(const hit of targets.slice(0,2)){
    const page=checked.get(hit.url)||await read(hit.url);
    receipt.sourceReads.push({url:hit.url,status:page?'complete':'failed'});
    if(page){checked.set(hit.url,page);apply([page]);}else incomplete=true;
    if(found())break;
   }
  }
  checks[key]={status:found()||!incomplete?'complete':'incomplete',reason:found()?'Public evidence found':incomplete?'Company pages checked. Additional public sources were unavailable.':'No match in the checked public sources',queryLog};
 }
 return checks;
}
