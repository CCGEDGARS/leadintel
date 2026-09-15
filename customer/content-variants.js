(function(root,factory){
  const api=factory();
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
  if(root)root.LeadIntelContentVariants=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  const LANGUAGES=["en","lv"];
  function language(value){return String(value||"en").toLowerCase()==="lv"?"lv":"en";}
  function clone(value){return value&&typeof value==="object"?JSON.parse(JSON.stringify(value)):value;}
  function normalize(value={}){
    const input=value&&typeof value==="object"?value:{};
    return {en:input.en&&typeof input.en==="object"?clone(input.en):{},lv:input.lv&&typeof input.lv==="object"?clone(input.lv):{}};
  }
  function set(value,locale,fields){
    const next=normalize(value);next[language(locale)]={...next[language(locale)],...clone(fields)};return next;
  }
  function get(value,locale){return clone(normalize(value)[language(locale)]);}
  function has(value,locale,field){return Object.prototype.hasOwnProperty.call(normalize(value)[language(locale)],field);}
  function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
  return {LANGUAGES,language,normalize,set,get,has,same};
});

if(typeof window!=="undefined"&&typeof document!=="undefined"){
  let apolloRequested=false;
  const loadApolloEnrichment=()=>{
    if(apolloRequested||document.querySelector('script[data-leadintel-apollo-enrichment]')){apolloRequested=true;return;}
    const script=document.createElement("script");
    script.type="module";
    script.src="apollo-bulk-enrichment.js?v=20260914-stage5-scoped-v1";
    script.dataset.leadintelApolloEnrichment="true";
    script.addEventListener?.("error",()=>{apolloRequested=false;script.remove?.();},{once:true});
    apolloRequested=true;
    document.head.appendChild(script);
  };
  window.addEventListener("leadintel:open-discovery",loadApolloEnrichment);
  window.addEventListener("leadintel:module-opened",event=>{if(Number(event.detail?.step)===5)loadApolloEnrichment();});
}
