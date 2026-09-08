const DEFAULT_POLICY=Object.freeze({
  mode:'manual',enabled:false,paused:false,emergencyStop:false,
  workspaceDailyLimit:20,mailboxDailyLimit:20,workingDays:[1,2,3,4,5],timezone:'Europe/Riga',
  sendWindowStart:'09:00',sendWindowEnd:'16:30',minDelayMinutes:8,maxDelayMinutes:18,
  maxFollowups:2,followupDelaysDays:[3,7],replyPollIntervalMinutes:60
});
const WEEKDAY={Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6,Sun:7};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const HHMM=/^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function defaultAutomationPolicy(){return {...DEFAULT_POLICY,workingDays:[...DEFAULT_POLICY.workingDays],followupDelaysDays:[...DEFAULT_POLICY.followupDelaysDays]};}
function int(value,label,min,max){const n=Number(value);if(!Number.isInteger(n)||n<min||n>max)throw new Error(`${label} is invalid`);return n;}
function validTimeZone(value){try{new Intl.DateTimeFormat('en-US',{timeZone:value}).format(new Date());return true;}catch{return false;}}
function minutes(value){if(!HHMM.test(String(value||'')))return NaN;const [h,m]=String(value).split(':').map(Number);return h*60+m;}
function bool(value){return value===true||value===1||value==='1';}
function uniqueDays(value){if(!Array.isArray(value)||!value.length)throw new Error('Working days are invalid');const days=[...new Set(value.map(Number))].sort((a,b)=>a-b);if(days.some(v=>!Number.isInteger(v)||v<1||v>7))throw new Error('Working days are invalid');return days;}
function delays(value){if(!Array.isArray(value))throw new Error('Follow-up delays are invalid');const out=value.map(v=>int(v,'Follow-up delay',1,365));for(let i=1;i<out.length;i++)if(out[i]<=out[i-1])throw new Error('Follow-up delays must be increasing');return out;}

export function normalizeAutomationPolicy(input={},current=defaultAutomationPolicy()){
  const source={...defaultAutomationPolicy(),...(current||{}),...(input||{})};
  const mode=source.mode==='automatic'?'automatic':source.mode==='manual'?'manual':(()=>{throw new Error('Automation mode is invalid');})();
  const timezone=String(source.timezone||'').trim();if(!validTimeZone(timezone))throw new Error('Timezone is invalid');
  const sendWindowStart=String(source.sendWindowStart||'').trim(),sendWindowEnd=String(source.sendWindowEnd||'').trim();
  const start=minutes(sendWindowStart),end=minutes(sendWindowEnd);if(!Number.isFinite(start)||!Number.isFinite(end)||start>=end)throw new Error('Send window is invalid');
  const workspaceDailyLimit=int(source.workspaceDailyLimit,'Workspace daily limit',1,500);
  const mailboxDailyLimit=int(source.mailboxDailyLimit,'Mailbox daily limit',1,500);
  const minDelayMinutes=int(source.minDelayMinutes,'Minimum delay',1,1440);
  const maxDelayMinutes=int(source.maxDelayMinutes,'Maximum delay',1,1440);if(maxDelayMinutes<minDelayMinutes)throw new Error('Maximum delay must be greater than or equal to minimum delay');
  const maxFollowups=int(source.maxFollowups,'Maximum follow-ups',0,10);
  const followupDelaysDays=delays(source.followupDelaysDays);if(followupDelaysDays.length<maxFollowups)throw new Error('Follow-up delays must cover maximum follow-ups');
  const replyPollIntervalMinutes=int(source.replyPollIntervalMinutes,'Reply poll interval',60,1440);
  return {mode,enabled:bool(source.enabled),paused:bool(source.paused),emergencyStop:bool(source.emergencyStop),workspaceDailyLimit,mailboxDailyLimit,workingDays:uniqueDays(source.workingDays),timezone,sendWindowStart,sendWindowEnd,minDelayMinutes,maxDelayMinutes,maxFollowups,followupDelaysDays,replyPollIntervalMinutes};
}

export function localClockParts(now,timeZone){
  const date=now instanceof Date?now:new Date(now);if(!Number.isFinite(date.getTime()))throw new Error('Invalid date');if(!validTimeZone(timeZone))throw new Error('Timezone is invalid');
  const parts=new Intl.DateTimeFormat('en-GB',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23',weekday:'short'}).formatToParts(date);
  const map=Object.fromEntries(parts.map(p=>[p.type,p.value]));
  return {year:Number(map.year),month:Number(map.month),day:Number(map.day),hour:Number(map.hour),minute:Number(map.minute),weekday:WEEKDAY[map.weekday]||0};
}
export function isWithinSendWindow(policy,now=new Date()){
  let p;try{p=normalizeAutomationPolicy(policy,policy);}catch{return false;}
  const local=localClockParts(now,p.timezone);if(!p.workingDays.includes(local.weekday))return false;
  const value=local.hour*60+local.minute;return value>=minutes(p.sendWindowStart)&&value<minutes(p.sendWindowEnd);
}
export function nextEnabledWindow(policy,now=new Date()){
  const p=normalizeAutomationPolicy(policy,policy);const startDate=now instanceof Date?new Date(now):new Date(now);if(!Number.isFinite(startDate.getTime()))throw new Error('Invalid date');
  if(isWithinSendWindow(p,startDate))return startDate.toISOString();
  const cursor=new Date(startDate);cursor.setUTCSeconds(0,0);if(cursor<startDate)cursor.setUTCMinutes(cursor.getUTCMinutes()+1);
  const max=15*24*60;for(let i=0;i<max;i++){if(isWithinSendWindow(p,cursor))return cursor.toISOString();cursor.setUTCMinutes(cursor.getUTCMinutes()+1);}throw new Error('No enabled sending window found');
}
export function boundedDelayMinutes(policy,random=Math.random){
  const p=normalizeAutomationPolicy(policy,policy);let r=Number(random());if(!Number.isFinite(r))r=0;r=Math.max(0,Math.min(0.999999999999,r));return p.minDelayMinutes+Math.floor(r*(p.maxDelayMinutes-p.minDelayMinutes+1));
}
export function evaluateAutomaticSend(context={}){
  let p;try{p=normalizeAutomationPolicy(context.policy,context.policy);}catch{return {allowed:false,reason:'invalid_policy',nextEligibleAt:null};}
  const now=context.now instanceof Date?context.now:new Date(context.now||Date.now());if(!Number.isFinite(now.getTime()))return {allowed:false,reason:'invalid_time',nextEligibleAt:null};
  if(p.mode!=='automatic')return {allowed:false,reason:'manual_mode',nextEligibleAt:null};
  if(!p.enabled)return {allowed:false,reason:'disabled',nextEligibleAt:null};
  if(p.paused)return {allowed:false,reason:'paused',nextEligibleAt:null};
  if(p.emergencyStop)return {allowed:false,reason:'emergency_stop',nextEligibleAt:null};
  if(context.suppressed)return {allowed:false,reason:'suppressed',nextEligibleAt:null};
  if(!EMAIL.test(String(context.recipient||'').trim().toLowerCase()))return {allowed:false,reason:'invalid_recipient',nextEligibleAt:null};
  if(context.replyStopped)return {allowed:false,reason:'reply_stopped',nextEligibleAt:null};
  if((Number(context.workspaceSentToday)||0)>=p.workspaceDailyLimit)return {allowed:false,reason:'workspace_daily_limit',nextEligibleAt:nextEnabledWindow(p,new Date(now.getTime()+24*60*60*1000))};
  if((Number(context.mailboxSentToday)||0)>=p.mailboxDailyLimit)return {allowed:false,reason:'mailbox_daily_limit',nextEligibleAt:nextEnabledWindow(p,new Date(now.getTime()+24*60*60*1000))};
  const local=localClockParts(now,p.timezone);if(!p.workingDays.includes(local.weekday))return {allowed:false,reason:'disabled_weekday',nextEligibleAt:nextEnabledWindow(p,now)};
  if(!isWithinSendWindow(p,now))return {allowed:false,reason:'outside_window',nextEligibleAt:nextEnabledWindow(p,now)};
  if(context.lastAutomaticSentAt){const last=new Date(context.lastAutomaticSentAt);if(Number.isFinite(last.getTime())){const minAt=new Date(last.getTime()+p.minDelayMinutes*60000);if(now<minAt)return {allowed:false,reason:'minimum_spacing',nextEligibleAt:isWithinSendWindow(p,minAt)?minAt.toISOString():nextEnabledWindow(p,minAt)};}}
  return {allowed:true,reason:'eligible',nextEligibleAt:null};
}
