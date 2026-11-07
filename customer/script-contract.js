(function(root){
'use strict';
// Count visible plain text, not HTML or UTF-16 code units. CRLF is one newline.
const count=text=>[...String(text||'').replace(/\r\n?/g,'\n').normalize('NFC')].length;
const policy='reference-characters-20261107-v1';
function contract(script={}){
 const reference=String(script.original||script.body||'');
 let maximum=script.policy===policy&&Number.isSafeInteger(script.maximumCharacters)?script.maximumCharacters:count(reference);
 if(Number.isSafeInteger(script.maximumCharacters)&&script.maximumCharacters>0)maximum=maximum?Math.min(maximum,script.maximumCharacters):script.maximumCharacters;
 // Explicit owner ceiling from NLP.docx; applies to the core email slot only.
 if(script.channel==='email'&&script.style==='curiosity'&&!String(script.id||'').startsWith('personal-'))maximum=maximum?Math.min(maximum,1074):1074;
 return {policy,sourceId:script.id||'',revision:script.revision||0,maximumCharacters:maximum||null};
}
function audit(text,rule={}){
 const characters=count(text),maximum=rule.maximumCharacters;
 const bounded=Number.isSafeInteger(maximum)&&maximum>0;
 return {characters,maximumCharacters:bounded?maximum:null,overBy:bounded?Math.max(0,characters-maximum):0,ok:!bounded||characters<=maximum};
}
function assertFits(text,rule){const result=audit(text,rule);if(!result.ok)throw Error(`Message is ${result.characters} characters; this script allows ${result.maximumCharacters}. Shorten the tailored fields by ${result.overBy} characters. Your draft is preserved.`);return result;}
const api={count,contract,audit,assertFits,policy};if(typeof module==='object'&&module.exports)module.exports=api;else root.LeadIntelScriptContract=api;
})(typeof globalThis==='object'?globalThis:this);
