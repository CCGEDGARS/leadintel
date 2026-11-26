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

// How the lookup settled on an entity; read by the management lookup, which needs a stricter match than facts do.
const SETTLED_BY=new WeakMap();
const settle=(entity,now,basis)=>{const result=facts(entity,now);SETTLED_BY.set(result,basis);return result;};
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
 if(byNumber.length===1)return settle(byNumber[0],now,'number');
 const wanted=comparable(company);
 if(byNumber.length>1){
  const named=byNumber.filter(entity=>comparable(entity.name)===wanted);
  return named.length===1?settle(named[0],now,'number'):outcome('ambiguous');
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
 if(sameName.length===1)return settle(sameName[0],now,'name');
 if(sameName.length>1){
  const located=sameName.filter(onDomain);
  if(located.length===1)return settle(located[0],now,'name+domain');
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

// Registered executive management (CVR "direktion") of the company the facts lookup settled on. The name
// search returns the list empty, so the single-company record is read. Only natural persons with a known
// role, and only name, role and start date: the register also publishes directors' addresses, which are
// not taken. A group member standing in for a group name is not the company, so it reports nobody.
//
// Naming a person needs a stricter match than company facts. The entity must have been settled by a number
// printed on the company's own pages, by the one active entity with the same legal name, or by that name plus
// the company's domain; its legal name must equal the company name (a printed number can belong to a web
// agency or a parent, a shared domain to a holding company); and a registered website on another domain
// with no e-mail on the company's domain contradicts the match. Anything else is "ambiguous": nobody.
// A company under the register's advertising protection is "protected": nobody either.
const DK_MANAGEMENT_ROLES=new Map([['DIREKTØR','Direktør'],['ADM. DIR.','Administrerende direktør']]);
const NOT_A_PERSON=/(?:^|\s)(?:aps|a\/s|i\/s|k\/s|p\/s|ivs|holding|fonden|fond|boet|ukendt)(?:\s|$)|[\d|#\[\]()<>]/i;
export async function lookupCompanyManagement(input={},{fetch=globalThis.fetch,signal,now=Date.now(),baseUrl=DK_BASE}={}){
 const found=await lookupCompanyFacts(input,{fetch,signal,now,baseUrl});
 if(found.status!=='found')return {status:found.status};
 if(found.group||!['number','name','name+domain'].includes(SETTLED_BY.get(found)))return {status:'ambiguous'};
 if(signal?.aborted)throw signal.reason;
 let record;
 try{
  const timeout=AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const response=await fetch(baseUrl+'/'+found.id,{headers:{Accept:'application/json','User-Agent':'LeadIntel company facts'},signal:signal?AbortSignal.any([signal,timeout]):timeout});
  if(!response.ok)return {status:'unavailable'};
  record=await response.json();
 }catch(cause){if(signal?.aborted)throw signal.reason;return {status:'unavailable'};}
 if(!record||String(record.vat)!==found.id)return {status:'unavailable'};
 const domain=host(input.website),registered=host(record.website);
 if(!comparable(input.company)||comparable(record.name)!==comparable(input.company)||domain&&registered&&registered!==domain&&emailHost(record.email)!==domain)return {status:'ambiguous'};
 // Advertising protection ("reklamebeskyttelse"): the register's data on such a company "ikke må benyttes af
 // private juridiske enheder med henblik på direkte markedsføring". Buyers research exists for outreach, so
 // the register names nobody for a protected company; how the rule applies to a given product is a legal
 // question that code must not settle the permissive way.
 if(record.protected===true)return {status:'protected'};
 const management=(Array.isArray(record.direktion)?record.direktion:[]).slice(0,20)
  .filter(person=>person&&person.type==='PERSON'&&typeof person.name==='string'&&person.name.trim()&&!NOT_A_PERSON.test(person.name.trim().replace(/\s+/g,' ')))
  .map(person=>({name:person.name.trim().replace(/\s+/g,' '),role:DK_MANAGEMENT_ROLES.get(String(person.role??'').trim().toUpperCase())||'',since:/^\d{4}-\d{2}-\d{2}$/.test(person.startdate||'')?person.startdate:''}))
  .filter(person=>person.role).slice(0,8);
 // The company's own registered city (never a director's address) lets a public people search tell a short or
 // common company name from namesakes elsewhere.
 const city=String(record.city??record.cityname??'').trim().replace(/\s+/g,' ').slice(0,80);
 return {status:'found',registry:found.registry,country:found.country,id:found.id,name:found.name,active:found.active,management,source:found.source,...(city?{city}:{})};
}

// The register answer as the read source the Buyers engine understands (its register path reads
// "role | name" lines under the company heading). Register text is data: characters that carry meaning in
// that format are removed. The second heading keeps a company name such as "Transformer Service" from being
// read by the engine as a "former" section.
export function registerManagementPage(company,answer={}){
 const cell=(value,limit)=>String(value??'').replace(/[|#\[\]()<>\r\n]+/g,' ').replace(/\s+/g,' ').trim().slice(0,limit);
 const people=(Array.isArray(answer.management)?answer.management:[]).map(person=>({name:cell(person?.name,120),role:cell(person?.role,60),since:/^\d{4}-\d{2}-\d{2}$/.test(person?.since||'')?person.since:''})).filter(person=>person.name&&person.role).slice(0,8);
 return {people:people.length,markdown:['# '+cell(company,180),'','Business register: '+cell(answer.source?.name||answer.registry||'register',120)+', registration '+cell(answer.id,40)+(answer.name?' · '+cell(answer.name,180):''),'','## Registered management','',...people.map(person=>person.role+' | '+person.name+(person.since?' (since '+person.since+')':''))].join('\n')};
}
