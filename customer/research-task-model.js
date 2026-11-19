(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelResearchTasks=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clean=(v,n=300)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
 const fields=['flowId','count','mode','markets','signalIds','referenceIds','buyerCount','buyerScope','buyerCompanies','phoneEvidence','paidMode','format','budget','marketOverride','roles'];
 function requested(text){return !/\b(?:how (?:can|do)|is it possible|explain how|do not|don't)\b/i.test(text)&&/\b(?:find|build|create|research|give me|list)\b/i.test(text)&&(/\b(?:companies|company list|lookalikes)\b/i.test(text)||/\b(?:best|relevant|top)\s+company\b/i.test(text))&&!/\b(?:code|script|clone|duplicate the app)\b/i.test(text);}
 function extract(text,countries=[]){
  const q=clean(text,8000),out={};let m;
  if((m=q.match(/\bflow\s*(?:named\s+)?["“]([^"”]+)["”]/i)))out.flowQuery=m[1];else if((m=q.match(/\bflow\s*(\d+)\b/i)))out.flowQuery='Flow '+m[1];else if((m=q.match(/\bflow\s+([a-z][a-z0-9_-]*)\b/i)))out.flowQuery='Flow '+m[1];
  if((m=q.match(/\b(\d+)\s+(?:(?:the|most|best|top|relevant|matching|similar|ranked)\s+)*compan(?:y|ies)\b/i)))out.count=Number(m[1]);else if(/\b(?:one|1|best|most relevant)\s+company\b/i.test(q))out.count=1;
  const markets=countries.filter(c=>new RegExp('\\b'+c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(q));if(markets.length)out.markets=markets;
  if((m=q.match(/\b(\d+|one|two|three|four)\s+(?:verified\s+|relevant\s+)?(?:decision[ -]?makers?|buyers?|contacts?)\b/i)))out.buyerCount=Number(m[1])||({one:1,two:2,three:3,four:4})[m[1].toLowerCase()];
  if(/\bper company|each company\b/i.test(q))out.buyerScope='per_company';else if(/\bin total|total contacts|total buyers\b/i.test(q))out.buyerScope='total';
  if(/\bphone|telephone|mobile\b/i.test(q)){out.phoneEvidence=/\bprovider.verified\b/i.test(q)?'provider_verified':'confirmed';if(out.buyerCount===undefined)out.buyerCount=null;}
  if(/\b(?:no paid|without paid|free.only|public.only)\b/i.test(q))out.paidMode='off';else if(/\b(?:allow paid|use paid|paid searches? (?:allowed|approved)|paid research (?:allowed|approved))\b/i.test(q))out.paidMode='saved_policy';
  if(/\bcsv\b|\bcsw\b/i.test(q))out.format='csv';else if(/\bword\b|\.doc\b/i.test(q))out.format='word';else if(/\bpdf\b/i.test(q))out.format='pdf';else if(/\bin.app\b/i.test(q))out.format='app';
  if(/\ball (?:selected )?signals\b/i.test(q))out.mode='all';
  if(/\blookalike|\breference/i.test(q))out.signalIds=['lookalike'];
  if((m=q.match(/\b(?:budget|allowance)\s*(?:of|:)?\s*(\d+)\s*(?:operations?|checks?)\b/i)))out.budget=Number(m[1]);
  return out;
 }
 function answers(raw={}){const out={};for(const key of fields){if(!Object.hasOwn(raw,key))continue;const v=raw[key];if(['markets','signalIds','referenceIds','roles'].includes(key))out[key]=Array.isArray(v)?v.slice(0,key==='referenceIds'?15:10).map(x=>clean(x,180)).filter(Boolean):[];else if(['count','buyerCount','buyerCompanies','budget'].includes(key))out[key]=v===null||v===''?null:Number(v);else if(key==='marketOverride')out[key]=v===true;else out[key]=clean(v,180);}return out;}
 function questions(plan,available,{flowMissing=false}={}){
  const q=[],ask=(field,title,options=[])=>q.push({field,title,options});
  if(flowMissing||!plan.flowId)ask('flowId','Which saved Flow should this task use?');
  if(!Number.isInteger(plan.count)||plan.count<1||plan.count>200)ask('count','How many companies should I find? Choose 1–200.');
  if(!plan.markets?.length)ask('markets','Which country or countries should I research?');
  if(plan.markets?.some(m=>!available.markets?.includes(m))&&!plan.marketOverride)ask('marketOverride','The requested geography differs from this Flow. Use it for this task only?',[{value:true,label:'Use requested geography for this task'}]);
  if(plan.mode&&!['any','all'].includes(plan.mode))ask('mode','Match any selected signal or all selected signals?');
  if(!plan.signalIds?.length)ask('signalIds','Which signals should determine relevance?');
  if(plan.signalIds?.includes('lookalike')&&!plan.referenceIds?.length)ask('referenceIds',available.references?.length?'Which analyzed references should guide the search?':'This Flow has no reference companies. Add references in Profile or choose another Flow.');
  if(plan.referenceIds?.some(id=>!available.references?.find(r=>r.id===id)?.ready))ask('referenceIds','Some selected references have no analyzed website evidence. Analyze them in Profile or choose analyzed references.');
  if(plan.buyerCount===null||!Number.isInteger(plan.buyerCount)||plan.buyerCount<0||plan.buyerCount>4)ask('buyerCount','How many decision-makers do you need? Choose 0–4.');
  if(plan.buyerCount>0){
   if(!['per_company','total'].includes(plan.buyerScope))ask('buyerScope','Is that number of decision-makers per company or in total?',[{value:'per_company',label:'Per company'},{value:'total',label:'In total'}]);
   if(!Number.isInteger(plan.buyerCompanies)||plan.buyerCompanies<1||plan.buyerCompanies>Math.min(10,plan.count||10))ask('buyerCompanies','How many top-ranked companies should receive buyer research? Up to 10 per task.');
   if(!plan.roles?.length)ask('roles','Which decision-maker roles should I research?');
   if(!['off','saved_policy'].includes(plan.paidMode))ask('paidMode','May this task use paid contact research within your saved provider permissions and limits?',[{value:'off',label:'Public research only'},{value:'saved_policy',label:'Use saved paid policy'}]);
  }
  if(!['none','confirmed','provider_verified'].includes(plan.phoneEvidence))ask('phoneEvidence','What phone evidence do you require?',[{value:'none',label:'Phone optional'},{value:'confirmed',label:'Named source or verified provider'},{value:'provider_verified',label:'Verified provider only'}]);
  if(!['app','csv','word','pdf'].includes(plan.format))ask('format','What format would you like for the result?',[{value:'app',label:'In-app list'},{value:'csv',label:'CSV'},{value:'word',label:'Word'},{value:'pdf',label:'PDF'}]);
  if(!Number.isInteger(plan.budget)||plan.budget<10||plan.budget>5000)ask('budget','Choose 10–5,000 company-research operations. This is an operation allowance, not a money balance.');
  return q;
 }
 function issue(value={}){
  const code=clean(value.code||value.status||'',100),message=clean(value.message||value.reason||value,500),s=(code+' '+message).toLowerCase();
  if(/402|insufficient.*(?:fund|credit|balance)|credit.*(?:exhaust|limit|empty)|payment.required|balance.*(?:low|zero)/.test(s))return {code:'funds',title:'Research blocked — credits required',reason:message,action:'Open provider billing',target:'settings'};
  if(/401|403|credential|api.key|unauthori|connect.*provider|authentication/.test(s))return {code:'connection',title:'Research blocked — connection needs attention',reason:message,action:'Review connections',target:'settings'};
  if(/allowance|budget|limit|quota|storage/.test(s))return {code:'limit',title:'Research blocked — limit reached',reason:message,action:'Review limits before continuing',target:'settings'};
  if(/reference|flow|geograph|criteria|role|context/.test(s))return {code:'context',title:'Task blocked — review required',reason:message,action:'Review task',target:'review'};
  return {code:code||'research_gap',title:'Task blocked — action required',reason:message||'A required check did not finish. Completed results are retained.',action:'Review the issue and continue',target:'retry'};
 }
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function rows(task){const rows=[];for(const company of task.results||[]){const people=company.buyers?.length?company.buyers:[{}];for(const p of people)rows.push([company.company,company.website,company.location||company.market,company.score,p.name||'',p.role||'',p.phone||'',p.phoneStatus||'',p.phoneSource||'',(company.matches||[]).map(m=>m.url).filter(Boolean).join(' | ')]);}return rows;}
 const headers=['Company','Website','Location','Relevance score','Decision-maker','Role','Phone','Phone evidence','Phone source','Company sources'];
 function csv(task){return [headers,...rows(task)].map(row=>row.map(v=>'"'+(/^[\s]*[=+@-]/.test(String(v))?"'":'')+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\r\n');}
 function documentHtml(task){return '<!doctype html><html><head><meta charset="utf-8"><title>LeadIntel research task</title><style>body{font:12px Arial;color:#15352e}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px;text-align:left;overflow-wrap:anywhere}h1{font-size:22px}@page{size:A4 landscape;margin:12mm}</style></head><body><h1>'+escape(task.plan?.name||'Research results')+'</h1><p>Status: '+escape(task.status)+' · '+escape(task.results?.length||0)+' of '+escape(task.plan?.count)+' companies. Scores express relevance; buying intent and phone reachability are not guaranteed.</p>'+(task.blocker?'<p>Action required: '+escape(task.blocker.reason)+'</p>':'')+'<table><thead><tr>'+headers.map(h=>'<th>'+h+'</th>').join('')+'</tr></thead><tbody>'+rows(task).map(row=>'<tr>'+row.map(v=>'<td>'+escape(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></body></html>';}
 return {requested,extract,answers,questions,issue,rows,csv,documentHtml};
});
