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
export async function findPublicBuyerContactPages(candidate,{index,read,refresh,interrupted,profile,addIdentities}){
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
