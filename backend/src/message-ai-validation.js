import Editor from '../../customer/message-editor.js';
import Studio from '../../customer/message-studio.js';
import Approved from '../../customer/approved-reference-scripts.js';
import Translations from '../../customer/message-translations.js';
const fail=message=>{throw Object.assign(Error(message),{status:502});};
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
// Sharing validators keeps protected fields separate from personal/free-form copy.
export function messageOutputValidator(body){
 if(!['outreach-generation','outreach-translation'].includes(body.task))return ()=>{};
 let input;try{input=JSON.parse(body.prompt);}catch{if(body.task==='outreach-translation')throw Object.assign(Error('A structured English translation source is required'),{status:400});return ()=>{};}
 if(body.task==='outreach-translation'){
  const source=input.source||input.copy,terms=input.protectedTerms||[];
  if(!object(source)||typeof source.subject!=='string'||typeof source.message!=='string'||!source.message.trim()||!Translations.languages[body.translation_language]||body.translation_language==='en'||!Array.isArray(terms)||terms.some(value=>typeof value!=='string'))throw Object.assign(Error('A complete English translation source and target language are required'),{status:400});
  return raw=>{let output;try{output=JSON.parse(raw);}catch{fail('Translation returned invalid JSON. Your original is preserved.');}if(!object(output)||Object.keys(output).some(key=>!['subject','message','messageHtml'].includes(key)))fail('Translation returned an invalid message schema.');try{Translations.validate(source,output,{protectedTerms:terms});}catch(cause){fail(cause.message);}};
 }
 if(!input?.coreContract||!object(input.sources))return ()=>{};
 const keys=['triggerSummary','offer','value','difference','approach','meetingValue'];
 if(!['professional','curiosity','friendly','brutal'].includes(input.style)||JSON.stringify(input.coreContract)!==JSON.stringify(Approved.coreContract(input.style))||Object.keys(input.sources).length!==6||keys.some(key=>typeof input.sources[key]!=='string'))throw Object.assign(Error('Invalid protected field preparation contract'),{status:400});
 const studio={...Studio.normalize({}),mode:input.style,essentials:{...input.sources,company:input.seller||''}},context={channel:'email',buyerCompany:input.buyer||'',buyerRole:input.buyerRole||'',trigger:input.sources.triggerSummary?{verification:'user_reviewed',url:'https://evidence.invalid',summary:input.sources.triggerSummary}:null};
 return raw=>{let output;try{output=JSON.parse(raw);}catch{fail('Protected field preparation returned invalid JSON');}try{if(input.style==='professional'&&['value','approach','meetingValue'].some(key=>output?.[key]!==''))fail('Protected literal fields must remain empty');Editor.parsePrepared(output,studio,context);for(const key of keys)if(Number.isFinite(input.wordLimits?.[key])&&String(output[key]).trim().split(/\s+/).filter(Boolean).length>input.wordLimits[key])fail('Protected field preparation exceeded its factual word limit');}catch(cause){fail(cause.message);}};
}
