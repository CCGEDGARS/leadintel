// Business-register facts for a researched company: registration, status,
// industry code and employee count from the national register of the selected
// market. Facts feed LeadIntelTargetCriteria.evaluate; a register that cannot
// answer is reported as "unavailable" and never as "not found".
//
// Markets are added one adapter at a time. Denmark reads the Central Business
// Register (CVR) through a public JSON API; revenue is not part of CVR base data.

const MARKETS=new Map([['denmark','DK'],['danmark','DK'],['dk','DK']]);
const DK_BASE='https://apicvr.dk/api/v1';
const DK_LEGAL_FORM=/^(?:a\/s|aps|i\/s|k\/s|p\/s|ivs|a\.?m\.?b\.?a\.?|s\.?m\.?b\.?a\.?|f\.?m\.?b\.?a\.?)$/i;
const DK_NUMBER=/\bCVR(?:[\s.\-]*(?:nr|nummer|no|number))?[\s.:\-]*(?:DK[\s\-]?)?((?:\d\s?){8})(?!\d)/gi;
const MAX_PRINTED_NUMBERS=3; // plus one name search: at most four requests per company
const REQUEST_TIMEOUT_MS=8000;

export function registryMarket(market){return MARKETS.get(String(market??'').trim().toLowerCase())||'';}

const host=value=>String(value??'').trim().toLowerCase().replace(/^[a-z]+:\/\//,'').replace(/^www\./,'').split(/[/?#]/)[0];
const emailHost=value=>{const text=String(value??'').trim().toLowerCase(),at=text.lastIndexOf('@');return at>=0?text.slice(at+1):'';};
const withoutLegalForm=name=>String(name??'').split(/\s+/).filter(word=>word&&!DK_LEGAL_FORM.test(word)).join(' ');
const comparable=name=>withoutLegalForm(name).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const isActive=entity=>['NORMAL','AKTIV'].includes(String(entity.status??'').toUpperCase())&&!entity.enddate&&entity.bankrupt!==true;

function printedNumbers(pages,domain){
 const numbers=new Set();
 for(const page of pages||[]){
  const pageHost=host(page?.url);
  if(!domain||pageHost!==domain&&!pageHost.endsWith('.'+domain))continue;
  for(const match of String(page.text||'').matchAll(DK_NUMBER))numbers.add(match[1].replace(/\s/g,''));
 }
 return [...numbers];
}

function facts(entity,now){
 const id=String(entity.vat);
 return {status:'found',registry:'DK-CVR',country:'DK',id,name:String(entity.name||''),city:String(entity.city||''),active:isActive(entity),statusLabel:String(entity.status||''),
  industry:entity.industrycode?{code:String(entity.industrycode),label:String(entity.industrydesc||'')}:null,
  employees:Number.isFinite(entity.employees)?{count:entity.employees}:null,revenue:null,
  marketingProtected:typeof entity.protected==='boolean'?entity.protected:null,
  source:{name:'CVR (Danish Central Business Register) via apicvr.dk',url:DK_BASE+'/'+id,checkedAt:new Date(now).toISOString()}};
}

async function denmark({company,website,pages},{fetch,signal,now,baseUrl=DK_BASE}){
 const outcome=status=>({status,registry:'DK-CVR',country:'DK'});
 const unavailable=Symbol('unavailable');
 const get=async path=>{
  if(signal?.aborted)throw signal.reason;
  const timeout=AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  let response;
  try{response=await fetch(baseUrl+path,{headers:{Accept:'application/json','User-Agent':'LeadIntel company facts'},signal:signal?AbortSignal.any([signal,timeout]):timeout});}
  catch(cause){if(signal?.aborted)throw signal.reason;return unavailable;}
  if(response.status===404)return null;
  if(!response.ok)return unavailable;
  try{return await response.json();}catch{return unavailable;}
 };

 const domain=host(website);
 const byNumber=[];
 for(const number of printedNumbers(pages,domain).slice(0,MAX_PRINTED_NUMBERS)){
  const entity=await get('/'+number);
  if(entity===unavailable)return outcome('unavailable');
  if(entity&&entity.vat)byNumber.push(entity);
 }
 if(byNumber.length===1)return facts(byNumber[0],now);
 const wanted=comparable(company);
 if(byNumber.length>1){
  const named=byNumber.filter(entity=>comparable(entity.name)===wanted);
  return named.length===1?facts(named[0],now):outcome('ambiguous');
 }

 const term=withoutLegalForm(company).replace(/\//g,' ').replace(/\s+/g,' ').trim();
 if(!term||!wanted)return outcome('not_found');
 const found=await get('/search/company/'+encodeURIComponent(term));
 if(found===unavailable||found!==null&&!Array.isArray(found))return outcome('unavailable');
 const entities=(found||[]).filter(entity=>entity&&entity.vat);
 const active=entities.filter(isActive);
 // The legal name decides first. A shared e-mail domain alone is weak: staff
 // associations and subsidiaries register addresses on the parent's domain, so
 // it counts only for an entity that reports employees.
 const onDomain=entity=>Boolean(domain)&&(host(entity.website)===domain||Number.isFinite(entity.employees)&&emailHost(entity.email)===domain);
 const sameName=active.filter(entity=>comparable(entity.name)===wanted);
 if(sameName.length===1)return facts(sameName[0],now);
 if(sameName.length>1){
  const located=sameName.filter(onDomain);
  if(located.length===1)return facts(located[0],now);
  const staffed=sameName.filter(entity=>Number.isFinite(entity.employees));
  return staffed.length===1?facts(staffed[0],now):outcome('ambiguous');
 }
 const sameDomain=active.filter(onDomain);
 if(sameDomain.length===1)return facts(sameDomain[0],now);
 // A group or brand name has no legal entity of its own. Its staffed members
 // are named "<name> …"; the largest one is a lower bound of the group's size.
 const members=active.filter(entity=>Number.isFinite(entity.employees)&&comparable(entity.name).startsWith(wanted+' '));
 if(members.length){
  const largest=members.reduce((a,b)=>b.employees>a.employees?b:a);
  return {...facts(largest,now),employees:{min:largest.employees,max:null},group:{members:members.length,basis:'largest active entity whose legal name starts with the company name'}};
 }
 // "Not found" excludes a company in register-only mode, so it is reserved for
 // a register that holds no entity carrying the name. Group members, longer
 // legal names and closed predecessors leave the match open instead.
 const carriesName=entity=>(' '+comparable(entity.name)+' ').includes(' '+wanted+' ');
 return entities.some(carriesName)?outcome('ambiguous'):outcome('not_found');
}

export async function lookupCompanyFacts(input={},{fetch=globalThis.fetch,signal,now=Date.now(),baseUrl}={}){
 if(registryMarket(input.market)!=='DK')return {status:'unsupported'};
 return denmark(input,{fetch,signal,now,baseUrl});
}
