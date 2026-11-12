import '../../customer/discovery-engine.js';
const D=globalThis.LeadIntelDiscovery;
export const WEBSITE_LINKEDIN_REVIEW_VERSION=1;
const clean=v=>String(v||'').replace(/\s+/g,' ').replaceAll('"','').trim();
const fold=v=>clean(v).normalize('NFKD').replace(/\p{M}/gu,'');
const profileKey=value=>{const url=D.normalizeProfessionalLinkedInUrl(value);return url?new URL(url).pathname.toLowerCase():'';};
const identity=(candidate,person)=>JSON.stringify([candidate.company,candidate.domain,person.publicName||person.name,person.title].map(clean));
export function websiteLinkedInQueries(candidate,person){
 const name=clean(person.publicName||person.name),company=clean(candidate.company),alternate=fold(name);
 return [`site:linkedin.com/in/ "${name}" "${company}"`,`site:linkedin.com/in/ "${alternate}" "${company}"${alternate===name?' LinkedIn':''}`];
}
const exactQuery=(candidate,url)=>`site:linkedin.com/in/ "${new URL(url).pathname.split('/').filter(Boolean).at(-1)}" "${clean(candidate.company)}"`;
export function websiteLinkedInReviewCurrent(candidate,person){
 const review=person.linkedinReview,queries=review?.queries,plan=websiteLinkedInQueries(candidate,person),fresh=value=>{const age=Date.now()-Date.parse(value||'');return age>=0&&age<30*86400000;};
 return review?.version===WEBSITE_LINKEDIN_REVIEW_VERSION&&review.identityKey===identity(candidate,person)&&review.status==='complete'&&(!review.profileUrl||!person.publicLinkedinUrl&&!person.linkedin_url||profileKey(review.profileUrl)===profileKey(person.publicLinkedinUrl||person.linkedin_url))&&Array.isArray(queries)&&queries.length>=2&&queries.length<=3&&queries.every(q=>q.status==='complete'&&fresh(q.checkedAt))&&plan.every((query,i)=>queries[i]?.query===query)&&(!queries[2]||review.profileUrl&&queries[2].query===exactQuery(candidate,review.profileUrl));
}
// Compare a sourced full name without known professional credential suffixes.
// The server retains each unmodified indexed row in the acquisition receipt.
export function websiteLinkedInMatchRows(person,rows,candidate={}){
 return rows.map(row=>{const sourceTitle=String(row.title||''),leading=sourceTitle.split(/\s+[–—|·-]\s*|\s*\|\s*/u)[0],match=leading.match(/^(.+?),\s*((?:(?:PMP|MBA|PhD|Ph\.D\.|ACCA|CFA|CPA|FRM|MSc|BSc)(?:,?\s+|$))+)$/i);let title=sourceTitle;
  if(match&&fold(match[1]).toLowerCase()===fold(person.publicName||person.name).toLowerCase())title=match[1]+title.slice(leading.length);
  const firstRole=title.split(/\s+\/\s+/u)[0],company=clean(candidate.company).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  if(person.identityOrigin==='official'&&candidate.domain&&D.canonicalDomain(person.publicNameUrl)===candidate.domain&&!/\b(?:former|previously|retired)\b/i.test(firstRole)&&company&&new RegExp('(?:@|\\bat\\s+)'+company+'(?=$|[^\\p{L}])','iu').test(firstRole))title=firstRole;
  return title!==sourceTitle?{...row,title,sourceTitle}:row;});
}
// Public indexed matching only. Two query matches are not LinkedIn account,
// email-ownership, deliverability or independent-provider verification.
export async function reviewWebsiteLinkedIn(candidate,person,{search,receipt=()=>null,guard=async()=>{}}){
 const review={version:WEBSITE_LINKEDIN_REVIEW_VERSION,identityKey:identity(candidate,person),status:'incomplete',matchStatus:'not_found',profileUrl:'',queries:[]};
 const match=rows=>D.matchPublicLinkedInProfiles([{...person,identitySource:'public',linkedinConfirmedUrl:'',linkedinConfirmationMethod:'automatic',linkedinIdentityEvidence:null}],websiteLinkedInMatchRows(person,rows,candidate),candidate.company)[0];
 const run=async query=>{
  try{await guard();const rows=await search(query);await guard();review.queries.push({query,status:'complete',checkedAt:receipt(query)?.checkedAt||new Date().toISOString(),rows:(Array.isArray(rows)?rows:[]).slice(0,8).map(r=>({url:r.url,title:r.title,description:r.description,evidenceKind:r.evidenceKind}))});}
  catch(error){if(['TIME_BUDGET','PASS_LIMIT','BATCH_LIMIT','WEBSITE_CONTACT_CHANGED'].includes(error.code)||error.name==='AbortError')throw error;review.queries.push({query,status:'incomplete',reason:clean(error.message).slice(0,180),checkedAt:new Date().toISOString(),rows:[]});}
 };
 for(const query of websiteLinkedInQueries(candidate,person))await run(query);
 let matched=match(review.queries.flatMap(q=>q.rows)),url=matched.linkedinIdentityEvidence?.url||'',same=()=>review.queries.filter(q=>url&&profileKey(match(q.rows).linkedinIdentityEvidence?.url)===profileKey(url)).length;
 if(url&&!matched.linkedinProfileReview&&same()<2)await run(exactQuery(candidate,url));
 matched=match(review.queries.flatMap(q=>q.rows));url=matched.linkedinIdentityEvidence?.url||'';
 review.profileUrl=url;review.status=review.queries.every(q=>q.status==='complete')?'complete':'incomplete';
 review.matchStatus=matched.linkedinProfileReview?.status==='review_required'?'conflict':url?(same()>=2?'double_checked':'single_match'):'not_found';
 const nativeCyrillic=/\p{Script=Cyrillic}/u.test(person.publicName||person.name);review.candidateProfiles=[...new Map(review.queries.flatMap(q=>q.rows||[]).filter(r=>profileKey(r.url)&&String(r.description||'').toLowerCase().includes(clean(candidate.company).toLowerCase())&&/\p{Script=Cyrillic}/u.test(String(r.title||'').split(/\s+[–—|·-]\s*/u)[0])!==nativeCyrillic).map(r=>[profileKey(r.url),{url:r.url,title:r.title,description:r.description}])).values()].slice(0,4);
 if(review.matchStatus==='not_found'&&review.candidateProfiles.length)review.matchStatus='candidate';
 review.checkedAt=new Date().toISOString();return review;
}
