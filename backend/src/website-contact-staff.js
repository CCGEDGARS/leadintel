import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery,clean=v=>String(v||'').replace(/\s+/g,' ').trim();
export function websiteSourceChunks(page){
 const blocks=String(page.markdown||'').split(/\n(?=#{2,6}\s)/);if(blocks.length<=30)return [page];
 const header=blocks.shift(),chunks=[];
 for(let i=0;i<blocks.length;){
  let end=Math.min(i+30,blocks.length);
  while(end<blocks.length&&blocks[end].match(/^#+/)?.[0].length>blocks[end-1].match(/^#+/)?.[0].length)end++;
  chunks.push({...page,markdown:header+'\n'+blocks.slice(i,end).join('\n')});i=end;
 }
 return chunks;
}
// Directories often mark both the name and the job title as headings. Keep
// each published channel inside that person's card, including link targets.
function nestedStaffCards(page,input){
 if(!page.sourceRead||D.canonicalDomain(page.url)!==input.domain)return [];
 const people=[],body=page.markdown;
 const directory=/(?:^|[\/_.-])(?:contacts?|kontakt|team|staff|medarbejdere|ledelse)(?:$|[\/_.-])/i.test(new URL(page.url).pathname);
 const headings=/^(#{2,5})[ \t]+([^\n]+?)[ \t]*\n(?=\s*(#{3,6})[ \t]+([^\n]+))/gm;
 for(const match of body.matchAll(headings)){
  const [,nameLevel,rawName,roleLevel,rawRole]=match,name=clean(rawName.replace(/[*_]/g,'')),title=clean(rawRole.replace(/[*_]/g,''));
  if(roleLevel.length<=nameLevel.length||!/^\p{Lu}[\p{L}’'.-]+(?:\s+[\p{L}’'.-]+){1,4}$/u.test(name)||!D.isIndependentContactPerson({name,title})||/^(?:contact|kontakt|our |about |company |general |ledelse|management|team\b)/i.test(name))continue;
  const knownRole=/\b(?:manager|president|engineer|director|coordinator|chief|head|founder|officer|CEO|CFO|COO)\b|direktør|direktör|chef\b|leder\b|ansvarlig\b|værkfører|bogholder|administration|designer/i.test(title);
  if((!directory&&!knownRole)||title.length>120||/[#@:\d]|former|previous|retired|tidigare|privacy|copyright/i.test(title))continue;
  const afterName=body.slice(match.index+match[0].length).trimStart();
  const details=afterName.slice(afterName.indexOf('\n')<0?afterName.length:afterName.indexOf('\n')).slice(0,700).split(/\n\s*(?:#{1,6}\s|!?\[!\[|!\[|footer\b|switchboard\b|reception\b)/i)[0];
  const listed=new Set(),numbers=new Map();
  for(const line of details.split('\n')){
   if(/^\s*(?:e-?mail|e-post)\s*:/i.test(line))for(const hit of line.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi))listed.add(hit[0].toLowerCase());
   if(/^\s*(?:tel(?:efon)?\.?|phone|mobile?)\s*:/i.test(line)){
    const target=line.match(/\]\(tel:([+\d][\d ().-]*)\)/i)?.[1];
    const visible=line.replace(/\[([^\]]*)\]\(tel:[^)]+\)/gi,'$1').split(':').slice(1).join(':').trim();
    if(/^\+?\d[\d ().-]{5,23}\d$/.test(visible)){
     const digits=visible.replace(/\D/g,'');
     if(target&&!target.replace(/\D/g,'').endsWith(digits))numbers.set('conflict','');
     numbers.set(digits,visible);
    }
   }
  }
  const workEmails=[...listed].filter(value=>D.validResearchEmail(value,input.domain)&&! /^(info|kontakt|contact|office|sales|reception)@/i.test(value));
  const profiles=[...new Set((details.match(/https?:\/\/(?:[a-z]+\.)?linkedin\.com\/in\/[^\s)\]>]+/gi)||[]).map(D.normalizeProfessionalLinkedInUrl).filter(Boolean))];
  const profile=profiles.length===1?profiles[0]:'';
  const email=workEmails.length===1?workEmails[0]:'',phone=numbers.size===1?[...numbers.values()][0]:'';
  if(!email&&!phone&&!profile)continue;
  people.push({name,publicName:name,title,organization:input.company,publicNameUrl:page.url,identitySource:'public',identityStatus:'confirmed',nameVerification:'confirmed',companyContactSource:'official_staff',
   ...(profile?{publicLinkedinUrl:profile}:{}),publishedStaffCard:{url:page.url,email,phone,quote:clean(name+' '+title+' '+details).slice(0,700),checkedAt:page.extractedAt}});
 }
 return people;
}
// On official About pages, leadership may be named in the current ownership
// statement instead of individual cards. Match the named employer and an
// explicit role beside each name. Keep the published source for identity checks.
function currentOwnerRoles(page,input){
 if(!page.sourceRead||D.canonicalDomain(page.url)!==input.domain)return [];
 const company=clean(input.company).replace(/\s+(?:a\/s|aps|ltd\.?|inc\.?)$/i,'').toLowerCase();
 const people=[];
 for(const sentence of page.markdown.split(/[.!?\n]+/)){
  const ownership=sentence.trim().match(/^(?:today,?\s+|currently,?\s+)?(.+?)\s+is (?:currently )?owned by\s+(.+)$|^(?:i dag\s+)?ejes\s+(.+?)\s+af\s+(.+)$/iu);
  if(!ownership||clean(ownership[1]||ownership[3]).replace(/\s+(?:a\/s|aps|ltd|inc)$/i,'').toLowerCase()!==company)continue;
  const owners=ownership[2]||ownership[4];
  for(const clause of owners.split(/\s+(?:og|samt|and)\s+|,\s*/iu)){
   const entry=clause.trim().match(/^(CEO|CFO|COO|CTO|(?:Production|Managing|Finance|Operations) Director|(?:produktions|økonomi|administrerende\s+)?direktør)\s+(.+)$/iu);
   if(!entry||!/^\p{Lu}[\p{L}’'-]+(?:\s+\p{Lu}[\p{L}’'-]+){1,4}$/u.test(entry[2])||!D.hasFullBuyerName(entry[2]))continue;
   people.push({name:entry[2],publicName:entry[2],title:entry[1],organization:input.company,publicNameUrl:page.url,identitySource:'public',identityStatus:'confirmed',nameVerification:'confirmed',companyContactSource:'official_staff'});
  }
 }
 return people;
}
export function websiteStaffCards(page,input){
 const found=[],role=/\b(?:CEO|CFO|COO|CTO|CIO|CRO|CLO|CMO|CHRO|chief|director|head|manager|president|founder|chairman|chairwoman)\b|direktør|direktör|koncernchef|bestyrels|afdelingschef|vadītāj|priekšsēdētāj|valdes locekl/i;
 // Neutral website research also accepts local-language staff cards. Require
 // a named company-domain email or an explicit official leadership/team page;
 // a name mentioned on a homepage alone does not establish employment.
 const staffPage=/ledelse|medarbejd|bestyrelse|ledning|management|leadership|team|vadiba|komanda/i.test(page.url)||/^#{1,4}\s*(?:our\s+)?(?:ledelse|medarbejdere|bestyrelse|ledning|management|leadership|team|vadība|komanda)\s*$/imu.test(page.markdown);
 for(const match of page.markdown.matchAll(/^#{2,5}[ \t]+([^\n]+)\n+[ \t]*([^\s#\n][^\n]{2,119})/gm)){
  const name=clean(match[1]),title=clean(match[2]);if(!D.hasFullBuyerName(name)||!role.test(title)||/contact|kontakt|privacy|company|management|leadership|team|group/i.test(name)||/former|previous|retired|tidigare/i.test(title))continue;
  const person={name,publicName:name,title,organization:input.company,publicNameUrl:page.url,identitySource:'public',identityStatus:'confirmed',nameVerification:'confirmed',companyContactSource:'official_staff'};
  const named=D.sourcedBuyerEmails(person,input.domain,[page],input.company).some(row=>row.email.endsWith('@'+input.domain));
  if(!named&&!staffPage)continue;
  found.push(D.matchPublicBuyerDetails([person],[page],input.domain,input.company)[0]);
 }
 return [...found,...nestedStaffCards(page,input),...currentOwnerRoles(page,input)];
}
export function websiteOfficialStaff(page,input){if(page.sourceRead!==true||D.canonicalDomain(page.url)!==input.domain)return [];return websiteSourceChunks(page).flatMap(chunk=>[...D.discoverCompanyContacts([chunk],{company:input.company,domain:input.domain},[]),...websiteStaffCards(chunk,input)]);}
