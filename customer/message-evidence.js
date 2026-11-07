(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelMessageEvidence=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const VERSION='message-evidence-20261010-v1';
 const clean=value=>String(value||'').replace(/\s+/g,' ').trim();
 function domain(value){try{const u=new URL(value);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password?u.hostname.toLowerCase().replace(/^www\./,''):'';}catch{return '';}}
 function statements(text){return String(text||'').split(/(?<=[.!?])\s+|\n+/).map(clean).filter(value=>value&&!/ignore (?:all |previous )?instructions|system prompt|pretend|fabricate|\b(?:no|not|never|without|cannot|can't|do not|don't)\b/i.test(value));}
 // Customer audiences and counterparties do not establish the seller's own
 // material, nationality, installation capability or certifications.
 function sellerStatements(text){return statements(text).filter(value=>! /^(?:our|the)\s+[^.!?]{0,50}\b(?:customers?|clients?|partners?|suppliers?)\b/i.test(value)).map(value=>{const audience=value.search(/\b(?:for|to|serving)\s+[^.!?]{0,160}\b(?:customers?|clients?|companies|manufacturers?|contractors?|businesses|partners?)\b/i);return audience<0?value:value.slice(0,audience).trim();}).filter(Boolean);}
 function selectExcerpt(text){
  const lines=String(text||'').split(/(?<=[.!?])\s+|\n+/).map(value=>value.trim()).filter(value=>value&&value.length<=1200&&!/^\s*(?:[-*]\s*)?\[[^\]]+\]\([^)]*\)\s*$/.test(value));
  const rank=value=>/\b(?:steel|stål|stahl|tēraud\w*|aluminium|aluminum|concrete|timber|wood|plastic|EN\s*1090|EXC\s*[1-4]|specifications?|standards?|certific\w*)\b/i.test(value)?0:/\b(?:manufactur\w*|installation|installed|delivered|completed|experience|services?|capabilities|design\w*)\b/i.test(value)?1:/\b(?:invest\w*|expand\w*|plant|factory|20\d{2}|schedule|milestone)\b/i.test(value)?2:3;
  const relevant=lines.map((value,index)=>({value,index,rank:rank(value)})).filter(row=>row.rank<3).sort((a,b)=>a.rank-b.rank||a.index-b.index).slice(0,16).sort((a,b)=>a.index-b.index);
  return (relevant.length?relevant.map(row=>row.value):lines.slice(0,8)).join('\n').slice(0,6000);
 }
 function sourceRead(row={}){return row.sourceRead!==false&&row.extracted!==false&&!/snippet|model_summary/i.test(row.evidenceKind||'')&&!/error|failed|pending/i.test(row.status||'')&&(row.sourceRead===true||row.extracted===true||row.verification==='source_verified'&&Number.isFinite(Date.parse(row.extractedAt||'')));}
 function sources(context={}){
  const host=domain(context.sellerWebsite),web=host?(context.sellerEvidence||[]).filter(row=>(domain(row?.url)===host||row.fullSourceRead===true&&domain(row.linkedFrom)===host&&/\.pdf(?:$|\?)/i.test(row.url))&&sourceRead(row)):[];
  // These documents come only from the active seller Profile, not buyer research.
  const docs=(context.sellerDocuments||[]).filter(row=>row&&row.name&&String(row.text||'').trim()&&['ready','complete','completed','extracted'].includes(row.status||'ready')).map(row=>({id:row.id,title:row.name,name:row.name,type:'document',owner:'seller',sourceRead:true,url:'',text:row.text}));
  return [...web,...docs].map(row=>({...row,text:String(row.text||row.excerpt||'').slice(0,25000)})).filter(row=>row.text.trim().length>=35&&!/ignore (?:all |previous )?instructions|system prompt|pretend|fabricate/i.test(row.text));
 }
 function experienceDuration(input=[]){
  const values=[];
  for(const sentence of input.flatMap(sellerStatements)){
   if(/\b(?:ago|warranty|guarantee|project duration|plan|plans|planned|planning|will|could|may|might)\b/i.test(sentence))continue;
   const match=sentence.match(/(?<![\w.])((?:(?:more than|over|at least)\s+)?(?:\d+\+?|twenty|thirty|forty|fifty)\s+years)\s+(?:of\s+)?(?:(?:[a-z-]+\s+){0,4}(?:experience|expertise)|in\b|working\b)/i)||sentence.match(/\b(?:worked|working|operated|operating|manufacturing|fabricating)\b[^.!?]{0,70}\bfor\s+((?:(?:more than|over|at least)\s+)?\d+\+?\s+years)\b/i);
   if(match)values.push(match[1].toLowerCase());
  }
  const distinct=[...new Set(values)];return distinct.length===1?distinct[0]:'';
 }

 function reference(context={}){return sources(context).find(row=>domain(row.url)&&/\/(?:projects?|case-stud(?:y|ies)|references?|portfolio|gallery)(?:\/|[-_]|$)/i.test(new URL(row.url).pathname)&&statements(row.text).some(text=>/\b(?:manufactur\w*|installation|installed|delivered|production|completed|designed|developed)\b/i.test(text)))||null;}
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
 const neutralContext=Object.freeze({tr:'Planlarınız','zh-CN':'您的计划','zh-TW':'您的計畫',en:'Your plans',ru:'Ваши планы',kk:'Жоспарларыңыз',lv:'Jūsu plāni',de:'Ihre Pläne',sv:'Era planer',et:'Teie plaanid',lt:'Jūsų planai',fi:'Suunnitelmanne',no:'Deres planer',da:'Jeres planer',pl:'Państwa plany',fr:'Vos projets',nl:'Uw plannen',es:'Sus planes',it:'I vostri piani',pt:'Os seus planos',cs:'Vaše plány',sk:'Vaše plány',ro:'Planurile dvs.',bg:'Вашите планове',hr:'Vaši planovi',sl:'Vaši načrti',hu:'Az Ön tervei',el:'Τα σχέδιά σας',uk:'Ваші плани'});
 function factualTrigger(value,company=''){if(!value)return value;const excerpt=clean(value.excerpt||value.summary),contains=text=>excerpt.toLowerCase().includes(clean(text).toLowerCase()),t={...value},preview=typeof module==='object'&&module.exports?require('./trigger-preview.js'):globalThis.LeadIntelTriggerPreview,translated=preview?.summary({summary:excerpt},company);t.summary=value.summary&&contains(value.summary)?value.summary:excerpt;for(const key of ['subjectSummary','projectName','shortName','locationName','subject','title'])if(t[key]&&!contains(t[key])&&!(key==='subjectSummary'&&t[key]===translated))delete t[key];return t;}
 function projectLabel(context={},max=22){
  const t=factualTrigger(context.trigger,context.buyerCompany);if(!['user_reviewed','source_verified'].includes(t?.verification))return '';
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
  if(style==='professional'&&gaps.has('materials'))out.push({owner:'seller',domain:host,fields:['materials'],urls:[reference(context)?.url].filter(Boolean),query:`site:${host} materials manufacturing installation`});
  if(gaps.has('technical'))out.push({owner:'seller',domain:host,fields:['technical'],query:`site:${host} ${/steel|metal|fabricat/i.test(shortTopic)?'"EN 1090"':'specifications certification'}`});
  if(/steel|metal|fabricat/i.test(shortTopic)&&gaps.has('technical')&&out.length<3)out.push({owner:'seller',domain:host,fields:['technical','offer'],query:`site:${host} steel installation projects`});
  return out.slice(0,3);
 }
 const timing=Object.freeze({tr:'şimdi mi sonra mı karşılaştıralım','zh-CN':'现在比较还是以后比较','zh-TW':'現在比較還是以後比較',en:'compare now or later',ru:'сравнить сейчас или позже',kk:'қазір не кейін салыстыру',lv:'salīdzināt tagad vai vēlāk',sv:'jämföra nu eller senare',de:'jetzt oder später vergleichen',et:'võrdleme nüüd või hiljem',lt:'palyginti dabar ar vėliau',fi:'vertailla nyt vai myöhemmin',no:'sammenligne nå eller senere',da:'sammenligne nu eller senere',pl:'porównać teraz czy później',fr:'comparer maintenant ou plus tard',nl:'nu of later vergelijken',es:'comparar ahora o más tarde',it:'confrontare ora o più tardi',pt:'comparar agora ou mais tarde',cs:'porovnat nyní nebo později',sk:'porovnať teraz alebo neskôr',ro:'comparăm acum sau mai târziu',bg:'сравнение сега или по-късно',hr:'usporediti sada ili kasnije',sl:'primerjati zdaj ali pozneje',hu:'összehasonlítás most vagy később',el:'σύγκριση τώρα ή αργότερα',uk:'порівняти зараз чи пізніше'});
 function meetingDates(essentials={},context={},language='en'){
  const raw=[essentials.meetingDateOne,essentials.meetingDateTwo];if(raw.some(value=>!/^\d{4}-\d{2}-\d{2}$/.test(value||''))||raw[0]===raw[1])return null;
  const now=new Date(context.now||Date.now());if(!Number.isFinite(now.getTime()))return null;
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

 // One bounded evidence pass for every library channel. Source reads, not search
 // snippets, are reusable facts. Missing personal/case-story details are never guessed.
 const RESEARCH_POLICY='template-research-20261107-v1';
 function researchKey(script,context,essentials={}){
  const input=JSON.stringify([RESEARCH_POLICY,script.channel,script.id,script.subject,script.body,context.buyerDomain,context.buyerName,context.trigger,context.sellerWebsite,context.profileEvidence,context.sellerDocuments,context.sellerAnswers,context.sellerAnswerStatus,essentials]);
  const hash=seed=>{let value=seed;for(let i=0;i<input.length;i++)value=Math.imul(value^input.charCodeAt(i),16777619);return (value>>>0).toString(16);};return RESEARCH_POLICY+':'+hash(2166136261)+hash(2246822519);
 }
 async function researchTemplate({script,context,resolve,read,search,signal,onProgress=()=>{},now=Date.now(),cached,retry=false}){
  const key=researchKey(script,context,context.essentials),age=now-Date.parse(cached?.checkedAt||'');
  if(!retry&&cached?.key===key&&age>=0&&age<(cached.status==='incomplete'?5*60000:24*3600000)){
   onProgress('Using saved research.');return {...cached,reused:true};
  }
  const collected=[],receipts=[],errors=[],seen=new Set();let reads=0,searches=0;
  const check=()=>signal?.throwIfAborted();
  const merged=()=>({...context,sellerEvidence:[...(context.sellerEvidence||[]),...collected.filter(r=>r.owner==='seller')],buyerFactEvidence:[...(context.buyerFactEvidence||[]),...collected.filter(r=>r.owner==='buyer')]});
  const gaps=()=>resolve(merged()).missing;
  const searchable=owner=>gaps().filter(label=>owner==='buyer'?/project|phase|location|facility|completion|development/i.test(label):/experience|industry|market|reference|certif|company data|work packages|country|city/i.test(label));
  const trigger=context.researchTrigger||context.trigger,buyer=domain(trigger?.url)||context.buyerDomain,seller=domain(context.sellerWebsite);
  const reviewed=['source_verified','user_reviewed'].includes(trigger?.verification);
  const eligible=(url,owner)=>domain(url)===(owner==='buyer'?buyer:seller)&&Boolean(domain(url));
  const existing=[...(context.buyerFactEvidence||[]).map(r=>({...r,owner:'buyer'})),...sources(context).map(r=>({...r,owner:'seller'}))];
  async function visit(url,owner,mandatory=false,linkedFrom=''){
   const linkedPdf=domain(url)&&/\.pdf(?:$|\?)/i.test(url)&&eligible(linkedFrom,owner)&&collected.some(row=>row.url===linkedFrom&&row.owner===owner&&row.text.includes(url));
   check();if(!(eligible(url,owner)||linkedPdf)||seen.has(url)||reads>=8)return;seen.add(url);
   const saved=existing.find(r=>r.url===url&&r.owner===owner&&sourceRead(r)&&r.fullSourceRead===true&&now-Date.parse(r.extractedAt||'')>=0&&now-Date.parse(r.extractedAt)<24*3600000);
   if(saved&&!retry){collected.push(saved);receipts.push({kind:'reuse',owner,url,ok:true});return saved;}
   reads++;onProgress(mandatory?'Reading the selected trigger source…':`Checking supporting sources (${reads}/8)…`);
   try{
    const result=await read(url,signal);check();const text=String(result.markdown||result.text||'').slice(0,25000);
    if(text.trim().length<40||/ignore (?:all |previous )?instructions|system prompt|pretend|fabricate/i.test(text))throw Error('Source did not return usable article text.');
    const row={owner,url,...(linkedPdf?{linkedFrom}:{}),title:String(result.title||'').slice(0,200),text,sourceRead:true,fullSourceRead:true,verification:'source_verified',extractedAt:new Date(now).toISOString()};
    collected.push(row);receipts.push({kind:'read',owner,url,ok:true});return row;
   }catch(error){check();const message=String(error.message).slice(0,180);errors.push(message);receipts.push({kind:'read',owner,url,ok:false,error:message});}
  }
  const links=row=>[...String(row?.text||'').matchAll(/\[[^\]]*\]\(([^\s)]+)\)/g)].map(m=>{try{return new URL(m[1],row.url).href;}catch{return '';}}).filter(url=>domain(url)&&(eligible(url,row.owner)||/\.pdf(?:$|\?)/i.test(url))&&/project|news|press|about|compan|certif|capabil|manufactur|\.pdf(?:$|\?)/i.test(url));
  try{
  onProgress('Checking saved website, documents and Profile answers…');check();const initial=gaps();
  // Always inspect the user's chosen article, including when its quote already fills a slot.
  let article;if(reviewed&&eligible(trigger.url,'buyer'))article=await visit(trigger.url,'buyer',true);
  let homepage;if(searchable('seller').length&&seller)homepage=await visit(context.sellerWebsite,'seller');
  for(const row of [article,homepage].filter(Boolean))for(const url of links(row).slice(0,2)){if(!gaps().length)break;await visit(url,row.owner,false,row.url);}
  // At most one focused query per owner. Search results are candidates only.
  for(const owner of ['buyer','seller']){
   check();if(!gaps().length||reads>=8||searches>=2)break;
   const host=owner==='buyer'?buyer:seller;if(!host)continue;
   const needed=searchable(owner);
   if(!needed.length)continue;
   const query=`site:${host} ${owner==='buyer'?String(trigger?.title||'').slice(0,100):''} ${needed.slice(0,4).join(' ')}`;searches++;onProgress(`Resolving remaining facts (${searches}/2 searches)…`);
   try{const results=await search(query,signal);check();receipts.push({kind:'search',owner,query,ok:true,count:results.length});for(const row of results.slice(0,4)){if(!gaps().length||reads>=8)break;await visit(row.url,owner);}}
   catch(error){check();errors.push(String(error.message).slice(0,180));receipts.push({kind:'search',owner,query,ok:false,error:String(error.message).slice(0,180)});}
  }
  check();const missing=gaps(),status=errors.length?'incomplete':missing.length?'needs_review':'checked';
  const result={key,policy:RESEARCH_POLICY,status,sources:collected,receipts,errors,missing,initialMissing:initial.length,reads,searches,checkedAt:new Date(now).toISOString()};
  onProgress(`Research finished: ${Math.max(0,initial.length-missing.length)} details added; ${missing.length} need review.${errors.length?' Some sources were unavailable.':''}`);return result;
  }catch(error){error.partialResearch={key,policy:RESEARCH_POLICY,status:'incomplete',sources:collected,receipts,errors:[String(error.message).slice(0,180)],missing:[],reads,searches,checkedAt:new Date(now).toISOString()};throw error;}
 }

 return Object.freeze({researchTemplate,researchKey,RESEARCH_POLICY,VERSION,fields,styleFields,neutralContext,projectLabel,factualTrigger,sourceRead,domain,experienceDuration,statements,sellerStatements,selectExcerpt,sources,reference,assess,plan,meetingDates,comparison,timing});
});
