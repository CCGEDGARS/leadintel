(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelOutreach=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const DEFAULT_OUTREACH_STATE=Object.freeze({selectedDomain:"",items:[]});
  const RESEARCH_STATUSES=new Set(["idle","running","complete","partial","error"]);

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function splitList(value){
    if(Array.isArray(value))return [...new Set(value.map(clean).filter(Boolean))];
    return [...new Set(String(value??"").split(/\n|;|\|/).map(clean).filter(Boolean))];
  }
  function normalizeUrl(value){try{const u=new URL(clean(value));return ["http:","https:"].includes(u.protocol)?u.href:"";}catch{return "";}}
  function domainOf(value){try{return new URL(normalizeUrl(value)).hostname.toLowerCase().replace(/^www\./,"");}catch{return "";}}
  function tokenize(value){return clean(value).toLowerCase().split(/[^a-z0-9āčēģīķļņšūž]+/i).filter(x=>x.length>=3);}
  function unique(items){return [...new Set(items.filter(Boolean))];}
  function sourceTypeFor(url,targetDomain,hint){
    if(clean(hint).toLowerCase()==="official")return "Official";
    return domainOf(url)===clean(targetDomain).toLowerCase().replace(/^www\./,"")?"Official":"Public";
  }

  function buildDossierSearchQueries(candidate={},profile={},market={},maxQueries=2){
    const domain=clean(candidate.domain)||domainOf(candidate.website);
    const company=clean(candidate.company);
    if(!domain||!company)return [];
    const limit=Math.max(1,Math.min(2,Number(maxQueries)||2));
    const offers=splitList(profile.priorityOffers);
    const offer=offers[0]||"commercial services";
    const signalTerms=(market.signals||[]).filter(x=>x.active!==false).sort((a,b)=>(Number(b.weight)||0)-(Number(a.weight)||0)).slice(0,3).flatMap(x=>splitList(String(x.keywords||x.name||"").replace(/,/g,";"))).slice(0,4);
    const marketName=clean(candidate.market)||splitList(profile.targetMarkets)[0]||"";
    const queries=[
      {id:"dossier-context",domain,query:[`\"${company}\"`,`\"${offer}\"`,marketName,...signalTerms.slice(0,2),"2026"].filter(Boolean).join(" ")},
      {id:"dossier-official",domain,query:[`site:${domain}`,offer,...signalTerms,"news investment project tender expansion modernization 2026"].filter(Boolean).join(" ")}
    ];
    return queries.slice(0,limit);
  }

  function rawResults(payload){
    if(Array.isArray(payload?.data))return payload.data;
    if(Array.isArray(payload?.data?.web))return payload.data.web;
    if(Array.isArray(payload?.web))return payload.web;
    if(Array.isArray(payload?.results))return payload.results;
    if(payload?.url||payload?.data?.url||payload?.markdown||payload?.data?.markdown)return [payload.data||payload];
    return [];
  }

  function normalizeDossierResearchResults(payload={},meta={}){
    const targetDomain=clean(meta.domain).toLowerCase().replace(/^www\./,"");
    return rawResults(payload).slice(0,10).map(item=>{
      const url=normalizeUrl(item?.url||item?.link||item?.metadata?.sourceURL||meta.url||"");
      if(!url)return null;
      const title=clean(item?.title||item?.metadata?.title)||domainOf(url);
      const description=clean(item?.description||item?.snippet||item?.metadata?.description||"");
      const text=clean(item?.markdown||item?.content||item?.text||description).slice(0,6000);
      return {
        url,title,description,text,
        date:clean(item?.publishedDate||item?.date||item?.published_at||item?.metadata?.publishedDate||item?.metadata?.modifiedTime),
        sourceType:sourceTypeFor(url,targetDomain,meta.sourceType)
      };
    }).filter(Boolean);
  }

  function recommendOffer(candidate={},profile={},research=[]){
    const offers=splitList(profile.priorityOffers);
    if(!offers.length)return "";
    const corpus=[candidate.company,candidate.market,...(candidate.matchedSignals||[]).flatMap(s=>[s.name,...(s.matchedTerms||[])]),...(candidate.evidence||[]).flatMap(e=>[e.title,e.description,e.text]),...(research||[]).flatMap(e=>[e.title,e.description,e.text])].join(" ").toLowerCase();
    let best=offers[0],bestScore=-1;
    for(const offer of offers){const terms=unique(tokenize(offer));const score=terms.reduce((sum,term)=>sum+(corpus.includes(term)?1:0),0);if(score>bestScore){best=offer;bestScore=score;}}
    return best;
  }

  function evidenceFromCandidate(candidate={}){
    return (candidate.evidence||[]).map(item=>({url:normalizeUrl(item.url),title:clean(item.title)||clean(candidate.company),description:clean(item.description),text:clean(item.text||item.description).slice(0,6000),date:clean(item.date),sourceType:"Discovery"})).filter(item=>item.url);
  }
  function dedupeEvidence(items=[]){const map=new Map();for(const item of items){if(!item?.url)continue;const key=item.url.replace(/\/$/,"");if(!map.has(key))map.set(key,item);}return [...map.values()].slice(0,15);}
  function activeObservedSignals(candidate={},market={},evidence=[]){
    const inherited=(candidate.matchedSignals||[]).map(s=>({name:clean(s.name),weight:Number(s.weight)||0})).filter(s=>s.name);if(inherited.length)return inherited;
    const corpus=evidence.map(e=>`${e.title} ${e.description} ${e.text}`).join(" ").toLowerCase();
    return (market.signals||[]).filter(s=>s.active!==false).map(s=>{const terms=String(s.keywords||s.name||"").split(/;|,|\|/).map(clean).filter(Boolean);return terms.some(t=>corpus.includes(t.toLowerCase()))?{name:clean(s.name),weight:Number(s.weight)||0}:null;}).filter(Boolean).sort((a,b)=>b.weight-a.weight);
  }

  function buildOpportunityDossier(candidate={},profile={},market={},research=[]){
    const evidence=dedupeEvidence([...evidenceFromCandidate(candidate),...(research||[]).filter(x=>x?.url).map(x=>({...x,url:normalizeUrl(x.url)}))]);
    const observed=activeObservedSignals(candidate,market,evidence);const recommendedOffer=recommendOffer(candidate,profile,research);const primarySignal=observed[0]?.name||"relevant commercial activity";const sourceCount=evidence.length;
    const whyNow=sourceCount?`Public evidence for ${clean(candidate.company)||clean(candidate.domain)} currently includes material connected to ${primarySignal}. LeadIntel found ${sourceCount} source${sourceCount===1?"":"s"} in the dossier. This is a reason to test relevance now; it does not confirm buying intent.`:`No additional public evidence was available for ${clean(candidate.company)||clean(candidate.domain)}. Keep this opportunity in research rather than assuming active buying intent.`;
    const hypotheses=[];if(recommendedOffer)hypotheses.push(`Hypothesis: if the observed ${primarySignal} affects the approved buying context, ${recommendedOffer} may be worth discussing.`);if(clean(profile.differentiation))hypotheses.push(`Hypothesis: the seller's approved differentiation (${clean(profile.differentiation)}) may be relevant if it addresses the prospect's actual priorities; validate this in conversation.`);
    return {company:clean(candidate.company),domain:clean(candidate.domain)||domainOf(candidate.website),website:normalizeUrl(candidate.website),market:clean(candidate.market),score:candidate.score||{},confidence:clean(candidate.confidence)||"Low",matchedSignals:observed,recommendedOffer,buyerRoles:splitList(profile.decisionMakers),people:(candidate.people||[]).slice(0,5),whyNow,evidence,hypotheses,researchStatus:sourceCount?"complete":"error",researchAt:new Date().toISOString()};
  }

  function firstName(contact){return clean(contact?.firstName)||clean(contact?.name).split(" ")[0]||"";}
  function evidenceHook(dossier){const signal=dossier.matchedSignals?.[0]?.name;if(signal)return `public information connected to ${signal}`;const item=dossier.evidence?.[0];return item?.title?`the public information around ${item.title}`:"your company's recent public activity";}
  function buildOutreachDrafts(dossier={},contact={},profile={},tone="consultative"){
    const company=clean(dossier.company)||clean(dossier.domain)||"your company";const offer=clean(dossier.recommendedOffer)||splitList(profile.priorityOffers)[0]||"our work";const name=firstName(contact);const hello=name?`Hi ${name},`:"Hello,";const hook=evidenceHook(dossier);const sender=clean(profile.companyName)||"our team";let emailBody,linkedinMessage,callOpener,followUp,objectionReply;
    if(tone==="direct"){
      emailBody=`${hello}\n\nI noticed ${hook} at ${company}. It may be relevant to compare how you are approaching this with ${offer}.\n\nWe help companies with ${offer}, and I would rather test fit than assume there is one. Would a short 20-minute conversation next week be useful?\n\nBest,\n[Your name]\n${sender}`;
      linkedinMessage=`${name?`Hi ${name}`:"Hello"} — I noticed ${hook} at ${company}. We work on ${offer}. There may or may not be a fit, but it could be worth a short comparison. Open to connecting?`;
      callOpener=`${name?`Hi ${name},`:"Hello,"} I’ll be brief. I noticed ${hook} at ${company}. We work with companies on ${offer}. I’m not assuming you need anything — I wanted to ask whether this is a current priority, and if so, whether a short comparison would be useful.`;
      followUp=`${hello}\n\nFollowing up once on my note about ${hook} at ${company}. If ${offer} is relevant to your current priorities, I’m happy to compare approaches briefly. If not, no problem — I’ll close the loop.\n\nBest,\n[Your name]`;
      objectionReply=`Understood. I don’t want to manufacture urgency. Just so I close this correctly: is ${offer} simply not a priority now, or is the approach itself not relevant to ${company}?`;
    }else if(tone==="brief"){
      emailBody=`${hello}\n\nI noticed ${hook} at ${company}. We work with companies on ${offer}. If this is relevant to your current priorities, would a short conversation be useful?\n\nBest,\n[Your name]\n${sender}`;
      linkedinMessage=`${name?`Hi ${name}`:"Hello"} — noticed ${hook} at ${company}. We work on ${offer}. If relevant, happy to compare notes briefly.`;
      callOpener=`${name?`Hi ${name},`:"Hello,"} quick reason for the call: I noticed ${hook} at ${company}. We work on ${offer}. Is that relevant enough to justify two minutes now?`;
      followUp=`${hello}\n\nOne quick follow-up on ${offer}. Relevant now, later, or not at all? Any answer helps me close the loop.\n\nBest,\n[Your name]`;
      objectionReply=`Thanks — understood. Is that a “not now” or a “not relevant”? I’ll follow your answer.`;
    }else{
      emailBody=`${hello}\n\nI came across ${hook} while researching ${company}. I do not want to assume this means you are actively buying anything, but it looked relevant to the kind of work we do around ${offer}.\n\nIf this is on your agenda, it could be useful to compare approaches for 20 minutes and see whether there is any practical fit. Would that be reasonable?\n\nBest,\n[Your name]\n${sender}`;
      linkedinMessage=`${name?`Hi ${name}`:"Hello"} — I came across ${hook} while looking at ${company}. I do not want to assume a need, but it overlaps with our work around ${offer}. If useful, happy to compare approaches briefly.`;
      callOpener=`${name?`Hi ${name},`:"Hello,"} I’m calling because I came across ${hook} while looking at ${company}. I don’t want to assume it creates a need, but it overlaps with our work around ${offer}. Could I ask one question to see whether there is any relevance?`;
      followUp=`${hello}\n\nI wanted to close the loop on my earlier note about ${hook}. I may be wrong about the relevance. If ${offer} is on your agenda, I’m happy to compare approaches; if it isn’t, just tell me and I won’t keep chasing.\n\nBest,\n[Your name]`;
      objectionReply=`That makes sense. I’m not trying to push past a genuine “no.” To understand it properly: what would have to be different for ${offer} to become relevant — timing, priority, approach, or something else?`;
    }
    return {tone:["consultative","direct","brief"].includes(tone)?tone:"consultative",emailSubject:`${company} — ${offer}`,emailBody,linkedinMessage:linkedinMessage.slice(0,899),callOpener,followUp,objectionReply};
  }

  function approveOutreachItem(item={},editedDrafts={},approvedAt=new Date().toISOString()){
    const drafts={emailSubject:clean(editedDrafts.emailSubject),emailBody:String(editedDrafts.emailBody??"").trim(),linkedinMessage:String(editedDrafts.linkedinMessage??"").trim(),callOpener:String(editedDrafts.callOpener??item?.drafts?.callOpener??"").trim(),followUp:String(editedDrafts.followUp??item?.drafts?.followUp??"").trim(),objectionReply:String(editedDrafts.objectionReply??item?.drafts?.objectionReply??"").trim(),tone:clean(editedDrafts.tone||item?.drafts?.tone||"consultative")};
    if(!drafts.emailSubject||!drafts.emailBody||!drafts.linkedinMessage)return {...item,drafts,approved:false,error:"Email subject, email body and LinkedIn message are required before approval."};
    return {...item,drafts,approved:true,approvedAt:clean(approvedAt),error:""};
  }

  function normalizeEvidence(item={}){const url=normalizeUrl(item.url);if(!url)return null;return {url,title:clean(item.title),description:clean(item.description),text:String(item.text||"").slice(0,6000),date:clean(item.date),sourceType:["Official","Public","Discovery"].includes(clean(item.sourceType))?clean(item.sourceType):"Public"};}
  function normalizeItem(item={}){
    const domain=clean(item.domain).toLowerCase().replace(/^www\./,"");const researchStatus=RESEARCH_STATUSES.has(item.researchStatus)?item.researchStatus:"idle";
    const dossier=item.dossier&&typeof item.dossier==="object"?{...item.dossier,company:clean(item.dossier.company),domain:clean(item.dossier.domain)||domain,website:normalizeUrl(item.dossier.website),market:clean(item.dossier.market),recommendedOffer:clean(item.dossier.recommendedOffer),buyerRoles:splitList(item.dossier.buyerRoles),whyNow:clean(item.dossier.whyNow),evidence:(item.dossier.evidence||[]).map(normalizeEvidence).filter(Boolean).slice(0,15),hypotheses:(item.dossier.hypotheses||[]).map(clean).filter(Boolean).slice(0,8),people:(item.dossier.people||[]).slice(0,5)}:null;
    return {domain,company:clean(item.company||dossier?.company),researchStatus,researchAt:clean(item.researchAt),dossier,selectedPersonId:clean(item.selectedPersonId),drafts:{tone:clean(item.drafts?.tone)||"consultative",emailSubject:clean(item.drafts?.emailSubject),emailBody:String(item.drafts?.emailBody||"").slice(0,12000),linkedinMessage:String(item.drafts?.linkedinMessage||"").slice(0,3000),callOpener:String(item.drafts?.callOpener||"").slice(0,6000),followUp:String(item.drafts?.followUp||"").slice(0,6000),objectionReply:String(item.drafts?.objectionReply||"").slice(0,6000)},approved:Boolean(item.approved),approvedAt:clean(item.approvedAt),contactedAt:clean(item.contactedAt)};
  }
  function normalizeOutreachState(value={}){const input=value&&typeof value==="object"?value:{};return {selectedDomain:clean(input.selectedDomain).toLowerCase().replace(/^www\./,""),items:(Array.isArray(input.items)?input.items:[]).slice(0,50).map(normalizeItem).filter(x=>x.domain)};}

  return {DEFAULT_OUTREACH_STATE,buildDossierSearchQueries,normalizeDossierResearchResults,recommendOffer,buildOpportunityDossier,buildOutreachDrafts,approveOutreachItem,normalizeOutreachState,splitList};
});