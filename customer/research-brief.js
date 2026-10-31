(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./company-dossier.js'):root.LeadIntelCompanyDossier);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelResearchBrief=api;})(typeof globalThis==='object'?globalThis:this,function(D){
'use strict';
const VERSION='shared-message-brief-20261022-v4',clean=v=>String(v??'').replace(/\s+/g,' ').trim(),copy=v=>JSON.parse(JSON.stringify(v));
const unsafe=text=>/ignore (?:all |previous )?instructions|system prompt|pretend|fabricate|<[^>]*>|{{|}}/i.test(text);
const development=text=>/\b(?:under construction|constructing|building|investing|expan(?:ding|sion)|new (?:plant|factory|warehouse|facility|office|hospital|system|platform)|launch(?:ed|ing)?|implement(?:ed|ing|ation)|moderni[sz](?:ed|ing|ation)|commission(?:ed|ing))\b/i.test(text);
function conciseQuote(quote){const sentences=quote.split(/(?<=[.!?])\s+/).map(sentence=>sentence.includes('## ')?sentence.slice(sentence.lastIndexOf('## ')+3):sentence).filter(s=>s.length>=12&&s.length<=360&&/^[A-Z]/.test(s)&&!/https?:\/\/|\]\(/i.test(s));return sentences.find(development)||sentences[0]||(quote.length>320?quote.slice(0,320)+'…':quote);}
function fingerprint(value){let n=2166136261;for(const c of JSON.stringify(value))n=Math.imul(n^c.charCodeAt(0),16777619);return (n>>>0).toString(16);}
function fact(row,target){const url=D.url(row.url||row.sourceUrl),quote=clean(row.quote||row.text);if(!url||D.domain(url)!==target||quote.length<12||quote.length>1800||unsafe(quote)||row.extracted===false||row.evidenceKind==='model_summary'||/failed|error|pending/i.test(row.status||''))return null;return {text:conciseQuote(quote),quote,url,date:/^\d{4}-\d{2}-\d{2}$/.test(row.date||'')?row.date:'',checkedAt:clean(row.checkedAt||row.extractedAt||''),verification:'source_verified',origin:row.origin==='dossier'?'dossier':'extracted',kind:development(quote)?'development':'company'};}
function safe(prior,target){if(prior?.version!==VERSION||D.domain(prior.domain)!==D.domain(target))return null;return {...prior,facts:(prior.facts||[]).filter(row=>row.verification==='source_verified').map(row=>fact(row,D.domain(target))).filter(Boolean).slice(0,16)};}
function build(candidate={},profile={},person=null,prior=null){
 const target=D.domain(candidate.domain||candidate.website),d=D.safe(candidate.buyerDiscovery?.companyDossier,target),previous=safe(prior,target),facts=[];
 // An explicit read outcome owns its URL; a legacy extraction label cannot
 // promote a failed/pending read into verified source evidence.
 const reads=new Set((d?.passes||[]).flatMap(p=>[...(p.extractedSources||[]).filter(url=>!(p.sourceReads||[]).some(row=>row.url===url&&row.status!=='succeeded')),...(p.sourceReads||[]).filter(row=>row.status==='succeeded').map(row=>row.url)]));
 // Older validated passes recorded extracted page URLs and exact cited claims before per-read receipts existed.
 const legacyAggregatePass=pass=>!d.plan&&!pass.planSignature&&!(pass.searchFamilies||[]).length&&!['facts','people','channels'].some(kind=>(pass[kind]||[]).length)&&Number.isFinite(Date.parse(d.checkedAt))&&(d.receipts||[]).some(receipt=>receipt.provider===pass.provider&&receipt.status==='complete'&&receipt.phase==='complete'&&receipt.readCount>0&&receipt.sourceCount>=receipt.readCount);
 const legacyValidatedClaim=(row,kind)=>(d?.passes||[]).some(pass=>pass.webSearch&&['complete','partial'].includes(pass.status)&&!(pass.extractedSources||[]).length&&!(pass.sourceReads||[]).length&&(pass.sources||[]).includes(row.sourceUrl)&&(legacyAggregatePass(pass)||(pass[kind]||[]).some(claim=>claim.sourceUrl===row.sourceUrl&&clean(claim.quote)===clean(row.quote)&&(kind==='facts'||clean(claim.name).toLowerCase()===clean(row.name).toLowerCase()&&clean(claim.title).toLowerCase()===clean(row.title).toLowerCase()&&claim.status===row.status))));
 const provenFacts=(d?.facts||[]).filter(row=>reads.has(row.sourceUrl)||legacyValidatedClaim(row,'facts')),provenPeople=(d?.people||[]).filter(row=>reads.has(row.sourceUrl)||legacyValidatedClaim(row,'people'));
 for(const row of [...provenFacts,...provenPeople])reads.add(row.sourceUrl);
 const extracted=[];
 for(const row of candidate.evidence||[]){if(d&&row.fromResearchBrief===true&&!reads.has(D.url(row.url))||row.sourceRead===false||/snippet|model_summary/i.test(row.evidenceKind||'')||!(row.sourceRead===true||row.extracted===true||row.verification==='source_verified'&&Number.isFinite(Date.parse(row.extractedAt||'')))||!row.text)continue;
  for(const sentence of clean(row.text).split(/(?<=[.!?])\s+/).filter(text=>text.length>=12&&text.length<=600).slice(0,12)){const item=fact({...row,text:sentence},target);if(item)extracted.push({...item,fromResearchBrief:row.fromResearchBrief===true});}}
 const newer=new Map();for(const row of extracted){const time=Date.parse(row.checkedAt);if(time>0&&time<=Date.now()+60000)newer.set(row.url,Math.max(newer.get(row.url)||0,time));}
 const dossierReadAt=url=>{const times=(d?.passes||[]).flatMap(pass=>(pass.sourceReads||[]).filter(row=>row.url===url&&row.status==='succeeded').map(row=>Date.parse(row.checkedAt))).filter(Number.isFinite);return times.length?Math.max(...times):Date.parse(d?.checkedAt)||0;},replacesDossier=url=>newer.has(url)&&newer.get(url)>dossierReadAt(url);
 for(const row of provenFacts){if(replacesDossier(row.sourceUrl))continue;const item=fact({...row,origin:'dossier',checkedAt:dossierReadAt(row.sourceUrl)?new Date(dossierReadAt(row.sourceUrl)).toISOString():''},target);if(item)facts.push(item);}
 for(const row of extracted){if(d&&reads.has(row.url)&&!replacesDossier(row.url)||newer.has(row.url)&&Date.parse(row.checkedAt)!==newer.get(row.url))continue;const {fromResearchBrief,...item}=row;facts.push(item);}
 if(!d&&!facts.length)facts.push(...(previous?.facts||[]));
 const unique=[...new Map(facts.map(row=>[row.url+'|'+row.quote,row])).values()],terms=[...new Set(clean([profile.priorityOffers,person?.title].filter(Boolean).join(' ')).toLowerCase().split(/[^\p{L}\p{N}]+/u).filter(v=>v.length>4))],rank=row=>terms.filter(t=>row.quote.toLowerCase().includes(t)).length+(row.kind==='development'?10:0);
 unique.sort((a,b)=>rank(b)-rank(a)||a.url.localeCompare(b.url));unique.splice(16);
 const sourcePerson=provenPeople.find(row=>clean(row.name).toLowerCase()===clean(person?.publicName||person?.name).toLowerCase()&&clean(row.title).toLowerCase()===clean(person?.title).toLowerCase()),hold=person&&d?D.holdReason(person,d):'',verified=Boolean(sourcePerson&&sourcePerson.status==='current'&&!sourcePerson.roleConflict&&!hold&&reads.has(sourcePerson.sourceUrl)),gaps=[...(d?.gaps||[])];
 if(!unique.length)gaps.push('No extracted official company fact available for personalization.');if(person&&!verified)gaps.push(hold||'Selected buyer role requires source verification.');if(d?.conflicts.length)gaps.push('Research conflicts need review.');if(d?.lastAttempt)gaps.push('Latest company research attempt needs attention.');
 const offer=clean(profile.priorityOffers),hypotheses=offer&&unique.length?[{text:offer+' may be relevant to this company context; confirm the need in conversation.',status:'hypothesis'}]:[];
 const buyer=person?{id:clean(person.id),name:clean(person.publicName||person.name),title:clean(person.title),verified,url:verified?sourcePerson.sourceUrl:'',quote:verified?sourcePerson.quote:''}:null;
 const body={version:VERSION,domain:target,company:clean(candidate.company),facts:unique,authoritativeUrls:[...new Set([...reads,...newer.keys()])].slice(0,40),developments:unique.filter(row=>row.kind==='development').slice(0,4),companyContext:unique.find(row=>row.kind==='company')||null,buyer,hypotheses,gaps:[...new Set(gaps)].slice(0,10),checkedAt:clean(d?.checkedAt||previous?.checkedAt||''),researchStatus:d?.status||'unavailable'};
 return {...body,key:VERSION+':'+fingerprint([target,[profile.companyName,profile.priorityOffers,profile.valueProposition,profile.differentiation,profile.commercialObjective],unique,buyer,body.gaps])};
}
function evidenceRows(brief){return (safe(brief,brief?.domain)?.facts||[]).map(row=>({url:row.url,text:row.quote,title:brief.company,date:row.date,verification:'source_verified',sourceRead:true,sourceType:'Official',extractedAt:row.checkedAt,fromResearchBrief:true}));}
function supports(brief,trigger){const excerpt=clean(trigger?.excerpt||trigger?.summary);return Boolean(excerpt)&&(safe(brief,brief?.domain)?.facts||[]).some(row=>{
 const quote=clean(row.quote),start=quote.indexOf(excerpt);if(row.url!==D.url(trigger?.url)||start<0)return false;
 // Selecting an interior phrase must not discard its own sentence's qualifier.
 const withheld=quote.slice(0,start).split(/(?<=[.!?])\s+/).at(-1)+' '+quote.slice(start+excerpt.length).split(/(?<=[.!?])\s+/)[0];
 return !/\b(?:if|unless|whether|hypothetical|not|never|no|unconfirmed|unknown|cancelled|delayed|could|might|may|previously|formerly)\b/i.test(withheld);
});}
function opening(context={}){
 const trigger=context.trigger;if(!['source_verified','user_reviewed'].includes(trigger?.verification)||!D.url(trigger.url))return null;
 const target=D.domain(context.buyerDomain||trigger.companyDomain||trigger.url);if(trigger.verification==='source_verified'&&D.domain(trigger.url)!==target)return null;
 if(context.researchBrief&&trigger.verification==='source_verified'&&!supports(context.researchBrief,trigger))return null;
 const corpus=clean(trigger.excerpt||trigger.summary);if(!corpus||unsafe(corpus))return null;
 const now=new Date(context.now||Date.now()).getUTCFullYear();if(trigger.sourceDate&&Number.isFinite(Date.parse(trigger.sourceDate))&&new Date(context.now||Date.now())-new Date(trigger.sourceDate)>365*86400000)return null;if([...corpus.matchAll(/(?:open|opening|operational|run|start|commission(?:ed|ing))[^.!?]{0,30}\b(20\d{2})\b/gi)].some(m=>Number(m[1])<now))return null;if([...corpus.matchAll(/(?:due to (?:open|run|start)|scheduled to (?:open|run|start)|operational (?:in|by))(?: in)?\s+(20\d{2})/gi)].some(m=>Number(m[1])<now))return null;
 const sentences=corpus.split(/(?<=[.!?])\s+/).filter(sentence=>development(sentence)&&! /\b(?:if|unless|whether|hypothetical|no|not|never|unconfirmed|unknown|cancelled|delayed|could|might|may|was|were|previously|formerly)\b/i.test(sentence)&&! /[āčēģīķļņšūžåäö]|\b(?:är|och|som|har|ska|att|ett)\b/i.test(sentence)&&sentence.split(/\s+/).length<=32);
 const sentence=sentences.find(row=>! /\b(?:20\d{2}|due|scheduled)\b/i.test(row))||sentences[0];if(!sentence)return null;
 let statement=sentence.replace(/[.!?]+$/,'').replace(/^Our\b/,'your').replace(/^We are\b/,'you are').replace(/^We\b/,'you');
 if(!/^(?:your|you)\b/.test(statement))statement='that '+statement;
 return {text:'I noticed '+statement+'.',quote:sentence,url:trigger.url,verification:trigger.verification};
}
return Object.freeze({VERSION,build,safe,evidenceRows,supports,opening});
});
