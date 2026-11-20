(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelTargetCriteria=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Structured target-customer rules checked against business-register facts.
 // A rule excludes a company only on a known mismatch. Missing or unavailable
 // facts stay "unknown": they never exclude and never confirm.
 const MAX_INDUSTRIES=40;
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
  if(!hasEmployees&&!hasRevenue&&!industries.length&&raw.registryOnly!==true)return null;
  return {version:1,employees:hasEmployees?employees:null,revenue:hasRevenue?revenue:null,industries,registryOnly:raw.registryOnly!==false};
 }

 const range=(min,max)=>min!==null&&max!==null?min+'–'+max:min!==null?'at least '+min:'at most '+max;
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

 function employeesCheck(criteria,facts){
  const wanted=criteria.employees,low=wanted.min??0,high=wanted.max??Infinity,e=facts?.employees||{};
  const count=present(e.count)&&Number.isFinite(Number(e.count))?Number(e.count):null;
  if(count!==null){
   const inside=count>=low&&count<=high;
   return {key:'employees',status:inside?'match':'mismatch',detail:number(count)+' employees ('+(inside?'within':'outside')+' '+range(wanted.min,wanted.max)+')'};
  }
  const from=present(e.min)&&Number.isFinite(Number(e.min))?Number(e.min):null,to=present(e.max)&&Number.isFinite(Number(e.max))?Number(e.max):null;
  if(from===null)return {key:'employees',status:'unknown',detail:'Employee count not stated in the register'};
  const band=to===null?number(from)+'+':number(from)+'–'+number(to),top=to??Infinity;
  if(top<low||from>high)return {key:'employees',status:'mismatch',detail:band+' employees (outside '+range(wanted.min,wanted.max)+')'};
  if(from>=low&&top<=high)return {key:'employees',status:'match',detail:band+' employees (within '+range(wanted.min,wanted.max)+')'};
  return {key:'employees',status:'unknown',detail:band+' employees (the register band overlaps '+range(wanted.min,wanted.max)+')'};
 }

 function revenueCheck(criteria,facts){
  const wanted=criteria.revenue,r=facts?.revenue;
  const amount=r&&present(r.amount)&&Number.isFinite(Number(r.amount))?Number(r.amount):null;
  if(amount===null)return {key:'revenue',status:'unknown',detail:'Revenue not published in the register'};
  const currency=String(r.currency||'').toUpperCase(),stated=number(amount)+' '+currency+(r.year?' ('+r.year+')':'');
  if(currency!==wanted.currency)return {key:'revenue',status:'unknown',detail:stated+'; published in '+currency+', not compared with the '+wanted.currency+' rule'};
  if(wanted.min!==null&&amount<wanted.min)return {key:'revenue',status:'mismatch',detail:stated+' is below the '+number(wanted.min)+' '+currency+' minimum'};
  const preferred=(wanted.idealMin!==null||wanted.idealMax!==null)&&amount>=(wanted.idealMin??0)&&amount<=(wanted.idealMax??Infinity);
  return {key:'revenue',status:'match',detail:stated+(preferred?', within the ideal range':'')};
 }

 function evaluate(criteria,facts){
  if(!criteria)return {decision:'pass',checks:[],excludedBy:[]};
  const known=facts?.status==='found';
  const pending=(key,detail)=>({key,status:'unknown',detail});
  const checks=[registryCheck(criteria,facts)];
  if(criteria.industries.length)checks.push(known?industryCheck(criteria,facts):pending('industry','Industry not checked without a register entry'));
  if(criteria.employees)checks.push(known?employeesCheck(criteria,facts):pending('employees','Employee count not checked without a register entry'));
  if(criteria.revenue)checks.push(known?revenueCheck(criteria,facts):pending('revenue','Revenue not checked without a register entry'));
  const excludedBy=checks.filter(c=>c.status==='mismatch').map(c=>c.key);
  return {decision:excludedBy.length?'exclude':'pass',checks,excludedBy};
 }

 function describe(criteria){
  if(!criteria)return '';
  const parts=[criteria.registryOnly?'Only companies found in the business register':'Business register checked when available'];
  if(criteria.employees)parts.push(range(criteria.employees.min,criteria.employees.max)+' employees');
  if(criteria.revenue){
   const r=criteria.revenue,ideal=r.idealMin!==null||r.idealMax!==null?'ideal '+[r.idealMin!==null?number(r.idealMin):'',r.idealMax!==null?number(r.idealMax):''].join('–')+' '+r.currency:'';
   parts.push(r.min!==null?'revenue from '+number(r.min)+' '+r.currency+(ideal?' ('+ideal+')':''):'revenue '+ideal);
  }
  if(criteria.industries.length)parts.push('industry divisions '+criteria.industries.join(', '));
  return parts.join(' · ');
 }

 return {MAX_INDUSTRIES,normalize,evaluate,describe};
});
