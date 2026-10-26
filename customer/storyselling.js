(function(root){
 'use strict';
 const types=[['what_i_do_simply','What I do, simply',['HYPOTHETICAL']],['whom_helped',"Whom I’ve helped",['REAL-OWN']],['problem','Problem',['REAL-OWN','REAL-BORROWED']],['success','Customer success',['REAL-OWN']],['two_roads','Two roads',['HYPOTHETICAL','REAL-OWN']],['borrowed_success','Borrowed success',['REAL-BORROWED']],['objection','Objection answer',['REAL-OWN']],['preemptive','Pre-emptive objection',['REAL-OWN']],['price','Price',['REAL-OWN']],['waiting','Cost of waiting',['REAL-OWN']],['sponsor','Arm the sponsor',['REAL-OWN']],['switching','Coaching the breakup',['REAL-OWN']],['honest_exit','Honest exit',['REAL-OWN']],['discovery','Discovery journey',['REAL-OWN','REAL-BORROWED']]].map(([id,label,truthClasses])=>({id,label,truthClasses}));
 const cadence=[{day:0,channel:'email',types:['problem','whom_helped'],fallback:['what_i_do_simply','borrowed_success']},{day:1,channel:'connection',types:[],fallback:[]},{day:4,channel:'email',types:['success','preemptive'],fallback:['borrowed_success']},{day:8,channel:'linkedin',types:['two_roads','discovery'],fallback:['two_roads']},{day:14,channel:'email',types:['waiting'],fallback:[]},{day:21,channel:'email',types:['honest_exit'],fallback:[]}];
 const fields=['title','story_type','truth_class','language','objective','when','where','hero_role','hero_wanted','challenge','conflict_beats','resolution','feeling_line','key_number','lesson','action','fits_segments','answers_objection','source_or_permission','quote','quote_mode','approved','approvedForSharing','sourceRefs'];
 const required=['title','objective','when','where','hero_role','hero_wanted','challenge','resolution','feeling_line','lesson','action','source_or_permission'];
 const clean=v=>String(v||'').normalize('NFKC').replace(/\s+/g,' ').trim().toLocaleLowerCase();
 const words=v=>String(v||'').trim().split(/\s+/).filter(Boolean).length;
 const http=v=>{try{const u=new URL(v);return /^https?:$/.test(u.protocol)&&!u.username&&!u.password;}catch{return false;}};
 function validateCard(c,{draft=!c?.approved}={}){
  if(!c||typeof c!=='object'||Array.isArray(c))return ['Invalid story card'];const errors=[];
  if(Object.keys(c).some(k=>!fields.includes(k)&&!['id','revision','updatedAt'].includes(k)))errors.push('Unknown card field');
  for(const k of fields.filter(k=>!['conflict_beats','fits_segments','sourceRefs','approved','approvedForSharing'].includes(k)))if(c[k]!==undefined&&(typeof c[k]!=='string'||c[k].length>(k==='title'?120:1000)))errors.push(k+' must be text within its limit');
  if(!types.some(t=>t.id===c.story_type&&t.truthClasses.includes(c.truth_class)))errors.push('This truth class is not allowed for the selected type');
  if(!['en','lv','ru','kk'].includes(c.language))errors.push('Choose a supported card language');
  if(typeof c.approved!=='boolean'||typeof c.approvedForSharing!=='boolean')errors.push('Approval must be explicit');
  for(const k of ['conflict_beats','fits_segments'])if(!Array.isArray(c[k])||c[k].length>(k==='conflict_beats'?3:20)||c[k].some(v=>typeof v!=='string'||!v.trim()||v.length>1000))errors.push(k+' must contain short text entries');
  if(!Array.isArray(c.sourceRefs)||c.sourceRefs.length>6||c.sourceRefs.some(r=>!r||typeof r.id!=='string'||!Number.isSafeInteger(r.revision)||r.revision<1||typeof r.filename!=='string'||!/^(page|image):[1-9]\d*$/.test(r.location)||Object.keys(r).some(k=>!['id','revision','filename','location'].includes(k))))errors.push('Invalid material source references');
  if(!['none','verbatim','paraphrase'].includes(c.quote_mode)||Boolean(c.quote?.trim())!==(c.quote_mode!=='none'))errors.push('Declare whether the quote is verbatim or paraphrase allowed');
  if(!draft){
   for(const k of required)if(typeof c[k]!=='string'||!c[k].trim())errors.push('Complete '+k.replaceAll('_',' '));
   if(!Array.isArray(c.conflict_beats)||c.conflict_beats.length<2)errors.push('Add two or three conflict events');
   if(!c.fits_segments?.length)errors.push('Add industry, buyer role or country tags');
   if(!c.approvedForSharing)errors.push('Confirm factual accuracy and permission to share');
   if(c.truth_class==='REAL-BORROWED'&&!http(c.source_or_permission))errors.push('Borrowed cases require a public source URL');
  }
  return errors;
 }
 function objectionClass(value){const t=clean(value);return /supplier|tool|agency|поставщик|rīks|piegādātāj|құрал/.test(t)?'switching':/expens|price|cost|дорог|цен|dārg|cen[au]|баға/.test(t)?'price':/not now|quarter|later|позже|сейчас|vēlāk|tagad|кейін/.test(t)?'waiting':/intern|board|pass|discuss|обсуд|apsprie|valde/.test(t)?'sponsor':/not interest|неинтерес|neinteresē/.test(t)?'honest_exit':'';}
 function objectionFits(card,value){if(!value)return true;const a=clean(value),b=clean(card.answers_objection);if(!b)return false;const ac=objectionClass(a),bc=objectionClass(b);if(ac&&bc)return ac===bc;const tokens=a.match(/[\p{L}\p{N}]{4,}/gu)||[];return a===b||tokens.length>0&&tokens.filter(t=>b.includes(t)).length/tokens.length>=.6;}
 function selectCard(cards,{tags=[],language='en',type='',usedIds=[],objection=''}={}){
  const tokens=tags.map(clean).filter(Boolean);if(!tokens.length)return null;
  return cards.filter(c=>c.approved&&!validateCard(c).length&&c.language===language&&(!type||c.story_type===type)&&!usedIds.includes(c.id)&&objectionFits(c,objection)).map(card=>{const fits=card.fits_segments.map(clean),matched=fits.filter(tag=>tokens.some(t=>t===tag||t.includes(tag)||tag.includes(t))),confidence=matched.length?Math.min(1,.6+.1*(matched.length-1)):0;return {card,confidence};}).filter(row=>row.confidence>=.6).sort((a,b)=>b.confidence-a.confidence||String(a.card.id).localeCompare(String(b.card.id)))[0]||null;
 }
 function validateNarrative(draft,card,channel='email'){
  const errors=[],body=String(draft?.message||''),subject=String(draft?.subject||''),norm=clean(body),limits={email:130,linkedin:90,phone:100,connection:300};
  if(channel==='connection'?Array.from(body).length>300:words(body)>(limits[channel]||130))errors.push('Message exceeds channel limit');
  if(/\b(?:story|stories)\b|\bstāst(?:s|u|i|am)\b|\bрассказ\b|\bистори[яюи]\b/iu.test(subject+' '+body))errors.push('Do not use the word story in the message');
  if(/\b(?:sorry|apologi[sz]e|can I tell|may I tell|permission to)\b/i.test(subject+' '+body))errors.push('Remove apology or permission-seeking hook');
  if(card.truth_class==='HYPOTHETICAL'&&!/(?:^|\n\s*|[.!?]\s+)(?:Suppose|Imagine|Iedomāsimies|Iedomājieties|Pieņemsim|Представьте|Допустим|Елестетіңіз)(?=$|[^\p{L}\p{N}_])/iu.test(body))errors.push('Frame the imagined example explicitly');
  if(card.truth_class==='REAL-BORROWED'&&!/(?:public|according to|reported by|you may remember|well-known|publiski|saskaņā|piemērs no|публичн|по данным|известн|дерег|жария)/iu.test(body))errors.push('Attribute the borrowed case; never imply involvement');
  if(channel!=='connection')for(const point of [card.when,card.where,card.hero_role,card.hero_wanted,card.challenge,...card.conflict_beats,card.resolution,card.feeling_line,card.key_number,card.lesson].filter(Boolean))if(!norm.includes(clean(point)))errors.push('Preserve card fact: '+point);
  if(card.quote&&card.quote_mode==='verbatim'&&/[“"«]/.test(body)&&!body.includes(card.quote))errors.push('Do not alter the approved quotation');
  const first=body.split(/\n\s*\n/).filter(Boolean).find(p=>words(p)>4)||'';if(card.resolution&&(clean(subject).includes(clean(card.resolution))||clean(first).startsWith(clean(card.resolution))))errors.push('Do not reveal the outcome in the hook');
  if(!/[?？]|\b(?:let me know|compare notes)\b/i.test(body))errors.push('End with a low-friction question or next step');
  return errors;
 }
 function validateCritic(value){if(!value||!Array.isArray(value.scores)||value.scores.length!==10||value.scores.some(n=>!Number.isInteger(n)||n<0||n>2)||!Array.isArray(value.reasons)||value.reasons.some(r=>typeof r!=='string'||r.length>1000))throw Error('Storyselling critic returned invalid scores');const score=value.scores.reduce((a,b)=>a+b,0);if(value.scores.slice(0,4).some(n=>n!==2)||score<16)throw Error('Storyselling quality check failed: '+score+'/20. '+value.reasons.join(' '));return {score,scores:value.scores,reasons:value.reasons};}
 const api={types,cadence,fields,required,objectionClass,objectionFits,validateCard,selectCard,validateNarrative,validateCritic,words};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelStoryselling=api;
})(typeof window==='object'?window:globalThis);
