const OPENAI_TIMEOUT_FLOOR_MS=75000;
const OPENAI_RETRY_DELAY_MS=600;
const INSTALL_RETRY_MS=50;
const INSTALL_RETRY_LIMIT=80;

const wait=delayMs=>new Promise(resolve=>setTimeout(resolve,Math.max(0,Number(delayMs)||0)));

function isTransientOpenAiFailure(error){
  const message=String(error?.message||error||'');
  return error?.name==='AbortError'||/timed out|failed to fetch|network error|temporarily unavailable|request failed \((?:408|429|5\d\d)\)|returned (?:408|429|5\d\d)/i.test(message);
}

async function withOpenAiRetry(operation,{sleep=wait}={}){
  try{return await operation(1);}
  catch(error){
    if(!isTransientOpenAiFailure(error))throw error;
    await sleep(OPENAI_RETRY_DELAY_MS);
    try{return await operation(2);}
    catch(retryError){
      if(!isTransientOpenAiFailure(retryError))throw retryError;
      const terminal=new Error('OpenAI signal discovery remained unavailable after 2 attempts');
      terminal.cause=retryError;
      throw terminal;
    }
  }
}

function describePartialCoverage({modeLabel='Research',count=0,openAiStatus='',firecrawlStatus=''}={}){
  const sourceCount=Math.max(0,Number(count)||0);
  if(openAiStatus!=='error'||firecrawlStatus==='error'||sourceCount===0)return null;
  const noun=sourceCount===1?'source was':'sources were';
  return {
    status:`${modeLabel} completed with ${sourceCount} evidence source${sourceCount===1?'':'s'}. Firecrawl succeeded; OpenAI discovery remained unavailable after an automatic retry.`,
    title:'Research completed with limited coverage',
    intro:`${sourceCount} public evidence ${noun} saved. Rerun ${modeLabel} to retry the missing OpenAI discovery without losing these results.`
  };
}

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

export {OPENAI_TIMEOUT_FLOOR_MS,OPENAI_RETRY_DELAY_MS,isTransientOpenAiFailure,withOpenAiRetry,describePartialCoverage,patchResearchTimeout,dedupeFailureRows,installReportNormalizer,install};