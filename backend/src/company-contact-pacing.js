// Pure, timezone-independent decisions for company-level first-contact pacing.
// The queue must additionally enforce these decisions transactionally in D1.
export const DEFAULT_COMPANY_PACING=Object.freeze({maxContacts:3,minDaysBetweenInitial:5});
export function companyPacingDecision({contactsSent=0,lastInitialSentAt=null,now=new Date(),policy=DEFAULT_COMPANY_PACING}={}){
  const max=Number(policy.maxContacts),days=Number(policy.minDaysBetweenInitial);
  if(!Number.isInteger(max)||max<1||max>20||!Number.isInteger(days)||days<1||days>90)throw new RangeError('Invalid company pacing policy');
  const at=now instanceof Date?now:new Date(now);
  if(!Number.isFinite(at.getTime()))throw new TypeError('Invalid current timestamp');
  if(!Number.isInteger(contactsSent)||contactsSent<0)throw new RangeError('Invalid company contact count');
  if(contactsSent>=max)return {allowed:false,code:'COMPANY_CONTACT_CAP',nextEligibleAt:null};
  if(contactsSent===0)return {allowed:true,code:'ELIGIBLE',nextEligibleAt:at.toISOString()};
  if(!lastInitialSentAt)return {allowed:false,code:'COMPANY_CONTACT_HISTORY_INCOMPLETE',nextEligibleAt:null};
  const last=new Date(lastInitialSentAt);
  if(!Number.isFinite(last.getTime()))return {allowed:false,code:'COMPANY_CONTACT_HISTORY_INCOMPLETE',nextEligibleAt:null};
  const next=new Date(last.getTime()+days*86400000);
  return next>at?{allowed:false,code:'COMPANY_COOLDOWN',nextEligibleAt:next.toISOString()}:{allowed:true,code:'ELIGIBLE',nextEligibleAt:at.toISOString()};
}
