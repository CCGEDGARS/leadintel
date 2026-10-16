(function(root){
'use strict';
const patternVersion='inmail-facts-20261016-v2';
const stages=['initial','connection','followup','calendar'];
const fields={milestoneWork:'Verified work now under way (e.g. Foundation work)',projectType:'Verified facility type',deliveryItem:'Relevant delivery item (singular)',experienceDuration:'Confirmed experience duration',experienceIndustry:'Confirmed experience industry',experienceMarket:'Confirmed specialist market',milestoneActivity:'Verified activity that has started',projectRegion:'Verified project region',experienceOutcome:'Confirmed delivery outcome phrase',firstName:'Recipient first name',sender:'Your name',company:'Your company',sellerDescription:'Confirmed description of your company',proof:'Approved reference or case',offerLabel:'Short offer label',offer:'Relevant products or services',project:'Verified project name',projectShortName:'Short project name',projectRoute:'Verified buyer or contractor route',reliabilityProof:'Supported reliability claim',qualityProof:'Supported quality claim',costProof:'Supported cost claim',serviceFocus:'Relevant service',development:'Verified development or milestone',deliveryRequirement:'Supported delivery requirement',experience:'Confirmed experience',meetingMaterial:'Material you commit to bring',qualifiedOption:'Relevant qualified option',projectYear:'Verified project year',senderLocation:'Your location',experienceSentence:'Confirmed experience statement',benefit:'Supported benefit phrase',value:'Supported value',calendly:'Your booking URL'};
function slots(row){return [...new Set((JSON.stringify(row.stages||[]).match(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g)||[]).map(s=>s.slice(2,-2)))];}
function prepare(row,values={}){const out={};for(const s of row.stages||[])if(stages.includes(s.id)){const fill=t=>String(t||'').replace(/\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g,(_,k)=>String(values[k]||'').trim()||'{{'+k+'}}');out[s.id]={subject:fill(s.subject),message:fill(s.body)};}return {style:row.style,sourceId:row.id,sourceRevision:row.revision||0,sourcePatternVersion:patternVersion,origin:'core',stage:'initial',values:{...values},stages:out,checks:{}};}
function fingerprint(c){return JSON.stringify([c.workspaceId||'',c.userId||'',c.companyId||'',c.contactId||'',c.evidenceKey||'',c.values||{}]);}
function copyErrors(record,stage,checks=record.checks||{},now=new Date()){
 const d=record.stages?.[stage],errors=[];if(!d?.message?.trim())return ['Prepare or write this stage first.'];
 if(record.origin==='core'&&String(record.sourceId||'').startsWith('linkedin-inmail:')&&record.sourcePatternVersion!==patternVersion)errors.push('Apply facts to sequence using the updated mandatory script before copying.');
 if(/\{\{|\}\}|\[(?:Reference:|Calendly|on-time record|EN 1090|Baltic rates|insert)[^\]]*\]/i.test((d.subject||'')+' '+d.message))errors.push('Complete the missing or unfilled facts before copying.');
 if(d.message.length>12000||(d.subject||'').length>500)errors.push('This working step exceeds the editor limit. Shorten eligible facts or edit the working copy.');
 if(stage==='initial'&&(!d.subject?.trim()||/[\r\n]|https?:|^Subject:/i.test(d.subject)))errors.push('Write a separate, one-line InMail subject.');
 if(stage!=='initial'&&d.subject)errors.push('Only the initial InMail has a subject.');
 for(const [key,label] of [['reviewedProfile','Confirm you read the recipient profile.'],['reviewedFacts','Review the facts, references and claims.'],['reviewedWords','Read every word of this stage.']])if(!checks[key])errors.push(label);
 if(/my AI|AI research tool|AI did the research/i.test(d.message)&&!checks.aiResearchDrafted)errors.push('Confirm AI actually performed the stated research and drafting.');
 if(/all me|all the words are mine/i.test(d.message)&&!checks.authoredByMe)errors.push('Confirm the follow-up is genuinely your own wording, or edit that claim.');
 if(stage==='connection'){
  if(!checks.initialSent||!checks.noReply||!checks.correctTiming)errors.push('Confirm the initial InMail was sent, no reply arrived, and the timing/wording still fits.');
  const sent=Date.parse(checks.sentAt||'');if(!Number.isFinite(sent)||sent>now.getTime()-4*86400000)errors.push('Enter the real initial send date; the connection request is for day 4–5 or later after review.');
 }
 if(stage==='followup'&&!checks.accepted)errors.push('Confirm the connection was accepted.');
 if(stage==='calendar'){
  if(!checks.interested)errors.push('Confirm the recipient expressed interest before sharing your calendar.');
  try{const u=new URL(record.values?.calendly||'');if(u.protocol!=='https:'||u.username||u.password||!d.message.includes(String(record.values.calendly).trim()))throw Error();}catch{errors.push('Add your valid HTTPS booking URL to the interest reply.');}
 }else if(record.values?.calendly&&d.message.includes(record.values.calendly))errors.push('Keep the booking link for the reply after interest.');
 return errors;
}
const api={stages,fields,slots,prepare,fingerprint,copyErrors};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelInMailEngine=api;
})(typeof window==='object'?window:globalThis);
