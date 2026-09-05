(function(root){
  const STORAGE_KEY="leadintel_customer_v2_state";
  const SELECTOR_ID="language-select";
  function readState(){try{return JSON.parse(root.localStorage?.getItem(STORAGE_KEY)||"{}");}catch{return {};}}
  function language(){
    const state=readState();const stored=String(state.uiLanguage||root.localStorage?.getItem("leadintel_customer_v2_language")||"auto").toLowerCase();
    return ["auto","en","lv"].includes(stored)?stored:"auto";
  }
  function apply(value){
    const selected=["auto","en","lv"].includes(value)?value:"auto";
    const state=readState();state.uiLanguage=selected;
    try{root.localStorage.setItem(STORAGE_KEY,JSON.stringify(state));root.localStorage.setItem("leadintel_customer_v2_language",selected);}catch{}
    root.document.documentElement.lang=selected==="lv"?"lv":"en";
    const select=root.document.getElementById(SELECTOR_ID);if(select)select.value=selected;
    root.dispatchEvent(new CustomEvent("leadintel:language-changed",{detail:{language:selected}}));
  }
  function bind(){
    const select=root.document.getElementById(SELECTOR_ID);if(!select)return;
    select.value=language();select.addEventListener("change",()=>apply(select.value));
    root.document.documentElement.lang=language()==="lv"?"lv":"en";
  }
  if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
  root.LeadIntelLanguage={get:language,set:apply};
})(globalThis);
