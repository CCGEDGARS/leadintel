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
