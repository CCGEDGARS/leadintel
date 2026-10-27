import Translations from '../../customer/message-translations.js';
import RichText from '../../customer/rich-text.js';

// Cloud Translation Basic v2, verified 2026-10-27 against primary API docs:
// https://cloud.google.com/translate/docs/reference/rest/v2/translate
// https://cloud.google.com/translate/docs/languages (NMT: zh-CN and zh-TW).
// API keys use the documented header: https://cloud.google.com/docs/authentication/api-keys-use
// q is bounded to 128 strings; explicit en/nmt/text prevent detection or model drift.
const ENDPOINT='https://translation.googleapis.com/language/translate/v2';
const LANGUAGES=new Set([...Object.keys(Translations.languages),'tr','zh-CN','zh-TW']);
const failure=(message,status=502)=>Object.assign(new Error(message),{status});
const decode=value=>String(value).replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(all,key)=>{const named={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};if(named[key.toLowerCase()]!==undefined)return named[key.toLowerCase()];const hex=key[1]?.toLowerCase()==='x',n=parseInt(key.slice(hex?2:1),hex?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):all;});

export function validateGoogleTranslationInput({source,language,sourceLanguage='en',protectedTerms=[]}={}){
 if(sourceLanguage!=='en'||!source||typeof source!=='object'||Array.isArray(source)||typeof source.subject!=='string'||typeof source.message!=='string'||!source.message.trim())throw failure('A saved English original is required',400);
 if(!LANGUAGES.has(language)||language==='en')throw failure('Choose a supported target language',400);
 if(source.subject.length>500||source.message.length>12000||source.messageHtml!==undefined&&(typeof source.messageHtml!=='string'||source.messageHtml.length>80000))throw failure('English source exceeds the message limit',400);
 if(!Array.isArray(protectedTerms)||protectedTerms.length>100||protectedTerms.some(x=>typeof x!=='string'||x.length>300))throw failure('Protected names are invalid',400);
 if(source.messageHtml&&(!RichText.matchingHtml(source.message,source.messageHtml)||RichText.toText(source.messageHtml)!==source.message.replace(/\r\n?/g,'\n')))throw failure('English message formatting does not match its text',400);
 return {source,language,sourceLanguage,protectedTerms};
}

async function bounded(operation,parent,timeoutMs){
 const controller=new AbortController();let timer,rejectStopped;const stopped=new Promise((_,reject)=>{rejectStopped=reject;});
 const cancel=()=>{controller.abort();rejectStopped(failure(parent?.aborted?'Google translation canceled':'Google translation timed out',504));};
 timer=setTimeout(cancel,Math.max(1,Math.min(timeoutMs,20000)));parent?.addEventListener('abort',cancel,{once:true});if(parent?.aborted)cancel();
 try{return await Promise.race([Promise.resolve().then(()=>operation(controller.signal)),stopped]);}finally{clearTimeout(timer);parent?.removeEventListener('abort',cancel);controller.abort();}
}
async function requestGoogle(apiKey,q,target,{fetchImpl=fetch,signal,timeoutMs=15000}={}){
 if(typeof apiKey!=='string'||!apiKey.trim())throw failure('Connect Google Cloud Translation for this workspace first',409);
 return bounded(async boundedSignal=>{
  let response;try{response=await fetchImpl(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8','x-goog-api-key':apiKey},body:JSON.stringify({q,source:'en',target,format:'text',model:'nmt'}),signal:boundedSignal,redirect:'error'});}catch{throw failure('Google Cloud Translation could not be reached. Retry your translation.');}
  if(!response.ok)throw failure(response.status===429?'Google Cloud Translation quota is unavailable. Check your connection.':'Google Cloud Translation rejected the request. Check your connection.');
  let payload;try{const text=await response.text();if(text.length>200000)throw Error();payload=JSON.parse(text);}catch{throw failure('Google Cloud Translation returned an invalid response');}
  const rows=payload?.data?.translations;if(!Array.isArray(rows)||rows.length!==q.length||rows.some(row=>!row||typeof row.translatedText!=='string'||!row.translatedText.trim()||row.translatedText.length>80000||row.model&&row.model!=='nmt'))throw failure('Google Cloud Translation returned an incomplete response');
  return rows.map(row=>decode(row.translatedText));
 },signal,timeoutMs);
}

export async function verifyGoogleTranslationCredential(apiKey,options={}){
 // A fixed noncustomer probe verifies translation permission, billing and nmt access.
 await requestGoogle(apiKey,['Hello'],'sv',options);return true;
}

export async function translateGoogle({apiKey,source,language,protectedTerms=[],sourceLanguage='en',fetchImpl=fetch,signal,timeoutMs=15000}={}){
 validateGoogleTranslationInput({source,language,protectedTerms,sourceLanguage});
 // A random per-request prefix cannot collide with source text or another request.
 const all=source.subject+'\n'+source.message+'\n'+(source.messageHtml||'');let prefix;do{prefix='LIKEEP'+crypto.randomUUID().replace(/-/g,'')+'X';}while(all.includes(prefix));
 const terms=[...new Set(protectedTerms.filter(Boolean))].sort((a,b)=>b.length-a.length);
 const escaped=terms.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
 const pattern=new RegExp(escaped.concat(['https?:\\/\\/[^\\s<>"\\]]+','[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}','\\{\\{[^}]+\\}\\}|\\[[^\\]\\r\\n]+\\]','\\b\\d{4}-\\d{2}-\\d{2}\\b','\\b(?=[A-Za-z0-9_./-]*[A-Za-z])(?=[A-Za-z0-9_./-]*\\d)[A-Za-z0-9_./-]+\\b','[€$£₸₽]\\s*\\d+(?:[.,]\\d+)*|\\d+(?:[.,]\\d+)*(?:\\s*[%€$£₸₽])?','\\b[A-Z][A-Z0-9_-]{2,}\\b']).join('|'),'g');
 const jobs=[];let markerIndex=0;
 function segment(text){
  // Keep exact whitespace and every line boundary outside provider control.
  return text.split(/(\r\n|\r|\n)/).map(line=>{if(!line.trim())return ()=>line;const m=line.match(/^(\s*)([\s\S]*?)(\s*)$/),original=m[2],markers=[];
   const masked=original.replace(pattern,value=>{const marker=prefix+(markerIndex++)+'END';markers.push({marker,value});return marker;});
   const job={masked,markers,output:''};jobs.push(job);return ()=>m[1]+job.output+m[3];
  });
 }
 const subject=segment(source.subject);let body,htmlParts;
 if(source.messageHtml){const html=RichText.sanitize(source.messageHtml);htmlParts=html.split(/(<[^>]+>)/g).map(token=>token.startsWith('<')?token:segment(decode(token)));}
 else body=segment(source.message);
 if(jobs.length>128)throw failure('English source has too many text segments for one translation',400);
 const outputs=await requestGoogle(apiKey,jobs.map(j=>j.masked),language,{fetchImpl,signal,timeoutMs});
 for(let i=0;i<jobs.length;i++){
  const job=jobs[i];let output=outputs[i];if(/[\r\n]/.test(output)||/^\s|\s$/.test(output))throw failure('Google translation changed message structure');
  const expected=job.markers.map(m=>m.marker),actual=output.match(new RegExp(prefix+'\\d+END','g'))||[];
  if(expected.length!==actual.length||new Set(actual).size!==actual.length||expected.some(marker=>!actual.includes(marker)))throw failure('Google translation changed protected facts');
  for(const {marker,value} of job.markers)output=output.replace(marker,value);
  if(output.includes(prefix))throw failure('Google translation changed protected facts');job.output=output;
 }
 const output={subject:subject.map(f=>f()).join('')};
 if(htmlParts){output.messageHtml=htmlParts.map(part=>typeof part==='string'?part:RichText.escape(part.map(f=>f()).join(''))).join('');output.message=RichText.toText(output.messageHtml);}
 else output.message=body.map(f=>f()).join('');
 let valid;try{valid=Translations.validate(source,output,{protectedTerms});}catch{throw failure('Google translation changed protected facts, structure or message limits. Your English original is preserved.');}
 return {...valid,provider:'google-translate',model:'nmt'};
}
