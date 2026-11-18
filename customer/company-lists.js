(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LeadIntelCompanyLists=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const clean=(v,n=500)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,n);
 function url(v){try{const u=new URL(v);return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password&&!u.port&&u.hostname.includes('.')&&!/^(?:localhost|127\.|10\.|192\.168\.|169\.254\.)|\.local$/.test(u.hostname)?u.href:'';}catch{return '';}}
 const domain=v=>{try{return new URL(url(v)).hostname.replace(/^www\./,'').toLowerCase();}catch{return '';}};
 function options(main={}){
  const refs=[],groups=[],seen=new Set(),portfolio=main.referenceCustomerPortfolio||{};
  const lists=(portfolio.lists||[]).slice();
  if(main.referenceCustomers?.rows?.length&&!lists.some(l=>l.id===portfolio.selectedListId))lists.push({id:'current',name:'Current references',active:true,reference:main.referenceCustomers});
  for(const list of lists){const ref=list.reference||{},members=[];
   for(const row of ref.rows||[]){const website=url(row.website),key=list.id+':'+row.id,analysis=ref.analyses?.[row.id]||{};
    if(!website||seen.has(key))continue;seen.add(key);
    const evidence=(analysis.sourceEvidence||[]).filter(e=>url(e.url)&&clean(e.quote).length>=12).map(e=>({field:clean(e.field,80),quote:clean(e.quote,700),url:url(e.url)})).slice(0,12);
    refs.push({id:key,name:clean(row.companyName,180)||domain(website),website,groupId:list.id,group:clean(list.name,120),active:list.active===true&&(ref.publishedModel?.active!==false)&&(!(ref.publishedModel?.activeIds||ref.activeIds)?.length||(ref.publishedModel?.activeIds||ref.activeIds).includes(row.id)),reason:clean(row.reason,500),evidence,summary:clean(analysis.summary,1200),ready:evidence.length>0});members.push(key);
   }
   if(members.length)groups.push({id:list.id,name:clean(list.name,120),referenceIds:members});
  }
  const signals=[{id:'lookalike',name:'Lookalike',keywords:[],description:'Similarity to your selected reference companies'}];
  for(const s of main.market?.signals||[]){const id=clean(s.id,120);if(!id||id==='lookalike'||signals.some(x=>x.id===id))continue;signals.push({id,name:clean(s.name||s.label||id,180),keywords:(Array.isArray(s.keywords)?s.keywords:[]).map(v=>clean(v,120)).filter(Boolean).slice(0,10),description:clean(s.description||s.evidenceToLookFor,700)});}
  return {references:refs,groups,signals,markets:(main.targetMarkets||[]).map(v=>clean(v,100)).filter(Boolean),profile:{offers:clean(main.profile?.priorityOffers||main.answers?.priorityOffers,1500),idealCustomer:clean(main.profile?.idealCustomer,1500),exclusions:clean(main.profile?.exclusions||main.answers?.exclusions,1500),website:url(main.website||main.profile?.website)}};
 }
 function configuration(raw={},available={}){
  const fail=m=>{throw Object.assign(Error(m),{status:400});};
  const count=Number(raw.count);if(!Number.isInteger(count)||count<1||count>200)fail('Choose between 1 and 200 companies.');
  const ids=[...new Set(raw.signalIds||[])];if(!ids.length||ids.length>8)fail('Select between one and eight signals.');
  const signals=ids.map(id=>available.signals.find(s=>s.id===id));if(signals.some(s=>!s))fail('A selected signal changed. Reload the list criteria.');
  const selected=[...new Set(raw.referenceIds||[])],references=selected.map(id=>available.references.find(r=>r.id===id));
  if(references.some(r=>!r))fail('A selected reference changed. Reload the list criteria.');
  if(ids.includes('lookalike')&&(!references.length||references.length>15||references.some(r=>!r.ready)))fail('Select 1–15 analyzed references. Analyze their websites in Profile first.');
  const markets=[...new Set((raw.markets||[]).map(v=>clean(v,100)).filter(Boolean))];if(!markets.length||markets.length>10)fail('Choose 1–10 target countries or markets.');
  const budget=Number(raw.budget||100);if(!Number.isInteger(budget)||budget<10||budget>500)fail('Choose a research allowance between 10 and 500 operations.');
  const weights={};for(const s of signals){const w=Number(raw.weights?.[s.id]??1);if(!Number.isFinite(w)||w<1||w>5)fail('Signal importance must be between 1 and 5.');weights[s.id]=w;}
  return {version:1,name:clean(raw.name,120)||'Company list',count,signals,referenceIds:selected,references:ids.includes('lookalike')?references:[],markets,mode:raw.mode==='all'?'all':'any',weights,budget,profile:available.profile};
 }
 const contains=(text,quote)=>clean(quote,3000).length>=12&&clean(text,60000).toLowerCase().includes(clean(quote,3000).toLowerCase());
 function assess(raw,config,pages,now=Date.now()){
  const website=url(raw.website),host=domain(website),company=clean(raw.company,180);if(!host||!company||host===domain(config.profile.website)||config.references.some(r=>domain(r.website)===host)||raw.excluded===true)return null;
  const proof=e=>{const page=pages.find(p=>p.url===url(e?.url));return page&&contains(page.text,e.quote)?{url:page.url,quote:clean(e.quote,1000),readAt:page.readAt,date:clean(e.date,40)}:null;};
  const identity=proof(raw.identity),location=proof(raw.location);if(!identity||domain(identity.url)!==host||!location||!config.markets.includes(raw.location?.market))return null;
  if(!clean(identity.quote).toLowerCase().includes(company.toLowerCase())&&!clean(identity.quote).toLowerCase().includes(host))return null;
  if(!clean(raw.location?.label)||!clean(location.quote).toLowerCase().includes(clean(raw.location.label).toLowerCase()))return null;
  const matches=[];
  for(const s of config.signals){const m=(raw.matches||[]).find(x=>x.signalId===s.id),e=m&&proof(m);if(!e)continue;
   let reference=null;if(s.id==='lookalike'){reference=config.references.find(r=>r.id===m.referenceId&&r.evidence.some(x=>contains(x.quote,m.referenceQuote)));if(!reference)continue;}
   const date=Date.parse(e.date),age=(now-date)/86400000;if(s.id!=='lookalike'&&(!Number.isFinite(date)||age< -1||age>365||!String(pages.find(p=>p.url===e.url)?.text||'').includes(e.date)))continue;
   const strength=Math.max(1,Math.min(100,Number(m.strength)||0));
   const quality=domain(e.url)===host?1:.85,recency=s.id==='lookalike'?1:age<=90?1:age<=180?.9:.75;
   matches.push({signalId:s.id,name:s.name,...e,score:Math.round(Math.min(90,strength)*quality*recency),reason:clean(m.reason,500),...(reference?{referenceId:reference.id,referenceName:reference.name,referenceQuote:clean(m.referenceQuote,700)}:{})});
  }
  if(!matches.length||config.mode==='all'&&matches.length!==config.signals.length)return null;
  const denominator=config.signals.reduce((n,s)=>n+config.weights[s.id],0),score=Math.round(matches.reduce((n,m)=>n+m.score*config.weights[m.signalId],0)/denominator);
  return {company,website,domain:host,location:clean(raw.location.label,180)||raw.location.market,market:raw.location.market,score,matches,identity,locationEvidence:location,checkedAt:new Date(now).toISOString(),buyingIntent:'unconfirmed'};
 }
 function mergeResult(previous,current,config){
  if(!current)return previous||null;if(!previous||previous.domain!==current.domain)return current;
  const byId=new Map();for(const m of [...previous.matches,...current.matches])if(config.signals.some(s=>s.id===m.signalId)&&(!byId.has(m.signalId)||byId.get(m.signalId).score<m.score))byId.set(m.signalId,m);
  const matches=[...byId.values()],total=config.signals.reduce((n,s)=>n+config.weights[s.id],0);
  return {...current,matches,score:Math.round(matches.reduce((n,m)=>n+m.score*config.weights[m.signalId],0)/total)};
 }
 function ranked(rows){const unique=new Map();for(const r of rows)if(!unique.has(r.domain)||unique.get(r.domain).score<=r.score)unique.set(r.domain,r);return [...unique.values()].sort((a,b)=>b.score-a.score||b.matches.length-a.matches.length||a.company.localeCompare(b.company));}
 function exportRows(list){return [['Company','Website','Location','Relevance score','Signals','Why it matches','Sources','Checked at','Buying intent','List','Criteria'],...(list.results||[]).map(r=>[r.company,r.website,r.location,r.score,r.matches.map(m=>m.name).join('; '),r.matches.map(m=>m.reason).join('; '),[...new Set([r.identity.url,r.locationEvidence.url,...r.matches.map(m=>m.url)])].join('; '),r.checkedAt,'Unconfirmed',list.name,JSON.stringify({signals:list.criteria.signals.map(s=>s.name),mode:list.criteria.mode,markets:list.criteria.markets,references:list.criteria.references.map(r=>r.name)})])];}
 const safeCell=v=>/^[\s]*[=+@-]/.test(String(v))?"'"+v:String(v??'');
 const csv=list=>'\uFEFF'+exportRows(list).map(row=>row.map(v=>'"'+safeCell(v).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 function xlsx(list){
  const xml=v=>String(v??'').replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'');
  const sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+exportRows(list).map((row,i)=>'<row r="'+(i+1)+'">'+row.map((v,j)=>'<c r="'+String.fromCharCode(65+j)+(i+1)+'" t="inlineStr"><is><t xml:space="preserve">'+xml(v)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
  const files={'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>','xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Companies" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>','xl/worksheets/sheet1.xml':sheet};
  const enc=new TextEncoder(),chunks=[],central=[];let offset=0;
  const crc=bytes=>{let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;};
  for(const [name,text] of Object.entries(files)){const n=enc.encode(name),b=enc.encode(text),checksum=crc(b),h=new Uint8Array(30+n.length),d=new DataView(h.buffer);d.setUint32(0,0x04034b50,true);d.setUint16(4,20,true);d.setUint32(14,checksum,true);d.setUint32(18,b.length,true);d.setUint32(22,b.length,true);d.setUint16(26,n.length,true);h.set(n,30);chunks.push(h,b);const c=new Uint8Array(46+n.length),v=new DataView(c.buffer);v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint32(16,checksum,true);v.setUint32(20,b.length,true);v.setUint32(24,b.length,true);v.setUint16(28,n.length,true);v.setUint32(42,offset,true);c.set(n,46);central.push(c);offset+=h.length+b.length;}
  const size=central.reduce((n,c)=>n+c.length,0),end=new Uint8Array(22),v=new DataView(end.buffer);v.setUint32(0,0x06054b50,true);v.setUint16(8,central.length,true);v.setUint16(10,central.length,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);chunks.push(...central,end);const result=new Uint8Array(offset+size+22);let i=0;for(const c of chunks){result.set(c,i);i+=c.length;}return result;
 }
 return {options,configuration,assess,mergeResult,ranked,exportRows,csv,xlsx,safeCell,url,domain};
});
