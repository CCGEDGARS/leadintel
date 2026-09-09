(function(root){
  const STORAGE_KEY="leadintel_customer_v2_state";
  const SELECTOR_ID="language-select";
  const STEP2_REFERENCE_SRC="step2-reference-question-runtime.js?v=20260909-question03-v5";
  function ensureStep2ReferenceRuntime(){
    if(root.LeadIntelStep2ReferenceQuestion?.version==="20260909-question03-v5"){root.LeadIntelStep2ReferenceQuestion.scheduleRepairs?.();return;}
    if(root.document.querySelector('script[data-step2-reference-bootstrap]'))return;
    const script=root.document.createElement('script');
    script.src=STEP2_REFERENCE_SRC;
    script.defer=true;
    script.dataset.step2ReferenceBootstrap='true';
    script.addEventListener('load',()=>root.LeadIntelStep2ReferenceQuestion?.scheduleRepairs?.(),{once:true});
    root.document.head.appendChild(script);
  }
  function readState(){try{return JSON.parse(root.localStorage?.getItem(STORAGE_KEY)||"{}");}catch{return {};}}
  function language(){
    const state=readState();const stored=String(state.uiLanguage||root.localStorage?.getItem("leadintel_customer_v2_language")||"lv").toLowerCase();
    return ["auto","en","lv"].includes(stored)?stored:"lv";
  }
  function apply(value){
    const selected=["auto","en","lv"].includes(value)?value:"lv";
    const state=readState();state.uiLanguage=selected;
    try{root.localStorage.setItem(STORAGE_KEY,JSON.stringify(state));root.localStorage.setItem("leadintel_customer_v2_language",selected);}catch{}
    root.document.documentElement.lang="en";
    const select=root.document.getElementById(SELECTOR_ID);if(select)select.value=selected;
    root.dispatchEvent(new CustomEvent("leadintel:language-changed",{detail:{language:selected}}));
  }
  function bind(){
    ensureStep2ReferenceRuntime();
    const select=root.document.getElementById(SELECTOR_ID);if(!select)return;
    select.value=language();select.addEventListener("change",()=>apply(select.value));
    root.document.documentElement.lang="en";
  }
  ensureStep2ReferenceRuntime();
  if(root.document.readyState==="loading")root.document.addEventListener("DOMContentLoaded",bind,{once:true});else bind();
  root.LeadIntelLanguage={get:language,set:apply};
})(globalThis);
