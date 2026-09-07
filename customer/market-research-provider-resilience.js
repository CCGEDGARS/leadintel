const OPENAI_TIMEOUT_FLOOR_MS=75000;
const INSTALL_RETRY_MS=50;
const INSTALL_RETRY_LIMIT=80;

function patchResearchTimeout(){
  const market=window.LeadIntelMarket;
  if(!market||market.__leadintelProviderResiliencePatched)return Boolean(market&&market.__leadintelProviderResiliencePatched);
  const original=market.withTimeout;
  if(typeof original!=="function")return false;
  market.withTimeout=function(task,timeoutMs,label){
    const effectiveTimeout=label==="OpenAI search"?Math.max(Number(timeoutMs)||0,OPENAI_TIMEOUT_FLOOR_MS):timeoutMs;
    return original.call(this,task,effectiveTimeout,label);
  };
  market.__leadintelProviderResiliencePatched=true;
  return true;
}

function failureKey(item){
  const provider=item.querySelector("strong")?.textContent?.trim()||"";
  const message=item.querySelector("span")?.textContent?.trim()||"";
  return `${provider}::${message}`;
}

function dedupeFailureRows(root=document){
  const list=root.querySelector?.("#research-run-feedback ul");
  if(!list)return 0;
  const seen=new Set();let removed=0;
  for(const item of [...list.children]){
    const key=failureKey(item);
    if(!key||!seen.has(key)){if(key)seen.add(key);continue;}
    item.remove();removed++;
  }
  return removed;
}

function installReportNormalizer(root=document){
  dedupeFailureRows(root);
  if(typeof MutationObserver==="undefined")return null;
  const target=root.getElementById?.("research-run-feedback")||root.body||root.documentElement;
  if(!target)return null;
  const observer=new MutationObserver(()=>dedupeFailureRows(root));
  observer.observe(target,{childList:true,subtree:true});
  return observer;
}

function install(){
  let attempts=0;
  const tryPatch=()=>{
    if(patchResearchTimeout())return;
    attempts++;
    if(attempts<INSTALL_RETRY_LIMIT)setTimeout(tryPatch,INSTALL_RETRY_MS);
  };
  tryPatch();
  installReportNormalizer(document);
}

if(typeof window!=="undefined"&&typeof document!=="undefined")install();

export {OPENAI_TIMEOUT_FLOOR_MS,patchResearchTimeout,dedupeFailureRows,installReportNormalizer,install};
