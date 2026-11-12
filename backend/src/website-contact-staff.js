import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery,clean=v=>String(v||'').replace(/\s+/g,' ').trim();
export function websiteSourceChunks(page){
 const blocks=String(page.markdown||'').split(/\n(?=#{2,6}\s)/);if(blocks.length<=30)return [page];
 const header=blocks.shift(),chunks=[];for(let i=0;i<blocks.length;i+=30)chunks.push({...page,markdown:header+'\n'+blocks.slice(i,i+30).join('\n')});return chunks;
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
 return found;
}
export function websiteOfficialStaff(page,input){if(page.sourceRead!==true||D.canonicalDomain(page.url)!==input.domain)return [];return websiteSourceChunks(page).flatMap(chunk=>[...D.discoverCompanyContacts([chunk],{company:input.company,domain:input.domain},[]),...websiteStaffCards(chunk,input)]);}
