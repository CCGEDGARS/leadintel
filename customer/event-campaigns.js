(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelEventCampaigns=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const fields={name:120,website:2048,websiteEvidence:12000,startDate:10,endDate:10,location:160,stand:80,meetingPoint:160,audience:400,objective:400,roles:240,visitValue:600,availability:240,bookingUrl:2048,exhibitorUrl:2048,sourceUrls:12000,country:100,venue:160,attendValue:600,registrationUrl:2048,admissionCost:160,guestPass:240,timezone:80,meetingDuration:40};
 const copy=x=>JSON.parse(JSON.stringify(x)),text=(x,n=2048)=>typeof x==='string'?x.trim().slice(0,n):'';
 function url(x){if(!x)return '';try{const u=new URL(x);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
 function normalizeCampaign(x={}){x=x&&typeof x==='object'?x:{};const c={id:text(x.id,100),revision:Math.max(1,Number(x.revision)||1),role:x.role==='visitor'?'visitor':'exhibitor',archived:Boolean(x.archived)};for(const [k,n] of Object.entries(fields))c[k]=text(x[k],n);c.audienceMode=['participants','outside','both'].includes(x.audienceMode)?x.audienceMode:'both';c.sourceChoice=['provided','discover','mixed'].includes(x.sourceChoice)?x.sourceChoice:'provided';c.targetCount=Math.max(1,Math.min(50,Number(x.targetCount)||10));c.contactsPerCompany=Math.max(1,Math.min(4,Number(x.contactsPerCompany)||1));c.researchDepth=['quick','basic','deep'].includes(x.researchDepth)?x.researchDepth:'basic';return c;}
 function normalize(x={}){x=x&&typeof x==='object'?x:{};const campaigns=(Array.isArray(x.campaigns)?x.campaigns:[]).slice(0,10).map(normalizeCampaign).filter(c=>c.id);const activeId=campaigns.some(c=>c.id===x.activeId&&!c.archived)?x.activeId:'';return {version:1,activeId,campaigns};}
 function active(x){const s=normalize(x);return s.campaigns.find(c=>c.id===s.activeId)||null;}
 function validate(input,today=new Date().toISOString().slice(0,10)){const c=normalizeCampaign(input),errors=[];for(const k of ['name','startDate','endDate','location','visitValue'])if(!c[k])errors.push(k);if(c.role==='exhibitor'&&!c.stand)errors.push('stand');if(c.role==='visitor'&&!c.meetingPoint)errors.push('meetingPoint');for(const k of ['startDate','endDate'])if(c[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(c[k])||!Number.isFinite(Date.parse(c[k]))||new Date(c[k]).toISOString().slice(0,10)!==c[k]))errors.push(k);if(c.startDate>c.endDate)errors.push('date order');if(c.endDate&&c.endDate<today)errors.push('event has ended');for(const k of ['website','bookingUrl','exhibitorUrl','registrationUrl'])if(c[k]&&!url(c[k]))errors.push(k);if(errors.length)throw Error('Complete or correct: '+[...new Set(errors)].join(', '));return c;}
 function validateResearch(input){const c=normalizeCampaign(input);if(!c.name||!c.startDate||!c.endDate)throw Error('Add event name and dates before research');validate({...c,location:c.location||'To be confirmed',visitValue:c.visitValue||'To be completed in Messages',stand:c.stand||'To be confirmed',meetingPoint:c.meetingPoint||'To be confirmed'});return c;}
 function save(state,input){const s=normalize(state),old=s.campaigns.find(c=>c.id===input.id),c=normalizeCampaign({...input,id:input.id||'event-'+Date.now()+'-'+Math.random().toString(36).slice(2,8),revision:old?old.revision+1:1});if(!c.name)throw Error('Complete event name to save a draft');for(const k of ['website','bookingUrl','exhibitorUrl','registrationUrl'])if(c[k]&&!url(c[k]))throw Error('Use a valid HTTPS '+k);if(!old&&s.campaigns.length>=10)throw Error('Up to 10 event campaigns can be saved.');return {...s,campaigns:old?s.campaigns.map(x=>x.id===c.id?c:x):[...s.campaigns,c]};}
 function activate(state,id){const s=normalize(state);if(id){const c=s.campaigns.find(x=>x.id===id&&!x.archived);if(!c)throw Error('Choose a saved event');validateResearch(c);}return {...s,activeId:id||''};}
 function archive(state,id){const s=normalize(state);return {...s,activeId:s.activeId===id?'':s.activeId,campaigns:s.campaigns.map(c=>c.id===id?{...c,archived:true}:c)};}
 function normalizeSearchContext(input={}){input=input&&typeof input==='object'?input:{};const name=text(input.name,120),website=url(text(input.website,2048)),year=text(input.year,4);if(input.website&&!website)throw Error('Use a valid HTTPS event website');if(!name&&!website)throw Error('Add an event name or official event website');if(year&&!/^\d{4}$/.test(year))throw Error('Enter the event edition as a four-digit year');return {name,website,year};}
 function quickSearchQueries(input,profile={}){const c=normalizeSearchContext(input),host=c.website?new URL(c.website).hostname:'',eventName=(c.name||host).replace(/["\r\n]/g,' ').trim(),edition=c.year?' '+c.year:'',fit=text(profile.idealCustomer||profile.targetIndustries||profile.priorityOffers,180),market=text(profile.targetMarkets||profile.market,120),roles=text(profile.buyerRoles||profile.decisionMakers,120).replace(/["\r\n]/g,' '),q=[];if(host)q.push({market,query:'site:'+host+' '+(c.name?'"'+eventName+'" ':'')+edition+' exhibitors sponsors participants companies '+fit,audience:'participants',eventSearchContext:true,sourceUrl:c.website});q.push({market,query:'"'+eventName+'"'+edition+' exhibitors sponsors companies '+fit,audience:'participants',eventSearchContext:true,...(c.website?{sourceUrl:c.website}:{})});q.push({market,query:'"'+eventName+'"'+edition+' speakers participants attendees companies '+roles+' '+fit,audience:'people',eventSearchContext:true,...(c.website?{sourceUrl:c.website}:{})});return q;}
 function websiteSuggestions(sourceUrl,payload={},today=new Date().toISOString().slice(0,10)){
  const source=url(sourceUrl);if(!source)throw Error('Use a valid HTTPS event website');
  const data=payload.data||payload,body=text(data.markdown||data.content,60000);if(!body)throw Error('No readable event content. Add event details manually or try a participant page.');
  const title=text(data.metadata?.title||body.match(/^#\s+(.+)$/m)?.[1],120),links=[];
  for(const match of body.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)){if(!/exhibitor|participant|sponsor|speaker|attendee/i.test(match[1]))continue;let safe='';try{safe=url(new URL(match[2],source).href);}catch{}if(safe&&!links.includes(safe))links.push(safe);}
  const dates=[...new Set(body.match(/\b\d{4}-\d{2}-\d{2}\b/g)||[])].filter(d=>Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d);
  const suggestions={name:title,sourceUrls:links.slice(0,8).join('\n')};
  for(const key of ['country','city','venue']){const match=body.match(new RegExp('^\\s*(?:\\*\\*)?'+key+'(?:\\*\\*)?\\s*:\\s*(.+)$','im'));if(match)suggestions[key==='city'?'location':key]=text(match[1],key==='country'?100:160);}

  // Multiple dates may describe news or earlier editions: require manual review.
  if(dates.length===1&&dates[0]>=today&&new RegExp('^(?:event date|date)\\s*:\\s*'+dates[0]+'\\s*$','im').test(body))suggestions.startDate=suggestions.endDate=dates[0];
  return {...suggestions,websiteEvidence:('Source: '+source+'\nChecked: '+new Date().toISOString()+'\nExtracted page text (attendance unverified):\n'+body).slice(0,12000)};
 }
 function attendance(c,buyer={},evidence={}){
  const known=evidence&&typeof evidence==='object'?evidence:{};
  const sourceUrl=url(known.sourceUrl),excerpt=text(known.excerpt,1600),personId=text(buyer.id||buyer.personId),edition=known.campaignId===c.id&&known.eventStartDate===c.startDate;
  const proven=edition&&sourceUrl&&excerpt&&/^\d{4}-\d{2}-\d{2}$/.test(known.checkedAt||'')&&known.reviewed===true;
  const status=proven&&known.status==='confirmed'&&personId&&known.personId===personId?'confirmed':proven&&known.status==='company'?'company':'unknown';
  return {status,...(status==='unknown'?{}:{sourceUrl,excerpt,checkedAt:known.checkedAt,campaignId:c.id,eventStartDate:c.startDate,personId:status==='confirmed'?personId:''})};
 }
 function queries(c,profile={}){
  c=validateResearch(c);const fit=text(profile.idealCustomer||profile.targetIndustries||profile.priorityOffers,180),name=c.name.replace(/"/g,''),edition=c.startDate.slice(0,4),market=c.country||profile.targetMarkets||'',q=[];
  if(c.audienceMode!=='outside'){
   q.push({market,query:(url(c.exhibitorUrl||c.website)?'site:'+new URL(c.exhibitorUrl||c.website).hostname+' ':'')+'"'+name+'" '+edition+' exhibitors companies '+fit,eventCampaignId:c.id,audience:'participants',...(url(c.exhibitorUrl||c.website)?{sourceUrl:url(c.exhibitorUrl||c.website)}:{})});
   for(const raw of c.sourceUrls.split(/\n/).filter(Boolean).slice(0,8)){const safe=url(raw.trim());if(safe)q.push({market,query:'site:'+new URL(safe).hostname+' "'+name+'" '+edition+' exhibitors '+fit,eventCampaignId:c.id,audience:'participants',sourceUrl:safe});}
   q.push({market,query:'"'+name+'" '+edition+' speakers attendees '+text(c.roles,120).replace(/"/g,''),eventCampaignId:c.id,audience:'participants'});
  }
  if(c.audienceMode!=='participants')q.push({market,query:fit+' '+market+' '+text(profile.priorityOffers||c.objective,180)+' business partners',eventCampaignId:c.id,audience:'outside'});
  return q;
 }
 function deriveAttendance(c,buyer={},evidence=[]){
  const company=text(buyer.company||buyer.company_name||buyer.companyName,180).toLowerCase();if(!company)return {status:'unknown'};
  const name=c.name.toLowerCase(),escape=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  for(const e of evidence){const excerpt=text(e.text||e.excerpt||e.quote||e.summary||e.title,4000),lower=excerpt.toLowerCase(),sourceUrl=url(e.url||e.sourceUrl);
   if(e.eventStartDate&&e.eventStartDate!==c.startDate)continue;
   const edition=e.eventStartDate===c.startDate||lower.includes(c.startDate);
   const positive=new RegExp('(?:exhibitors?|participants?|sponsors?|speakers?)[\\s\\S]{0,160}'+escape(company)+'|'+escape(company)+'[\\s\\S]{0,160}(?:will exhibit|is (?:an? )?(?:exhibitor|participant|sponsor|speaker)|exhibiting)').test(lower);
   if(/not (?:an? )?(?:exhibitor|participant|sponsor|speaker|attending)|will not (?:attend|participate)|withdrawn|cancelled|canceled/.test(lower))continue;
   const checkedAt=String(e.verifiedAt||e.checkedAt||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(checkedAt))continue;
   if(sourceUrl&&(e.verified===true||e.verification==='source_verified'||Boolean(e.verifiedAt))&&edition&&lower.includes(name)&&positive)return {status:'company',sourceUrl,excerpt:excerpt.slice(0,1600),checkedAt,campaignId:c.id,eventStartDate:c.startDate,reviewed:true};
  }return {status:'unknown'};
 }
 function draft(c,e={},buyer={},style='professional',channel='email',options={}){
  c=validate(c);if(!text(e.sender)||!text(e.company))throw Error('Add sender name and company first');
  const participation=attendance(c,buyer,options.attendance),purpose=options.purpose||'stand';
  if(purpose==='followup'&&!text(options.meetingNotes))throw Error('Record actual meeting notes before writing a post-event follow-up');
  const location=c.role==='exhibitor'?'our stand '+c.stand:'a meeting at '+c.meetingPoint;
  const opening=purpose==='followup'?'Thank you for our conversation at '+c.name+'.':purpose==='invite'?`Would attending ${c.name} be useful for your team?`:purpose==='check'?`Will you be attending ${c.name}?`:participation.status==='confirmed'?`Would you be open to meeting at ${c.name}?`:participation.status==='company'?`Your company is listed for ${c.name}. Will you or someone from your team be attending?`:style==='friendly'?`If you’re planning to attend ${c.name}, I’d be delighted to meet you.`:style==='direct'?`Will you be attending ${c.name}?`:`If you’re attending ${c.name}, I’d welcome the opportunity to meet you.`;
  const link=url(c.bookingUrl)||url(e.calendly),action=link?'Choose a suitable time here: '+link:'Would you like to arrange a time? Reply with your availability.';
  const body=`Hi ${text(buyer.firstName||buyer.name?.split(' ')[0])||'there'},\n\n${opening}\n\n${text(e.company)} ${c.role==='exhibitor'?'will be exhibiting':'will be attending'} in ${c.location}, ${c.startDate} – ${c.endDate}. ${purpose==='meeting'?'Could we arrange a short conversation at '+location+'?':'You’re invited to '+location+'.'}\n\n${c.visitValue}${purpose==='invite'?'\n\n'+(c.attendValue||'')+(c.registrationUrl?'\nEvent registration: '+c.registrationUrl:'')+(c.admissionCost?'\nAdmission: '+c.admissionCost:'')+(c.guestPass?'\nGuest access: '+c.guestPass:''):''}\n\n${c.availability?'Our availability: '+c.availability+(c.timezone?' ('+c.timezone+')':'')+'\n\n':''}${c.meetingDuration?'Meeting duration: '+c.meetingDuration+'\n\n':''}${action}\n\nBest regards,\n${text(e.sender)}\n${text(e.company)}${text(e.email)?"\n"+text(e.email):""}${text(e.phone)?"\n"+text(e.phone):""}`;
  const subject=c.name.length<=36?'Meet at '+c.name:'An invitation to meet';
  return {subject:channel==='linkedin'?'':subject,message:body,linkedinMessage:body,style,language:'en',purpose,attendance:participation};
 }
 function stageDraft(item,preview){
  const next=copy(item),info=next.messageStudioDraft||{};
  if(!info.eventSnapshot){const saved=copy(info);delete saved.businessDraftSnapshot;delete saved.eventWritingDrafts;info.businessDraftSnapshot={drafts:copy(next.drafts||{}),messageStudioDraft:saved,...Object.fromEntries(['campaignScenario','localizationStatus','localizationProvenance','localizationApprovalBlocked','localizationMessage'].map(k=>[k,next[k]??null]))};}
  const drafts=(info.eventWritingDrafts||[]).filter(row=>row.campaign.id!==preview.campaign.id);info.eventWritingDrafts=[...drafts.slice(-9),copy({campaign:preview.campaign,draft:preview.draft,attendance:preview.attendance||null,purpose:preview.purpose||preview.draft.purpose||'stand'})];next.messageStudioDraft=info;return next;
 }
 function restoreBusinessDraft(item){const next=copy(item),info=next.messageStudioDraft||{},saved=info.businessDraftSnapshot;if(!saved)return null;Object.assign(next,copy(saved));next.messageStudioDraft={...next.messageStudioDraft,eventWritingDrafts:copy(info.eventWritingDrafts||[])};return next;}
 function validateDraft(c,d,e={},channel='email'){c=validate(c);if(typeof d.message!=='string'||!d.message.trim()||d.message.length>(channel==='linkedin'?3000:12000)||/\{\{|\}\}|\[(?:Calendly|reference link)/i.test(d.message))throw Error('Complete the event invitation before approval');if(channel!=='linkedin'&&(!d.subject?.trim()||Array.from(d.subject).length>60||/[\r\n]|https?:\/\/|<[^>]*>|^[\[{]|^(?:subject|error|exception|undefined|null|traceback)(?:\s*[:{]|\s*$)/i.test(d.subject)))throw Error('Use a clean subject of at most 60 characters');for(const required of [c.name,c.location,c.startDate,c.endDate,c.role==='exhibitor'?c.stand:c.meetingPoint,e.sender])if(required&&!d.message.includes(required))throw Error('Invitation must retain the event, dates, meeting location and sender');if(/(?:I (?:see|know) you(?:’|'| a)re attending|your attendance is confirmed|you will be attending|look forward to seeing you at)/i.test(d.message))throw Error('The recipient’s attendance is not confirmed; use a conditional invitation');return d;}
 return Object.freeze({fields,websiteSuggestions,normalizeCampaign,normalize,active,validate,save,activate,archive,queries,normalizeSearchContext,quickSearchQueries,attendance,deriveAttendance,validateResearch,draft,stageDraft,restoreBusinessDraft,validateDraft});
});
