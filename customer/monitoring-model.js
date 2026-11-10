(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelMonitoringModel=api;})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const PURPOSES=Object.freeze({signals:'Buying signals',hiring:'Hiring',court:'Court cases',procurement:'Procurement',custom:'Custom events'});
 const clean=(v,max=2000)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
 const list=v=>[...new Set((Array.isArray(v)?v:String(v??'').split(/[;\n|]/)).map(x=>clean(x,160)).filter(Boolean))].slice(0,30);
 const integer=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Math.floor(Number(v)))):fallback;
 function publicUrl(value){try{const u=new URL(String(value||'')),h=u.hostname.toLowerCase().replace(/\.$/,'');if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port&&!['80','443'].includes(u.port)||!h.includes('.')||h.includes(':')||/^(localhost|.*\.(local|localhost|internal|lan))$/.test(h))return '';const ip=h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);if(ip){const [a,b]=ip.slice(1).map(Number);if(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||ip.slice(1).some(n=>Number(n)>255))return '';}u.hash='';for(const k of [...u.searchParams.keys()])if(/^(utm_.+|fbclid|gclid)$/i.test(k))u.searchParams.delete(k);u.searchParams.sort();return u.href;}catch{return '';}}
 function normalizeWorkflow(input={}){
  const v=input&&typeof input==='object'?input:{},purpose=Object.hasOwn(PURPOSES,v.purpose)?v.purpose:'signals';
  return {version:1,purpose,readMode:['indexed','page'].includes(v.readMode)?v.readMode:['court','procurement'].includes(purpose)?'page':'indexed',queryTerms:list(v.queryTerms),excludeTerms:list(v.excludeTerms),nextAction:['review','company_research','case_review','bid_review','prepare_message'].includes(v.nextAction)?v.nextAction:purpose==='court'?'case_review':purpose==='procurement'?'bid_review':purpose==='hiring'?'company_research':'review',messageMode:['alerts','draft','automatic'].includes(v.messageMode)?v.messageMode:'alerts',templateId:/^template-(?:[1-9]|1\d|20)$/.test(v.templateId||'')?v.templateId:'',dailyLimit:integer(v.dailyLimit,1,50,5)};
 }
 function buildPlan(payload={},config={},cursor={}){
  const w=normalizeWorkflow(config.workflow),limit=config.researchDepth==='deep'?12:4,urls=[...new Set((Array.isArray(config.customSources)?config.customSources:String(config.customSources||'').split(/\n/)).map(v=>String(v).trim()).filter(v=>v.length<=2000).map(publicUrl).filter(Boolean))].slice(0,20),main=payload.main||{},markets=list(main.targetMarkets||main.profile?.targetMarkets),fallback={hiring:['hiring vacancy recruitment'],court:['case hearing judgment'],procurement:['tender procurement notice'],custom:['announcement update'],signals:[]};
  const terms=w.queryTerms.length?w.queryTerms:fallback[w.purpose],queries=[],nextCursor={...cursor,workflowSource:integer(cursor.workflowSource,0,1000000,0),workflowTerm:integer(cursor.workflowTerm,0,1000000,0)};
  if(w.readMode==='page'){for(let n=0;n<Math.min(limit,urls.length);n++){const url=urls[nextCursor.workflowSource%urls.length];nextCursor.workflowSource++;queries.push({operation:'scrape',url,customSource:url,sourceType:'custom',query:'Read '+url});}return {queries,nextCursor};}
  const sourceCount=Math.max(urls.length,1),termCount=Math.max(terms.length,1),marketCount=Math.max(markets.length,1),combinations=sourceCount*termCount*marketCount,count=Math.min(limit,combinations),seen=new Set();
  nextCursor.workflowCombination=integer(cursor.workflowCombination,0,1000000,0);
  for(let n=0;n<count;n++){const index=nextCursor.workflowCombination++%combinations,url=urls[index%sourceCount]||'',term=terms[Math.floor(index/sourceCount)%termCount]||'',market=markets[Math.floor(index/(sourceCount*termCount))%marketCount]||'',u=url?new URL(url):null,query=[u?'site:'+u.hostname+(u.pathname==='/'?'':u.pathname):'',term,market].filter(Boolean).join(' ');if(!query||seen.has(query))continue;seen.add(query);queries.push({operation:'search',query,customSource:url,sourceType:w.purpose==='hiring'?'jobs':w.purpose==='court'?'court':w.purpose==='procurement'?'tenders':'custom'});}
  return {queries,nextCursor};
 }
 function date(value){const text=clean(value,100),iso=text.match(/\b(\d{4}-\d{2}-\d{2})(?:T[^\s]+)?/);if(iso&&Number.isFinite(Date.parse(iso[1]))&&new Date(iso[1]).toISOString().startsWith(iso[1]))return iso[1];const eu=text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);if(eu){const candidate=eu[3]+'-'+eu[2].padStart(2,'0')+'-'+eu[1].padStart(2,'0');if(Number.isFinite(Date.parse(candidate))&&new Date(candidate).toISOString().startsWith(candidate))return candidate;}return '';}
 function line(text,names){const escaped=names.map(n=>n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');const match=String(text).match(new RegExp('^\\s*(?:\\*\\*)?(?:'+escaped+')(?:\\*\\*)?\\s*[:：]\\s*(.+)$','im'));return match?clean(match[1].replace(/\*\*/g,''),600):'';}
 function subject(name,kind,role,text,website=''){
  name=clean(name.replace(/\s*\((?:company|organization|individual|person)\)\s*$/i,''),180);const anonymized=/^(?:[A-ZÀ-Ž]\.\s*){1,5}$/u.test(name)||/anonymous|anonymi|redacted|anonimiz|\[.*?\]/i.test(name),sourceLine=String(text).split('\n').find(l=>l.includes(name))||'';
  return {kind,name,role:clean(role,100),website:publicUrl(website),sourceQuote:clean(sourceLine,800),identityStatus:'source_observed',contactStatus:'review_required',anonymized};
 }
 function extractOne(evidence,workflow,text,index=0){
  const w=normalizeWorkflow(workflow),sourceUrl=publicUrl(evidence.url||evidence.link),sourceRead=evidence.sourceRead===true,restricted=/captcha|access denied|sign in to continue|log in to continue|subscription required/i.test(text),subjects=[];
  const fields={jobRole:line(text,['Job role','Position','Stilling','Vakance']),caseNumber:line(text,['Case number','Case no.','Case ID','Lieta Nr.','Lietas numurs']),tenderId:line(text,['Notice ID','Tender ID','Procurement ID','Iepirkuma numurs']),cpv:line(text,['CPV','CPV code']).match(/\b\d{8}(?:-\d)?\b/)?.[0]||''};
  const employer=line(text,['Employer','Company','Virksomhed','Darba devējs']),authority=line(text,['Contracting authority','Buyer organization','Pasūtītājs']);
  if(w.purpose==='hiring'&&employer)subjects.push(subject(employer,'organization','Employer',text,line(text,['Employer website','Company website'])));
  if(w.purpose==='procurement'&&authority)subjects.push(subject(authority,'organization','Contracting authority',text,line(text,['Authority website','Buyer website'])));
  if(w.purpose==='court')for(const match of text.matchAll(/^\s*(Claimant|Plaintiff|Applicant|Defendant|Respondent|Prasītājs|Atbildētājs)(?:\s*\((individual|person|company|organization)\))?\s*:\s*(.+)$/gim)){const kind=['individual','person'].includes(String(match[2]).toLowerCase())?'person':['company','organization'].includes(String(match[2]).toLowerCase())?'organization':'unresolved';subjects.push(subject(match[3],kind,match[1],text));if(subjects.length===10)break;}
  if(!subjects.length&&w.purpose==='custom'&&employer)subjects.push(subject(employer,'organization','Mentioned organization',text,line(text,['Company website'])));
  const reference=clean(w.purpose==='court'?fields.caseNumber:w.purpose==='procurement'?fields.tenderId:line(text,['Vacancy ID','Job ID','Reference','Event ID']),180),eventDate=date(line(text,['Hearing date','Event date','Published','Publication date','Date','Tiesas sēde'])||evidence.date),deadline=date(line(text,['Deadline','Closing date','Application deadline','Termiņš']));
  const heading=text.match(/^#{1,3}\s+(.+)$/m)?.[1],title=clean(heading||evidence.title||reference||PURPOSES[w.purpose],300),summary=clean(text,1200),sensitive=w.purpose==='court'&&/\bcriminal|\bpenal|krimināl|криминал|уголов|health record|medical diagnosis|sensitive personal/i.test(text);
  const scope=publicUrl(evidence.sourceScope)||sourceUrl,eventKey=[w.purpose,scope,reference||sourceUrl+(index?'#entry-'+index:'')].join('|');
  // For labelled notices fingerprint semantic facts, excluding page navigation.
  const semantic=reference?{title,sourceUrl,reference,fields,eventDate,deadline,subjects:subjects.map(s=>({kind:s.kind,name:s.name,role:s.role,website:s.website})),status:line(text,['Status','Decision','Amendment','Stage'])}:{title,summary};
  return {purpose:w.purpose,eventKey,title,summary,bodyText:clean(text,60000),sourceUrl,sourceType:clean(evidence.sourceType,60)||'public',sourceRead,reference,eventDate,deadline,fields,subjects,access:restricted?'restricted':sourceRead?'read':'unread',sensitive,versionMaterial:JSON.stringify({facts:semantic,body:clean(text,60000),access:restricted?'restricted':sourceRead?'read':'unread',sensitive})};
 }
 function extractEvents(evidence={},workflow={}){
  const text=String(evidence.text||evidence.markdown||evidence.description||'').slice(0,60000),chunks=text.split(/(?=^#{1,3}\s+)/m).filter(s=>s.trim()),w=normalizeWorkflow(workflow),label=w.purpose==='court'?/Case number|Case no\.|Case ID|Lieta Nr\.|Lietas numurs/i:w.purpose==='procurement'?/Notice ID|Tender ID|Procurement ID|Iepirkuma numurs/i:w.purpose==='hiring'?/Employer\s*:|Virksomhed\s*:|Darba devējs\s*:/i:null;
  const entries=label?chunks.filter(t=>label.test(t)):[];return (entries.length>1?entries:[text]).slice(0,20).map((body,i)=>extractOne(evidence,w,body,i));
 }
 function assessEvent(event={},workflow={},now=new Date()){
  const w=normalizeWorkflow(workflow),corpus=clean(event.title+' '+(event.bodyText||event.summary),61000).toLowerCase(),matched=w.queryTerms.filter(t=>corpus.includes(t.toLowerCase())),excluded=w.excludeTerms.filter(t=>corpus.includes(t.toLowerCase())),reasons=[],gaps=[];
  if(event.access!=='read'||!event.sourceUrl)gaps.push(event.access==='restricted'?'Source access is restricted':'Read the underlying source before relying on this finding');
  if(excluded.length)reasons.push('Excluded term: '+excluded.join(', '));if(matched.length)reasons.push('Matched criteria: '+matched.join(', '));if(w.queryTerms.length&&!matched.length)gaps.push('No configured matching term was found');
  if(['hiring','court','procurement'].includes(w.purpose)&&!event.subjects?.length)gaps.push('Identify the organization or party from the source');
  if(w.purpose==='hiring'&&!event.fields?.jobRole)gaps.push('Confirm the advertised role');
  if(['court','procurement'].includes(w.purpose)&&!event.reference)gaps.push('Confirm the case or notice reference');
  if(w.purpose==='procurement'&&!event.deadline)gaps.push('Confirm the procurement deadline');
  const expired=Boolean(event.deadline&&Date.parse(event.deadline+'T23:59:59Z')<new Date(now).getTime());if(expired)gaps.push('The stated deadline has passed');
  if(event.subjects?.some(s=>s.anonymized))gaps.push('An anonymized party must not be deanonymized');if(event.subjects?.some(s=>s.kind==='unresolved'))gaps.push('Confirm party type and identity');if(event.sensitive)gaps.push('Sensitive case context requires specialist review; contact automation is held');
  const age=event.eventDate?(new Date(now).getTime()-Date.parse(event.eventDate))/86400000:null,score=Math.min(100,(event.access==='read'?25:0)+(event.reference?15:0)+(event.subjects?.length?20:0)+(matched.length?25:0)+(age!==null&&age>=0&&age<=90?15:0));
  const relevant=!excluded.length&&!expired&&!gaps.length;
  if(relevant)reasons.push('Source-backed '+PURPOSES[w.purpose].toLowerCase()+' matches the monitoring criteria');
  gaps.push(w.purpose==='procurement'?'Supplier eligibility is unconfirmed':w.purpose==='court'?'Service relevance and contact permission require review':'Buying intent is unconfirmed');
  return {relevant,excluded:Boolean(excluded.length),score,reasons,gaps,qualification:'not_assessed',contactReadiness:'review_required'};
 }
 const FIELDS=new Set(['firstName','name','buyerName','company','buyerCompany','role','buyerRole','event','eventDate','deadline','reference','caseNumber','tenderId','jobRole','sourceUrl','evidenceUrl','sender','offer']);
 function renderMessage(template={},context={}){
  const missing=new Set(),fill=value=>String(value||'').replace(/\{\{([^{}]+)\}\}/g,(literal,key)=>{if(!FIELDS.has(key)||typeof context[key]!=='string'||!context[key].trim()){missing.add(key);return literal;}return context[key];});
  const subject=fill(template.subject),body=fill(template.body);if(!subject.trim())missing.add('subject');if(!body.trim())missing.add('body');if(/[\r\n]/.test(subject))missing.add('subject_single_line');return {subject,body,missingFields:[...missing]};
 }
 return Object.freeze({PURPOSES,normalizeWorkflow,publicUrl,buildPlan,extractEvents,assessEvent,renderMessage});
});
