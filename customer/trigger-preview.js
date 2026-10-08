(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.LeadIntelTriggerPreview=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 function summary(row={},company=''){
  const text=String(row.summary||row.title||'').replace(/\s+/g,' ').trim();
  const firm=String(company||'The company').trim();
  // Conservative translation of identifiable Swedish event types; not a translation of unsupported details.
  if(/\b(?:satsar|investerar|investering)\b/i.test(text)&&/sovringsverk|sorteringsverk/i.test(text))
   return firm+' announced an investment in a new sorting plant'+(/malmberg/i.test(text)?' at Malmberget':'')+'.';
  if(/\b(?:satsar|investerar|investering)\b/i.test(text)&&/\b(?:ny|nytt)\s+(?:fabrik|anläggning)\b/i.test(text))
   return firm+' announced an investment in a new facility.';
  if(/\b(?:bygger|byggstart|byggnation)\b/i.test(text)&&/\b(?:ny|nytt)\s+(?:fabrik|anläggning)\b/i.test(text))
   return firm+' reported construction of a new facility.';
  if(/[åäö]/i.test(text)&&/\b(?:satsar|investerar|bygger|öppnar|förvärvar|utbyggnad|sovringsverk)\b/i.test(text))
   return firm+' reported a business development; review the source for details.';
  const first=text.split(/(?<=[.!?])\s+/u)[0]||'';
  if(first.length<=175)return /[.!?]$/.test(first)?first:first+'.';
  const clause=first.split(/[,;:–—]/)[0].trim();
  if(clause.length>=25&&clause.length<=170)return clause+'.';
  return firm+' reported a development; review the source for details.';
 }
 return Object.freeze({summary});
});
