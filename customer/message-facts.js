(function(root){
 'use strict';
 const clean=v=>String(v||'').replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/(?:^|\s)(?:Close|Stäng|Menu|Accept cookies)(?=\s|$)/gi,' ').replace(/[#*]/g,'').replace(/\s+/g,' ').trim();
 const unsafe=/ignore (?:all |previous )?instructions|system prompt|pretend|fabricate/i;
 function sentences(text){return String(text||'').split(/(?<=[.!?])\s+|\n+/).map(clean).filter(s=>s.length>=35&&s.length<=400&&!unsafe.test(s));}
 function event(text){return sentences(text).find(s=>! /^(?:if|what if|we help|we support|our (?:services|solutions|investment services))\b/i.test(s)&&! /\b(?:could|might|hypothetical)\b/i.test(s)&&/\b(?:(?:is|are|will|has|have|announced|plans|started|began)\b.{0,70}\b(?:invest\w*|expand\w*|expansion|opening|launch\w*|appoint\w*|acquir\w*|modernis\w*|moderniz\w*|construction|building|award\w*)|invested|invests|expanded|opens|opened|launched|appointed|acquired|awarded|satsar|bygger|ieguld\w*|paplašin\w*)\b/i.test(s))||'';}
 function eventIdentity(summary,company){const topic=/sorting|sorterings/i.test(summary)?'sorting':/factory|fabrik|ražotn/i.test(summary)?'factory':/award|\bpris|balv/i.test(summary)?'award':'';const action=/opening|opens|opened|öppn|atvēr/i.test(summary)?'open':/invest|satsar|ieguld/i.test(summary)?'invest':/construction|bygg|būv/i.test(summary)?'build':'';const years=(summary.match(/\b20\d{2}\b/g)||[]).sort();const names=(summary.match(/\b[A-ZÀ-Ž][a-zà-ž]{3,}\b/g)||[]).filter(n=>!String(company||'').includes(n)&&!['This','That','Plans','Sweden','Latvia','Latvian','Swedish','Company'].includes(n)).map(n=>n.toLowerCase()).sort();return topic&&action&&years.length&&names.length?[topic,action,...years,...names].join('|'):'';}
 function candidates(evidence=[],context={}){
  const now=Date.parse(context.now||new Date().toISOString()),rows=[];
  for(const source of evidence){let u;try{u=new URL(source.url);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)continue;}catch{continue;}
   const excerpt=clean(source.text||source.description);const company=String(context.company||'').trim().toLowerCase(),domain=String(context.domain||'').replace(/^www\./,'');const official=u.hostname.replace(/^www\./,'')===domain;if(company&&!official&&!(clean(source.title)+' '+excerpt).toLowerCase().includes(company))continue;if(!excerpt||unsafe.test(excerpt))continue;
   const summary=event(source.text||source.description)||sentences(source.text||source.description)[0]||'';
   const kind=event(source.text||source.description)?'event':'context';
   const date=!/^\/(?:en|sv|lv)?\/?$/.test(u.pathname)&&/^\d{4}-\d{2}-\d{2}$/.test(source.date||'')&&Number.isFinite(Date.parse(source.date))?source.date:'';
   const age=date?(now-Date.parse(date))/86400000:Infinity;
   rows.push({...source,url:u.href,summary,date,kind,reviewed:false,score:(kind==='event'?100:0)+(official?20:0)+(age>=0&&age<=180?15:0),recommended:false});
  }
  rows.sort((a,b)=>b.score-a.score||a.url.localeCompare(b.url));const seen=new Set(),unique=rows.filter(r=>{const key=r.url.replace(/\/(?:en|sv|lv)(?=\/)/g,'').replace(/\?.*$/,'').replace(/\/$/,'');const summaryKey=eventIdentity(r.summary,context.company)||r.summary.toLowerCase();if(seen.has(summaryKey))return false;seen.add(summaryKey);if(seen.has(key))return false;seen.add(key);return true;});
  const best=unique.find(r=>r.kind==='event');if(best)best.recommended=true;return unique;
 }
 function queries(candidate={},essentials={}){
  const company=clean(candidate.company).replace(/["\\]/g,''),offer=clean(essentials.offer).slice(0,180),problem=clean(essentials.problem).slice(0,180);
  if(!company||!candidate.domain)return [];
  return [{domain:candidate.domain,query:`"${company}" investment expansion opening project appointment award news`},{domain:candidate.domain,query:`"${company}" ${offer} ${problem} project news industry`}];
 }
 function mergeEvidence(existing=[],incoming=[],context={}){const selected=existing.find(r=>r.url===context.selectedUrl),ranked=candidates([...incoming,...existing],context).filter(r=>r.url!==selected?.url);return [...(selected?[selected]:[]),...ranked].slice(0,15);}
 function updateOpening(draft,trigger,options={}){
  if(trigger?.verification!=='user_reviewed')throw Error('Review a company fact first');
  const fact=event(trigger.excerpt);if(!fact)throw Error('This source has no specific event. Research a stronger fact first.');
  const prefixes={en:'I noticed ',lv:'Pamanīju šādu ziņu: ',sv:'Jag såg följande uppdatering: ',de:'Mir ist diese Nachricht aufgefallen: ',fr:'J’ai remarqué cette actualité : ',es:'He visto esta noticia: ',it:'Ho notato questa notizia: '};
  const language=options.language||'en';if(!prefixes[language])throw Error('Use generation for this language; opening-only update is unavailable.');
  const text=String(draft||''),parts=text.split(/\n\s*\n/),separators=[...text.matchAll(/\n\s*\n/g)];if(!parts[0]?.trim()||!parts[1]?.trim())throw Error('Generate a draft with a greeting first.');
  if(!/^(?:hi|hello|dear|hej|sveiki|labdien|hallo|bonjour|hola|ciao)\b/i.test(parts[0].trim())||parts[0].length>180)throw Error('Opening could not be identified safely. Keep your draft and use full generation.');
  const opening=prefixes[language]+fact.replace(/[.!?]+$/,'')+'.';
  const replace=/^(?:I noticed\b|I saw\b|Congratulations\b|Pamanīju\b|Jag såg\b|Mir ist\b|J’ai remarqué\b|He visto\b|Ho notato\b)/i.test(parts[1].trim());
  if(replace&&!separators[1])throw Error('Keep your draft: a safe opening boundary was not found.');
  if(replace){const end=parts[1].search(/[.!?](?=\s|$)/),first=end>=0?parts[1].slice(0,end+1):parts[1];if(end<0||/\b(?:Ltd|Inc|Corp|Co|Dr|Mr|Mrs|Ms|Prof|St|etc)\.$/i.test(first)||/\b[A-Z]\.$/.test(first)||/\b(?:I’m|I'm|I am|we|our|us|my|proven|savings|profit|costs?|results?|benefits?|calendly|Zoom)\b/i.test(first)||/\d|%/.test(first))throw Error('Opening includes other content or an uncertain boundary. Edit it manually to preserve your draft.');const rest=parts[1].slice(end+1);return parts[0]+'\n\n'+opening+rest+text.slice(separators[1].index);}
  const boundary=separators[0],remainder=text.slice(boundary.index+boundary[0].length);return parts[0]+'\n\n'+opening+'\n\n'+remainder;
 }
 function generationPrompt(prompt){return {...prompt,system:prompt.system+' Include a concise supported business outcome and approved proof when supplied. Assess earning more, saving costs and simplifying work without forcing unsupported benefits. Use exact approved customer results, figures and timeframes only; omit missing metrics. When proof is absent, the supplied website is a capabilities link, not evidence of savings or success. For a saved template, preserve its reusable structure but omit unsupported factual claims. Use the reviewed trigger summary and excerpt, not the source page title, as the opening evidence.'};}
 function openingContextReady(item,essentials){const previous=item?.messageStudioDraft?.essentials;if(!previous||!['native','complete'].includes(item.localizationStatus)||item.localizationProvenance?.language!==essentials.language)return false;const keys=new Set([...Object.keys(previous),...Object.keys(essentials)]);return [...keys].every(key=>previous[key]===essentials[key]);}
 const api=Object.freeze({clean,candidates,mergeEvidence,queries,event,updateOpening,generationPrompt,openingContextReady});if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelMessageFacts=api;
})(typeof window==='object'?window:globalThis);
