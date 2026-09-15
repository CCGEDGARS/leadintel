(function(root,factory){
  const brandIdentity=root?.LeadIntelBrandIdentity||(typeof module!=="undefined"&&module.exports?require("./brand-identity.js"):null);
  const api=factory(brandIdentity);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelOutreach=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(BrandIdentity){
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
  function isLv(language){return String(language||'en').toLowerCase()==='lv';}
  function languageCompatible(value,language){const text=clean(value);if(!text)return false;const latvian=/[āčēģīķļņšūž]/i.test(text)||/\b(?:kā|var|palīdzēt|izmaksas|darba|klienta|risks)\b/i.test(text);return isLv(language)?latvian:!latvian;}
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
    const painContext=clean(profile.customerPainPoints).split(/[.!?]/)[0];
    const queries=[
      {id:"dossier-context",domain,query:[`\"${company}\"`,`\"${offer}\"`,marketName,painContext,...signalTerms.slice(0,2),"2026"].filter(Boolean).join(" ")},
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

  function buildOpportunityDossier(candidate={},profile={},market={},research=[],language='en'){
    const lv=isLv(language);
    const evidence=dedupeEvidence([...evidenceFromCandidate(candidate),...(research||[]).filter(x=>x?.url).map(x=>({...x,url:normalizeUrl(x.url)}))]);
    const observed=activeObservedSignals(candidate,market,evidence);const recommendedOffer=recommendOffer(candidate,profile,research);const primarySignal=observed[0]?.name||"relevant commercial activity";const sourceCount=evidence.length;
    const company=clean(candidate.company)||clean(candidate.domain);
    const whyNow=sourceCount?(lv?`Publiski pieejamā informācija par ${company} pašlaik ietver materiālus, kas saistīti ar signālu “${primarySignal}”. LeadIntel dosjē atrada ${sourceCount} ${sourceCount===1?'avotu':'avotus'}. Tas ir pamats pārbaudīt piedāvājuma atbilstību tagad, bet neapstiprina pirkšanas nodomu.`:`Public evidence for ${company} currently includes material connected to ${primarySignal}. LeadIntel found ${sourceCount} source${sourceCount===1?"":"s"} in the dossier. This is a reason to test relevance now; it does not confirm buying intent.`):(lv?`Papildu publiski pieejami pierādījumi par ${company} netika atrasti. Turpiniet izpēti, nevis pieņemiet, ka pastāv aktīvs pirkšanas nodoms.`:`No additional public evidence was available for ${company}. Keep this opportunity in research rather than assuming active buying intent.`);
    const hypotheses=[];if(recommendedOffer)hypotheses.push(lv?`Hipotēze: ja novērotais signāls “${primarySignal}” ietekmē apstiprināto pirkšanas situāciju, ir vērts apspriest piedāvājumu “${recommendedOffer}”.`:`Hypothesis: if the observed ${primarySignal} affects the approved buying context, ${recommendedOffer} may be worth discussing.`);if(clean(profile.differentiation))hypotheses.push(lv?`Hipotēze: pārdevēja apstiprinātā atšķirība (${clean(profile.differentiation)}) var būt nozīmīga, ja tā risina potenciālā klienta faktiskās prioritātes; tas jāpārbauda sarunā.`:`Hypothesis: the seller's approved differentiation (${clean(profile.differentiation)}) may be relevant if it addresses the prospect's actual priorities; validate this in conversation.`);const pain=languageCompatible(profile.customerPainPoints,language)?clean(profile.customerPainPoints).split(/Kā var palīdzēt|How it can/i)[0].split(/[.!?]/)[0]:"";if(pain)hypotheses.push(lv?`Hipotēze: uzņēmumam var būt aktuāla problēma “${pain}”. Pirms piedāvājuma izmantošanas tā jāapstiprina sarunā.`:`Hypothesis: the company may be experiencing this problem: “${pain}”. Validate it in conversation before using it in outreach.`);
    return {company:clean(candidate.company),domain:clean(candidate.domain)||domainOf(candidate.website),website:normalizeUrl(candidate.website),market:clean(candidate.market),score:candidate.score||{},confidence:clean(candidate.confidence)||"Low",matchedSignals:observed,recommendedOffer,buyerRoles:splitList(profile.decisionMakers),people:(candidate.people||[]).slice(0,5),whyNow,evidence,hypotheses,researchStatus:sourceCount?"complete":"error",researchAt:new Date().toISOString()};
  }

  function firstName(contact){return clean(contact?.firstName)||clean(contact?.name).split(" ")[0]||"";}
  function evidenceHook(dossier,language='en'){const lv=isLv(language);const signal=dossier.matchedSignals?.[0]?.name;if(signal)return lv?`publiski pieejamā informācija, kas saistīta ar signālu “${signal}”`:`public information connected to ${signal}`;const item=dossier.evidence?.[0];return item?.title?(lv?`publiski pieejamā informācija par “${item.title}”`:`the public information around ${item.title}`):(lv?'uzņēmuma nesenā publiskā aktivitāte':"your company's recent public activity");}
  function buildOutreachDrafts(dossier={},contact={},profile={},tone="consultative",language='en'){
    const lv=isLv(language);const company=clean(dossier.company)||clean(dossier.domain)||(lv?'jūsu uzņēmums':"your company");const offer=clean(dossier.recommendedOffer)||splitList(profile.priorityOffers)[0]||(lv?'mūsu risinājums':"our work");const name=firstName(contact);const hello=lv?(name?`Labdien, ${name}!`:'Labdien!'):(name?`Hi ${name},`:"Hello,");const hook=evidenceHook(dossier,language);const sender=clean(profile.companyName)||(lv?'mūsu komanda':"our team");let emailBody,linkedinMessage,callOpener,followUp,objectionReply;
    if(lv){
      if(tone==='direct'){
        emailBody=`${hello}\n\nPamanīju ${hook} uzņēmumā ${company}. Iespējams, būtu lietderīgi salīdzināt jūsu pašreizējo pieeju ar iespējām, ko sniedz ${offer}.\n\nMēs palīdzam uzņēmumiem šajā jomā, taču nevēlos pieņemt, ka risinājums jums noteikti ir vajadzīgs. Vai nākamnedēļ būtu noderīga īsa 20 minūšu saruna?\n\nAr cieņu,\n[Jūsu vārds]\n${sender}`;
        linkedinMessage=`${name?`Labdien, ${name}!`:'Labdien!'} Pamanīju ${hook} uzņēmumā ${company}. Mēs strādājam ar ${offer}. Iespējams, ir vērts īsi salīdzināt pieejas. Vai varam sazināties?`;
        callOpener=`${hello} Runāšu īsi. Pamanīju ${hook} uzņēmumā ${company}. Mēs palīdzam uzņēmumiem ar ${offer}. Es nepieņemu, ka jums kaut kas ir nepieciešams — vēlos noskaidrot, vai tā pašlaik ir prioritāte un vai īss salīdzinājums būtu noderīgs.`;
        followUp=`${hello}\n\nVienu reizi atgādinu par iepriekšējo ziņu saistībā ar ${hook} uzņēmumā ${company}. Ja ${offer} atbilst jūsu pašreizējām prioritātēm, labprāt īsi salīdzināšu pieejas. Ja ne, viss kārtībā — saraksti neturpināšu.\n\nAr cieņu,\n[Jūsu vārds]`;
        objectionReply=`Saprotu un nevēlos radīt mākslīgu steidzamību. Lai varu korekti noslēgt sarunu: vai ${offer} pašlaik vienkārši nav prioritāte, vai arī pati pieeja nav aktuāla uzņēmumam ${company}?`;
      }else if(tone==='brief'){
        emailBody=`${hello}\n\nPamanīju ${hook} uzņēmumā ${company}. Mēs palīdzam uzņēmumiem ar ${offer}. Ja tas atbilst jūsu pašreizējām prioritātēm, vai būtu noderīga īsa saruna?\n\nAr cieņu,\n[Jūsu vārds]\n${sender}`;
        linkedinMessage=`${name?`Labdien, ${name}!`:'Labdien!'} Pamanīju ${hook} uzņēmumā ${company}. Strādājam ar ${offer}. Ja tas ir aktuāli, labprāt īsi salīdzināšu pieredzi.`;
        callOpener=`${hello} Īsi par zvana iemeslu: pamanīju ${hook} uzņēmumā ${company}. Mēs strādājam ar ${offer}. Vai tas ir pietiekami aktuāli, lai veltītu sarunai divas minūtes?`;
        followUp=`${hello}\n\nĪss atgādinājums par ${offer}. Vai tas ir aktuāli tagad, vēlāk vai nemaz? Jebkura atbilde palīdzēs korekti noslēgt saraksti.\n\nAr cieņu,\n[Jūsu vārds]`;
        objectionReply=`Paldies, saprotu. Vai tas nozīmē “ne tagad” vai “nav aktuāli”? Rīkošos atbilstoši jūsu atbildei.`;
      }else{
        emailBody=`${hello}\n\nIzpētot uzņēmumu ${company}, pamanīju ${hook}. Nevēlos pieņemt, ka tas nozīmē aktīvu iepirkuma vajadzību, tomēr informācija sasaucas ar mūsu darbu saistībā ar ${offer}.\n\nJa šis jautājums ir jūsu darba kārtībā, 20 minūšu sarunā varētu salīdzināt pieejas un noskaidrot, vai pastāv praktiska atbilstība. Vai tas būtu pieņemami?\n\nAr cieņu,\n[Jūsu vārds]\n${sender}`;
        linkedinMessage=`${name?`Labdien, ${name}!`:'Labdien!'} Izpētot uzņēmumu ${company}, pamanīju ${hook}. Nevēlos pieņemt, ka pastāv konkrēta vajadzība, tomēr tas sasaucas ar mūsu darbu saistībā ar ${offer}. Ja noderīgi, labprāt īsi salīdzināšu pieejas.`;
        callOpener=`${hello} Zvanu, jo, izpētot uzņēmumu ${company}, pamanīju ${hook}. Nevēlos pieņemt, ka tas rada konkrētu vajadzību, tomēr tas sasaucas ar mūsu darbu saistībā ar ${offer}. Vai drīkstu uzdot vienu jautājumu, lai noskaidrotu iespējamo atbilstību?`;
        followUp=`${hello}\n\nVēlos noslēgt saraksti par manu iepriekšējo ziņu saistībā ar ${hook}. Iespējams, esmu kļūdījies par aktualitāti. Ja ${offer} ir jūsu darba kārtībā, labprāt salīdzināšu pieejas; ja nav, dodiet ziņu, un turpmāk nerakstīšu.\n\nAr cieņu,\n[Jūsu vārds]`;
        objectionReply=`Saprotu un nevēlos turpināt pēc pamatota atteikuma. Lai pareizi izprastu situāciju: kam būtu jāmainās, lai ${offer} kļūtu aktuāls — laikam, prioritātei, pieejai vai kam citam?`;
      }
      return {tone:['consultative','direct','brief'].includes(tone)?tone:'consultative',emailSubject:`${company} — ${offer}`,emailBody,linkedinMessage:linkedinMessage.slice(0,899),callOpener,followUp,objectionReply};
    }
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
    const options=arguments[3]&&typeof arguments[3]==="object"?arguments[3]:{};
    const drafts={emailSubject:clean(editedDrafts.emailSubject),emailBody:String(editedDrafts.emailBody??"").trim(),linkedinMessage:String(editedDrafts.linkedinMessage??"").trim(),callOpener:String(editedDrafts.callOpener??item?.drafts?.callOpener??"").trim(),followUp:String(editedDrafts.followUp??item?.drafts?.followUp??"").trim(),objectionReply:String(editedDrafts.objectionReply??item?.drafts?.objectionReply??"").trim(),tone:clean(editedDrafts.tone||item?.drafts?.tone||"consultative")};
    if(!drafts.emailSubject||!drafts.emailBody||!drafts.linkedinMessage)return {...item,drafts,approved:false,error:"Email subject, email body and LinkedIn message are required before approval."};
    let brandSnapshot=null;
    if(options.brandIdentity?.status==="ready"){
      try{brandSnapshot=BrandIdentity?.snapshot(options.brandIdentity)||null;}
      catch{return {...item,drafts,approved:false,error:"Brand identity is marked Ready but is not valid. Review it in Step 1 before approval."};}
    }
    const generatedBodies=[item?.drafts?.emailBody,item?.contentVariants?.drafts?.en?.emailBody,item?.contentVariants?.drafts?.lv?.emailBody].map(value=>String(value??"")).filter(Boolean);
    const generated=generatedBodies.includes(drafts.emailBody);
    if(brandSnapshot&&generated)drafts.emailBody=removeGeneratedSenderPlaceholder(drafts.emailBody);
    const approvedSource=freezeCopy(drafts);
    const approvedEmail=freezeCopy(renderEmail(approvedSource,brandSnapshot));
    return {...item,drafts:{...approvedSource},approvedSource,brandSnapshot,approvedEmail,approved:true,approvedAt:clean(approvedAt),error:""};
  }

  function freezeCopy(value){
    const copy=value==null?value:JSON.parse(JSON.stringify(value));
    const freeze=node=>{if(!node||typeof node!=="object"||Object.isFrozen(node))return node;Object.freeze(node);for(const child of Object.values(node))freeze(child);return node;};
    return freeze(copy);
  }
  function removeGeneratedSenderPlaceholder(value){return String(value??"").replace(/^[ \t]*\[(?:Your name|Jūsu vārds)\][ \t]*(?:\r?\n)?/gim,"").trim();}
  function renderEmail(source={},brandSnapshot=null){
    const subject=clean(source.emailSubject);
    const bodyText=String(source.emailBody??"").trim();
    if(!brandSnapshot||!BrandIdentity?.renderEmail)return {subject,textBody:bodyText,htmlBody:null};
    return BrandIdentity.renderEmail({subject,bodyText,brandSnapshot});
  }
  function renderApprovedEmail(item={}){
    if(!item?.approved)return null;
    return freezeCopy(renderEmail(item.approvedSource||item.drafts||{},item.brandSnapshot||null));
  }
  function buildApprovedSendPayload(item={},recipient=""){
    const email=renderApprovedEmail(item);if(!email)return null;
    return {recipient:clean(recipient),subject:email.subject,body:email.textBody,textBody:email.textBody,htmlBody:email.htmlBody};
  }
  function invalidateOutreachApproval(item={}){
    return {...item,approved:false,approvedAt:"",contactedAt:"",brandSnapshot:null,approvedSource:null,approvedEmail:null,error:""};
  }

  function localizeGeneratedItem(item={},candidate={},profile={},market={},language='en'){
    if(!item?.dossier||item.approved)return item;
    const target=isLv(language)?'lv':'en';const sourceCandidate={...candidate,company:candidate.company||item.company,domain:candidate.domain||item.domain,people:candidate.people?.length?candidate.people:item.dossier.people,evidence:candidate.evidence?.length?candidate.evidence:[]};
    const research=item.dossier.evidence||[];
    const dossiers={en:buildOpportunityDossier(sourceCandidate,profile,market,research,'en'),lv:buildOpportunityDossier(sourceCandidate,profile,market,research,'lv')};
    const currentDossier={...item.dossier};
    const stored=item.contentVariants&&typeof item.contentVariants==='object'?item.contentVariants:{};
    const currentDossierVariant=stored.dossier?.[item.contentLanguage||'en']||{};
    for(const field of ['whyNow'])if(currentDossier[field]===dossiers.en[field]||currentDossier[field]===dossiers.lv[field]||currentDossier[field]===currentDossierVariant[field])currentDossier[field]=dossiers[target][field];
    const currentHypotheses=JSON.stringify(currentDossier.hypotheses||[]);
    if(currentHypotheses===JSON.stringify(dossiers.en.hypotheses)||currentHypotheses===JSON.stringify(dossiers.lv.hypotheses)||currentHypotheses===JSON.stringify(currentDossierVariant.hypotheses))currentDossier.hypotheses=dossiers[target].hypotheses;
    const people=currentDossier.people||[];const contact=people.find(person=>clean(person.id)===clean(item.selectedPersonId))||people[0]||{};
    const tone=item.drafts?.tone||'consultative';const variants={en:buildOutreachDrafts(dossiers.en,contact,profile,tone,'en'),lv:buildOutreachDrafts(dossiers.lv,contact,profile,tone,'lv')};
    const drafts={...item.drafts};
    const currentDraftVariant=stored.drafts?.[item.contentLanguage||'en']||{};
    for(const field of ['emailSubject','emailBody','linkedinMessage','callOpener','followUp','objectionReply'])if(drafts[field]===variants.en[field]||drafts[field]===variants.lv[field]||drafts[field]===currentDraftVariant[field])drafts[field]=variants[target][field];
    return {...item,dossier:currentDossier,drafts,contentLanguage:target,contentVariants:{dossier:{en:{whyNow:dossiers.en.whyNow,hypotheses:dossiers.en.hypotheses},lv:{whyNow:dossiers.lv.whyNow,hypotheses:dossiers.lv.hypotheses}},drafts:{en:{emailSubject:variants.en.emailSubject,emailBody:variants.en.emailBody,linkedinMessage:variants.en.linkedinMessage,callOpener:variants.en.callOpener,followUp:variants.en.followUp,objectionReply:variants.en.objectionReply},lv:{emailSubject:variants.lv.emailSubject,emailBody:variants.lv.emailBody,linkedinMessage:variants.lv.linkedinMessage,callOpener:variants.lv.callOpener,followUp:variants.lv.followUp,objectionReply:variants.lv.objectionReply}}}};
  }

  function normalizeEvidence(item={}){const url=normalizeUrl(item.url);if(!url)return null;return {url,title:clean(item.title),description:clean(item.description),text:String(item.text||"").slice(0,6000),date:clean(item.date),sourceType:["Official","Public","Discovery"].includes(clean(item.sourceType))?clean(item.sourceType):"Public"};}
  function normalizeItem(item={}){
    const domain=clean(item.domain).toLowerCase().replace(/^www\./,"");const researchStatus=RESEARCH_STATUSES.has(item.researchStatus)?item.researchStatus:"idle";
    const dossier=item.dossier&&typeof item.dossier==="object"?{...item.dossier,company:clean(item.dossier.company),domain:clean(item.dossier.domain)||domain,website:normalizeUrl(item.dossier.website),market:clean(item.dossier.market),recommendedOffer:clean(item.dossier.recommendedOffer),buyerRoles:splitList(item.dossier.buyerRoles),whyNow:clean(item.dossier.whyNow),evidence:(item.dossier.evidence||[]).map(normalizeEvidence).filter(Boolean).slice(0,15),hypotheses:(item.dossier.hypotheses||[]).map(clean).filter(Boolean).slice(0,8),people:(item.dossier.people||[]).slice(0,5)}:null;
    const drafts={tone:clean(item.drafts?.tone)||"consultative",emailSubject:clean(item.drafts?.emailSubject),emailBody:String(item.drafts?.emailBody||"").slice(0,12000),linkedinMessage:String(item.drafts?.linkedinMessage||"").slice(0,3000),callOpener:String(item.drafts?.callOpener||"").slice(0,6000),followUp:String(item.drafts?.followUp||"").slice(0,6000),objectionReply:String(item.drafts?.objectionReply||"").slice(0,6000)};
    const approved=Boolean(item.approved);let brandSnapshot=null;
    if(approved&&item.brandSnapshot?.status==="ready"){try{brandSnapshot=BrandIdentity?.snapshot(item.brandSnapshot)||null;}catch{brandSnapshot=null;}}
    const sourceInput=item.approvedSource&&typeof item.approvedSource==="object"?item.approvedSource:drafts;
    const approvedSource=approved?freezeCopy({tone:clean(sourceInput.tone)||drafts.tone,emailSubject:clean(sourceInput.emailSubject)||drafts.emailSubject,emailBody:String(sourceInput.emailBody??drafts.emailBody).slice(0,12000),linkedinMessage:String(sourceInput.linkedinMessage??drafts.linkedinMessage).slice(0,3000),callOpener:String(sourceInput.callOpener??drafts.callOpener).slice(0,6000),followUp:String(sourceInput.followUp??drafts.followUp).slice(0,6000),objectionReply:String(sourceInput.objectionReply??drafts.objectionReply).slice(0,6000)}):null;
    const approvedEmail=approved?freezeCopy(renderEmail(approvedSource||drafts,brandSnapshot)):null;
    return {domain,company:clean(item.company||dossier?.company),researchStatus,researchAt:clean(item.researchAt),dossier,selectedPersonId:clean(item.selectedPersonId),drafts,approved,approvedAt:clean(item.approvedAt),contactedAt:clean(item.contactedAt),brandSnapshot,approvedSource,approvedEmail,contentLanguage:['en','lv'].includes(item.contentLanguage)?item.contentLanguage:'',contentVariants:item.contentVariants&&typeof item.contentVariants==='object'?item.contentVariants:{}};
  }
  function normalizeOutreachState(value={}){const input=value&&typeof value==="object"?value:{};return {selectedDomain:clean(input.selectedDomain).toLowerCase().replace(/^www\./,""),items:(Array.isArray(input.items)?input.items:[]).slice(0,50).map(normalizeItem).filter(x=>x.domain)};}

  return {DEFAULT_OUTREACH_STATE,buildDossierSearchQueries,normalizeDossierResearchResults,recommendOffer,buildOpportunityDossier,buildOutreachDrafts,localizeGeneratedItem,approveOutreachItem,renderApprovedEmail,buildApprovedSendPayload,invalidateOutreachApproval,normalizeOutreachState,splitList};
});
