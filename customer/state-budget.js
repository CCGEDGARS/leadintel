(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelStateBudget=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";

  const MAX_SYNC_BYTES=500*1024;
  const TARGET_SYNC_BYTES=450*1024;
  const encoder=typeof TextEncoder!=="undefined"?new TextEncoder():null;

  function clone(value){return JSON.parse(JSON.stringify(value&&typeof value==="object"?value:{}));}
  function bytes(value){const text=JSON.stringify(value);return encoder?encoder.encode(text).byteLength:Buffer.byteLength(text,"utf8");}
  function cut(value,max){const text=String(value||"");return text.length>max?text.slice(0,max):text;}
  function compactMain(main={},webChars=8000,pdfChars=12000){
    const next={...main};
    if(Array.isArray(main.scrapedSources))next.scrapedSources=main.scrapedSources.slice(0,12).map(source=>({...source,text:cut(source?.text,webChars)}));
    if(Array.isArray(main.documents))next.documents=main.documents.slice(0,5).map(doc=>({...doc,text:cut(doc?.text,pdfChars)}));
    return next;
  }
  function compactBundle(input={}){
    const original=clone(input);let payload=clone(input);
    payload.main=compactMain(payload.main||{},8000,12000);
    if(bytes(payload)>TARGET_SYNC_BYTES)payload.main=compactMain(payload.main||{},4000,6000);
    if(bytes(payload)>TARGET_SYNC_BYTES)payload.main=compactMain(payload.main||{},1500,2500);
    return {payload,bytes:bytes(payload),compacted:JSON.stringify(payload)!==JSON.stringify(original)};
  }
  function prepareForSync(input={}){
    const result=compactBundle(input);
    if(result.bytes>MAX_SYNC_BYTES)throw new Error(`Workspace state is ${Math.ceil(result.bytes/1024)} KB after evidence compaction; the 500 KB sync limit was not exceeded or overwritten. Reduce unusually large pipeline/history data before retrying.`);
    return result;
  }

  return {MAX_SYNC_BYTES,TARGET_SYNC_BYTES,bytes,compactBundle,prepareForSync};
});