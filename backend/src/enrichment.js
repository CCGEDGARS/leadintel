const personalDomains=new Set(["gmail.com","googlemail.com","yahoo.com","hotmail.com","outlook.com","live.com","icloud.com","me.com","proton.me","protonmail.com","inbox.lv"]);
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const APOLLO_PEOPLE_SEARCH_URL="https://api.apollo.io/api/v1/mixed_people/api_search";
export const APOLLO_PEOPLE_MATCH_URL="https://api.apollo.io/api/v1/people/match";

export function normalizeDomain(value){
  const raw=String(value||"").trim().toLowerCase();
  if(!raw)return "";
  try{return new URL(raw.includes("://")?raw:`https://${raw}`).hostname.replace(/^www\./,"");}catch{return "";}
}

export function provenBusinessEmail(person,companyDomain){
  const email=String(person?.email||"").trim().toLowerCase();
  const domain=normalizeDomain(companyDomain);const emailDomain=email.split("@")[1]||"";
  if(!emailPattern.test(email)||!/^verified$/i.test(String(person?.email_status||"")))return "";
  if(personalDomains.has(emailDomain)||!domain)return "";
  return emailDomain===domain||emailDomain.endsWith(`.${domain}`)?email:"";
}

function roleTokens(value){
  return new Set(String(value||"").toLowerCase().split(/[^a-z0-9ā-ž]+/).filter(token=>token.length>=3&&!new Set(["the","and","for"]).has(token)));
}

export function strongPersonalEmail(person,companyDomain,expectedRole,expectedPersonId){
  const personId=String(person?.id||person?.person_id||"");
  if(!personId||personId!==String(expectedPersonId||""))return "";
  const organization=person?.organization||{};
  const organizationDomain=normalizeDomain(organization.primary_domain||organization.domain||organization.website_url);
  const expectedDomain=normalizeDomain(companyDomain);
  if(!organizationDomain||organizationDomain!==expectedDomain)return "";
  const expected=roleTokens(expectedRole);const actual=roleTokens(person?.title);
  if(expected.size&&![...expected].some(token=>actual.has(token)))return "";
  const personal=Array.isArray(person?.personal_emails)?person.personal_emails:[];
  for(const item of personal){
    const email=String(typeof item==="string"?item:item?.email||item?.value||"").trim().toLowerCase();
    const status=String(typeof item==="string"?"":item?.email_status||item?.status||"");
    const emailDomain=email.split("@")[1]||"";
    if(emailPattern.test(email)&&emailDomain!==expectedDomain&&(!status||/^verified$/i.test(status)))return email;
  }
  return "";
}

export function enrichmentDecision({score,evidenceCount,verifiedContact,domain,recentRequest,dailyReserved=0,monthlyReserved=0,policy}){
  if(verifiedContact)return {allowed:false,reason:"verified_contact_exists"};
  if(Number(score)<policy.minimum_score)return {allowed:false,reason:"score_below_threshold"};
  if(Number(evidenceCount)<1)return {allowed:false,reason:"evidence_required"};
  if(!normalizeDomain(domain))return {allowed:false,reason:"company_domain_required"};
  if(recentRequest)return {allowed:false,reason:"recent_lookup_exists"};
  if(Number(dailyReserved)>=policy.daily_credit_limit)return {allowed:false,reason:"daily_credit_limit"};
  if(Number(monthlyReserved)>=policy.monthly_credit_limit)return {allowed:false,reason:"monthly_credit_limit"};
  return {allowed:true,reason:"eligible",creditsReserved:1};
}

function cleanRoles(values){
  const source=Array.isArray(values)?values:[];const seen=new Set();const roles=[];
  for(const value of source){const role=String(value||"").replace(/\s+/g," ").trim();const key=role.toLowerCase();if(!role||seen.has(key))continue;seen.add(key);roles.push(role);if(roles.length===4)break;}
  return roles;
}

export function apolloSearchBody({domain,role,roles}={}){
  const normalized=normalizeDomain(domain);
  const requested=cleanRoles(roles);
  if(requested.length){
    return {q_organization_domains_list:normalized?[normalized]:[],person_titles:requested,include_similar_titles:true,person_seniorities:["owner","founder","c_suite","partner","vp","head","director","manager"],page:1,per_page:10};
  }
  return {q_organization_domains_list:normalized?[normalized]:[],person_titles:[String(role||"Commercial Director").trim()],page:1,per_page:1};
}

function safeWebhook(value){
  try{const url=new URL(String(value||""));return url.protocol==="https:"?url.toString():"";}catch{return "";}
}

export function buildApolloMatchUrl({personId,personalEmail=false,phoneLookup=false,waterfallEmail=false,waterfallPhone=false,webhookUrl=""}={}){
  const id=String(personId||"").trim();if(!id)throw new Error("Apollo person ID is required");
  const asyncRequested=Boolean(phoneLookup||waterfallEmail||waterfallPhone);const webhook=safeWebhook(webhookUrl);
  if(asyncRequested&&!webhook)throw new Error("A valid HTTPS webhook URL is required for Apollo phone or waterfall enrichment");
  const url=new URL(APOLLO_PEOPLE_MATCH_URL);
  url.searchParams.set("id",id);
  url.searchParams.set("reveal_personal_emails",personalEmail?"true":"false");
  url.searchParams.set("reveal_phone_number",phoneLookup?"true":"false");
  url.searchParams.set("run_waterfall_email",waterfallEmail?"true":"false");
  url.searchParams.set("run_waterfall_phone",waterfallPhone?"true":"false");
  if(asyncRequested)url.searchParams.set("webhook_url",webhook);
  return url.toString();
}

export function publicPersonSummary(person={}){
  return {id:String(person.id||person.person_id||""),name:String(person.name||[person.first_name,person.last_name].filter(Boolean).join(" ")),title:String(person.title||""),linkedin_url:String(person.linkedin_url||""),email_status:String(person.email_status||""),has_business_email:Boolean(person.email),has_personal_email:Array.isArray(person.personal_emails)&&person.personal_emails.length>0};
}
