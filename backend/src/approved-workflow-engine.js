import '../../customer/company-brain.js';
import '../../customer/targeting-policy.js';
import '../../customer/reference-customers.js';
import '../../customer/reference-customer-portfolio.js';
import {sha256} from './security.js';
export const WORKFLOW_STAGES=['profile','strategy','companies','buyers','triggers','messages','crm','delivery'];
const text=(v,max=4000)=>String(v??'').trim().slice(0,max);
const list=v=>(Array.isArray(v)?v:String(v||'').split(/[,;\n]/)).map(x=>text(x,180)).filter(Boolean).slice(0,20);
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
export const fingerprint=value=>sha256(JSON.stringify(canonical(value)));
export function approvedContext(main={}){
  const market=main.market||{},confirmed=globalThis.LeadIntelTargeting?.profileFields?.(main)||{};
  const lookalike=market.icps?.find(item=>item.type==='lookalike'||item.type==='lookalike-led'||item.id==='icp-lookalike'||item.id==='icp-reference-lookalike');
  const referenceSimilarityModel=lookalike?.active===false?null:globalThis.LeadIntelReferenceCustomerPortfolio?.getCombinedActiveModel?.(main)||globalThis.LeadIntelReferenceCustomers?.getActiveReferenceModel?.(main.referenceCustomers||{})||null;
  const referenceDomains=[...(main.referenceCustomers?.rows||[]),...(referenceSimilarityModel?.activeRows||[]),...(referenceSimilarityModel?.models||[]).flatMap(model=>model.activeRows||[])].map(item=>globalThis.LeadIntelReferenceCustomers.domain(item.website||item.domain)).filter(Boolean);
  const profile={...(main.profile||{}),...Object.fromEntries(Object.entries(confirmed).filter(([,value])=>value)),referenceSimilarityModel,referenceDomains};
  if(main.targetMarkets?.length)profile.targetMarkets=main.targetMarkets.join('; ');
  const referenceTraits=(referenceSimilarityModel?.dna?.referenceProfiles||[]).flatMap(ref=>ref.dimensions||[]).filter(d=>['industry','broadIndustry','productionModel','capabilities'].includes(d.key)).flatMap(d=>d.values||[]);

  return {website:main.website||'',answers:main.answers||{},profile,profileApproved:main.approved===true,strategyApproved:market.strategyApproved===true,
    icps:market.icps||[],signals:market.signals||[],researchSourceTypes:market.researchSourceTypes||[],researchCustomSources:market.researchCustomSources||[],researchInstructions:market.researchInstructions||'',knownEvidence:(market.researchResults||[]).slice(0,20).map(item=>({url:item.url||item.link||'',title:item.title||'',description:item.description||'',text:String(item.text||item.markdown||'').slice(0,4000),date:item.date||item.publishedDate||'',market:item.market||''}))};
}
export function normalizeWorkflowConfig(input={}){
  const integer=(v,d,min,max)=>{const n=v===undefined?d:Number(v);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`Choose a whole number from ${min} to ${max}`);return n;};
  const priority=input.companies?.researchPriority||'balanced';if(!['lookalike','signals','balanced'].includes(priority))throw new Error('Choose Lookalike, Signals or Balanced');
  const minimum=Number(input.qualificationVersion)>=2?Number(input.triggers?.minimumScore??80):[70,80,90].includes(Number(input.triggers?.minimumScore))?Number(input.triggers.minimumScore):80;if(![70,80,90].includes(minimum))throw new Error('Choose a minimum qualification score of 70, 80 or 90');
  const config={qualificationVersion:3,companies:{researchPriority:priority,limit:integer(input.companies?.limit,3,1,10),queries:integer(input.companies?.queries,4,1,8)},
    buyers:{roles:list(input.buyers?.roles),confirmContacts:input.buyers?.confirmContacts===true,enrich:input.buyers?.confirmContacts===true},triggers:{minimumScore:minimum,maxEvidenceAgeDays:integer(input.triggers?.maxEvidenceAgeDays,90,1,365)},
    messages:{subject:text(input.messages?.subject,500),body:text(input.messages?.body,12000),followup:text(input.messages?.followup,6000)},
    crm:{saveQualified:true},delivery:{verifyEmails:true,dailyLimit:integer(input.delivery?.dailyLimit,5,1,50),frequency:input.delivery?.frequency==='weekly'?'weekly':'daily',timezone:text(input.delivery?.timezone||'UTC',80),sendWindowStart:text(input.delivery?.sendWindowStart||'09:00',5),sendWindowEnd:text(input.delivery?.sendWindowEnd||'17:00',5),workingDays:[1,2,3,4,5],maxFollowups:input.messages?.followup?1:0}};
  try{new Intl.DateTimeFormat('en',{timeZone:config.delivery.timezone});}catch{throw new Error('Choose a valid timezone');}
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.delivery.sendWindowStart)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(config.delivery.sendWindowEnd)||config.delivery.sendWindowStart>=config.delivery.sendWindowEnd)throw new Error('Choose a sending window with end after start');
  const allowed=new Set(['firstName','company','sender','offer','evidenceUrl']);
  for(const value of Object.values(config.messages))for(const match of value.matchAll(/\{\{([^}]+)\}\}/g))if(!allowed.has(match[1]))throw new Error(`Unknown message placeholder: ${match[1]}`);
  return config;
}
export function stageSnapshot(stage,context,config){
  const index=WORKFLOW_STAGES.indexOf(stage);if(index<0)throw new Error('Unknown workflow stage');
  return {stage,context,...(index>=2?{qualification:{version:config.qualificationVersion,priority:config.companies.researchPriority,...config.triggers}}:{}),settings:Object.fromEntries(WORKFLOW_STAGES.slice(0,index+1).filter(k=>config[k]).map(k=>[k,config[k]]))};
}
export async function approvalStatus(context,config,approvals={}){
  const stages=[];for(const stage of WORKFLOW_STAGES){const hash=await fingerprint(stageSnapshot(stage,context,config));stages.push({stage,approved:approvals[stage]?.hash===hash,hash,approvedAt:approvals[stage]?.at||null});}return stages;
}
export function setupBlockers(context,config){
  const gaps=[];if(!context.profileApproved)gaps.push('Approve the company profile');if(!context.strategyApproved)gaps.push('Approve the market strategy');
  if(!text(context.profile?.companyName)||!text(context.profile?.priorityOffers)||!text(context.profile?.targetMarkets))gaps.push('Complete company name, priority offer and target markets');
  if(config.companies.researchPriority!=='lookalike'&&!context.signals.some(x=>x.active===true))gaps.push('Activate at least one buying signal');
  if(config.companies.researchPriority==='lookalike'&&!context.profile?.referenceSimilarityModel)gaps.push('Activate an evidence-backed reference customer model for Lookalike');
  if(!config.buyers.roles.length)gaps.push('Choose buyer roles');if(!config.buyers.confirmContacts)gaps.push('Approve automatic email and phone confirmation for the automatic workflow');
  const brain=globalThis.LeadIntelCompanyBrain;
  const conflicts=brain?.strategyConflicts?.(context.profile,context.signals)||[];
  if(conflicts.length)gaps.push('Resolve conflicting strategy exclusions and signals');
  if((brain?.unrelatedSignals?.(context.profile,context.signals)||[]).length)gaps.push('Review signals that do not match the approved offer');
  if((brain?.unrelatedBuyerRoles?.(context.profile,context.icps)||[]).length)gaps.push('Review buyer roles that do not match the approved customer profile');
  if(!config.messages.subject||!config.messages.body)gaps.push('Write and review the email template');
  return gaps;
}
export function renderWorkflowMessage(template,values){
  return template.replace(/\{\{(firstName|company|sender|offer|evidenceUrl)\}\}/g,(_,key)=>{const value=text(values[key],2000);if(!value)throw new Error(`Missing message value: ${key}`);return value;});
}
export function freshEvidence(candidate,days,now=new Date()){
  return (candidate.evidence||[]).filter(item=>{const date=new Date(item.date);const age=now-date;return Number.isFinite(date.getTime())&&age>=0&&age<=days*86400000&&/^https?:\/\//.test(item.url||'');});
}
