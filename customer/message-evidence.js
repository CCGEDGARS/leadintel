(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelMessageEvidence=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const VERSION='message-evidence-20261010-v1';
 const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
 function domain(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.hostname.toLowerCase().replace(/^www\./,''):'';}catch{return '';}}
 function statements(text){return String(text||'').split(/(?<=[.!?])\s+|\n+/).map(clean).filter(value=>value&&!/ignore (?:all |previous )?instructions|system prompt|pretend|fabricate|\b(?:no|not|never|without|cannot|can't|do not|don't)\b/i.test(value));}
 function sources(context={}){const host=domain(context.sellerWebsite);return host?(context.sellerEvidence||[]).filter(row=>domain(row?.url)===host&&row.extracted!==false&&!/error|failed|pending/i.test(row.status||'')).map(row=>({...row,text:String(row.text||row.excerpt||'').slice(0,12000)})).filter(row=>row.text.trim().length>=35&&!/ignore (?:all |previous )?instructions|system prompt|pretend|fabricate/i.test(row.text)):[];}
 function reference(context={}){return sources(context).find(row=>/\/(?:projects?|case-stud(?:y|ies)|references?|portfolio|gallery)(?:\/|[-_]|$)/i.test(new URL(row.url).pathname)&&statements(row.text).some(text=>/\b(?:manufactur\w*|installation|installed|delivered|production|completed|designed|developed)\b/i.test(text)))||null;}
 const fields=Object.freeze([
  {id:'sender',label:'Sender identity',owner:'user',field:'sender'},
  {id:'seller',label:'Seller company',owner:'user',field:'company'},
  {id:'offer',label:'Specific services and capabilities',owner:'seller',field:'offer'},
  {id:'experience',label:'Supported experience and differentiation',owner:'seller',field:'difference'},
  {id:'reference',label:'Approved project reference link',owner:'seller'},
  {id:'booking',label:'Booking link',owner:'user',field:'calendly'},
  {id:'recipient',label:'Recipient identity',owner:'buyer'},
  {id:'buyer-company',label:'Target company',owner:'buyer'},
  {id:'project',label:'Reviewed project, location and development',owner:'buyer',optional:true},
  {id:'technical',label:'Materials, specifications and comparable options',owner:'seller',optional:true},
  {id:'materials',label:'Supported material for subject relevance',owner:'seller',optional:true},
  {id:'schedule',label:'Published milestones and schedule',owner:'buyer',optional:true}
 ]);
 const styleFields=Object.freeze({professional:[],curiosity:['value','approach','meetingValue'],friendly:['value','approach','meetingValue'],brutal:['value','approach','meetingValue']});
 const neutralContext=Object.freeze({en:'Your plans',lv:'Jūsu plāni',de:'Ihre Pläne',sv:'Era planer',et:'Teie plaanid',lt:'Jūsų planai',fi:'Suunnitelmanne',no:'Deres planer',da:'Jeres planer',pl:'Państwa plany',fr:'Vos projets',nl:'Uw plannen',es:'Sus planes',it:'I vostri piani',pt:'Os seus planos',cs:'Vaše plány',sk:'Vaše plány',ro:'Planurile dvs.',bg:'Вашите планове',hr:'Vaši planovi',sl:'Vaši načrti',hu:'Az Ön tervei',el:'Τα σχέδιά σας',uk:'Ваші плани'});
 function projectLabel(context={},max=22){
  const t=context.trigger;if(!['user_reviewed','source_verified'].includes(t?.verification))return '';
  const valid=value=>{const text=clean(value).replace(/[.!?]+$/,'');return text&&Array.from(text).length<=max&&text.split(/\s+/).length<=6&&!/[{}<>\n\r]/.test(text)&&!/^\s*(?:investment|expansion|construction|project)\s+(?:announced|started|planned|update)[.!]?$/i.test(text)&&!/\b(?:error|exception|traceback|undefined|timeout|unavailable)\b/i.test(text)?text:'';};
  const evidence=[t.subjectSummary,t.summary,t.excerpt,t.subject,t.title].filter(Boolean),location=evidence.map(source=>source.match(/\b(?:in|at|i|vid)\s+(?:(?:the|a|an)\s+)?([\p{Lu}][\p{L}\d'-]+(?:\s+[\p{Lu}][\p{L}\d'-]+){0,4})(?=\s|[.,;:]|$)/u)?.[1]).find(Boolean);
  return [t.projectName,t.shortName,location,t.locationName,...evidence].map(valid).find(Boolean)||'';
 }
 function assess({style='professional',essentials={},context={}}={}){
  const pages=sources(context),ref=reference(context),proof=(String(essentials.proof||'').match(/https?:\/\/[^\s<>"\])]+/)||[])[0]?.replace(/[.,;!?]+$/,'')||'',trigger=context.trigger,reviewed=['user_reviewed','source_verified'].includes(trigger?.verification)&&Boolean(domain(trigger.url)),triggerText=reviewed?String(trigger.excerpt||trigger.summary||''):'';
  const definitions=[...fields,...(styleFields[style]||[]).map(field=>({id:field,label:field==='value'?'Supported business value':field==='approach'?'Supported delivery approach':'Supplied meeting material',owner:field==='meetingValue'?'user':'seller',field,optional:true}))];
  const facts=definitions.map(def=>{
   let value=def.field?clean(essentials[def.field]):'',url='',excerpt='',verification=value?'user_supplied':'',checkedAt='';
   if(!value&&['offer','experience'].includes(def.id)){
    const pattern=def.id==='offer'?/\b(?:we (?:provide|offer|manufacture|design|deliver)|our (?:services|capabilities)|speciali[sz]e in)\b/i:/\b(?:years? of experience|our (?:team|company).*experience|completed|delivered)\b/i;
    const page=pages.find(row=>statements(row.text).some(text=>pattern.test(text)));value=page?statements(page.text).find(text=>pattern.test(text))||'':'';url=page?.url||'';excerpt=value.slice(0,600);verification=value?'source_verified':'';checkedAt=page?.extractedAt||page?.fetchedAt||'';
   }
   if(def.id==='booking'&&!domain(value))value='';
   if(def.id==='reference'){value=domain(proof)?proof:ref?.url||'';url=value;excerpt=ref?.url===value?statements(ref.text).join(' ').slice(0,600):'';verification=domain(proof)?'user_supplied':value?'source_verified':'';checkedAt=ref?.extractedAt||ref?.fetchedAt||'';}
   if(def.id==='recipient')value=clean(context.buyerName);
   if(def.id==='buyer-company')value=clean(context.buyerCompany);
   if(def.id==='project'){value=triggerText;url=reviewed?trigger.url:'';excerpt=value.slice(0,600);verification=value?trigger.verification:'';}
   if(def.id==='technical'){const page=pages.find(row=>statements(row.text).some(text=>/\b(?:EN\s*1090|EXC\s*[234]|specifications?|standards?|certific\w*|materials?|steel|aluminium|concrete|timber)\b/i.test(text)));value=page?statements(page.text).filter(text=>/\b(?:EN\s*1090|EXC\s*[234]|specifications?|standards?|certific\w*|materials?|steel|aluminium|concrete|timber)\b/i.test(text)).join(' ').slice(0,600):'';url=page?.url||'';excerpt=value;verification=value?'source_verified':'';checkedAt=page?.extractedAt||page?.fetchedAt||'';}
   if(def.id==='materials'){
    const pattern=/\b(?:steel|stål|stahl|tēraud\w*|aluminium|aluminum|concrete|timber|wood|plastic)\b/i,supplied=[essentials.offer,...['priority_offers','delivery_approach'].filter(key=>['user','accepted'].includes(context.sellerAnswerStatus?.[key])).map(key=>context.sellerAnswers?.[key])].flatMap(statements).find(text=>pattern.test(text));
    const page=pages.find(row=>statements(row.text).some(text=>pattern.test(text)));value=supplied|| (page?statements(page.text).find(text=>pattern.test(text))||'':'');url=supplied?'':page?.url||'';excerpt=value.slice(0,600);verification=supplied?'user_supplied':value?'source_verified':'';checkedAt=page?.extractedAt||page?.fetchedAt||'';
   }
   if(def.id==='schedule'){value=statements(triggerText).filter(text=>/\b(?:20\d{2}|schedule|deadline|completion|ready by|opening|milestone)\b/i.test(text)).join(' ').slice(0,600);url=value?trigger.url:'';excerpt=value;verification=value?trigger.verification:'';}
   return {...def,value:value.slice(0,600),url,excerpt,verification,checkedAt,status:value?'confirmed':'missing'};
  });
  const required=facts.filter(row=>!row.optional),missing=facts.filter(row=>row.status==='missing');
  return {version:VERSION,style,complete:required.every(row=>row.status==='confirmed'),ready:required.filter(row=>row.status==='confirmed').length,total:required.length,facts,missing};
 }
 function plan({style='professional',essentials={},context={}}={}){
  const host=domain(context.sellerWebsite);if(!host)return [];
  const audit=assess({style,essentials,context}),gaps=new Set(audit.missing.filter(row=>row.owner==='seller').map(row=>row.id)),out=[];
  const topic=clean(essentials.offer).split(/[,;]|\s+and\s+/i).map(clean).filter(Boolean).find(value=>/manufactur|metal|steel|fabricat/i.test(value))||clean(essentials.offer).split(/[,;]/)[0];
  const shortTopic=topic.replace(/["\\]/g,'').split(/\s+/).slice(0,3).join(' ');
  if(gaps.has('reference'))out.push({owner:'seller',domain:host,fields:['reference','experience'],query:`site:${host} ${shortTopic?shortTopic+' ':''}projects`});
  if(gaps.has('offer')||gaps.has('experience'))out.push({owner:'seller',domain:host,fields:['offer','experience'],query:`site:${host} services capabilities experience`});
  if(style==='professional'&&gaps.has('materials'))out.push({owner:'seller',domain:host,fields:['materials'],query:`site:${host} ${shortTopic?shortTopic+' ':''}materials installation`});
  if(gaps.has('technical'))out.push({owner:'seller',domain:host,fields:['technical'],query:`site:${host} ${/steel|metal|fabricat/i.test(shortTopic)?'"EN 1090"':'specifications certification'}`});
  if(/steel|metal|fabricat/i.test(shortTopic)&&gaps.has('technical')&&out.length<3)out.push({owner:'seller',domain:host,fields:['technical','offer'],query:`site:${host} steel installation projects`});
  return out.slice(0,3);
 }
 const timing=Object.freeze({en:'compare now or later',lv:'salīdzināt tagad vai vēlāk',sv:'jämföra nu eller senare',de:'jetzt oder später vergleichen',et:'võrdleme nüüd või hiljem',lt:'palyginti dabar ar vėliau',fi:'vertailla nyt vai myöhemmin',no:'sammenligne nå eller senere',da:'sammenligne nu eller senere',pl:'porównać teraz czy później',fr:'comparer maintenant ou plus tard',nl:'nu of later vergelijken',es:'comparar ahora o más tarde',it:'confrontare ora o più tardi',pt:'comparar agora ou mais tarde',cs:'porovnat nyní nebo později',sk:'porovnať teraz alebo neskôr',ro:'comparăm acum sau mai târziu',bg:'сравнение сега или по-късно',hr:'usporediti sada ili kasnije',sl:'primerjati zdaj ali pozneje',hu:'összehasonlítás most vagy később',el:'σύγκριση τώρα ή αργότερα',uk:'порівняти зараз чи пізніше'});
 function meetingDates(essentials={},context={},language='en'){
  const raw=[essentials.meetingDateOne,essentials.meetingDateTwo],now=new Date(context.now||Date.now());if(!Number.isFinite(now.getTime()))return null;
  const zone=context.timeZone||'UTC';let today;try{today=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}catch{return null;}
  const dates=raw.map(value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value&&value>=today?d:null;});
  if(dates.some(value=>!value)||raw[0]===raw[1])return null;
  const format=new Intl.DateTimeFormat(language==='en'?'en-GB':language,{timeZone:'UTC',day:'numeric',month:'short',...(dates.some(date=>date.getUTCFullYear()!==now.getUTCFullYear())?{year:'numeric'}:{})});
  return dates.map(date=>format.format(date));
 }
 function comparison(essentials={},context={},language='en',orWord='or',max=45){
  const fits=value=>value&&Array.from(value).length<=max&&!/[\n\r{}<>]/.test(value);
  const dates=meetingDates(essentials,context,language);if(dates&&language==='en'){const text=`meet ${dates[0]} ${orWord} ${dates[1]}`;if(fits(text))return {text,kind:'meeting-dates',verification:'user_supplied'};}
  const reviewed=['user_reviewed','source_verified'].includes(context.trigger?.verification)&&Boolean(domain(context.trigger.url));
  const supplied=[essentials.offer,essentials.approach,essentials.proof,essentials.difference,...['priority_offers','delivery_approach','proof_points','differentiation'].filter(key=>['user','accepted'].includes(context.sellerAnswerStatus?.[key])).map(key=>context.sellerAnswers?.[key])];
  const text=[...sources(context).flatMap(row=>statements(row.text)),...supplied.flatMap(statements),...(reviewed?statements(context.trigger.excerpt||context.trigger.summary):[])].join(' ').replace(/https?:\/\/[^\s<>\"\])]+/g,''),classes=[...new Set((text.match(/\bEXC\s*[1-4]\b/gi)||[]).map(value=>value.replace(/\s/g,'').toUpperCase()))].sort();
  if(classes.length>=2&&(/\bsteel\b/i.test(text)||reviewed&&/\bEXC\s*[1-4]\b/i.test(context.trigger.excerpt||''))){const question=classes.slice(0,2).join(' '+orWord+' ');if(fits(question))return {text:question,kind:'technical',verification:'source_supported'};}
  if((context.subjectFactsLanguage||essentials.language||'en')===language){const offers=[...new Set(statements(essentials.offer).flatMap(value=>value.split(/[,;]|\s+and\s+/i)).map(clean).filter(value=>value&&value.split(/\s+/).length<=4&&!/https?:|\d/.test(value)))].sort((a,b)=>a.length-b.length);for(let i=0;i<offers.length;i++)for(let j=i+1;j<offers.length;j++){const question=offers[i]+' '+orWord+' '+offers[j];if(fits(question))return {text:question,kind:'services',verification:'user_supplied'};}}
  return {text:timing[language]||timing.en,kind:'timing',verification:'open_question'};
 }
 return Object.freeze({VERSION,fields,styleFields,neutralContext,projectLabel,domain,statements,sources,reference,assess,plan,meetingDates,comparison,timing});
});
