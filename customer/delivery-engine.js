(function(root,factory){
  const outreach=root?.LeadIntelOutreach||(typeof module!=="undefined"&&module.exports?require("./outreach-engine.js"):null);
  const api=factory(outreach);
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelDelivery=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(Outreach){
  "use strict";

  const CONNECTOR=Object.freeze({id:"gmail-compose",label:"Gmail Compose",syncMode:"manual-confirmation"});
  const OUTCOME_STAGES=["Meeting","Proposal","Won","Lost"];
  const CRM_ORDER=["Discovered","Qualified","Contact Found","Ready for Outreach","Contacted","Replied","Meeting","Proposal","Won","Lost"];
  const REPLY_CATEGORIES=new Set(["meeting_request","positive","objection","not_now","referral","unsubscribe","out_of_office","neutral"]);

  function clean(value){return String(value??"").replace(/\s+/g," ").trim();}
  function cleanMultiline(value){return String(value??"").replace(/\r\n?/g,"\n").trim();}
  function normalizeDomain(value){return clean(value).toLowerCase().replace(/^https?:\/\//,"").replace(/^www\./,"").split(/[/?#]/)[0];}
  function normalizeEmail(value){
    const raw=String(value??"").trim().toLowerCase();
    if(!raw||/[\r\n]/.test(raw)||raw.length>254)return "";
    return /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(raw)?raw:"";
  }
  function safeIso(value){const d=new Date(value||Date.now());return Number.isFinite(d.getTime())?d.toISOString():new Date().toISOString();}
  function eventId(prefix,domain,at){return `${prefix}-${normalizeDomain(domain)||"unknown"}-${safeIso(at).replace(/[^0-9]/g,"")}`;}
  function splitSignals(value){
    if(!Array.isArray(value))return [];
    return [...new Set(value.map(item=>clean(typeof item==="string"?item:item?.name)).filter(Boolean))].slice(0,20);
  }
  function stageIndex(stage){const i=CRM_ORDER.indexOf(stage);return i<0?0:i;}

  function buildGmailComposeUrl(packageItem,recipient){
    const to=normalizeEmail(recipient);
    const frozen=Outreach?.buildApprovedSendPayload?.(packageItem,to);
    if(!frozen)return "";
    const subject=String(frozen.subject??""),body=String(frozen.textBody??"");
    if(!packageItem?.approved||!to||!subject||!body)return "";
    const url=new URL("https://mail.google.com/mail/");
    url.searchParams.set("view","cm");
    url.searchParams.set("fs","1");
    url.searchParams.set("to",to);
    url.searchParams.set("su",subject);
    url.searchParams.set("body",body);
    return url.toString();
  }

  function normalizeReply(value){
    const text=cleanMultiline(value?.text).slice(0,12000);
    const category=REPLY_CATEGORIES.has(value?.category)?value.category:classifyReply(text);
    return {id:clean(value?.id)||eventId("reply",value?.domain||"reply",value?.at),text,category,at:safeIso(value?.at)};
  }
  function packageKey(item={}){return JSON.stringify([normalizeDomain(item.domain),clean(item.selectedPersonId),item.channel==='linkedin'?'linkedin':'email',clean(item.approvedAt)]);}
  function approvedDeliveryPackages(state={},canonicalState){
    const packages=new Map(),seen=new Set();
    for(const item of [...(state.items||[]),...Object.values(state.buyerDrafts||{})]){
      if(!item?.domain)continue;
      const buyer=JSON.stringify([normalizeDomain(item.domain),clean(item.selectedPersonId),item.channel||'email']);
      if(seen.has(buyer))continue;seen.add(buyer);
      if(!item.approved||item.channel==='linkedin'||item.reapprovalRequired||!Outreach?.approvalCurrent?.(item)||!Outreach?.sourceAuthorityCurrent?.(item,canonicalState,state.messageStudio||{}))continue;
      // Active items own the buyer's current revision; archived buyer drafts are fallbacks.
      if(!packages.has(buyer))packages.set(buyer,item);
    }
    return [...packages.values()];
  }
  function approvedRecipient(pkg={},workspaceId=''){
    return pkg?normalizeEmail(Outreach?.approvedRecipient?.(pkg)||''):'';
  }
  function findDeliveryRecord(state,packageItem={},recipient=''){
    if(!packageItem)return null;
    const person=packageItem.dossier?.people?.find(p=>p.id===packageItem.selectedPersonId);
    const email=normalizeEmail(recipient||person?.email||person?.work_email||person?.normalized_email);
    const candidates=normalizeDeliveryState(state).opportunities.filter(row=>row.domain===normalizeDomain(packageItem.domain)&&(!email||row.recipientEmail===email)&&(!row.personId||row.personId===clean(packageItem.selectedPersonId)));
    const exact=candidates.filter(row=>row.approvedAt&&row.approvedAt===clean(packageItem.approvedAt));
    if(exact.length)return exact.length===1?exact[0]:null;
    const legacy=candidates.filter(row=>!row.approvedAt);
    return legacy.length===1?legacy[0]:null;
  }
  function submissionStorageKey(workspace,user,packageItem,recipient){return 'leadintel_mail_submission_v1:'+workspace+':'+user+':'+encodeURIComponent(JSON.stringify([normalizeDomain(packageItem?.domain),clean(packageItem?.selectedPersonId),clean(packageItem?.approvedAt),normalizeEmail(recipient)]));}
  function pendingRecipientKey(workspace,user,packageItem,recipient){return 'leadintel_mail_pending_v1:'+workspace+':'+user+':'+encodeURIComponent(JSON.stringify([normalizeDomain(packageItem?.domain),normalizeEmail(recipient)]));}
  function readSubmissionReceipt(storage,workspace,user,packageItem,recipient){
    const exact=submissionStorageKey(workspace,user,packageItem,recipient),legacy='leadintel_mail_submission_v1:'+workspace+':'+user;
    for(const key of [exact,pendingRecipientKey(workspace,user,packageItem,recipient),legacy]){const raw=storage?.getItem(key);if(!raw)continue;let value;try{value=JSON.parse(raw);}catch{return {status:'unconfirmed'};}
      if(!value||!['unconfirmed','sent'].includes(value.status))continue;
      if(key!==legacy||!value.domain||normalizeDomain(value.domain)===normalizeDomain(packageItem?.domain)&&(value.status==='unconfirmed'||String(value.personId||'')===String(packageItem?.selectedPersonId||''))&&(value.status==='unconfirmed'||value.approvedAt===packageItem?.approvedAt)&&normalizeEmail(value.recipient)===normalizeEmail(recipient))return value;
    }return null;
  }
  function saveSubmissionReceipt(storage,workspace,user,packageItem,recipient,receipt){
    const value=JSON.stringify({...receipt,workspaceId:workspace,domain:normalizeDomain(packageItem?.domain),personId:clean(packageItem?.selectedPersonId),approvedAt:clean(packageItem?.approvedAt),recipient:normalizeEmail(recipient)});
    const pending=pendingRecipientKey(workspace,user,packageItem,recipient);if(receipt.status==='unconfirmed')storage.setItem(pending,value);else if(['sent','failed'].includes(receipt.status))storage.removeItem?.(pending);
    storage.setItem(submissionStorageKey(workspace,user,packageItem,recipient),value);storage.setItem('leadintel_mail_submission_v1:'+workspace+':'+user,value);
  }
  function selectedRecord(state,selector){
    let matches;
    if(selector&&typeof selector==='object'){
      matches=state.opportunities.filter(row=>row.domain===normalizeDomain(selector.domain));
      if(selector.id)matches=matches.filter(row=>row.id===selector.id);
      else {
        const threadMatches=selector.threadId?matches.filter(row=>row.threadId===selector.threadId):[];
        matches=threadMatches.length?threadMatches:matches.filter(row=>(!selector.recipientEmail||row.recipientEmail===normalizeEmail(selector.recipientEmail))&&(!selector.threadId||!row.threadId));
      }
    }else matches=state.opportunities.filter(row=>row.id===selector||row.domain===normalizeDomain(selector));
    return matches.length===1?matches[0]:null;
  }
  function normalizeOpportunity(value){
    const domain=normalizeDomain(value?.domain);
    const replies=Array.isArray(value?.replies)?value.replies.map(item=>normalizeReply({...item,domain})).filter(item=>item.text):[];
    const outcomeStage=OUTCOME_STAGES.includes(value?.outcomeStage)?value.outcomeStage:"";
    return {
      id:clean(value?.id)||JSON.stringify(value?.approvedAt?[domain,clean(value?.personId),clean(value.approvedAt),normalizeEmail(value?.recipientEmail)]:['legacy',domain,normalizeEmail(value?.recipientEmail)]),
      personId:clean(value?.personId),
      threadId:clean(value?.threadId),
      providerMessageId:clean(value?.providerMessageId),
      approvedAt:clean(value?.approvedAt),
      domain,
      company:clean(value?.company).slice(0,180),
      subject:clean(value?.subject).slice(0,500),
      bodyText:cleanMultiline(value?.bodyText),
      recipientEmail:normalizeEmail(value?.recipientEmail),
      sentAt:value?.sentAt?safeIso(value.sentAt):"",
      deliveryChannel:['gmail','microsoft','gmail-compose'].includes(value?.deliveryChannel)?value.deliveryChannel:'gmail-compose',
      replies,
      latestReplyCategory:REPLY_CATEGORIES.has(value?.latestReplyCategory)?value.latestReplyCategory:(replies[0]?.category||""),
      outcomeStage,
      outcomeAt:outcomeStage&&value?.outcomeAt?safeIso(value.outcomeAt):"",
      tone:clean(value?.tone).toLowerCase().slice(0,40),
      market:clean(value?.market).slice(0,160),
      offer:clean(value?.offer).slice(0,240),
      signals:splitSignals(value?.signals)
    };
  }
  function normalizeActivity(value){return {id:clean(value?.id)||eventId("event",value?.domain||"activity",value?.at),type:clean(value?.type).slice(0,80),domain:normalizeDomain(value?.domain),at:safeIso(value?.at),category:clean(value?.category).slice(0,80),stage:clean(value?.stage).slice(0,80)};}
  function normalizeDeliveryState(value){
    const source=value&&typeof value==="object"?value:{};
    const opportunities=Array.isArray(source.opportunities)?source.opportunities.map(normalizeOpportunity).filter(item=>item.domain):[];
    const activity=Array.isArray(source.activity)?source.activity.map(normalizeActivity).filter(item=>item.type):[];
    return {selectedDomain:normalizeDomain(source.selectedDomain),selectedPackageKey:clean(source.selectedPackageKey),selectedRecordId:clean(source.selectedRecordId),opportunities,activity,connector:{...CONNECTOR}};
  }
  function upsertOpportunity(state,record){
    const next=normalizeDeliveryState(state);const normalized=normalizeOpportunity(record);const index=next.opportunities.findIndex(item=>item.id===normalized.id);
    if(index>=0)next.opportunities[index]=normalized;else next.opportunities.unshift(normalized);
    next.selectedDomain=normalized.domain||next.selectedDomain;return next;
  }
  function addActivity(state,event){const next=normalizeDeliveryState(state);next.activity.unshift(normalizeActivity(event));return next;}

  function buildSentCrmActivity(packageItem,record={},options={}){
    if(!packageItem?.approved)return null;
    const recipient=normalizeEmail(record.recipientEmail);if(!recipient)return null;
    const payload=Outreach?.buildApprovedSendPayload?.(packageItem,recipient);
    const source=packageItem?.approvedSource&&typeof packageItem.approvedSource==="object"?packageItem.approvedSource:packageItem?.drafts;
    const subject=clean(payload?.subject??source?.emailSubject);if(!subject)return null;
    const channel=clean(options.channel)||"gmail-compose";
    return {id:clean(options.id),type:"email.sent",channel,direction:"outbound",subject,summary:`Email sent to ${recipient}`,occurred_at:safeIso(record.sentAt),metadata:{recipient,delivery_channel:options.api?`${channel}-api`:channel}};
  }

  function confirmSend(state,packageItem,recipient,at,metadata={}){
    const base=normalizeDeliveryState(state);
    if(!packageItem?.approved)return {state:base,record:null,error:"Approved outreach package required"};
    const email=normalizeEmail(recipient);if(!email)return {state:base,record:null,error:"Valid recipient email required"};
    if(!buildGmailComposeUrl(packageItem,email))return {state:base,record:null,error:"Approved email subject and body required"};
    const domain=normalizeDomain(packageItem?.domain);if(!domain)return {state:base,record:null,error:"Opportunity domain required"};
    const existing=findDeliveryRecord(base,packageItem,email)||{};
    if(existing.sentAt)return {state:base,record:existing,error:'',duplicate:true};
    const when=safeIso(at);
    const record=normalizeOpportunity({...existing,domain,threadId:metadata.threadId,providerMessageId:metadata.providerMessageId,personId:packageItem.selectedPersonId,approvedAt:packageItem.approvedAt,company:clean(packageItem?.company)||existing.company,subject:Outreach?.buildApprovedSendPayload?.(packageItem,email)?.subject||packageItem.drafts?.emailSubject,bodyText:Outreach?.buildApprovedSendPayload?.(packageItem,email)?.textBody||packageItem.drafts?.emailBody,recipientEmail:email,sentAt:when,deliveryChannel:metadata.deliveryChannel||"gmail-compose",tone:clean(packageItem?.drafts?.tone||existing.tone).toLowerCase(),market:clean(packageItem?.dossier?.market||existing.market),offer:clean(packageItem?.dossier?.recommendedOffer||existing.offer),signals:splitSignals(packageItem?.dossier?.matchedSignals||existing.signals),replies:existing.replies||[],latestReplyCategory:existing.latestReplyCategory||"",outcomeStage:existing.outcomeStage||"",outcomeAt:existing.outcomeAt||""});
    let next=upsertOpportunity(base,record);next=addActivity(next,{id:eventId("sent",domain,when),type:"message.sent",domain,at:when,stage:"Contacted"});
    next.selectedPackageKey=packageKey(packageItem);next.selectedRecordId="";return {state:next,record:next.opportunities.find(item=>item.id===record.id),error:""};
  }

  function classifyReply(text){
    const value=cleanMultiline(text).toLowerCase();if(!value)return "neutral";
    if(/out of office|automatic reply|away from (?:the )?office|on (?:annual )?leave|vacation responder|return(?:ing)? on/.test(value))return "out_of_office";
    if(/unsubscribe|remove me|stop emailing|do not contact|don't contact|no more emails/.test(value))return "unsubscribe";
    if(/speak (?:with|to)|contact (?:my|our|the)|reach out to|better person|instead|forward(?:ed)? (?:this )?to/.test(value)&&/(procurement|purchasing|director|manager|colleague|team|marta|person|responsible)/.test(value))return "referral";
    if(/not now|next quarter|next year|later this year|circle back|come back to me|revisit|not a priority right now|maybe later/.test(value))return "not_now";
    if(/already (?:have|use|work with)|current supplier|existing supplier|too expensive|price is too high|budget|not interested|no need|not relevant|we are covered|contracted with/.test(value))return "objection";
    if(/schedule|meeting|meet|book a call|set up a call|arrange a call|calendar|available (?:on|for)|call next|call on|zoom|teams call|google meet/.test(value))return "meeting_request";
    if(/sounds interesting|interested|yes[, ]|please send|send more information|tell me more|would like to know|worth discussing|let's discuss|lets discuss|happy to discuss/.test(value))return "positive";
    return "neutral";
  }

  function recordReply(state,domain,text,at){
    const base=normalizeDeliveryState(state);const selected=selectedRecord(base,domain);const index=base.opportunities.findIndex(item=>item.id===selected?.id);const key=selected?.domain;
    if(index<0)return {state:base,record:null,error:"Select a specific sent recipient; company history is missing or ambiguous"};
    const body=cleanMultiline(text);if(!body)return {state:base,record:base.opportunities[index],error:"Reply text required"};
    const when=safeIso(at);const category=classifyReply(body);const record={...base.opportunities[index]};
    record.replies=[{id:eventId("reply",key,when),text:body.slice(0,12000),category,at:when},...(record.replies||[])];record.latestReplyCategory=category;
    let next=upsertOpportunity(base,record);const stage="Replied";next=addActivity(next,{id:eventId("reply-event",key,when),type:"reply.received",domain:key,at:when,category,stage});
    return {state:next,record:next.opportunities.find(item=>item.id===record.id),error:""};
  }

  function recordOutcome(state,domain,stage,at){
    const base=normalizeDeliveryState(state);const selected=selectedRecord(base,domain);const index=base.opportunities.findIndex(item=>item.id===selected?.id);const key=selected?.domain;
    if(index<0)return {state:base,record:null,error:"Select a specific sent recipient; company history is missing or ambiguous"};
    if(!OUTCOME_STAGES.includes(stage))return {state:base,record:base.opportunities[index],error:"Invalid outcome stage"};
    const record={...base.opportunities[index]};const current=record.outcomeStage;
    const rank={"":0,Meeting:1,Proposal:2,Won:3,Lost:3};
    if(!current||rank[stage]>rank[current]){record.outcomeStage=stage;record.outcomeAt=safeIso(at);}
    let next=upsertOpportunity(base,record);next=addActivity(next,{id:eventId("outcome",key,at),type:"outcome.recorded",domain:key,at:safeIso(at),stage:record.outcomeStage||stage});
    return {state:next,record:next.opportunities.find(item=>item.id===record.id),error:""};
  }

  function recommendedPipelineStage(record){
    if(!record)return "Ready for Outreach";
    if(OUTCOME_STAGES.includes(record.outcomeStage))return record.outcomeStage;
    if(Array.isArray(record.replies)&&record.replies.length)return "Replied";
    if(record.sentAt)return "Contacted";
    return "Ready for Outreach";
  }

  function percent(n,d){return d?Math.round(n/d*100):0;}
  function segmentStats(records,keyFn){
    const map=new Map();
    for(const record of records){const keys=[...new Set([].concat(keyFn(record)||[]).map(clean).filter(Boolean))];for(const key of keys){if(!map.has(key))map.set(key,[]);map.get(key).push(record);}}
    return [...map.entries()].map(([key,items])=>{
      const replied=items.filter(item=>item.replies?.length).length;
      const meetings=items.filter(item=>stageIndex(recommendedPipelineStage(item))>=stageIndex("Meeting")&&recommendedPipelineStage(item)!=="Lost").length;
      const wins=items.filter(item=>item.outcomeStage==="Won").length;
      return {key,sent:items.length,replied,replyRate:percent(replied,items.length),meetings,meetingRate:percent(meetings,items.length),wins,winRate:percent(wins,items.length)};
    }).sort((a,b)=>b.sent-a.sent||b.replyRate-a.replyRate||a.key.localeCompare(b.key));
  }
  function titleCase(value){const v=clean(value);return v?v.charAt(0).toUpperCase()+v.slice(1):v;}
  function contextFor(record,outreachItems,pipeline){
    const pkg=(outreachItems||[]).find(item=>normalizeDomain(item?.domain)===record.domain)||{};
    const pipe=(pipeline||[]).find(item=>normalizeDomain(item?.domain)===record.domain)||{};
    return {...record,tone:record.tone||clean(pkg?.drafts?.tone).toLowerCase(),market:record.market||clean(pkg?.dossier?.market)||clean(pipe?.market),offer:record.offer||clean(pkg?.dossier?.recommendedOffer),signals:record.signals?.length?record.signals:splitSignals(pkg?.dossier?.matchedSignals||pipe?.matchedSignals)};
  }
  function buildLearningSummary(state,outreachItems=[],pipeline=[],minSample=3,language='en'){
    const lv=String(language||'en').toLowerCase()==='lv';
    const normalized=normalizeDeliveryState(state);const sample=Math.max(1,Number(minSample)||3);
    const records=normalized.opportunities.filter(item=>item.sentAt).map(item=>contextFor(item,outreachItems,pipeline));
    const replied=records.filter(item=>item.replies?.length).length;
    const meetings=records.filter(item=>stageIndex(recommendedPipelineStage(item))>=stageIndex("Meeting")&&recommendedPipelineStage(item)!=="Lost").length;
    const proposals=records.filter(item=>["Proposal","Won"].includes(item.outcomeStage)).length;
    const won=records.filter(item=>item.outcomeStage==="Won").length;const lost=records.filter(item=>item.outcomeStage==="Lost").length;
    const byTone=segmentStats(records,item=>item.tone||[]);const byMarket=segmentStats(records,item=>item.market||[]);const byOffer=segmentStats(records,item=>item.offer||[]);const bySignal=segmentStats(records,item=>item.signals||[]);
    const recommendations=[];
    const addTop=(segments,label,metric)=>{
      const eligible=segments.filter(item=>item.sent>=sample);if(!eligible.length)return;
      const field=metric==="meeting"?"meetingRate":"replyRate";const top=[...eligible].sort((a,b)=>b[field]-a[field]||b.sent-a.sent)[0];
      if(top[field]<=0)return;
      if(lv){
        const labels={tone:'tonis',market:'tirgus',offer:'piedāvājums',signal:'signāls'};
        const toneNames={consultative:'konsultatīvs',direct:'tiešs',brief:'īss'};const key=label==='tone'?(toneNames[top.key]||top.key):top.key;
        recommendations.push(`“${key}” ${labels[label]||label}: ${top.sent} nosūtījumi un ${top[field]}% ${metric==="meeting"?'tikšanos':'atbilžu'} rādītājs. Turpiniet šo virzienu prioritizēt piesardzīgi, kamēr izlase pieaug.`);
      }else{
        const noun=label==="tone"?`${titleCase(top.key)} tone`:`${top.key} ${label}`;
        recommendations.push(`${noun} has ${top.sent} sends and a ${top[field]}% ${metric==="meeting"?"meeting":"reply"} rate. Keep prioritizing it cautiously while the sample grows.`);
      }
    };
    addTop(byTone,"tone","reply");addTop(byMarket,"market","reply");addTop(byOffer,"offer","reply");addTop(bySignal,"signal","meeting");
    return {metrics:{sent:records.length,replied,replyRate:percent(replied,records.length),meetings,meetingRate:percent(meetings,records.length),proposals,won,lost,winRate:percent(won,won+lost)},byTone,byMarket,byOffer,bySignal,recommendations:recommendations.slice(0,6),minimumSample:sample};
  }

  return {CONNECTOR,OUTCOME_STAGES,CRM_ORDER,submissionStorageKey,readSubmissionReceipt,saveSubmissionReceipt,packageKey,approvedDeliveryPackages,approvedRecipient,findDeliveryRecord,normalizeEmail,buildGmailComposeUrl,buildSentCrmActivity,confirmSend,classifyReply,recordReply,recordOutcome,recommendedPipelineStage,buildLearningSummary,normalizeDeliveryState};
});
