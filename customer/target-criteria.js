(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelTargetCriteria=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Structured target-customer rules checked against business-register facts.
 // A rule excludes a company only on a known mismatch. Missing or unavailable
 // facts stay "unknown": they never exclude and never confirm.
 const MAX_INDUSTRIES=40;
 // Two-digit divisions of the European NACE classification, on which the national
 // register codes are built. Titles follow NACE Rev. 2; a few service divisions
 // were regrouped in Rev. 2.1, the mining, manufacturing, energy and construction
 // divisions were not.
 const DIVISIONS='01 Crop and animal production|02 Forestry and logging|03 Fishing and aquaculture|05 Mining of coal and lignite|06 Extraction of crude petroleum and natural gas|07 Mining of metal ores|08 Other mining and quarrying|09 Mining support services|10 Food products|11 Beverages|12 Tobacco products|13 Textiles|14 Wearing apparel|15 Leather and related products|16 Wood and wood products|17 Paper and paper products|18 Printing and recorded media|19 Coke and refined petroleum products|20 Chemicals and chemical products|21 Pharmaceuticals|22 Rubber and plastic products|23 Other non-metallic mineral products (glass, cement, concrete)|24 Basic metals|25 Fabricated metal products|26 Computer, electronic and optical products|27 Electrical equipment|28 Machinery and equipment|29 Motor vehicles and trailers|30 Other transport equipment|31 Furniture|32 Other manufacturing|33 Repair and installation of machinery and equipment|35 Electricity, gas and steam supply|36 Water collection, treatment and supply|37 Sewerage|38 Waste collection, treatment and recovery|39 Remediation and other waste management|41 Construction of buildings|42 Civil engineering|43 Specialised construction activities|45 Trade and repair of motor vehicles|46 Wholesale trade|47 Retail trade|49 Land transport and pipelines|50 Water transport|51 Air transport|52 Warehousing and transport support|53 Postal and courier activities|55 Accommodation|56 Food and beverage service|58 Publishing|59 Film, video, television and sound production|60 Programming and broadcasting|61 Telecommunications|62 Computer programming and consultancy|63 Information services|64 Financial services|65 Insurance and pension funding|66 Activities auxiliary to finance and insurance|68 Real estate|69 Legal and accounting|70 Head offices and management consultancy|71 Architecture, engineering and technical testing|72 Scientific research and development|73 Advertising and market research|74 Other professional, scientific and technical activities|75 Veterinary activities|77 Rental and leasing|78 Employment activities|79 Travel agencies and tour operators|80 Security and investigation|81 Services to buildings and landscape|82 Office administration and business support|84 Public administration and defence|85 Education|86 Human health|87 Residential care|88 Social work|90 Creative, arts and entertainment|91 Libraries, archives and museums|92 Gambling and betting|93 Sports, amusement and recreation|94 Membership organisations|95 Repair of computers and household goods|96 Other personal services'.split('|').map(entry=>({code:entry.slice(0,2),label:entry.slice(3)}));
 // Holding companies and head offices carry a legal-entity code that says
 // nothing about the group's operations.
 const NON_OPERATING=/^(?:642|701)/;
 const fail=message=>{throw Object.assign(Error(message),{status:400});};
 const present=value=>value!==undefined&&value!==null&&value!=='';
 const number=value=>Number(value).toLocaleString('en-US');

 function whole(value,label,max){
  if(!present(value))return null;
  const n=Number(value);
  if(!Number.isInteger(n)||n<0||n>max)fail(label+' must be a whole number.');
  return n;
 }

 function normalize(raw){
  if(!raw||typeof raw!=='object')return null;
  const e=raw.employees||{},r=raw.revenue||{};
  const employees={min:whole(e.min,'Employee minimum',10000000),max:whole(e.max,'Employee maximum',10000000)};
  if(employees.min!==null&&employees.max!==null&&employees.min>employees.max)fail('Employee minimum cannot exceed the maximum.');
  const revenue={min:whole(r.min,'Revenue minimum',1e13),idealMin:whole(r.idealMin,'Ideal revenue minimum',1e13),idealMax:whole(r.idealMax,'Ideal revenue maximum',1e13),currency:present(r.currency)?String(r.currency).trim().toUpperCase():'EUR'};
  if(!/^[A-Z]{3}$/.test(revenue.currency))fail('Revenue currency must be a three-letter code.');
  if(revenue.idealMin!==null&&revenue.idealMax!==null&&revenue.idealMin>revenue.idealMax)fail('Ideal revenue minimum cannot exceed the maximum.');
  if(revenue.min!==null&&revenue.idealMin!==null&&revenue.idealMin<revenue.min)fail('Ideal revenue cannot start below the revenue minimum.');
  if(present(raw.industries)&&!Array.isArray(raw.industries))fail('Industries must be a list of two-digit divisions.');
  const industries=[...new Set((raw.industries||[]).map(code=>String(code??'').trim()))].sort();
  if(industries.some(code=>!/^\d{2}$/.test(code)))fail('Each industry must be a two-digit division code.');
  if(industries.length>MAX_INDUSTRIES)fail('Select at most '+MAX_INDUSTRIES+' industry divisions.');
  const hasEmployees=employees.min!==null||employees.max!==null;
  const hasRevenue=revenue.min!==null||revenue.idealMin!==null||revenue.idealMax!==null;
  if(!hasEmployees&&!hasRevenue&&!industries.length&&raw.registryOnly!==true&&!raw.collectSizeEvidence)return null;
  return {version:1,...(raw.collectSizeEvidence?{collectSizeEvidence:true}:{}),employees:hasEmployees?employees:null,revenue:hasRevenue?revenue:null,industries,registryOnly:raw.registryOnly!==false};
 }

 const industryCode=code=>{const digits=String(code||'').replace(/\D/g,'');return digits.length>=4?digits.slice(0,2)+'.'+digits.slice(2,4):digits;};

 function registryCheck(criteria,facts){
  const register=facts?.registry?facts.registry+' register':'business register';
  if(facts?.status==='found'){
   const identity=[facts.name,facts.id&&'('+(facts.registry||'register')+' '+facts.id+')',facts.city].filter(Boolean).join(' ');
   if(facts.active===false)return {key:'registry',status:'mismatch',detail:'Registered as '+(facts.statusLabel||'inactive')+': '+identity};
   // A group name has no legal entity of its own; the largest member stands for it.
   return {key:'registry',status:'match',detail:(facts.group?'Registered group ('+facts.group.members+' entities), largest: ':'Registered: ')+identity};
  }
  if(facts?.status==='not_found')return {key:'registry',status:criteria.registryOnly?'mismatch':'unknown',detail:'Not found in the '+register};
  if(facts?.status==='ambiguous')return {key:'registry',status:'unknown',detail:'Several entities in the '+register+' match this company'};
  if(facts?.status==='unavailable')return {key:'registry',status:'unknown',detail:'The business register could not be checked'};
  return {key:'registry',status:'unknown',detail:'No business register is connected for this market'};
 }

 function industryCheck(criteria,facts){
  const code=String(facts?.industry?.code||'').replace(/\D/g,'');
  if(!code)return {key:'industry',status:'unknown',detail:'Industry not stated in the register'};
  const label=[industryCode(code),facts.industry.label].filter(Boolean).join(' ');
  if(criteria.industries.includes(code.slice(0,2)))return {key:'industry',status:'match',detail:label};
  if(NON_OPERATING.test(code))return {key:'industry',status:'unknown',detail:label+' (holding or head-office code; operations not stated)'};
  return {key:'industry',status:'mismatch',detail:label+' is outside the selected industries'};
 }

 function employeesCheck(facts){
  const e=facts?.employees||{};
  const count=present(e.count)?number(e.count):null;
  const band=present(e.min)?number(e.min)+(present(e.max)?'–'+number(e.max):'+'):null;
  const value=count||band;
  return {key:'employees',status:value?'reported':'unknown',detail:value?value+' employees'+(facts.group?' (largest registered member)':''):'Headcount unavailable'};
 }

 function revenueCheck(r){
  const available=present(r?.amount)&&Number.isFinite(Number(r.amount))&&r.currency;
  return {key:'revenue',status:available?'reported':'unknown',detail:available?number(r.amount)+' '+r.currency+(r.year?' ('+r.year+')':''):'Annual turnover unavailable'};
 }

 // A register code describes the legal entity and can differ from what the
 // business does. A quoted statement on the company's own website of an activity
 // in a selected division confirms the industry. It can rescue a register-code
 // mismatch; evidence of any other activity changes nothing and never excludes.
 function industryEvidence(criteria,value){
  const division=String(value?.division??'').trim(),url=String(value?.url??'').trim(),quote=String(value?.quote??'').replace(/\s+/g,' ').trim();
  return /^\d{2}$/.test(division)&&url&&quote&&criteria.industries.includes(division)?{division,url,quote}:null;
 }

 function evaluate(criteria,facts,options={}){
  if(!criteria)return {decision:'pass',checks:[],excludedBy:[]};
  const known=facts?.status==='found';
  const pending=(key,detail)=>({key,status:'unknown',detail});
  const checks=[registryCheck(criteria,facts)];
  if(criteria.industries.length){
   const registered=known?industryCheck(criteria,facts):pending('industry','Industry not checked without a register entry');
   const stated=registered.status==='match'?null:industryEvidence(criteria,options.industryEvidence);
   const code=known?String(facts.industry?.code||'').replace(/\D/g,''):'';
   checks.push(stated?{key:'industry',status:'match',detail:(code?'Register code '+[industryCode(code),facts.industry.label].filter(Boolean).join(' ')+'; ':'')+'the company website states an activity in division '+stated.division+': “'+stated.quote+'”',evidence:{url:stated.url,quote:stated.quote}}:registered);
  }
  checks.push(employeesCheck(known?facts:null),revenueCheck((known?facts.revenue:null)||options.disclosure));
  const excludedBy=checks.filter(c=>c.status==='mismatch').map(c=>c.key);
  return {decision:excludedBy.length?'exclude':'pass',checks,excludedBy};
 }

 function describe(criteria){
  if(!criteria)return '';
  const parts=[criteria.registryOnly?'Only companies found in the business register':'Business register checked when available'];
  parts.push('Headcount and annual turnover are recorded as evidence when available');
  if(criteria.industries.length)parts.push('industry divisions '+criteria.industries.join(', '));
  return parts.join(' · ');
 }

 return {MAX_INDUSTRIES,DIVISIONS,normalize,evaluate,describe};
});
