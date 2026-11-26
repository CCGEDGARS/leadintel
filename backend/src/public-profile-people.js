// Current people named by public profile excerpts, and the public people request that finds them (B3, 26 Nov 2026).
// Owner gate: LeadIntel itself must find the current people that a manual Perplexity search found; three of the five
// were only in LinkedIn profile excerpts, which no reader used. No model: a profile is a CURRENT person at the target
// when one of its experience entries names the target as employer and ends "Present"; a profile whose entries at the
// target all ended is former and is not returned. The entry text is kept as the identity quote. A search excerpt is
// identity evidence only; contact data still needs a first-party read.

const clean=value=>String(value??'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const PROFILE_URL=/^https?:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[^/?#\s]+/i;
const PERIOD='(?:\\p{L}{3,10}\\.?[ \\t]+)?(?:19|20)\\d{2}';
// "- **Role**" (or "**Role**" after a dash on an earlier line) / "**Employer**" / "March 2023 - Present", as profile
// excerpts print an experience entry.
const ENTRY=new RegExp('(?:^|\\n)[ \\t]*(?:[-•][ \\t]*)?\\*\\*([^*\\n]{2,120})\\*\\*[ \\t]*\\n[ \\t]*\\*\\*([^*\\n]{2,160})\\*\\*[ \\t]*\\n[ \\t]*('+PERIOD+')[ \\t]*[-–—][ \\t]*('+PERIOD+'|\\p{L}{2,10})','gu');
const ONGOING=/^(?:present|current|now|nu|nå|nyt|heute|heden|obecnie|dabar|praegu|šobrīd)$/iu;
const LEGAL_FORMS='a/s|aps|a\\.m\\.b\\.a\\.?|amba|i/s|k/s|p/s|as|asa|ab|abp|oy|oyj|gmbh|ag|kg|ltd|limited|llc|inc|plc|corp|corporation|bv|nv|sa|sas|sarl|srl|spa|sia|uab|oü|ou|sp\\. ?z ?o\\.? ?o\\.?|s\\.r\\.o\\.?';
const LEGAL_SUFFIX=new RegExp('(?:^|\\s)(?:'+LEGAL_FORMS+')\\.?$','iu');
const LEGAL_PREFIX=/^(?:sia|as|uab|oü|ou|ab|oy)\s+/iu;
function withoutLegalForm(value){
  let text=clean(value);
  for(let i=0;i<3;i++){const next=text.replace(LEGAL_SUFFIX,'').replace(LEGAL_PREFIX,'').trim();if(next===text)break;text=next;}
  return text;
}
// "Nordic-Steel", "Nordic Steel A/S" and "Nordic Stål a/s" are one employer; "Nordic Steel Coating ApS" is another.
function employerKey(value){
  const text=String(value??'').toLowerCase().replace(/&amp;/g,'&').replace(/å/g,'aa').replace(/[øö]/g,'oe').replace(/[æä]/g,'ae').replace(/ü/g,'ue')
    .normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^\p{L}\p{N}/&.]+/gu,' ');
  return withoutLegalForm(text).replace(/[/.&]+/g,' ').replace(/\s+/g,' ').trim();
}
const domainBrand=domain=>String(domain||'').toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split(/[./]/)[0].replace(/[^a-z0-9]/g,'');
function sameEmployer(employer,candidate){
  const key=employerKey(employer),company=employerKey(candidate.company);
  if(key.length<2)return false;
  if(company&&key===company)return true;
  const brand=domainBrand(candidate.domain);
  return brand.length>=4&&key.replace(/\s+/g,'')===brand;
}
function profileName(row,text){
  const title=clean(String(row.title||'').split('|')[0].split(/\s+[-–—]\s+/)[0]);
  if(title&&!/linkedin/i.test(title))return title;
  return clean((text.match(/^\s*\*\*([^*\n]{3,80})\*\*/)||[])[1]);
}

export function readPublicProfilePeople(rows=[],candidate={},{D=globalThis.LeadIntelDiscovery,now=new Date().toISOString()}={}){
  const people=new Map(),former=new Map(),names=new Set();
  if(!employerKey(candidate.company))return {people:[],former:[]};
  for(const row of rows){
    const url=String(row?.url||'').match(PROFILE_URL)?.[0];if(!url)continue;
    // One profile whatever the LinkedIn host ("dk.", "www."); one person per name at the target.
    const key=url.toLowerCase().replace(/^.*\/in\//,'/in/').replace(/\/+$/,'');if(people.has(key))continue;
    const text=String(row.markdown||row.description||'').replace(/\r/g,'');
    const name=profileName(row,text);
    if(!name||/[\d@]/.test(name)||names.has(name.toLowerCase())||!(D?.hasFullBuyerName?D.hasFullBuyerName(name):/\s/.test(name)))continue;
    const entries=[...text.matchAll(ENTRY)].map(match=>({role:clean(match[1]),employer:clean(match[2]),since:clean(match[3]),until:clean(match[4]),quote:match[0].replace(/^\n/,'').trim()}));
    const atTarget=entries.filter(entry=>sameEmployer(entry.employer,candidate));
    const current=atTarget.find(entry=>ONGOING.test(entry.until));
    if(current){
      former.delete(key);names.add(name.toLowerCase());
      people.set(key,{id:'public-profile-'+key.replace(/^\/in\//,'').replace(/[^a-z0-9%-]+/g,'-').slice(0,80),name,publicName:name,title:current.role,
        organization:clean(candidate.company),publicNameUrl:url,publicLinkedinUrl:url,companyContactSource:'public_identity',
        identityEvidenceDate:clean(row.lastUpdated||row.last_updated).slice(0,40),
        linkedinIdentityEvidence:{url,name,organization:clean(candidate.company),checkedAt:now},
        identityEvidence:{kind:'public_profile',provider:clean(row.searchProvider||row.buyerSource).slice(0,40),employer:current.employer,since:current.since,quote:current.quote.slice(0,400)}});
    }else if(atTarget.length&&!former.has(key))former.set(key,{name,url,employer:atTarget[0].employer,until:atTarget[0].until});
  }
  return {people:[...people.values()],former:[...former.values()]};
}
// Only people the job does not hold yet, shown or pooled: a held person keeps the evidence it already has (a register
// or an official page names someone without a profile link, so the same name can arrive as a second identity).
export function unheldProfilePeople(rows=[],candidate={},{D=globalThis.LeadIntelDiscovery,now}={}){
  const identity=person=>D?.buyerIdentity?String(D.buyerIdentity(person)||''):'';
  const held=new Set([...(candidate.people||[]),...(candidate.buyerDiscovery?.pool||[])].flatMap(person=>[identity(person),clean(person.publicName||person.name).toLowerCase()]).filter(Boolean));
  return readPublicProfilePeople(rows,candidate,{D,...(now?{now}:{})}).people.filter(person=>!held.has(identity(person))&&!held.has(person.name.toLowerCase()));
}

// The manual search that found a company's current people asked five things at once: the company with management
// words, the company's employees on LinkedIn, the buyer roles, the register number with board words, and the company
// with its country. Danish companies get Danish words (as the buyer research plan already does), other markets English;
// buyer roles use the platform's local role aliases. No search-engine operators: Perplexity ignores `site:` and `OR`.
export const PUBLIC_PEOPLE_MAX_QUERIES=5;
const WORDS={
  danish:{management:'direktør ledelse',employees:'medarbejder',board:'bestyrelse direktion',register:'CVR'},
  english:{management:'CEO management team',employees:'employees',board:'board of directors',register:'company number'}
};
const EXECUTIVE_ROLE=/\b(?:executive|ceo|chief executive|managing director|general manager|owner|founder|president)\b/iu;
// The platform's aliases list the English titles first and the Danish ones after ("Procurement Director" → … "Indkøbschef").
const DANISH_TITLE=/(?:chef|leder|direktør|ansvarlig|fører|indkøb|[æøå])/iu;
const MAX_ROLE_WORDS=6;
export function publicPeopleQueries(candidate={},roles=[],{D=globalThis.LeadIntelDiscovery}={}){
  const company=clean(candidate.company);if(!company)return [];
  const short=withoutLegalForm(company)||company,market=clean(candidate.market);
  const local=/\b(?:denmark|danmark)\b/i.test(market)||/^dk$/i.test(market),words=local?WORDS.danish:WORDS.english;
  const roleWords=[],stems=new Set(),stem=word=>word.replace(/[^\p{L}]/gu,'').slice(0,5);
  for(const role of Array.isArray(roles)?roles:[]){
    const name=clean(role);if(!name||EXECUTIVE_ROLE.test(name))continue;
    const aliases=(D?.localBuyerRoleAliases?D.localBuyerRoleAliases(name,candidate.market):[name]).map(alias=>clean(alias).replace(/[.]+$/,'').toLowerCase()).filter(Boolean);
    // One word per role family ("indkøbschef" and "indkøber" are one family); a Danish role without a Danish title
    // keeps its English one.
    const danish=local?aliases.filter(alias=>DANISH_TITLE.test(alias)):[];
    const word=(danish.length?danish:aliases).find(alias=>!stems.has(stem(alias)));
    if(!word)continue;
    roleWords.push(word);stems.add(stem(word));
    if(roleWords.length>=MAX_ROLE_WORDS)break;
  }
  const register=clean(candidate.buyerDiscovery?.registerManagement?.id).replace(/[^\p{L}\p{N}-]/gu,'').slice(0,20);
  return [
    `${company} ${words.management}`,
    `${company} LinkedIn ${words.employees}`,
    roleWords.length?`"${short}" ${roleWords.join(' ')}`:'',
    `${company}${register?` ${words.register} ${register}`:''} ${words.board}`,
    `"${short}"${market?' '+market:''} manager`
  ].filter(Boolean).slice(0,PUBLIC_PEOPLE_MAX_QUERIES);
}
